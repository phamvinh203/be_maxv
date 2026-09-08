import { api } from "@/lib/apiClient";
import { apiFetch, apiFetchBlob } from "@/lib/http";

/**
 * Gọi API hồ sơ / tài liệu nhân viên (`hrm_tai_lieu` + `hrm_tai_lieu_file` trong DB tenant).
 *
 * Thông tin giấy tờ nằm ở DB tenant; FILE SCAN nằm trên Google Drive của chính công ty, DB chỉ
 * giữ con trỏ. Xem `taiLieuDrive.service.ts` bên backend.
 *
 * `[QĐ #21]` MỘT dòng giấy tờ giữ NHIỀU file. Căn cước là MỘT giấy tờ có hai mặt, không phải
 * hai giấy tờ — nên hai ảnh mặt trước / mặt sau nằm chung một dòng (BR-hrm-037). Bốn trường
 * `drive_file_id` / `ten_file` / `mime_type` / `kich_thuoc` ở cấp dòng đã BỎ HẲN, thay bằng
 * mảng `files`.
 */
const BASE = "/hrm/tai-lieu";

/* ─────────────────────────── Hằng số chép từ backend ─────────────────────────── */

/**
 * Ba hằng dưới đây CHÉP từ `be_maxv/src/services/client/hrm/taiLieuDrive.service.ts`
 * (`GIOI_HAN_FILE_BYTE`, `MIME_CHO_PHEP`, `SO_FILE_TOI_DA`). Bản sao ở FE chỉ để **chặn sớm**
 * cho người dùng biết trước khi tốn một lượt tải lên — backend vẫn là nơi quyết định thật.
 * Sửa bên BE thì sửa cả ở đây.
 */
export const GIOI_HAN_FILE_MB = 10;
export const GIOI_HAN_FILE_BYTE = GIOI_HAN_FILE_MB * 1024 * 1024;

/** Đúng 5 kiểu backend nhận (BR-hrm-035) — dùng cho thuộc tính `accept` của ô chọn file. */
export const MIME_CHO_PHEP =
  "image/jpeg,image/png,image/webp,image/heic,application/pdf";

/** Trần số file trên MỘT dòng giấy tờ — BR-hrm-037, vượt thì BE trả 409 E-hrm-065. */
export const SO_FILE_TOI_DA = 20;

/**
 * Wording E-hrm-065, chép NGUYÊN VĂN từ `be_maxv/src/constants/messages.ts`
 * (`MESSAGES.HRM.TAI_LIEU_QUA_NHIEU_FILE`).
 *
 * Vì sao FE giữ bản sao dù BE trả 409 kèm `message`: đây là phép chặn **trước khi tải**. Để BE
 * bắt thì người dùng đã ngồi đợi hết N file đầu rồi mới nhận lỗi ở file thứ 21 — mà các file
 * trước đó đã nằm trên Drive của khách rồi. Cùng loại ngoại lệ với `LOI_LUONG_CHINH` ở
 * `hopDongQueries.ts` (dev-notes 2.7).
 */
export const LOI_QUA_NHIEU_FILE =
  "Mỗi giấy tờ giữ tối đa 20 file. Gỡ bớt file cũ rồi thử lại.";

/* ───────────────────────────────── Kiểu dữ liệu ──────────────────────────────── */

/**
 * Một file scan thuộc một dòng giấy tờ (contract Mục 6.1).
 *
 * KHÔNG có `drive_file_id`: đó là con trỏ nội bộ tới Drive của khách, BE cố ý không trả ra.
 * FE chỉ cần `id` để gọi hai đường xem (`GET .../file/:fileId`) và gỡ (`DELETE .../file/:fileId`).
 */
export interface FileScanApi {
  id: string;
  ten_file: string;
  mime_type: string;
  kich_thuoc: number;
}

/** Dòng BE trả về. `ngay_cap` là ISO đầy đủ (`2021-05-20T00:00:00.000Z`), không phải YYYY-MM-DD. */
export interface TaiLieuApiRow {
  id: string;
  ma_nv: string;
  loai: string;
  so_hieu: string | null;
  ngay_cap: string | null;
  noi_cap: string | null;
  ghi_chu: string | null;
  /** BE tra sẵn từ hrm_nhan_vien, không lưu trùng trong bảng tài liệu. */
  ten_nv?: string | null;

  /**
   * File scan của dòng này, đã sắp theo `thu_tu` rồi `datetime0` — mặt trước tải trước thì
   * LUÔN hiện trước, không đảo chỗ giữa các lần đọc. **Mảng rỗng = chưa đính file scan**
   * (dòng vẫn hợp lệ: có giấy tờ nhưng chưa scan).
   */
  files: FileScanApi[];
}

export interface TaiLieuApiBody {
  loai: string;
  so_hieu: string | null;
  ngay_cap: string | null;
  noi_cap: string | null;
  ghi_chu: string | null;
}

export interface TaiLieuApiCreateBody extends TaiLieuApiBody {
  ma_nv: string;
}

export interface TaiLieuListParams {
  ma_nv?: string;
  loai?: string;
}

/**
 * Kết quả xóa cả dòng giấy tờ (contract Mục 6.4).
 *
 * `da_xoa_file_drive = false` nghĩa là dòng ĐÃ xóa nhưng file trên Drive chưa dọn được — BE cố
 * ý không để lỗi Drive chặn thao tác nghiệp vụ (BR-hrm-039). Giao diện phải nói đúng chuyện đó
 * thay vì báo thành công trơn.
 */
export interface KetQuaXoaTaiLieu {
  id: string;
  da_xoa_file_drive: boolean;
}

/**
 * Kết quả tải THÊM một file (contract Mục 7.6).
 *
 * ⚠️ `id` là id của **dòng file vừa tạo**, KHÔNG phải id của dòng giấy tờ (khác hẳn bản trước
 * QĐ #21). Id giấy tờ nằm ở `tai_lieu_id`. Dùng nhầm là gọi xem/gỡ vào đúng chỗ trống.
 */
export interface FileVuaTai {
  id: string;
  tai_lieu_id: string;
  ten_file: string;
  mime_type: string;
  kich_thuoc: number;
  /** Tổng số file của dòng giấy tờ SAU khi thêm file này. */
  so_file: number;
}

/** Kết quả gỡ một file (contract Mục 7.8). `id` = fileId vừa gỡ. */
export interface KetQuaGoFile {
  id: string;
  so_file_con_lai: number;
}

/* ─────────────────────────────── Dòng giấy tờ ────────────────────────────────── */

export function listTaiLieu(
  params?: TaiLieuListParams,
): Promise<TaiLieuApiRow[]> {
  return api.get<TaiLieuApiRow[]>(BASE, { params });
}

export function createTaiLieu(
  body: TaiLieuApiCreateBody,
): Promise<{ id: string }> {
  return api.post(BASE, body);
}

export function updateTaiLieu(
  id: string,
  body: TaiLieuApiBody,
): Promise<{ id: string }> {
  return api.put(`${BASE}/${encodeURIComponent(id)}`, body);
}

/** Xóa dòng giấy tờ VÀ mọi file scan của nó trên Drive (BR-hrm-039). */
export function deleteTaiLieu(id: string): Promise<KetQuaXoaTaiLieu> {
  return api.del(`${BASE}/${encodeURIComponent(id)}`);
}

// ── Google Drive: file scan đính kèm ────────────────────────────────────────

export interface TrangThaiDriveApi {
  /** Máy chủ đã cấu hình GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI chưa. */
  may_chu_san_sang: boolean;
  /** Công ty đang chọn đã nối Drive chưa. */
  da_ket_noi: boolean;
  /** Tài khoản Google đang dùng — cho người dùng biết file nằm ở Drive của ai. */
  email: string | null;
}

export function trangThaiDrive(): Promise<TrangThaiDriveApi> {
  return api.get<TrangThaiDriveApi>(`${BASE}/drive/trang-thai`);
}

export function urlLienKetDrive(): Promise<{ url: string }> {
  return api.get<{ url: string }>(`${BASE}/drive/lien-ket`);
}

export function ngatKetNoiDrive(): Promise<{ da_ngat: boolean }> {
  return api.del(`${BASE}/drive/ket-noi`);
}

/**
 * Tải THÊM một file scan vào dòng giấy tờ. Mỗi lần gọi đúng MỘT file; chọn nhiều file thì gọi
 * tuần tự nhiều lần vào CÙNG một `idTaiLieu` (contract Mục 7.6).
 *
 * `[QĐ #21]` Đây là THÊM VÀO, **không còn thay thế** file cũ. Muốn bỏ một file thì gỡ đích danh
 * bằng `xoaFileDinhKem(idTaiLieu, fileId)`.
 *
 * Dùng `apiFetch` thẳng chứ không qua `api.post`: shim đó `JSON.stringify` mọi body, còn đây
 * phải gửi `FormData` để fetch tự đặt boundary multipart.
 */
export async function taiFileLen(
  idTaiLieu: string,
  file: File,
): Promise<FileVuaTai> {
  const form = new FormData();
  form.append("file", file);
  const res = await apiFetch<{ data: FileVuaTai }>(
    `${BASE}/${encodeURIComponent(idTaiLieu)}/file`,
    { method: "POST", body: form },
  );
  return res.data;
}

/**
 * Tải nội dung MỘT file về dạng Blob để hiển thị trong app.
 *
 * KHÔNG dùng `<img src="...">` trỏ thẳng vào API. Lý do KHÔNG phải cross-origin — Vite proxy
 * `/api` sang cổng 4000 (xem vite.config.ts) và `API_BASE` là đường dẫn tương đối, nên lúc dev
 * vẫn cùng origin. Lý do thật: thẻ `<img>` tự đi một request NGOÀI lớp `apiFetch`, nên gặp
 * access token hết hạn thì nó chỉ nhận 401 và hiện hình vỡ, không kích hoạt được cơ chế tự làm
 * mới token rồi thử lại. Lấy Blob qua `apiFetch` thì hưởng đúng cơ chế đó như mọi lời gọi khác.
 */
export function taiFileVe(idTaiLieu: string, fileId: string): Promise<Blob> {
  return apiFetchBlob(
    `${BASE}/${encodeURIComponent(idTaiLieu)}/file/${encodeURIComponent(fileId)}`,
  );
}

/**
 * Gỡ ĐÚNG MỘT file khỏi dòng giấy tờ. Các file còn lại và dòng giấy tờ giữ nguyên; gỡ file
 * cuối cùng cũng KHÔNG xóa dòng theo (BR-hrm-038).
 */
export function xoaFileDinhKem(
  idTaiLieu: string,
  fileId: string,
): Promise<KetQuaGoFile> {
  return api.del(
    `${BASE}/${encodeURIComponent(idTaiLieu)}/file/${encodeURIComponent(fileId)}`,
  );
}
