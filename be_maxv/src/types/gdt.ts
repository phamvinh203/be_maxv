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

/**
 * Filter cho danh sách hóa đơn đầu vào (`/query/invoices/purchase`).
 * Đặt tên field khớp tham số của `ConvertInput` bên bản C#.
 */
export interface PurchaseInvoiceQuery {
  /** Từ ngày lập hóa đơn (yyyy-MM-dd) — bắt buộc */
  tuNgay: string;
  /** Đến ngày lập hóa đơn (yyyy-MM-dd) — bắt buộc */
  denNgay: string;
  /** Trạng thái hóa đơn (`tthai`) */
  trangThaiHd?: string;
  /** Kết quả xử lý hóa đơn (`ttxly`); `"8"` = hóa đơn máy tính tiền -> đổi sang sco-query */
  ketQuaHd?: string;
  /** MST người bán (`nbmst`) */
  mstNguoiBan?: string;
  /** Mẫu số hóa đơn (`khmshdon`) */
  mauHd?: string;
  /** Ký hiệu/số seri hóa đơn (`khhdon`) */
  soSeri?: string;
  /** Số hóa đơn (`shdon`) */
  soHd?: string;
  /** Cursor phân trang GDT trả về ở lần gọi trước, dùng để lấy trang kế tiếp */
  state?: string;
}

/** Response thô từ GDT cho danh sách hóa đơn — chưa parse chi tiết từng hóa đơn. */
export interface PurchaseInvoiceResponse {
  total?: number;
  /** Cursor phân trang cho lần gọi kế tiếp; rỗng/undefined nghĩa là hết trang. */
  state?: string;
  datas?: unknown[];
}
