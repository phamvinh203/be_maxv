---
type: api-contract
feature: phan-quyen-nhan-vien
status: draft
updated: 2026-09-17
links:
  - docs/phan-quyen-nhan-vien/srs/phan-quyen-nhan-vien-spec.md
  - docs/phan-quyen-nhan-vien/srs/phan-quyen-nhan-vien-flows.md
  - docs/phan-quyen-nhan-vien/architecture/data-model.md
  - docs/phan-quyen-nhan-vien/architecture/adr/ADR-002-gui-mat-khau-qua-email-va-bat-doi-lan-dau.md
  - docs/hrm/architecture/adr/ADR-007-pham-vi-quyen-xem-du-lieu-luong.md
---

# API Contract — Phân quyền nhân viên (mời qua email + đúng công ty được cấp)

> Viết lại 2026-09-17 theo phạm vi vòng 2 (spec vòng 2, OQ-1..4 đã chốt). Bản vòng 1 (quyền module theo nhân viên) đã huỷ — ADR-001 Rejected.
> Mỗi endpoint ghi **hiện trạng đã đọc code (`file:line`)** rồi tới **phần đổi**. Giả định chưa chốt đánh dấu `[GIẢ ĐỊNH OQ-n]`.

- Nhóm route client `/api/v1/*` (FE `hdđt_maxv`), trừ Mục 4.7 là admin `/api/v1/admin/*` (FE `maxv/`).
- Không có breaking change về hình dạng response. Thay đổi hành vi có chủ đích: Mục 3 (chặn tài khoản chưa đổi mật khẩu), Mục 4.8 (`GET /companies/employees` chỉ OWNER — giả định), trùng công ty trả 400 thay vì 403 (Mục 4.6, 4.10).

## 1. Quy ước chung

### 1.1. Envelope (hiện trạng)

| Loại | Hình dạng | Nguồn |
|---|---|---|
| Thành công | `{ "success": true, "data": ... }` | `helpers/response.ts:4-10` |
| 400 Zod | `{ "success": false, "errors": { "formErrors": [], "fieldErrors": {} } }` — không có `message` | `plugins/errorHandler.plugin.ts` nhánh `ValidationError` |
| 400/401/403/404/409/502 nghiệp vụ | `{ "success": false, "message": "..." }` — **không có `code`** | cùng file, các nhánh `AppError` |
| 429 | `{ "success": false, "message": COMMON.TOO_MANY_REQUESTS }` | cùng file |

### 1.2. Mở rộng duy nhất ở tầng chung: `code` cho 403

`ForbiddenError(message, code?)`; nhánh 403 của `errorHandler` trả thêm `code` khi có. Chỉ hai mã dùng trong feature:

| `code` | Ném ở | Mục đích cho FE |
|---|---|---|
| `PASSWORD_CHANGE_REQUIRED` | `app.authenticate` (Mục 3) | Chuyển sang màn đổi mật khẩu |
| `COMPANY_NO_ACCESS` | 4 chỗ ném `COMPANY.NO_ACCESS` khi kiểm **công ty đang chọn trong vé**: `helpers/resolveTenantDb.ts:57, 70`, `helpers/dich_vu_cong/kiemCongTyDangChon.ts:21`, `controllers/client/hrm/du_lieu_ca_nhan/taiLieu.controller.ts:105` | Đồng bộ lại phiên khi công ty đang mở vừa bị thu hồi (Mục 4.11) |

FE `hdđt_maxv` đã đọc sẵn `body.code` vào `ApiError.code` (`lib/http.ts:41-52, 155, 167`). Client không đọc `code` (`fe_maxv`, `maxv`) không bị ảnh hưởng.

### 1.3. Xác thực, phân trang, idempotency

- `app.authenticate`: kiểm JWT trong cookie, **không** đọc DB (`plugins/jwt.plugin.ts:31-44`). `app.requireRole(...)`: nạp lại user từ DB (`jwt.plugin.ts:53-70`).
- Không endpoint nào trong feature phân trang/lọc/sắp xếp theo tham số — danh sách của một tài khoản, nhỏ, sắp cố định phía server.
- `PUT .../access` là đặt giá trị (gửi lại cùng body cho cùng kết quả). `POST /companies/invite` chống trùng bằng 409. `POST /admin/.../approve` chống duyệt đôi bằng cập nhật có điều kiện (409).

## 2. Tổng hợp thay đổi

| Endpoint | Loại | Thay đổi | Mục |
|---|---|---|---|
| (mọi route dùng `app.authenticate`) | Sửa | Chặn 403 `PASSWORD_CHANGE_REQUIRED` khi vé mang cờ, trừ route whitelist | 3 |
| `POST /auth/login` | Sửa | `data` thêm `phaiDoiMatKhau`; vé mang claim | 4.1 |
| `GET /auth/me` | Sửa | `data` thêm `phaiDoiMatKhau`; được phép khi đang bị bắt đổi | 4.2 |
| `POST /auth/change-password` | **Mới** | Đổi mật khẩu (bắt buộc lần đầu hoặc tự nguyện) | 4.3 |
| `POST /auth/refresh` | Sửa nội bộ | Vé mới mang claim đọc từ DB; response không đổi | 4.4 |
| `POST /auth/reset-password` | Sửa nội bộ | Gỡ cờ khi đặt lại bằng OTP; response không đổi | 4.5 |
| `POST /companies/invite` | Sửa nhỏ | Nhiều `donViIds` **đã hỗ trợ**; trùng công ty 400 thay 403 | 4.6 |
| `POST /admin/companies/invites/:id/approve` | Sửa nội bộ | Sinh mật khẩu tạm, gửi trong email, bật cờ; response không đổi | 4.7 |
| `GET /companies/employees` | Sửa guard | Chỉ OWNER `[GIẢ ĐỊNH OQ-7]` | 4.8 |
| `GET /companies/invites` | Không đổi | — | 4.9 |
| `PUT /companies/employees/:userId/access` | Sửa nội bộ | Khoá chống deadlock; trùng công ty 400 thay 403 | 4.10 |
| Route dữ liệu tenant (HĐĐT/Tờ khai/DVC/HRM/Kế toán) | Sửa nhỏ | 403 `COMPANY.NO_ACCESS` thêm `code: "COMPANY_NO_ACCESS"` | 4.11 |

## 3. Chặn tài khoản "phải đổi mật khẩu" (FR-004, E-005)

### 3.1. Thiết kế

| Câu hỏi | Quyết định | Lý do |
|---|---|---|
| Lưu ở đâu | `users.phaiDoiMatKhau` (DB, `data-model.md` M-01) **và** claim `phaiDoiMatKhau` trong access/refresh token | DB là nguồn lúc phát vé; claim là thứ guard đọc |
| Chặn ở đâu | **Trong `app.authenticate`** (`jwt.plugin.ts:38-44`), sau `jwtVerify()` thành công | Mọi route cần đăng nhập đều đi qua hàm này (preHandler từng route, hook nhóm `admin.route.ts:50`, hook nhóm HRM `hrm.route.ts` gọi `app.authenticate(req)`) — một chỗ phủ tất cả, không sót route |
| Tra DB mỗi request? | **Không** — đọc claim | `authenticate` cố ý không đụng DB (`jwt.plugin.ts:31-37`). Cờ chỉ bật `true` lúc tạo tài khoản (chưa có vé nào) và chỉ về `false` qua đổi mật khẩu/OTP (đều kèm `tokenVersion+1`, vé cũ chết ở lần refresh). Claim không thể "cũ theo chiều nguy hiểm" (vé nói `false` mà DB `true`). |
| Thu hồi được không | Hướng `true → false`: đổi mật khẩu cấp vé mới ngay trong response. Hướng `false → true` (buộc tài khoản đang dùng phải đổi): **không có trong phạm vi**; nếu sau này cần thì phải kèm `tokenVersion+1` — access token cũ còn sống tối đa `accessTtl` (15 phút) mà không bị chặn. | Ghi rõ để không ai thêm "admin bắt đổi mật khẩu" mà quên điều này |
| Whitelist | Route khai `config: { choPhepKhiPhaiDoiMatKhau: true }` (kiểu mở rộng `FastifyContextConfig`, cùng pattern `khongCanAuth` ở `types/fastify.d.ts:17-25`). Chỉ 2 route: `GET /auth/me`, `POST /auth/change-password`. | `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/login`, `/auth/forgot-password`, `/auth/reset-password` **không** gọi `authenticate` (`routes/auth.route.ts:15-24`) nên tự nhiên được phép — không cần khai. |

Hình dáng code (tham khảo cho Backend, không phải code chốt):

```ts
app.decorate('authenticate', async (req: FastifyRequest) => {
  try {
    await req.jwtVerify();
  } catch {
    throw new UnauthorizedError(MESSAGES.AUTH.UNAUTHORIZED);
  }
  // Ném NGOÀI try: không được bị đổi thành 401.
  if (req.user.phaiDoiMatKhau && !req.routeOptions.config?.choPhepKhiPhaiDoiMatKhau) {
    throw new ForbiddenError(MESSAGES.AUTH.PASSWORD_CHANGE_REQUIRED, 'PASSWORD_CHANGE_REQUIRED');
  }
});
```

**Bẫy khi khai whitelist cùng rate limit:** `gioiHanTheoNguoiDung()` trả `{ config: { rateLimit } }` (`constants/rateLimits.ts:22-33`). Spread nó rồi khai thêm `config: {...}` là **ghi đè mất** rate limit. Phải gộp: `config: { ...gioiHanTheoNguoiDung(5, '10 minutes').config, choPhepKhiPhaiDoiMatKhau: true }`.

### 3.2. Response khi bị chặn (E-005)

```json
{ "success": false, "code": "PASSWORD_CHANGE_REQUIRED", "message": "Bạn cần đổi mật khẩu trước khi tiếp tục" }
```

HTTP **403** (không phải 401): 401 khiến `hdđt_maxv` gọi `/auth/refresh` rồi lặp request (`lib/http.ts:131-145`) — vô ích và lặp mãi mỗi request. Message mới: `MESSAGES.AUTH.PASSWORD_CHANGE_REQUIRED`.

### 3.3. Mọi chỗ phát vé phải mang claim

Xem `data-model.md` Mục 6. `TokenPayload.phaiDoiMatKhau` khai bắt buộc. Vé ký trước khi triển khai không có claim → coi như `false`.

## 4. Chi tiết endpoint

### 4.1. `POST /api/v1/auth/login`

**Hiện trạng:** `routes/auth.route.ts:16`, không auth, `STRICT_AUTH_LIMIT` 5 lượt/phút/IP. Body `{ email, password }`. `loginUser` (`auth.service.ts:100-148`), controller đặt cookie qua `batDauPhien` (`auth.controller.ts:39-49`). Lỗi: 400 Zod; 401 `AUTH.INVALID_CREDENTIALS` / `AUTH.LOGIN_LOCKED` / `AUTH.ACCOUNT_INACTIVE`; 429.

**Đổi:** `data` thêm `phaiDoiMatKhau` (đọc DB); vé mang claim cùng giá trị. Tài khoản đang bị bắt đổi **vẫn đăng nhập thành công 200** (AC-02.2) — chặn nằm ở request kế tiếp.

```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "hoTen": "Kế toán B", "email": "b@x.vn", "role": "OWNER_EMPLOYEE" },
    "companies": [{ "id": "uuid", "maSoThue": "0101234567", "slug": "...", "tenDonVi": "...", "status": "READY" }],
    "activeDonViId": "uuid",
    "modules": { "hrm": true, "accounting": true, "dvc": false, "tokhai": true },
    "phaiDoiMatKhau": true
  }
}
```

### 4.2. `GET /api/v1/auth/me`

**Hiện trạng:** `routes/auth.route.ts:21`, `authenticate`. `loadUserSession` (`auth.service.ts:376-402`), cùng hình dạng login. 401 nếu user không còn/khoá.

**Đổi:**
- Route khai `config: { choPhepKhiPhaiDoiMatKhau: true }`.
- `data` thêm `phaiDoiMatKhau` = **claim của vé đang dùng** (`req.user.phaiDoiMatKhau ?? false`), không phải cột DB. Lý do: FE phải thấy đúng cái mà guard đang áp. Nếu trả giá trị DB, trường hợp đã đổi mật khẩu ở máy khác (DB `false`, vé máy này còn `true` ≤ 15 phút) sẽ làm FE vòng lặp: `/auth/me` bảo `false` → vào app → 403 → sang màn đổi → `/auth/me` bảo `false` → ...

### 4.3. `POST /api/v1/auth/change-password` — MỚI (FR-004, FR-005, E-006)

| Hạng mục | Giá trị |
|---|---|
| Guard | `authenticate` (được phép khi đang bị bắt đổi) |
| Rate limit | `gioiHanTheoNguoiDung(5, '10 minutes')` — chống dò mật khẩu hiện tại bằng phiên đã chiếm |
| CSRF | Access cookie `SameSite=Strict` như mọi route `authenticate` khác |
| Áp cho | Mọi vai trò đã đăng nhập (dùng được cho đổi mật khẩu tự nguyện sau này; đợt này FE chỉ gọi ở màn bắt buộc) |

**Body (Zod `changePasswordSchema` trong `validators/auth.validator.ts`):**

```json
{ "currentPassword": "MậtKhẩuTạmTrongEmail", "newPassword": "matkhaumoi123" }
```

| Field | Rule | Lỗi |
|---|---|---|
| `currentPassword` | `string`, `min(1)` | 400 `fieldErrors.currentPassword` |
| `newPassword` | `passwordRule` sẵn có: ≥ 8, có chữ, có số (`auth.validator.ts:9-13`) | 400 `fieldErrors.newPassword` (E-006) |
| — | `newPassword !== currentPassword` (refine) | 400 `fieldErrors.newPassword` = `VALIDATION.PASSWORD_SAME` (mới) |

**Xử lý:** đọc user (`password`, `isActive`, `phaiDoiMatKhau`) → không còn/khoá: 401 `AUTH.UNAUTHORIZED` → `verifyPassword(currentPassword)` sai: **400** `AUTH.CURRENT_PASSWORD_WRONG` (mới) → `update { password: hash(newPassword), phaiDoiMatKhau: false, tokenVersion +1 }` → `batDauPhien` với claim `false` và `tokenVersion` mới, `donViId` = công ty đang chọn nếu còn quyền → `writeLog CHANGE_PASSWORD { batBuoc }`.

Sai mật khẩu hiện tại trả **400, không phải 401**: 401 làm FE tự refresh rồi gửi lại request (`lib/http.ts:131-145`) → đếm rate limit hai lần và báo lỗi sai.

**Response 200** = đúng hình dạng `GET /auth/me` (FE nạp thẳng vào state, khỏi gọi thêm):

```json
{ "success": true, "data": { "user": {...}, "companies": [...], "activeDonViId": "uuid", "modules": {...}, "phaiDoiMatKhau": false } }
```

| HTTP | Khi nào | Body |
|---|---|---|
| 200 | Đổi xong, cookie mới đã đặt | như trên |
| 400 | Zod (thiếu field, sai chính sách, trùng mật khẩu cũ) | `errors.fieldErrors` |
| 400 | Mật khẩu hiện tại sai | `message: AUTH.CURRENT_PASSWORD_WRONG` |
| 401 | Chưa đăng nhập / tài khoản bị khoá | `message: AUTH.UNAUTHORIZED` |
| 429 | Quá 5 lượt/10 phút | `message: COMMON.TOO_MANY_REQUESTS` |

Hệ quả `tokenVersion+1`: mọi phiên khác của tài khoản (kể cả người đã đăng nhập bằng mật khẩu trong email ở máy khác) mất refresh; access token của họ còn tối đa 15 phút nhưng mang claim `true` nên bị chặn mọi route.

### 4.4. `POST /api/v1/auth/refresh`

**Hiện trạng:** `routes/auth.route.ts:23`, `chanCsrfTheoOrigin`, không `authenticate`. `loadUserForRefresh` (`auth.service.ts:~330`) → `taiUserPhienConHieuLuc` (`select` 4 cột) → payload → `xoayPhien`/`issueTokens` (`auth.controller.ts:82-103`). 200 `{ activeDonViId }`; 401 `AUTH.REFRESH_INVALID`.

**Đổi:** `select` thêm `phaiDoiMatKhau`, payload chép giá trị DB. Response không đổi. Đây là chỗ dễ quên nhất — quên là sau 15 phút tài khoản mới tự "mở khoá".

### 4.5. `POST /api/v1/auth/reset-password` (OTP)

**Hiện trạng:** `resetPasswordWithOtp` (`auth.service.ts:220-285`), 200 `{ message }`, xoá cookie phiên (`auth.controller.ts`).

**Đổi:** `tx.user.update` thêm `phaiDoiMatKhau: false`. Response, lỗi, rate limit không đổi. Xem MT-01.

### 4.6. `POST /api/v1/companies/invite` (FR-002, E-001..003, E-008)

**Hiện trạng — đã hỗ trợ nhiều công ty:**

| Hạng mục | Giá trị | Nguồn |
|---|---|---|
| Guard | `authenticate` + `requireRole('OWNER')`; 20 lượt/giờ/user | `routes/company.route.ts:51-55` |
| Body | `email` (trim, lowercase, email), `hoTen` (1–100, không xuống dòng), `chucVu` (1–100, không xuống dòng), `donViIds: uuid[]` **min 1, không giới hạn trên** | `validators/company.validator.ts:33-47` |
| Sở hữu | `donVi.findMany({ id in donViIds, ownerId })`, lệch số lượng → 403 `COMPANY.NO_ACCESS` | `company.service.ts:248-254` |
| Lưu | `InviteRequest.donViIds` (text[]) nguyên mảng | `company.service.ts:286-296` |
| 201 | `{ id, email, hoTen, chucVu, donViIds, role: "OWNER_EMPLOYEE", status: "PENDING", createdAt }` | `company.service.ts:319-328` |

**Lỗi trùng lặp hiện có:** `donViIds` chứa cùng một id hai lần → `findMany` trả 1 dòng, mảng gửi lên dài 2 → **403 `COMPANY.NO_ACCESS` sai nghĩa** (công ty đó đúng là của owner).

**Đổi:** thêm refine vào `inviteUserSchema`: `new Set(donViIds).size === donViIds.length`, sai → **400** `fieldErrors.donViIds` = `VALIDATION.DON_VI_TRUNG` (mới, "Danh sách công ty bị trùng"). Không đổi gì khác.

Thứ tự lỗi (giữ nguyên): 400 Zod → 403 `AUTH.FORBIDDEN` (không phải OWNER, E-001) → 403 `COMPANY.NO_ACCESS` (có công ty không thuộc owner) → 409 `COMPANY.EMAIL_ALREADY_MEMBER` (E-002) → 409 `COMPANY.INVITE_ALREADY_PENDING` (E-003) → 403 `SUBSCRIPTION.NO_SUBSCRIPTION` → 403 `SUBSCRIPTION.USER_LIMIT_REACHED` → 502 `COMPANY.INVITE_NOTIFY_FAILED` (mail báo admin lỗi, lời mời bị xoá) → 429.

Ghi nhận không đổi: kiểm sở hữu không lọc trạng thái công ty, nên gọi thẳng API mời vào công ty `SUSPENDED` của chính mình vẫn qua; FE không thể chọn vì `GET /companies` đã ẩn công ty đó (`helpers/access.ts:18-20`).

### 4.7. `POST /api/v1/admin/companies/invites/:id/approve` (FR-003, BR-005..007, BR-010, E-004)

**Hiện trạng:** guard hook nhóm `authenticate` + `requireRole('ADMIN')` (`routes/admin/admin.route.ts:50-51, 96`). `adminApproveInvite` (`services/admin/adminInvite.service.ts:55-145`). 200 `{ id, email, hoTen, chucVu }`. Lỗi: 404 `INVITE_NOT_FOUND`; 409 `INVITE_NOT_PENDING`, `EMAIL_ALREADY_MEMBER`; 403 `USER_LIMIT_REACHED`/`NO_SUBSCRIPTION`; 502 `INVITE_WELCOME_MAIL_FAILED`.

**Đổi (response và mã lỗi giữ nguyên):**

1. **Sinh mật khẩu** — hàm mới `sinhMatKhauTam()` trong `be_maxv/src/utils/password.ts`:

   ```ts
   import { randomInt } from 'node:crypto';

   const HOA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';   // 24, bỏ I O
   const THUONG = 'abcdefghijkmnpqrstuvwxyz'; // 24, bỏ l o
   const SO = '23456789';                     // 8, bỏ 0 1
   const TAT_CA = HOA + THUONG + SO;          // 56 ký tự

   /** Mật khẩu tạm 16 ký tự cho tài khoản nhân viên vừa duyệt — ADR-002 phan-quyen-nhan-vien. */
   export function sinhMatKhauTam(): string {
     const kyTu = [HOA, THUONG, SO].map((s) => s[randomInt(s.length)]);
     while (kyTu.length < 16) kyTu.push(TAT_CA[randomInt(TAT_CA.length)]);
     for (let i = kyTu.length - 1; i > 0; i--) {
       const j = randomInt(i + 1);
       [kyTu[i], kyTu[j]] = [kyTu[j], kyTu[i]];
     }
     return kyTu.join('');
   }
   ```

   - `randomInt` của `node:crypto`: ngẫu nhiên mật mã học, phân phối đều (không lệch modulo). Cấm `Math.random`.
   - Bảo đảm ≥ 1 hoa, ≥ 1 thường, ≥ 1 số (BR-005); tự thoả `passwordRule` (≥ 8, có chữ, có số). ≈ 92 bit entropy.
   - Không ký tự đặc biệt, không ký tự dễ nhầm — nhân viên gõ tay từ email.
   - Test tối thiểu (`__tests__/`): 1.000 lần sinh → mọi chuỗi dài 16, đều có hoa/thường/số, đều qua `passwordRule`, không có ký tự ngoài `TAT_CA`.

2. **Luồng** — `data-model.md` Mục 5.1: băm ngoài giao dịch → giao dịch sẵn có tạo `User` với `phaiDoiMatKhau: true` → commit → gửi mail chứa mật khẩu → mail lỗi thì bù trừ.

3. **Gửi email lỗi sau khi đã tạo tài khoản** (E-004, BR-010) — giữ cơ chế bù trừ hiện có (`adminInvite.service.ts:115-130`):

   | Tình huống | Trạng thái để lại | Trả về cho admin | Cách gửi lại |
   |---|---|---|---|
   | SMTP lỗi, bù trừ OK | `User` bị xoá (cascade `DonViAccess`), lời mời về `PENDING`, không có `SysLog APPROVE_INVITE` | **502** `COMPANY.INVITE_WELCOME_MAIL_FAILED` ("Không thể gửi email mật khẩu cho nhân viên, vui lòng thử lại" — câu hiện có đã khớp, không đổi) | Admin bấm **Duyệt** lại cùng lời mời → sinh **mật khẩu mới**. Không cần endpoint "gửi lại". |
   | SMTP báo lỗi nhưng thư thực ra đã đi (timeout sau khi máy chủ nhận) | Như trên | 502 | Duyệt lại → nhân viên nhận email thứ hai; email cũ vô hiệu vì tài khoản cũ đã bị xoá. Nội dung email ghi "chỉ email mới nhất có hiệu lực". |
   | SMTP lỗi, **bù trừ cũng lỗi** (DB rớt) | `User` còn, `phaiDoiMatKhau=true`, mật khẩu không ai biết, lời mời `APPROVED` | 500 `COMMON.INTERNAL_ERROR` | Không duyệt lại được (không còn PENDING). Nhân viên dùng "Quên mật khẩu" (OTP gỡ cờ, Mục 4.5), hoặc ADMIN "Đặt lại mật khẩu" rồi OTP. |

   **Đối chiếu luồng "admin vô hiệu mật khẩu" hiện có** (`adminResetPassword`, `services/admin/adminUser.service.ts:166-~200`): luồng đó **không** hoàn tác khi mail lỗi mà trả 200 `{ email, daGuiEmail: false }`, vì mục đích là khoá ngay tài khoản bị chiếm. Luồng duyệt khác mục đích: tài khoản mới, chưa ai dùng — nên hoàn tác để admin làm lại là đúng (BR-010). Không thống nhất hai luồng; `adminResetPassword` giữ nguyên 100% (BR-011).

4. **Không rò mật khẩu** (BR-007):
   - Response giữ `{ id, email, hoTen, chucVu }`.
   - `SysLog APPROVE_INVITE` giữ nguyên `chiTiet`.
   - Nhánh `catch` quanh `sendMail` không log lỗi gốc (hiện đã vậy, `adminInvite.service.ts:120`); `errorHandler` chỉ log `MailError` (message cố định). Cấm `req.log`/`console` đối tượng mail hoặc `text`.
   - `mailer.service.ts` không có chế độ "in email ra console" (đã kiểm) — không được thêm.

### 4.8. `GET /api/v1/companies/employees` — `[GIẢ ĐỊNH OQ-7]` chỉ OWNER

**Hiện trạng:** `routes/company.route.ts:58-61`, chỉ `authenticate` — **nhân viên cũng gọi được**, đọc được email, SĐT, chức vụ, công ty được cấp và `xemLuong` của mọi đồng nghiệp. `ownerId` từ `resolveAccountOwnerId` (`companyAccess.service.ts:77-90`); ADMIN → 404 `COMPANY.NOT_FOUND`. Service `company.service.ts:332-353`: mảng `createdAt` tăng dần, gồm cả dòng owner.

```json
[
  { "id": "uuid", "hoTen": "Chủ TK", "email": "owner@x.vn", "sdt": null, "chucVu": null, "role": "OWNER",
    "status": "ACTIVE", "isActive": true, "createdAt": "...", "donViAccess": [] },
  { "id": "uuid", "hoTen": "Kế toán B", "email": "b@x.vn", "sdt": null, "chucVu": "Kế toán", "role": "OWNER_EMPLOYEE",
    "status": "ACTIVE", "isActive": true, "createdAt": "...", "donViAccess": [{ "donViId": "uuid", "xemLuong": false }] }
]
```

**Đổi (nếu OQ-7 chốt theo đề xuất):** guard thành `[app.authenticate, app.requireRole('OWNER')]`. Nhân viên gọi → **403** `AUTH.FORBIDDEN` (E-001). ADMIN → 403 (trước là 404). Response của OWNER không đổi hình dạng, không thêm field.

**Nếu OQ-7 chốt "không siết":** giữ nguyên hiện trạng; không ảnh hưởng FE mới (chỉ owner mở màn).

### 4.9. `GET /api/v1/companies/invites` — không đổi

`routes/company.route.ts:64-67`, chỉ `authenticate`. Mảng mọi trạng thái, `createdAt` giảm dần: `{ id, email, hoTen, chucVu, donViIds, role, status, lyDoTuChoi, createdAt, resolvedAt }` (`company.service.ts:356-375`). ADMIN → 404. FE tự lọc `status === "PENDING"`. Vẫn mở cho nhân viên — xem MT-08.

### 4.10. `PUT /api/v1/companies/employees/:userId/access` (FR-009..011, BR-012..014, NFR-004, E-009, E-010)

**Hiện trạng:**

| Hạng mục | Giá trị | Nguồn |
|---|---|---|
| Guard | `authenticate` + `requireRole('OWNER')`, không rate limit | `routes/company.route.ts:70-73` |
| Params | `userId` không validate uuid; chuỗi lạ → không tìm thấy → 404 | `company.controller.ts:151` |
| Body | `access?: [{ donViId: uuid, xemLuong?: boolean }]` **hoặc** dạng cũ `donViIds?: uuid[]`; ít nhất một; transform về `access` | `validators/company.validator.ts:62-82` |
| Kiểm | Nhân viên tồn tại + `ownerId` = người gọi + `role = OWNER_EMPLOYEE`, sai → 404 `USER.NOT_FOUND`; mọi `donViId` thuộc owner, sai → 403 `COMPANY.NO_ACCESS` | `company.service.ts:402-424` |
| Ghi | Giao dịch: xoá cặp không còn trong danh sách; `upsert` từng cặp. `xemLuong` vắng = giữ cờ cũ (cặp đã có) / `false` (cặp mới) | `company.service.ts:426-452` |
| Nhật ký | `SET_EMPLOYEE_ACCESS { employeeId, access }` | `company.service.ts:454-466` |
| 200 | `{ "userId": "uuid", "donViIds": ["uuid"], "so_cong_ty": 1 }` | `company.service.ts:470` |

**Thu hồi hết công ty (BR-013, AC-04.3):** `{ "access": [] }` → xoá mọi `DonViAccess` của nhân viên (nhánh `donViIds.length === 0`, dòng 429-434), 200 `{ userId, donViIds: [], so_cong_ty: 0 }`. `User` còn nguyên, vẫn đăng nhập được, `GET /companies` trả `[]`. Hộp thoại xác nhận là việc của FE (FR-010), BE không đòi cờ xác nhận.

**BR-014 (xem lương theo cặp) — khớp hiện trạng, không cần sửa BE:** công ty bị bỏ khỏi `access` thì dòng `DonViAccess` bị xoá → mất luôn `xemLuong`; tick lại là tạo dòng mới → `xemLuong` = giá trị FE gửi, vắng thì `false` ("không nhớ giá trị cũ", states.md). BE **không** chặn `xemLuong: true` đi kèm công ty — ràng buộc "chỉ bật khi đã tick công ty" tự đúng vì không có cặp nào ngoài `access`.

**Đổi:**

1. **Khoá chống deadlock (NFR-004, EC-10):** câu đầu tiên trong `$transaction` là `await khoaHanMuc(tx, 'nhan_vien', ownerId)` — **tái dùng** khoá advisory theo owner của lời mời/duyệt. Hai lượt lưu song song không còn 500; tuần tự, người ghi sau thắng. Chi tiết `data-model.md` Mục 5.4.
2. **Trùng công ty trả 400:** refine trên `access` (và `donViIds` dạng cũ): mỗi `donViId` xuất hiện một lần, sai → **400** `fieldErrors.access` = `VALIDATION.DON_VI_TRUNG`. Hiện tại trả 403 `COMPANY.NO_ACCESS` sai nghĩa (cùng nguyên nhân Mục 4.6) — và nếu hai dòng trùng mang `xemLuong` khác nhau thì ý định vốn đã mơ hồ.

Response, mã lỗi khác, hình dạng body: không đổi.

**Thứ tự lỗi:** 401 → 403 `AUTH.FORBIDDEN` (E-001) → 400 Zod (validate ở controller, trước service) → 404 `USER.NOT_FOUND` (E-009) → 403 `COMPANY.NO_ACCESS` (E-010) → 409 `COMMON.STILL_REFERENCED` (công ty bị xoá đúng lúc ghi, P2003) → 200.

### 4.11. Nhân viên đang mở công ty vừa bị thu hồi (AC-03.3, AC-04.2, EC-04a, EC-06)

**BE — đã kiểm lại, đúng như BA mô tả:** mọi route dữ liệu tenant tra quyền trong DB mỗi request qua `resolveTenantInfo`/`resolveTenantDb`/`resolveTenantCtx` (`helpers/resolveTenantDb.ts:50-101`) → `accessibleDonViWhere` (`helpers/access.ts:22-29`). Các controller đọc thẳng `req.user.donViId` (`hddt/gdt.controller.ts`, `dich_vu_cong/gdt-dvc.controller.ts`, vài controller HRM) đều gọi hàm tra quyền trước hoặc chỉ dùng `donViId` sau khi đã qua `resolveTenant*` (spot-check `payrollClosing.controller.ts:40-43`, `taxDeclaration.controller.ts:43-46`). Không có đường tắt.

| Thời điểm | Vé của nhân viên | Kết quả |
|---|---|---|
| Request kế tiếp sau khi owner lưu | `donViId = X` (vé cũ, chưa hết hạn) | **403** `COMPANY.NO_ACCESS` ngay — không chờ tải lại trang |
| Khi vé hết hạn (≤ 15 phút) và FE refresh | `loadUserForRefresh` bỏ `donViId` không còn quyền → `donViId = null` | Route tenant trả 403 `COMPANY.NO_COMPANY` |
| `GET /auth/me` / tải lại trang | `activeDonViId` rơi về công ty đầu tiên còn quyền (`auth.service.ts:386-389`) | FE bootstrap gọi `switch` sang công ty đó (`AuthContext.tsx:61-63`) |

**Đổi BE:** 4 chỗ ném `COMPANY.NO_ACCESS` khi kiểm công ty đang chọn trong vé (liệt kê ở Mục 1.2) truyền thêm `code: "COMPANY_NO_ACCESS"`. Các chỗ `NO_ACCESS` khác (`company.service.ts:253` mời, `:422` sửa quyền, `company.controller.ts:78` switch) **không** gắn code — đó là lỗi thao tác, không phải phiên bị lệch. `hddt/gdt.controller.ts` không ném lỗi này (tự trả `null` khi hết quyền, dòng 36-43) — giữ nguyên.

**FE:** Mục 6, F-4.

## 5. Nội dung email mật khẩu tạm (thay `inviteApprovedEmail`)

`helpers/mailTemplates.ts` — giữ tên hàm, đổi input thành `{ email, matKhauTam, congTy }`. Nội dung tối thiểu (câu chữ cụ thể BA/anh chỉnh):

```
Tiêu đề: Tài khoản nhân viên MaxV của bạn

Tài khoản nhân viên MaxV của bạn đã được duyệt.
Công ty được cấp: <Tên A (MST A)>, <Tên B (MST B)>
Email đăng nhập: <email>
Mật khẩu tạm: <matKhauTam>

Ở lần đăng nhập đầu tiên, hệ thống sẽ yêu cầu bạn đổi sang mật khẩu mới. Mật khẩu tạm không dùng được nữa sau khi đổi.
Không chuyển tiếp email này. Sau khi đổi mật khẩu, hãy xoá email này.
Nếu bạn nhận được nhiều email loại này, chỉ email mới nhất có hiệu lực.
Nếu bạn không mong đợi email này, hãy bỏ qua và báo cho người quản lý của bạn.
```

Không kèm link (hệ thống hiện chưa có biến môi trường URL ứng dụng; email hiện có cũng không có link). Sửa câu "MaxV không bao giờ gửi mật khẩu qua email." trong `HUONG_DAN_DAT_MAT_KHAU` — xem ADR-002 bảng docstring.

## 6. Contract phía FE `hdđt_maxv`

### 6.1. Màn và endpoint

| Màn / thành phần | Ai thấy | Gọi | Sau khi ghi thành công |
|---|---|---|---|
| Đăng nhập (`LoginForm`) | Khách | `POST /auth/login` | Lưu `phaiDoiMatKhau` vào `AuthContext` |
| Bootstrap (`AuthContext`) | Mọi người | `GET /auth/me`; nếu `phaiDoiMatKhau === false` và có `activeDonViId` thì `POST /companies/:id/switch` như hiện tại (`AuthContext.tsx:61-63`) | — |
| **Đổi mật khẩu bắt buộc** (route mới, vd `/doi-mat-khau`) | Người có `phaiDoiMatKhau === true` | `POST /auth/change-password` (3 ô: mật khẩu tạm, mật khẩu mới, nhập lại — "nhập lại" chỉ kiểm ở FE); nút Đăng xuất gọi `POST /auth/logout` | Nạp `data` vào state như login, `queryClient.clear()`, điều hướng `/` |
| Cài đặt → mục "Nhân viên" (thêm vào `NAV_ITEMS`, `SettingsPage.tsx:21-26`) | Chỉ `user.role === "OWNER"` (FR-008) | `GET /companies/employees`; `GET /companies/invites` (lọc PENDING); danh sách công ty của owner lấy từ `companies` trong `AuthContext` (đã là `GET /companies` lọc sẵn) | — |
| Dialog "Thêm nhân viên" | Owner | `POST /companies/invite` với `donViIds` = các công ty đã tick; mặc định tick `currentCompanyId`; không tick nào thì chặn ở FE, không gọi API (AC-01.6) | Invalidate query lời mời |
| Panel "Sửa quyền" | Owner | `PUT /companies/employees/:userId/access` với `access` = mọi công ty đang tick, **luôn gửi `xemLuong` tường minh** theo ô tick; ô "Xem lương" disabled khi dòng đó chưa tick công ty (BR-014); bỏ tick hết thì hộp thoại xác nhận trước khi gửi `access: []` (FR-010) | Invalidate query nhân viên |

Query key gắn `user.id` theo pattern `companyKeys.list(userId)` (`features/company/api/companyApi.ts:15-18`), vd `["company-employees", userId]`, `["company-invites", userId]`, để không rò giữa hai phiên đăng nhập trên cùng máy.

### 6.2. Quy tắc điều hướng và xử lý lỗi

| # | Quy tắc |
|---|---|
| F-1 | `ProtectedRoute` (`routes/ProtectedRoute.tsx`): đã đăng nhập và `phaiDoiMatKhau === true` → `<Navigate to="/doi-mat-khau">`, trừ khi đang ở chính route đó. Route `/doi-mat-khau` cần đăng nhập nhưng không bị chuyển hướng vòng. |
| F-2 | `lib/http.ts`: response 403 có `code === "PASSWORD_CHANGE_REQUIRED"` → gọi handler toàn cục (cùng kiểu `setSessionExpiredHandler`, `http.ts:60-63`) → `AuthContext` đặt `phaiDoiMatKhau = true` → F-1 tự chuyển màn. Không gọi refresh, không đăng xuất. |
| F-3 | Lỗi form đổi mật khẩu: 400 có `errors.fieldErrors` → gắn vào đúng ô; 400 có `message` (mật khẩu hiện tại sai) → gắn ô mật khẩu tạm; 429 → thông báo chung. Khoá nút khi đang gửi. |
| F-4 | Response 403 có `code === "COMPANY_NO_ACCESS"` → handler toàn cục chạy **single-flight** đúng quy trình bootstrap: `GET /auth/me` → cập nhật `companies` → nếu `activeDonViId` khác `currentCompanyId`: `queryClient.clear()`, gọi `switch` sang `activeDonViId` (nếu khác `null`), cập nhật `currentCompanyId`. Không còn công ty nào → header ẩn bộ chọn (hành vi hiện có, thông báo riêng chờ OQ-8). Lỗi vẫn ném tiếp cho nơi gọi hiển thị `message`. |
| F-5 | Dialog mời: 409 → gắn ô email; 400 `fieldErrors.donViIds` → gắn nhóm checkbox; 403/502/429 → thông báo chung đọc `message`. |
| F-6 | Panel sửa quyền: 404 (nhân viên không còn thuộc tài khoản) → đóng panel + invalidate danh sách; 403 → thông báo chung. |
| F-7 | Không polling. Danh sách nhân viên/lời mời chỉ làm mới khi mở màn (theo `staleTime` mặc định toàn app) và sau mỗi lượt ghi của owner. Lời mời do ADMIN duyệt ở `maxv/` hiện ở màn owner khi owner mở lại màn hoặc hết `staleTime`. |

## 7. Ma trận lỗi (spec ↔ HTTP ↔ `MESSAGES`)

| Mã spec | HTTP | `code` | `MESSAGES` | Endpoint |
|---|---|---|---|---|
| E-001 | 403 | — | `AUTH.FORBIDDEN` | invite, PUT access, GET employees `[GIẢ ĐỊNH OQ-7]` |
| E-002 | 409 | — | `COMPANY.EMAIL_ALREADY_MEMBER` | invite, approve |
| E-003 | 409 | — | `COMPANY.INVITE_ALREADY_PENDING` | invite |
| E-004 | 502 | — | `COMPANY.INVITE_WELCOME_MAIL_FAILED` (giữ nguyên câu) | approve |
| E-005 | 403 | `PASSWORD_CHANGE_REQUIRED` | `AUTH.PASSWORD_CHANGE_REQUIRED` (**mới**) | mọi route `authenticate` trừ whitelist |
| E-006 | 400 | — | `fieldErrors.newPassword` (`passwordRule`) | change-password |
| E-007 | 403 | `COMPANY_NO_ACCESS` (route tenant) | `COMPANY.NO_ACCESS` | route tenant, switch (không `code`) |
| E-008 | 400 | — | `fieldErrors.donViIds` (min 1) | invite |
| E-009 | 404 | — | `USER.NOT_FOUND` | PUT access |
| E-010 | 403 | — | `COMPANY.NO_ACCESS` | invite, PUT access |
| (mới) | 400 | — | `AUTH.CURRENT_PASSWORD_WRONG` | change-password |
| (mới) | 400 | — | `VALIDATION.PASSWORD_SAME` | change-password |
| (mới) | 400 | — | `VALIDATION.DON_VI_TRUNG` | invite, PUT access |
| (có sẵn, spec chưa liệt kê) | 403 | — | `SUBSCRIPTION.USER_LIMIT_REACHED`, `SUBSCRIPTION.NO_SUBSCRIPTION` | invite, approve |
| (có sẵn, spec chưa liệt kê) | 502 | — | `COMPANY.INVITE_NOTIFY_FAILED` | invite |
| (có sẵn, spec chưa liệt kê) | 429 | — | `COMMON.TOO_MANY_REQUESTS` | invite (20/giờ), change-password (5/10 phút) |

## 8. Tương thích ngược

| Client | Ảnh hưởng | Xử lý |
|---|---|---|
| `maxv/` — duyệt lời mời (`features/invites/api/invitesApi.ts:11-15`, `ApproveInviteDialog.tsx`) | Response duyệt không đổi. Câu "Hệ thống sẽ tạo tài khoản và gửi mật khẩu đăng nhập qua email" (dòng 37-40) nay **đúng** trở lại; thông báo lỗi "có thể do gửi email thất bại, vui lòng thử lại" khớp cơ chế bù trừ. | Không sửa. |
| `fe_maxv/` — `EmployeesSettingsPage.tsx` gọi `GET /companies/employees` + `/companies/invites` cho **mọi vai trò** (nhân viên xem bảng chỉ đọc) | `[GIẢ ĐỊNH OQ-7]` Nhân viên mở trang này sẽ nhận 403 → bảng lỗi/rỗng. Owner không ảnh hưởng. | Chấp nhận nếu OQ-7 chốt (nhân viên không có nhu cầu), hoặc ẩn trang với nhân viên ở `fe_maxv`. |
| `fe_maxv/` — `InviteEmployeeDialog` gửi `donViIds: [current.id]` | Không ảnh hưởng (một phần tử, không trùng). | Không sửa. |
| `fe_maxv/` — đăng nhập | Nhân viên **mới** (duyệt sau triển khai) đăng nhập ở `fe_maxv` sẽ nhận 403 `PASSWORD_CHANGE_REQUIRED` ở mọi request, `fe_maxv` không có màn đổi mật khẩu và không đọc `code` → kẹt, chỉ thấy message. Refresh của `fe_maxv` không bị ảnh hưởng (refresh không qua `authenticate`). | Nhân viên đổi mật khẩu ở `hdđt_maxv` một lần là dùng được `fe_maxv`. Ghi rõ trong email hoặc hướng dẫn nội bộ. |
| Vé đăng nhập đang sống lúc triển khai | Không có claim → coi `false`. | Không ai bị đá ra. |
| Test BE mock `sysPrisma.user.findUnique` | Kết quả mock thiếu `phaiDoiMatKhau` → `undefined` → coi `false`. | Không vỡ test cũ; thêm test mới cho nhánh `true`. |

## 9. Mâu thuẫn với spec (không sửa file BA — chờ BA/anh chốt)

| ID | Spec nói | Thực tế / đề xuất Architect | Cần ai |
|---|---|---|---|
| MT-01 | BR-011: luồng "Quên mật khẩu" (OTP) **giữ nguyên 100%** | Phải thêm `phaiDoiMatKhau: false` vào `resetPasswordWithOtp`. Không làm thì nhân viên mất email, tự đặt lại bằng OTP xong vẫn bị kẹt ở màn đổi mật khẩu. Hành vi và response OTP không đổi. | BA |
| MT-02 | FR-004 / states.md: chặn mọi request "trừ API đổi mật khẩu và đăng xuất" | Phải cho thêm `GET /auth/me` (FE cần để khôi phục phiên sau khi tải lại trang). Refresh/logout/login/OTP vốn không qua guard. | BA |
| MT-03 | E-006: chỉ kiểm `passwordRule` | Thêm: bắt nhập mật khẩu hiện tại (sai → 400 `CURRENT_PASSWORD_WRONG`), mật khẩu mới phải khác mật khẩu hiện tại (400 `PASSWORD_SAME`). Lý do: phiên bị chiếm không đổi được mật khẩu; tránh "đổi" sang chính mật khẩu đang nằm trong email. | BA |
| MT-04 | E-005 "403 `PASSWORD_CHANGE_REQUIRED`" | BE hiện **không có field `code`** trong body lỗi; contract thêm `code` cho 403 (Mục 1.2). | BA (ghi nhận) |
| MT-05 | E-004: "đổi thông điệp lỗi cho khớp nội dung email mới" | Câu hiện có `INVITE_WELCOME_MAIL_FAILED` đã là "Không thể gửi email mật khẩu cho nhân viên, vui lòng thử lại" — khớp rồi, **không đổi**. | — (ghi chú) |
| MT-06 | EC-06/AC-03.3: FE chỉ cập nhật công ty khi gọi lại `GET /companies` hoặc tải lại trang, chấp nhận trễ | F-4 đồng bộ lại ngay ở lượt 403 `COMPANY_NO_ACCESS` đầu tiên (header đổi công ty/ẩn bộ chọn). Vế BE "chặn ngay" giữ nguyên; vế FE tốt hơn mức spec chấp nhận — QA viết AC theo hành vi mới. | BA + QA |
| MT-07 | Error Matrix không có trường hợp trùng công ty | `donViIds`/`access` trùng công ty: hiện 403 `NO_ACCESS` (sai nghĩa) → đổi thành 400 `DON_VI_TRUNG`. | BA |
| MT-08 | OQ-7 chỉ nói `GET /companies/employees` | `GET /companies/invites` cũng mở cho nhân viên (lộ email, họ tên, chức vụ người được mời, công ty). Siết một mà không siết cái kia là lệch. Đề xuất: nếu chốt OQ-7 thì siết cả hai cùng lúc. | Anh |
| MT-09 | flows.md sequence: duyệt → "Sinh mat khau" → "Transaction: INSERT User" | Thực tế băm bcrypt **trước** giao dịch (không giữ khoá lúc băm); chiếm lời mời + tạo `User` cùng một giao dịch. Thứ tự khác, kết quả nghiệp vụ như nhau. | — (ghi chú) |
| MT-10 | Spec không nói mật khẩu tạm có hết hạn không | Không hết hạn = nhân viên không bao giờ đăng nhập thì mật khẩu dùng được mãi trong hộp thư, và kẻ đọc được email trước có thể chiếm tài khoản (ADR-002 "Rủi ro còn lại"). Đề xuất BA mở câu hỏi mới: có thời hạn (vd 7 ngày) không? Nếu có, đổi kiểu cột **trước khi code** (`data-model.md` Mục 2). | BA + anh |
| MT-11 | AC-02.4: "không để lại tài khoản không ai biết mật khẩu" | Chỉ đúng khi giao dịch bù trừ chạy được. Nếu DB lỗi đúng lúc đó, tài khoản còn lại — khôi phục bằng OTP hoặc ADMIN đặt lại (Mục 4.7 bảng). | QA (ghi nhận) |
| MT-12 | Spec không nói về `fe_maxv` khi bật cờ | Nhân viên mới đăng nhập ở `fe_maxv` bị kẹt vì app đó không có màn đổi mật khẩu (Mục 8). | Anh |
| MT-13 | (hiện trạng, ngoài spec) Duyệt lời mời mà một công ty trong `donViIds` đã bị owner xoá cứng | `donViAccess.createMany` vi phạm khoá ngoại → giao dịch rollback (lời mời vẫn PENDING, đúng) nhưng admin nhận 409 `COMMON.STILL_REFERENCED` khó hiểu. Khả năng tăng khi mời nhiều công ty. Đề xuất: lúc duyệt chỉ tạo `DonViAccess` cho công ty còn tồn tại và còn thuộc owner (lấy từ truy vấn `congTy` sẵn có, thêm lọc `ownerId`). | BA |

## 10. Ca biên chuyển Tester-QA

1. Duyệt → email có mật khẩu 16 ký tự đủ hoa/thường/số; response duyệt và `SysLog` không chứa mật khẩu; log server không chứa mật khẩu.
2. Đăng nhập bằng mật khẩu tạm → 200 `phaiDoiMatKhau: true`; gọi `GET /companies`, `POST /companies/:id/switch`, một route HĐĐT, một route admin bất kỳ → 403 `PASSWORD_CHANGE_REQUIRED`; `GET /auth/me` → 200; `POST /auth/logout` → 200.
3. **Sau 15 phút** (hoặc ép hết hạn access token) → `POST /auth/refresh` → vé mới vẫn bị chặn (claim phải lấy từ DB). Tương tự sau khi cấp lại vé giữa phiên.
4. Đổi mật khẩu: sai mật khẩu tạm → 400 (không phải 401, FE không tự refresh); mật khẩu mới trùng mật khẩu tạm → 400; mật khẩu mới `abcdefgh` → 400; hợp lệ → 200, cookie mới, mọi route mở, đăng nhập lần sau `phaiDoiMatKhau: false` (AC-02.3).
5. Đăng nhập mật khẩu tạm ở hai trình duyệt A, B; A đổi mật khẩu → B vẫn bị 403 mọi route, `/auth/me` của B trả `true`, refresh của B → 401.
6. Tài khoản đang bị bắt đổi dùng "Quên mật khẩu" (OTP) → đăng nhập lại → `phaiDoiMatKhau: false`.
7. SMTP lỗi khi duyệt → 502, `User` không tồn tại, lời mời PENDING, không có `APPROVE_INVITE`; duyệt lại khi SMTP ổn → mật khẩu khác lần trước.
8. Hai admin bấm duyệt cùng lúc → một 200, một 409, chỉ một email.
9. Mời `donViIds` = [X, Y] → duyệt → nhân viên thấy đúng X, Y. `donViIds` = [X, X] → 400. `donViIds` có công ty của owner khác → 403.
10. `PUT access` hai lượt song song, tập công ty khác nhau → không có 500. `access` trùng → 400. `access: []` → 200, nhân viên đăng nhập được, `GET /companies` = `[]`.
11. Nhân viên đang mở X, owner bỏ X → request tenant kế tiếp 403 có `code: "COMPANY_NO_ACCESS"`; `POST /companies/X/switch` → 403 không có `code`.
12. Bỏ X rồi tick lại X không gửi `xemLuong` → `xemLuong = false` (BR-014, không nhớ giá trị cũ).
13. `[GIẢ ĐỊNH OQ-7]` Nhân viên gọi `GET /companies/employees` → 403; ADMIN → 403.
14. Tài khoản cũ (trước triển khai) và owner mới đăng ký → không bao giờ bị bắt đổi mật khẩu.
