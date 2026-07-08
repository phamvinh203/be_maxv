import { createContext } from "react";

export interface GdtSessionContextValue {
  /** MST vừa đăng nhập GDT gần nhất — dùng làm "phiên đang thao tác" khi chưa có UI chọn tenant. */
  currentGdtMst: string | null;
  /** Token đăng nhập GDT (hóa đơn điện tử) hiện có, theo từng MST (tenant). */
  getGdtToken: (mst: string) => string | undefined;
  setGdtToken: (mst: string, token: string) => void;
  clearGdtSession: () => void;
}

export const GdtSessionContext = createContext<GdtSessionContextValue | null>(null);
