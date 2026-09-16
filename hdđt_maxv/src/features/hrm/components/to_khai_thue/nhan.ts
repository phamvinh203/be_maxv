import type {
  CachKhauTru,
  LoaiLaoDongThue,
  NhomXuLyThue,
  PhuongPhapTinhThue,
  TrangThaiToKhai,
} from "../../types/toKhaiThue";
import { LOAI_HD } from "../../_shared/constants";

/**
 * Nhãn tiếng Việt cho các mã enum của cụm Tờ khai thuế TNCN — MỘT chỗ duy nhất cho cả 4 màn.
 * Chép nhãn sang từng màn là cách nhanh nhất để hai màn nói hai kiểu về cùng một con số.
 */

export const NHAN_NHOM_XU_LY: Record<NhomXuLyThue, string> = {
  EXEMPT_FULL: "Miễn thuế toàn bộ",
  EXEMPT_CAPPED: "Miễn thuế theo trần",
  TAXABLE_FULL: "Chịu thuế toàn bộ",
  WITHHOLDING_FLAT: "Khấu trừ tại nguồn",
};

export const NHAN_CACH_KHAU_TRU: Record<CachKhauTru, string> = {
  PROGRESSIVE: "Lũy tiến cùng lương",
  FLAT_10: "Khấu trừ 10%",
  FLAT_20: "Khấu trừ 20%",
  EXEMPT_COMMIT: "Cam kết 08 — không khấu trừ",
  NO_DEDUCTION: "Không khấu trừ",
};

export const NHAN_LOAI_LAO_DONG: Record<LoaiLaoDongThue, string> = {
  HOP_DONG_3_THANG_TRO_LEN: "Hợp đồng từ 3 tháng",
  THOI_VU_THU_VIEC: "Thời vụ / thử việc",
  VANG_LAI: "Vãng lai",
};

export const NHAN_PHUONG_PHAP_TINH: Record<PhuongPhapTinhThue, string> = {
  LUY_TIEN: "Lũy tiến từng phần",
  KHAU_TRU_10: "Khấu trừ 10%",
  KHAU_TRU_20: "Khấu trừ 20%",
  CAM_KET_08: "Cam kết 08",
  DUOI_NGUONG: "Dưới ngưỡng khấu trừ",
};

export const NHAN_TRANG_THAI_TO_KHAI: Record<TrangThaiToKhai, string> = {
  CHUA_SAN_SANG: "Chưa sẵn sàng",
  READY_TO_EXPORT: "Sẵn sàng xuất",
  EXPORTED: "Đã xuất",
  SUBMITTED: "Đã nộp",
};

/** Màu chip theo trạng thái tờ khai — dùng chung để 4 màn không tô mỗi nơi một kiểu. */
export const MAU_TRANG_THAI_TO_KHAI: Record<
  TrangThaiToKhai,
  "default" | "info" | "warning" | "success"
> = {
  CHUA_SAN_SANG: "default",
  READY_TO_EXPORT: "info",
  EXPORTED: "warning",
  SUBMITTED: "success",
};

/**
 * Loại hợp đồng — dùng LẠI danh sách của cụm hồ sơ nhân viên, không chép nhãn sang đây: hai nơi
 * gọi cùng một mã hợp đồng bằng hai tên khác nhau là lỗi người đọc phát hiện sau cùng.
 * Máy chủ trả chữ tự do nên mã lạ thì hiện nguyên mã, không nuốt thành trống.
 */
const NHAN_LOAI_HD = new Map(LOAI_HD.map((o) => [o.value as string, o.label]));

export function nhanLoaiHopDong(ma: string | null): string {
  if (!ma) return "—";
  return NHAN_LOAI_HD.get(ma) ?? ma;
}

/** Máy chủ lưu `gross` | `net` chữ thường; bảng hiện chữ hoa cho dễ quét mắt. */
export function nhanKieuLuong(ma: string | null): string {
  if (!ma) return "—";
  return ma.toLowerCase() === "net" ? "NET" : ma.toLowerCase() === "gross" ? "GROSS" : ma;
}

/**
 * "Diện thuế" của bảng tính thuế — gộp phương pháp tính với kiểu lương hợp đồng thành MỘT nhãn,
 * đúng năm diện kế toán dùng khi đọc bảng:
 *
 *   Lũy tiến · NET lũy tiến · Toàn phần · NET toàn phần · Miễn thuế
 *
 * Cam kết 08 và Dưới ngưỡng đều về "Miễn thuế" vì cùng một kết quả: tháng đó không khấu trừ đồng nào.
 * Tiền tố NET chỉ nói hợp đồng ký NET — số quy đổi ở các cột [14]–[16] là việc của đợt sau.
 */
export function nhanDienThue(
  phuongPhap: PhuongPhapTinhThue,
  kieuLuong: string | null,
): string {
  if (phuongPhap === "CAM_KET_08" || phuongPhap === "DUOI_NGUONG") return "Miễn thuế";
  const net = kieuLuong?.toLowerCase() === "net";
  const goc = phuongPhap === "LUY_TIEN" ? "lũy tiến" : "toàn phần";
  return net ? `NET ${goc}` : goc.charAt(0).toUpperCase() + goc.slice(1);
}

/** Tên người nhận kèm mã nhân viên, hoặc ghi rõ là người vãng lai. */
export function tenNguoiNhan(hoTen: string, maNv: string | null): string {
  return maNv ? `${hoTen} (${maNv})` : `${hoTen} — vãng lai`;
}
