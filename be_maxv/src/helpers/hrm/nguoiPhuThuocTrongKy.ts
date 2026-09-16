/**
 * Người phụ thuộc CÓ HIỆU LỰC giảm trừ trong MỘT kỳ tháng (A-tkt-05).
 *
 * Người phụ thuộc chỉ được giảm trừ cho những tháng nằm trong kỳ đăng ký
 * (`dk_tu_thang/nam` … `dk_den_thang/nam`). Đếm tất cả người phụ thuộc bất kể kỳ đăng ký là
 * giảm trừ cả cho người đăng ký từ năm sau hoặc đã hết hạn — khấu trừ THIẾU thuế.
 *
 * Đặt ở `helpers/hrm/` vì có HAI nơi phải dùng chung một cách đếm: Bảng tính thuế tháng
 * (`to_khai_thue`) và engine lương (`du_lieu_tinh_luong`). Hai nơi đếm khác nhau là hai màn ra
 * hai số thuế khác nhau cho cùng một người.
 *
 * Quy ước khi thiếu tháng: có năm bắt đầu mà không có tháng ⇒ tính từ tháng 1; có năm kết thúc
 * mà không có tháng ⇒ tính hết tháng 12. Không có năm ⇒ không giới hạn phía đó.
 */

export interface KyDangKyNguoiPhuThuoc {
  dk_tu_thang: number | null;
  dk_tu_nam: number | null;
  dk_den_thang: number | null;
  dk_den_nam: number | null;
}

/** So theo chỉ số tháng tuyệt đối `năm × 12 + tháng` — tránh nhánh lồng "cùng năm thì so tháng". */
function chiSoThang(nam: number, thang: number): number {
  return nam * 12 + thang;
}

export function laNguoiPhuThuocHieuLucTrongKy(
  npt: KyDangKyNguoiPhuThuoc,
  nam: number,
  thang: number,
): boolean {
  const ky = chiSoThang(nam, thang);

  if (
    npt.dk_tu_nam !== null &&
    ky < chiSoThang(npt.dk_tu_nam, npt.dk_tu_thang ?? 1)
  ) {
    return false;
  }
  if (
    npt.dk_den_nam !== null &&
    ky > chiSoThang(npt.dk_den_nam, npt.dk_den_thang ?? 12)
  ) {
    return false;
  }
  return true;
}

export function demNguoiPhuThuocTrongKy(
  danhSach: KyDangKyNguoiPhuThuoc[],
  nam: number,
  thang: number,
): number {
  return danhSach.filter((n) => laNguoiPhuThuocHieuLucTrongKy(n, nam, thang))
    .length;
}
