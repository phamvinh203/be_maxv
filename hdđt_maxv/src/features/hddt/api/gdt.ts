import { API_BASE } from '../../../config/api'

export interface CaptchaInfo {
  key: string
  /** Chuỗi SVG của ảnh captcha */
  content: string
}

export interface LoginPayload {
  /** Mã số thuế — đóng vai trò username trên GDT */
  mst: string
  password: string
  /** Mã captcha người dùng gõ nhìn từ ảnh */
  captcha: string
  /** `key` trả về từ getCaptcha */
  key: string
}

export interface LoginResult {
  token?: string
  message?: string
}

/** GET /api/v1/gdt/captcha → { key, content (SVG) } */
export async function getCaptcha(): Promise<CaptchaInfo> {
  const res = await fetch(`${API_BASE}/gdt/captcha`)
  if (!res.ok) throw new Error(`Không lấy được captcha (${res.status})`)
  return res.json()
}

/** POST /api/v1/gdt/login → { token } (ném error kèm message nếu thất bại) */
export async function loginGdt(body: LoginPayload): Promise<LoginResult> {
  const res = await fetch(`${API_BASE}/gdt/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as LoginResult
  if (!res.ok || !data.token) {
    throw new Error(data.message || 'Đăng nhập thất bại')
  }
  return data
}
