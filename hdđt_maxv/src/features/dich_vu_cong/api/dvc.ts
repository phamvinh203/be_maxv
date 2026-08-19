import { apiFetch, apiFetchBlob } from "../../../lib/http";

/** Ảnh captcha + khóa phiên do BE mở với cổng Dịch vụ công. */
export interface DvcCaptchaInfo {
  /** Khóa phiên — phải gửi lại y nguyên khi đăng nhập. */
  key: string;
  /** Data-URL `data:image/png;base64,...` — gắn thẳng vào `<img src>`. */
  image: string;
  /** Chuỗi captcha được giải tự động từ backend (nếu đọc thành công). */
  answer?: string | null;
}

export interface DvcLoginPayload {
  /** Khóa phiên lấy từ `getDvcCaptcha`. */
  key: string;
  /** Tên đăng nhập cổng DVC, thường dạng `<MST>-ql`. */
  tenDN: string;
  /** Mật khẩu THÔ — BE tự mã hóa base64 theo dạng cổng quy định. */
  matKhau: string;
  captcha: string;
}

export interface DvcLoginResult {
  /** Khóa phiên đã đăng nhập — các lượt tra cứu sau dùng lại nó. */
  key: string;
  /** Body cổng trả về. Kiểu `unknown` vì dạng phản hồi của cổng chưa chốt. */
  data: unknown;
}

/**
 * GET /api/v1/dvc/captcha → `{ key, image }`.
 *
 * Mỗi lần gọi là BE mở một PHIÊN MỚI với cổng (tải trang login lấy cookie + token CSRF rồi
 * mới lấy ảnh). Nên đừng gọi dồn: cổng chặn tần suất khá gắt, vài lượt liên tiếp là 429.
 *
 * Dùng: `DialogLoginDVC` (queryFn của captchaQuery).
 */
export async function getDvcCaptcha(): Promise<DvcCaptchaInfo> {
  return apiFetch<DvcCaptchaInfo>("/dvc/captcha");
}

/**
 * GET /api/v1/dvc/tchs/captcha?key=... → `{ key, image, answer }`.
 *
 * Lấy ảnh captcha và tự động giải OCR cho form tra cứu hồ sơ (/tthc/getCaptcha)
 * bằng phiên đã đăng nhập qua `key`.
 */
export async function getDvcTchsCaptcha(key: string): Promise<DvcCaptchaInfo> {
  return apiFetch<DvcCaptchaInfo>(`/dvc/tchs/captcha?key=${encodeURIComponent(key)}`);
}

/**
 * POST /api/v1/dvc/login → `{ key, data }`.
 *
 * Khác `loginGdt` bên HĐĐT: hàm này KHÔNG tự kết luận đăng nhập thành công hay thất bại.
 * Dạng body cổng trả về khi đúng/sai chưa chốt được, mà BE thì đã đổi mọi lỗi HTTP thành
 * 400 kèm `message` (nên `apiFetch` tự ném). Caller đọc `data` để quyết.
 *
 * Dùng: `DialogLoginDVC` (mutationFn của loginMutation).
 */
export async function loginDvc(body: DvcLoginPayload): Promise<DvcLoginResult> {
  return apiFetch<DvcLoginResult>("/dvc/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Bảng kết quả tra cứu, đã được BE bóc từ mảnh HTML của cổng. */
export interface DvcBangHoSo {
  /** Tiêu đề cột theo đúng thứ tự cổng trả về; rỗng khi không có kết quả nào. */
  headers: string[];
  /** Mỗi dòng là mảng ô, khớp thứ tự `headers`. */
  rows: string[][];
}

export interface DvcTraCuuHoSoParams {
  /** Khóa phiên đã đăng nhập. */
  key: string;
  /** `yyyy-mm-dd`; BE tự đổi sang dạng cổng nhận. */
  tuNgay?: string;
  denNgay?: string;
  /** Captcha của trang tra cứu (tùy chọn: BE tự động OCR ngầm nếu bỏ trống). */
  captcha?: string;
  maHoSo?: string;
  maToKhai?: string;
  maTTHC?: string;
  maNghiepVu?: string;
}

/**
 * GET /api/v1/dvc/ho-so → `{ headers, rows }`.
 *
 * Trả cột ĐỘNG theo đúng cổng trả về, không ép vào bộ cột khai sẵn trong `config.ts`: cổng
 * đổi hay thêm cột thì bảng hiện theo, khỏi phải sửa code và khỏi lệch dữ liệu sang nhầm ô.
 */
export async function traCuuHoSoDvc(params: DvcTraCuuHoSoParams): Promise<DvcBangHoSo> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  return apiFetch<DvcBangHoSo>(`/dvc/ho-so?${qs.toString()}`);
}

export interface DvcHoSoParams {
  /** Khóa phiên đã đăng nhập. */
  key: string;
  /** Mã hồ sơ — cột "Mã giao dịch" của bảng kết quả (giá trị thật là "Mã hồ sơ" bên cổng). */
  maHoSo: string;
}

/**
 * GET /api/v1/dvc/ho-so/file → tải file XML của một hồ sơ, qua BE proxy (cổng không mở
 * CORS). Trả `Blob` để FE tự lưu xuống máy.
 *
 * Dùng: `taiFileHoSo` (cột "Tải file").
 */
export function taiFileHoSoDvc({ key, maHoSo }: DvcHoSoParams): Promise<Blob> {
  const qs = new URLSearchParams({ key, maHoSo });
  return apiFetchBlob(`/dvc/ho-so/file?${qs.toString()}`);
}

/**
 * GET /api/v1/dvc/ho-so/tai-lieu-dkem → danh sách tài liệu đính kèm của một hồ sơ.
 *
 * Trả JSON THÔ — hình dạng thật của cổng chưa xác nhận (chưa có mẫu response), BE không ép
 * kiểu nên FE cũng để `unknown`, xem `TaiLieuDinhKemDialog` (tự dò cột từ khóa JSON).
 *
 * Dùng: `TaiLieuDinhKemDialog` (cột "Tệp đính kèm").
 */
export function layTaiLieuDinhKemDvc({ key, maHoSo }: DvcHoSoParams): Promise<unknown> {
  const qs = new URLSearchParams({ key, maHoSo });
  return apiFetch<unknown>(`/dvc/ho-so/tai-lieu-dkem?${qs.toString()}`);
}
