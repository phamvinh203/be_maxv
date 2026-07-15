/**
 * Ánh xạ payload chi tiết GDT (cột `detail`) -> `InvoiceView` để dựng "tờ hóa đơn GTGT" theo bố cục
 * bản in chính thức của Tổng cục Thuế (component `InvoiceViewDialog`). Dùng `pick()` phòng GDT đổi
 * tên field (giống `detailRow.ts`). Chỉnh danh sách key ứng viên Ở ĐÂY nếu tên field GDT thực tế lệch.
 */

/** Ép về string an toàn (null/undefined -> ""). */
function s(v: unknown): string {
  return v == null ? "" : String(v);
}

/** Ép về number; rỗng/không phải số -> undefined (để ô tiền hiện trống thay vì 0/NaN). */
function num(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

/** Lấy field đầu tiên có giá trị trong danh sách key ứng viên (GDT đôi khi đổi tên field). */
function pick(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

/** Nhãn "Tính chất" dòng hàng theo mã `tchat` GDT (1 hàng hóa, 2 khuyến mại, 3 chiết khấu, 4 ghi chú). */
export function tinhChatLabel(code: string): string {
  switch (code) {
    case "1":
      return "Hàng hóa, dịch vụ";
    case "2":
      return "Khuyến mại";
    case "3":
      return "Chiết khấu thương mại";
    case "4":
      return "Ghi chú/Diễn giải";
    default:
      return code;
  }
}

/** Bên bán trên tờ hóa đơn. */
export interface InvoiceViewSeller {
  ten: string;
  mst: string;
  maCuaHang: string;
  tenCuaHang: string;
  diaChi: string;
  dienThoai: string;
  soTaiKhoan: string;
}

/** Bên mua trên tờ hóa đơn. */
export interface InvoiceViewBuyer {
  /** Tên đơn vị (nmten). */
  ten: string;
  /** Họ tên người mua hàng (nmtnmua). */
  tenNguoiMua: string;
  mst: string;
  /** Mã ĐV có quan hệ ngân sách nhà nước. */
  maDvqhns: string;
  cccd: string;
  hoChieu: string;
  diaChi: string;
  soTaiKhoan: string;
}

/** 1 dòng hàng hóa/dịch vụ (mảng `hdhhdvu`). */
export interface InvoiceViewItem {
  /** Mã tính chất GDT (1..4) — render nhãn qua `tinhChatLabel`. */
  tinhChat: string;
  /** Loại hàng hóa đặc trưng (thường rỗng). */
  loaiDacTrung: string;
  tenHang: string;
  dvt: string;
  soLuong?: number;
  donGia?: number;
  chietKhau?: number;
  thueSuat: string;
  /** Thành tiền chưa có thuế GTGT. */
  thanhTien?: number;
}

/** 1 dòng bảng tổng hợp theo thuế suất (mảng `thttltsuat`). */
export interface InvoiceViewTaxLine {
  thueSuat: string;
  tienChuaThue?: number;
  tienThue?: number;
}

/** Dữ liệu 1 tờ hóa đơn GTGT đã chuẩn hóa để render. */
export interface InvoiceView {
  mauSo: string;
  kyHieu: string;
  soHd: string;
  ngayLap: string;
  /** Ngày ký (nky) — cho ô chữ ký số. */
  ngayKy: string;
  /** Mã của cơ quan thuế (nếu có). */
  maCqt: string;
  hinhThucTt: string;
  /** Đơn vị tiền tệ (VND/USD...). */
  maNt: string;
  tyGia?: number;
  soBangKe: string;
  ngayBangKe: string;
  seller: InvoiceViewSeller;
  buyer: InvoiceViewBuyer;
  items: InvoiceViewItem[];
  taxLines: InvoiceViewTaxLine[];
  /** Tổng tiền chưa thuế. */
  tongTienHang?: number;
  /** Tổng tiền thuế GTGT. */
  tongTienThue?: number;
  tongPhi?: number;
  /** Tổng tiền chiết khấu thương mại. */
  tongChietKhau?: number;
  /** Tổng tiền thanh toán (bằng số). */
  tongThanhToan?: number;
  /** Số tiền viết bằng chữ (GDT trả sẵn — không tự tính). */
  bangChu: string;
  trangThaiHd: string;
  ketQuaKt: string;
}

/** Map 1 phần tử mảng hàng hóa `hdhhdvu` -> dòng hiển thị. */
function toItem(raw: unknown): InvoiceViewItem {
  const it = (raw ?? {}) as Record<string, unknown>;
  return {
    tinhChat: s(pick(it, "tchat", "tinhchat")),
    loaiDacTrung: s(pick(it, "lthhdv", "loaihhdv", "ldactrung")),
    tenHang: s(pick(it, "ten", "thang")),
    dvt: s(pick(it, "dvtinh", "dvt")),
    soLuong: num(pick(it, "sluong", "soluong")),
    donGia: num(pick(it, "dgia", "dongia")),
    chietKhau: num(pick(it, "stckhau", "tienck", "stchietkhau")),
    thueSuat: s(pick(it, "ltsuat", "tsuat", "thuesuat")),
    thanhTien: num(pick(it, "thtien", "thanhtien")),
  };
}

/** Map 1 phần tử mảng thuế suất `thttltsuat` -> dòng tổng hợp thuế. */
function toTaxLine(raw: unknown): InvoiceViewTaxLine {
  const t = (raw ?? {}) as Record<string, unknown>;
  return {
    thueSuat: s(pick(t, "ltsuat", "tsuat", "thuesuat")),
    tienChuaThue: num(pick(t, "thtien", "tgtien")),
    tienThue: num(pick(t, "tthue", "sthue")),
  };
}

/**
 * Chuyển payload chi tiết GDT -> `InvoiceView`. Trả `null` nếu payload rỗng (hóa đơn chưa tải chi tiết).
 *
 * GHI CHÚ ÁNH XẠ (chỉnh Ở ĐÂY nếu tên field GDT thực tế lệch):
 *  - Header: khmshdon (mẫu số), khhdon (ký hiệu), shdon (số), tdlap (ngày lập), nky (ngày ký),
 *    mhso/mcqt (mã CQT).
 *  - Bên bán: nbten, nbmst, nbdchi, nbsdthoai, nbstkhoan; mã/tên cửa hàng thường rỗng.
 *  - Bên mua: nmten (đơn vị), nmtnmua (người mua), nmmst, nmdchi, nmstkhoan; ĐVQHNS/CCCD/hộ chiếu
 *    thường rỗng.
 *  - Thanh toán/tiền tệ: thtttoan, dvtte, tgia; bảng kê thường rỗng.
 *  - Tổng: tgtcthue, tgtthue, tgtphi, ttcktmai, tgtttbso, tgtttbchu (bằng chữ).
 *  - Mảng: hdhhdvu (hàng hóa: tchat, ten, dvtinh, sluong, dgia, stckhau, ltsuat, thtien),
 *    thttltsuat (tổng hợp theo thuế suất).
 */
export function toInvoiceView(
  detail: Record<string, unknown> | null | undefined,
): InvoiceView | null {
  if (!detail) return null;

  const items = Array.isArray(detail.hdhhdvu) ? detail.hdhhdvu : [];
  const taxLines = Array.isArray(detail.thttltsuat) ? detail.thttltsuat : [];

  return {
    mauSo: s(detail.khmshdon),
    kyHieu: s(detail.khhdon),
    soHd: s(detail.shdon),
    ngayLap: s(detail.tdlap),
    ngayKy: s(pick(detail, "nky", "tgian", "ntao")),
    maCqt: s(pick(detail, "mhso", "mcqt", "macqt", "mhdon")),
    hinhThucTt: s(pick(detail, "thtttoan", "htttoan")),
    maNt: s(pick(detail, "dvtte", "mnt")),
    tyGia: num(detail.tgia),
    soBangKe: s(pick(detail, "sbke", "sobangke")),
    ngayBangKe: s(pick(detail, "nbke", "ngaybangke")),
    seller: {
      ten: s(detail.nbten),
      mst: s(detail.nbmst),
      maCuaHang: s(pick(detail, "nbmcuahang", "macuahang", "mchang")),
      tenCuaHang: s(pick(detail, "nbtcuahang", "tencuahang", "tchang")),
      diaChi: s(detail.nbdchi),
      dienThoai: s(pick(detail, "nbsdthoai", "nbdthoai")),
      soTaiKhoan: s(pick(detail, "nbstkhoan", "nbstk")),
    },
    buyer: {
      ten: s(detail.nmten),
      tenNguoiMua: s(pick(detail, "nmtnmua", "nmnmua")),
      mst: s(detail.nmmst),
      maDvqhns: s(pick(detail, "nmmdvqhnsach", "mdvqhnsach", "dvqhns")),
      cccd: s(pick(detail, "nmcccd", "cccd")),
      hoChieu: s(pick(detail, "nmhchieu", "shochieu", "hochieu")),
      diaChi: s(detail.nmdchi),
      soTaiKhoan: s(pick(detail, "nmstkhoan", "nmstk")),
    },
    items: items.map(toItem),
    taxLines: taxLines.map(toTaxLine),
    tongTienHang: num(detail.tgtcthue),
    tongTienThue: num(detail.tgtthue),
    tongPhi: num(detail.tgtphi),
    tongChietKhau: num(detail.ttcktmai),
    tongThanhToan: num(detail.tgtttbso),
    bangChu: s(pick(detail, "tgtttbchu", "tgttienchu")),
    trangThaiHd: s(detail.tthai),
    ketQuaKt: s(detail.ttxly),
  };
}
