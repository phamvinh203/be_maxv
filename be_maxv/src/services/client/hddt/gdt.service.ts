import { randomUUID } from "crypto";
import {
  clearCookies,
  describeErrorChain,
  gdtFetch,
  renameCookies,
  GDT_LIST_TIMEOUT_MS,
  GdtHttpError,
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
import { env } from "../../../config/env";
import { getTenantDb } from "../../../helpers/tenantClient";
import {
  schedule as pacerSchedule,
  reportOk as pacerReportOk,
  reportRateLimited as pacerReportRateLimited,
  getIntervalMs as pacerIntervalMs,
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
 * Số hóa đơn xin GDT trả về mỗi trang danh sách — mặc định 15, đổi được bằng env `GDT_LIST_PAGE_SIZE`.
 *
 * VÌ SAO 15 CHỨ KHÔNG PHẢI 50 — đo 27/07/2026 trên MST có 1247 hóa đơn mua vào, khoảng 01–27/07:
 *   - `size=50` -> GDT trả **header 200 rồi ĐÓNG SOCKET giữa lúc gửi body**. Lỗi nổi lên ở
 *     `response.json()` dưới dạng `TypeError: terminated` (cause `UND_ERR_SOCKET: other side closed`),
 *     sau 300–760ms, HỎNG 100% SỐ LẦN — 35 lần liên tiếp, retry bao nhiêu cũng vô ích.
 *   - `size=15` -> chạy bình thường.
 * Một bản ghi hóa đơn ~4KB, nên 50 dòng ≈ 200KB còn 15 dòng ≈ 60KB: ngưỡng bị cắt nằm đâu đó ở giữa.
 * Số 50 cũ vốn chỉ chép từ request của cổng hoadondientu, chưa từng được đo.
 *
 * ĐỪNG NÂNG QUÁ 50 — đo 23/07/2026: `size=200` bị GDT trả `500` chỉ sau ~63ms, nhất quán. Trả lỗi
 * nhanh như vậy là TỪ CHỐI THAM SỐ lúc parse, không phải quá tải. `classifyGdtError` xếp 5xx NHANH
 * vào "permanent" nên lượt dừng ngay và message hiện lên FE, không retry 10 phút như trước.
 *
 * GIÁ PHẢI TRẢ khi để size nhỏ: pacer ép ≥800ms giữa 2 call làn `list` (gdtPacer.pump), nên pha danh
 * sách ≈ (tổng HĐ / size) × 800ms. 1247 HĐ: ~21s ở size 50 so với ~67s ở size 15. Nghe thì gấp 3,
 * nhưng KHÔNG đáng kể so với pha chi tiết ngay sau đó (1247 × 800ms ≈ 17 PHÚT) — nên cứ ưu tiên
 * chạy ĐƯỢC thay vì chạy nhanh.
 *
 * Ngưỡng có thể khác nhau theo MST (hóa đơn nhiều dòng thuế suất thì bản ghi nặng hơn), nên đây chỉ
 * là điểm KHỞI ĐẦU: `fetchListPagePaced` tự hạ tiếp khi vẫn bị cắt (xem `shrinkListPageSize`).
 *
 * Đọc qua `env` chứ KHÔNG qua `process.env` trực tiếp: `server.ts` nạp `./app` trước `./config/env`,
 * nên module này có thể chạy trước khi dotenv kịp đọc `.env.local` — lúc đó `process.env` còn trống
 * và giá trị trong file bị bỏ qua âm thầm. `env` đảm bảo dotenv đã chạy xong.
 */
const GDT_LIST_PAGE_SIZE = env.gdtListPageSize;

/**
 * Lấy danh sách hóa đơn đầu vào (mua vào) — tương đương bước đầu của
 * `ConvertInput` bên bản C# (chỉ gọi API lấy danh sách, chưa lưu DB/tải chi tiết).
 */
export async function getPurchaseInvoices(
  token: string,
  query: PurchaseInvoiceQuery,
  pageSize: number = GDT_LIST_PAGE_SIZE,
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

  const params = new URLSearchParams({
    sort: "tdlap:desc",
    size: String(pageSize),
    search,
  });
  if (query.state) params.set("state", query.state);

  return gdtFetch<PurchaseInvoiceResponse>(`${path}?${params.toString()}`, {
    bearerToken: token,
    // Cắt sớm call danh sách bị GDT "nuốt" (xem GDT_LIST_TIMEOUT_MS) — caller sẽ retry.
    signal: AbortSignal.timeout(GDT_LIST_TIMEOUT_MS),
  });
}

/**
 * Lấy danh sách hóa đơn đầu ra (bán ra) — tương đương bước đầu của
 * `ConvertOutput` bên bản C# (chỉ gọi API lấy danh sách, chưa lưu DB/tải chi tiết).
 */
export async function getSoldInvoices(
  token: string,
  query: SoldInvoiceQuery,
  pageSize: number = GDT_LIST_PAGE_SIZE,
) {
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

  const params = new URLSearchParams({
    sort: "tdlap:desc",
    size: String(pageSize),
    search,
  });
  if (query.state) params.set("state", query.state);

  return gdtFetch<SoldInvoiceResponse>(`${path}?${params.toString()}`, {
    bearerToken: token,
    // Cắt sớm call danh sách bị GDT "nuốt" (xem GDT_LIST_TIMEOUT_MS) — caller sẽ retry.
    signal: AbortSignal.timeout(GDT_LIST_TIMEOUT_MS),
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
  // Dòng bị bỏ vì thiếu `id` (khóa upsert): trước đây bỏ im lặng nên "lấy được N dòng mà lưu 0"
  // không để lại dấu vết nào. Đếm lại để cảnh báo ở cuối hàm.
  let skippedNoId = 0;
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const id = toStr(row.id);
    if (!id) {
      skippedNoId += 1;
      continue;
    }

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

  if (skippedNoId > 0) {
    console.warn(
      `[DEBUG-LIST] saveInvoices(${direction}): BỎ QUA ${skippedNoId}/${rows.length} dòng vì thiếu ` +
        `field "id" của GDT -> không lưu được dòng nào trong số đó.`,
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

/**
 * Trần số trang/cửa sổ — CHỈ là chốt an toàn chống lặp vô hạn, KHÔNG phải giới hạn nghiệp vụ.
 *
 * Trần 200 trang cũ (=10.000 hóa đơn/tháng) quá thấp: công ty bán lẻ dùng máy tính tiền vượt mức
 * đó trong một tháng là bình thường, và khi chạm trần thì lượt bị ghi `partial` với phần dữ liệu
 * còn lại KHÔNG BAO GIỜ lấy được (chạy lại cũng chạm trần y hệt). 20.000 trang = 1 triệu hóa đơn
 * cho 1 cửa sổ tháng — thực tế không ai chạm tới, nhưng vẫn chặn được vòng lặp vô hạn.
 *
 * Việc dừng đúng lúc do `isCursorStuck` lo (xem dưới), không phải do con số này.
 */
const MAX_SYNC_PAGES = 20_000;

/**
 * Cursor KHÔNG tiến triển: GDT trả về đúng `state` của lần gọi trước -> lật trang nữa cũng ra y
 * hệt, cứ lặp là ghi trùng vô hạn. Đây mới là điều kiện dừng thật khi phân trang hỏng; trần
 * `MAX_SYNC_PAGES` chỉ còn là lưới an toàn cuối.
 */
function isCursorStuck(prev: string | undefined, next: string | undefined): boolean {
  return !!next && next === prev;
}

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
 * Tiến độ 1 lượt đồng bộ CHẠY NỀN (FE poll `GET /gdt/sync/run/status`). Cùng triết lý với
 * `DetailRunStatus`: state in-memory theo tiến trình BE, restart là mất (dữ liệu đã upsert vẫn
 * nằm trong DB nên chạy lại chỉ bổ sung phần thiếu).
 */
export interface SyncRunStatus {
  active: boolean;
  /** Bước đang chạy, vd "Bán ra (máy tính tiền) 2026-07-01..2026-07-31". Rỗng khi đã xong. */
  phase: string;
  /** Số dòng GDT đã đi qua (không trừ trùng) — dùng cho dòng tiến độ "đang lấy N hóa đơn…". */
  rows: number;
  saved: number;
  daCo: number;
  boSung: number;
  /** Trang hiện tại trong cửa sổ đang quét (GDT không cho biết tổng số trang). */
  page: number;
  startedAt: number;
  finishedAt?: number;
  /** Người dùng bấm Dừng (hoặc lượt mới thay thế lượt này). */
  cancelled?: boolean;
  /** Lỗi TỔNG THỂ của lượt (vd đọc DB) — khác `results[].dien_giai` (lý do dừng theo chiều). */
  error?: string;
  /** sync_log đã ghi (1 dòng/chiều) — FE hiện toast tóm tắt như luồng cũ khi lượt kết thúc. */
  results: SyncRunResult[];
}

/** Tiến độ theo MST: mỗi công ty tối đa 1 lượt đồng bộ (2 lượt cùng token sẽ dội GDT). */
const syncRuns = new Map<string, SyncRunStatus>();
/** "Thế hệ" hiện tại của mỗi khóa — bump lên để lượt đang chạy tự thoát (Dừng / lượt mới). */
const syncRunGen = new Map<string, number>();

/** Đọc tiến độ lượt đồng bộ (FE poll). null nếu công ty này chưa từng chạy lượt nào. */
export function getSyncRunStatus(tenantKey: string): SyncRunStatus | null {
  return syncRuns.get(tenantKey) ?? null;
}

/**
 * Yêu cầu DỪNG lượt đang chạy: bật cờ `cancelled` để vòng lặp trong `runSync` thoát ở điểm kiểm tra
 * gần nhất (giữa 2 trang). Không giết ngang giữa 1 call GDT đang bay — trang đó vẫn được lưu xong.
 *
 * CỐ Ý không bump `gen` ở đây: `gen` chỉ dùng để nhận biết "lượt này đã bị lượt MỚI thay thế". Bump
 * ở đây sẽ làm khối `finally` của chính lượt đang chạy không nhận ra mình -> `active` treo mãi.
 */
export function cancelSyncRun(tenantKey: string): SyncRunStatus | null {
  const status = syncRuns.get(tenantKey);
  if (!status?.active) return status ?? null;
  status.cancelled = true;
  status.phase = "Đang dừng…";
  console.log(`[DEBUG-SYNC] Nhận yêu cầu DỪNG lượt đồng bộ tenant=${tenantKey}`);
  return status;
}

/**
 * Bắt đầu lượt đồng bộ CHẠY NỀN rồi trả tiến độ NGAY (không chặn request) — FE poll
 * `getSyncRunStatus` tới khi `active=false`. Nhờ vậy không còn HTTP request kéo hàng chục phút
 * (nguyên nhân 502 khi chạy sau IIS/proxy).
 *
 * Đang có lượt chạy -> TRẢ LẠI lượt đó, KHÔNG chạy chồng: 2 lượt cùng 1 token GDT sẽ tranh nhau
 * và làm GDT chặn nặng hơn (xem gdtPacer). Muốn chạy khoảng khác thì bấm Dừng trước.
 */
export function startSyncRun(
  dbName: string,
  tenantKey: string,
  gdtToken: string,
  params: SyncParams,
  ownMst: string,
): SyncRunStatus {
  const running = syncRuns.get(tenantKey);
  if (running?.active) return running;

  const gen = (syncRunGen.get(tenantKey) ?? 0) + 1;
  syncRunGen.set(tenantKey, gen);

  const status: SyncRunStatus = {
    active: true,
    phase: "Đang chuẩn bị…",
    rows: 0,
    saved: 0,
    daCo: 0,
    boSung: 0,
    page: 0,
    startedAt: Date.now(),
    results: [],
  };
  syncRuns.set(tenantKey, status);

  // Chạy nền: caller trả về ngay. Mọi lỗi đã được runSync nuốt thành `partial`; `catch` ở đây chỉ
  // để bắt sự cố ngoài dự tính (vd ghi sync_log lỗi) — không được để promise văng ra unhandled.
  void (async () => {
    try {
      status.results = await runSync(dbName, tenantKey, gdtToken, params, ownMst, {
        status,
        // Dừng khi: người dùng bấm Dừng, HOẶC lượt này đã bị một lượt mới thay thế.
        isCancelled: () => status.cancelled === true || syncRunGen.get(tenantKey) !== gen,
      });
    } catch (err) {
      status.error = err instanceof Error ? err.message : "Lỗi khi đồng bộ hóa đơn.";
      console.error(`[DEBUG-SYNC] Lượt đồng bộ tenant=${tenantKey} lỗi tổng thể: ${status.error}`);
    } finally {
      // Chỉ đóng lượt nếu vẫn là lượt hiện tại (không đè trạng thái của lượt mới đã thay thế).
      if (syncRunGen.get(tenantKey) === gen) {
        status.active = false;
        status.phase = "";
        status.finishedAt = Date.now();
      }
    }
  })();

  return status;
}

/** Nhãn nguồn đang quét để FE hiện "đang làm gì" (không dùng để rẽ nhánh logic). */
function sourceLabel(
  direction: "purchase" | "sold",
  cashRegister: boolean,
  chunk: { tuNgay: string; denNgay: string },
): string {
  return (
    `${direction === "purchase" ? "Mua vào" : "Bán ra"}${cashRegister ? " (máy tính tiền)" : ""} ` +
    `${chunk.tuNgay}..${chunk.denNgay}`
  );
}

/** Điều khiển lượt đồng bộ khi chạy NỀN: cập nhật tiến độ + cho phép hủy giữa chừng. */
interface SyncRunControl {
  /** Object tiến độ (chia sẻ với `getSyncRunStatus`) — runSync ghi trực tiếp vào đây. */
  status?: SyncRunStatus;
  /** true -> người dùng bấm Dừng (hoặc lượt mới thay thế) -> thoát sạch, giữ phần đã lưu. */
  isCancelled?: () => boolean;
}

/**
 * Nhãn chiều hóa đơn dùng trong `sync_log.dien_giai` — khớp cách gọi trên UI (tab đầu vào/đầu ra).
 * KHÔNG có `all`: mỗi dòng lịch sử luôn thuộc đúng 1 chiều (xem docblock `runSync`), nên kiểu hẹp
 * ở đây để compiler chặn nếu sau này có ai ghi log với `direction="all"`.
 */
const DIRECTION_TEXT: Record<"purchase" | "sold", string> = {
  purchase: "đầu vào",
  sold: "đầu ra",
};

/**
 * Diễn giải chuẩn cho 1 dòng lịch sử: `"<Hành động> hóa đơn <chiều>"`, nối lý do sau dấu gạch khi
 * lượt chưa hoàn thành. Đây là thứ DUY NHẤT phân biệt dòng của nút "Đồng bộ từ Thuế" với nút
 * "Cập nhật từ Thuế điện tử" — `sync_log` không có cột hành động riêng và cố ý không thêm.
 *
 * Nhận nguyên trạng thái lượt chạy (không nhận chuỗi lý do đã nấu sẵn) để quy ước "dở dang mà
 * không có message thì ghi 'Chưa hoàn thành'" chỉ tồn tại một bản.
 */
function buildDienGiai(
  action: "Đồng bộ" | "Cập nhật",
  direction: "purchase" | "sold",
  run: { partial: boolean; message?: string },
): string {
  const base = `${action} hóa đơn ${DIRECTION_TEXT[direction]}`;
  const reason = run.message || (run.partial ? "Chưa hoàn thành" : "");
  return reason ? `${base} — ${reason}` : base;
}

/**
 * Bộ lọc `ketQuaHd` của tab -> cột `loai` của `sync_log`. Đây là ánh xạ NGƯỢC của `ketQuaVariants`
 * trong `fetchAndSaveInvoicesInRange`: sửa chỗ đó mà quên chỗ này thì cột `loai` trong lịch sử sẽ
 * sai lặng lẽ. Dùng: `writeUpdateSyncLog` — lượt "Cập nhật" không có sẵn khái niệm `loai`.
 */
function kindFromKetQuaHd(ketQuaHd?: string): SyncInvoiceKind {
  if (!ketQuaHd) return "all"; // rỗng -> quét cả 2 nguồn
  return ketQuaHd === "8" ? "only_ctt" : "except_ctt";
}

/**
 * Dựng + ghi 1 dòng `sync_log`. CẢ nút "Đồng bộ từ Thuế" lẫn nút "Cập nhật từ Thuế điện tử" đều đi
 * qua đây, để các quy ước của bảng chỉ tồn tại MỘT bản: `id` uuid, mốc 12:00 trưa cho nhãn ngày,
 * ánh xạ `partial -> trang_thai`, và cách dựng `dien_giai`.
 */
function createSyncLogRow(
  db: PrismaClient,
  p: {
    action: "Đồng bộ" | "Cập nhật";
    direction: "purchase" | "sold";
    loai: SyncInvoiceKind;
    tuNgay: string;
    denNgay: string;
    total: number;
    saved: number;
    partial: boolean;
    message?: string;
  },
) {
  return db.sync_log.create({
    data: {
      id: randomUUID(),
      // Nhãn hiển thị (không dùng để lọc) -> lưu ở 12:00 trưa để chênh lệch múi giờ
      // server/người xem không làm nhảy sang ngày khác.
      tu_ngay: new Date(`${p.tuNgay}T12:00:00`),
      den_ngay: new Date(`${p.denNgay}T12:00:00`),
      direction: p.direction,
      loai: p.loai,
      tong: p.total,
      da_luu: p.saved,
      trang_thai: p.partial ? "partial" : "done",
      dien_giai: buildDienGiai(p.action, p.direction, p),
    },
  });
}

/**
 * Đồng bộ hóa đơn 1 khoảng ngày từ GDT vào DB tenant. GDT chỉ cho tìm ≤ 1 tháng/lần nên chia
 * khoảng thành các cửa sổ theo tháng; với mỗi nguồn (chiều × loại) × mỗi cửa sổ, lặp hết các
 * trang theo cursor `state`, upsert từng trang, cộng dồn tổng/đã lưu + đối chiếu đã có/thiếu.
 *
 * Ghi sync_log THEO TỪNG CHIỀU: `direction="all"` -> 2 dòng (mua vào + bán ra) để lịch sử hiện rõ
 * "Đồng bộ hóa đơn mua vào/bán ra", KHÔNG gộp 1 dòng "tất cả". Trả MẢNG kết quả (1 phần tử/chiều),
 * mỗi phần tử kèm đối chiếu `{ daCo, boSung }`. Lỗi giữa chừng (token GDT hết hạn) -> đánh dấu
 * `partial` cho chiều đang chạy và DỪNG (không chạy chiều còn lại vì sẽ lỗi y hệt).
 *
 * Nhận `dbName` (không phải client) vì lượt chạy rất dài: mỗi lần đụng DB gọi lại `getTenantDb` để
 * refresh `lastUsed`, tránh bị sweeper (idle > 10') đóng pool giữa chừng — cùng lý do với
 * `runDetailFetch`. `ctl` chỉ có khi chạy nền qua `startSyncRun`.
 */
export async function runSync(
  dbName: string,
  tenantKey: string,
  gdtToken: string,
  params: SyncParams,
  ownMst: string,
  ctl?: SyncRunControl,
): Promise<SyncRunResult[]> {
  // Client tenant MỚI mỗi lần đụng DB (refresh lastUsed + tự lành nếu pool bị recreate).
  const db = () => getTenantDb(dbName);
  const st = ctl?.status;
  const cancelled = () => ctl?.isCancelled?.() === true;
  const sources = resolveSyncSources(params.direction, params.loai);
  const chunks = monthlyChunks(params.tuNgay, params.denNgay);
  // [DEBUG-SYNC] Mốc bắt đầu + đếm dòng tích lũy toàn lượt: đối chiếu "dừng ở khoảng hóa đơn thứ mấy"
  // và "chạy được bao nhiêu giây" (nếu request bị cắt ở proxy thì log BE vẫn chạy tiếp sau đó).
  const runStartedAt = Date.now();
  let rowsSoFar = 0;
  const elapsed = () => `${((Date.now() - runStartedAt) / 1000).toFixed(1)}s`;
  console.log(
    `[DEBUG-SYNC] === BẮT ĐẦU ĐỒNG BỘ === tenant=${tenantKey} ${params.tuNgay}..${params.denNgay} ` +
      `direction=${params.direction} loai=${params.loai} | ${sources.length} nguồn × ${chunks.length} tháng`,
  );
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
        if (cancelled()) break;
        if (st) st.phase = sourceLabel(source.direction, source.cashRegister, chunk);
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
              // Bấm Dừng -> thoát cả vòng retry (có thể đang nghỉ backoff), không đợi hết ngân sách.
              ctl?.isCancelled,
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
            const existed = await countExistingIds(db(), source.direction, ids);
            daCo += existed;
            boSung += ids.length - existed;
            saved += await saveInvoices(db(), source.direction, rows, ownMst);

            rowsSoFar += rows.length;
            // Tiến độ cho FE poll (chỉ khi chạy nền): cộng dồn TOÀN lượt, không reset theo chiều.
            if (st) {
              st.rows = rowsSoFar;
              st.saved = results.reduce((sum, r) => sum + r.da_luu, 0) + saved;
              st.daCo = results.reduce((sum, r) => sum + r.daCo, 0) + daCo;
              st.boSung = results.reduce((sum, r) => sum + r.boSung, 0) + boSung;
              st.page = pages + 1;
            }
            // [DEBUG-SYNC] Mỗi trang 1 dòng log: biết chính xác dừng ở hóa đơn thứ mấy / trang mấy.
            console.log(
              `[DEBUG-SYNC] ${elapsed()} ${source.direction}${source.cashRegister ? "(máy tính tiền)" : ""} ` +
                `${chunk.tuNgay}..${chunk.denNgay} trang ${pages + 1}: +${rows.length} dòng ` +
                `(tích lũy ${rowsSoFar}, đã lưu ${saved}, còn trang sau: ${page.state ? "có" : "hết"})`,
            );

            // Cursor đứng yên -> lật nữa chỉ ra đúng trang này, dừng để khỏi ghi trùng vô hạn.
            if (isCursorStuck(state, page.state || undefined)) {
              console.warn(
                `[DEBUG-SYNC] ${source.direction} ${chunk.tuNgay}..${chunk.denNgay}: cursor không đổi ` +
                  `sau trang ${pages + 1} -> dừng cửa sổ này (phân trang GDT không tiến triển).`,
              );
              state = undefined;
              pages += 1;
              break;
            }

            state = page.state || undefined;
            pages += 1;
            // Dừng ngay khi trang rỗng: một số API vẫn trả cursor khác rỗng ở trang cuối,
            // nếu chỉ dựa vào `state` sẽ lặp tới trần MAX_SYNC_PAGES rồi báo "partial" nhầm.
            if (rows.length === 0) break;
            // Người dùng bấm Dừng giữa chừng -> thoát ngay, phần đã upsert vẫn nằm trong DB.
            if (cancelled()) break;
            // Không cần delay thủ công giữa trang: `fetchListPagePaced` đã đi qua pacer (giãn nhịp
            // thích ứng + backoff khi 429) nên nhịp cách trang đã do pacer đảm nhiệm.
          } while (state && pages < MAX_SYNC_PAGES);

          if (state && pages >= MAX_SYNC_PAGES) {
            // Chạm lưới an toàn = phân trang GDT bất thường (1 cửa sổ tháng không thể có 1 triệu
            // hóa đơn), KHÔNG phải "dữ liệu quá nhiều" như hiểu nhầm với trần 200 trang cũ.
            partial = true;
            message =
              `Dừng ở lưới an toàn ${MAX_SYNC_PAGES} trang cho 1 cửa sổ (phân trang GDT bất ` +
              `thường) — có thể còn dữ liệu chưa đồng bộ hết.`;
          }
        } catch (err) {
          // Lỗi (thường do token GDT hết hạn / bị chặn) -> dừng, giữ những gì đã lưu.
          // Bấm Dừng cũng rơi vào đây (fetchListPagePaced ném lại lỗi đang chờ retry) -> ghi lý do
          // "đã dừng" thay vì phơi lỗi GDT ra lịch sử, vì đó không phải sự cố.
          partial = true;
          message = cancelled()
            ? "Đã dừng theo yêu cầu — phần đã lấy vẫn được giữ lại."
            : err instanceof Error
              ? err.message
              : "Lỗi khi gọi GDT.";
          aborted = true;
          // [DEBUG-SYNC] Điểm DỪNG của lượt: kèm số dòng đã đi qua để đối chiếu mốc "~1000 hóa đơn".
          console.error(
            `[DEBUG-SYNC] ${elapsed()} !!! DỪNG GIỮA CHỪNG ở ${source.direction} ` +
              `${chunk.tuNgay}..${chunk.denNgay} sau ${rowsSoFar} dòng — loại lỗi="${classifyGdtError(err)}". ` +
              `Message trả về FE: ${message}`,
          );
          break;
        }
      }
      if (aborted || cancelled()) break;
    }

    // Bấm Dừng -> ghi lịch sử là "partial" với lý do rõ ràng (không phải lỗi GDT).
    if (cancelled() && !aborted) {
      partial = true;
      message = "Đã dừng theo yêu cầu — phần đã lấy vẫn được giữ lại.";
    }

    const log = await createSyncLogRow(db(), {
      action: "Đồng bộ",
      direction: dir,
      loai: params.loai,
      tuNgay: params.tuNgay,
      denNgay: params.denNgay,
      total,
      saved,
      partial,
      message,
    });
    // Trả kèm số liệu đối chiếu (KHÔNG lưu vào sync_log — chỉ để FE hiện toast tóm tắt).
    results.push({ ...log, daCo, boSung });
    // Đẩy ngay sang status để FE thấy chiều vừa xong mà không phải đợi cả lượt kết thúc.
    if (st) st.results = [...results];

    // Token GDT hết hạn / bị chặn / người dùng dừng -> không chạy tiếp chiều còn lại.
    if (aborted || cancelled()) break;
  }

  // [DEBUG-SYNC] Nếu dòng này in ra mà FE đã báo lỗi từ trước -> BE vẫn chạy xong, lỗi nằm ở
  // tầng kết nối (proxy/dev-server cắt request), KHÔNG phải lỗi đồng bộ.
  console.log(
    `[DEBUG-SYNC] === KẾT THÚC ĐỒNG BỘ === ${elapsed()}, tổng ${rowsSoFar} dòng, ` +
      `${results.length} bản ghi lịch sử: ${results.map((r) => `${r.direction}=${r.trang_thai}`).join(", ")}`,
  );

  return results;
}

/**
 * Tiến độ 1 lượt "Cập nhật từ Thuế điện tử" chạy NỀN (FE poll `GET .../update-run/status`).
 * Gộp CẢ HAI pha vào một object để FE chỉ cần một vòng poll và một toast: `phase` cho biết đang ở
 * pha nào. Cùng triết lý với `SyncRunStatus`/`DetailRunStatus`: in-memory theo tiến trình BE,
 * restart là mất (dữ liệu đã upsert vẫn nằm trong DB nên chạy lại chỉ bổ sung phần thiếu).
 */
export interface UpdateRunStatus {
  active: boolean;
  /** Pha đang chạy; "" khi đã xong. */
  phase: "list" | "detail" | "";
  /** Trang hiện tại trong cửa sổ tháng đang quét (GDT không cho biết tổng số trang). */
  page: number;
  /** Số dòng GDT đã đi qua, cộng dồn cả lượt. */
  rows: number;
  /** Số dòng đã upsert vào DB. */
  saved: number;
  /** GDT báo có bao nhiêu hóa đơn khớp bộ lọc trong khoảng. */
  total: number;
  /** Nguồn đang quét: "thường" | "máy tính tiền" — chỉ để hiển thị, không rẽ nhánh logic. */
  source: string;
  /** Lấy chưa hết (lỗi GDT giữa chừng / chạm lưới an toàn) + lý do. */
  partial: boolean;
  message: string;
  /** Tiến độ pha chi tiết — gán THAM CHIẾU tới `DetailRunStatus` của engine (xem `startUpdateRun`). */
  detail: { total: number; done: number; ok: number; err: number; authExpired?: boolean };
  startedAt: number;
  finishedAt?: number;
  /** Lỗi tổng thể của lượt (vd guard MST lệch, lỗi đọc DB). */
  error?: string;
}

/**
 * Lấy & lưu TẤT CẢ hóa đơn 1 chiều trong khoảng của `query` — GIỮ NGUYÊN bộ lọc người dùng chọn,
 * LẶP HẾT trang theo cursor `state`, chia theo tháng để thỏa giới hạn GDT (≤1 tháng/lần).
 * Trả về `{ total, saved, datas }` (datas = toàn bộ dòng thô để FE hiển thị + tải chi tiết).
 *
 * Dùng cho nút "Cập nhật từ Thuế điện tử" — thay hàm cũ chỉ lấy 1 trang (≤50 dòng).
 *
 * Khi ô "Kết quả kiểm tra" để TẤT CẢ: quét CẢ HAI nguồn của GDT (hóa đơn thường ở `/query/...` và
 * hóa đơn máy tính tiền `ttxly=8` ở `/sco-query/...`) — giống `runSync`. Trước đây chỉ gọi endpoint
 * thường nên bỏ sót sạch hóa đơn máy tính tiền. Người dùng chọn đích danh 1 kết quả -> chỉ quét
 * đúng nguồn tương ứng. Khác `runSync` ở chỗ: runSync ghi sync_log, KHÔNG áp bộ lọc UI, KHÔNG trả datas.
 * Mỗi trang lấy qua `fetchListPagePaced` (pacer dùng chung + retry) để chịu được timeout/429 khi chạy
 * đồng thời với luồng tải chi tiết trên cùng token — cần `tenantKey` (khóa pacer theo MST).
 *
 * Nhận `dbName` (không phải client) vì lượt nền có thể chạy hàng chục phút: mỗi lần đụng DB gọi lại
 * `getTenantDb` để refresh `lastUsed`, tránh bị sweeper (idle > 10') đóng pool giữa chừng — cùng lý
 * do với `runSync`/`runDetailFetch`.
 */
export async function fetchAndSaveInvoicesInRange(
  dbName: string,
  tenantKey: string,
  token: string,
  direction: "purchase" | "sold",
  query: PurchaseInvoiceQuery | SoldInvoiceQuery,
  ownMst: string,
  /**
   * Chỉ có khi chạy NỀN qua `startUpdateRun`: `status` để ghi tiến độ cho FE poll, `budgetMs` để
   * dùng ngân sách retry rộng (10'), `isCancelled` để lượt ĐÃ BỊ THAY THẾ tự thoát. Luồng chặn cũ
   * truyền ngân sách 60s vì giữ HTTP request mở.
   */
  ctl?: { status?: UpdateRunStatus; budgetMs?: number; isCancelled?: () => boolean },
): Promise<{
  total: number;
  saved: number;
  datas: unknown[];
  /** true nếu chưa lấy hết (lỗi GDT giữa chừng, hoặc chạm trần trang) — FE nên cảnh báo. */
  partial: boolean;
  message: string;
  /** true nếu dừng vì token GDT hết hạn (401/403) — caller KHÔNG nên chạy tiếp pha chi tiết. */
  authExpired: boolean;
}> {
  // Client tenant MỚI mỗi lần đụng DB (refresh lastUsed + tự lành nếu pool bị recreate).
  const db = () => getTenantDb(dbName);
  const st = ctl?.status;
  const budgetMs = ctl?.budgetMs ?? LIST_RETRY_BUDGET_MS;
  // Lượt này đã bị lượt MỚI thay thế -> thoát sạch. Bắt buộc phải có: nếu không, bấm lại (hoặc mở
  // app ở 2 tab) sẽ để 2 vòng quét cùng chiều + cùng token cùng chạy tới hết, dội GDT gấp đôi —
  // đúng thứ pacer sinh ra để tránh. Phần đã upsert vẫn nằm trong DB nên thoát giữa chừng an toàn.
  const cancelled = () => ctl?.isCancelled?.() === true;
  let authExpired = false;
  const chunks = monthlyChunks(query.tuNgay, query.denNgay);
  // "Kết quả kiểm tra = Tất cả" (ketQuaHd rỗng) phải rà soát MỌI nguồn, không chỉ endpoint thường:
  // GDT để hóa đơn máy tính tiền (`ttxly=8`) ở `/sco-query/invoices/...` riêng, nên gọi một mình
  // `/query/invoices/...` là bỏ sót sạch loại này (công ty bán lẻ hầu như chỉ có loại này -> tab
  // đầu ra ra rỗng). Người dùng chọn cụ thể một kết quả -> tôn trọng, chỉ quét đúng nguồn đó.
  // Sửa dòng dưới thì phải sửa `kindFromKetQuaHd` (ánh xạ ngược, dùng cho cột `loai` của lịch sử).
  const ketQuaVariants: (string | undefined)[] = query.ketQuaHd ? [query.ketQuaHd] : [undefined, "8"];
  let total = 0;
  let saved = 0;
  /** Số dòng GDT đã đi qua — đếm riêng vì `datas` chỉ được giữ ở luồng chặn (xem chỗ push). */
  let rowsSeen = 0;
  const datas: unknown[] = [];
  let partial = false;
  let message = "";
  // [DEBUG-GDT] Log cho nút "Cập nhật từ Thuế điện tử" (song song với [DEBUG-SYNC] của nút Đồng bộ).
  const runStartedAt = Date.now();
  const elapsed = () => `${((Date.now() - runStartedAt) / 1000).toFixed(1)}s`;
  console.log(
    `[DEBUG-CAPNHAT] === BẮT ĐẦU CẬP NHẬT === tenant=${tenantKey} ${direction} ` +
      `${query.tuNgay}..${query.denNgay} | ${chunks.length} tháng | ` +
      `${ketQuaVariants.length} nguồn (${ketQuaVariants.map((v) => v ?? "thường").join(" + ")})` +
      // In size ĐANG dùng của MST này (có thể đã tự hạ vì GDT cắt body) — log tự nói nó chạy ở mức nào.
      ` | size=${listPageSizeFor(tenantKey)}`,
  );

  // Lỗi giữa chừng (vd token GDT hết hạn) -> DỪNG nhưng GIỮ phần đã lưu, báo partial thay vì 500.
  try {
    for (const ketQuaHd of ketQuaVariants) {
      if (cancelled()) break;
      /** Nhãn nguồn đang quét, để log phân biệt được 2 lượt trên cùng khoảng ngày. */
      const src = ketQuaHd === "8" ? "máy tính tiền" : ketQuaHd ? `ttxly=${ketQuaHd}` : "thường";
      for (const chunk of chunks) {
        if (cancelled()) break;
        let state: string | undefined = undefined;
        let pages = 0;

        do {
          // Giữ nguyên mọi filter của query, chỉ thay khoảng ngày theo cửa sổ tháng + cursor trang
          // + nguồn đang quét (thường / máy tính tiền).
          const pageQuery: PurchaseInvoiceQuery & SoldInvoiceQuery = {
            ...query,
            ketQuaHd,
            tuNgay: chunk.tuNgay,
            denNgay: chunk.denNgay,
            state,
          };
          // Qua pacer dùng chung (điều tiết cùng token với luồng chi tiết) + retry lỗi tạm thời —
          // không để 1 cú timeout/429 làm hỏng cả lần "Cập nhật". Ngân sách do caller quyết định:
          // chạy nền -> 10' (lấy đủ), chạy chặn -> 60s (proxy cắt request trước khi kịp lâu hơn).
          const page = await fetchListPagePaced(
            tenantKey,
            token,
            direction,
            pageQuery,
            // Bị lượt mới thay thế -> thoát cả vòng retry (có thể đang nghỉ backoff 15s).
            ctl?.isCancelled,
            budgetMs,
          );

          if (pages === 0) total += page.total ?? 0; // total giống nhau mỗi trang -> cộng 1 lần/cửa sổ
          const rows = page.datas ?? [];
          saved += await saveInvoices(db(), direction, rows, ownMst);
          rowsSeen += rows.length;
          // Chỉ GIỮ LẠI dòng thô khi có người đọc (endpoint chặn cũ trả `datas` về FE). Lượt chạy
          // nền không ai đọc `datas` mà lượt lại dài: giữ hết sẽ ôm hàng chục MB payload GDT thô
          // trong RAM suốt lượt, chỉ để lấy `.length`.
          if (!st) datas.push(...rows);

          // Tiến độ cho FE poll (chỉ khi chạy nền) — cộng dồn toàn lượt, không reset theo nguồn.
          if (st) {
            st.rows = rowsSeen;
            st.saved = saved;
            st.total = total;
            st.source = src;
            st.page = pages + 1;
          }

          // [DEBUG-CAPNHAT] Mỗi trang 1 dòng: biết dừng ở hóa đơn thứ mấy khi lỗi.
          console.log(
            `[DEBUG-CAPNHAT] ${elapsed()} ${direction}(${src}) ${chunk.tuNgay}..${chunk.denNgay} ` +
              `trang ${pages + 1}: +${rows.length} dòng (tích lũy ${rowsSeen}, đã lưu ${saved}, ` +
              `còn trang sau: ${page.state ? "có" : "hết"})`,
          );

          // Cursor đứng yên -> dừng cửa sổ này (xem isCursorStuck), khỏi lặp ghi trùng vô hạn.
          if (isCursorStuck(state, page.state || undefined)) {
            console.warn(
              `[DEBUG-CAPNHAT] ${direction}(${src}) ${chunk.tuNgay}..${chunk.denNgay}: cursor không ` +
                `đổi sau trang ${pages + 1} -> dừng cửa sổ này.`,
            );
            state = undefined;
            pages += 1;
            break;
          }

          state = page.state || undefined;
          pages += 1;
          if (rows.length === 0) break; // trang cuối có thể vẫn trả cursor -> dừng khi hết dòng
          if (cancelled()) break; // lượt mới đã thay thế -> ngừng, phần đã upsert vẫn giữ
          // Nhịp cách trang do pacer trong `fetchListPagePaced` đảm nhiệm (không delay thủ công nữa).
        } while (state && pages < MAX_SYNC_PAGES);

        if (state && pages >= MAX_SYNC_PAGES) {
          partial = true;
          message =
            `Dừng ở lưới an toàn ${MAX_SYNC_PAGES} trang/tháng (phân trang GDT bất thường) — ` +
            `có thể còn hóa đơn chưa lấy hết.`;
        }
      }
    }
  } catch (err) {
    partial = true;
    // Token hết hạn -> caller phải DỪNG, không chạy tiếp pha chi tiết (cùng token sẽ lỗi y hệt).
    authExpired = classifyGdtError(err) === "auth";
    message = err instanceof Error ? err.message : "Lỗi khi gọi GDT.";
    // [DEBUG-CAPNHAT] Điểm dừng + loại lỗi (auth = token GDT hết hạn, transient = GDT chặn/quá tải).
    console.error(
      `[DEBUG-CAPNHAT] ${elapsed()} !!! DỪNG GIỮA CHỪNG ${direction} sau ${rowsSeen} dòng — ` +
        `loại lỗi="${classifyGdtError(err)}". Message trả về FE: ${message}`,
    );
  }

  // [DEBUG-CAPNHAT] In ra sau khi FE đã báo lỗi -> lỗi ở tầng kết nối chứ không phải luồng lấy dữ liệu.
  console.log(
    `[DEBUG-CAPNHAT] === KẾT THÚC CẬP NHẬT === ${elapsed()}, ${rowsSeen} dòng, đã lưu ${saved}, ` +
      `partial=${partial}${message ? ` (${message})` : ""}`,
  );

  // Bỏ qua HĐ đã tải chi tiết được quyết định phía BE trong `runDetailFetch` (WHERE tt_tai null|error),
  // nên KHÔNG cần gắn tt_tai vào `datas` ở đây (FE không đọc `res.datas` nữa).
  return { total, saved, datas, partial, message, authExpired };
}

// ============================================================
//  LƯỢT "CẬP NHẬT TỪ THUẾ ĐIỆN TỬ" CHẠY NỀN — danh sách + chi tiết trong 1 lượt, FE poll tiến độ
// ============================================================

/** Tiến độ theo (MST + chiều): mỗi tab hóa đơn 1 lượt riêng, 2 tab chạy song song được. */
const updateRuns = new Map<string, UpdateRunStatus>();
/** "Thế hệ" hiện tại của mỗi khóa — lượt mới bump lên để lượt cũ tự thoát khi kết thúc. */
const updateRunGen = new Map<string, number>();
const updateRunKey = (tenantKey: string, direction: "purchase" | "sold") =>
  `${tenantKey}:${direction}`;

/** Đọc tiến độ lượt cập nhật (FE poll). null nếu công ty/chiều này chưa từng chạy lượt nào. */
export function getUpdateRunStatus(
  tenantKey: string,
  direction: "purchase" | "sold",
): UpdateRunStatus | null {
  return updateRuns.get(updateRunKey(tenantKey, direction)) ?? null;
}

/**
 * Quản lý VÒNG ĐỜI một lượt cập nhật: tạo tiến độ, chạy `work` ở nền, đóng lượt khi xong.
 *
 * Tách khỏi phần gọi GDT (nhận `work` như tham số) vì đây là chỗ dễ sai nhất — thay lượt, đè
 * trạng thái của lượt mới, treo `active` vĩnh viễn — và tách ra thì test được mà không cần
 * token GDT lẫn DB (xem `src/__tests__/gdtUpdateRun.test.ts`).
 *
 * Bấm lại khi đang chạy -> lượt mới THAY lượt cũ (khác `startSyncRun` vốn trả lại lượt đang chạy):
 * người dùng thường đổi bộ lọc rồi bấm lại, phải chạy theo bộ lọc mới.
 */
export function startUpdateRunWith(
  tenantKey: string,
  direction: "purchase" | "sold",
  work: (st: UpdateRunStatus, isStale: () => boolean) => Promise<void>,
): UpdateRunStatus {
  const key = updateRunKey(tenantKey, direction);
  const gen = (updateRunGen.get(key) ?? 0) + 1;
  updateRunGen.set(key, gen);

  const status: UpdateRunStatus = {
    active: true,
    phase: "list",
    page: 0,
    rows: 0,
    saved: 0,
    total: 0,
    source: "",
    partial: false,
    message: "",
    detail: { total: 0, done: 0, ok: 0, err: 0 },
    startedAt: Date.now(),
  };
  updateRuns.set(key, status);

  /** Lượt này đã bị một lượt MỚI thay thế -> không được đụng vào trạng thái chung nữa. */
  const isStale = () => updateRunGen.get(key) !== gen;

  void (async () => {
    try {
      await work(status, isStale);
    } catch (err) {
      status.error = err instanceof Error ? err.message : "Lỗi khi cập nhật từ Thuế điện tử.";
      console.error(`[DEBUG-CAPNHAT] Lượt ${key} lỗi tổng thể: ${status.error}`);
    } finally {
      // Chỉ đóng lượt nếu vẫn là lượt hiện tại (không đè trạng thái của lượt mới đã thay thế).
      if (!isStale()) {
        status.active = false;
        status.phase = "";
        status.finishedAt = Date.now();
      }
    }
  })();

  return status;
}

/**
 * Ghi 1 dòng `sync_log` cho lượt "Cập nhật từ Thuế điện tử" — dùng CHUNG bảng lịch sử với nút
 * "Đồng bộ từ Thuế", phân biệt nhau bằng `dien_giai` ("Cập nhật hóa đơn đầu ra" vs "Đồng bộ ...").
 *
 * Nuốt lỗi: đây là lượt chạy NỀN và ghi lịch sử chỉ là phụ — để lỗi văng ra sẽ bị
 * `startUpdateRunWith` bắt và gắn `status.error`, báo lượt thất bại dù hóa đơn đã lưu xong.
 */
async function writeUpdateSyncLog(
  dbName: string,
  direction: "purchase" | "sold",
  query: PurchaseInvoiceQuery | SoldInvoiceQuery,
  res: { total: number; saved: number; partial: boolean; message: string },
): Promise<void> {
  try {
    await createSyncLogRow(getTenantDb(dbName), {
      action: "Cập nhật",
      direction,
      loai: kindFromKetQuaHd(query.ketQuaHd),
      tuNgay: query.tuNgay,
      denNgay: query.denNgay,
      ...res,
    });
  } catch (err) {
    console.error(
      `[DEBUG-CAPNHAT] Không ghi được sync_log cho lượt cập nhật ${direction}: ` +
        `${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Bắt đầu lượt "Cập nhật từ Thuế điện tử" CHẠY NỀN cho ĐÚNG 1 chiều + ĐÚNG bộ lọc của tab, rồi
 * trả tiến độ NGAY (FE poll `getUpdateRunStatus`). Lượt tự đi 2 pha: lấy/lưu DANH SÁCH, rồi tải
 * CHI TIẾT cho chính khoảng + bộ lọc đó — nên FE chỉ cần một vòng poll và một toast.
 *
 * Nhờ chạy nền, không còn HTTP request kéo dài (nguyên nhân 502 sau IIS/ARR) nên pha danh sách
 * dùng được ngân sách retry rộng `LIST_RETRY_BUDGET_MS` (10 phút/trang) như luồng Đồng bộ.
 */
export function startUpdateRun(
  dbName: string,
  tenantKey: string,
  direction: "purchase" | "sold",
  gdtToken: string,
  query: PurchaseInvoiceQuery | SoldInvoiceQuery,
  ownMst: string,
): UpdateRunStatus {
  return startUpdateRunWith(tenantKey, direction, async (st, isStale) => {
    // --- PHA 1: DANH SÁCH ---
    // `isCancelled` = lượt này đã bị lượt mới thay thế: phải dừng, nếu không 2 vòng quét cùng chiều
    // + cùng token sẽ chạy song song và dội GDT.
    const res = await fetchAndSaveInvoicesInRange(
      dbName,
      tenantKey,
      gdtToken,
      direction,
      query,
      ownMst,
      { status: st, isCancelled: isStale },
    );
    st.total = res.total;
    st.saved = res.saved;
    st.partial = res.partial;
    st.message = res.message;

    // Ghi lịch sử NGAY sau pha danh sách: `tong`/`da_luu` là số của chính pha này, pha chi tiết
    // không làm chúng đổi. Lượt đã bị lượt mới thay thế -> bỏ qua, tránh đẻ dòng rác mỗi lần
    // người dùng bấm Cập nhật lại giữa chừng.
    if (!isStale()) {
      await writeUpdateSyncLog(dbName, direction, query, res);
    }

    // Token hết hạn -> DỪNG: pha chi tiết dùng cùng token sẽ lỗi y hệt.
    if (res.authExpired) {
      st.detail.authExpired = true;
      return;
    }

    // Bị thay thế trong lúc lấy danh sách -> KHÔNG mở pha chi tiết: lượt mới sẽ tự mở lượt chi tiết
    // của nó, mở thêm ở đây chỉ tổ tranh token rồi bị chính lượt kia thay thế.
    if (isStale()) return;

    // --- PHA 2: CHI TIẾT (cùng chiều, cùng bộ lọc) ---
    st.phase = "detail";
    const { status: detail, done } = runDetailFetch(dbName, tenantKey, gdtToken, direction, query);
    // Gán THAM CHIẾU: engine cập nhật tại chỗ trên chính object này nên tiến độ tự "sống", khỏi
    // cần vòng sao chép. JSON trả về dư vài field (active/startedAt) — FE bỏ qua.
    st.detail = detail;
    await done;
  });
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

/** Tiến độ theo (MST + chiều): mỗi chiều 1 lượt tải chi tiết do người dùng bấm. */
const detailRuns = new Map<string, DetailRunStatus>();
/** "Thế hệ" hiện tại của mỗi khóa — lượt mới bump lên để lượt cũ (đổi khoảng/bộ lọc) tự dừng. */
const detailRunGen = new Map<string, number>();
const detailRunKey = (tenantKey: string, direction: "purchase" | "sold") =>
  `${tenantKey}:${direction}`;

/** Đọc tiến độ lượt tải chi tiết (FE poll). null nếu chưa từng chạy. */
export function getDetailRunStatus(
  tenantKey: string,
  direction: "purchase" | "sold",
): DetailRunStatus | null {
  return detailRuns.get(detailRunKey(tenantKey, direction)) ?? null;
}

const engineSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Ngưỡng coi một 5xx là "GDT từ chối tham số" thay vì "GDT quá tải".
 *
 * GDT dùng 500 cho CẢ HAI, nhưng thời gian phản hồi tách bạch chúng rất rõ: từ chối tham số thì lỗi
 * ngay khi vừa parse request (đo được 63ms khi thử `size=200` ngày 23/07/2026), còn quá tải thật thì
 * server phải làm việc một lúc mới gục. 500ms là mức ở giữa, cách xa cả hai phía.
 */
const FAST_5XX_PERMANENT_MS = 500;

/**
 * Phân loại lỗi GDT theo MÃ STATUS (không match chuỗi trong body — tránh nhận nhầm khi body chứa
 * "timeout"/"network"). `gdtFetch` ném `GdtHttpError` (có `status` + `elapsedMs`) khi GDT trả lỗi;
 * lỗi mạng/timeout/socket-bị-cắt là Error thường, phân loại qua `errorSignature` (có lần `cause`).
 *  - "auth"      : 401/403 -> token GDT hết hạn/không hợp lệ -> DỪNG lượt (đừng đánh lỗi giả).
 *  - "transient" : 429, 5xx CHẬM, hoặc lỗi mạng/timeout/body bị cắt -> đáng retry.
 *  - "permanent" : còn lại (400/404) và 5xx NHANH -> retry bao nhiêu lần cũng ra y hệt.
 *
 * Vì sao tách 5xx theo thời gian: trước đây MỌI 5xx đều là "transient", nên một request sai vĩnh
 * viễn (tham số GDT không chấp nhận) bị retry tới hết ngân sách 10 phút/trang với backoff 15s —
 * người dùng chỉ thấy app treo, không biết vì sao. Nay 500 trả về trong vài chục ms được coi là lỗi
 * thật: lượt dừng ngay, `fetchAndSaveInvoicesInRange` đánh `partial` kèm message của GDT để người
 * dùng đọc được lý do. Đổi lại, nếu GDT có lúc 500 nhanh do trục trặc thoáng qua thì mình dừng sớm
 * thay vì thử lại — chấp nhận được, vì bấm lại là chạy tiếp phần thiếu (upsert idempotent).
 */
/**
 * Dấu hiệu lỗi TRUYỀN TẢI (đáng retry). `terminated` + `UND_ERR` là của undici (fetch trong Node):
 * khi GDT trả header rồi đóng socket giữa lúc gửi body, `response.json()` ném `TypeError: terminated`.
 */
const TRANSIENT_ERROR_RE =
  /timeout|fetch failed|terminated|ECONN|EPIPE|ETIMEDOUT|socket|network|abort|UND_ERR/i;

/**
 * Lỗi kiểu "GDT trả header 200 rồi cắt socket giữa lúc gửi body". KHÁC hẳn timeout/429: retry y hệt
 * thì hỏng y hệt, phải XIN ÍT DÒNG HƠN mới qua (xem `GDT_LIST_PAGE_SIZE`).
 *
 * Dò trên `describeErrorChain` chứ không chỉ `message`: undici đặt lý do thật ở `cause`, còn tầng
 * ngoài chỉ là `"terminated"` — trơ, không mang thông tin nào.
 */
export function isBodyTerminated(err: unknown): boolean {
  return /terminated|UND_ERR_SOCKET|ECONNRESET|other side closed/i.test(describeErrorChain(err));
}

export function classifyGdtError(err: unknown): "auth" | "transient" | "permanent" {
  if (err instanceof GdtHttpError) {
    if (err.status === 401 || err.status === 403) return "auth";
    if (err.status === 429) return "transient";
    if (err.status >= 500 && err.status <= 599) {
      return err.elapsedMs < FAST_5XX_PERMANENT_MS ? "permanent" : "transient";
    }
    return "permanent";
  }

  // Không phải GdtHttpError -> lỗi tầng fetch/đọc body (mạng/timeout/abort/socket bị cắt), hoặc lỗi
  // đã mất kiểu khi đi qua ranh giới nào đó. Giữ nhánh dò chuỗi làm lưới an toàn cho cả hai.
  const signature = describeErrorChain(err);
  const m = signature.match(/GDT API Error:\s*(\d+)/);
  if (m) {
    const status = Number(m[1]);
    if (status === 401 || status === 403) return "auth";
    if (status === 429 || (status >= 500 && status <= 599)) return "transient";
    return "permanent";
  }
  if (TRANSIENT_ERROR_RE.test(signature)) return "transient";
  return "permanent";
}

/**
 * NGÂN SÁCH THỜI GIAN để lấy bằng được 1 TRANG danh sách khi gặp lỗi tạm thời (timeout/429/5xx).
 *
 * KHÔNG giới hạn số lần thử. Phân trang GDT đi theo cursor `state`: bỏ 1 trang giữa chừng là mất
 * luôn MỌI trang phía sau, không nhảy cóc được. Đo thực tế có trang bị GDT "nuốt" 4 lần liên tiếp
 * rồi lần 5 trả về trong 300ms — nên cứ thử tới khi được.
 *
 * Vẫn phải có trần: GDT chặn hẳn MST hoặc rớt mạng thì retry vô hạn sẽ treo lượt vĩnh viễn. Hết
 * ngân sách -> ném lỗi, `runSync` ghi `partial` để người dùng chạy lại phần còn thiếu. Với timeout
 * danh sách 12s + backoff ≤15s thì 10 phút đủ cho ~25 lần thử 1 trang.
 */
const LIST_RETRY_BUDGET_MS = 10 * 60_000;

/**
 * Ngân sách cho luồng CHẶN request (nút "Cập nhật từ Thuế điện tử" — `fetchAndSaveInvoicesInRange`
 * vẫn giữ HTTP request mở tới khi xong). Ở đó KHÔNG được kiên nhẫn 10 phút/trang: proxy sẽ cắt
 * request thành 502 trước. 60s/trang là mức chịu được, và người dùng bấm lại thì lấy tiếp phần
 * thiếu. Đồng bộ (chạy nền, có tiến độ + nút Dừng) mới dùng ngân sách rộng.
 */
export const LIST_RETRY_BUDGET_BLOCKING_MS = 60_000;

/**
 * Nghỉ `ms` nhưng cắt sớm khi người dùng bấm Dừng — chia nhỏ thành từng nhịp 1s để không phải chờ
 * hết 15s backoff mới phản hồi nút Dừng. Trả về true nếu bị cắt giữa chừng.
 */
async function sleepUnlessCancelled(ms: number, isCancelled?: () => boolean): Promise<boolean> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (isCancelled?.()) return true;
    await engineSleep(Math.min(1000, until - Date.now()));
  }
  return isCancelled?.() === true;
}

/**
 * Lấy 1 TRANG danh sách hóa đơn qua PACER dùng chung của MST — điều tiết nhịp CÙNG token với luồng
 * tải chi tiết (concurrency=1, tránh 2 luồng GDT tranh nhau trên 1 token gây timeout) — kèm RETRY
 * lỗi tạm thời (timeout/429/5xx) tới khi được hoặc hết `LIST_RETRY_BUDGET_MS`. Lỗi auth (401/403),
 * lỗi thật, hết ngân sách, hoặc người dùng bấm Dừng -> ném lại cho caller đánh dấu `partial`.
 */
/**
 * Sàn khi tự hạ size. Dưới mức này thì vấn đề không còn là "trang quá to" nữa (5 bản ghi ≈ 20KB) —
 * cứ hạ tiếp chỉ làm số trang phình ra vô ích, để lượt báo lỗi thật còn hơn.
 */
const MIN_LIST_PAGE_SIZE = 5;

/**
 * Size đang dùng cho từng MST, sau khi đã tự hạ vì bị GDT cắt body.
 *
 * Nhớ theo MST vì ngưỡng phụ thuộc độ "nặng" của hóa đơn bên đó: đã phải hạ ở trang 1 thì các trang
 * sau gần như chắc chắn cũng vậy, không nên bắt mỗi trang tự dò lại (mỗi lần dò tốn 1 call hỏng).
 * KHÔNG có đường tăng lại: in-memory theo tiến trình, restart BE là về mặc định — đủ để thử lại
 * mức cao hơn sau khi phía GDT thay đổi, mà không cần thêm cơ chế phục hồi phức tạp.
 */
const listPageSize = new Map<string, number>();

function listPageSizeFor(tenantKey: string): number {
  return listPageSize.get(tenantKey) ?? GDT_LIST_PAGE_SIZE;
}

/** Hạ size một nấc (chia đôi, sàn `MIN_LIST_PAGE_SIZE`). Trả false khi đã chạm sàn -> hết đường lùi. */
function shrinkListPageSize(tenantKey: string): boolean {
  const current = listPageSizeFor(tenantKey);
  if (current <= MIN_LIST_PAGE_SIZE) return false;

  listPageSize.set(tenantKey, Math.max(MIN_LIST_PAGE_SIZE, Math.floor(current / 2)));
  return true;
}

async function fetchListPagePaced(
  tenantKey: string,
  gdtToken: string,
  direction: "purchase" | "sold",
  query: PurchaseInvoiceQuery,
  isCancelled?: () => boolean,
  budgetMs: number = LIST_RETRY_BUDGET_MS,
): Promise<PurchaseInvoiceResponse | SoldInvoiceResponse> {
  const deadline = Date.now() + budgetMs;
  let attempt = 0;
  for (;;) {
    attempt += 1;
    const pageSize = listPageSizeFor(tenantKey);
    try {
      const page = await pacerSchedule(tenantKey, "list", () =>
        direction === "purchase"
          ? getPurchaseInvoices(gdtToken, query, pageSize)
          : getSoldInvoices(gdtToken, query, pageSize),
      );
      pacerReportOk(tenantKey, "list");
      return page;
    } catch (err) {
      // GDT cắt body giữa chừng -> trang đang xin QUÁ LỚN. Hạ size rồi thử lại NGAY: không backoff,
      // không `reportRateLimited` — đây là lỗi tham số, không phải GDT quá tải, phạt nhịp là oan.
      if (isBodyTerminated(err) && shrinkListPageSize(tenantKey)) {
        console.warn(
          `[DEBUG-LIST] TRANG ${direction} bị GDT cắt body ở size=${pageSize} ` +
            `-> hạ xuống size=${listPageSizeFor(tenantKey)} và thử lại ngay.`,
        );
        if (!isCancelled?.() && Date.now() < deadline) continue;
      }

      // [DEBUG-GDT] Phân loại lỗi: "auth" (token hết hạn) / "transient" (GDT nuốt hoặc 429/5xx) /
      // "permanent". Chỉ "transient" mới đáng thử lại.
      const kind = classifyGdtError(err);
      const msg = err instanceof Error ? err.message : String(err);
      const leftMs = deadline - Date.now();
      // Backoff 1s→2s→4s…, trần 15s. Trần 5s cũ quá ngắn so với cửa sổ chặn của GDT: thử lại quá
      // sớm thì lại bị nuốt tiếp.
      const backoff = Math.min(15_000, 1000 * 2 ** (attempt - 1));

      if (kind === "transient" && leftMs > backoff && !isCancelled?.()) {
        pacerReportRateLimited(tenantKey, "list");
        console.warn(
          `[DEBUG-LIST] TRANG ${direction} lỗi TẠM THỜI lần ${attempt} ` +
            `(còn ${Math.round(leftMs / 1000)}s ngân sách), nghỉ ${backoff}ms rồi thử lại. Lỗi: ${msg}`,
        );
        // Bấm Dừng trong lúc đang nghỉ -> thoát ngay, không nằm chờ hết backoff.
        if (await sleepUnlessCancelled(backoff, isCancelled)) {
          console.warn(`[DEBUG-LIST] TRANG ${direction} bỏ retry vì người dùng bấm Dừng.`);
          throw err;
        }
        continue;
      }

      const why = isCancelled?.()
        ? "người dùng bấm DỪNG"
        : kind === "auth"
          ? "TOKEN GDT HẾT HẠN"
          : kind === "transient"
            ? `HẾT NGÂN SÁCH ${Math.round(budgetMs / 1000)}s cho 1 trang`
            : "lỗi thật (permanent)";
      console.error(
        `[DEBUG-LIST] TRANG ${direction} DỪNG sau ${attempt} lần thử — ${why}. Lỗi: ${msg}`,
      );
      throw err; // caller đánh dấu partial đúng lý do
    }
  }
}

/**
 * Tải chi tiết cho các hóa đơn CHƯA tải/LỖI (tt_tai null hoặc "error") trong khoảng `query`, qua
 * PACER dùng chung của MST (nhịp thích ứng). Mỗi hóa đơn retry ≤
 * MAX_DETAIL_RETRY lần với lỗi tạm thời (429/500/timeout); hết retry hoặc lỗi thật -> đánh dấu
 * `tt_tai="error"` và ĐI TIẾP (không kẹt cả lượt). Chạy NỀN (không chặn caller) — trả `status` để
 * FE poll. Lượt mới cùng khóa THAY THẾ lượt cũ (đổi khoảng/bộ lọc -> tải đúng phần mới).
 * Nhận `dbName` (không phải client): mỗi hóa đơn gọi lại `getTenantDb` để refresh `lastUsed`, tránh
 * bị sweeper đóng pool giữa lượt dài. Token GDT hết hạn (401) -> DỪNG lượt, không đánh lỗi giả.
 * CHỈ chạy khi người dùng bấm "Cập nhật/Tải chi tiết" — không có lượt tự động nào gọi hàm này.
 */
export function runDetailFetch(
  dbName: string,
  tenantKey: string,
  token: string,
  direction: "purchase" | "sold",
  query: PurchaseInvoiceQuery | SoldInvoiceQuery,
): { status: DetailRunStatus; done: Promise<void> } {
  const key = detailRunKey(tenantKey, direction);
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

  // [ĐO TỐC ĐỘ] Số lần retry lỗi tạm thời + mốc của checkpoint gần nhất — để log ms THỰC TẾ trên mỗi
  // hóa đơn, tách bạch với nhịp lý thuyết của pacer. Đây là số liệu để quyết định có nên nâng
  // concurrency làn detail hay không (xem `Lane` trong gdtPacer).
  let retries = 0;
  let lastMarkAt = Date.now();
  let lastMarkDone = 0;

  // Chạy nền: caller trả về ngay, FE poll `status`. Lỗi tổng thể (vd đọc DB) -> đóng lượt.
  // Giữ promise của lượt để caller nào cần ĐỢI thì await `done` (lượt "Cập nhật" hợp nhất 2 pha
  // dùng cái này để biết pha chi tiết đã xong) — vẫn không chặn nơi gọi thông thường.
  const done = (async () => {
    try {
      // orderBy tdlap desc: tải chi tiết hóa đơn MỚI trước, giảm dần về cũ.
      const candidates = await freshModel().findMany({
        where,
        select: DETAIL_SELECT,
        orderBy: { tdlap: "desc" },
      });
      status.total = candidates.length;
      console.log(
        `[gdt.detailRun] ${direction} BẮT ĐẦU: ${status.total} hóa đơn cần tải chi tiết ` +
          `(nhịp làn detail hiện tại ${Math.round(pacerIntervalMs(tenantKey, "detail"))}ms/HĐ).`,
      );

      for (const row of candidates) {
        if (detailRunGen.get(key) !== gen) break; // bị lượt mới thay thế -> dừng
        let attempt = 0;
        for (;;) {
          attempt += 1;
          try {
            const detail = await pacerSchedule(tenantKey, "detail", () =>
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
            pacerReportOk(tenantKey, "detail");
            status.ok += 1;
            break;
          } catch (err) {
            const kind = classifyGdtError(err);
            if (kind === "auth") {
              // Token GDT hết hạn -> KHÔNG đánh lỗi HĐ này (không phải lỗi của nó); dừng cả lượt,
              // các HĐ còn lại giữ nguyên (tt_tai null/error) để đăng nhập lại rồi chạy tiếp.
              console.warn(
                `[gdt.detailRun] token GDT hết hạn (${direction}) -> dừng lượt ở ${status.done}/${status.total}.`,
              );
              status.authExpired = true;
              return;
            }
            if (kind === "transient" && attempt < MAX_DETAIL_RETRY) {
              pacerReportRateLimited(tenantKey, "detail");
              retries += 1;
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
        // Log tiến độ mỗi 20 hóa đơn để theo dõi lượt chạy ở terminal BE — kèm tốc độ THỰC TẾ của
        // đoạn vừa rồi và nhịp pacer hiện hành, để thấy ngay lượt đang bị giãn nhịp hay đang chạy sàn.
        if (status.done % 20 === 0) {
          const now = Date.now();
          const perInvoice = Math.round((now - lastMarkAt) / (status.done - lastMarkDone));
          lastMarkAt = now;
          lastMarkDone = status.done;
          console.log(
            `[gdt.detailRun] ${direction} tiến độ ${status.done}/${status.total} ` +
              `(ok ${status.ok}, lỗi ${status.err}) — ${perInvoice}ms/HĐ, ` +
              `nhịp pacer ${Math.round(pacerIntervalMs(tenantKey, "detail"))}ms, retry ${retries}.`,
          );
        }
      }
    } catch (err) {
      console.warn(
        `[gdt.detailRun] lượt (${direction}) dừng do lỗi: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    } finally {
      // Chỉ đóng lượt nếu vẫn là lượt hiện tại (không đè trạng thái của lượt mới đã thay thế).
      if (detailRunGen.get(key) === gen) {
        status.active = false;
        status.finishedAt = Date.now();
        const elapsed = status.finishedAt - status.startedAt;
        // Trung bình ms/HĐ của CẢ lượt: con số một dòng để so sánh giữa các lượt và giữa các MST.
        const avg = status.done > 0 ? Math.round(elapsed / status.done) : 0;
        console.log(
          `[gdt.detailRun] ${direction} XONG: ok ${status.ok}/${status.total}, lỗi ${status.err}${
            status.authExpired ? " (dừng vì token GDT hết hạn)" : ""
          } — ${Math.round(elapsed / 1000)}s cho ${status.done} HĐ (${avg}ms/HĐ), ` +
            `retry ${retries}, nhịp pacer cuối ${Math.round(pacerIntervalMs(tenantKey, "detail"))}ms.`,
        );
      }
    }
  })();

  return { status, done };
}
