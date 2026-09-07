---
type: adr
feature: auth
status: accepted
updated: 2026-09-04
---

# ADR-002 — Chiến lược xác thực: JWT access ngắn hạn + session server-side + refresh rotation

## Context

Spec yêu cầu (auth-spec.md):

- Phiên đăng nhập kéo dài, refresh tự động (FR-auth-006) — user hoạt động liên tục không bị văng (BR-auth-004: idle 8 giờ).
- Thu hồi phiên **có hiệu lực thực tế**: logout; đổi/đặt lại mật khẩu revoke phiên khác nhưng giữ phiên hiện tại (BR-auth-009); khóa/vô hiệu hóa user (tự động BR-auth-001 hoặc Admin BR-auth-008) phải chặn được cả phiên đang sống (NFR-auth-005).
- Multi-device hợp lệ — revoke "toàn bộ trừ phiên hiện tại" ngầm hiểu 1 user có nhiều phiên.
- Hạ tầng: Render free tier restart/spin-down mất RAM; đã có PostgreSQL + Prisma (ADR-001); 1 service duy nhất, quy mô nhỏ.
- Frontend deferred — contract phải chuẩn để FE dùng sau (auth-api-contract.md Mục 3).

## Decision

**Hybrid: JWT access token tự xác thực ngắn hạn (15 phút) + Session server-side trong Postgres là nguồn thật + refresh token opaque xoay vòng (rotation) có revoke.**

Chi tiết cơ chế (khớp `auth-architecture.md` Mục 4):

| Thành phần | Thiết kế |
|------------|----------|
| Access token | JWT HS256, TTL 15 phút, claims `sub`/`sid`/`role`/`iss`/`aud`/`iat`/`exp`. `sid` trỏ vào `Session.id` |
| Session | Row `Session` trong Postgres — guard load mỗi request, kiểm tra `revokedAt = null` + `idleExpiresAt > now` + `user.status = ACTIVE`; đọc `user.role` từ DB (không tin claim) |
| Idle 8h (BR-auth-004) | `Session.idleExpiresAt` gia hạn **lười** — chỉ UPDATE khi còn < 4h |
| Refresh token | Opaque 48 byte base64url, DB lưu SHA-256 hash; delivery qua HttpOnly cookie (contract Mục 3) |
| Rotation | Mỗi refresh: revoke token cũ + phát token mới cùng session |
| Reuse detection | Token đã revoked bị dùng lại → revoke toàn bộ session của user + audit `SESSION_REUSE` |
| Revoke tức thì | Logout / đổi mật khẩu / khóa user = UPDATE row Session → request kế tiếp bị guard chặn ngay, không đợi access token hết hạn |

## Alternatives

### A. Session thuần server-side (cookie `sid`, không JWT)

| Ưu | Nhược |
|-----|-------|
| Revoke tức thì tự nhiên (xóa row session); không có token nào nằm ngoài DB | Mỗi request 1 lookup DB bắt buộc (JWT hybrid cũng tra DB cho session nhưng **sai JWT thì chặn trước khi tra**, tiết kiệm verify giả); stateless scaling (nếu sau này nhiều instance) phải chia sẻ session store |
| Đơn giản conceptual | Với API-first + FE sau này dùng mobile/native (OQ mở), JWT ở header chuẩn hơn cookie-only |

### B. JWT thuần stateless (refresh + revoke bằng blacklist)

| Ưu | Nhược |
|-----|-------|
| Không tra DB mỗi request | Revoke cần blacklist → lại sinh state (đã bỏ ý tưởng stateless); blacklist tra DB mỗi request = không còn stateless |
| | "Thu hồi tức thì" với JWT phải đợi hết hạn hoặc blacklist đầy đủ — phức tạp hơn session mà kết quả như nhau |
| | JWT không revoke được an toàn → vi phạm NFR-auth-005 |

### C. JWT + refresh trong DB nhưng KHÔNG session row

| Ưu | Nhược |
|-----|-------|
| Ít 1 bảng | Revoke "trừ phiên hiện tại" (BR-auth-009) cần khái niệm phiên — dùng `sessionId` claim mà không có bảng session là state vô gốc; idle timeout 8h (BR-auth-004) phải tự tính từ refresh token → mỗi lần refresh mới = 1 phiên mới, mất liên tục |

## Trade-offs (phương án chọn)

- **Nhận:** Mỗi request nghiệp vụ có 1 lookup `Session` + `User` theo `sid` (2 query hoặc 1 join). Với quy mô hiện tại (traffic nhỏ, Postgres indexed PK lookup < 1ms), chi phí không đáng kể. Nếu sau này traffic tăng: thêm cache in-process TTL ngắn (10-30s) cho session đã verify — tối ưu có measured, không làm trước.
- **Nhận:** Access token vẫn nằm trong bộ nhớ FE (in-memory hoặc memory + silent refresh qua cookie) — lộ access token chỉ gây hại ≤ 15 phút và hành động nguy hiểm vẫn qua server-side check.
- **Đổi lấy:** Thu hồi tức thì đúng nghĩa (logout/khóa/đổi mật khẩu chặn ngay request kế tiếp); multi-device + revoke-chọn-lượt tự nhiên; Render restart không mất phiên gì (state ở Postgres); reuse detection chống token theft không cần thêm hạ tầng.

## Consequences

- Bảng `Session` + `RefreshToken` trong data-model (Mục 4).
- Env mới: `JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRES`, `SESSION_IDLE_MINUTES`.
- Guard tra DB mỗi request → `JwtAuthGuard` phải hiệu quả (1 query join, indexed PK).
- Cookie delivery + CSRF defense chi tiết ở `auth-api-contract.md` Mục 3.
- 2FA/social login (OQ-1/OQ-2) bổ sung được không đổi strategy — chúng thay đổi cách xác thực ban đầu, sau đó vẫn đi qua Session + RefreshToken giống hệt.
