import type {
  CachKhauTru,
  LoaiLaoDongThue,
  NhomXuLyThue,
  PhuongPhapTinhThue,
  TrangThaiToKhai,
} from "../../types/toKhaiThue";

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

/** Tên người nhận kèm mã nhân viên, hoặc ghi rõ là người vãng lai. */
export function tenNguoiNhan(hoTen: string, maNv: string | null): string {
  return maNv ? `${hoTen} (${maNv})` : `${hoTen} — vãng lai`;
}
