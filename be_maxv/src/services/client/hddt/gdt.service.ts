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
import { Prisma, type PrismaClient } from "../../../generated/tenant";

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
function toVctData(row: Record<string, unknown>) {
  return {
    khmshdon: toStr(row.khmshdon) ?? "",
    khhdon: toStr(row.khhdon) ?? "",
    shdon: toStr(row.shdon) ?? "",
    mhdon: toStr(row.mhdon),
    tdlap: toDate(row.tdlap) ?? new Date(),
    nky: toDate(row.nky),
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

/**
 * Lưu (upsert) danh sách hóa đơn thô GDT vào DB tenant — `vct60view` cho chiều
 * mua vào, `vct50view` cho chiều bán ra. Khóa theo id GDT (`row.id`); hóa đơn tra
 * lại (vd đổi trạng thái) sẽ được cập nhật thay vì tạo trùng. Bỏ qua dòng thiếu id.
 */
export async function saveInvoices(
  tenantDb: PrismaClient,
  direction: "purchase" | "sold",
  rows: unknown[],
): Promise<number> {
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

/** Trần số dòng đọc từ DB 1 lần — đủ cho 1 khoảng ngày; vượt trần sẽ log cảnh báo. */
const MAX_SAVED_ROWS = 1000;

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
 * ngày lập giảm dần, giới hạn `MAX_SAVED_ROWS`. `total` là số dòng thực đọc được.
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
          take: MAX_SAVED_ROWS,
        })
      : await tenantDb.vct50view.findMany({
          where,
          orderBy: { tdlap: "desc" },
          take: MAX_SAVED_ROWS,
        });

  if (rows.length === MAX_SAVED_ROWS) {
    console.warn(
      `[gdt.getSavedInvoices] (${direction}) chạm trần ${MAX_SAVED_ROWS} dòng — có thể còn hóa đơn chưa hiển thị, cần thu hẹp khoảng ngày.`,
    );
  }

  const datas = (rows as Record<string, unknown>[]).map(mapSavedRow);
  return { total: datas.length, datas };
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
  // Lọc "đã tải chi tiết" ngay trong WHERE để `take` chỉ đếm dòng có detail — tránh trường hợp
  // hóa đơn đã tải nhưng cũ hơn bị đẩy ra ngoài trần 1000 dòng khiến tab Chi tiết tưởng là rỗng.
  const where = { ...buildSavedWhere(direction, query), detail: { not: Prisma.DbNull } };
  const select = { detail: true } as const;

  const rows =
    direction === "purchase"
      ? await tenantDb.vct60view.findMany({
          where,
          orderBy: { tdlap: "desc" },
          take: MAX_SAVED_ROWS,
          select,
        })
      : await tenantDb.vct50view.findMany({
          where,
          orderBy: { tdlap: "desc" },
          take: MAX_SAVED_ROWS,
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
/** Nghỉ nhẹ giữa các trang để tránh bị GDT chặn (rate-limit). */
const SYNC_PAGE_DELAY_MS = 150;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

/**
 * Đồng bộ hóa đơn 1 khoảng ngày từ GDT vào DB tenant. GDT chỉ cho tìm ≤ 1 tháng/lần nên chia
 * khoảng thành các cửa sổ theo tháng; với mỗi nguồn (chiều × loại) × mỗi cửa sổ, lặp hết các
 * trang theo cursor `state`, upsert từng trang, cộng dồn tổng/đã lưu. Lỗi giữa chừng (vd token
 * GDT hết hạn) -> dừng toàn bộ, đánh dấu `partial`. Cuối cùng ghi 1 dòng `sync_log`.
 */
export async function runSync(
  tenantDb: PrismaClient,
  gdtToken: string,
  params: SyncParams,
) {
  const sources = resolveSyncSources(params.direction, params.loai);
  const chunks = monthlyChunks(params.tuNgay, params.denNgay);
  let total = 0;
  let saved = 0;
  let partial = false;
  let message = "";
  let aborted = false;

  for (const source of sources) {
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
          const page: PurchaseInvoiceResponse | SoldInvoiceResponse =
            source.direction === "purchase"
              ? await getPurchaseInvoices(gdtToken, query)
              : await getSoldInvoices(gdtToken, query);

          // GDT trả `total` cho cả cửa sổ (giống nhau mỗi trang) -> cộng 1 lần/cửa sổ (trang đầu).
          if (pages === 0) total += page.total ?? 0;
          const rows = page.datas ?? [];
          saved += await saveInvoices(tenantDb, source.direction, rows);

          state = page.state || undefined;
          pages += 1;
          // Dừng ngay khi trang rỗng: một số API vẫn trả cursor khác rỗng ở trang cuối,
          // nếu chỉ dựa vào `state` sẽ lặp tới trần MAX_SYNC_PAGES rồi báo "partial" nhầm.
          if (rows.length === 0) break;
          if (state) await delay(SYNC_PAGE_DELAY_MS);
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

  return tenantDb.sync_log.create({
    data: {
      id: randomUUID(),
      // Nhãn hiển thị (không dùng để lọc) -> lưu ở 12:00 trưa để chênh lệch múi giờ
      // server/người xem không làm nhảy sang ngày khác.
      tu_ngay: new Date(`${params.tuNgay}T12:00:00`),
      den_ngay: new Date(`${params.denNgay}T12:00:00`),
      direction: params.direction,
      loai: params.loai,
      tong: total,
      da_luu: saved,
      trang_thai: partial ? "partial" : "done",
      dien_giai: message || (partial ? "Chưa hoàn thành" : "Đồng bộ thành công"),
    },
  });
}

/**
 * Lấy & lưu TẤT CẢ hóa đơn 1 chiều trong khoảng của `query` — GIỮ NGUYÊN bộ lọc người dùng chọn,
 * LẶP HẾT trang theo cursor `state`, chia theo tháng để thỏa giới hạn GDT (≤1 tháng/lần).
 * Trả về `{ total, saved, datas }` (datas = toàn bộ dòng thô để FE hiển thị + tải chi tiết).
 *
 * Dùng cho nút "Cập nhật từ Thuế điện tử" — thay hàm cũ chỉ lấy 1 trang (≤50 dòng). Khác `runSync`:
 * runSync quét nhiều nguồn (chiều × máy tính tiền) + ghi sync_log, KHÔNG áp bộ lọc UI và KHÔNG trả datas.
 */
export async function fetchAndSaveInvoicesInRange(
  tenantDb: PrismaClient,
  token: string,
  direction: "purchase" | "sold",
  query: PurchaseInvoiceQuery | SoldInvoiceQuery,
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
        const page: PurchaseInvoiceResponse | SoldInvoiceResponse =
          direction === "purchase"
            ? await getPurchaseInvoices(token, pageQuery)
            : await getSoldInvoices(token, pageQuery);

        if (pages === 0) total += page.total ?? 0; // total giống nhau mỗi trang -> cộng 1 lần/cửa sổ
        const rows = page.datas ?? [];
        saved += await saveInvoices(tenantDb, direction, rows);
        datas.push(...rows);

        state = page.state || undefined;
        pages += 1;
        if (rows.length === 0) break; // trang cuối có thể vẫn trả cursor -> dừng khi hết dòng
        if (state) await delay(SYNC_PAGE_DELAY_MS);
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
  findMany(args: { where: object; select: object }): Promise<DetailCandidate[]>;
  update(args: {
    where: { id: string };
    data: { detail?: Prisma.InputJsonValue; tt_tai: string };
  }): Promise<unknown>;
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
): Promise<Record<string, unknown> | null> {
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
    return detail;
  } catch {
    await markRow({ tt_tai: "error" }).catch(() => {});
    return null;
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

  const detail = await fetchAndStoreDetail(model, token, row);
  return { found: true, ok: detail !== null, detail };
}
