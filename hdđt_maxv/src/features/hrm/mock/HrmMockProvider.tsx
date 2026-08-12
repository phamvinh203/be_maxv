import { useMemo, useReducer, type ReactNode } from "react";
import { HrmContext, hrmReducer, trangThaiBanDau } from "./store";

/**
 * Bọc quanh khu `/hrm` để ba màn hình dùng chung một kho dữ liệu giả.
 *
 * Khi nối API thật: bỏ provider này khỏi `HrmPage`, viết lại phần thân của các
 * hook trong `mock/hooks.ts` bằng `useQuery`/`useMutation`. Chữ ký hook giữ
 * nguyên nên bảng và form không phải sửa.
 */
export default function HrmMockProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(hrmReducer, trangThaiBanDau);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <HrmContext value={value}>{children}</HrmContext>;
}
