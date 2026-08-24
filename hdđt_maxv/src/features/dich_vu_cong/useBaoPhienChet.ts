import { useEffect } from "react";

/**
 * Báo lỗi của một `useQuery` lên `onPhienChet` (do `DvcPage` cấp) để nơi đó bỏ khóa phiên DVC nếu
 * BE nói phiên đã chết hẳn — xem `boKhoaNeuPhienChet`.
 *
 * VÌ SAO PHẢI CÓ HOOK RIÊNG: `useQuery` của TanStack v5 KHÔNG còn `onError`, lỗi chỉ nằm trong
 * state nên phải theo dõi bằng effect. Ba dialog đều cần đúng việc này, gom một chỗ thay vì chép
 * effect ba lần — `DialogDongBo` không dùng hook này vì nó là `useMutation`, ở đó `onError` vẫn còn.
 *
 * Dep là CHÍNH object lỗi: mỗi lỗi chỉ báo một lần, không bắn lại mỗi lần render. Điều kiện kèm
 * theo là `onPhienChet` phải ổn định (`useCallback` bên `DvcPage`) — không thì effect chạy lại mỗi
 * render và người dùng ăn một tràng toast.
 */
export function useBaoPhienChet(error: unknown, onPhienChet?: (err: unknown) => void): void {
  useEffect(() => {
    if (error) onPhienChet?.(error);
  }, [error, onPhienChet]);
}
