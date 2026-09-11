import { useEffect } from "react";

/**
 * Chặn F5/đóng tab khi bảng đang soạn còn nội dung chưa "Áp dụng" (RVW-707).
 *
 * Bảng nháp của 7 Panel (KPI, Thưởng, Bù trừ, Lương sản phẩm, Lương phần trăm,
 * Tăng ca, Chuyên cần) chỉ sống trong `useState` — rời trang giữa chừng (F5,
 * đóng tab, bấm back) mất trắng mà không có cảnh báo nào ngoài 1 chip thụ động.
 * Dùng chung cho cả 7 Panel thay vì chép API `beforeunload` 7 lần.
 */
export function useCanhBaoRoiTrang(coThayDoi: boolean): void {
  useEffect(() => {
    if (!coThayDoi) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Chuẩn cũ của Chrome/Firefox cần gán `returnValue` — bỏ dòng này thì một
      // số trình duyệt không hiện hộp thoại xác nhận.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [coThayDoi]);
}
