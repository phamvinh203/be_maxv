import { apiFetch } from "../../../lib/http";
import type {
  CaptchaInfo,
  GdtSavedPassword,
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
 * GET /api/v1/gdt/credential → { password } — mật khẩu cổng thuế đã lưu (đã giải mã) của công ty
 * đang chọn; `null` nếu chưa lưu. Dùng: `DialogLoginHddt` (điền sẵn vào ô mật khẩu khi mở dialog).
 */
export async function getGdtSavedPassword(): Promise<GdtSavedPassword> {
  return apiFetch<GdtSavedPassword>("/gdt/credential");
}

/**
 * Bảng mã trạng thái hóa đơn (`tthai`) của GDT — dùng chung cho dropdown lọc
 * (InvoiceFilterPanel), nhãn ở bảng kết quả (InvoiceListTabs) và cột Excel xuất ra.
 * Nhãn bám theo đúng chữ cổng thuế dùng — xem bảng 14.5 trong `docs/14-hop-dong-api.md`.
 */
export const TRANG_THAI_HD_OPTIONS = [
  { value: "", label: "Tất cả" },
  { value: "1", label: "Hóa đơn mới" },
  { value: "2", label: "Hóa đơn thay thế" },
  { value: "3", label: "Hóa đơn điều chỉnh" },
  { value: "4", label: "Hóa đơn đã bị thay thế" },
  { value: "5", label: "Hóa đơn bị điều chỉnh" },
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

/**
 * Bảng mã kết quả kiểm tra hóa đơn (`ttxly`) của GDT — dùng chung cho dropdown lọc
 * (InvoiceFilterPanel), nhãn ở bảng kết quả (InvoiceListTabs) và cột Excel xuất ra.
 * Nhãn bám theo đúng chữ cổng thuế dùng — xem bảng 14.5 trong `docs/14-hop-dong-api.md`.
 *
 * Mã `8` còn quyết định ĐƯỜNG GỌI: backend đổi sang nhánh `/sco-query/...` cho hóa đơn có mã khởi
 * tạo từ máy tính tiền, thay vì `/query/...` như hóa đơn thường.
 */
export const KET_QUA_KIEM_TRA_OPTIONS = [
  { value: "", label: "Tất cả" },
  { value: "5", label: "Đã cấp mã hóa đơn" },
  { value: "6", label: "Cục Thuế đã nhận không mã" },
  { value: "8", label: "Cục Thuế đã nhận hóa đơn có mã khởi tạo từ máy tính tiền" },
] as const;

const KET_QUA_KIEM_TRA_LABEL: Record<string, string> = Object.fromEntries(
  KET_QUA_KIEM_TRA_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label]),
);

/**
 * Nhãn tiếng Việt cho mã kết quả kiểm tra; trả nguyên mã nếu không nằm trong bảng đã biết.
 * Dùng: `InvoiceListTabs` (cột "Kết quả kiểm tra" trong COLUMNS) và `exportInvoices`.
 */
export function ketQuaKiemTraLabel(code: string): string {
  return KET_QUA_KIEM_TRA_LABEL[code] ?? code;
}

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

/**
 * Dựng query-string cho endpoint hóa đơn: map các field lọc + đổi tên MST đối tác theo chiều.
 * Dùng: nội bộ file này — `getInvoices` và `getSavedInvoices`.
 */
export function buildInvoiceParams(direction: InvoiceDirection, query: InvoiceQuery): URLSearchParams {
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
  const { mst: mstField, ten: tenField } = PARTNER_FIELD[direction];
  return (datas ?? []).map(
    (d) =>
      ({
        ...d,
        mstDoiTac: d[mstField],
        tenDoiTac: d[tenField],
      }) as InvoiceRaw,
  );
}

/**
 * GET /api/v1/gdt/invoices/purchase|sold/saved → hóa đơn ĐÃ LƯU trong DB (không gọi GDT).
 * Auth app qua cookie httpOnly — không cần token GDT — nên xem lại dữ liệu cũ bất cứ lúc nào.
 * Dùng: `useSavedInvoicesQuery` (invoiceQueries) — nạp bảng khi mở/lọc tab Hóa đơn.
 *
 * Việc LẤY MỚI từ GDT nay đi qua lượt chạy nền `api/updateRun.ts` (nút "Cập nhật từ Thuế điện tử"),
 * không còn hàm gọi thẳng endpoint chặn nữa.
 */
export async function getSavedInvoices(
  direction: InvoiceDirection,
  query: InvoiceQuery,
): Promise<InvoiceResult> {
  const params = buildInvoiceParams(direction, query);

  const raw = await apiFetch<{
    total?: number;
    datas?: Array<Record<string, unknown>>;
  }>(`/gdt/invoices/${direction}/saved?${params.toString()}`);

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
export function getAllSavedInvoices(): Promise<[InvoiceResult, InvoiceResult]> {
  const range: InvoiceQuery = { tuNgay: "2000-01-01", denNgay: "2100-12-31" };
  return Promise.all([
    getSavedInvoices("purchase", range),
    getSavedInvoices("sold", range),
  ]);
}
