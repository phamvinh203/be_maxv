---
type: srs-flows
feature: phan-quyen-nhan-vien
updated: 2026-09-17
---

# Flows — Phân quyền nhân viên (mời qua email + đúng công ty được cấp)

## Flow: Owner mời nhân viên -> ADMIN duyệt -> nhận mật khẩu qua email -> đổi mật khẩu lần đầu

### Bảng phân vai (Actor/Role Matrix)

| Bước | Actor | Hành động | Route/Service |
|---|---|---|---|
| 1 | Owner (trong `hdđt_maxv`) | Mở Cài đặt -> Nhân viên -> Thêm nhân viên, điền họ tên/email/chức vụ, tick chọn 1 hoặc nhiều công ty (mặc định tick sẵn công ty đang chọn ở header) | UI mới (FR-001, FR-002 — đã chốt OQ-3: chọn nhiều công ty) |
| 2 | Owner | Gửi lời mời (công ty = danh sách đã tick) | `POST /companies/invite` (không đổi) |
| 3 | Hệ thống | Validate MST thuộc owner, chặn email đã có tài khoản hoặc đã có lời mời PENDING, kiểm trần nhân viên, tạo `InviteRequest` PENDING, báo mail mọi ADMIN | `inviteUserToCompany()` (không đổi) |
| 4 | ADMIN | Duyệt hoặc từ chối lời mời | `POST /admin/companies/invites/:id/approve\|reject` (không đổi cấu trúc, đổi bước sinh mật khẩu ở nhánh duyệt) |
| 5 | Hệ thống | Nếu duyệt: sinh mật khẩu ngẫu nhiên thật (BR-005), tạo `User` + `DonViAccess` cho từng MST được mời trong 1 giao dịch, đánh dấu "phải đổi mật khẩu", gửi email chứa email đăng nhập + mật khẩu | `adminApproveInvite()` (mở rộng, FR-003) |
| 6 | Hệ thống | Gửi email thất bại (SMTP lỗi) | Huỷ `User` vừa tạo, đưa lời mời về lại PENDING (rollback, BR-010, không đổi cơ chế) |
| 7 | Nhân viên | Đăng nhập lần đầu bằng email + mật khẩu nhận được | `POST /auth/login` (không đổi hình dạng response) |
| 8 | Hệ thống | Phát hiện tài khoản đang "phải đổi mật khẩu", chặn mọi request nghiệp vụ khác | Guard mới (FR-004, E-005) |
| 9 | Nhân viên | Đổi mật khẩu mới đạt chính sách | API đổi mật khẩu bắt buộc (mới, Architect thiết kế) |
| 10 | Hệ thống | Gỡ cờ "phải đổi mật khẩu", cho vào hệ thống bình thường | FR-005 |

### Sequence: Duyệt lời mời -> gửi mật khẩu -> đăng nhập lần đầu

```mermaid
sequenceDiagram
    actor Owner
    participant FE as hdđt_maxv (Cài đặt > Nhân viên)
    participant BE as be_maxv API
    participant DB as maxv2_sys (Postgres)
    participant Mail as SMTP (nodemailer)
    actor Admin as ADMIN hệ thống
    actor NV as Nhân viên (OWNER_EMPLOYEE)

    Owner->>FE: Mo Them nhan vien, tick 1+ cong ty (mac dinh tick cong ty header), gui
    FE->>BE: POST /companies/invite {email, hoTen, chucVu, donViIds: [cac cong ty da tick]}
    BE->>DB: Validate MST thuộc owner + trần nhân viên
    BE->>DB: INSERT InviteRequest (PENDING)
    BE-->>Mail: Báo mọi ADMIN có lời mời mới
    BE-->>FE: 201 { status: PENDING }

    Admin->>BE: POST /admin/companies/invites/{id}/approve
    BE->>BE: Sinh mat khau tam 16 ky tu (BR-005) - TRUOC giao dich (MT-09)
    Note over BE,DB: Trong 1 transaction: chiem loi moi (status=APPROVED, dieu kien PENDING)<br/>+ kiem tran nhan vien + INSERT User (matKhauTamHash, phaiDoiMatKhau=true)<br/>+ INSERT DonViAccess CHỈ cho cong ty con ton tai va con thuoc owner (BR-015)
    BE->>DB: Transaction (thu tu tren)
    BE->>Mail: Gui email {email dang nhap, mat khau tam, luu y dang nhap o hdđt_maxv - OQ-11}
    alt Gui email that bai
        BE->>DB: Rollback - DELETE User, UPDATE InviteRequest SET status=PENDING
        BE-->>Admin: 502 loi gui mail
    else Gui email thanh cong
        BE-->>Admin: 200 OK
    end

    NV->>BE: POST /auth/login {email, mat khau tam tu email}
    BE->>DB: Xac thuc mat khau, doc phaiDoiMatKhau
    BE-->>NV: 200 dang nhap thanh cong, ve mang claim phaiDoiMatKhau=true (van dang nhap duoc)

    NV->>BE: GET /auth/me (duoc phep - trong whitelist FR-004/MT-02)
    BE-->>NV: 200 (de FE dung man doi mat khau bat buoc)

    NV->>BE: Goi API nghiep vu khac (chua doi mat khau)
    BE-->>NV: 403 PASSWORD_CHANGE_REQUIRED

    NV->>BE: POST /auth/change-password {mat khau tam, mat khau moi}
    alt Sai mat khau hien tai
        BE-->>NV: 400 AUTH.CURRENT_PASSWORD_WRONG (E-011)
    else Mat khau moi trung mat khau hien tai
        BE-->>NV: 400 VALIDATION.PASSWORD_SAME (E-012)
    else Hop le
        BE->>DB: UPDATE User SET password=hash moi, phaiDoiMatKhau=false, tokenVersion+1
        BE-->>NV: 200 OK -> vao he thong binh thuong
    end
```

## Flow: Nhân viên đăng nhập, phạm vi công ty tính thế nào (hành vi hiện có, xác nhận không đổi)

### Bảng phân vai

| Bước | Actor | Hành động |
|---|---|---|
| 1 | Nhân viên | Đăng nhập hoặc mở bộ chọn công ty ở header |
| 2 | Hệ thống | `GET /companies` lọc theo `accessibleDonViWhere(userId, role)` — nhân viên chỉ nhận công ty có `DonViAccess` |
| 3 | Nhân viên | Chọn 1 công ty trong danh sách, hệ thống gọi `POST /companies/{id}/switch` |
| 4 | Hệ thống | Kiểm `canAccessDonVi()` trước khi cấp lại token nhúng `donViId` mới; không có quyền -> 403 ngay |
| 5 | Nhân viên | Thao tác nghiệp vụ (xem hoá đơn, tờ khai, HRM...) trong công ty đang chọn |
| 6 | Hệ thống | Mọi route dữ liệu tenant gọi `resolveTenantDb`/`resolveTenantInfo`, tra lại `accessibleDonViWhere` mỗi request — quyền bị thu hồi thì request tiếp theo bị chặn ngay, không chờ nhân viên tải lại trang |

### Sequence: Chặn công ty không được cấp (regression, xác nhận đã đúng)

```mermaid
sequenceDiagram
    actor NV as Nhân viên (OWNER_EMPLOYEE)
    participant FE as hdđt_maxv
    participant BE as be_maxv API
    participant DB as maxv2_sys (Postgres)

    NV->>FE: Mo bo chon cong ty
    FE->>BE: GET /companies
    BE->>DB: SELECT DonVi WHERE access.some(userId)
    DB-->>BE: Chi cong ty duoc cap
    BE-->>FE: 200 [X]

    NV->>BE: POST /companies/{Y}/switch (Y khong duoc cap, goi thang API)
    BE->>DB: canAccessDonVi(userId, role, Y)
    DB-->>BE: false
    BE-->>NV: 403 COMPANY.NO_ACCESS

    Note over NV,BE: Truong hop bi thu hoi giua chung
    NV->>BE: GET /hddt/hoa-don (dang o cong ty X, vua bi thu hoi)
    BE->>DB: resolveTenantInfo() -> accessibleDonViWhere tra lai
    DB-->>BE: khong con quyen X
    BE-->>NV: 403 COMPANY_NO_ACCESS (co code, ngay lap tuc, khong cache)

    Note over NV,FE: Cap nhat (MT-06, AC-03.4) - FE dong bo ngay o lan 403 dau tien
    FE->>FE: Bat response co code COMPANY_NO_ACCESS
    FE->>BE: GET /companies (lay danh sach moi nhat)
    BE-->>FE: 200 [cong ty con quyen]
    FE->>BE: POST /companies/{cong-ty-con-quyen-gan-nhat}/switch (neu con it nhat 1 cong ty)
    FE->>NV: Chuyen sang cong ty con quyen ngay, khong doi NV tu F5
```

## Flow: Owner sửa quyền công ty + xem lương của nhân viên đã duyệt (MỚI — OQ-4)

### Bảng phân vai (Actor/Role Matrix)

| Bước | Actor | Hành động | Route/Service |
|---|---|---|---|
| 1 | Owner | Ở bảng nhân viên, bấm nút "Sửa quyền" của 1 nhân viên đã duyệt | UI mới (FR-009) |
| 2 | Hệ thống | Mở panel liệt kê toàn bộ công ty của owner, tick sẵn theo `DonViAccess` hiện có, ô "Xem lương" chỉ bật được khi công ty đó đang tick "Cấp quyền" | UI mới (FR-009, BR-014) |
| 3 | Owner | Tick thêm/bớt công ty, bật/tắt xem lương, bấm Lưu | — |
| 4 | Hệ thống | Nếu owner bỏ tick hết công ty: hiện hộp thoại xác nhận trước khi gửi | FR-010 |
| 5 | Hệ thống | Gọi `PUT /companies/employees/:userId/access` với `access` gồm các công ty đã tick kèm `xemLuong` | `setEmployeeAccess()` (không đổi backend, chỉ thêm UI gọi) |
| 6 | Hệ thống | Kiểm owner sở hữu nhân viên + mọi công ty gửi lên, ghi theo cặp (giữ `xemLuong` cũ nếu không gửi), ghi `SysLog` | `company.service.ts:397-471` (không đổi) |
| 7 | Nhân viên | Quyền có hiệu lực ngay ở API tiếp theo (không cần đăng nhập lại) | `resolveTenantInfo`/`accessibleDonViWhere` tra mới mỗi request |

### Sequence: Sửa quyền công ty + xem lương

```mermaid
sequenceDiagram
    actor Owner
    participant FE as hdđt_maxv (Cai dat > Nhan vien)
    participant BE as be_maxv API
    participant DB as maxv2_sys (Postgres)
    actor NV as Nhan vien (OWNER_EMPLOYEE)

    Owner->>FE: Bam "Sua quyen" cua nhan vien C
    FE->>BE: GET /companies/employees
    BE-->>FE: 200 [C voi donViAccess hien co]
    Owner->>FE: Tick them cong ty Y, bat "Xem luong" cho X, bam Luu

    alt Bo tick het moi cong ty
        FE->>Owner: Hop thoai xac nhan "C se mat quyen vao moi cong ty"
        Owner->>FE: Xac nhan
    end

    FE->>BE: PUT /companies/employees/C/access {access: [{X, xemLuong:true}, {Y}]}
    BE->>DB: Kiem C thuoc owner + X,Y thuoc owner
    BE->>DB: Upsert DonViAccess theo cap, ghi SysLog SET_EMPLOYEE_ACCESS
    BE-->>FE: 200 { userId, donViIds, so_cong_ty }
    FE->>FE: Invalidate GET /companies/employees -> bang nhan vien cap nhat ngay

    NV->>BE: Goi lai GET /companies (mo bo chon / tai lai trang)
    BE->>DB: accessibleDonViWhere tra moi
    BE-->>NV: 200 [X, Y] (da co quyen Y ngay, khong can dang nhap lai)
```
