---
type: api-contract
feature: auth
status: draft
updated: 2026-09-04
links:
  - docs/auth/srs/auth-spec.md
  - docs/auth/srs/auth-flows.md
  - docs/auth/srs/auth-states.md
  - docs/auth/auth-prd.md
  - docs/auth/auth-brd.md
  - docs/auth/usecases/auth-usecase-index.md
  - docs/auth/architecture/auth-architecture.md
  - docs/auth/architecture/auth-data-model.md
  - docs/auth/architecture/adr/ADR-002-auth-strategy.md
---

# Auth — API Contract

API contract cho toàn bộ endpoint auth. Tất cả endpoint trả về **JSON thuần**, base URL production `https://hrm-accounting.onrender.com`. Source of truth cho cả backend và frontend (FE deferred — file này là điểm hợp đồng để FE dùng ngay khi dựng).

Quy ước:

- Method + path viết hoa method, lowercase path.
- `@Public()` nghĩa là endpoint không cần `Authorization` header; các endpoint còn lại yêu cầu `Authorization: Bearer <access_token>` (xem Mục 2 về token format).
- Tất cả timestamp trả về dạng ISO 8601 UTC (`2026-09-04T07:30:00.000Z`).
- Mọi response lỗi đều theo **error format thống nhất** ở Mục 5 — không có endpoint nào trả stack trace, không trả message nội bộ.

## 1. Tổng quan endpoint

| # | Method | Path | Auth | Phân quyền | UC tương ứng |
|---|--------|------|------|------------|--------------|
| 1 | `GET` | `/health` | public | — | (đã có) |
| 2 | `POST` | `/auth/login` | public | — | UC-login |
| 3 | `POST` | `/auth/logout` | bearer | mọi vai trò đang đăng nhập | UC-logout |
| 4 | `POST` | `/auth/refresh` | public (cookie) | — | UC-refresh-session |
| 5 | `POST` | `/auth/forgot-password` | public | — | UC-reset-password |
| 6 | `POST` | `/auth/reset-password` | public | — | UC-reset-password |
| 7 | `POST` | `/auth/change-password` | bearer | mọi vai trò đang đăng nhập | UC-change-password |
| 8 | `GET` | `/auth/me` | bearer | mọi vai trò đang đăng nhập | (hỗ trợ UC-login sau khi đăng nhập) |
| 9 | `POST` | `/admin/users/:id/lock` | bearer | `ADMIN` | FR-auth-013 (khóa thủ công) |
| 10 | `POST` | `/admin/users/:id/unlock` | bearer | `ADMIN` | FR-auth-013 (mở khóa thủ công) |
| 11 | `GET` | `/admin/audit-logs` | bearer | `ADMIN` | FR-auth-014 (tra cứu nhật ký) |

Mọi endpoint đều nằm dưới global pipeline: helmet → trust proxy → ThrottlerGuard → JwtAuthGuard → RolesGuard. Endpoint công khai (1, 2, 4, 5, 6) đánh dấu `@Public()` để JwtAuthGuard bỏ qua. Rate limit theo 2 tầng: tầng IP (ThrottlerGuard — login 10/phút/IP, forgot-password 5/phút/IP, global 100/phút/IP; vượt → 429 mã nền tảng `RATE_LIMITED`) và tầng email (quota gửi link 3/giờ/email — NFR-auth-008; vượt → 429 `E-auth-010`, xem Mục 8).

## 2. Token format

### 2.1 Access token (JWT)

- Header gửi: `Authorization: Bearer <jwt>`.
- JWT thuật toán `HS256` (đối xứng, đủ dùng cho 1 service Render).
- Secret đọc từ env `JWT_ACCESS_SECRET` (≥ 32 byte random, fail-fast nếu thiếu ở boot — xem `auth-architecture.md` Mục 7).
- Claims:

| Claim | Kiểu | Ý nghĩa |
|-------|------|---------|
| `sub` | string (UUID) | userId |
| `sid` | string (UUID) | sessionId — JwtAuthGuard load Session theo sid |
| `role` | string | role hiện tại (tham chiếu; phân quyền thật vẫn đọc DB mỗi request, xem Mục 6) |
| `iss` | string | `hrm-accounting-auth` |
| `aud` | string | `hrm-accounting-api` |
| `iat` | number | issued at (epoch seconds) |
| `exp` | number | expiry (epoch seconds) — TTL mặc định 15 phút (env `JWT_ACCESS_EXPIRES`) |

> Lý do `role` trong JWT chỉ tham chiếu: RolesGuard luôn đọc role **mới nhất** từ DB mỗi request — Admin đổi vai trò user có hiệu lực tức thì với mọi request tiếp theo, không cần đợi access token hết hạn (NFR-auth-005).

### 2.2 Refresh token

- Chuỗi ngẫu nhiên 48 byte, encode `base64url` (A–Z a–z 0–9 `-` `_`), KHÔNG phải JWT, KHÔNG parse được — server chỉ lưu `SHA-256(token)` trong DB, lookup theo hash.
- Giao qua **HttpOnly cookie** tên `refresh_token` (xem Mục 3 về lý do chọn cookie).
- `Max-Age` = 480 phút (8 giờ — BR-auth-004). Cookie bị xoá khi logout hoặc server xoay refresh (set cookie mới + xoá cookie cũ qua `Set-Cookie` với `Max-Age=0`).

## 3. Cookie vs body cho refresh token — chốt

**Chốt: refresh token đặt trong HttpOnly Secure SameSite=Lax cookie, KHÔNG trả trong JSON body.**

Phân tích phương án:

| Phương án | Ưu | Nhược | Phù hợp? |
|-----------|-----|-------|----------|
| **A. HttpOnly cookie** | Chống XSS lấy refresh token (JS đọc document.cookie không thấy); trình duyệt tự gửi kèm request cùng origin; FE không cần code lưu trữ | Cần CSRF protection (xem dưới); nếu FE khác origin phải `SameSite=None` + `CORS_ORIGIN` cấu hình | ✓ |
| B. JSON body | Đơn giản ở phía server, không cần cookie attribute; FE toàn quyền xử lý | FE phải tự lưu (localStorage → XSS attack; in-memory → mất khi refresh tab); phức tạp hoá phía client | ✗ |
| C. Tự chế (FE quản lý) | Linh hoạt | Tự chịu trách nhiệm bảo mật; sai 1 dòng là lộ token | ✗ |

Quyết định **A** vì:

1. Render free tier hiện chỉ chạy 1 service; khi FE ra đời, phương án triển khai tự nhiên nhất là **Nest serve static FE từ cùng service** (đã có pattern `dist/main.js`, FE build xong bundle ra cùng origin). Same-origin → cookie gửi tự động, không cần CORS cho auth endpoint.
2. Nếu sau này tách FE ra domain riêng (vd `app.hrm-accounting.com`), chỉ cần đổi `SameSite=None; Secure` + thêm `CORS_ORIGIN=https://app.hrm-accounting.com` + `credentials: 'include'` ở FE — không phải sửa API contract.
3. Cookie HttpOnly + Secure + SameSite=Lax chống được cả 2 vector chính (XSS đọc token, CSRF replay) vì:
   - HttpOnly: JS không đọc được.
   - Secure: chỉ gửi qua HTTPS (Render mặc định TLS).
   - SameSite=Lax: cookie KHÔNG gửi kèm request cross-site POST (block CSRF form-based); vẫn gửi khi user click link cùng origin (top-level navigation).
4. CSRF defense bổ sung: endpoint `/auth/refresh` yêu cầu header `X-Requested-With: XMLHttpRequest` (mọi fetch của trình duyệt thật đều có thể set, attacker cross-site fetch không set được vì simple request bị CORS preflight chặn) — đây là secondary defense, không thay thế SameSite.

**Cookie attribute cố định:**

```
Set-Cookie: refresh_token=<token>; Path=/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=28800
```

`Path=/auth` để cookie chỉ gửi cho nhóm endpoint auth, không phát tán ra endpoint khác. Khi tách FE ra subdomain khác đổi `SameSite=None`.

## 4. Endpoint chi tiết

### 4.1 `GET /health`

Public. Đã có. Trả 200 nếu service lên + DB reachable, 503 nếu DB down. Response (ví dụ 200):

```json
{
  "status": "ok",
  "uptime": 12345,
  "timestamp": "2026-09-04T07:30:00.000Z"
}
```

Trả ngoài scope auth — không thay đổi. Giữ nguyên contract hiện tại.

---

### 4.2 `POST /auth/login`

**Auth:** public · **Phân quyền:** — · **UC:** UC-login · **FR:** FR-auth-001, FR-auth-002, FR-auth-003, FR-auth-004

**Request body** (JSON):

| Field | Type | Bắt buộc | Rule |
|-------|------|----------|------|
| `email` | string | ✅ | RFC 5322, trim + lowercase trước khi tìm user |
| `password` | string | ✅ | 1–128 ký tự (giới hạn trên để chống DoS payload, không validate policy ở login) |

**Validation rule** (lỗi thiếu/sai định dạng → 400 với `E-auth-004` theo spec):
- `email` thiếu hoặc không khớp regex email → 400 `E-auth-004` ("Vui lòng nhập email và mật khẩu.").
- `password` thiếu hoặc > 128 ký tự → 400 `E-auth-004`.
- Body không phải JSON hợp lệ → 400 `E-auth-004`.

**Xử lý nghiệp vụ (server):**

1. Tìm user theo email. Nếu không có → vẫn chạy argon2 verify trên **dummy hash** (chuẩn bị lúc boot) để cân bằng timing (NFR-auth-004, ADR-003).
2. Nếu user tồn tại nhưng `status = LOCKED` do lockout tự động (BR-auth-001) → 401 `E-auth-002` + audit `LOGIN_FAILURE_LOCKED` (không tiết lộ tài khoản có tồn tại).
3. Nếu `status = DISABLED` (Admin khóa vĩnh viễn BR-auth-008) → 401 `E-auth-003` + audit `LOGIN_FAILURE_DISABLED`.
4. Nếu mật khẩu sai → 401 `E-auth-001`, tăng fail counter; vượt `LOCKOUT_THRESHOLD` (5) trong `LOCKOUT_WINDOW_MINUTES` (15 phút) → set `status = LOCKED` với `lockedUntil = now + LOCKOUT_DURATION_MINUTES` (15 phút), response vẫn `E-auth-001` + audit `ACCOUNT_LOCKED` (spec: cộng bộ đếm rồi khóa; response khóa trả ở lần đăng nhập SAU — lần này vẫn là sai mật khẩu).
5. Nếu mật khẩu đúng + status = `ACTIVE` → reset fail counter, tạo `Session` mới (idle 8h BR-auth-004) + RefreshToken đầu tiên, audit `LOGIN_SUCCESS`.

**Response 200:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900,
  "user": {
    "id": "3b1c0e2a-...",
    "email": "hoangpm@company.vn",
    "name": "Phạm Minh Hoàng",
    "role": "ADMIN"
  }
}
```

Đồng thời response có header `Set-Cookie: refresh_token=...; ...` (Mục 3).

**Response 401 — `E-auth-002` (tài khoản bị khóa tạm):**

```json
{
  "error": {
    "code": "E-auth-002",
    "message": "Tài khoản đang bị khóa tạm thời. Vui lòng thử lại sau hoặc liên hệ quản trị viên.",
    "lockedUntil": "2026-09-04T07:45:00.000Z"
  }
}
```

**Response 401 — `E-auth-003` (tài khoản bị vô hiệu hóa):**

```json
{
  "error": {
    "code": "E-auth-003",
    "message": "Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên."
  }
}
```

**Response 401 — `E-auth-001` (mật khẩu sai — message thống nhất, không phân biệt email có tồn tại):**

```json
{
  "error": {
    "code": "E-auth-001",
    "message": "Email hoặc mật khẩu không đúng."
  }
}
```

`E-auth-001` message dùng **chung** cho cả 2 trường hợp "email không tồn tại" và "mật khẩu sai" (anti-enumeration, BR-auth-006).

**Status codes:** 200 · 400 (validate) · 401 (auth fail) · 429 (rate-limit).

---

### 4.3 `POST /auth/logout`

**Auth:** bearer · **Phân quyền:** mọi vai trò · **UC:** UC-logout · **FR:** FR-auth-005

**Request body:** không (POST rỗng vẫn hợp lệ).

**Xử lý:** revoke Session theo `sid` trong access token. Idempotent — gọi lại với session đã revoke vẫn trả 204. Audit `LOGOUT` (FR-auth-014).

**Response 204:** không body. Header `Set-Cookie: refresh_token=; Path=/auth; Max-Age=0` để xoá cookie.

**Status codes:** 204 · 401 (access token hết hạn/sai — E-auth-012).

---

### 4.4 `POST /auth/refresh`

**Auth:** public — nhận diện user qua cookie `refresh_token` · **Phân quyền:** — · **UC:** UC-refresh-session · **FR:** FR-auth-006

**Request body:** không.

**Required header:** `X-Requested-With: XMLHttpRequest` (CSRF defense, Mục 3).

**Xử lý:**

1. Đọc cookie `refresh_token`. Không có → 401 `E-auth-012`.
2. Hash (SHA-256) → lookup `RefreshToken` trong DB.
3. Không tìm thấy HOẶC `revokedAt != null` HOẶC `expiresAt < now` → 401 `E-auth-012`.
4. **Phát hiện reuse** (token đã `revokedAt` bị dùng lại) → revoke toàn bộ `Session` của user + audit `SESSION_REUSE` (bảo vệ chống token theft, E-auth-012 nguyên nhân reuse).
5. Hợp lệ + chưa dùng → revoke token cũ, tạo RefreshToken mới cùng `sessionId` (rotation), gia hạn `Session.idleExpiresAt = now + 8h` nếu còn < 4h.
6. Sinh access token mới, set cookie mới.

**Response 200:** giống `POST /auth/login` (chỉ trả `accessToken` + `user`, không cần `user` cho mọi lần refresh nhưng để FE đỡ phải gọi thêm `/auth/me` thì trả luôn).

**Response 401 — `E-auth-012`:** message `"Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."` (nguyên văn spec). Cả 3 nhánh (không có cookie, hết hạn, reuse) cùng message — tránh attacker phân biệt.

**Status codes:** 200 · 401 (E-auth-012) · 429.

---

### 4.5 `POST /auth/forgot-password`

**Auth:** public · **Phân quyền:** — · **UC:** UC-reset-password · **FR:** FR-auth-007, FR-auth-008

**Request body:**

| Field | Type | Bắt buộc | Rule |
|-------|------|----------|------|
| `email` | string | ✅ | như login |

**Validation:** 400 `E-auth-004` nếu `email` sai định dạng.

**Xử lý (FR-auth-007, FR-auth-008):**

1. Tìm user theo email. Không tìm thấy → vẫn trả response thống nhất (anti-enumeration). KHÔNG gửi email, KHÔNG tạo token.
2. Có user → revoke mọi `PasswordResetToken` cũ chưa dùng của user, tạo token mới (TTL 24h BR-auth-005), hash lưu DB.
3. **Quota check:** nếu email đã có `RESET_EMAIL_HOURLY_LIMIT` (3) yêu cầu trong 1 giờ → 429 `E-auth-010` ("Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau.") + audit `PASSWORD_RESET_REQUESTED` với reason `RATE_LIMITED` (NFR-auth-008 — chống spam mail). Quota đếm theo địa chỉ email **bất kể có tồn tại** để 429 không thành oracle (anti-enumeration).
4. Gửi email qua `MailerPort` với link `RESET_LINK_BASE_URL + '?token=' + rawToken`. Audit `PASSWORD_RESET_REQUESTED` (ghi cả khi email không tồn tại — chỉ ghi `email` + ip, không ghi `userId` vì có thể là email lạ).

**Response 200 — message thống nhất (FR-auth-007):**

```json
{
  "message": "Nếu email tồn tại trong hệ thống, link đặt lại mật khẩu đã được gửi."
}
```

**Status codes:** 200 (mọi trường hợp không phải validate/quota) · 400 (validate E-auth-004) · 429 (E-auth-010 quota email).

---

### 4.6 `POST /auth/reset-password`

**Auth:** public · **Phân quyền:** — · **UC:** UC-reset-password · **FR:** FR-auth-009

**Request body:**

| Field | Type | Bắt buộc | Rule |
|-------|------|----------|------|
| `token` | string | ✅ | chuỗi raw token từ email link |
| `newPassword` | string | ✅ | theo BR-auth-003 (xem dưới) |

**Validation `newPassword` (BR-auth-003):**
- Độ dài 8–128 ký tự.
- Có ít nhất 1 chữ cái (thường hoặc HOA).
- Có ít nhất 1 chữ số (0–9).
- Fail → 400 `E-auth-007` với message theo spec: `"Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ cái và chữ số."` + audit `PASSWORD_RESET_FAILED` (reason `WEAK_POLICY`, không có actor/target vì token chưa được tra ở bước này).

> Ghi chú (không sửa spec): OQ-5 đã chốt "8 ký tự, ≥1 chữ cái, ≥1 chữ số" — KHÔNG yêu cầu chữ HOA riêng. Wording spec E-auth-007 dùng nguyên.

**Xử lý (FR-auth-009):**

1. Hash token → lookup `PasswordResetToken`. Không có / đã dùng / hết hạn → 400 `E-auth-006` (`"Link đặt lại mật khẩu không còn hiệu lực. Vui lòng yêu cầu link mới."`) + audit `PASSWORD_RESET_FAILED` (reason `INVALID_TOKEN`, không actor/target vì chưa xác định được user).
2. Kiểm tra mật khẩu mới có trùng mật khẩu hiện tại không. Trùng → 400 `E-auth-009` (`"Mật khẩu mới phải khác mật khẩu hiện tại."`) + audit `PASSWORD_RESET_FAILED` (reason `SAME_AS_CURRENT`, có actor/target = user của token).
3. Hash mật khẩu mới (argon2id, cùng code path với login).
4. Update user: `passwordHash` mới, `failedLoginCount = 0`, `status = ACTIVE` (nếu đang LOCKED thì mở khoá — đây là cách user thoát khỏi khóa tạm sau khi xác minh email).
5. Mark token `usedAt = now`.
6. **Revoke toàn bộ Session** của user (BR-auth-009). User phải đăng nhập lại.
7. Audit `PASSWORD_RESET_COMPLETED`.

**Response 200:**

```json
{ "message": "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại." }
```

**Status codes:** 200 · 400 (E-auth-006/007/009) · 429 (E-auth-010).

---

### 4.7 `POST /auth/change-password`

**Auth:** bearer · **Phân quyền:** mọi vai trò · **UC:** UC-change-password · **FR:** FR-auth-010, FR-auth-011

**Request body:**

| Field | Type | Bắt buộc | Rule |
|-------|------|----------|------|
| `currentPassword` | string | ✅ | 1–128 ký tự |
| `newPassword` | string | ✅ | như reset (BR-auth-003) |

**Xử lý (FR-auth-010, FR-auth-011):**

1. Verify `currentPassword` bằng argon2. Sai → 400 `E-auth-008` (`"Mật khẩu hiện tại không đúng."`) + audit `PASSWORD_CHANGE_FAILED` (reason `INVALID_CURRENT_PASSWORD`, không log nội dung password).
2. Trùng `newPassword` với `currentPassword` → 400 `E-auth-009` + audit `PASSWORD_CHANGE_FAILED` (reason `SAME_AS_CURRENT`).
3. Vi phạm policy BR-auth-003 → 400 `E-auth-007` + audit `PASSWORD_CHANGE_FAILED` (reason `WEAK_POLICY`).
4. Hash + update.
5. **Revoke toàn bộ Session trừ session hiện tại** (sid trong JWT) — BR-auth-009. Người dùng vẫn đăng nhập trên thiết bị này, thiết bị khác bị văng.
6. Reset fail counter + status = ACTIVE.
7. Audit `PASSWORD_CHANGED`.

**Response 200:**

```json
{ "message": "Đổi mật khẩu thành công." }
```

**Status codes:** 200 · 400 (E-auth-007/008/009) · 401 (E-auth-012 nếu access token đã hết hạn) · 429.

---

### 4.8 `GET /auth/me`

**Auth:** bearer · **Phân quyền:** mọi vai trò · **FR:** (hỗ trợ FE lấy profile sau login/refresh)

**Response 200:**

```json
{
  "id": "3b1c0e2a-...",
  "email": "hoangpm@company.vn",
  "name": "Phạm Minh Hoàng",
  "role": "ADMIN",
  "status": "ACTIVE",
  "lastLoginAt": "2026-09-04T07:30:00.000Z"
}
```

`status` trả về để FE biết user có đang bị khóa/vô hiệu giữa phiên không (hiếm — guard thường chặn trước — nhưng để debug).

**Status codes:** 200 · 401 (E-auth-012).

---

### 4.9 `POST /admin/users/:id/lock`

**Auth:** bearer · **Phân quyền:** `ADMIN` · **FR:** FR-auth-013, BR-auth-008

**Request body:**

| Field | Type | Bắt buộc | Rule |
|-------|------|----------|------|
| `reason` | string | ✅ | 1–500 ký tự, ghi vào audit `detail.reason` |
| `permanent` | boolean | — | mặc định `false`. `true` → set `status = DISABLED` (vô hiệu vĩnh viễn); `false` → set `status = LOCKED` với `lockedUntil = null` (Admin khóa thủ công không tự mở — khác lockout tự động có TTL 15 phút) |

**Xử lý:** cập nhật user, revoke toàn bộ Session của user, audit `ACCOUNT_LOCKED_MANUAL` (kèm `actorId` = admin đang gọi + `targetUserId` + `reason`).

**Validation:** `reason` thiếu hoặc > 500 ký tự → 400 `E-auth-004` (validate input).

**Response 200:**

```json
{
  "id": "3b1c0e2a-...",
  "status": "LOCKED",
  "lockedUntil": null
}
```

**Status codes:** 200 · 400 (validate, E-auth-004) · 401 (E-auth-012) · 403 (E-auth-011) · 404 (user không tồn tại — xem ghi chú Mục 8) · 429.

---

### 4.10 `POST /admin/users/:id/unlock`

**Auth:** bearer · **Phân quyền:** `ADMIN` · **FR:** FR-auth-013

**Request body:** không.

**Xử lý:** set `status = ACTIVE`, reset `failedLoginCount = 0`, `lockedUntil = null`, KHÔNG revoke session (admin chỉ mở khoá trạng thái — user vẫn đang dùng phiên hợp lệ thì tiếp tục dùng). Audit `ACCOUNT_UNLOCKED_MANUAL`.

**Response 200:**

```json
{
  "id": "3b1c0e2a-...",
  "status": "ACTIVE"
}
```

**Status codes:** 200 · 401 · 403 · 404 (user không tồn tại — xem ghi chú Mục 8) · 429.

---

### 4.11 `GET /admin/audit-logs`

**Auth:** bearer · **Phân quyền:** `ADMIN` · **FR:** FR-auth-014, US-008

**Query params:**

| Param | Type | Default | Rule |
|-------|------|---------|------|
| `userId` | UUID | — | lọc theo user (actor hoặc target tuỳ query bên dưới) |
| `event` | string | — | 1 trong 15 loại event (xem Mục 7) |
| `from` | ISO datetime | — | lọc `createdAt >= from` |
| `to` | ISO datetime | — | lọc `createdAt <= to` |
| `limit` | int | 50 | 1–200 |
| `cursor` | string | — | opaque cursor (encode `createdAt + id`); response cung cấp `nextCursor` để trang sau |

**Response 200:**

```json
{
  "items": [
    {
      "id": "5c8a...",
      "event": "LOGIN_FAILURE",
      "actorId": null,
      "actorEmail": "hoangpm@company.vn",
      "targetUserId": null,
      "targetEmail": null,
      "sessionId": null,
      "ip": "203.0.113.42",
      "userAgent": "Mozilla/5.0 ...",
      "reason": "INVALID_PASSWORD",
      "detail": { "attemptNumber": 3 },
      "createdAt": "2026-09-04T07:25:12.000Z"
    }
  ],
  "nextCursor": "eyJjcmVhdGVkQXQiOi..."
}
```

Audit log **không bao giờ** chứa `password`, `token` raw, hay link đặt lại (NFR-auth-003, Mục 7).

**Status codes:** 200 · 400 (validate) · 401 · 403 (E-auth-011) · 429.

---

## 5. Error format (thống nhất toàn hệ thống)

Mọi response 4xx/5xx (trừ 204) đều theo shape:

```json
{
  "error": {
    "code": "E-auth-004",
    "message": "Vui lòng nhập email và mật khẩu.",
    "fields": { "email": "Định dạng email không hợp lệ" }
  }
}
```

| Field | Bắt buộc | Ý nghĩa |
|-------|----------|---------|
| `error.code` | ✅ | mã lỗi ổn định, FE dùng để branch logic; format `E-auth-NNN` |
| `error.message` | ✅ | message tiếng Việt hiển thị được cho user, không chứa thông tin kỹ thuật |
| `error.fields` | — | chỉ có khi 400 validate body — map `fieldName → message` |
| `error.lockedUntil` | — | chỉ có ở E-auth-002, FE dùng để hiện đếm ngược |
| `error.retryAfter` | — | chỉ có ở 429, value = số giây, FE dùng cho disable nút |

Status code HTTP dùng theo semantic chuẩn:

| HTTP | Nhóm lỗi | Ví dụ |
|------|----------|-------|
| 400 | validate body / nghiệp vụ từ chối | E-auth-004 (thiếu input), E-auth-006 (link hết hạn), E-auth-007 (password policy), E-auth-008 (current password sai), E-auth-009 (trùng mật khẩu) |
| 401 | xác thực thất bại | E-auth-001 (login fail), E-auth-002, E-auth-003, E-auth-012 |
| 403 | đã xác thực nhưng không đủ quyền | E-auth-011 |
| 404 | resource không tồn tại | user không tồn tại ở admin endpoint (không có mã riêng trong spec — dùng shape chuẩn với code `E-auth-004`, message `"Không tìm thấy người dùng."`; xem ghi chú Mục 8) |
| 429 | rate-limit | tầng IP → code nền tảng `RATE_LIMITED`; tầng email (NFR-auth-008) → `E-auth-010` |
| 500 | lỗi server không lường trước | code nội bộ `INTERNAL`, KHÔNG lộ message chi tiết |

## 6. Authorization model

- 4 vai trò cố định: `ADMIN`, `HR`, `ACCOUNTANT`, `EMPLOYEE` (Postgres enum, xem `auth-data-model.md` Mục 3).
- `@Roles(Role.ADMIN)` ở handler — RolesGuard kiểm tra.
- `RolesGuard` **luôn** load `user.role` từ DB tại request time (không tin claim `role` trong JWT) — đảm bảo đổi vai trò có hiệu lực tức thì.
- Thiếu `@Roles()` ở handler sau `JwtAuthGuard` = endpoint cho mọi vai trò đã đăng nhập.
- Từ chối → 403 `E-auth-011` + audit `PERMISSION_DENIED` (FR-auth-012, FR-auth-014).

**Quy tắc áp `@Roles` cho từng endpoint admin:**

| Endpoint | `@Roles` |
|----------|----------|
| `/admin/users/:id/lock` | `ADMIN` |
| `/admin/users/:id/unlock` | `ADMIN` |
| `/admin/audit-logs` | `ADMIN` |

Endpoint `/auth/*` còn lại: mọi vai trò đã đăng nhập (không cần `@Roles`).

## 7. Audit log — 15 loại sự kiện (FR-auth-014)

AuditService là writer duy nhất (xem `auth-architecture.md` Mục 3). Mỗi event log vào `AuditLog` (model xem `auth-data-model.md` Mục 5):

| Event | Trigger | actorId | targetUserId | reason có thể |
|-------|---------|---------|--------------|----------------|
| `LOGIN_SUCCESS` | login OK | user | user | — |
| `LOGIN_FAILURE` | email đúng nhưng password sai | null | user | `INVALID_PASSWORD` |
| `LOGIN_FAILURE_LOCKED` | user đang LOCKED cố login | null | user | `ACCOUNT_LOCKED` |
| `LOGIN_FAILURE_DISABLED` | user đang DISABLED cố login | null | user | `ACCOUNT_DISABLED` |
| `LOGOUT` | logout (idempotent) | user | user | — |
| `PASSWORD_RESET_REQUESTED` | gọi forgot (kể cả email lạ — `targetUserId = null`) | null | null hoặc user | `EMAIL_NOT_FOUND` / `RATE_LIMITED` |
| `PASSWORD_RESET_COMPLETED` | reset-password thành công | user | user | — |
| `PASSWORD_RESET_FAILED` | reset-password thất bại (policy/token sai-hết hạn-đã dùng/trùng mật khẩu) | null hoặc user | null hoặc user | `WEAK_POLICY` / `INVALID_TOKEN` / `SAME_AS_CURRENT` |
| `PASSWORD_CHANGED` | change-password thành công | user | user | — |
| `PASSWORD_CHANGE_FAILED` | change-password thất bại | user | user | `INVALID_CURRENT_PASSWORD` / `SAME_AS_CURRENT` / `WEAK_POLICY` |
| `ACCOUNT_LOCKED_AUTO` | vượt fail counter → lock tự động | null | user | `TOO_MANY_ATTEMPTS` |
| `ACCOUNT_LOCKED_MANUAL` | Admin gọi `/admin/users/:id/lock` | admin | user | (lý do từ body) |
| `ACCOUNT_UNLOCKED_MANUAL` | Admin gọi `/admin/users/:id/unlock` | admin | user | — |
| `PERMISSION_DENIED` | RolesGuard từ chối | user | null | (path + required role) |
| `SESSION_REUSE` | refresh token đã revoke bị dùng lại | null | user | — |

Field `detail` (jsonb) chỉ chứa dữ liệu không nhạy cảm: `attemptNumber`, `path`, `requiredRole`, `lockedUntil`, … KHÔNG chứa password/token/email body/reset link.

## 8. Mã lỗi E-auth-xxx (12 mã — nguyên văn theo spec)

| Mã | HTTP | Mục đích (spec) | Wording hiển thị (nguyên văn spec) |
|----|------|-----------------|-------------------------------------|
| `E-auth-001` | 401 | Đăng nhập sai email hoặc sai mật khẩu | `"Email hoặc mật khẩu không đúng."` |
| `E-auth-002` | 401 | Đăng nhập khi tài khoản đang khóa tạm | `"Tài khoản đang bị khóa tạm thời. Vui lòng thử lại sau hoặc liên hệ quản trị viên."` |
| `E-auth-003` | 401 | Đăng nhập khi tài khoản bị vô hiệu hóa | `"Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên."` |
| `E-auth-004` | 400 | Đăng nhập thiếu email hoặc mật khẩu | `"Vui lòng nhập email và mật khẩu."` |
| `E-auth-005` | 200 | Yêu cầu đặt lại mật khẩu (response thống nhất forgot-password) | `"Nếu email tồn tại trong hệ thống, link đặt lại mật khẩu đã được gửi."` |
| `E-auth-006` | 400 | Link đặt lại hết hạn hoặc đã sử dụng | `"Link đặt lại mật khẩu không còn hiệu lực. Vui lòng yêu cầu link mới."` |
| `E-auth-007` | 400 | Mật khẩu mới không đạt chính sách | `"Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ cái và chữ số."` |
| `E-auth-008` | 400 | Đổi mật khẩu: mật khẩu hiện tại sai | `"Mật khẩu hiện tại không đúng."` |
| `E-auth-009` | 400 | Đổi mật khẩu: mật khẩu mới trùng mật khẩu hiện tại | `"Mật khẩu mới phải khác mật khẩu hiện tại."` |
| `E-auth-010` | 429 | Đặt lại/đổi mật khẩu vượt tần suất gửi email | `"Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau."` |
| `E-auth-011` | 403 | Yêu cầu vượt quyền | `"Bạn không có quyền thực hiện chức năng này."` |
| `E-auth-012` | 401 | Phiên hết hạn hoặc không hợp lệ | `"Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."` |

Ghi chú mapping với các Mục trên:

- **E-auth-004 mở rộng dùng cho validate input chung** (email sai định dạng, password > 128, body JSON lỗi, `reason` admin sai) — spec định nghĩa cho login thiếu input; dùng cùng code cho nhóm "payload thiếu/sai" để tránh tự sinh mã mới ngoài 12 mã spec. Message giữ nguyên văn spec cho case login; case khác dùng `"Dữ liệu không hợp lệ"` trong `error.fields` per-field.
- **E-auth-005** là mã của **response 200 thành công** forgot-password (anti-enumeration) — không phải lỗi.
- **429 tầng IP** (ThrottlerGuard) không có mã E-auth riêng — dùng code nền tảng `RATE_LIMITED` cùng error format (Mục 1). Chỉ 429 tầng email (NFR-auth-008) mới là `E-auth-010`.
- **404 user không tồn tại ở admin endpoint**: spec không định nghĩa mã riêng — dùng shape chuẩn với `error.code = "E-auth-004"`, `error.message = "Không tìm thấy người dùng."`. Đây là điểm CẦN USER XEM XÉT: nếu muốn mã riêng (vd `E-auth-013`) thì phải bổ sung vào spec, không thêm âm thầm (xem Mục 12).

## 9. Validation rules tổng hợp

| Field | Rule | Nguồn |
|-------|------|-------|
| `email` | RFC 5322 cơ bản (regex đơn giản `^[^\s@]+@[^\s@]+\.[^\s@]+$`); trim + lowercase; ≤ 254 ký tự (RFC 5321) | Mục 4.2 |
| `password` (input login/change) | 1–128 ký tự (chỉ giới hạn trên để chống DoS); login không validate policy, chỉ so khớp | Mục 4.2 |
| `newPassword` (reset/change) | 8–128 ký tự · ≥ 1 chữ cái · ≥ 1 chữ số (OQ-5 chốt, không bắt buộc chữ HOA/ký tự đặc biệt) | BR-auth-003 |
| `token` (reset) | chuỗi base64url 64 ký tự (do server sinh) | Mục 2.2 |
| `reason` (admin lock) | 1–500 ký tự | Mục 4.9 |
| `limit` (audit-logs) | int 1–200 | Mục 4.11 |

## 10. CORS & cross-origin

Mặc định: Nest bật CORS chỉ cho cùng origin. Khi FE ra đời:

| Tình huống | Cấu hình |
|------------|----------|
| FE served từ cùng service (Nest serve static) | KHÔNG cần CORS — same-origin, cookie tự gửi |
| FE ở origin khác (vd `https://app.hrm-accounting.com`) | env `CORS_ORIGIN=https://app.hrm-accounting.com`, `credentials: true` ở FE, đổi cookie `SameSite=None; Secure` |

Quyết định deploy: khuyến nghị same-origin cho phase 1 (đơn giản, khớp Render free 1 service), cross-origin từ phase 2 trở đi khi FE tách subdomain.

## 11. Pagination cursor (audit-logs)

Cursor dùng **opaque key** encode JSON `{ "createdAt": ISO, "id": UUID }` base64url. Query tiếp theo:

```sql
WHERE (createdAt, id) < (cursor.createdAt, cursor.id)
ORDER BY createdAt DESC, id DESC
LIMIT $limit
```

`createdAt` và `id` đều là TIMESTAMPTZ + UUID, kết hợp cho unique sort key. Không dùng `OFFSET` — không ổn định với dữ liệu thường xuyên insert (audit log write mỗi request).

## 12. Open Questions liên quan API (chưa chốt)

- **OQ-1 (2FA)**: nếu sau này bật 2FA, `POST /auth/login` thêm field `otpCode`, response thêm `requires2fa: true` khi mật khẩu đúng nhưng cần OTP. Contract mở rộng thêm 2 mã lỗi mới. Không ảnh hưởng endpoint khác.
- **OQ-2 (social login)**: thêm `POST /auth/oauth/:provider/callback`. Tách sang module OAuth, có thể tái sử dụng `AuthService` cho phần tạo Session + RefreshToken.
- **OQ-3 (tự đăng ký)**: nếu mở tự đăng ký, thêm `POST /auth/register`. Hiện chỉ seed admin, đã đủ cho phase 1.
- **OQ-6 (email provider)**: env `SMTP_*` + `MAIL_TRANSPORT=smtp|console` đã thiết kế để thay provider không phải sửa code.

**Điểm cần user quyết thêm (ngoài OQ hiện có):**

- **404 user không tồn tại ở admin endpoint** (Mục 8): spec không có mã lỗi riêng — đề xuất bổ sung `E-auth-013` vào spec nếu user muốn mã riêng, hoặc giữ phương án hiện tại (dùng `E-auth-004` + message "Không tìm thấy người dùng.").

## References

- [[docs/auth/srs/auth-spec.md|Auth SRS]] — nguồn FR/NFR/BR/Error
- [[docs/auth/architecture/auth-architecture.md|Auth Architecture]] — module boundaries + token strategy
- [[docs/auth/architecture/auth-data-model.md|Auth Data Model]] — schema + audit log fields
- [[docs/auth/architecture/adr/ADR-002-auth-strategy.md|ADR-002 Auth Strategy]] — lý do JWT + session server-side
- [[docs/auth/architecture/adr/ADR-003-password-hashing.md|ADR-003 Password Hashing]] — lý do argon2id + dummy verify
- [[docs/auth/architecture/adr/ADR-004-validation.md|ADR-004 Validation]] — lý do chọn zod
