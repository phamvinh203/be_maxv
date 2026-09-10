/**
 * Bộ hàm THUẦN HIỂN THỊ của bảng lương — thuần, không phụ thuộc React.
 *
 * 🔴 [2026-09-10] Toàn bộ CÔNG THỨC tính lương/thuế/bảo hiểm (`tinhDongBangLuong`, `thueLuyTien`,
 * `lyDoKhongTinhDuocLuong`, `NguonTinhLuong`) đã bị XÓA khỏi file này — nghiệp vụ đó giờ chạy
 * thật ở `be_maxv` (`payrollCalculation.service.ts`, pipeline 10 bước theo ADR-010) và trả về
 * qua `GET /payroll/calculate`. Adapter đọc API thật nằm ở
 * `api/bang_luong/bangLuongQueries.ts` — ĐỪNG dựng lại công thức tính thuế/bảo hiểm ở FE dưới
 * bất kỳ tên hàm nào, đó là nhân đôi nghiệp vụ với nguồn sự thật ở BE (rủi ro hai nơi tính ra
 * hai số khác nhau).
 *
 * Những gì CÒN LẠI ở đây là hàm **format hiển thị thuần** — không tính lại số tiền, chỉ đổi cách
 * trình bày con số BE đã tính sẵn (Đồng/Nghìn/Triệu) và cộng dồn để ra ba thẻ tổng đầu màn hình.
 */

import type { CheDoHienThi, DongBangLuong } from "../../types";

/** Ba con số ở đầu màn hình — cộng dồn từ các dòng ĐÃ TÍNH SẴN, không tính lại gì thêm. */
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
