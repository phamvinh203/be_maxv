import { useAuth } from "@/features/auth/useAuth";

/**
 * Khớp `assertAdminOrOwner` của máy chủ — mở chốt bảng kê, khóa sổ / mở lại / duyệt kỳ lương. Chỉ để
 * khóa nút sớm kèm lời giải thích; máy chủ vẫn là bên chặn thật.
 */
export function useLaChuTaiKhoan(): boolean {
  const { user } = useAuth();
  return user?.role === "OWNER" || user?.role === "ADMIN";
}
