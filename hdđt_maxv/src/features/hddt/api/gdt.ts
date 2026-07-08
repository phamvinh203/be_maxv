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

export interface PurchaseInvoiceQuery {
  /** yyyy-MM-dd — bắt buộc */
  tuNgay: string
  /** yyyy-MM-dd — bắt buộc */
  denNgay: string
  trangThaiHd?: string
  ketQuaHd?: string
  mstNguoiBan?: string
  mauHd?: string
  soSeri?: string
  soHd?: string
  /** Cursor phân trang từ lần gọi trước */
  state?: string
}

/** 1 hóa đơn thô trả về từ GDT (field đặt tên theo nguyên bản GDT, chưa chuẩn hóa). */
export interface PurchaseInvoiceRaw {
  id: string
  nbmst: string
  nbten: string
  khmshdon: string
  khhdon: string
  shdon: string
  tdlap: string
  tthai: string
  ttxly: string
  tgtttbso: number
  [key: string]: unknown
}

export interface PurchaseInvoiceResult {
  total?: number
  state?: string
  datas?: PurchaseInvoiceRaw[]
}

/** GET /api/v1/gdt/invoices/purchase → danh sách hóa đơn đầu vào (chưa lưu DB, chỉ tra cứu trực tiếp GDT). */
export async function getPurchaseInvoices(
  token: string,
  query: PurchaseInvoiceQuery,
): Promise<PurchaseInvoiceResult> {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })

  const res = await fetch(`${API_BASE}/gdt/invoices/purchase?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = (await res.json().catch(() => ({}))) as PurchaseInvoiceResult & {
    message?: string
  }
  if (!res.ok) {
    throw new Error(data.message || `Không lấy được danh sách hóa đơn (${res.status})`)
  }
  return data
}
