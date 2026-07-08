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

/** Query param bên BE giữ tên MST đối tác khác nhau theo chiều hóa đơn. */
const PARTNER_PARAM: Record<InvoiceDirection, string> = {
  purchase: "mstNguoiBan",
  sold: "mstNguoiMua",
};

/** Field GDT trả về cho MST/tên đối tác, khác tên theo chiều hóa đơn. */
const PARTNER_FIELD: Record<InvoiceDirection, { mst: string; ten: string }> = {
  purchase: { mst: "nbmst", ten: "nbten" },
  sold: { mst: "nmmst", ten: "nmten" },
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
}

/** GET /api/v1/gdt/invoices/purchase|sold → danh sách hóa đơn (chưa lưu DB, chỉ tra cứu trực tiếp GDT). */
export async function getInvoices(
  direction: InvoiceDirection,
  token: string,
  query: InvoiceQuery,
): Promise<InvoiceResult> {
  const { mstDoiTac, ...rest } = query;
  const params = new URLSearchParams();
  Object.entries(rest).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  if (mstDoiTac) params.set(PARTNER_PARAM[direction], mstDoiTac);

  const raw = await apiFetch<{
    total?: number;
    state?: string;
    datas?: Array<Record<string, unknown>>;
  }>(`/gdt/invoices/${direction}?${params.toString()}`, { token });

  const { mst: mstField, ten: tenField } = PARTNER_FIELD[direction];

  return {
    total: raw.total,
    state: raw.state,
    datas: (raw.datas ?? []).map(
      (d) =>
        ({
          ...d,
          mstDoiTac: d[mstField],
          tenDoiTac: d[tenField],
        }) as InvoiceRaw,
    ),
  };
}
