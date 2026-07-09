import { useCallback, useState } from "react";
import { useAuth } from "../../auth/useAuth";

/**
 * Trạng thái + hành động đổi công ty đang làm việc — dùng chung cho mọi nơi hiển thị
 * danh sách công ty kèm khả năng bấm để chuyển (AppHeader, CompanyManagementTab...).
 */
export function useCompanySwitch() {
  const { switchCompany } = useAuth();
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const switchTo = useCallback(
    async (id: string) => {
      setError("");
      setSwitchingId(id);
      try {
        await switchCompany(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Không đổi được công ty.");
      } finally {
        setSwitchingId(null);
      }
    },
    [switchCompany],
  );

  const clearError = useCallback(() => setError(""), []);

  return { switchingId, error, switchTo, clearError };
}
