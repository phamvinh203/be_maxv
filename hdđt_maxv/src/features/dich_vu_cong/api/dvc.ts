import { apiFetch } from "../../../lib/http";

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
