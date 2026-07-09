import { apiFetch } from "../../../lib/http";

export interface CaptchaInfo {
  key: string;
  /** Chuỗi SVG của ảnh captcha */
  content: string;
}

export interface LoginPayload {
  /** Mã số thuế — đóng vai trò username trên GDT */
  mst: string;
  password: string;
  /** Mã captcha người dùng gõ nhìn từ ảnh */
  captcha: string;
  /** `key` trả về từ getCaptcha */
  key: string;
}

export interface LoginResult {
  token?: string;
  message?: string;
}

/** GET /api/v1/gdt/captcha → { key, content (SVG) } */
export async function getCaptcha(): Promise<CaptchaInfo> {
  return apiFetch<CaptchaInfo>("/gdt/captcha");
}

/** POST /api/v1/gdt/login → { token } (ném error kèm message nếu thất bại) */
export async function loginGdt(body: LoginPayload): Promise<LoginResult> {
  const data = await apiFetch<LoginResult>("/gdt/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!data.token) {
    throw new Error(data.message || "Đăng nhập thất bại");
  }
  return data;
}

/** "purchase" = hóa đơn đầu vào (mua vào), "sold" = hóa đơn đầu ra (bán ra). Khớp path BE `/gdt/invoices/<direction>`. */
export type InvoiceDirection = "purchase" | "sold";

/**
 * Bảng mã trạng thái hóa đơn (`tthai`) của GDT — dùng chung cho dropdown lọc
 * (InvoiceFilterPanel) và hiển thị nhãn ở bảng kết quả (InvoiceListTabs).
 */
export const TRANG_THAI_HD_OPTIONS = [
  { value: "", label: "Tất cả" },
  { value: "1", label: "Hóa đơn mới" },
  { value: "2", label: "Hóa đơn thay thế" },
  { value: "3", label: "Hóa đơn điều chỉnh" },
  { value: "4", label: "Hóa đơn bị thay thế" },
  { value: "5", label: "Hóa đơn đã bị điều chỉnh" },
  { value: "6", label: "Hóa đơn đã bị hủy" },
] as const;

const TRANG_THAI_HD_LABEL: Record<string, string> = Object.fromEntries(
  TRANG_THAI_HD_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label]),
);

/** Nhãn tiếng Việt cho mã trạng thái hóa đơn; trả nguyên mã nếu không nằm trong bảng đã biết. */
export function trangThaiHdLabel(code: string): string {
  return TRANG_THAI_HD_LABEL[code] ?? code;
}

/** Query param bên BE giữ tên MST đối tác khác nhau theo chiều hóa đơn. */
const PARTNER_PARAM: Record<InvoiceDirection, string> = {
  purchase: "mstNguoiBan",
  sold: "mstNguoiMua",
};

/** Field GDT trả về cho MST/tên/địa chỉ đối tác, khác tên theo chiều hóa đơn. */
const PARTNER_FIELD: Record<InvoiceDirection, { mst: string; ten: string; dchi: string }> = {
  purchase: { mst: "nbmst", ten: "nbten", dchi: "nbdchi" },
  sold: { mst: "nmmst", ten: "nmten", dchi: "nmdchi" },
};

export interface InvoiceQuery {
  /** yyyy-MM-dd — bắt buộc */
  tuNgay: string;
  /** yyyy-MM-dd — bắt buộc */
  denNgay: string;
  trangThaiHd?: string;
  ketQuaHd?: string;
  /** MST đối tác — người bán (purchase) hoặc người mua (sold) tùy `direction` */
  mstDoiTac?: string;
  mauHd?: string;
  soSeri?: string;
  soHd?: string;
  /** Cursor phân trang từ lần gọi trước */
  state?: string;
}

/**
 * 1 hóa đơn đã chuẩn hóa — field đối tác (`mstDoiTac`/`tenDoiTac`) gộp chung
 * tên bất kể là hóa đơn mua vào (nbmst/nbten) hay bán ra (nmmst/nmten) từ GDT.
 * Các field còn lại giữ nguyên tên GDT trả về.
 */
export interface InvoiceRaw {
  id: string;
  mstDoiTac: string;
  tenDoiTac: string;
  /** Địa chỉ đối tác — không phải hóa đơn nào GDT cũng trả về field này. */
  diaChiDoiTac?: string;
  khmshdon: string;
  khhdon: string;
  shdon: string;
  tdlap: string;
  /** Ngày ký */
  nky?: string;
  tthai: string;
  ttxly: string;
  /** Mã ngoại tệ */
  dvtte?: string;
  /** Tỷ giá */
  tgia?: number;
  /** Tổng tiền chưa thuế */
  tgtcthue?: number;
  /** Tổng tiền thuế */
  tgtthue?: number;
  /** Tổng chiết khấu thương mại */
  ttcktmai?: number;
  /** Tổng phí */
  tgtphi?: number;
  tgtttbso: number;
  [key: string]: unknown;
}

export interface InvoiceResult {
  total?: number;
  state?: string;
  datas?: InvoiceRaw[];
  /** Số hóa đơn vừa được lưu vào vct50view/vct60view — chỉ có ở luồng tra cứu GDT (getInvoices). */
  saved?: number;
}

export interface InvoiceAuthTokens {
  /** JWT đăng nhập app — để BE biết ghi vào DB công ty nào khi lưu. */
  appToken: string;
  /** Token đăng nhập Thuế điện tử (GDT) — để BE gọi GDT thay mình. */
  gdtToken: string;
}

/** Dựng query-string cho endpoint hóa đơn: map các field lọc + đổi tên MST đối tác theo chiều. */
function buildInvoiceParams(direction: InvoiceDirection, query: InvoiceQuery): URLSearchParams {
  const { mstDoiTac, ...rest } = query;
  const params = new URLSearchParams();
  Object.entries(rest).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  if (mstDoiTac) params.set(PARTNER_PARAM[direction], mstDoiTac);
  return params;
}

/** Chuẩn hóa danh sách hóa đơn thô -> gộp field đối tác (mstDoiTac/tenDoiTac) theo chiều hóa đơn. */
function mapInvoiceDatas(
  direction: InvoiceDirection,
  datas: Array<Record<string, unknown>> | undefined,
): InvoiceRaw[] {
  const { mst: mstField, ten: tenField, dchi: dchiField } = PARTNER_FIELD[direction];
  return (datas ?? []).map(
    (d) =>
      ({
        ...d,
        mstDoiTac: d[mstField],
        tenDoiTac: d[tenField],
        diaChiDoiTac: d[dchiField],
      }) as InvoiceRaw,
  );
}

/**
 * GET /api/v1/gdt/invoices/purchase|sold → tra cứu trực tiếp GDT rồi BE luôn lưu vào DB.
 * Nhận `tokens` dạng object (thay vì 2 tham số string liền kề) để tránh truyền nhầm thứ tự.
 */
export async function getInvoices(
  direction: InvoiceDirection,
  tokens: InvoiceAuthTokens,
  query: InvoiceQuery,
): Promise<InvoiceResult> {
  const params = buildInvoiceParams(direction, query);

  const raw = await apiFetch<{
    total?: number;
    state?: string;
    datas?: Array<Record<string, unknown>>;
    saved?: number;
  }>(`/gdt/invoices/${direction}?${params.toString()}`, {
    token: tokens.appToken,
    headers: { "X-Gdt-Token": tokens.gdtToken },
  });

  return {
    total: raw.total,
    state: raw.state,
    saved: raw.saved,
    datas: mapInvoiceDatas(direction, raw.datas),
  };
}

/**
 * GET /api/v1/gdt/invoices/purchase|sold/saved → hóa đơn ĐÃ LƯU trong DB (không gọi GDT).
 * Chỉ cần `appToken` (JWT app) — không cần đăng nhập Thuế điện tử — nên xem lại dữ liệu cũ
 * bất cứ lúc nào. Trả về cùng shape với `getInvoices` để tái dùng mapping hiển thị.
 */
export async function getSavedInvoices(
  direction: InvoiceDirection,
  appToken: string,
  query: InvoiceQuery,
): Promise<InvoiceResult> {
  const params = buildInvoiceParams(direction, query);

  const raw = await apiFetch<{
    total?: number;
    datas?: Array<Record<string, unknown>>;
  }>(`/gdt/invoices/${direction}/saved?${params.toString()}`, {
    token: appToken,
  });

  return {
    total: raw.total,
    datas: mapInvoiceDatas(direction, raw.datas),
  };
}
