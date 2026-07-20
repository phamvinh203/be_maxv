import { randomUUID } from "crypto";
import {
  clearCookies,
  gdtFetch,
  renameCookies,
} from "../../../config/gdt-client";
import {
  CaptchaResponse,
  LoginRequest,
  LoginResponse,
  PurchaseInvoiceQuery,
  PurchaseInvoiceResponse,
  SoldInvoiceQuery,
  SoldInvoiceResponse,
  SyncDirection,
  SyncInvoiceKind,
} from "../../../types/gdt";
import { Prisma, type PrismaClient, type sync_log } from "../../../generated/tenant";
import { getTenantDb } from "../../../helpers/tenantClient";
import {
  schedule as pacerSchedule,
  reportOk as pacerReportOk,
  reportRateLimited as pacerReportRateLimited,
  type PacerPriority,
} from "./gdtPacer";

/** "yyyy-MM-dd" (input FE) -> "dd/MM/yyyy" (định dạng GDT yêu cầu trong tham số `search`). */
function toGdtDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Lấy captcha + giữ lại cookie session mà GDT set.
 * Vì `key` chỉ biết sau khi nhận response, nên tạm thu thập cookie
 * dưới một tmp-key rồi re-key sang captcha.key thật (frontend sẽ gửi
 * key này lại khi login).
 */
export async function getCaptcha() {
  const tmpKey = randomUUID();
  const captcha = await gdtFetch<CaptchaResponse>("/captcha", {
    captureCookies: true,
    cookieKey: tmpKey,
  });

  renameCookies(tmpKey, captcha.key);

  return captcha;
}

/**
 * Đăng nhập HĐĐT (MST + mật khẩu + captcha).
 * Body khớp API GDT: username / password / cvalue / ckey.
 */
export async function login(body: LoginRequest) {
  const result = await gdtFetch<LoginResponse>(
    "/security-taxpayer/authenticate",
    {
      method: "POST",
      cookieKey: body.key, // gửi cookie của session đã tạo captcha
      body: JSON.stringify({
        username: body.mst,
        password: body.password,
        cvalue: body.captcha,
        ckey: body.key,
      }),
    }
  );

  // GDT trả 200 kèm `message` (không có token) khi sai captcha/thông tin
  if (!result.token) {
    clearCookies(body.key);
    throw new Error(result.message ?? "Đăng nhập thất bại");
  }

  // giữ session cookie cho các API sau login, re-key sang token
  renameCookies(body.key, result.token);

  return result;
}

/**
 * Lấy danh sách hóa đơn đầu vào (mua vào) — tương đương bước đầu của
 * `ConvertInput` bên bản C# (chỉ gọi API lấy danh sách, chưa lưu DB/tải chi tiết).
 */
export async function getPurchaseInvoices(
  token: string,
  query: PurchaseInvoiceQuery
) {
  const isMayTinhTien = query.ketQuaHd === "8";
  const path = isMayTinhTien
    ? "/sco-query/invoices/purchase"
    : "/query/invoices/purchase";

  const search = [
    `tdlap=ge=${toGdtDate(query.tuNgay)}T00:00:00`,
    `tdlap=le=${toGdtDate(query.denNgay)}T23:59:59`,
    query.trangThaiHd && `tthai==${query.trangThaiHd}`,
    query.ketQuaHd && `ttxly==${query.ketQuaHd}`,
    query.mstNguoiBan && `nbmst==${query.mstNguoiBan}`,
    query.mauHd && `khmshdon==${query.mauHd}`,
    query.soSeri && `khhdon==${query.soSeri}`,
    query.soHd && `shdon==${query.soHd}`,
  ]
    .filter(Boolean)
    .join(";");

  const params = new URLSearchParams({ sort: "tdlap:desc", size: "50", search });
  if (query.state) params.set("state", query.state);

  return gdtFetch<PurchaseInvoiceResponse>(`${path}?${params.toString()}`, {
    bearerToken: token,
  });
}

/**
 * Lấy danh sách hóa đơn đầu ra (bán ra) — tương đương bước đầu của
 * `ConvertOutput` bên bản C# (chỉ gọi API lấy danh sách, chưa lưu DB/tải chi tiết).
 */
export async function getSoldInvoices(token: string, query: SoldInvoiceQuery) {
  const isMayTinhTien = query.ketQuaHd === "8";
  const path = isMayTinhTien
    ? "/sco-query/invoices/sold"
    : "/query/invoices/sold";

  const search = [
    `tdlap=ge=${toGdtDate(query.tuNgay)}T00:00:00`,
    `tdlap=le=${toGdtDate(query.denNgay)}T23:59:59`,
    query.trangThaiHd && `tthai==${query.trangThaiHd}`,
    query.ketQuaHd && `ttxly==${query.ketQuaHd}`,
    query.mstNguoiMua && `nmmst==${query.mstNguoiMua}`,
    query.mauHd && `khmshdon==${query.mauHd}`,
    query.soSeri && `khhdon==${query.soSeri}`,
    query.soHd && `shdon==${query.soHd}`,
  ]
    .filter(Boolean)
    .join(";");

  const params = new URLSearchParams({ sort: "tdlap:desc", size: "50", search });
  if (query.state) params.set("state", query.state);

  return gdtFetch<SoldInvoiceResponse>(`${path}?${params.toString()}`, {
    bearerToken: token,
  });
}

/** User-Agent kiểu trình duyệt — một số endpoint GDT (detail) khó tính hơn, gửi kèm cho chắc (giống bản C#). */
const GDT_BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Khóa định danh 1 hóa đơn để gọi chi tiết GDT (khớp tham số endpoint detail). */
export interface InvoiceDetailKey {
  nbmst: string;
  khhdon: string;
  shdon: string;
  khmshdon: string;
  /** `ttxly === "8"` -> hóa đơn máy tính tiền -> đổi sang endpoint sco-query. */
  cashRegister: boolean;
}

/**
 * Lấy CHI TIẾT 1 hóa đơn từ GDT (`/query/invoices/detail`, hoặc `/sco-query/.../detail` cho hóa
 * đơn máy tính tiền). Tương đương thân vòng lặp `GetEIInput` bản C#. Trả nguyên payload GDT.
 */
export async function getInvoiceDetail(token: string, key: InvoiceDetailKey) {
  const path = key.cashRegister
    ? "/sco-query/invoices/detail"
    : "/query/invoices/detail";
  const params = new URLSearchParams({
    nbmst: key.nbmst,
    khhdon: key.khhdon,
    shdon: key.shdon,
    khmshdon: key.khmshdon,
  });
  return gdtFetch<Record<string, unknown>>(`${path}?${params.toString()}`, {
    bearerToken: token,
    headers: {
      "User-Agent": GDT_BROWSER_UA,
      "Cache-Control": "no-cache, no-store, max-age=0, must-revalidate",
    },
  });
}

const toStr = (v: unknown): string | undefined =>
  v === null || v === undefined ? undefined : String(v);

/** Date (từ DB) hoặc chuỗi ISO -> chuỗi ISO; kiểu khác -> undefined. */
const toIso = (v: unknown): string | undefined =>
  v instanceof Date ? v.toISOString() : typeof v === "string" && v ? v : undefined;

const toNum = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
};

const toDate = (v: unknown): Date | undefined => {
  if (typeof v !== "string" || !v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

/**
 * Chuẩn hóa 1 hóa đơn thô GDT trả về thành field khớp cột vct50view/vct60view.
 * `raw` giữ nguyên object gốc — không mất field nào kể cả khi GDT đổi/thêm field.
 *
 * `khmshdon`/`khhdon`/`shdon`/`nbmst`/`tdlap` fallback về ""/`new Date()` CHỈ để thỏa
 * ràng buộc NOT NULL của Prisma — GDT luôn trả đủ các field này trên thực tế, nên fallback
 * kích hoạt nghĩa là dữ liệu bất thường (xem cảnh báo log ở `saveInvoices` bên dưới).
 */
export function toVctData(row: Record<string, unknown>) {
  return {
    khmshdon: toStr(row.khmshdon) ?? "",
    khhdon: toStr(row.khhdon) ?? "",
    shdon: toStr(row.shdon) ?? "",
    mhdon: toStr(row.mhdon),
    tdlap: toDate(row.tdlap) ?? new Date(),
    nky: toDate(row.nky) ?? toDate(row.ntao) ?? toDate(row.ncnhat),
    nbmst: toStr(row.nbmst) ?? "",
    nbten: toStr(row.nbten) ?? "",
    nbdchi: toStr(row.nbdchi),
    nmmst: toStr(row.nmmst),
    nmten: toStr(row.nmten),
    nmdchi: toStr(row.nmdchi),
    nmcmnd: toStr(row.nmcmnd),
    dvtte: toStr(row.dvtte),
    tgia: toNum(row.tgia),
    tgtcthue: toNum(row.tgtcthue),
    tgtthue: toNum(row.tgtthue),
    ttcktmai: toNum(row.ttcktmai),
    tgtphi: toNum(row.tgtphi),
    // tổng tiền thanh toán — GDT luôn trả field này; fallback 0 chỉ để tránh NaN/undefined
    // lọt vào cột NOT NULL, không phải giá trị nghiệp vụ hợp lệ.
    tgtttbso: toNum(row.tgtttbso) ?? 0,
    tthai: toStr(row.tthai),
    ttxly: toStr(row.ttxly),
    thtttoan: toStr(row.thtttoan),
    gchu: toStr(row.gchu),
    raw: row as Prisma.InputJsonValue,
  };
}

/** Các field GDT được kỳ vọng luôn có mặt — thiếu field nào nghĩa là `toVctData` đã phải dùng fallback. */
const REQUIRED_GDT_FIELDS = ["khmshdon", "khhdon", "shdon", "nbmst", "tdlap"] as const;

/** MST gốc (bỏ đuôi chi nhánh "-xxx", khoảng trắng) để so khớp tenant vs chủ hóa đơn. */
const baseMst = (v: unknown): string => {
  if (typeof v !== "string") return "";
  const dash = v.indexOf("-"); // slice thay split -> không cấp phát mảng mỗi dòng (chạy per-row)
  return (dash === -1 ? v : v.slice(0, dash)).trim();
};

/**
 * Tìm các MST "lạ" trong lô hóa đơn — chủ hóa đơn KHÔNG phải MST của tenant đang ghi.
 * Chủ hóa đơn: mua vào = người mua (`nmmst`), bán ra = người bán (`nbmst`) — phải = MST tenant.
 *
 * Đây là lưới an toàn chống ghi nhầm data MST khác vào DB tenant (bug: token GDT tách rời khỏi
 * công ty app đang chọn — fetch data MST này nhưng ghi vào DB tenant kia). So theo MST gốc để
 * hóa đơn chi nhánh (đuôi "-001") vẫn khớp. Bỏ qua dòng thiếu MST chủ (không đủ căn cứ để chặn).
 * Trả mảng MST lạ duy nhất (rỗng nếu lô sạch).
 */
export function findForeignOwnerMsts(
  direction: "purchase" | "sold",
  rows: unknown[],
  ownMst: string,
): string[] {
  const own = baseMst(ownMst);
  const ownerField = direction === "purchase" ? "nmmst" : "nbmst";
  const foreign = new Set<string>();
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const val = (raw as Record<string, unknown>)[ownerField];
    const mst = baseMst(val);
    if (mst && mst !== own) foreign.add(String(val));
  }
  return [...foreign];
}

/**
 * Lưu (upsert) danh sách hóa đơn thô GDT vào DB tenant — `vct60view` cho chiều
 * mua vào, `vct50view` cho chiều bán ra. Khóa theo id GDT (`row.id`); hóa đơn tra
 * lại (vd đổi trạng thái) sẽ được cập nhật thay vì tạo trùng. Bỏ qua dòng thiếu id.
 *
 * `ownMst` = MST của tenant đang ghi. NÉM lỗi (không ghi gì) nếu lô chứa hóa đơn của MST khác —
 * chặn nhiễm dữ liệu ngay tại tầng ghi, kể cả khi FE gửi nhầm token GDT của công ty khác.
 */
export async function saveInvoices(
  tenantDb: PrismaClient,
  direction: "purchase" | "sold",
  rows: unknown[],
  ownMst: string,
): Promise<number> {
  // Guard chạy TRƯỚC khi dựng op/mở transaction: phát hiện data MST lạ -> dừng cả lô, báo rõ lý do
  // để người dùng biết đang đăng nhập Thuế điện tử bằng MST không khớp công ty đang chọn.
  const foreign = findForeignOwnerMsts(direction, rows, ownMst);
  if (foreign.length > 0) {
    throw new Error(
      `Dữ liệu tải về thuộc MST ${foreign.join(", ")} không khớp công ty đang chọn (MST ${ownMst}). ` +
        `Có thể bạn đang đăng nhập Thuế điện tử bằng MST khác — đăng nhập lại đúng MST rồi thử lại.`,
    );
  }

  // Gom các upsert rồi ghi trong 1 transaction: 1 round-trip thay vì N await tuần tự,
  // đồng thời đảm bảo hoặc lưu trọn cả trang hoặc không lưu gì (idempotent, tra lại vẫn đúng).
  const ops: Prisma.PrismaPromise<unknown>[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const id = toStr(row.id);
    if (!id) continue;

    const missingFields = REQUIRED_GDT_FIELDS.filter((field) => !row[field]);
    if (missingFields.length > 0) {
      console.warn(
        `[gdt.saveInvoices] Hóa đơn id=${id} (${direction}) thiếu field bắt buộc từ GDT: ${missingFields.join(", ")} — đã dùng giá trị fallback.`,
      );
    }

    const data = toVctData(row);
    ops.push(
      direction === "purchase"
        ? tenantDb.vct60view.upsert({ where: { id }, create: { id, ...data }, update: data })
        : tenantDb.vct50view.upsert({ where: { id }, create: { id, ...data }, update: data }),
    );
  }

  await tenantDb.$transaction(ops);
  return ops.length;
}

/**
 * Đếm số hóa đơn (theo id GDT) ĐÃ TỒN TẠI trong DB tenant — để `runSync` phân biệt "đã có sẵn" vs
 * "thiếu, vừa bổ sung" khi đối chiếu danh sách GDT. Trả 0 nếu `ids` rỗng.
 */
async function countExistingIds(
  tenantDb: PrismaClient,
  direction: "purchase" | "sold",
  ids: string[],
): Promise<number> {
  if (ids.length === 0) return 0;
  const where = { id: { in: ids } };
  const rows =
    direction === "purchase"
      ? await tenantDb.vct60view.findMany({ where, select: { id: true } })
      : await tenantDb.vct50view.findMany({ where, select: { id: true } });
  return rows.length;
}

/**
 * Cột cần cho danh sách hóa đơn — ĐÚNG các field `mapSavedRow` đọc.
 *
 * BẮT BUỘC phải liệt kê tường minh: `vct50view`/`vct60view` còn 2 cột JSON nặng là `detail`
 * (chi tiết hóa đơn) và `raw` (toàn bộ payload GDT gốc). findMany không có `select` sẽ kéo cả
 * hai về cho MỌI dòng rồi `mapSavedRow` vứt đi — vô ích, và là thứ khiến việc bỏ trần số dòng
 * trở nên nguy hiểm. Với `select` này mỗi dòng chỉ còn vài trăm byte.
 */
const SAVED_LIST_SELECT = {
  id: true,
  khmshdon: true,
  khhdon: true,
  shdon: true,
  tdlap: true,
  nky: true,
  nbmst: true,
  nbten: true,
  nbdchi: true,
  nmmst: true,
  nmten: true,
  nmdchi: true,
  dvtte: true,
  tgia: true,
  tgtcthue: true,
  tgtthue: true,
  ttcktmai: true,
  tgtphi: true,
  tgtttbso: true,
  tthai: true,
  ttxly: true,
  tt_tai: true,
} as const;

/** 1 hóa đơn đã lưu, chuẩn hóa lại đúng tên field GDT để FE dùng chung mapping với luồng tra cứu GDT. */
export interface SavedInvoiceRow {
  id: string;
  khmshdon: string;
  khhdon: string;
  shdon: string;
  tdlap: string;
  nky?: string;
  nbmst?: string;
  nbten?: string;
  nbdchi?: string;
  nmmst?: string;
  nmten?: string;
  nmdchi?: string;
  dvtte?: string;
  tgia?: number;
  tgtcthue?: number;
  tgtthue?: number;
  ttcktmai?: number;
  tgtphi?: number;
  tgtttbso?: number;
  tthai?: string;
  ttxly?: string;
  /** Trạng thái tải chi tiết: "OK" | "error" | undefined (chưa tải) — cột "T. thái tải". */
  tt_tai?: string;
}

/** Ép 1 dòng DB (Decimal/Date) về kiểu JSON thuần (number/string) — tránh Decimal serialize thành chuỗi ở FE. */
function mapSavedRow(row: Record<string, unknown>): SavedInvoiceRow {
  return {
    id: toStr(row.id) ?? "",
    khmshdon: toStr(row.khmshdon) ?? "",
    khhdon: toStr(row.khhdon) ?? "",
    shdon: toStr(row.shdon) ?? "",
    tdlap: toIso(row.tdlap) ?? "",
    nky: toIso(row.nky),
    nbmst: toStr(row.nbmst),
    nbten: toStr(row.nbten),
    nbdchi: toStr(row.nbdchi),
    nmmst: toStr(row.nmmst),
    nmten: toStr(row.nmten),
    nmdchi: toStr(row.nmdchi),
    dvtte: toStr(row.dvtte),
    tgia: toNum(row.tgia),
    tgtcthue: toNum(row.tgtcthue),
    tgtthue: toNum(row.tgtthue),
    ttcktmai: toNum(row.ttcktmai),
    tgtphi: toNum(row.tgtphi),
    tgtttbso: toNum(row.tgtttbso),
    tthai: toStr(row.tthai),
    ttxly: toStr(row.ttxly),
    tt_tai: toStr(row.tt_tai),
  };
}

/**
 * Dựng `where` đọc hóa đơn đã lưu: khoảng ngày lập + các field khớp query (trạng thái, kết quả,
 * mẫu số, ký hiệu, số, MST đối tác). Gom 1 chỗ để đọc danh sách và đọc chi tiết dùng chung điều kiện.
 */
function buildSavedWhere(
  direction: "purchase" | "sold",
  query: PurchaseInvoiceQuery | SoldInvoiceQuery,
) {
  const partnerMst =
    direction === "purchase"
      ? (query as PurchaseInvoiceQuery).mstNguoiBan
      : (query as SoldInvoiceQuery).mstNguoiMua;
  // Field MST đối tác khác tên theo chiều: mua vào lọc người bán (nbmst), bán ra lọc người mua (nmmst).
  const partnerWhere = partnerMst
    ? direction === "purchase"
      ? { nbmst: partnerMst }
      : { nmmst: partnerMst }
    : {};
  return {
    tdlap: {
      gte: new Date(`${query.tuNgay}T00:00:00`),
      lte: new Date(`${query.denNgay}T23:59:59.999`),
    },
    ...(query.trangThaiHd ? { tthai: query.trangThaiHd } : {}),
    ...(query.ketQuaHd ? { ttxly: query.ketQuaHd } : {}),
    ...(query.mauHd ? { khmshdon: query.mauHd } : {}),
    ...(query.soSeri ? { khhdon: query.soSeri } : {}),
    ...(query.soHd ? { shdon: query.soHd } : {}),
    ...partnerWhere,
  };
}

/**
 * Đọc hóa đơn đã lưu trong DB tenant (không gọi GDT) — `vct60view` cho chiều mua vào,
 * `vct50view` cho chiều bán ra. Lọc theo khoảng `tdlap` + các field khớp query; sort
 * ngày lập giảm dần.
 *
 * KHÔNG giới hạn số dòng: trả về TOÀN BỘ hóa đơn khớp bộ lọc, nên `total` là tổng thật
 * (trước đây cắt ở 1000 dòng khiến hóa đơn cũ hơn không cách nào xem tới, mà `total` lại
 * báo đúng 1000 như thể đó là tổng). Khối lượng do khoảng ngày người dùng chọn quyết định
 * — đọc bằng `SAVED_LIST_SELECT` (dòng nhẹ) + index `tdlap` nên khoảng rộng vẫn chịu được.
 */
export async function getSavedInvoices(
  tenantDb: PrismaClient,
  direction: "purchase" | "sold",
  query: PurchaseInvoiceQuery | SoldInvoiceQuery,
): Promise<{ total: number; datas: SavedInvoiceRow[] }> {
  const where = buildSavedWhere(direction, query);

  const rows =
    direction === "purchase"
      ? await tenantDb.vct60view.findMany({
          where,
          orderBy: { tdlap: "desc" },
          select: SAVED_LIST_SELECT,
        })
      : await tenantDb.vct50view.findMany({
          where,
          orderBy: { tdlap: "desc" },
          select: SAVED_LIST_SELECT,
        });

  const datas = (rows as Record<string, unknown>[]).map(mapSavedRow);
  return { total: datas.length, datas };
}

/**
 * Đếm HĐ đã lưu trong khoảng/bộ lọc + số HĐ CHƯA có chi tiết (`tt_tai` null hoặc "error", giống ứng
 * viên của `runDetailFetch`). Dùng cho nút "Xuất file tổng hợp + hóa đơn": chỉ cho xuất khi
 * `missing === 0` (mọi HĐ đã có chi tiết để dựng HTML/XML/PDF). Chỉ đọc DB, KHÔNG gọi GDT.
 */
export async function countDetailComplete(
  tenantDb: PrismaClient,
  direction: "purchase" | "sold",
  query: PurchaseInvoiceQuery | SoldInvoiceQuery,
): Promise<{ total: number; missing: number }> {
  const where = buildSavedWhere(direction, query);
  const missingWhere = { ...where, OR: [{ tt_tai: null }, { tt_tai: "error" }] };
  // Nhánh rõ ràng theo chiều (vct60view/vct50view là 2 delegate khác nhau) — như `countExistingIds`.
  const [total, missing] =
    direction === "purchase"
      ? await Promise.all([
          tenantDb.vct60view.count({ where }),
          tenantDb.vct60view.count({ where: missingWhere }),
        ])
      : await Promise.all([
          tenantDb.vct50view.count({ where }),
          tenantDb.vct50view.count({ where: missingWhere }),
        ]);
  return { total, missing };
}

/**
 * Đọc CHI TIẾT (cột `detail`) của các hóa đơn đã lưu trong khoảng — cho tab "Chi tiết hóa đơn"
 * hiển thị TẤT CẢ. Chỉ trả hóa đơn đã tải chi tiết (`detail` khác null), sort ngày lập giảm dần.
 * Mỗi phần tử là payload GDT gốc (FE bung mảng hàng hóa `hdhhdvu` thành từng dòng).
 */
export async function getSavedInvoiceDetails(
  tenantDb: PrismaClient,
  direction: "purchase" | "sold",
  query: PurchaseInvoiceQuery | SoldInvoiceQuery,
): Promise<Record<string, unknown>[]> {
  // Lọc "đã tải chi tiết" ngay trong WHERE để chỉ kéo về dòng thực sự có detail.
  const where = { ...buildSavedWhere(direction, query), detail: { not: Prisma.DbNull } };
  const select = { detail: true } as const;

  const rows =
    direction === "purchase"
      ? await tenantDb.vct60view.findMany({
          where,
          orderBy: { tdlap: "desc" },
          select,
        })
      : await tenantDb.vct50view.findMany({
          where,
          orderBy: { tdlap: "desc" },
          select,
        });

  return rows.flatMap((r) =>
    r.detail != null && typeof r.detail === "object"
      ? [r.detail as Record<string, unknown>]
      : [],
  );
}

// ============================================================
//  ĐỒNG BỘ HÓA ĐƠN (sync) — lặp phân trang GDT + lưu DB + ghi lịch sử
// ============================================================

/** Trần số trang/nguồn (an toàn, tránh lặp vô hạn nếu GDT trả cursor lỗi). */
const MAX_SYNC_PAGES = 200;

/** 1 nguồn dữ liệu cần quét: chiều hóa đơn × có phải hóa đơn máy tính tiền (sco-query) hay không. */
interface SyncSource {
  direction: "purchase" | "sold";
  cashRegister: boolean;
}

/** Bung lựa chọn (chiều + loại) thành danh sách nguồn cần quét. */
function resolveSyncSources(
  direction: SyncDirection,
  loai: SyncInvoiceKind,
): SyncSource[] {
  const directions: ("purchase" | "sold")[] =
    direction === "all" ? ["purchase", "sold"] : [direction];
  // all -> cả thường lẫn máy tính tiền; except_ctt -> chỉ thường; only_ctt -> chỉ máy tính tiền.
  const cashVariants: boolean[] =
    loai === "all" ? [false, true] : loai === "only_ctt" ? [true] : [false];

  return directions.flatMap((dir) =>
    cashVariants.map((cashRegister) => ({ direction: dir, cashRegister })),
  );
}

export interface SyncParams {
  tuNgay: string;
  denNgay: string;
  direction: SyncDirection;
  loai: SyncInvoiceKind;
}

const toYmd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

/**
 * Chia [tuNgay, denNgay] thành các cửa sổ nằm gọn trong TỪNG tháng dương lịch — mỗi cửa sổ
 * luôn ≤ 1 tháng, thỏa giới hạn GDT ("khoảng thời gian tìm kiếm không được lớn hơn 1 tháng").
 * Ví dụ 15/01 → 10/03 = [15/01–31/01], [01/02–28/02], [01/03–10/03].
 */
function monthlyChunks(
  tuNgay: string,
  denNgay: string,
): { tuNgay: string; denNgay: string }[] {
  const end = new Date(`${denNgay}T00:00:00`);
  const chunks: { tuNgay: string; denNgay: string }[] = [];
  let cur = new Date(`${tuNgay}T00:00:00`);

  while (cur <= end) {
    // Ngày cuối tháng của `cur` = "ngày 0" của tháng kế tiếp.
    const lastOfMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    const chunkEnd = lastOfMonth < end ? lastOfMonth : end;
    chunks.push({ tuNgay: toYmd(cur), denNgay: toYmd(chunkEnd) });
    // Ngày kế tiếp (tự nhảy sang tháng sau nếu chunkEnd là cuối tháng).
    cur = new Date(chunkEnd.getFullYear(), chunkEnd.getMonth(), chunkEnd.getDate() + 1);
  }
  return chunks;
}

/** 1 dòng sync_log kèm số liệu đối chiếu (chỉ trả về, không lưu cột đối chiếu vào DB). */
export type SyncRunResult = sync_log & { daCo: number; boSung: number };

/**
 * Đồng bộ hóa đơn 1 khoảng ngày từ GDT vào DB tenant. GDT chỉ cho tìm ≤ 1 tháng/lần nên chia
 * khoảng thành các cửa sổ theo tháng; với mỗi nguồn (chiều × loại) × mỗi cửa sổ, lặp hết các
 * trang theo cursor `state`, upsert từng trang, cộng dồn tổng/đã lưu + đối chiếu đã có/thiếu.
 *
 * Ghi sync_log THEO TỪNG CHIỀU: `direction="all"` -> 2 dòng (mua vào + bán ra) để lịch sử hiện rõ
 * "Đồng bộ hóa đơn mua vào/bán ra", KHÔNG gộp 1 dòng "tất cả". Trả MẢNG kết quả (1 phần tử/chiều),
 * mỗi phần tử kèm đối chiếu `{ daCo, boSung }`. Lỗi giữa chừng (token GDT hết hạn) -> đánh dấu
 * `partial` cho chiều đang chạy và DỪNG (không chạy chiều còn lại vì sẽ lỗi y hệt).
 */
export async function runSync(
  tenantDb: PrismaClient,
  tenantKey: string,
  gdtToken: string,
  params: SyncParams,
  ownMst: string,
): Promise<SyncRunResult[]> {
  const sources = resolveSyncSources(params.direction, params.loai);
  const chunks = monthlyChunks(params.tuNgay, params.denNgay);
  // Các chiều cần ghi log riêng (giữ thứ tự xuất hiện trong sources: purchase trước, sold sau).
  const directions = [...new Set(sources.map((s) => s.direction))];

  const results: SyncRunResult[] = [];

  for (const dir of directions) {
    const dirSources = sources.filter((s) => s.direction === dir);
    let total = 0;
    let saved = 0;
    // Đối chiếu: `daCo` = HĐ GDT đã có sẵn trong DB; `boSung` = HĐ GDT có mà DB thiếu (vừa thêm).
    // `seenIds` khử trùng để mỗi hóa đơn chỉ tính 1 lần (2 nguồn thường/máy tính tiền có thể trùng id).
    let daCo = 0;
    let boSung = 0;
    const seenIds = new Set<string>();
    let partial = false;
    let message = "";
    let aborted = false;

    for (const source of dirSources) {
      for (const chunk of chunks) {
        try {
          let state: string | undefined = undefined;
          let pages = 0;

          do {
            const query: PurchaseInvoiceQuery = {
              tuNgay: chunk.tuNgay,
              denNgay: chunk.denNgay,
              ketQuaHd: source.cashRegister ? "8" : undefined,
              state,
            };
            // Qua pacer dùng chung (điều tiết cùng token với luồng chi tiết) + retry lỗi tạm thời
            // (timeout/429/5xx) — không để 1 cú timeout làm hỏng cả lượt đồng bộ.
            const page = await fetchListPagePaced(
              tenantKey,
              gdtToken,
              source.direction,
              query,
            );

            // GDT trả `total` cho cả cửa sổ (giống nhau mỗi trang) -> cộng 1 lần/cửa sổ (trang đầu).
            if (pages === 0) total += page.total ?? 0;
            const rows = page.datas ?? [];
            // Đối chiếu trước khi upsert: id nào đã có trong DB -> "đã có", còn lại -> "thiếu, bổ sung".
            // Chỉ đối chiếu id chưa gặp trong lượt này (khử trùng giữa các nguồn/trang cùng chiều).
            const ids = rows
              .map((r) =>
                r && typeof r === "object"
                  ? toStr((r as Record<string, unknown>).id)
                  : undefined,
              )
              .filter((v): v is string => !!v && !seenIds.has(v));
            ids.forEach((id) => seenIds.add(id));
            const existed = await countExistingIds(tenantDb, source.direction, ids);
            daCo += existed;
            boSung += ids.length - existed;
            saved += await saveInvoices(tenantDb, source.direction, rows, ownMst);

            state = page.state || undefined;
            pages += 1;
            // Dừng ngay khi trang rỗng: một số API vẫn trả cursor khác rỗng ở trang cuối,
            // nếu chỉ dựa vào `state` sẽ lặp tới trần MAX_SYNC_PAGES rồi báo "partial" nhầm.
            if (rows.length === 0) break;
            // Không cần delay thủ công giữa trang: `fetchListPagePaced` đã đi qua pacer (giãn nhịp
            // thích ứng + backoff khi 429) nên nhịp cách trang đã do pacer đảm nhiệm.
          } while (state && pages < MAX_SYNC_PAGES);

          if (state && pages >= MAX_SYNC_PAGES) {
            partial = true;
            message = `Đạt giới hạn ${MAX_SYNC_PAGES} trang cho 1 cửa sổ — có thể còn dữ liệu chưa đồng bộ hết.`;
          }
        } catch (err) {
          // Lỗi (thường do token GDT hết hạn / bị chặn) -> dừng, giữ những gì đã lưu.
          partial = true;
          message = err instanceof Error ? err.message : "Lỗi khi gọi GDT.";
          aborted = true;
          break;
        }
      }
      if (aborted) break;
    }

    const log = await tenantDb.sync_log.create({
      data: {
        id: randomUUID(),
        // Nhãn hiển thị (không dùng để lọc) -> lưu ở 12:00 trưa để chênh lệch múi giờ
        // server/người xem không làm nhảy sang ngày khác.
        tu_ngay: new Date(`${params.tuNgay}T12:00:00`),
        den_ngay: new Date(`${params.denNgay}T12:00:00`),
        direction: dir,
        loai: params.loai,
        tong: total,
        da_luu: saved,
        trang_thai: partial ? "partial" : "done",
        dien_giai: message || (partial ? "Chưa hoàn thành" : "Đồng bộ thành công"),
      },
    });
    // Trả kèm số liệu đối chiếu (KHÔNG lưu vào sync_log — chỉ để FE hiện toast tóm tắt).
    results.push({ ...log, daCo, boSung });

    // Token GDT hết hạn / bị chặn -> không chạy tiếp chiều còn lại (sẽ lỗi y hệt).
    if (aborted) break;
  }

  return results;
}

/**
 * Lấy & lưu TẤT CẢ hóa đơn 1 chiều trong khoảng của `query` — GIỮ NGUYÊN bộ lọc người dùng chọn,
 * LẶP HẾT trang theo cursor `state`, chia theo tháng để thỏa giới hạn GDT (≤1 tháng/lần).
 * Trả về `{ total, saved, datas }` (datas = toàn bộ dòng thô để FE hiển thị + tải chi tiết).
 *
 * Dùng cho nút "Cập nhật từ Thuế điện tử" — thay hàm cũ chỉ lấy 1 trang (≤50 dòng). Khác `runSync`:
 * runSync quét nhiều nguồn (chiều × máy tính tiền) + ghi sync_log, KHÔNG áp bộ lọc UI và KHÔNG trả datas.
 * Mỗi trang lấy qua `fetchListPagePaced` (pacer dùng chung + retry) để chịu được timeout/429 khi chạy
 * đồng thời với luồng tải chi tiết trên cùng token — cần `tenantKey` (khóa pacer theo MST).
 */
export async function fetchAndSaveInvoicesInRange(
  tenantDb: PrismaClient,
  tenantKey: string,
  token: string,
  direction: "purchase" | "sold",
  query: PurchaseInvoiceQuery | SoldInvoiceQuery,
  ownMst: string,
): Promise<{
  total: number;
  saved: number;
  datas: unknown[];
  /** true nếu chưa lấy hết (lỗi GDT giữa chừng, hoặc chạm trần trang) — FE nên cảnh báo. */
  partial: boolean;
  message: string;
}> {
  const chunks = monthlyChunks(query.tuNgay, query.denNgay);
  let total = 0;
  let saved = 0;
  const datas: unknown[] = [];
  let partial = false;
  let message = "";

  // Lỗi giữa chừng (vd token GDT hết hạn) -> DỪNG nhưng GIỮ phần đã lưu, báo partial thay vì 500.
  try {
    for (const chunk of chunks) {
      let state: string | undefined = undefined;
      let pages = 0;

      do {
        // Giữ nguyên mọi filter của query, chỉ thay khoảng ngày theo cửa sổ tháng + cursor trang.
        const pageQuery: PurchaseInvoiceQuery & SoldInvoiceQuery = {
          ...query,
          tuNgay: chunk.tuNgay,
          denNgay: chunk.denNgay,
          state,
        };
        // Qua pacer dùng chung (điều tiết cùng token với luồng chi tiết) + retry lỗi tạm thời —
        // không để 1 cú timeout/429 làm hỏng cả lần "Cập nhật".
        const page = await fetchListPagePaced(tenantKey, token, direction, pageQuery);

        if (pages === 0) total += page.total ?? 0; // total giống nhau mỗi trang -> cộng 1 lần/cửa sổ
        const rows = page.datas ?? [];
        saved += await saveInvoices(tenantDb, direction, rows, ownMst);
        datas.push(...rows);

        state = page.state || undefined;
        pages += 1;
        if (rows.length === 0) break; // trang cuối có thể vẫn trả cursor -> dừng khi hết dòng
        // Nhịp cách trang do pacer trong `fetchListPagePaced` đảm nhiệm (không delay thủ công nữa).
      } while (state && pages < MAX_SYNC_PAGES);

      if (state && pages >= MAX_SYNC_PAGES) {
        partial = true;
        message = `Đạt giới hạn ${MAX_SYNC_PAGES} trang/tháng — có thể còn hóa đơn chưa lấy hết.`;
      }
    }
  } catch (err) {
    partial = true;
    message = err instanceof Error ? err.message : "Lỗi khi gọi GDT.";
  }

  // Bỏ qua HĐ đã tải chi tiết được quyết định phía BE trong `runDetailFetch` (WHERE tt_tai null|error),
  // nên KHÔNG cần gắn tt_tai vào `datas` ở đây (FE không đọc `res.datas` nữa).
  return { total, saved, datas, partial, message };
}

/** Danh sách lịch sử đồng bộ (mới nhất trước), giới hạn 100 dòng gần nhất. */
export async function listSyncLogs(tenantDb: PrismaClient) {
  return tenantDb.sync_log.findMany({
    orderBy: { created_at: "desc" },
    take: 100,
  });
}

/**
 * Xóa toàn bộ dữ liệu đã đồng bộ trong DB tenant: hóa đơn (vct50view/vct60view) + lịch sử
 * đồng bộ. KHÔNG đụng dữ liệu gốc trên GDT. Trả về số dòng đã xóa từng loại.
 */
export async function clearSyncedData(tenantDb: PrismaClient) {
  const [purchase, sold, logs] = await tenantDb.$transaction([
    tenantDb.vct60view.deleteMany({}),
    tenantDb.vct50view.deleteMany({}),
    tenantDb.sync_log.deleteMany({}),
  ]);
  return { purchase: purchase.count, sold: sold.count, logs: logs.count };
}

/**
 * Thống kê dữ liệu đã lưu của DB tenant: số hóa đơn mua vào/bán ra + thời điểm đồng bộ gần nhất.
 * Dùng cho tab Cài đặt › Dữ liệu hệ thống (các ô thống kê).
 */
export async function getSystemStats(tenantDb: PrismaClient) {
  const [purchase, sold, lastSync] = await Promise.all([
    tenantDb.vct60view.count(),
    tenantDb.vct50view.count(),
    tenantDb.sync_log.findFirst({
      orderBy: { created_at: "desc" },
      select: { created_at: true },
    }),
  ]);
  return { purchase, sold, lastSyncAt: lastSync?.created_at ?? null };
}

// ============================================================
//  TẢI CHI TIẾT HÓA ĐƠN (detail) — cột "T. thái tải" (tt_tai)
// ============================================================

/** Dòng tối thiểu cần để gọi detail GDT (khớp `DETAIL_SELECT`). */
interface DetailCandidate {
  id: string;
  nbmst: string;
  khhdon: string;
  shdon: string;
  khmshdon: string;
  ttxly: string | null;
}

/**
 * Chỉ 2 thao tác mà tải chi tiết cần trên bảng cache. Cast delegate vct60view/vct50view (cùng
 * schema) về đây để branch `direction` ĐÚNG 1 lần — union 2 delegate Prisma vốn không gọi được.
 */
interface DetailInvoiceStore {
  findMany(args: { where: object; select: object; orderBy?: object }): Promise<DetailCandidate[]>;
  update(args: {
    where: { id: string };
    data: { detail?: Prisma.InputJsonValue; tt_tai: string };
  }): Promise<unknown>;
  updateMany(args: {
    where: { id: string };
    data: { tt_tai: string };
  }): Promise<{ count: number }>;
}

/** Field khóa cần đọc để gọi detail GDT — dùng chung cho tải cả mẻ lẫn tải lẻ. */
const DETAIL_SELECT = {
  id: true,
  nbmst: true,
  khhdon: true,
  shdon: true,
  khmshdon: true,
  ttxly: true,
} as const;

/** Bảng cache theo chiều, ép về DetailInvoiceStore (2 model cùng schema) để branch direction 1 lần. */
function detailStore(
  tenantDb: PrismaClient,
  direction: "purchase" | "sold",
): DetailInvoiceStore {
  return (
    direction === "purchase" ? tenantDb.vct60view : tenantDb.vct50view
  ) as unknown as DetailInvoiceStore;
}

/**
 * LÕI DÙNG CHUNG: tải chi tiết 1 hóa đơn từ GDT (theo keys của `row`) rồi lưu vào cột `detail` +
 * đánh dấu `tt_tai`. Trả payload detail nếu thành công, `null` nếu lỗi (đã đánh dấu `tt_tai='error'`,
 * KHÔNG ném ra để không chặn dòng sau khi chạy cả mẻ). Dùng cho cả tải mẻ lẫn tải lẻ — tránh lặp.
 */
async function fetchAndStoreDetail(
  model: DetailInvoiceStore,
  token: string,
  row: DetailCandidate,
): Promise<{ detail: Record<string, unknown> | null; error?: string }> {
  const markRow = (data: { detail?: Prisma.InputJsonValue; tt_tai: string }) =>
    model.update({ where: { id: row.id }, data });

  try {
    const detail = await getInvoiceDetail(token, {
      nbmst: row.nbmst,
      khhdon: row.khhdon,
      shdon: row.shdon,
      khmshdon: row.khmshdon,
      cashRegister: row.ttxly === "8",
    });
    await markRow({ detail: detail as Prisma.InputJsonValue, tt_tai: "OK" });
    return { detail };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    // [DIAGNOSTIC] Lộ mã lỗi GDT thật (gdtFetch ném "GDT API Error: <status> …") để chẩn đoán vì
    // sao tải chi tiết song song hay lỗi — rate-limit (429/503)? token (401)? timeout? Bỏ sau khi rõ.
    console.warn(
      `[gdt.detail] id=${row.id} shdon=${row.shdon} tải chi tiết lỗi: ${error}`,
    );
    await markRow({ tt_tai: "error" }).catch(() => {});
    return { detail: null, error };
  }
}

/** Kết quả tải chi tiết 1 hóa đơn lẻ. */
export interface OneDetailResult {
  /** Có tìm thấy hóa đơn (theo id) trong dữ liệu đã lưu không. */
  found: boolean;
  /** Tải chi tiết từ GDT thành công không (tt_tai = "OK"). */
  ok: boolean;
  /** Payload chi tiết GDT (để FE hiển thị ngay); null nếu không tìm thấy / tải lỗi. */
  detail: Record<string, unknown> | null;
  /** [DIAGNOSTIC] Lý do lỗi GDT (mã/message) khi ok=false — để FE hiện/log khi chẩn đoán. */
  error?: string;
}

/**
 * Tải chi tiết 1 hóa đơn ĐÃ LƯU theo `id` (on-demand — nút "Xem chi tiết"). Tương đương
 * `REConvertInput` bản C#. Không tìm thấy id -> `found=false`. Dùng chung lõi `fetchAndStoreDetail`.
 */
export async function downloadOneInvoiceDetail(
  tenantDb: PrismaClient,
  token: string,
  direction: "purchase" | "sold",
  id: string,
): Promise<OneDetailResult> {
  const model = detailStore(tenantDb, direction);
  const [row] = await model.findMany({ where: { id }, select: DETAIL_SELECT });
  if (!row) return { found: false, ok: false, detail: null };

  const { detail, error } = await fetchAndStoreDetail(model, token, row);
  return { found: true, ok: detail !== null, detail, error };
}

/**
 * Đọc CHI TIẾT ĐÃ LƯU (cột `detail`) của 1 hóa đơn theo `id` — cho nút "Xem hóa đơn" dựng tờ hóa đơn
 * GTGT. KHÔNG gọi GDT (chỉ đọc DB). `found=false` nếu id không có trong dữ liệu đã lưu; `detail=null`
 * nếu hóa đơn có nhưng CHƯA tải chi tiết (FE nhắc bấm "Tải chi tiết" trước). Branch trực tiếp 2 model
 * (vct60view/vct50view) vì `detailStore` chỉ select field khóa, không có cột `detail`.
 */
export async function getSavedInvoiceDetailById(
  tenantDb: PrismaClient,
  direction: "purchase" | "sold",
  id: string,
): Promise<{ found: boolean; detail: Record<string, unknown> | null }> {
  const args = { where: { id }, select: { detail: true }, take: 1 } as const;
  const rows =
    direction === "purchase"
      ? await tenantDb.vct60view.findMany(args)
      : await tenantDb.vct50view.findMany(args);
  const row = rows[0];
  if (!row) return { found: false, detail: null };
  return {
    found: true,
    detail:
      row.detail != null && typeof row.detail === "object"
        ? (row.detail as Record<string, unknown>)
        : null,
  };
}

/**
 * Đánh dấu `tt_tai="error"` cho 1 hóa đơn đã lưu — KHÔNG gọi GDT. Dùng khi FE tải chi tiết bị lỗi
 * ở tầng HTTP (500/timeout/mất mạng) nên `fetchAndStoreDetail` chưa kịp đánh dấu; ghi bền để cột
 * "T. thái tải" vẫn hiện "Lỗi" sau khi nạp lại/reload. `updateMany` idempotent — id không tồn tại
 * -> khớp 0 dòng (không ném lỗi). Dùng: hardening khối catch của `downloadOneInvoiceDetail`.
 */
export async function markInvoiceDetailError(
  tenantDb: PrismaClient,
  direction: "purchase" | "sold",
  id: string,
): Promise<{ updated: number }> {
  const model = detailStore(tenantDb, direction);
  const { count } = await model.updateMany({ where: { id }, data: { tt_tai: "error" } });
  return { updated: count };
}

// ============================================================
//  ENGINE TẢI CHI TIẾT (BE) — chạy qua PACER dùng chung + 429-retry + tiến độ (poll từ FE)
// ============================================================

/** Tiến độ 1 lượt tải chi tiết (in-memory) — FE poll để hiện số đếm + biết khi nào xong. */
export interface DetailRunStatus {
  active: boolean;
  total: number;
  done: number;
  ok: number;
  err: number;
  startedAt: number;
  finishedAt?: number;
  /** true nếu lượt dừng sớm vì token GDT hết hạn (401/403) — FE nên nhắc đăng nhập lại. */
  authExpired?: boolean;
}

/** Số lần thử tối đa 1 hóa đơn trước khi bỏ qua (429/500 tạm thời) — lượt sau/"Đồng bộ" thử lại. */
const MAX_DETAIL_RETRY = 8;

/** Tiến độ theo (MST + chiều + mức ưu tiên): manual và background là 2 lượt riêng, cùng chạy được. */
const detailRuns = new Map<string, DetailRunStatus>();
/** "Thế hệ" hiện tại của mỗi khóa — lượt mới bump lên để lượt cũ (đổi khoảng/bộ lọc) tự dừng. */
const detailRunGen = new Map<string, number>();
const detailRunKey = (
  tenantKey: string,
  direction: "purchase" | "sold",
  priority: PacerPriority,
) => `${tenantKey}:${direction}:${priority}`;

/** Đọc tiến độ lượt tải chi tiết (FE poll). null nếu chưa từng chạy. */
export function getDetailRunStatus(
  tenantKey: string,
  direction: "purchase" | "sold",
  priority: PacerPriority = "manual",
): DetailRunStatus | null {
  return detailRuns.get(detailRunKey(tenantKey, direction, priority)) ?? null;
}

const engineSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Phân loại lỗi GDT theo MÃ STATUS (không match chuỗi trong body — tránh nhận nhầm khi body chứa
 * "timeout"/"network"). `gdtFetch` ném "GDT API Error: <status> …"; lỗi mạng/timeout của fetch
 * không có tiền tố đó.
 *  - "auth"      : 401/403 -> token GDT hết hạn/không hợp lệ -> DỪNG lượt (đừng đánh lỗi giả).
 *  - "transient" : 429/5xx hoặc lỗi mạng/timeout -> đáng retry.
 *  - "permanent" : còn lại (vd 400/404) -> lỗi thật của hóa đơn.
 */
function classifyGdtError(err: unknown): "auth" | "transient" | "permanent" {
  const msg = err instanceof Error ? err.message : String(err);
  const m = msg.match(/GDT API Error:\s*(\d+)/);
  if (m) {
    const status = Number(m[1]);
    if (status === 401 || status === 403) return "auth";
    if (status === 429 || (status >= 500 && status <= 599)) return "transient";
    return "permanent";
  }
  // Không có tiền tố -> lỗi tầng fetch (mạng/timeout/abort).
  if (/timeout|fetch failed|ECONN|socket|network|abort/i.test(msg)) return "transient";
  return "permanent";
}

/** Số lần thử tối đa 1 TRANG danh sách khi gặp lỗi tạm thời (timeout/429/5xx). */
const MAX_LIST_RETRY = 4;

/**
 * Lấy 1 TRANG danh sách hóa đơn qua PACER dùng chung của MST — điều tiết nhịp CÙNG token với luồng
 * tải chi tiết (concurrency=1, tránh 2 luồng GDT tranh nhau trên 1 token gây timeout) — kèm RETRY lỗi
 * tạm thời (timeout/429/5xx) như engine chi tiết. `priority` "manual" (thao tác người dùng: "Đồng bộ"
 * và "Cập nhật") chen trước job nền. Lỗi auth (401/403) hoặc hết retry -> ném lại cho caller để đánh
 * dấu `partial` đúng lý do (không nuốt).
 */
async function fetchListPagePaced(
  tenantKey: string,
  gdtToken: string,
  direction: "purchase" | "sold",
  query: PurchaseInvoiceQuery,
  priority: PacerPriority = "manual",
): Promise<PurchaseInvoiceResponse | SoldInvoiceResponse> {
  let attempt = 0;
  for (;;) {
    attempt += 1;
    try {
      const page = await pacerSchedule(tenantKey, priority, () =>
        direction === "purchase"
          ? getPurchaseInvoices(gdtToken, query)
          : getSoldInvoices(gdtToken, query),
      );
      pacerReportOk(tenantKey);
      return page;
    } catch (err) {
      // Lỗi tạm thời & còn lượt -> giãn nhịp pacer + backoff (500ms→1s→2s…, trần 5s) rồi thử lại.
      if (classifyGdtError(err) === "transient" && attempt < MAX_LIST_RETRY) {
        pacerReportRateLimited(tenantKey);
        await engineSleep(Math.min(5000, 500 * 2 ** (attempt - 1)));
        continue;
      }
      throw err; // auth (token hết hạn) / permanent / hết retry -> caller đánh dấu partial
    }
  }
}

/**
 * Tải chi tiết cho các hóa đơn CHƯA tải/LỖI (tt_tai null hoặc "error") trong khoảng `query`, qua
 * PACER dùng chung của MST (nhịp thích ứng + ưu tiên manual>background). Mỗi hóa đơn retry ≤
 * MAX_DETAIL_RETRY lần với lỗi tạm thời (429/500/timeout); hết retry hoặc lỗi thật -> đánh dấu
 * `tt_tai="error"` và ĐI TIẾP (không kẹt cả lượt). Chạy NỀN (không chặn caller) — trả `status` để
 * FE poll. Lượt mới cùng khóa THAY THẾ lượt cũ (đổi khoảng/bộ lọc -> tải đúng phần mới).
 * Nhận `dbName` (không phải client): mỗi hóa đơn gọi lại `getTenantDb` để refresh `lastUsed`, tránh
 * bị sweeper đóng pool giữa lượt dài. Token GDT hết hạn (401) -> DỪNG lượt, không đánh lỗi giả.
 * Dùng: manual "Cập nhật/Tải chi tiết" (priority="manual") và job backfill nền (Sub-project 2).
 */
export function runDetailFetch(
  dbName: string,
  tenantKey: string,
  token: string,
  direction: "purchase" | "sold",
  query: PurchaseInvoiceQuery | SoldInvoiceQuery,
  priority: PacerPriority = "manual",
): DetailRunStatus {
  const key = detailRunKey(tenantKey, direction, priority);
  // Lượt mới THAY THẾ lượt cũ cùng khóa (đổi khoảng/bộ lọc rồi bấm lại -> tải đúng phần mới).
  const gen = (detailRunGen.get(key) ?? 0) + 1;
  detailRunGen.set(key, gen);

  const status: DetailRunStatus = {
    active: true,
    total: 0,
    done: 0,
    ok: 0,
    err: 0,
    startedAt: Date.now(),
  };
  detailRuns.set(key, status);

  // Lấy client tenant MỚI mỗi lần (refresh lastUsed + tự lành nếu pool bị recreate).
  const freshModel = () => detailStore(getTenantDb(dbName), direction);
  // Ứng viên = HĐ chưa tải (tt_tai null) hoặc lỗi (tt_tai="error") trong khoảng đã lọc.
  const where = {
    ...buildSavedWhere(direction, query),
    OR: [{ tt_tai: null }, { tt_tai: "error" }],
  };

  // Chạy nền: caller trả về ngay, FE poll `status`. Lỗi tổng thể (vd đọc DB) -> đóng lượt.
  void (async () => {
    try {
      // orderBy tdlap desc: tải chi tiết hóa đơn MỚI trước, giảm dần về cũ (khớp backfill nền mới->cũ).
      const candidates = await freshModel().findMany({
        where,
        select: DETAIL_SELECT,
        orderBy: { tdlap: "desc" },
      });
      status.total = candidates.length;
      console.log(
        `[gdt.detailRun] ${direction}/${priority} BẮT ĐẦU: ${status.total} hóa đơn cần tải chi tiết.`,
      );

      for (const row of candidates) {
        if (detailRunGen.get(key) !== gen) break; // bị lượt mới thay thế -> dừng
        let attempt = 0;
        for (;;) {
          attempt += 1;
          try {
            const detail = await pacerSchedule(tenantKey, priority, () =>
              getInvoiceDetail(token, {
                nbmst: row.nbmst,
                khhdon: row.khhdon,
                shdon: row.shdon,
                khmshdon: row.khmshdon,
                cashRegister: row.ttxly === "8",
              }),
            );
            await freshModel().update({
              where: { id: row.id },
              data: { detail: detail as Prisma.InputJsonValue, tt_tai: "OK" },
            });
            pacerReportOk(tenantKey);
            status.ok += 1;
            break;
          } catch (err) {
            const kind = classifyGdtError(err);
            if (kind === "auth") {
              // Token GDT hết hạn -> KHÔNG đánh lỗi HĐ này (không phải lỗi của nó); dừng cả lượt,
              // các HĐ còn lại giữ nguyên (tt_tai null/error) để đăng nhập lại rồi chạy tiếp.
              console.warn(
                `[gdt.detailRun] token GDT hết hạn (${direction}/${priority}) -> dừng lượt ở ${status.done}/${status.total}.`,
              );
              status.authExpired = true;
              return;
            }
            if (kind === "transient" && attempt < MAX_DETAIL_RETRY) {
              pacerReportRateLimited(tenantKey);
              await engineSleep(Math.min(5000, 500 * 2 ** (attempt - 1)));
              continue;
            }
            // Hết retry hoặc lỗi thật -> đánh dấu lỗi, bỏ qua (lượt sau/"Đồng bộ" thử lại).
            console.warn(
              `[gdt.detailRun] id=${row.id} shdon=${row.shdon} bỏ qua sau ${attempt} lần: ${
                err instanceof Error ? err.message : String(err)
              }`,
            );
            await freshModel()
              .updateMany({ where: { id: row.id }, data: { tt_tai: "error" } })
              .catch(() => {});
            status.err += 1;
            break;
          }
        }
        status.done += 1;
        // Log tiến độ mỗi 20 hóa đơn để theo dõi lượt chạy (nhất là chạy nền) ở terminal BE.
        if (status.done % 20 === 0) {
          console.log(
            `[gdt.detailRun] ${direction}/${priority} tiến độ ${status.done}/${status.total} (ok ${status.ok}, lỗi ${status.err}).`,
          );
        }
      }
    } catch (err) {
      console.warn(
        `[gdt.detailRun] lượt (${direction}/${priority}) dừng do lỗi: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    } finally {
      // Chỉ đóng lượt nếu vẫn là lượt hiện tại (không đè trạng thái của lượt mới đã thay thế).
      if (detailRunGen.get(key) === gen) {
        status.active = false;
        status.finishedAt = Date.now();
        console.log(
          `[gdt.detailRun] ${direction}/${priority} XONG: ok ${status.ok}/${status.total}, lỗi ${status.err}${
            status.authExpired ? " (dừng vì token GDT hết hạn)" : ""
          }.`,
        );
      }
    }
  })();

  return status;
}

// ============================================================
//  BACKFILL NỀN 2 NĂM (Sub-project 2) — tự động sau khi user tìm tay 1 tháng thành công
// ============================================================

/**
 * Cửa sổ backfill nền: 2 năm gần nhất NHƯNG tới hết THÁNG TRƯỚC (tháng hiện tại do "Cập nhật" tay lo).
 * Ví dụ hôm nay 7/2026 -> [1/7/2024 .. 30/6/2026]; xử lý giảm dần 6/2026 -> ... -> 7/2024.
 */
function backfillRange(): { tuNgay: string; denNgay: string } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), 0); // ngày cuối THÁNG TRƯỚC
  const start = new Date(now.getFullYear() - 2, now.getMonth(), 1); // đầu tháng, 2 năm trước
  return { tuNgay: toYmd(start), denNgay: toYmd(end) };
}

/** Cửa sổ "gần đây" (chỉ tháng trước) — trigger sau khi đã backfill đủ, để bắt HĐ phát sinh muộn. */
function recentListRange(): { tuNgay: string; denNgay: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0); // cuối tháng trước
  return { tuNgay: toYmd(start), denNgay: toYmd(end) };
}

/** Số lần thử tối đa 1 trang danh sách khi backfill nền gặp lỗi tạm thời (429/5xx). */
const BACKFILL_LIST_RETRY = 5;

/**
 * Backfill DANH SÁCH 1 chiều trong khoảng, qua PACER (làn "background" — nhường manual). Page->save,
 * KHÔNG gom datas (nhẹ RAM cho 2 năm). Trả "auth" nếu token GDT hết hạn (dừng để login lại), "done"
 * khi xong. Lỗi tạm thời -> retry trang; lỗi thật -> bỏ chunk tháng, đi tiếp.
 */
async function backfillListRange(
  dbName: string,
  tenantKey: string,
  token: string,
  direction: "purchase" | "sold",
  tuNgay: string,
  denNgay: string,
  ownMst: string,
): Promise<"done" | "auth"> {
  let saved = 0;
  // Tháng GIẢM DẦN (mới -> cũ) để dữ liệu gần đây được lưu trước.
  for (const chunk of monthlyChunks(tuNgay, denNgay).reverse()) {
    let state: string | undefined = undefined;
    let pages = 0;
    do {
      const pageQuery = {
        tuNgay: chunk.tuNgay,
        denNgay: chunk.denNgay,
        state,
      } as PurchaseInvoiceQuery & SoldInvoiceQuery;

      let attempt = 0;
      let page: PurchaseInvoiceResponse | SoldInvoiceResponse | null = null;
      for (;;) {
        attempt += 1;
        try {
          page = await pacerSchedule(tenantKey, "background", () =>
            direction === "purchase"
              ? getPurchaseInvoices(token, pageQuery)
              : getSoldInvoices(token, pageQuery),
          );
          pacerReportOk(tenantKey);
          break;
        } catch (err) {
          const kind = classifyGdtError(err);
          if (kind === "auth") return "auth";
          if (kind === "transient" && attempt < BACKFILL_LIST_RETRY) {
            pacerReportRateLimited(tenantKey);
            await engineSleep(Math.min(5000, 500 * 2 ** (attempt - 1)));
            continue;
          }
          console.warn(
            `[gdt.backfill] list (${direction}) bỏ chunk ${chunk.tuNgay}..${chunk.denNgay} sau ${attempt} lần: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
          break; // page vẫn null -> bỏ chunk
        }
      }
      if (!page) break;

      const rows = page.datas ?? [];
      saved += await saveInvoices(getTenantDb(dbName), direction, rows, ownMst);
      state = page.state || undefined;
      pages += 1;
      if (rows.length === 0) break;
    } while (state && pages < MAX_SYNC_PAGES);
  }
  console.log(
    `[gdt.backfill] list ${direction}: đã lưu ${saved} hóa đơn (${tuNgay}..${denNgay}).`,
  );
  return "done";
}

/** Guard 1 chuỗi kickoff/tenant + đã list đủ 2 năm chưa (in-memory; restart BE thì làm lại, rẻ nhờ skip-OK). */
const backfillKicking = new Set<string>();
const backfillFullListDone = new Set<string>();

/**
 * KÍCH HOẠT backfill nền 2 năm cho 1 MST — gọi SAU KHI user "Cập nhật từ Thuế điện tử" tay THÀNH CÔNG
 * (không chạy lúc login). Fire-and-forget: trả về ngay, chạy nền tiếp cả khi đóng trình duyệt tới hết
 * hoặc token hết hạn.
 *  - Pha A: backfill DANH SÁCH (lần đầu: đủ 2 năm; lần sau: chỉ tháng gần đây để bắt HĐ mới).
 *  - Pha B: `runDetailFetch` làn "background" cho cả 2 chiều trên khoảng 2 năm (skip đã OK, retry, dừng 401).
 * Token đi theo closure; hết hạn -> dừng, login lần sau tự resume phần còn thiếu (nhờ skip-OK).
 */
export function ensureBackfill(
  dbName: string,
  tenantKey: string,
  token: string,
  ownMst: string,
): void {
  if (backfillKicking.has(tenantKey)) return; // đang có chuỗi kickoff cho MST này
  backfillKicking.add(tenantKey);
  void (async () => {
    try {
      const full = backfillRange();
      const listRange = backfillFullListDone.has(tenantKey) ? recentListRange() : full;
      console.log(
        `[gdt.backfill] tenant=${tenantKey} BẮT ĐẦU backfill nền (mới -> cũ) — list ${listRange.tuNgay}..${listRange.denNgay}${
          backfillFullListDone.has(tenantKey) ? " (tháng gần đây)" : " (đủ 2 năm)"
        }.`,
      );

      for (const direction of ["purchase", "sold"] as const) {
        const r = await backfillListRange(
          dbName,
          tenantKey,
          token,
          direction,
          listRange.tuNgay,
          listRange.denNgay,
          ownMst,
        );
        if (r === "auth") {
          console.log(`[gdt.backfill] tenant=${tenantKey} DỪNG: token GDT hết hạn (login lại để resume).`);
          return; // token hết hạn -> dừng, login sau resume
        }
      }
      backfillFullListDone.add(tenantKey);
      console.log(`[gdt.backfill] tenant=${tenantKey} list xong -> khởi động tải chi tiết nền.`);

      // Pha B: tải chi tiết nền cả 2 chiều (chỉ mở lượt nếu chưa có lượt background đang chạy).
      for (const direction of ["purchase", "sold"] as const) {
        if (!getDetailRunStatus(tenantKey, direction, "background")?.active) {
          runDetailFetch(dbName, tenantKey, token, direction, full, "background");
        }
      }
    } catch (err) {
      console.warn(
        `[gdt.backfill] tenant=${tenantKey} lỗi: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      backfillKicking.delete(tenantKey);
    }
  })();
}
