/**
 * Tám màn hình con của khu "Dữ liệu tính lương".
 *
 * Để ở file riêng (không nằm trong component) vì cả thanh điều hướng lẫn màn
 * hình chỗ-giữ đều đọc bảng này — thêm hay đổi tên một tab chỉ phải sửa ở đây.
 */

export interface ManHinhDuLieuLuong {
  path: string;
  label: string;
  /** Mô tả ngắn cho màn hình chưa dựng. */
  moTa: string;
}

export const MAN_HINH_DU_LIEU_LUONG: ManHinhDuLieuLuong[] = [
  {
    path: "cham-cong",
    label: "Chấm công",
    moTa: "Bảng công theo ngày của từng nhân viên trong tháng.",
  },
  {
    path: "tang-ca",
    label: "Tăng ca",
    moTa: "Số giờ tăng ca theo từng loại — ngày thường, chủ nhật, ngày lễ, ban ngày và ban đêm.",
  },
  {
    path: "kpi",
    label: "KPI",
    moTa: "Mức hoàn thành chỉ tiêu của từng nhân viên trong kỳ.",
  },
  {
    path: "thuong",
    label: "Thưởng",
    moTa: "Các khoản thưởng phát sinh trong kỳ.",
  },
  {
    path: "luong-san-pham",
    label: "Lương sản phẩm",
    moTa: "Sản lượng đã nghiệm thu và đơn giá từng loại sản phẩm.",
  },
  {
    path: "luong-phan-tram",
    label: "Lương phần trăm",
    moTa: "Doanh số làm gốc và tỷ lệ hoa hồng của từng nhân viên.",
  },
  {
    path: "luong-chuyen-can",
    label: "Lương chuyên cần",
    moTa: "Nhân viên đủ điều kiện nhận chuyên cần trong kỳ.",
  },
  {
    path: "ung-bu-tru",
    label: "Các khoản ứng - bù trừ lương",
    moTa: "Tạm ứng, thu hồi tạm ứng và các khoản bù trừ khác.",
  },
];
