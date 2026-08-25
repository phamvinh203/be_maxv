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

/** Mật khẩu cổng thuế đã lưu của công ty đang chọn (GET /gdt/credential); `null` = chưa lưu. */
export interface GdtSavedPassword {
  password: string | null;
}

// ============================================================
//  Hóa đơn (tra cứu GDT / đọc DB / hiển thị)
// ============================================================

/** "purchase" = hóa đơn đầu vào (mua vào), "sold" = hóa đơn đầu ra (bán ra). Khớp path BE `/gdt/invoices/<direction>`. */
export type InvoiceDirection = "purchase" | "sold";

/**
 * Query gửi lên server (`GET /gdt/invoices/:direction/saved`). CHỈ còn field mà server thật sự lọc
 * được. Hiện chỉ khoảng ngày được gửi để đọc toàn bộ hóa đơn trong kỳ; mọi field còn lại lọc phía
 * client trong `InvoiceListTabs`, nên panel và icon header đều có thể áp sống mà không gọi lại BE.
 */
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
 * Giá trị lọc theo cột qua icon ở header bảng — 100% lọc PHÍA CLIENT trên dữ liệu bảng đang có
 * (không gửi lên server, khác `InvoiceQuery`), vì bảng đã tải toàn bộ hóa đơn trong khoảng ngày về
 * một lần rồi — gõ tiếp vào các ô này không cần vòng qua BE nữa. Xem `matchesOverviewFilters`/
 * `matchesDetailHeaderFilters` ở `InvoiceListTabs`.
 */
export interface InvoiceColumnFilterValues {
  tenDoiTac?: string;
  diaChiDoiTac?: string;
  maNt?: string;
  /** Gõ tự do khớp NHÃN hiển thị của "Trạng thái tải" (vd "lỗi", "chưa tải") — KHÔNG phải mã thô. */
  ttTai?: string;
  /**
   * Gõ tự do khớp NHÃN "Trạng thái hóa đơn"/"Kết quả kiểm tra" (vd "hủy" khớp "Hóa đơn đã bị hủy")
   * — CHỈ lọc hiển thị phía client, tách khỏi `InvoiceFilterValues.trangThaiHd`/`ketQuaHd` (mã chính
   * xác từ panel "Bộ lọc", còn gửi lên BE để giới hạn lượt "Tải chi tiết"/"Cập nhật", xem
   * `buildGdtRunQuery`). 2 tiêu chí này CỘNG THÊM (AND) vào lọc mã chính xác, không thay thế.
   */
  trangThaiHdText?: string;
  ketQuaHdText?: string;
  tuTienChuaThue?: string;
  denTienChuaThue?: string;
  tuTienThue?: string;
  denTienThue?: string;
  tuCktm?: string;
  denCktm?: string;
  tuPhi?: string;
  denPhi?: string;
  tuTongTt?: string;
  denTongTt?: string;
  tuTyGia?: string;
  denTyGia?: string;
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
  khmshdon: string;
  khhdon: string;
  shdon: string;
  /** Thời điểm lập — giờ VN `yyyy-MM-ddTHH:mm:ss`, không hậu tố múi giờ (docs/14-hop-dong-api.md). */
  tdlap: string;
  /** Ngày ký — cùng quy ước giờ VN không hậu tố như `tdlap`. */
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
  /**
   * Bốn field dưới đây BE trích sẵn từ JSON `detail` (xem `readDetailExtras`) để bảng Tổng quát có
   * cột "Tên hàng hóa, dịch vụ" và "Ghi chú: Hóa đơn thay thế, điều chỉnh…" mà không phải tải cả
   * payload chi tiết. Rỗng với hóa đơn chưa tải chi tiết.
   */
  tenHang?: string;
  /** Ký hiệu hóa đơn GỐC bị thay thế/điều chỉnh. */
  khhdgoc?: string;
  /** Số hóa đơn GỐC bị thay thế/điều chỉnh. */
  shdgoc?: string;
  /** Ngày lập hóa đơn GỐC bị thay thế/điều chỉnh. */
  tdlhdgoc?: string;
  [key: string]: unknown;
}

/**
 * 1 hóa đơn THAY THẾ/ĐIỀU CHỈNH kèm khóa trỏ về hóa đơn gốc — mắt xích để tra ngược "hóa đơn này bị
 * hóa đơn nào thay thế". Giữ nguyên tên field GDT để đưa thẳng vào `buildReplacedByMap`, dùng chung
 * một hàm với payload chi tiết.
 */
export interface ReplacementRow {
  nbmst: string;
  khhdgoc: string;
  shdgoc: string;
  shdon: string;
  tdlap: string;
  tthai: string;
  [key: string]: unknown;
}

export interface InvoiceResult {
  total?: number;
  state?: string;
  datas?: InvoiceRaw[];
  /**
   * Hóa đơn thay thế/điều chỉnh lập TỪ `tuNgay` trở đi — CỐ Ý không bó trong khoảng đang lọc, vì
   * hóa đơn thay thế thường lập ở kỳ sau hóa đơn gốc (xem `readReplacements` bên BE). Chỉ luồng đọc
   * DB (`/saved`) trả về; luồng tra cứu GDT trực tiếp không có.
   */
  thayThe?: ReplacementRow[];
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
  /** Địa chỉ bên bán (nbdchi) — cột "Địa chỉ người bán" của chiều MUA VÀO. */
  sellerDiaChi: string;
  buyerMst: string;
  /** Tên bên mua: tên đơn vị (nmten), rỗng thì họ tên người mua hàng (nmtnmua) — xem `toDisplayRow`. */
  buyerTen: string;
  /** Địa chỉ bên mua (nmdchi) — cột "Địa chỉ người mua" của chiều BÁN RA. */
  buyerDiaChi: string;
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
  /**
   * MST nhà cung cấp phát hành (`msttcgp`, vd Viettel/MISA) — có sẵn ngay từ lúc tìm kiếm. Dùng cho
   * dialog "Tải hóa đơn gốc" để gom/lọc theo `TRA_CUU_NCC`. Rỗng nếu raw thiếu field này.
   */
  msttcgp: string;
  /**
   * Tên hàng hóa của DÒNG HÀNG ĐẦU TIÊN — một hóa đơn nhiều mặt hàng chỉ hiện được mặt đại diện ở
   * bảng này (muốn đủ thì xem bảng "Chi tiết hóa đơn"). BE trích sẵn từ JSON `detail`; rỗng khi hóa
   * đơn chưa tải chi tiết.
   */
  tenHang: string;
  /**
   * Mô tả hóa đơn thay thế/điều chỉnh — CÙNG nội dung với cột tương ứng của bảng Chi tiết (dùng
   * chung `tinhGhiChuLienQuan`). Rỗng với hóa đơn mới, hoặc khi chưa tra được hóa đơn thay thế.
   */
  ghiChuLienQuan: string;
  /**
   * Ngày lập của hóa đơn liên quan nói trên, tách khỏi `ghiChuLienQuan` để lọc/sắp xếp được theo
   * ngày (`dd-MM-yyyy`). Rỗng khi không có hóa đơn liên quan.
   */
  ngayLienQuan: string;
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
  /**
   * Số thứ tự của HÓA ĐƠN trong bảng Tổng quát (1-based) — KHÔNG phải số thứ tự dòng hàng.
   * Cần vì bảng Chi tiết có nhiều dòng cho cùng một hóa đơn, nên chỉ số dòng không dùng để dựng
   * tên file được. Nguồn: `invoiceSttMap`. 0 = không tra được (hóa đơn không có trong bảng Tổng quát).
   */
  stt: number;
  mauHd: string;
  kyHieu: string;
  soHd: string;
  ngayHd: string;
  /** Ngày người bán ký số (nky) — rỗng nếu payload chi tiết không có. */
  ngayKy: string;
  sellerMst: string;
  sellerTen: string;
  /** Địa chỉ bên bán (nbdchi) — cột "Địa chỉ người bán" của chiều MUA VÀO. */
  sellerDiaChi: string;
  buyerMst: string;
  /** Tên bên mua: tên đơn vị (nmten), rỗng thì họ tên người mua hàng (nmtnmua) — xem `toDetailRows`. */
  buyerTen: string;
  /** Địa chỉ bên mua (nmdchi) — cột "Địa chỉ người mua" của chiều BÁN RA. */
  buyerDiaChi: string;
  /** Mã của cơ quan thuế (MCCQT) — chỉ hóa đơn có mã CQT mới có. */
  mccqt: string;
  /** Thời điểm Cơ quan Thuế ký số/cấp mã — chỉ hóa đơn CÓ MÃ mới có (`ttxly=5`). */
  ngayCqtKy: string;
  /** Ghi chú của hóa đơn (gchu) — cột "Ghi chú 1". */
  ghiChu: string;
  /** Website người bán (nbwebsite). */
  websiteNb: string;
  /** MST nhà cung cấp hóa đơn gốc (`msttcgp`) — có sẵn ngay từ lúc tìm kiếm, mỗi HĐ một NCC. */
  msttcgp: string;
  /** URL tra cứu hóa đơn gốc (`urlTraCuu`) — link trực tiếp đến trang tra cứu của NCC phát hành. */
  urlTraCuu: string;
  /** Thông tin tra cứu hóa đơn gốc (`dliu`) — chuỗi tra cứu trên trang của NCC phát hành. */
  dliu: string;
  /** Mã tổ chức truyền nhận (TVAN) đẩy hóa đơn lên cổng thuế, vd `tvan_misa` (`ngcnhat`). */
  tvan: string;
  /** Biển số xe đọc từ "họ tên người mua" — hóa đơn xăng dầu/vận tải hay ghi phương tiện vào ô đó. */
  bienSoXe: string;
  /** Mô tả hóa đơn gốc bị thay thế/điều chỉnh (dựng từ nhóm field `…goc`); rỗng với hóa đơn mới. */
  ghiChuLienQuan: string;
  /** Ngày lập của hóa đơn liên quan nói trên (`dd-MM-yyyy`); rỗng với hóa đơn mới. */
  ngayLienQuan: string;
  maNt: string;
  tyGia?: number;
  tongTienHang?: number;
  tongThue?: number;
  tongCk?: number;
  tongPhi?: number;
  tongTt?: number;
  /** Cột "Thuế" — tổng tiền thuế của HÓA ĐƠN (`tgtthue`), không phải thuế của dòng hàng. */
  thue?: number;
  /** Cột "Tiền sau thuế" — tổng thanh toán của HÓA ĐƠN, đã gồm VAT (`tgtttbso`). */
  tienSauThue?: number;
  hinhThucTt: string;
  trangThaiHd: string;
  ketQuaKt: string;
  // Dòng hàng hóa (line item)
  /** Mã hàng hóa/vật tư do người bán đặt — nhiều hóa đơn để trống. */
  maVt: string;
  tenHang: string;
  dvt: string;
  soLuong?: number;
  gia?: number;
  tienCk?: number;
  tienChuaThue?: number;
  /**
   * Tỷ lệ chiết khấu (%) của dòng hàng. KHÔNG optional: "không có chiết khấu" nghĩa là 0%, nên cột
   * này luôn ra con số — cùng lý do với `thueDong`/`tienSauThueDong` bên dưới.
   */
  tlCktm: number;
  thueSuat: string;
  /** Mã tính chất dòng hàng (tchat): 1 hàng hóa, 2 khuyến mại, 3 chiết khấu, 4 ghi chú. */
  tinhChat: string;
  /**
   * Tiền thuế của DÒNG hàng, nguyên tệ. Khác `thue` (tổng thuế của cả hóa đơn): cột này theo từng
   * dòng hàng. GDT gần như luôn để trống nên phần lớn là số suy ra — xem `toDetailRows`.
   *
   * KHÔNG optional (khác mọi cột tiền còn lại của `DetailRow`): kế toán yêu cầu nhóm cột thuế/sau
   * thuế LUÔN hiện số — hóa đơn không chịu thuế ("KKKNT", "KCT") là 0 chứ không phải ô trống. Để
   * kiểu `number` ở đây để compiler chặn, thay vì trông chờ mỗi nơi gọi tự nhớ `?? 0`.
   */
  thueDong: number;
  /** Tiền sau thuế của DÒNG hàng, nguyên tệ = `tienChuaThue` + `thueDong`. Luôn là số, xem trên. */
  tienSauThueDong: number;
  /**
   * Đánh dấu dòng ĐẦU TIÊN của mỗi hóa đơn.
   * Các cột tổng tiền (tongTt, tongTtVnd, tongThue, etc.) chỉ hiển thị ở dòng đầu tiên,
   * tránh lặp lại ở mọi dòng hàng của cùng một hóa đơn.
   */
  isFirstRow?: boolean;
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

/**
 * Tiến độ lượt đồng bộ CHẠY NỀN ở BE (GET /gdt/sync/run/status). Lượt đồng bộ dài hàng chục phút
 * nên BE chạy nền + FE poll, thay vì giữ 1 request mở chờ (proxy cắt -> 502).
 * Trạng thái nằm ở BE nên đóng/mở lại dialog vẫn thấy đúng tiến độ.
 */
export interface SyncRunStatus {
  active: boolean;
  /** Bước đang chạy, vd "Bán ra (máy tính tiền) 2026-07-01..2026-07-31". Rỗng khi đã xong. */
  phase: string;
  /** Số dòng GDT đã đi qua (chưa trừ trùng). */
  rows: number;
  saved: number;
  daCo: number;
  boSung: number;
  /** Trang hiện tại trong cửa sổ đang quét (GDT không cho biết tổng số trang). */
  page: number;
  startedAt: number;
  finishedAt?: number;
  cancelled?: boolean;
  /** Lỗi tổng thể của lượt (khác lý do dừng theo từng chiều nằm trong `results[].dien_giai`). */
  error?: string;
  /** sync_log đã ghi (1 dòng/chiều) — dùng hiện toast tóm tắt khi lượt kết thúc. */
  results: SyncResult[];
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
  /** Token đăng nhập GDT (hóa đơn điện tử) hiện có, theo từng MST (tenant). */
  getGdtToken: (mst: string) => string | undefined;
  setGdtToken: (mst: string, token: string) => void;
  /** Bỏ token của ĐÚNG 1 MST — dùng khi công ty đó bị xóa vĩnh viễn. */
  removeGdtToken: (mst: string) => void;
  clearGdtSession: () => void;
}
