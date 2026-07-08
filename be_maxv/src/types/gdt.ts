export interface CaptchaResponse {
  key: string;
  content: string;
}

export interface LoginRequest {
  /** Mã số thuế — đóng vai trò `username` trên GDT */
  mst: string;
  password: string;
  /** Nội dung captcha người dùng gõ (`cvalue`) */
  captcha: string;
  /** `key` trả về từ /captcha (`ckey`) */
  key: string;
}

export interface LoginResponse {
  token?: string;
  /** Có mặt khi đăng nhập thất bại (sai captcha / thông tin) */
  message?: string;
}
