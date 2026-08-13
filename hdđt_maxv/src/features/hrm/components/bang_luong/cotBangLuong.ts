/**
 * Mười tám cột của bảng lương.
 *
 * Bảng trên màn hình **và** file Excel đều đọc danh sách này, nên hai bên không
 * lệch nhau được: thêm một cột là cả hai chỗ cùng có, và số ở file xuất ra luôn
 * đúng thứ tự cột người dùng đang nhìn.
 */

import type { DongBangLuong } from "../../types";

export interface CotBangLuong {
  key: string;
  header: string;
  /** Cột tiền: định dạng theo chế độ hiển thị, tiêu đề có hậu tố đơn vị. */
  tien?: boolean;
  /** Có cộng ở dòng "Tổng cộng" không. Cột tiền và cột giờ thì có, NPT thì không. */
  cong?: boolean;
  align?: "left" | "right" | "center";
  minWidth?: number;
  /** Còn hiện khi chọn mức "Rút gọn". */
  rutGon?: boolean;
  value: (row: DongBangLuong) => number;
  /** Chuỗi cho các cột không phải số (hai cột đầu). */
  text?: (row: DongBangLuong) => string;
}

export const COT_BANG_LUONG: CotBangLuong[] = [
  {
    key: "ho_ten",
    header: "Họ và tên",
    align: "left",
    minWidth: 200,
    rutGon: true,
    value: () => 0,
    text: (row) => row.ho_ten,
  },
  {
    key: "bo_phan",
    header: "Bộ phận/Chức vụ",
    align: "left",
    minWidth: 190,
    rutGon: true,
    value: () => 0,
    text: (row) => [row.ten_pb, row.ten_cv].filter(Boolean).join(" / "),
  },
  { key: "so_npt", header: "NPT", align: "center", minWidth: 60, value: (r) => r.so_npt },
  { key: "luong", header: "Lương", tien: true, cong: true, minWidth: 120, rutGon: true, value: (r) => r.luong },
  { key: "ngay_cong", header: "Ngày công", align: "center", minWidth: 90, value: (r) => r.ngay_cong },
  { key: "gio_tang_ca", header: "Giờ tăng ca", align: "center", cong: true, minWidth: 100, value: (r) => r.gio_tang_ca },
  { key: "tien_tang_ca", header: "Tiền tăng ca", tien: true, cong: true, minWidth: 120, value: (r) => r.tien_tang_ca },
  { key: "luong_theo_ngay", header: "Lương theo ngày", tien: true, cong: true, minWidth: 130, value: (r) => r.luong_theo_ngay },
  { key: "luong_san_pham", header: "Lương theo sản phẩm", tien: true, cong: true, minWidth: 150, value: (r) => r.luong_san_pham },
  { key: "thuong", header: "Thưởng", tien: true, cong: true, minWidth: 110, value: (r) => r.thuong },
  { key: "kpi", header: "KPI", tien: true, cong: true, minWidth: 110, value: (r) => r.kpi },
  { key: "thu_nhap", header: "Thu nhập", tien: true, cong: true, minWidth: 130, rutGon: true, value: (r) => r.thu_nhap },
  { key: "bao_hiem", header: "Bảo hiểm", tien: true, cong: true, minWidth: 120, rutGon: true, value: (r) => r.bao_hiem },
  { key: "cong_doan", header: "Công đoàn", tien: true, cong: true, minWidth: 110, value: (r) => r.cong_doan },
  { key: "kpcd_ct", header: "KPCĐ (cty)", tien: true, cong: true, minWidth: 110, value: (r) => r.kpcd_ct },
  { key: "bu_tru", header: "Các khoản bù trừ", tien: true, cong: true, minWidth: 140, rutGon: true, value: (r) => r.bu_tru },
  { key: "thue_tncn", header: "Thuế TNCN", tien: true, cong: true, minWidth: 120, rutGon: true, value: (r) => r.thue_tncn },
  { key: "thuc_linh", header: "Thực lĩnh", tien: true, cong: true, minWidth: 140, rutGon: true, value: (r) => r.thuc_linh },
];

/** Cột hiện ra theo mức chi tiết đang chọn. */
export function cotTheoMuc(rutGon: boolean): CotBangLuong[] {
  return rutGon ? COT_BANG_LUONG.filter((cot) => cot.rutGon) : COT_BANG_LUONG;
}

/** Tổng của các cột có `cong`, khóa là `key`. */
export function tongTheoCot(
  cot: CotBangLuong[],
  rows: DongBangLuong[],
): Map<string, number> {
  const tong = new Map<string, number>();
  for (const c of cot) {
    if (!c.cong) continue;
    tong.set(
      c.key,
      rows.reduce((cong, row) => cong + c.value(row), 0),
    );
  }
  return tong;
}
