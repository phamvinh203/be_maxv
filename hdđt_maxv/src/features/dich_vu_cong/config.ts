/** Nhãn 7 ô của bộ lọc — mỗi tab lọc một loại hồ sơ nên chữ khác nhau. */
export interface NhanBoLoc {
  maGiaoDich: string;
  loaiHoSo: string;
  hoSo: string;
  noiNop: string;
  kyTinhThue: string;
  tuNgay: string;
  denNgay: string;
}

/** Nhãn dùng cho hai tab tờ khai — chỉ khác nhau ở cổng nộp, form thì giống hệt. */
const NHAN_TO_KHAI: NhanBoLoc = {
  maGiaoDich: "Mã giao dịch",
  loaiHoSo: "Loại tờ khai",
  hoSo: "Tờ khai",
  noiNop: "Nơi nộp",
  kyTinhThue: "Kỳ tính thuế",
  tuNgay: "Ngày nộp từ",
  denNgay: "Đến ngày",
};

/** Một cột của bảng kết quả tra cứu. */
export interface CotBang {
  /** Khóa đọc dữ liệu từ mỗi dòng; cột `stt` được đánh số tự động. */
  key: string;
  header: string;
  /**
   * Tiêu đề THẬT cổng trả về, dùng để khớp dữ liệu vào đúng cột theo tên (xem
   * `BangHoSo`) — cổng đặt câu chữ khác `header` hiển thị (vd cổng ghi "Mã hồ
   * sơ" nhưng bảng vẫn hiện "Mã giao dịch"). Bỏ trống thì khớp trực tiếp bằng
   * `header`.
   */
  srcHeader?: string;
  /** Bề rộng gợi ý (px). Bỏ trống = để bảng tự co theo nội dung. */
  width?: number;
  align?: "center" | "right";
  /**
   * Cột NÚT HÀNH ĐỘNG (tải file, xem đính kèm, xem thông báo…) thay vì cột dữ liệu văn bản.
   * `BangHoSo` tự nối icon theo `key` và gọi `onAction(key, maHoSo)` khi bấm — thêm cột hành
   * động mới chỉ cần khai ở đây + đăng ký icon trong `BangHoSo`, khỏi sửa vòng lặp render.
   */
  action?: boolean;
}

/**
 * Cột bảng kết quả của hai tab tờ khai — nhãn hiển thị (`header`) giữ nguyên
 * cách đặt tên nội bộ, `srcHeader` khớp sang đúng tiêu đề thật cổng trả về
 * (đối chiếu ngày 2026-08-19). Cột "Tệp đính kèm"/"Thông báo"/"Tải file" đã
 * nối nút hành động (`action: true`) — xem `ICON_HANH_DONG` trong `BangHoSo`.
 */
const COT_TO_KHAI: CotBang[] = [
  { key: "stt", header: "STT", width: 60, align: "center" },
  { key: "maGiaoDich", header: "Mã giao dịch", srcHeader: "Mã hồ sơ" },
  { key: "tenThuTuc", header: "Tên thủ tục hành chính", srcHeader: "Tên TTHC" },
  { key: "toKhaiPhuLuc", header: "Tờ khai / Phụ lục", srcHeader: "Tờ khai" },
  { key: "kyTinhThue", header: "Kỳ tính thuế" },
  { key: "loaiToKhai", header: "Loại tờ khai" },
  { key: "lanNop", header: "Lần nộp", align: "center" },
  { key: "lanBoSung", header: "Lần bổ sung", align: "center", srcHeader: "Lần nộp bổ sung" },
  { key: "ngayNop", header: "Ngày nộp", align: "center" },
  { key: "noiNop", header: "Nơi nộp", srcHeader: "Cơ quan thuế tiếp nhận" },
  {
    key: "trangThai",
    header: "Tiến trình giải quyết hồ sơ (Trạng thái)",
    srcHeader: "Trạng thái",
  },
  {
    key: "tepDinhKem",
    header: "Tệp đính kèm",
    align: "center",
    srcHeader: "Hồ sơ đính kèm",
    action: true,
  },
  { key: "thongBao", header: "Thông báo", align: "center", action: true },
  { key: "taiFile", header: "Tải file", align: "center", action: true },
];

/**
 * Cột bảng kết quả của tab Giấy nộp tiền — mười bảy cột, khác hẳn bảng tờ khai
 * nên khai riêng chứ không cố dùng chung.
 */
const COT_GIAY_NOP_TIEN: CotBang[] = [
  { key: "stt", header: "STT", width: 60, align: "center" },
  { key: "soThamChieu", header: "Số tham chiếu / Mã giao dịch" },
  { key: "maGiaoDichDsChiTiet", header: "Mã giao dịch DS chi tiết" },
  { key: "lanNop", header: "Lần nộp", align: "center" },
  { key: "soGiayNopTien", header: "Số giấy nộp tiền" },
  { key: "soTien", header: "Số tiền", align: "right" },
  { key: "loaiTien", header: "Loại tiền", align: "center" },
  { key: "trangThai", header: "Trạng thái" },
  { key: "soChungTu", header: "Số chứng từ" },
  { key: "ngayLapGnt", header: "Ngày lập GNT", align: "center" },
  { key: "ngayGuiGnt", header: "Ngày gửi GNT", align: "center" },
  { key: "ngayNopThue", header: "Ngày nộp thuế", align: "center" },
  { key: "ngayNopDsChiTiet", header: "Ngày nộp DS chi tiết", align: "center" },
  { key: "hinhThucNop", header: "Hình thức nộp" },
  { key: "nganHang", header: "Ngân hàng" },
  { key: "taiKhoanNganHang", header: "Tài khoản ngân hàng" },
  { key: "taiFile", header: "Tải file", align: "center", action: true },
];

/** Một tab của khu Dịch vụ công. */
export interface TabDvc {
  value: string;
  label: string;
  /** Tiêu đề bộ lọc của tab. */
  tieuDeBoLoc: string;
  nhanBoLoc: NhanBoLoc;
  /** Cột bảng kết quả — mọi tab đều phải khai. */
  cotBang: CotBang[];
}

/**
 * Ba loại hồ sơ của khu Dịch vụ công.
 *
 * Mỗi tab khai đủ nhãn bộ lọc và cột bảng của nó ở đây, nên thêm tab hay đổi
 * cột đều không phải đụng vào `DvcPage`.
 */
export const TAB_DVC: TabDvc[] = [
  {
    value: "to-khai-dvc",
    label: "Tờ khai (Dịch vụ công)",
    tieuDeBoLoc: "Bộ lọc tờ khai đã được đồng bộ",
    nhanBoLoc: NHAN_TO_KHAI,
    cotBang: COT_TO_KHAI,
  },
  {
    value: "to-khai-thue-dien-tu",
    label: "Tờ khai (Thuế điện tử)",
    tieuDeBoLoc: "Bộ lọc tờ khai đã được đồng bộ",
    nhanBoLoc: NHAN_TO_KHAI,
    cotBang: COT_TO_KHAI,
  },
  {
    value: "giay-nop-tien",
    label: "Giấy nộp tiền",
    tieuDeBoLoc: "Bộ lọc giấy nộp tiền đã được đồng bộ",
    nhanBoLoc: {
      maGiaoDich: "Mã giao dịch",
      loaiHoSo: "Loại giấy nộp tiền",
      hoSo: "Số tham chiếu",
      noiNop: "Ngân hàng nộp",
      kyTinhThue: "Kỳ tính thuế",
      tuNgay: "Ngày nộp từ",
      denNgay: "Đến ngày",
    },
    cotBang: COT_GIAY_NOP_TIEN,
  },
];
