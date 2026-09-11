-- vbsec 2026-09-10 (MEDIUM, auth.controller.ts:98): phiên đăng nhập phía server.
--
-- Đăng xuất trước đây chỉ xóa cookie, refresh token 7 ngày tự gia hạn mãi -> token bị lộ vẫn dùng được
-- sau khi người dùng đăng xuất. Bảng này giữ jti HIỆN HÀNH của từng phiên: đăng xuất thu hồi phiên,
-- refresh token cũ (đã bị xoay) bị dùng lại -> hủy cả phiên. Chỉ THÊM bảng, không đụng dữ liệu cũ.

-- CreateTable
CREATE TABLE "refresh_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "jtiTruoc" TEXT,
    "xoayLuc" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "refresh_sessions_userId_idx" ON "refresh_sessions"("userId");

-- AddForeignKey
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
