import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { GdtSessionContext } from "./context";

// Token GDT sống ngắn (~5p ở backend) nên chỉ cần tồn tại trong tab hiện tại.
const GDT_TOKENS_KEY = "hddt_gdt_tokens";
const GDT_CURRENT_MST_KEY = "hddt_gdt_current_mst";

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
 * Provider giữ phiên đăng nhập GDT (token theo từng MST + MST đang thao tác) trong
 * sessionStorage. Cấp `getGdtToken`/`setGdtToken`/`clearGdtSession`/`currentGdtMst` cho cây con.
 * Dùng: bọc quanh `AppRouter` ở `main.tsx`; đọc qua hook `useGdtSession`.
 */
export function GdtSessionProvider({ children }: { children: ReactNode }) {
  const [gdtTokens, setGdtTokens] = useState<Record<string, string>>(loadGdtTokens);
  const [currentGdtMst, setCurrentGdtMst] = useState<string | null>(() =>
    sessionStorage.getItem(GDT_CURRENT_MST_KEY),
  );

  // Đồng bộ sessionStorage qua effect (thay vì side effect ngay trong updater của
  // setState, vốn có thể chạy 2 lần dưới StrictMode/concurrent rendering).
  useEffect(() => {
    sessionStorage.setItem(GDT_TOKENS_KEY, JSON.stringify(gdtTokens));
  }, [gdtTokens]);

  useEffect(() => {
    if (currentGdtMst) sessionStorage.setItem(GDT_CURRENT_MST_KEY, currentGdtMst);
    else sessionStorage.removeItem(GDT_CURRENT_MST_KEY);
  }, [currentGdtMst]);

  /** Lấy token GDT của 1 MST (undefined nếu chưa đăng nhập). Dùng: InvoiceTablePanel, SyncInvoiceDialog. */
  const getGdtToken = useCallback((mst: string) => gdtTokens[mst], [gdtTokens]);

  /** Lưu token GDT cho 1 MST + đặt MST đó thành phiên hiện tại. Dùng: CompanyFormDialog (onLoginSuccess). */
  const setGdtToken = useCallback((mst: string, token: string) => {
    setGdtTokens((prev) => ({ ...prev, [mst]: token }));
    setCurrentGdtMst(mst);
  }, []);

  /** Xóa toàn bộ phiên GDT (khi đăng xuất app). Dùng: AppHeader (nút Đăng xuất). */
  const clearGdtSession = useCallback(() => {
    setGdtTokens({});
    setCurrentGdtMst(null);
  }, []);

  const value = useMemo(
    () => ({ currentGdtMst, getGdtToken, setGdtToken, clearGdtSession }),
    [currentGdtMst, getGdtToken, setGdtToken, clearGdtSession],
  );

  return <GdtSessionContext.Provider value={value}>{children}</GdtSessionContext.Provider>;
}
