import { useCallback, useEffect, useLayoutEffect, useState } from "react";

/**
 * Chiều cao PIXEL thật (border-box) của phần tử đang gắn ref, tự cập nhật khi nó đổi kích thước
 * (header xuống 1 hay 2 dòng tùy `webWidth`, đổi cỡ chữ trình duyệt…). Dùng để canh `top` cho hàng
 * dính THỨ HAI (hàng tổng) ngay dưới hàng dính THỨ NHẤT (tiêu đề) — không hardcode số px vì chiều
 * cao đó phụ thuộc dữ liệu (bộ cột), không phải hằng số.
 *
 * ĐO HAI LỚP:
 *  1. `useLayoutEffect` chạy sau MỌI lần render (đồng bộ, ngay khi DOM vừa commit) — nguồn đo CHÍNH,
 *     luôn đúng ngay từ lần render đầu, không phụ thuộc tab có đang compositing hay không (khác
 *     `ResizeObserver`: callback của nó bị trình duyệt HOÃN khi tab ẩn/không hiển thị — DOM đo đúng
 *     nhưng state đứng yên ở 0 nếu chỉ dựa vào lớp này, gặp thật khi debug qua tab ẩn của Claude).
 *  2. `ResizeObserver` bắt các lần đổi cỡ KHÔNG kèm re-render của component (đổi cỡ chữ trình duyệt,
 *     zoom…) — lớp bổ sung, không phải nguồn đo duy nhất.
 *
 * Không khai deps `[]` cho `useLayoutEffect` — CỐ Ý chạy lại mỗi render để bắt kịp mọi thay đổi
 * (đổi `columns` theo chiều, nội dung tiêu đề đổi làm chữ xuống dòng khác đi…). Không lặp vô hạn:
 * `setHeight` chỉ gọi khi số đo THẬT sự đổi, nên khi đã ổn định thì effect không tạo state mới nữa.
 *
 * Trả về REF DẠNG CALLBACK (không phải `RefObject`) — cố ý: phần tử gắn ref có thể mount MUỘN hơn
 * lần commit đầu (vd bảng "Chi tiết" còn đang `loading` lúc mount, hàng tiêu đề chỉ xuất hiện sau khi
 * tải xong). Ref callback chạy lại MỖI LẦN phần tử gắn/tháo, nên đưa được node vào state (`setNode`)
 * để `useEffect` (lớp 2, `ResizeObserver`) coi nó là dependency thật — gắn lại quan sát đúng lúc phần
 * tử mount muộn, thay vì chỉ thử gắn một lần lúc component mount rồi bỏ cuộc nếu khi đó ref còn null
 * (bug thật đã gặp: `RefObject` + `useEffect([])` khiến `ResizeObserver` của `InvoiceDetailPanel`
 * không bao giờ gắn được, vì hàng tiêu đề chưa tồn tại ở lần effect chạy đầu tiên lúc còn `loading`).
 */
export function useElementHeight<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null);
  const ref = useCallback((el: T | null) => setNode(el), []);
  const [height, setHeight] = useState(0);

  // Đo DOM (hệ thống NGOÀI React) rồi đồng bộ vào state — đúng pattern tài liệu React khuyến nghị
  // cho `useLayoutEffect`, không phải state đồng bộ state; 2 rule dưới false-positive với chính việc
  // đo kích thước phần tử. Mỗi rule bị báo Ở ĐÚNG DÒNG khác nhau (`exhaustive-deps` tại lời gọi
  // `useLayoutEffect`, `set-state-in-effect` tại chính lời gọi `setHeight`) nên phải tắt riêng từng
  // dòng — gộp chung 1 `eslint-disable-next-line` phía trên chỉ tắt được dòng ngay sát nó.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- cố ý chạy mỗi render, xem doc hàm ở trên
  useLayoutEffect(() => {
    const measured = node?.getBoundingClientRect().height;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- xem giải thích ngay phía trên
    if (measured !== undefined && measured !== height) setHeight(measured);
  });

  useEffect(() => {
    if (!node) return;
    const observer = new ResizeObserver(() => setHeight(node.getBoundingClientRect().height));
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return [ref, height] as const;
}
