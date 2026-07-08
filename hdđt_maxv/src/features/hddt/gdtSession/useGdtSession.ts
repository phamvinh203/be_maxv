import { useContext } from "react";
import { GdtSessionContext } from "./context";

export function useGdtSession() {
  const ctx = useContext(GdtSessionContext);
  if (!ctx) throw new Error("useGdtSession phải dùng bên trong GdtSessionProvider");
  return ctx;
}
