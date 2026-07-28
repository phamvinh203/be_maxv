import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { GdtSessionContext } from "./context";

// Token GDT sống ngắn (~5p ở backend) nên chỉ cần tồn tại trong tab hiện tại.
const GDT_TOKENS_KEY = "hddt_gdt_tokens";

/**
 * Đọc map token GDT { mst: token } từ sessionStorage; hỏng/không có -> {}.
 * Dùng: nội bộ file này — khởi tạo state `gdtTokens`.
 */
function loadGdtTokens(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(GDT_TOKENS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

/**
 * Provider giữ phiên đăng nhập GDT (token theo từng MST) trong sessionStorage.
 * Dùng: bọc quanh `AppRouter` ở `main.tsx`; đọc qua hook `useGdtSession`.
 *
 * Token dùng khi fetch/đồng bộ luôn chọn theo MST CÔNG TY ĐANG CHỌN (xem `useActiveGdtToken`),
 * KHÔNG lưu "MST GDT hiện tại" ở đây — coupling đó từng gây rò rỉ dữ liệu giữa các tenant.
 */
export function GdtSessionProvider({ children }: { children: ReactNode }) {
  const [gdtTokens, setGdtTokens] = useState<Record<string, string>>(loadGdtTokens);

  // Đồng bộ sessionStorage qua effect (thay vì side effect ngay trong updater của
  // setState, vốn có thể chạy 2 lần dưới StrictMode/concurrent rendering).
  useEffect(() => {
    sessionStorage.setItem(GDT_TOKENS_KEY, JSON.stringify(gdtTokens));
  }, [gdtTokens]);

  /** Lấy token GDT của 1 MST (undefined nếu chưa đăng nhập). Dùng: InvoiceTablePanel, SyncInvoiceDialog. */
  const getGdtToken = useCallback((mst: string) => gdtTokens[mst], [gdtTokens]);

  /** Lưu token GDT cho 1 MST. Dùng: CompanyFormDialog/AppHeader (onLoginSuccess). */
  const setGdtToken = useCallback((mst: string, token: string) => {
    setGdtTokens((prev) => ({ ...prev, [mst]: token }));
  }, []);

  /**
   * Bỏ token của ĐÚNG 1 MST. Dùng: xóa vĩnh viễn công ty — token của MST đã biến mất mà nằm lại
   * sessionStorage thì vô dụng, và sẽ khớp nhầm nếu sau này MST đó được đăng ký lại (xóa cứng cho
   * phép điều đó) trong khi tab chưa đóng.
   */
  const removeGdtToken = useCallback((mst: string) => {
    setGdtTokens((prev) => {
      if (!(mst in prev)) return prev; // giữ nguyên identity -> khỏi ghi lại sessionStorage vô ích
      const rest = { ...prev };
      delete rest[mst];
      return rest;
    });
  }, []);

  /** Xóa toàn bộ phiên GDT (khi đăng xuất app). Dùng: AppHeader (nút Đăng xuất). */
  const clearGdtSession = useCallback(() => {
    setGdtTokens({});
  }, []);

  const value = useMemo(
    () => ({ getGdtToken, setGdtToken, removeGdtToken, clearGdtSession }),
    [getGdtToken, setGdtToken, removeGdtToken, clearGdtSession],
  );

  return <GdtSessionContext.Provider value={value}>{children}</GdtSessionContext.Provider>;
}
