// ============================================================
//  Captcha / đăng nhập GDT
// ============================================================

export interface CaptchaInfo {
  key: string;
  /** Chuỗi SVG của ảnh captcha */
  content: string;
}

export interface LoginPayload {
  /** Mã số thuế — đóng vai trò username trên GDT */
  mst: string;
  password: string;
  /** Mã captcha người dùng gõ nhìn từ ảnh */
  captcha: string;
  /** `key` trả về từ getCaptcha */
  key: string;
}

export interface LoginResult {
  token?: string;
  message?: string;
}

// ============================================================
//  Hóa đơn (tra cứu GDT / đọc DB / hiển thị)
// ============================================================

/** "purchase" = hóa đơn đầu vào (mua vào), "sold" = hóa đơn đầu ra (bán ra). Khớp path BE `/gdt/invoices/<direction>`. */
export type InvoiceDirection = "purchase" | "sold";

export interface InvoiceQuery {
  /** yyyy-MM-dd — bắt buộc */
  tuNgay: string;
  /** yyyy-MM-dd — bắt buộc */
  denNgay: string;
  trangThaiHd?: string;
  ketQuaHd?: string;
  /** MST đối tác — người bán (purchase) hoặc người mua (sold) tùy `direction` */
  mstDoiTac?: string;
  mauHd?: string;
  soSeri?: string;
  soHd?: string;
  /** Cursor phân trang từ lần gọi trước */
  state?: string;
}

/**
 * 1 hóa đơn đã chuẩn hóa — field đối tác (`mstDoiTac`/`tenDoiTac`) gộp chung
 * tên bất kể là hóa đơn mua vào (nbmst/nbten) hay bán ra (nmmst/nmten) từ GDT.
 * Các field còn lại giữ nguyên tên GDT trả về.
 */
export interface InvoiceRaw {
  id: string;
  mstDoiTac: string;
  tenDoiTac: string;
  /** Địa chỉ đối tác — không phải hóa đơn nào GDT cũng trả về field này. */
  diaChiDoiTac?: string;
  khmshdon: string;
  khhdon: string;
  shdon: string;
  tdlap: string;
  /** Ngày ký */
  nky?: string;
  tthai: string;
  ttxly: string;
  /** Mã ngoại tệ */
  dvtte?: string;
  /** Tỷ giá */
  tgia?: number;
  /** Tổng tiền chưa thuế */
  tgtcthue?: number;
  /** Tổng tiền thuế */
  tgtthue?: number;
  /** Tổng chiết khấu thương mại */
  ttcktmai?: number;
  /** Tổng phí */
  tgtphi?: number;
  tgtttbso: number;
  /** Trạng thái tải chi tiết ("OK" | "error") — cột "T. thái tải". */
  tt_tai?: string;
  [key: string]: unknown;
}

export interface InvoiceResult {
  total?: number;
  state?: string;
  datas?: InvoiceRaw[];
  /** Số hóa đơn vừa được lưu vào vct50view/vct60view — chỉ có ở luồng tra cứu GDT (getInvoices). */
  saved?: number;
  /** true nếu chưa lấy hết (lỗi GDT giữa chừng / chạm trần trang) — luồng "Cập nhật" nên cảnh báo. */
  partial?: boolean;
  /** Mô tả lý do chưa hoàn tất (đi kèm `partial`). */
  message?: string;
}

/** Giá trị bộ lọc trên InvoiceFilterPanel. */
export interface InvoiceFilterValues {
  tuNgay: string;
  denNgay: string;
  mstDoiTac: string;
  trangThaiHd: string;
  ketQuaHd: string;
  mauHd: string;
  soSeri: string;
  soHd: string;
}

/** Dòng hiển thị — chuẩn hóa field GDT + tách rõ bên bán/bên mua theo chiều hóa đơn. */
export interface DisplayRow {
  id: string;
  mauHd: string;
  soSeri: string;
  soHd: string;
  ngayLap: string;
  /** Ngày ký (nky) — có thể rỗng nếu GDT/DB không trả về. */
  ngayKy: string;
  sellerMst: string;
  sellerTen: string;
  sellerDiaChi: string;
  buyerMst: string;
  buyerTen: string;
  tienChuaThue?: number;
  tienThue?: number;
  cktm?: number;
  phi?: number;
  tongTt: number;
  maNt: string;
  tyGia?: number;
  trangThaiHd: string;
  ketQuaKt: string;
  /** Trạng thái tải chi tiết ("OK" | "error" | undefined = chưa tải) — cột "T. thái tải". */
  ttTai?: string;
}

// ============================================================
//  Chi tiết hóa đơn (tab "Chi tiết hoá đơn")
// ============================================================

/** Kết quả tải chi tiết 1 hóa đơn — POST /gdt/invoices/detail/:id. */
export interface InvoiceDetailResult {
  found: boolean;
  ok: boolean;
  detail: Record<string, unknown> | null;
  /** [DIAGNOSTIC] Lý do lỗi GDT (mã/message) khi ok=false — để log khi chẩn đoán. */
  error?: string;
}

/**
 * 1 dòng bảng "Chi tiết hóa đơn" = thông tin hóa đơn (lặp mỗi dòng) + 1 dòng hàng hóa.
 * Field header lấy từ top-level payload, field hàng hóa từ 1 phần tử mảng `hdhhdvu`.
 */
export interface DetailRow {
  // Thông tin hóa đơn (lặp mỗi dòng hàng)
  mauHd: string;
  kyHieu: string;
  soHd: string;
  ngayHd: string;
  sellerMst: string;
  sellerTen: string;
  maNt: string;
  tyGia?: number;
  tongTienHang?: number;
  tongThue?: number;
  tongCk?: number;
  tongPhi?: number;
  tongTt?: number;
  hinhThucTt: string;
  trangThaiHd: string;
  ketQuaKt: string;
  // Dòng hàng hóa (line item)
  tenHang: string;
  dvt: string;
  soLuong?: number;
  gia?: number;
  tienCk?: number;
  tienChuaThue?: number;
  thue?: number;
  tienSauThue?: number;
  tlCktm?: number;
  thueSuat: string;
}

// ============================================================
//  Đồng bộ hóa đơn
// ============================================================

/** Chiều đồng bộ hóa đơn (khớp BE). */
export type SyncDirection = "all" | "purchase" | "sold";
/** Loại hóa đơn theo cách xử lý máy tính tiền (ctt = hóa đơn máy tính tiền). */
export type SyncKind = "all" | "except_ctt" | "only_ctt";

export interface SyncRequest {
  /** yyyy-MM-dd */
  tuNgay: string;
  /** yyyy-MM-dd */
  denNgay: string;
  direction: SyncDirection;
  loai: SyncKind;
}

/** 1 dòng lịch sử đồng bộ (bảng sync_log bên BE) — ngày ở dạng chuỗi ISO. */
export interface SyncLog {
  id: string;
  tu_ngay: string;
  den_ngay: string;
  direction: SyncDirection;
  loai: SyncKind;
  /** Tổng hóa đơn GDT báo có trong khoảng. */
  tong: number;
  /** Số hóa đơn thực sự đã lưu vào DB. */
  da_luu: number;
  trang_thai: "done" | "partial";
  dien_giai: string | null;
  created_at: string;
}

/**
 * Kết quả POST /gdt/sync = 1 dòng `sync_log` + số liệu đối chiếu (chỉ trả ở response, KHÔNG lưu DB).
 * Dùng để hiện toast tóm tắt "đã có / thiếu bổ sung".
 */
export interface SyncResult extends SyncLog {
  /** Số hóa đơn GDT trả về đã có sẵn trong DB trước khi đồng bộ. */
  daCo: number;
  /** Số hóa đơn GDT có mà DB thiếu — vừa được bổ sung. */
  boSung: number;
}

export interface ClearSyncResult {
  purchase: number;
  sold: number;
  logs: number;
}

// ============================================================
//  Phiên đăng nhập GDT (context)
// ============================================================

export interface GdtSessionContextValue {
  /** MST vừa đăng nhập GDT gần nhất — dùng làm "phiên đang thao tác" khi chưa có UI chọn tenant. */
  currentGdtMst: string | null;
  /** Token đăng nhập GDT (hóa đơn điện tử) hiện có, theo từng MST (tenant). */
  getGdtToken: (mst: string) => string | undefined;
  setGdtToken: (mst: string, token: string) => void;
  clearGdtSession: () => void;
}
