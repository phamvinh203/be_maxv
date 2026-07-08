import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { GdtSessionContext } from "./context";

// Token GDT sống ngắn (~5p ở backend) nên chỉ cần tồn tại trong tab hiện tại.
const GDT_TOKENS_KEY = "hddt_gdt_tokens";
const GDT_CURRENT_MST_KEY = "hddt_gdt_current_mst";

function loadGdtTokens(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(GDT_TOKENS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

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

  const getGdtToken = useCallback((mst: string) => gdtTokens[mst], [gdtTokens]);

  const setGdtToken = useCallback((mst: string, token: string) => {
    setGdtTokens((prev) => ({ ...prev, [mst]: token }));
    setCurrentGdtMst(mst);
  }, []);

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
