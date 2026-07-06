# Thiết kế: 1 tài khoản — nhiều công ty/MST — phân quyền nhân viên theo MST

Ngày: 2026-07-06 · Phạm vi bản này: **Backend (be_maxv)** · Nhánh: `dev_be`

## 1. Mục tiêu

- Người dùng đăng ký trải nghiệm có thể **login ngay mà chưa cần nhập công ty/MST**; hệ
  thống nhắc nhập thông tin để tiếp tục.
- **1 tài khoản (owner) tạo được nhiều công ty/MST**.
- Owner **thêm nhân viên bằng email** và **phân quyền nhân viên vào đúng những MST mong muốn**;
  nhân viên chỉ thao tác được trên MST được cấp.

## 2. Quyết định đã chốt (brainstorming)

| Chủ đề | Quyết định |
|---|---|
| Mức phân quyền | **Chỉ theo công ty**: gán MST nào → làm toàn bộ trong MST đó. (Mở rộng RBAC chi tiết sau.) |
| Billing | **Theo tài khoản**: 1 gói cho nhiều MST; gói giới hạn số MST + số nhân viên. |
| Quan hệ user | Mỗi email = 1 user thuộc 1 tài khoản; tài khoản gán nhiều MST; nhân viên thêm bằng email. |
| Đơn vị billing | **Owner User = tài khoản** (không tạo bảng Account riêng). |
| Chọn "công ty đang làm việc" | **A — Switch cấp lại token**: endpoint switch validate quyền rồi ký lại token nhúng `donViId`. |

## 3. Hiện trạng liên quan

- Register đã tách khỏi tạo công ty: `registerUser` tạo user `donViId=null`, `role=OWNER`
  (`src/services/client/auth.service.ts`).
- Tạo công ty + cấp DB `maxv2_<mst>_app` + trial: `src/services/client/company.service.ts`.
- Tenant DB resolve từ `req.user.donViId`: `src/helpers/resolveTenantDb.ts`.
- **Ràng buộc cần gỡ**: `User.donViId` là FK đơn (1 user = đúng 1 công ty), chặn cứng
  `USER_HAS_COMPANY` khi tạo công ty thứ 2 và chặn mời người đã có công ty.
- JWT mang `{ userId, donViId, role }`.

## 4. Data model đích (db_sys / `prisma/sys/schema.prisma`)

```
User
  id, email, sdt, password, hoTen, chucVu
  role         ADMIN | OWNER | OWNER_EMPLOYEE
  ownerId?     nhân viên → owner user; owner → null (self-ref)
  status, isActive
  subscription?            (1:1, CHỈ owner)
  donViAccess  DonViAccess[]      MST được cấp (dùng cho nhân viên)
  employees    User[]             (reverse ownerId)
  ✗ BỎ donViId

DonVi
  id, maSoThue, slug, tenDonVi, diaChi, sdt, loaiHinhKinhDoanh
  ownerId      owner sở hữu MST này (đếm giới hạn gói + quản lý)
  status, dbName, provisionedAt
  donViAccess  DonViAccess[]

DonViAccess (MỚI)   bảng nối = "list donVi" của user
  id, userId, donViId, createdAt
  @@unique([userId, donViId])

Subscription        donViId → ownerId (1:1 owner)
SubscriptionPlan    + soMstToiDa (số MST tối đa); giữ soNguoiToiDa
SubscriptionHistory donViId → ownerId
InviteRequest       donViId → ownerId  + donViIds String[] (MST cấp sẵn khi duyệt)
```

### Quy tắc kiểm quyền — helper `canAccess(user, donViId)`
- **OWNER**: OK nếu `DonVi.ownerId === user.id` (thấy hết MST mình tạo; không tạo dòng
  DonViAccess thừa cho owner).
- **OWNER_EMPLOYEE**: OK nếu tồn tại `DonViAccess(userId, donViId)`.
- Dùng ở `POST /companies/:id/switch` và (phòng thủ) trong `resolveTenantDb`.

## 5. Luồng chức năng (demo)

1. **Đăng ký + login lần đầu**: tạo User `OWNER`, chưa có MST. Login trả `companies: []`,
   token `donViId=null`. FE hiện nhắc nhập MST; route nghiệp vụ trả 403 `NO_COMPANY`.
2. **Tạo MST đầu**: `POST /companies` → check `soMstToiDa` → tạo DonVi `ownerId=self` +
   provision DB → tạo trial subscription trên owner (nếu là MST đầu) → auto-switch (token mới).
3. **Tạo MST thứ 2..n**: bỏ chặn `USER_HAS_COMPANY`; mỗi MST 1 DB riêng cùng `ownerId`.
4. **Switch công ty**: `POST /companies/:id/switch` → `canAccess` → ký lại token `donViId`.
5. **Mời nhân viên + gán MST**: `POST /accounts/employees/invite { email, hoTen, chucVu,
   donViIds }` → check `soNguoiToiDa` → InviteRequest `{ ownerId, donViIds }` → admin duyệt →
   tạo User `OWNER_EMPLOYEE` `ownerId=owner` + DonViAccess cho từng donViId.
6. **Nhân viên login**: `GET /companies` chỉ trả MST có DonViAccess; switch vào MST được cấp.
7. **Chặn trái phép**: nhân viên switch vào MST không có DonViAccess → 403.
8. **Giới hạn gói**: vượt `soMstToiDa`/`soNguoiToiDa` → chặn kèm thông báo.

**Bất biến quan trọng**: toàn bộ controller nghiệp vụ (banHang/tonKho/tongHop) **không đổi**
vì vẫn qua `resolveTenantDb(req.user.donViId)`.

## 6. Migration dữ liệu cũ

Nếu có dữ liệu thật → backfill: thêm cột `DonVi.ownerId`, `User.ownerId`, bảng `DonViAccess`,
`Subscription.ownerId` (nullable tạm) → backfill từ `donViId` cũ → drop `User.donViId`, siết
NOT NULL. Nếu **chưa có dữ liệu thật** (giai đoạn dev) → gộp 1 migration sạch. *(Chốt lúc lập plan.)*

## 7. Ngoài phạm vi bản này

- Frontend (onboarding banner, company switcher, UI gán MST) — spec riêng.
- RBAC chi tiết theo module/hành động.
- Nhân viên thuộc nhiều tài khoản (cross-account) / chuyển quyền sở hữu.
