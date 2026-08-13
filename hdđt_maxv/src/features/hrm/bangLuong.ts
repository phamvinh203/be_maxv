/**
 * Bộ tính bảng lương — thuần, không phụ thuộc React.
 *
 * Tách khỏi hook để chỗ ráp dữ liệu (`mock/hooks/bangLuong.ts`) chỉ lo gom
 * nguồn, còn công thức nằm một chỗ đọc được từ trên xuống. Mọi con số của bảng
 * lương đều ra từ đây.
 */

import type { BacThue, CauHinhMacDinh, CheDoHienThi, DongBangLuong } from "./types";

/**
 * Thuế TNCN lũy tiến từng phần.
 *
 * `khoang` của mỗi bậc là **độ rộng** của bậc đó (bậc 1 rộng đúng bằng mức chịu
 * thuế tối đa của nó), riêng bậc cuối để `0` nghĩa là ôm hết phần còn lại — xem
 * ghi chú ở `BacThue`.
 */
export function thueLuyTien(thuNhapTinhThue: number, bacThue: BacThue[]): number {
  let conLai = Math.max(0, thuNhapTinhThue);
  let thue = 0;
  for (const bac of bacThue) {
    if (conLai <= 0) break;
    const rong = bac.khoang > 0 ? bac.khoang : conLai;
    const phan = Math.min(conLai, rong);
    thue += (phan * bac.thue_suat) / 100;
    conLai -= phan;
  }
  return Math.round(thue);
}

/** Dữ liệu một nhân viên, đã gom từ mọi nguồn, để đưa vào công thức. */
export interface NguonTinhLuong {
  ma_nv: string;
  ho_ten: string;
  ten_pb: string;
  ten_cv: string;
  loai_hd: DongBangLuong["loai_hd"];
  kieu_luong: DongBangLuong["kieu_luong"];
  so_npt: number;
  cong_doan: boolean;

  /** Tổng mức tháng các khoản cố định (lương/phụ cấp + hỗ trợ). */
  luong_co_dinh: number;
  /** Phần của `luong_co_dinh` bị quy đổi theo ngày/giờ công. */
  luong_theo_cong: number;
  /**
   * Khoản **miễn thuế** trả trọn tháng, không phụ thuộc công.
   *
   * Tách khỏi `mien_thue_theo_cong` vì hai nhóm bị cắt theo hai cách khác nhau
   * khi thiếu công; gộp lại thì gốc tính thuế sai đúng bằng phần chênh đó.
   */
  mien_thue_co_dinh: number;
  /** Khoản miễn thuế bị quy đổi theo ngày/giờ công (tiền cơm, phụ cấp độc hại…). */
  mien_thue_theo_cong: number;

  ngay_cong: number;
  ngay_cong_chuan: number;
  gio_cong_chuan_ngay: number;
  gio_tang_ca: number;
  gio_quy_doi: number;

  luong_san_pham: number;
  thuong: number;
  kpi: number;
  luong_phan_tram: number;
  chuyen_can: number;
  bu_tru: number;

  /** Gốc đóng bảo hiểm theo hợp đồng; `0` = không tham gia. */
  luong_bhxh: number;
  /** Hợp đồng có tính thuế TNCN không. */
  tinh_tncn: boolean;
}

/**
 * Tính một dòng bảng lương.
 *
 * Thứ tự các bước đúng như cách bảng lương giấy được lập: quy lương theo công →
 * cộng các khoản phát sinh → trừ bảo hiểm và công đoàn → tính thuế → ra thực
 * lĩnh. Đổi thứ tự là ra số khác, vì bảo hiểm được trừ **trước** khi tính thuế.
 */
export function tinhDongBangLuong(
  nguon: NguonTinhLuong,
  cauHinh: CauHinhMacDinh,
): DongBangLuong {
  // Thiếu công thì chỉ phần lương tính theo công bị cắt; phụ cấp cố định tháng
  // giữ nguyên — đó là ý nghĩa của `tieu_thuc` khai ở Cấu trúc lương.
  const tyLeCong =
    nguon.ngay_cong_chuan > 0 ? Math.min(nguon.ngay_cong / nguon.ngay_cong_chuan, 1) : 0;
  const phanCoDinh = nguon.luong_co_dinh - nguon.luong_theo_cong;
  const luongTheoNgay = Math.round(phanCoDinh + nguon.luong_theo_cong * tyLeCong);

  // Đơn giá giờ lấy trên phần lương tính theo công, chia cho quỹ giờ chuẩn của
  // tháng. Giờ quy đổi đã nhân hệ số tăng ca ở màn Tăng ca nên không nhân lại.
  const quyGioChuan = nguon.ngay_cong_chuan * nguon.gio_cong_chuan_ngay;
  const donGiaGio = quyGioChuan > 0 ? nguon.luong_theo_cong / quyGioChuan : 0;
  const tienTangCa = Math.round(nguon.gio_quy_doi * donGiaGio);

  const thuNhap =
    luongTheoNgay +
    tienTangCa +
    nguon.luong_san_pham +
    nguon.thuong +
    nguon.kpi +
    nguon.luong_phan_tram +
    nguon.chuyen_can;

  const baoHiem = Math.round(
    (nguon.luong_bhxh * (cauHinh.bhxh_nv + cauHinh.bhyt_nv + cauHinh.bhtn_nv)) / 100,
  );
  const baoHiemCt = Math.round(
    (nguon.luong_bhxh * (cauHinh.bhxh_ct + cauHinh.bhyt_ct + cauHinh.bhtn_ct)) / 100,
  );

  // Đoàn phí có trần theo lương cơ sở — người lương cao không đóng vô hạn.
  const congDoan = nguon.cong_doan
    ? Math.min(
        Math.round((nguon.luong_bhxh * cauHinh.doan_phi_nv) / 100),
        cauHinh.tran_co_so_doan_phi,
      )
    : 0;
  // Kinh phí công đoàn công ty nộp trên quỹ lương đóng bảo hiểm, không phụ
  // thuộc nhân viên có vào công đoàn hay không.
  const kpcdCt = Math.round((nguon.luong_bhxh * cauHinh.kinh_phi_cong_doan_ct) / 100);

  // Khoản miễn thuế bị cắt theo đúng cách mà chính khoản đó được trả: phần trả
  // trọn tháng giữ nguyên, phần tính theo công thì nhân tỷ lệ công. Miễn trọn
  // mức cho người nghỉ nửa tháng là khai thiếu thu nhập chịu thuế.
  const mienThue = Math.round(
    nguon.mien_thue_co_dinh + nguon.mien_thue_theo_cong * tyLeCong,
  );
  const thuNhapChiuThue = Math.max(0, thuNhap - mienThue);

  const giamTru =
    cauHinh.giam_tru_ban_than + nguon.so_npt * cauHinh.giam_tru_npt + baoHiem + congDoan;
  const thueTncn = nguon.tinh_tncn
    ? thueLuyTien(thuNhapChiuThue - giamTru, cauHinh.bac_thue)
    : 0;

  const thucLinh = thuNhap - baoHiem - congDoan - thueTncn - nguon.bu_tru;

  return {
    ma_nv: nguon.ma_nv,
    ho_ten: nguon.ho_ten,
    ten_pb: nguon.ten_pb,
    ten_cv: nguon.ten_cv,
    loai_hd: nguon.loai_hd,
    kieu_luong: nguon.kieu_luong,
    so_npt: nguon.so_npt,

    luong: nguon.luong_co_dinh,
    ngay_cong: nguon.ngay_cong,
    ngay_cong_chuan: nguon.ngay_cong_chuan,
    gio_tang_ca: nguon.gio_tang_ca,
    gio_quy_doi: nguon.gio_quy_doi,
    tien_tang_ca: tienTangCa,
    luong_theo_ngay: luongTheoNgay,
    luong_san_pham: nguon.luong_san_pham,
    thuong: nguon.thuong,
    kpi: nguon.kpi,
    luong_phan_tram: nguon.luong_phan_tram,
    chuyen_can: nguon.chuyen_can,

    thu_nhap: thuNhap,
    thu_nhap_chiu_thue: thuNhapChiuThue,
    luong_bhxh: nguon.luong_bhxh,
    bao_hiem: baoHiem,
    bao_hiem_ct: baoHiemCt,
    cong_doan: congDoan,
    kpcd_ct: kpcdCt,
    bu_tru: nguon.bu_tru,
    thue_tncn: thueTncn,
    // Thực lĩnh có thể âm khi tạm ứng lớn hơn lương kỳ này — giữ nguyên số âm
    // thay vì kẹp về 0, vì đó là khoản còn nợ phải thu tiếp ở kỳ sau.
    thuc_linh: thucLinh,
    quy_luong: thuNhap + baoHiemCt + kpcdCt,
  };
}

/** Ba con số ở đầu màn hình. */
export interface TongBangLuong {
  quy_luong: number;
  thuc_linh: number;
  thue_tncn: number;
}

export function tongBangLuong(rows: DongBangLuong[]): TongBangLuong {
  return rows.reduce<TongBangLuong>(
    (tong, row) => ({
      quy_luong: tong.quy_luong + row.quy_luong,
      thuc_linh: tong.thuc_linh + row.thuc_linh,
      thue_tncn: tong.thue_tncn + row.thue_tncn,
    }),
    { quy_luong: 0, thuc_linh: 0, thue_tncn: 0 },
  );
}

/** Ước số và hậu tố của từng chế độ hiển thị. */
export const CHE_DO_HIEN_THI: {
  value: CheDoHienThi;
  label: string;
  chia: number;
  hauTo: string;
}[] = [
  { value: "dong", label: "Đồng", chia: 1, hauTo: "₫" },
  { value: "nghin", label: "Nghìn đồng", chia: 1000, hauTo: "K" },
  { value: "trieu", label: "Triệu đồng", chia: 1_000_000, hauTo: "tr" },
];

/**
 * Số tiền theo chế độ đang chọn, **không** kèm hậu tố.
 *
 * Hậu tố ghi một lần ở tiêu đề cột chứ không lặp ở từng ô: 18 cột × mấy chục
 * dòng mà ô nào cũng có "₫" thì mắt không còn dóng được theo cột số.
 */
export function tienTheoCheDo(so: number, cheDo: CheDoHienThi): string {
  const moTa = CHE_DO_HIEN_THI.find((item) => item.value === cheDo) ?? CHE_DO_HIEN_THI[0]!;
  if (moTa.chia === 1) return so.toLocaleString("vi-VN");
  return (so / moTa.chia).toLocaleString("vi-VN", { maximumFractionDigits: 1 });
}

export function hauToCheDo(cheDo: CheDoHienThi): string {
  return (CHE_DO_HIEN_THI.find((item) => item.value === cheDo) ?? CHE_DO_HIEN_THI[0]!).hauTo;
}
