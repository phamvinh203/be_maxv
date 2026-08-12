import { useContext } from "react";
import { HrmContext, type HrmContextValue } from "./store";

/** Truy cập kho HRM. Chỉ dùng trong `mock/hooks/*` — component gọi hook nghiệp vụ. */
export function useHrmStore(): HrmContextValue {
  const ctx = useContext(HrmContext);
  if (!ctx) throw new Error("Hook HRM phải được gọi bên trong <HrmMockProvider>.");
  return ctx;
}
