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
} from "../../../types/gdt";
import type { PrismaClient, Prisma } from "../../../generated/tenant";

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

  const where = {
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
