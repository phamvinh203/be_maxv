import { useContext } from "react";
import { GdtSessionContext } from "./context";

/**
 * Hook đọc phiên GDT từ context (ném lỗi nếu dùng ngoài `GdtSessionProvider`).
 * Dùng: `InvoiceTablePanel`, `SyncInvoiceDialog`, `CompanyFormDialog`, `AppHeader`.
 */
export function useGdtSession() {
  const ctx = useContext(GdtSessionContext);
  if (!ctx) throw new Error("useGdtSession phải dùng bên trong GdtSessionProvider");
  return ctx;
}
