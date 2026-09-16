import { apiFetch, apiFetchBlob, apiFetchData } from "@/lib/http";
import type {
  BangTinhThueTongHopDto,
  ChotBangTinhThueResult,
  CreateIncomeCategoryPayload,
  CreateOtherIncomePayload,
  DanhDauDaNopPayload,
  DinhDangFile,
  IncomeCategoryListParams,
  KyToKhaiDto,
  MoLaiBangTinhThueResult,
  OtherIncomeCategoryDto,
  OtherIncomeListParams,
  OtherIncomeListResponse,
  OtherIncomePreviewDto,
  OtherIncomeRecordDto,
  PreviewOtherIncomePayload,
  PutOverridesPayload,
  TaxCalculationParams,
  ToKhaiTncn05Dto,
  UpdateIncomeCategoryPayload,
  UpdateIncomeCategoryResult,
  UpdateOtherIncomePayload,
  XoaGhiDeParams,
  XuatToKhaiPayload,
} from "../../types/toKhaiThue";

/**
 * Tầng gọi HTTP của cụm Tờ khai thuế TNCN — 23 endpoint của
 * `docs/hrm/to_khai_thue/api-contract-to-khai-thue.md`.
 *
 * Mới nối 19/23 endpoint — 4 endpoint chưa màn nào dùng (chi tiết một danh mục, chi tiết một khoản,
 * bảng chi tiết dạng JSON, danh sách chính sách thuế) sẽ viết khi dựng màn cần tới, khỏi nuôi mã chết.
 *
 * Dùng thẳng `apiFetchData`/`apiFetch`/`apiFetchBlob` chứ không qua lớp tương thích kiểu axios ở
 * `@/lib/apiClient`: cụm này có 2 endpoint trả 204 (không có envelope để bóc) và 3 endpoint trả FILE
 * nhị phân, lớp tương thích không diễn tả được.
 */

const BASE = "/hrm/to-khai-thue";

type ThamSo = Record<string, string | number | boolean | undefined | null>;

/** Ghép query string, bỏ qua tham số rỗng — `false` và `0` vẫn được gửi. */
function duongDan(duoi: string, thamSo?: ThamSo): string {
  if (!thamSo) return `${BASE}${duoi}`;
  const usp = new URLSearchParams();
  for (const [khoa, gt] of Object.entries(thamSo)) {
    if (gt === undefined || gt === null || gt === "") continue;
    usp.set(khoa, String(gt));
  }
  const qs = usp.toString();
  return qs ? `${BASE}${duoi}?${qs}` : `${BASE}${duoi}`;
}

function guiJson(method: "POST" | "PUT", body: unknown): RequestInit {
  return { method, body: JSON.stringify(body) };
}

/** Tên file tải về — khớp `Content-Disposition` máy chủ đặt (hợp đồng Mục 5.9). */
export function tenFileToKhai(nam: number, quy: number, format: DinhDangFile): string {
  return `05-KK-TNCN_Quy${quy}_${nam}.${format === "pdf" ? "pdf" : "xlsx"}`;
}

/* ── 1. Danh mục loại thu nhập ngoài lương (5 endpoint) ──────────────── */

export function layDanhSachDanhMuc(
  thamSo: IncomeCategoryListParams = {},
): Promise<OtherIncomeCategoryDto[]> {
  return apiFetchData<OtherIncomeCategoryDto[]>(duongDan("/income-categories", { ...thamSo }));
}

export function taoDanhMuc(
  payload: CreateIncomeCategoryPayload,
): Promise<OtherIncomeCategoryDto> {
  return apiFetchData<OtherIncomeCategoryDto>(
    duongDan("/income-categories"),
    guiJson("POST", payload),
  );
}

export function suaDanhMuc(
  id: string,
  payload: UpdateIncomeCategoryPayload,
): Promise<UpdateIncomeCategoryResult> {
  return apiFetchData<UpdateIncomeCategoryResult>(
    duongDan(`/income-categories/${id}`),
    guiJson("PUT", payload),
  );
}

/** Trả 204 KHÔNG kèm body — dùng `apiFetch` để khỏi vướng bước bóc `data`. */
export async function xoaDanhMuc(id: string): Promise<void> {
  await apiFetch<unknown>(duongDan(`/income-categories/${id}`), { method: "DELETE" });
}

/* ── 2. Thu nhập ngoài lương (6 endpoint) ────────────────────────────── */

export function layDanhSachKhoan(
  thamSo: OtherIncomeListParams,
): Promise<OtherIncomeListResponse> {
  return apiFetchData<OtherIncomeListResponse>(duongDan("/other-income", { ...thamSo }));
}

/** Tính thử — KHÔNG ghi gì. Mọi con số gross/net/thuế trên form phải lấy từ đây. */
export function tinhThuKhoan(
  payload: PreviewOtherIncomePayload,
): Promise<OtherIncomePreviewDto> {
  return apiFetchData<OtherIncomePreviewDto>(
    duongDan("/other-income/preview"),
    guiJson("POST", payload),
  );
}

export function taoKhoan(payload: CreateOtherIncomePayload): Promise<OtherIncomeRecordDto> {
  return apiFetchData<OtherIncomeRecordDto>(duongDan("/other-income"), guiJson("POST", payload));
}

export function suaKhoan(
  id: string,
  payload: UpdateOtherIncomePayload,
): Promise<OtherIncomeRecordDto> {
  return apiFetchData<OtherIncomeRecordDto>(
    duongDan(`/other-income/${id}`),
    guiJson("PUT", payload),
  );
}

/** Trả 204 KHÔNG kèm body. */
export async function xoaKhoan(id: string): Promise<void> {
  await apiFetch<unknown>(duongDan(`/other-income/${id}`), { method: "DELETE" });
}

/* ── 3. Bảng tính thuế tháng (3 endpoint) ────────────────────────────── */

export function layBangTinhThue(
  thamSo: TaxCalculationParams,
): Promise<BangTinhThueTongHopDto> {
  return apiFetchData<BangTinhThueTongHopDto>(duongDan("/tax-calculation", { ...thamSo }));
}

/** Chốt tháng — chỉ cần quyền xem lương, KHÔNG cần ADMIN/OWNER. */
export function chotBangTinhThue(periodId: string): Promise<ChotBangTinhThueResult> {
  return apiFetchData<ChotBangTinhThueResult>(
    duongDan("/tax-calculation/lock"),
    guiJson("POST", { periodId }),
  );
}

/** Mở lại tháng — cần ADMIN/OWNER, `lyDo` tối thiểu 20 ký tự, XÓA VĨNH VIỄN snapshot đã chốt. */
export function moLaiBangTinhThue(
  periodId: string,
  lyDo: string,
): Promise<MoLaiBangTinhThueResult> {
  return apiFetchData<MoLaiBangTinhThueResult>(
    duongDan("/tax-calculation/unlock"),
    guiJson("POST", { periodId, lyDo }),
  );
}

/* ── 4. Tờ khai quý 05/KK-TNCN (8 endpoint) ──────────────────────────── */

/** Kỳ khai LUÔN là quý (BR-tkt-016) — không còn tham số `kyLoai`/`soLan` như bản nháp cũ. */
export function layToKhaiQuy(nam: number, quy: number): Promise<ToKhaiTncn05Dto> {
  return apiFetchData<ToKhaiTncn05Dto>(duongDan("/05-kk-tncn", { nam, quy }));
}

export function layLichSuKyKhai(nam?: number): Promise<KyToKhaiDto[]> {
  return apiFetchData<KyToKhaiDto[]>(duongDan("/05-kk-tncn/periods", { nam }));
}

export function ghiDeChiTieu(payload: PutOverridesPayload): Promise<ToKhaiTncn05Dto> {
  return apiFetchData<ToKhaiTncn05Dto>(
    duongDan("/05-kk-tncn/overrides"),
    guiJson("PUT", payload),
  );
}

/** Xóa ghi đè — tham số đi bằng QUERY, không phải thân yêu cầu. */
export function xoaGhiDeChiTieu({ nam, quy, ct }: XoaGhiDeParams): Promise<ToKhaiTncn05Dto> {
  return apiFetchData<ToKhaiTncn05Dto>(duongDan("/05-kk-tncn/overrides", { nam, quy, ct }), {
    method: "DELETE",
  });
}

/**
 * Xuất tờ khai — trả FILE, và KHÔNG LÙI LẠI ĐƯỢC: sau lệnh này cả 3 tháng của quý vĩnh viễn
 * không mở lại được. Gọi lần hai trả 409 `E-tkt-020`, muốn lấy lại file thì dùng `taiLaiFileToKhai`.
 */
export function xuatToKhai(payload: XuatToKhaiPayload): Promise<Blob> {
  return apiFetchBlob(duongDan("/05-kk-tncn/export"), guiJson("POST", payload));
}

/** Tải lại đúng file đã xuất — dựng từ số đã lưu, không tính lại, không đổi trạng thái. */
export function taiLaiFileToKhai(
  nam: number,
  quy: number,
  format: DinhDangFile,
): Promise<Blob> {
  return apiFetchBlob(duongDan("/05-kk-tncn/file", { nam, quy, format }));
}

export function taiBangChiTietExcel(nam: number, quy: number): Promise<Blob> {
  return apiFetchBlob(duongDan("/05-kk-tncn/detail-sheet", { nam, quy, format: "excel" }));
}

/** Đánh dấu đã nộp — hệ thống KHÔNG gửi gì cho cơ quan thuế, chỉ ghi nhận việc kế toán đã nộp. */
export function danhDauDaNop(payload: DanhDauDaNopPayload): Promise<ToKhaiTncn05Dto> {
  return apiFetchData<ToKhaiTncn05Dto>(
    duongDan("/05-kk-tncn/mark-submitted"),
    guiJson("POST", payload),
  );
}

/* ── 5. Chính sách thuế đang áp (1 endpoint, chỉ đọc) ────────────────── */

