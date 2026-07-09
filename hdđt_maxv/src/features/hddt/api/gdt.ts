import { apiFetch } from "../../../lib/http";
import type {
  CaptchaInfo,
  InvoiceAuthTokens,
  InvoiceDirection,
  InvoiceQuery,
  InvoiceRaw,
  InvoiceResult,
  LoginPayload,
  LoginResult,
} from "../types";

/**
 * GET /api/v1/gdt/captcha → { key, content (SVG) }.
 * Dùng: `DialogLoginHddt` (queryFn của captchaQuery — lấy ảnh captcha mỗi lần mở dialog).
 */
export async function getCaptcha(): Promise<CaptchaInfo> {
  return apiFetch<CaptchaInfo>("/gdt/captcha");
}

/**
 * POST /api/v1/gdt/login → { token } (ném error kèm message nếu thất bại).
 * Dùng: `DialogLoginHddt` (mutationFn của loginMutation — đăng nhập Thuế điện tử).
 */
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

/**
 * Nhãn tiếng Việt cho mã trạng thái hóa đơn; trả nguyên mã nếu không nằm trong bảng đã biết.
 * Dùng: `InvoiceListTabs` (cột "Trạng thái hóa đơn" trong COLUMNS) và `exportInvoices`.
 */
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

/**
 * Dựng query-string cho endpoint hóa đơn: map các field lọc + đổi tên MST đối tác theo chiều.
 * Dùng: nội bộ file này — `getInvoices` và `getSavedInvoices`.
 */
function buildInvoiceParams(direction: InvoiceDirection, query: InvoiceQuery): URLSearchParams {
  const { mstDoiTac, ...rest } = query;
  const params = new URLSearchParams();
  Object.entries(rest).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  if (mstDoiTac) params.set(PARTNER_PARAM[direction], mstDoiTac);
  return params;
}

/**
 * Chuẩn hóa danh sách hóa đơn thô -> gộp field đối tác (mstDoiTac/tenDoiTac) theo chiều hóa đơn.
 * Dùng: nội bộ file này — `getInvoices` và `getSavedInvoices`.
 */
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
 * Dùng: `useFetchGdtInvoicesMutation` (invoiceQueries) — nút "Cập nhật từ Thuế điện tử".
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
 * Dùng: `useSavedInvoicesQuery` (invoiceQueries) — nạp bảng khi mở/lọc tab Hóa đơn.
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

/**
 * Lấy toàn bộ hóa đơn đã lưu (cả 2 chiều) để sao lưu — khoảng ngày rộng để phủ hết. Mỗi chiều
 * tối đa theo giới hạn endpoint đọc DB; nơi gọi nên đối chiếu số lượng để cảnh báo nếu thiếu.
 * Dùng: `SystemDataTab` — nút "Xuất / Sao lưu dữ liệu".
 */
export function getAllSavedInvoices(
  appToken: string,
): Promise<[InvoiceResult, InvoiceResult]> {
  const range: InvoiceQuery = { tuNgay: "2000-01-01", denNgay: "2100-12-31" };
  return Promise.all([
    getSavedInvoices("purchase", appToken, range),
    getSavedInvoices("sold", appToken, range),
  ]);
}
