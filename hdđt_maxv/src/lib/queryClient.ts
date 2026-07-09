import { QueryClient } from "@tanstack/react-query";

/**
 * QueryClient dùng chung cho toàn app.
 * - staleTime 30s: dữ liệu coi là "tươi" trong 30s, tránh refetch dồn khi đổi tab/nhả focus.
 * - retry 1: lỗi API thường là lỗi nghiệp vụ (401/403/400), không nên retry nhiều lần.
 * - refetchOnWindowFocus false: tránh gọi lại API mỗi lần chuyển cửa sổ (nhất là API GDT).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
