---
type: data-model
feature: phan-quyen-nhan-vien
status: draft
updated: 2026-09-17
links:
  - docs/phan-quyen-nhan-vien/srs/phan-quyen-nhan-vien-spec.md
  - docs/phan-quyen-nhan-vien/srs/phan-quyen-nhan-vien-erd.md
  - docs/phan-quyen-nhan-vien/architecture/api-contract.md
  - docs/phan-quyen-nhan-vien/architecture/adr/ADR-002-gui-mat-khau-qua-email-va-bat-doi-lan-dau.md
  - docs/hrm/architecture/adr/ADR-007-pham-vi-quyen-xem-du-lieu-luong.md
---

# Data Model — Phân quyền nhân viên (mời qua email + đúng công ty được cấp)

> Viết lại 2026-09-17 theo phạm vi vòng 2. Bản vòng 1 (`User.modules`) đã huỷ — xem ADR-001 (Rejected).

**Phân vùng:** chỉ `be_maxv/prisma/sys/schema.prisma` (DB `maxv2_sys`). `prisma/tenant/schema.prisma`: **không đổi**.

## 1. Tóm tắt thay đổi

| ID | Bảng | Thay đổi |
|---|---|---|
| M-01 | `users` | Thêm `phaiDoiMatKhau BOOLEAN NOT NULL DEFAULT false` |

Không bảng mới, không index mới, không đổi enum. `DonViAccess` (kể cả `xemLuong`), `InviteRequest`, `SysLog`: **không đổi schema**.

## 2. Cờ "phải đổi mật khẩu" — kiểu dữ liệu

| Phương án | Đánh giá |
|---|---|
| **`Boolean NOT NULL DEFAULT false`** | **Chọn.** Đúng 2 trạng thái nghiệp vụ (`PhaiDoiMatKhau`/`BinhThuong`, states.md). `NOT NULL` + default → user cũ tự nhận `false`, không có trạng thái thứ ba "chưa biết". |
| `DateTime?` (vd `matKhauTamHetHan`) | Cho được thêm "mật khẩu tạm hết hạn". Không có trong spec → không chọn; nếu BA chốt thêm thời hạn (`api-contract.md` MT-10) thì đổi sang kiểu này **trước khi code**, không thêm cột thứ hai. |
| Suy ra từ trường có sẵn (vd `tokenVersion = 0`) | Sai: owner đăng ký mới cũng có `tokenVersion = 0`; ghép nghĩa vào cột khác là bẫy. |
| Enum trạng thái mật khẩu | Thừa cho 2 giá trị. |

Tên cột theo quy ước tiếng Việt không dấu đang dùng ở sys schema (`xemLuong`, `chucVu`, `hoTen`).

## 3. Schema Prisma (`prisma/sys/schema.prisma`, model `User`)

Thêm ngay sau `tokenVersion`:

```prisma
  /// true = tài khoản đang dùng mật khẩu tạm hệ thống gửi qua email khi duyệt lời mời — phải đổi
  /// trước khi dùng bất kỳ chức năng nào (ADR-002 phan-quyen-nhan-vien, BR-005/006).
  /// Bật true DUY NHẤT ở adminApproveInvite. Gỡ về false ở: đổi mật khẩu (POST /auth/change-password)
  /// và đặt lại bằng OTP. Được chép vào access token lúc phát vé; `authenticate` chặn theo claim.
  phaiDoiMatKhau Boolean @default(false)
```

## 4. Migration

### 4.1. Tạo

```bash
npm run migrate:sys -- --create-only --name add_phai_doi_mat_khau_to_user
```

`migration.sql` mong đợi (Prisma tự sinh đúng, không cần sửa tay):

```sql
-- ADR-002 phan-quyen-nhan-vien, M-01.
-- AlterTable
ALTER TABLE "users" ADD COLUMN "phaiDoiMatKhau" BOOLEAN NOT NULL DEFAULT false;
```

- **User cũ = `false`**, không có bước chuyển dữ liệu: không ai bị bắt đổi mật khẩu ngoài ý muốn (erd.md "Ghi chú").
- Nhân viên đã được duyệt **trước** khi triển khai: vẫn `false` — họ đã tự đặt mật khẩu qua OTP theo cơ chế cũ, đúng.
- Khoá bảng: `ADD COLUMN ... NOT NULL DEFAULT <hằng>` là thao tác metadata từ PostgreSQL 11, không ghi lại bảng.

### 4.2. Thứ tự triển khai

1. `npm run migrate:sys:prod` — code cũ không đọc cột, không ảnh hưởng.
2. Deploy `hdđt_maxv` — FE mới coi `phaiDoiMatKhau` vắng mặt là `false`, an toàn khi BE còn cũ.
3. Deploy `be_maxv`.

Đảo 2 và 3 thì có cửa sổ: nhân viên được duyệt sau khi BE lên nhưng FE còn cũ sẽ kẹt 403 ở mọi màn (không có trang đổi mật khẩu).

### 4.3. Rollback

| Mức | Cách làm | Hệ quả |
|---|---|---|
| Gỡ code `be_maxv` (giữ cột) | Deploy lại bản trước | Code cũ không đọc cột/claim → nhân viên đang `phaiDoiMatKhau=true` dùng tiếp mật khẩu tạm, **không bị bắt đổi** (mở khoá). Luồng duyệt quay lại mật khẩu không ai biết. Deploy lại bản mới là cờ có hiệu lực lại (dữ liệu còn). Ưu tiên mức này. |
| Gỡ cột | Migration tiến `<ts>_drop_phai_doi_mat_khau`: `ALTER TABLE "users" DROP COLUMN "phaiDoiMatKhau";` | Mất danh sách tài khoản còn dùng mật khẩu tạm. Trước khi chạy lưu lại: `SELECT id, email FROM users WHERE "phaiDoiMatKhau" = true;` (để admin đặt lại mật khẩu các tài khoản đó nếu cần). |

## 5. Transaction, concurrency, consistency

### 5.1. Duyệt lời mời — `adminApproveInvite` (mở rộng `adminInvite.service.ts:55-145`)

| Bước | Trong/ngoài giao dịch | Nội dung |
|---|---|---|
| 1 | ngoài | `getPendingOrThrow`, kiểm email chưa có `User`, lấy tên công ty (như hiện tại) |
| 2 | ngoài | `matKhauTam = sinhMatKhauTam()`; `passwordHash = await hashPassword(matKhauTam)` — bcrypt ~100 ms, **không** giữ khoá/giao dịch trong lúc băm (thay chỗ `bamMatKhauKhongAiBiet()` dòng 72) |
| 3 | **trong** | Chiếm lời mời `updateMany where status=PENDING` → `khoaHanMuc('nhan_vien')` → kiểm trần → `user.create({ ..., password: passwordHash, phaiDoiMatKhau: true })` → `donViAccess.createMany` (như hiện tại) |
| 4 | ngoài, **sau commit** | `sendMail(inviteApprovedEmail({ email, matKhauTam, congTy }))` |
| 5a | mail OK | `writeLog APPROVE_INVITE` (chiTiet giữ nguyên — không có mật khẩu) → 200 |
| 5b | mail lỗi | Giao dịch bù trừ sẵn có: xoá `User` (cascade `DonViAccess`) + lời mời về PENDING → 502 `COMPANY.INVITE_WELCOME_MAIL_FAILED` |

Vì sao gửi mail **sau** commit: gửi trong giao dịch là giữ khoá advisory + transaction suốt thời gian SMTP (timeout tới 20 s, `mailer.service.ts:22-24`); và nếu commit hỏng sau khi mail đã đi thì nhân viên cầm mật khẩu của tài khoản không tồn tại.

Nếu **giao dịch bù trừ cũng hỏng** (DB rớt đúng lúc): tài khoản còn lại với `phaiDoiMatKhau=true`, mật khẩu không ai biết, lời mời APPROVED, admin nhận 500. Khôi phục bằng luồng sẵn có: nhân viên dùng "Quên mật khẩu" (OTP gỡ cờ, Mục 5.3) hoặc ADMIN "Đặt lại mật khẩu" rồi OTP. Không thêm cơ chế riêng.

Hai admin duyệt cùng một lời mời: bước 3 chiếm lời mời có điều kiện → người sau nhận 409 `INVITE_NOT_PENDING` **trước khi** tạo tài khoản, không có email thứ hai (như hiện tại).

### 5.2. Đổi mật khẩu — `POST /auth/change-password` (mới)

Một câu `user.update({ password: hashMoi, phaiDoiMatKhau: false, tokenVersion: { increment: 1 } })` — nguyên tử ở mức dòng, không cần `$transaction`. Sau đó cấp phiên mới (`batDauPhien`) với `tokenVersion` vừa tăng và claim `false`.

Bỏ qua có chủ ý: hai lượt đổi song song của cùng người (hai tab bấm cùng lúc) — cả hai qua kiểm mật khẩu hiện tại, `tokenVersion` tăng 2, cookie của lượt về sau có thể mang version cũ hơn → bị đăng xuất ở lần refresh kế tiếp (≤ 15 phút). FE khoá nút khi đang gửi. Thêm `updateMany where tokenVersion = cũ` nếu thấy xảy ra thật.

### 5.3. Đặt lại bằng OTP — `resetPasswordWithOtp`

Thêm `phaiDoiMatKhau: false` vào đúng `tx.user.update` sẵn có (`auth.service.ts:275-278`). Không đổi giao dịch, không đổi response.

`adminResetPassword` **không** đụng cờ: nó đặt mật khẩu không ai biết, người dùng buộc phải qua OTP — OTP gỡ cờ.

### 5.4. Sửa quyền công ty — `PUT /companies/employees/:userId/access` (NFR-004)

Mở rộng `company.service.ts:426-452`: câu **đầu tiên** trong `sysPrisma.$transaction` là `await khoaHanMuc(tx, 'nhan_vien', ownerId)` (tái dùng `limits.service.ts:37-43`, cùng khoá với mời/duyệt của owner đó). Phần xoá cặp + `upsert` giữ nguyên.

Vì sao: hai lượt lưu song song cho cùng nhân viên với hai tập công ty khác nhau — lượt 1 xoá cặp B rồi cập nhật A, lượt 2 xoá A rồi cập nhật B → khoá chéo dòng → Postgres huỷ một bên (deadlock) → Prisma ném lỗi `errorHandler.plugin.ts` không ánh xạ (chỉ P2002/P2003/P2025) → **500**. Có khoá: tuần tự, người ghi sau thắng, kết quả bằng đúng một trong hai body.

Bỏ qua có chủ ý: khoá lạc quan chống "form cũ ở tab khác lưu đè". Một tài khoản một owner, sửa hiếm.

Consistency của thu hồi: `DonViAccess` bị xoá là **request tenant kế tiếp** của nhân viên bị chặn 403, vì `resolveTenantInfo` (`helpers/resolveTenantDb.ts:50-89`) và `canAccessDonVi` (`helpers/access.ts:32-45`) tra DB mỗi request, không đọc quyền từ JWT (đã kiểm lại, khớp BA `CONTEXT_SUMMARY.md` Mục 3.3).

## 6. Dữ liệu trong vé đăng nhập (không phải DB, ghi ở đây để đủ bức tranh)

Access token + refresh token thêm claim `phaiDoiMatKhau: boolean`, **luôn** đọc từ `users.phaiDoiMatKhau` tại mọi chỗ phát vé:

| Chỗ phát vé | Nguồn user | Việc phải làm |
|---|---|---|
| Đăng nhập — `auth.controller.ts:39-49` → `batDauPhien` | `loginUser` (`findUnique` không `select`, đã có cột) | Chép `user.phaiDoiMatKhau` |
| Làm mới — `auth.controller.ts:82-103` | `loadUserForRefresh` → `taiUserPhienConHieuLuc` (`auth.service.ts:296-313`, `select` 4 cột) | Thêm `phaiDoiMatKhau: true` vào `select`, trả ra, chép vào payload |
| Cấp lại giữa phiên (đổi/tạo/xoá công ty) — `authTokens.ts:61-77` | `loadUserForReissue` → cùng `taiUserPhienConHieuLuc` | Như trên |
| Đổi mật khẩu (mới) | Giá trị vừa ghi | `false` |

`TokenPayload.phaiDoiMatKhau` khai **bắt buộc** để TypeScript báo ở chỗ nào quên. Vé ký trước khi triển khai không có claim → coi như `false` (đúng: chỉ tài khoản duyệt SAU triển khai mới có cờ `true`).

## 7. Index

Không thêm. Mọi truy vấn đọc cờ đi theo khoá chính `users.id` hoặc `users.email` (unique). Không có nhu cầu "liệt kê ai chưa đổi mật khẩu" trong phạm vi.

## 8. Nhật ký (`SysLog`, không đổi schema)

| `hanhDong` | Khi nào | `chiTiet` | Ghi chú |
|---|---|---|---|
| `APPROVE_INVITE` | Duyệt thành công, mail đã gửi | Giữ nguyên `{ inviteId, newUserId, email, ownerId, donViIds }` | **CẤM** thêm mật khẩu/hash (BR-007) |
| `CHANGE_PASSWORD` (mới) | Đổi mật khẩu thành công | `{ batBuoc: boolean }` — `true` nếu trước đó cờ đang bật | Không ghi mật khẩu cũ/mới |
| `RESET_PASSWORD` | OTP (sẵn có) | Giữ nguyên `{ email }` | — |
| `SET_EMPLOYEE_ACCESS` | Lưu panel Sửa quyền (sẵn có) | Giữ nguyên `{ employeeId, access: [{ donViId, xemLuong }] }` | — |

`writeLog` là best-effort (nuốt lỗi, ngoài giao dịch — `syslog.service.ts:14-24`), giữ nguyên pattern.

## 9. Audit fields, xoá mềm, lưu trữ

- `users.updatedAt` tự đổi khi đổi mật khẩu/cờ. Không thêm cột "đổi mật khẩu lúc nào" — `SysLog CHANGE_PASSWORD` có `createdAt`.
- Không có xoá mềm mới; thu hồi hết công ty chỉ xoá các dòng `DonViAccess`, `User` còn nguyên (BR-013).
