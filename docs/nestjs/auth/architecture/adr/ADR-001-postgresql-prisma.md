---
type: adr
feature: auth
status: accepted
updated: 2026-09-04
---

# ADR-001 — PostgreSQL + Prisma

## Context

Feature auth cần lưu trữ: user (email, password hash, role, trạng thái khóa), phiên đăng nhập server-side, refresh token + password reset token (lưu hash), audit log append-only giữ 12 tháng (NFR-auth-006). Dữ liệu có quan hệ chặt (User → Session → RefreshToken), cần transaction (login: tạo session + token; reset password: update user + revoke session + mark token), và truy vấn theo nhiều tiêu chí (audit-logs filter theo event/actor/thời gian).

Ràng buộc môi trường:

- Deploy Render free tier — 1 instance, RAM nhỏ, restart/spin-down thường xuyên → không thể giữ state in-memory (Redis không phải lựa chọn, không over-engineer).
- ORM hiện tại chưa có trong repo (`Backend/` mới có NestJS skeleton + health endpoint) — tự do chọn.
- Backend NestJS 12, TypeScript strict, ESM.
- Người dùng đã chốt trước: **PostgreSQL, Prisma** — ADR này ghi lý do + trade-off để hợp lý hóa quyết định, không chọn lại.

## Decision

1. **Database: PostgreSQL 17** (dev qua docker-compose service `db`, image `postgres:17-alpine`; production cần quyết định DB provider — Render free Postgres hết hạn ~30 ngày, ghi chú trong architecture doc Mục 10).
2. **ORM: Prisma** (prisma-client-js) với schema nguồn trong `Backend/prisma/schema.prisma`, migration bằng `prisma migrate dev` (dev) / `migrate deploy` (Render start command).

## Alternatives

### Database

| Phương án | So với PostgreSQL |
|-----------|-------------------|
| **PostgreSQL** ✓ | Hỗ trợ native `jsonb` (AuditLog.detail), enum, partial index, transaction mạnh; Render/Supabase/Neon đều có Postgres managed; Prisma hỗ trợ first-class |
| MySQL 8 | Đủ dùng nhưng `jsonb` yếu hơn (JSON + index kém tiện), enum phải dùng SET/ENUM cột; không có lợi thế nào cho use case này |
| MongoDB | Document store — quan hệ User↔Session↔Token cần join/lookup thủ công, mất FK + transaction range hẹp hơn; audit log query theo filter cần schema thiết kế ngược; sai mô hình dữ liệu cho bài toán quan hệ |

### ORM

| Phương án | So với Prisma |
|-----------|---------------|
| **Prisma** ✓ | Schema declarative đọc được như tài liệu (chính là `auth-data-model.md`); type-safe client sinh tự động (khớp TS strict); `migrate` workflow chuẩn; community lớn, tài liệu tốt |
| TypeORM | Mature, nhưng type-safety rò rỉ nhiều chỗ (relations lazy, query builder không type chặt); pattern decorator + entity trùng lặp; lịch sử issue maintenance lâu dài |
| Drizzle | Type-safe tốt, SQL-like gần DB — nhưng tâm đắc dev "viết SQL tay"; migration + seeding workflow non trẻ hơn; với team ít người và cần speed dev, Prisma cho velocity cao hơn |
| Sequelize | Callback/promise legacy style, TypeScript support yếu nhất trong nhóm — bỏ |

## Trade-offs (Prisma)

- **Nhận:** Prisma client là 1 dependency nặng (~vài MB binary engine); query builder không SQL-native nên query tinh vi (window function, partial index) phải xuống `$queryRaw`.
- **Nhận:** Không hỗ trợ partial index trong DSL (đã dùng B-tree thường ở `Session.revokedAt` — data-model Mục 8).
- **Đổi lấy:** Schema làm nguồn thật (single source), type-safety end-to-end, migration lịch sử trong repo, onboarding nhanh.

## Consequences

- Docker-compose dev thêm service `db` (postgres:17-alpine + volume + healthcheck) — cấu hình trong architecture doc Mục 8.
- Render start command: `npx prisma migrate deploy && node dist/main.js` — migration chỉ áp forward, không tương tác, an toàn free tier 1 instance.
- Env mới: `DATABASE_URL` (xem architecture doc Mục 7 — đầy đủ cho DevOps).
- Seed admin đầu tiên qua `prisma db seed` (idempotent, env `ADMIN_INITIAL_*`).
