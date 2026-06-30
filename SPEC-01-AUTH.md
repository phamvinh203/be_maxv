# SPEC 01 — Đăng ký & Đăng nhập (Auth)

> Tài liệu BA (phân tích nghiệp vụ + chốt lựa chọn) & QA (test cases) cho chức năng **đầu tiên** của maxv_v2.
> Các chức năng chứng từ sẽ làm sau. Liên quan: [KIEN-TRUC-DATABASE.md](KIEN-TRUC-DATABASE.md).

---

## A. PHÂN TÍCH NGHIỆP VỤ (BA)

### A.1. Mục tiêu & phạm vi

**Trong phạm vi (làm trước):**
- Đăng ký tài khoản (email + mật khẩu) + xác thực email
- Đăng nhập / đăng xuất (JWT access + refresh token)
- Tạo đơn vị (nhập tên cty + MST) → kích hoạt trial 7 ngày → tạo `db_<MST>`
- Chọn đơn vị làm việc (1 user có thể có nhiều đơn vị)
- Quên / đặt lại mật khẩu

**Ngoài phạm vi (làm sau):** mọi chứng từ, nâng cấp gói/thanh toán, phân quyền chi tiết theo module.

### A.2. Các quyết định nghiệp vụ đã chốt (lựa chọn đúng nhất)

| # | Vấn đề | Lựa chọn chốt | Lý do |
|---|--------|---------------|-------|
| 1 | Tài khoản đăng nhập bằng gì | **Email + mật khẩu** | Đơn giản, quen thuộc; Google OAuth bổ sung sau |
| 2 | Bắt buộc xác thực email? | **Có** | Chống lạm dụng trial, đảm bảo email liên hệ thật |
| 3 | Mô hình tài khoản ↔ công ty | **1 công ty = 1 gói = 1 tài khoản OWNER**; đăng ký gồm email + tên cty + MST | Tài khoản gắn chặt 1 công ty |
| 4 | Làm nhiều công ty | **Đăng ký nhiều tài khoản (nhiều email)**, mỗi tài khoản 1 công ty | Không cho 1 tài khoản nhảy nhiều công ty |
| 5 | Nhân viên trong 1 công ty | **Nhiều user → 1 công ty (n:1)**; owner mời → ADMIN duyệt → gửi mật khẩu qua email | Hỗ trợ KT trưởng + KT viên |
| 6 | Trial tính theo gì | **Theo công ty (mỗi MST)**, 7 ngày kể từ khi đăng ký | = theo tài khoản OWNER (1:1) |
| 7 | Chống lạm dụng trial | **1 MST chỉ 1 gói** (`maSoThue` unique trong db_sys) | Không đăng ký trùng MST |
| 8 | Cơ chế phiên đăng nhập | **JWT: access token (15 phút) + refresh token (7 ngày)** | Bảo mật + mượt |
| 9 | Phân quyền | **OWNER / KE_TOAN_TRUONG / KE_TOAN / XEM**; ADMIN là quản trị hệ thống | Đủ dùng giai đoạn đầu |
| 10 | Định tuyến công ty trên URL | **`/maxv/<MST>` chỉ để routing**, luôn check `user.donViId` khớp | Chống xem chéo sổ sách |
| 11 | Khi nào tạo `db_<MST>` | **Ngay khi đăng ký**, theo saga PROVISIONING→READY | Tránh di trú data về sau |

### A.3. User Stories + Tiêu chí chấp nhận

**US-01 — Đăng ký gói (tài khoản OWNER + công ty)**
> Là khách truy cập, tôi muốn đăng ký bằng email + mật khẩu + tên công ty + MST để mở gói dùng thử cho công ty của tôi.
- ✅ Email hợp lệ chưa tồn tại **và** MST chưa tồn tại → tạo `don_vi` (PROVISIONING) + `user` (role=OWNER, `isActive=false`) gắn `donViId` → tạo `db_<MST>` → migrate → READY/TRIAL `trialEndsAt = now + 7 ngày`; gửi email xác thực.
- ✅ Mật khẩu tối thiểu 8 ký tự, có chữ + số.
- ✅ Email trùng → 409, không lộ thông tin user cũ.
- ✅ **MST trùng → 409 (1 MST = 1 gói).**
- ✅ Tạo DB lỗi → `don_vi` status=FAILED, cho retry, không để DB mồ côi.
- ✅ Response **không bao giờ** trả về `password`.

**US-02 — Xác thực email**
> Là người mới đăng ký, tôi muốn xác nhận email để kích hoạt tài khoản.
- ✅ Token hợp lệ, chưa hết hạn (24h) → `isActive=true`, `status=ACTIVE`.
- ✅ Token sai/hết hạn → báo lỗi, cho phép gửi lại.

**US-03 — Đăng nhập (vào thẳng công ty của mình)**
> Là người dùng đã kích hoạt, tôi muốn đăng nhập để vào ngay công ty của tôi (không có bước chọn đơn vị).
- ✅ Đúng email + mật khẩu + `isActive=true` → trả accessToken + refreshToken + context công ty (`donViId`, MST).
- ✅ Sai mật khẩu → 401, thông báo chung "Email hoặc mật khẩu không đúng".
- ✅ Chưa xác thực email → 403, gợi ý gửi lại.
- ✅ Nhân viên đang `PENDING` (chưa admin duyệt) → 403.
- ✅ Sai quá 5 lần liên tiếp → tạm khóa 15 phút (chống brute-force).

**US-04 — Owner mời nhân viên vào công ty**
> Là OWNER, tôi muốn thêm nhân viên (kế toán viên) vào dùng chung gói công ty.
- ✅ OWNER nhập email nhân viên + role → tạo bản ghi user `status=PENDING`, `donViId` = công ty của owner → **gửi email yêu cầu duyệt tới ADMIN hệ thống**.
- ✅ Email nhân viên đã thuộc công ty khác → từ chối (mỗi user 1 công ty).
- ✅ Chỉ OWNER (không phải nhân viên) mới được mời.

**US-05 — Admin duyệt nhân viên**
> Là ADMIN hệ thống, tôi muốn duyệt/từ chối yêu cầu thêm nhân viên.
- ✅ Duyệt → `status=ACTIVE`, sinh mật khẩu → **gửi mật khẩu (hoặc link đặt mật khẩu) tới email nhân viên**.
- ✅ Từ chối → `status=REJECTED`, không tạo truy cập.

**US-06 — Quên / đặt lại mật khẩu**
- ✅ Nhập email → luôn báo "đã gửi nếu email tồn tại" (không lộ email nào có thật).
- ✅ Token reset hợp lệ (hết hạn 1h, dùng 1 lần) → đổi mật khẩu, vô hiệu các refresh token cũ.

### A.4. Luồng chính

```
ĐĂNG KÝ:   email+mk+tên cty+MST → kiểm email & MST chưa dùng
           → tạo don_vi(PROVISIONING) + user(OWNER, inactive)
           → CREATE db_<MST> + migrate → READY/TRIAL(+7d) → gửi email xác thực → click link → active
ĐĂNG NHẬP: email+mk → kiểm active → cấp token + context công ty → vào THẲNG /maxv/<MST>
MỜI NV:    owner nhập email NV → user(PENDING, donViId=cty) → mail tới ADMIN
DUYỆT NV:  admin duyệt → status=ACTIVE → gửi mật khẩu tới email NV
TRUY CẬP:  mọi request → check user.donViId KHỚP công ty trên URL → connect db_<MST>
```

### A.5. Quy tắc & ràng buộc

- Mật khẩu lưu dạng **hash (argon2/bcrypt)**, không bao giờ trả ra API.
- `maSoThue` **unique** trong db_sys → 1 MST chỉ 1 gói.
- Mỗi `user` thuộc đúng 1 công ty (`donViId`); ADMIN hệ thống không gắn công ty.
- MST chuẩn hóa trước khi đặt tên DB: bỏ ký tự `-`, ví dụ `8094889-001` → `db_8094889_001`.
- `trialEndsAt` chỉ set khi công ty đạt `READY`.
- Mọi truy cập dữ liệu: **bắt buộc check `user.donViId` khớp công ty trên URL** (không tin URL).
- Refresh token lưu hash phía server, có thể thu hồi (logout, đổi mật khẩu).
- ⚠️ **Khuyến nghị bảo mật:** thay vì gửi mật khẩu thô qua email cho nhân viên, nên gửi **link đặt mật khẩu dùng 1 lần** (an toàn hơn). Giữ luồng admin duyệt như đã chốt.

### A.6. Hợp đồng API (contract)

| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| POST | `/api/v1/auth/register` | Đăng ký gói (email+mk+tên cty+MST) → tạo công ty + OWNER + DB | Không |
| POST | `/api/v1/auth/verify-email` | Xác thực email (token) | Không |
| POST | `/api/v1/auth/resend-verification` | Gửi lại email xác thực | Không |
| POST | `/api/v1/auth/login` | Đăng nhập (trả token + context công ty) | Không |
| POST | `/api/v1/auth/refresh` | Làm mới access token | Refresh token |
| POST | `/api/v1/auth/logout` | Đăng xuất (thu hồi refresh) | Access token |
| POST | `/api/v1/auth/forgot-password` | Yêu cầu đặt lại mk | Không |
| POST | `/api/v1/auth/reset-password` | Đặt lại mk (token) | Không |
| GET  | `/api/v1/me` | Thông tin user + công ty hiện tại | Access token |
| POST | `/api/v1/nhan-vien/invite` | OWNER mời nhân viên → gửi mail admin duyệt | Access token (OWNER) |
| POST | `/api/v1/admin/nhan-vien/:id/approve` | Admin duyệt → gửi mật khẩu cho NV | Access token (ADMIN) |
| POST | `/api/v1/admin/nhan-vien/:id/reject` | Admin từ chối | Access token (ADMIN) |

---

## B. KẾ HOẠCH KIỂM THỬ (QA)

### B.1. Test Strategy

| Loại | Phạm vi | Công cụ |
|------|---------|---------|
| Unit | Logic service: hash mk, sinh/đối chiếu token, chuẩn hóa MST | Jest |
| Integration | Toàn bộ endpoint auth + tạo đơn vị (mock CREATE DATABASE) | Jest + Supertest |
| E2E | Luồng đăng ký→xác thực→đăng nhập→tạo đơn vị | Playwright |
| Security | Brute-force, IDOR (xem chéo MST), SQL injection, lộ password | Manual + Jest |

**Coverage target:** Unit 80%+, mỗi endpoint ≥ 3 test case. Response thời gian < 200ms (P95). Test data độc lập, cleanup sau mỗi suite.

---

## C. TEST CASES CHI TIẾT

### Đăng ký — `POST /auth/register`

**TC-AUTH-001 — Đăng ký gói thành công** · Priority: High · Functional
- Tiền đề: email `ketoan@abc.com` chưa tồn tại, MST `8094889` chưa tồn tại.
- Bước: gửi `{email, password:"Test123!", hoTen, tenCongTy, maSoThue:"8094889"}`.
- Kỳ vọng: 201, tạo `don_vi`(TRIAL) + sinh `db_8094889` + user role=OWNER `isActive=false`, `trialEndsAt=+7 ngày`, email xác thực được gửi, response **không có** `password`.

**TC-AUTH-002 — Email trùng** · High · Functional
- Tiền đề: email đã tồn tại. Kỳ vọng: 409, không lộ thông tin user cũ.

**TC-AUTH-002b — MST trùng (1 MST 1 gói)** · High · Functional
- Tiền đề: MST `8094889` đã được đăng ký. Kỳ vọng: 409.

**TC-AUTH-003 — Email sai định dạng** · Medium · Validation
- Bước: `email:"not-an-email"`. Kỳ vọng: 400, `success=false`.

**TC-AUTH-004 — Mật khẩu yếu** · Medium · Validation
- Bước: `password:"123"`. Kỳ vọng: 400, yêu cầu ≥ 8 ký tự + chữ + số.

**TC-AUTH-005 — Tạo DB lỗi khi đăng ký** · High
- Mô phỏng `CREATE DATABASE` lỗi. Kỳ vọng: `don_vi` status=FAILED, cho retry, không để DB mồ côi.

### Xác thực email — `POST /auth/verify-email`

**TC-AUTH-010 — Token hợp lệ** · High → 200, `isActive=true`.
**TC-AUTH-011 — Token hết hạn (>24h)** · Medium → 400, gợi ý gửi lại.
**TC-AUTH-012 — Token sai/giả** · High (Security) → 400, không kích hoạt.

### Đăng nhập — `POST /auth/login`

**TC-AUTH-020 — Đăng nhập thành công** · High → 200, có `accessToken` + `refreshToken` + context công ty (`donViId`, MST).
**TC-AUTH-021 — Sai mật khẩu** · High → 401, thông báo chung (không nói "sai mật khẩu" riêng).
**TC-AUTH-022 — Chưa xác thực email** · High → 403, gợi ý xác thực.
**TC-AUTH-023 — Brute-force >5 lần** · High (Security) → khóa tạm 15 phút.
**TC-AUTH-024 — Nhân viên đang PENDING (chưa admin duyệt)** · Medium → 403.

### Token — `POST /auth/refresh`, `/auth/logout`

**TC-AUTH-030 — Refresh hợp lệ** · High → 200, access token mới.
**TC-AUTH-031 — Refresh đã thu hồi/đăng xuất** · High (Security) → 401.
**TC-AUTH-032 — Logout thu hồi refresh** · High → sau logout, refresh cũ trả 401.

### Quên mật khẩu — `/auth/forgot-password`, `/auth/reset-password`

**TC-AUTH-040 — Yêu cầu reset (email tồn tại)** · Medium → 200, gửi email.
**TC-AUTH-041 — Email không tồn tại** · High (Security) → 200 **giống hệt** TC-040 (không lộ email nào có thật).
**TC-AUTH-042 — Reset bằng token hợp lệ** · High → đổi mk + vô hiệu refresh token cũ.
**TC-AUTH-043 — Token reset dùng lại lần 2** · High (Security) → 400 (token 1 lần).

### Mời & duyệt nhân viên — `/nhan-vien/invite`, `/admin/nhan-vien/:id/approve`

**TC-NV-001 — Owner mời nhân viên** · High
- Bước: OWNER gửi `{email:"nv@abc.com", role:"KE_TOAN"}`.
- Kỳ vọng: tạo user `status=PENDING`, `donViId`=công ty owner, gửi email yêu cầu duyệt tới ADMIN.

**TC-NV-002 — Nhân viên (không phải OWNER) mời người khác** · High (Security) → 403.
**TC-NV-003 — Mời email đã thuộc công ty khác** · Medium → 409 (mỗi user 1 công ty).
**TC-NV-004 — Admin duyệt** · High → `status=ACTIVE`, gửi mật khẩu/link đặt mk tới email NV.
**TC-NV-005 — Admin từ chối** · Medium → `status=REJECTED`, không tạo truy cập.
**TC-NV-006 — User thường gọi endpoint approve** · Critical (Security) → 403 (chỉ ADMIN).

### Bảo mật truy cập công ty

**TC-SEC-001 — Vào công ty của mình** · High → 200, trả context + dbName.
**TC-SEC-002 — IDOR: gõ `/maxv/<MST khác>` không phải công ty mình** · Critical (Security) → 403, **không** lộ tên/sự tồn tại công ty đó (kiểm `user.donViId` khớp).
**TC-SEC-003 — SQL/identifier injection qua MST** (`8094889; DROP...`) · Critical → input bị từ chối/escape, DB không bị ảnh hưởng.
**TC-SEC-004 — Response không chứa `password`/secret** ở mọi endpoint · High.

---

## D. Bug Report Template

```markdown
## Bug #[ID] — [Tiêu đề]
Severity: Critical/High/Medium/Low · Priority: P1–P4
Environment: Windows Server 2025 · [Browser] · maxv_v2 v[x.y]
Steps: 1... 2... 3...
Expected: ... | Actual: ...
Logs/Screenshots: ...
Assignee: BE / FE / DB
```

---

## E. Bước tiếp theo

Sau khi auth pass toàn bộ test case ở mục C, mới chuyển sang module chứng từ (xem danh mục tại [KIEN-TRUC-DATABASE.md](KIEN-TRUC-DATABASE.md) mục 8), bắt đầu từ **Phiếu thu / Phiếu chi** (đơn giản nhất, đủ để xác thực luồng `chung_tu` → `but_toan`).
