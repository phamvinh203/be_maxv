---
type: test-cases
feature: phan-quyen-nhan-vien
updated: 2026-09-17
links:
  - docs/phan-quyen-nhan-vien/qa/test-matrix.md
  - docs/phan-quyen-nhan-vien/srs/phan-quyen-nhan-vien-spec.md
  - docs/phan-quyen-nhan-vien/srs/phan-quyen-nhan-vien-flows.md
  - docs/phan-quyen-nhan-vien/srs/phan-quyen-nhan-vien-states.md
  - docs/phan-quyen-nhan-vien/srs/phan-quyen-nhan-vien-erd.md
  - docs/phan-quyen-nhan-vien/architecture/api-contract.md
  - docs/phan-quyen-nhan-vien/architecture/data-model.md
---

# Test cases chi tiết — Phân quyền nhân viên (mời qua email + đúng công ty được cấp)

> Ghi đè hoàn toàn bản dở dang vòng 1. **Cập nhật 2026-09-17 (lần 2):** Architect đã viết lại
> `architecture/api-contract.md` + `data-model.md` + `ADR-002` theo phạm vi vòng 2 — mọi TC dưới đây đã
> được điền endpoint/HTTP status/`code` cụ thể theo contract (thay cho "chờ contract" ở bản trước).
> TC-001 → TC-060 giữ nguyên số hiệu (chỉ cập nhật nội dung); TC-061 → TC-074 là TC MỚI thêm theo yêu
> cầu đối chiếu contract (đổi mật khẩu, OTP gỡ cờ, refresh/switch giữa phiên, rollback duyệt lại, mã
> `COMPANY_NO_ACCESS`, khoá song song, trùng công ty). Đây vẫn là Phase A: chưa chạy test thật, "Actual
> Result / Status" ghi nhận trạng thái sẵn sàng theo contract, không phải kết quả chạy thực tế.

## Nhóm 1 — Mật khẩu (US-02, BR-005..007/010/011, FR-003..005, E-004..006)

### TC-001 — Mật khẩu tạm sinh ra đạt chính sách mạnh (`sinhMatKhauTam()`)

- **Requirement**: BR-005
- **Tầng**: BE-unit
- **Endpoint/Hàm**: `sinhMatKhauTam()` — `be_maxv/src/utils/password.ts` (mới, `api-contract.md` Mục 4.7 điểm 1)
- **Preconditions**: Hàm đã cài đặt đúng contract: bảng `HOA` (24 ký tự, bỏ `I O`) + `THUONG` (24, bỏ `l o`) + `SO` (8, bỏ `0 1`) = 56 ký tự `TAT_CA`; dùng `crypto.randomInt`.
- **Steps**: Gọi `sinhMatKhauTam()` 1000 lần, kiểm từng giá trị.
- **Test Data**: N/A (sinh ngẫu nhiên).
- **Expected Result**: Mỗi lần sinh đúng 16 ký tự; có ≥1 ký tự thuộc `HOA`, ≥1 thuộc `THUONG`, ≥1 thuộc `SO`; mọi ký tự thuộc `TAT_CA` (không ký tự đặc biệt/dễ nhầm); tự thoả `passwordRule` hiện có (≥8, có chữ, có số); nguồn `crypto.randomInt` (không `Math.random`); không trùng giá trị nào trong 1000 lần sinh (~92 bit entropy).
- **Actual Result / Status**: Chưa chạy — chờ code (Phase B). Contract đã chốt thuật toán + vị trí, không còn phụ thuộc gap nào.

### TC-002 — Mật khẩu không xuất hiện trong response duyệt lời mời

- **Requirement**: BR-007, AC-02.1
- **Tầng**: BE-integration
- **Endpoint**: `POST /api/v1/admin/companies/invites/:id/approve`
- **Preconditions**: Có `InviteRequest` PENDING.
- **Steps**: ADMIN gọi endpoint trên.
- **Test Data**: Invite hợp lệ 1 công ty.
- **Expected Result**: **200** `{ success: true, data: { id, email, hoTen, chucVu } }` — đúng hình dạng hiện có, không đổi (`api-contract.md` Mục 4.7 "response và mã lỗi giữ nguyên"). Tuyệt đối không có field mật khẩu dạng rõ hay hash.
- **Actual Result / Status**: Chưa chạy — chờ code (Phase B). Ready.

### TC-003 — Mật khẩu không bị ghi vào `SysLog`

- **Requirement**: BR-007
- **Tầng**: BE-integration
- **Endpoint**: N/A — kiểm dữ liệu sau TC-002
- **Preconditions**: Sau khi duyệt lời mời thành công.
- **Steps**: Query `SysLog` với `hanhDong = 'APPROVE_INVITE'` vừa ghi, đọc `chiTiet`.
- **Test Data**: Cùng invite ở TC-002.
- **Expected Result**: `chiTiet` giữ nguyên `{ inviteId, newUserId, email, ownerId, donViIds }` (`data-model.md` Mục 8) — không có key nào chứa mật khẩu/hash. **CẤM** thêm field mật khẩu (ghi rõ trong contract).
- **Actual Result / Status**: Chưa chạy — chờ code. Ready.

### TC-004 — Mật khẩu không bị log ra console/log hệ thống

- **Requirement**: BR-007
- **Tầng**: BE-unit / code review thủ công
- **Endpoint**: N/A
- **Preconditions**: Đọc code sau khi Backend cài đặt.
- **Steps**: Grep `adminInvite.service.ts` (nhánh `catch` quanh `sendMail`) và `mailer.service.ts` tìm lệnh log biến chứa mật khẩu/nội dung mail.
- **Test Data**: N/A.
- **Expected Result**: Nhánh `catch` KHÔNG log lỗi gốc (giữ nguyên hiện trạng `adminInvite.service.ts:120`); `errorHandler` chỉ log `MailError` với message cố định; `mailer.service.ts` không có chế độ "in email ra console" (đã xác nhận trong contract, không được thêm).
- **Actual Result / Status**: Chưa chạy — thực hiện ở code-reviewer + QA đối chiếu lại khi Backend hoàn tất.

### TC-005 — Duyệt lời mời tạo `User` + `DonViAccess` đúng, đánh dấu `phaiDoiMatKhau=true`

- **Requirement**: AC-02.1, BR-006, FR-003, BR-004
- **Tầng**: BE-integration
- **Endpoint**: `POST /api/v1/admin/companies/invites/:id/approve`
- **Preconditions**: `InviteRequest` PENDING với `donViIds = [X, Y]`.
- **Steps**: ADMIN duyệt.
- **Test Data**: Invite 2 công ty.
- **Expected Result**: **200**; tạo đúng 1 `User` role `OWNER_EMPLOYEE` với cột `phaiDoiMatKhau = true`; `DonViAccess` cho cả X và Y (`xemLuong=false` mặc định); gửi đúng 1 email (`inviteApprovedEmail` nội dung mới, Mục 5 `api-contract.md`) tới địa chỉ được mời **sau khi transaction commit** (`data-model.md` Mục 5.1 bước 4).
- **Actual Result / Status**: Chưa chạy — chờ code. Ready.

### TC-006 — Gửi email chứa mật khẩu thất bại → rollback toàn bộ

- **Requirement**: AC-02.4, BR-010, E-004, EC-01
- **Tầng**: BE-integration
- **Endpoint**: `POST /api/v1/admin/companies/invites/:id/approve`
- **Preconditions**: Mock `sendMail` ném lỗi (giả lập SMTP lỗi) sau khi transaction đã commit.
- **Steps**: ADMIN duyệt lời mời.
- **Test Data**: Invite hợp lệ 1 công ty.
- **Expected Result**: **502** `{ success: false, message: "..." }` — `MESSAGES.COMPANY.INVITE_WELCOME_MAIL_FAILED` (câu hiện có, không đổi — `api-contract.md` MT-05); `User` vừa tạo bị xoá (cascade `DonViAccess`); `InviteRequest` quay lại `PENDING` (`approvedById=null`, `resolvedAt=null`); không có `SysLog APPROVE_INVITE` nào được ghi (rollback trước khi ghi log).
- **Actual Result / Status**: Chưa chạy — cơ chế rollback đã có sẵn trong code hiện tại, chỉ cần xác nhận vẫn đúng khi mở rộng thêm cờ `phaiDoiMatKhau` (regression + mở rộng). Ready. Tiếp nối ở TC-067 (duyệt lại sau rollback).

### TC-007 — Nhân viên đăng nhập lần đầu bằng mật khẩu email

- **Requirement**: AC-02.2
- **Tầng**: BE-integration
- **Endpoint**: `POST /api/v1/auth/login`
- **Preconditions**: `User` vừa tạo qua TC-005 (`phaiDoiMatKhau=true`).
- **Steps**: `POST /auth/login` với email + mật khẩu tạm vừa nhận.
- **Test Data**: Email/mật khẩu hợp lệ.
- **Expected Result**: **200** — đăng nhập thành công (không bị chặn ở bước login, guard nằm ở request KẾ TIẾP). `data.phaiDoiMatKhau = true`; vé (access + refresh token) mang claim `phaiDoiMatKhau: true` (`api-contract.md` Mục 4.1, `data-model.md` Mục 6).
- **Actual Result / Status**: Chưa chạy — chờ code. Ready (không còn phụ thuộc SPEC-QA-001).

### TC-008 — Tài khoản "phải đổi mật khẩu" gọi API nghiệp vụ khác bị chặn

- **Requirement**: FR-004, E-005
- **Tầng**: BE-integration
- **Endpoint**: bất kỳ route dùng `app.authenticate` ngoài whitelist, vd `GET /api/v1/companies`
- **Preconditions**: Đăng nhập thành công theo TC-007, chưa đổi mật khẩu.
- **Steps**: Gọi `GET /companies` (và thử thêm 1 route admin bất kỳ, 1 route HĐĐT bất kỳ theo Ca biên #2 của contract).
- **Test Data**: Token của tài khoản đang `phaiDoiMatKhau=true`.
- **Expected Result**: **403** `{ success: false, code: "PASSWORD_CHANGE_REQUIRED", message: "Bạn cần đổi mật khẩu trước khi tiếp tục" }` — chặn ngay trong `app.authenticate`, trước khi vào handler route (`api-contract.md` Mục 3.1-3.2).
- **Actual Result / Status**: Chưa chạy — chờ code. Ready.

### TC-009 — Whitelist API được phép khi đang "phải đổi mật khẩu"

- **Requirement**: FR-004 (SPEC-QA-002 đã giải quyết)
- **Tầng**: BE-integration
- **Endpoint**: `GET /api/v1/auth/me`, `POST /api/v1/auth/change-password`
- **Preconditions**: Như TC-008.
- **Steps**: Gọi lần lượt: (a) `GET /auth/me`, (b) `POST /auth/change-password` với body hợp lệ, (c) `POST /auth/logout` (route không qua `authenticate`, tự nhiên được phép).
- **Test Data**: Token của tài khoản đang `phaiDoiMatKhau=true`.
- **Expected Result**: **(a)** 200, `data.phaiDoiMatKhau` = giá trị **claim của vé đang dùng** (`true`), KHÔNG phải giá trị DB — tránh vòng lặp nếu đã đổi ở máy khác (`api-contract.md` Mục 4.2). **(b)** 200 nếu body hợp lệ (xem TC-010). **(c)** 200, không qua `authenticate` nên không bị ảnh hưởng.
- **Actual Result / Status**: Chưa chạy — **RESOLVED, Ready** (không còn blocked bởi SPEC-QA-002 — contract đã chốt whitelist đầy đủ 2 route + xác nhận `/auth/me` trả claim của vé, không phải DB).

### TC-010 — Đổi mật khẩu bắt buộc thành công

- **Requirement**: AC-02.3, FR-005
- **Tầng**: BE-integration
- **Endpoint**: `POST /api/v1/auth/change-password`
- **Preconditions**: Như TC-008, có mật khẩu tạm hợp lệ.
- **Steps**: 1) Gọi endpoint với `{ currentPassword: "<mật khẩu tạm>", newPassword: "MatKhauMoi123" }`. 2) Đăng xuất. 3) Đăng nhập lại bằng mật khẩu mới.
- **Test Data**: `newPassword` đạt `passwordRule`, khác `currentPassword`.
- **Expected Result**: Bước 1: **200**, response cùng hình dạng `GET /auth/me` với `phaiDoiMatKhau: false`; cookie phiên mới được đặt (`batDauPhien` với `tokenVersion` mới); `SysLog CHANGE_PASSWORD { batBuoc: true }`. Bước 3: đăng nhập thành công, `phaiDoiMatKhau: false`, không bị chặn nữa.
- **Actual Result / Status**: Chưa chạy — chờ code. Ready (endpoint mới, contract đầy đủ).

### TC-011 — Đổi mật khẩu bắt buộc với mật khẩu mới không đạt chính sách

- **Requirement**: AC-02.5, E-006
- **Tầng**: BE-integration
- **Endpoint**: `POST /api/v1/auth/change-password`
- **Preconditions**: Như TC-008.
- **Steps**: Gọi với `newPassword: "abc"` (dưới 8 ký tự), rồi `newPassword: "abcdefgh"` (đủ dài nhưng thiếu số).
- **Test Data**: `"abc"`, `"abcdefgh"`.
- **Expected Result**: Cả 2 lần đều **400** `errors.fieldErrors.newPassword` (tái dùng `passwordRule`), `phaiDoiMatKhau` vẫn `true`, tài khoản vẫn bị chặn API nghiệp vụ khác.
- **Actual Result / Status**: Chưa chạy — chờ code. Ready.

### TC-012 — Dùng "Quên mật khẩu" (OTP) thay vì đổi qua form bắt buộc

- **Requirement**: BR-011
- **Tầng**: BE-integration
- **Endpoint**: `POST /api/v1/auth/forgot-password` → `POST /api/v1/auth/reset-password`
- **Preconditions**: Tài khoản đang `phaiDoiMatKhau=true` (vừa duyệt, chưa đăng nhập lần nào).
- **Steps**: Gọi 2 endpoint trên với OTP hợp lệ, thay vì đăng nhập bằng mật khẩu email trước.
- **Test Data**: Email của tài khoản vừa duyệt.
- **Expected Result**: **RESOLVED** — `data-model.md` Mục 5.3 xác nhận `resetPasswordWithOtp` thêm `phaiDoiMatKhau: false` vào `tx.user.update` sẵn có. Sau khi đặt lại: đăng nhập bằng mật khẩu mới → `phaiDoiMatKhau: false` ngay, KHÔNG bị chặn ở request tiếp theo. Response/lỗi/rate limit của OTP không đổi (`api-contract.md` Mục 4.5).
- **Actual Result / Status**: Chưa chạy — **hết blocked** (SPEC-QA-003 đã giải quyết). Ready. Xem thêm TC-064 (kiểm sâu hơn ở mức DB).

### TC-013 — Đổi mật khẩu sau khi đã ở trạng thái Bình thường không quay lại "phải đổi"

- **Requirement**: states.md (BinhThuong → BinhThuong)
- **Tầng**: BE-integration
- **Preconditions**: Tài khoản đã hoàn tất đổi mật khẩu bắt buộc (TC-010).
- **Steps**: Tự đổi mật khẩu lần nữa qua `POST /auth/change-password` (đổi tự nguyện), hoặc dùng OTP.
- **Test Data**: Mật khẩu mới hợp lệ khác.
- **Expected Result**: Thành công (`phaiDoiMatKhau` giữ `false`); route `POST /auth/change-password` áp dụng cho MỌI vai trò đã đăng nhập, không riêng nhân viên mới (`api-contract.md` Mục 4.3 "Áp cho: mọi vai trò"). Không có cờ nào bật lại "phải đổi mật khẩu" ở lần đăng nhập kế tiếp.
- **Actual Result / Status**: Chưa chạy — regression, Ready.

## Nhóm 2 — Mời nhân viên (US-01, BR-002/003/008/009, FR-001/002/006/007/008/011, E-001/002/003/008)

### TC-014 — Mời nhiều công ty hợp lệ (happy path)

- **Requirement**: AC-01.1, FR-002, BR-003, EC-03
- **Tầng**: E2E / BE-integration
- **Endpoint**: `POST /api/v1/companies/invite`
- **Preconditions**: Owner sở hữu công ty X (đang chọn ở header) và Y.
- **Steps**: Mở dialog Thêm nhân viên → thấy X đã tick sẵn → tick thêm Y → điền `hoTen`/`email`/`chucVu` hợp lệ → Gửi.
- **Test Data**: `{ email: "nv1@x.vn", hoTen: "Nguyễn Văn A", chucVu: "Kế toán", donViIds: [X, Y] }`.
- **Expected Result**: **201** `{ id, email, hoTen, chucVu, donViIds: [X,Y], role: "OWNER_EMPLOYEE", status: "PENDING", createdAt }`; lời mời xuất hiện ở bảng "Đang chờ duyệt".
- **Actual Result / Status**: Chưa chạy — API không đổi hình dạng (đã hỗ trợ nhiều công ty từ trước, `api-contract.md` Mục 4.6), rủi ro thấp; UI mới cần code.

### TC-015 — Mời với công ty không thuộc owner

- **Requirement**: FR-011
- **Tầng**: BE-integration/security
- **Endpoint**: `POST /api/v1/companies/invite`
- **Preconditions**: Công ty Z thuộc owner khác.
- **Steps**: Gọi thẳng API (bỏ qua UI) với `donViIds: [Z]`.
- **Test Data**: `donViIds: [Z.id]`.
- **Expected Result**: **403** `COMPANY.NO_ACCESS` (không có `code`, khác nhánh route tenant — `api-contract.md` Mục 4.11), không tạo `InviteRequest`.
- **Actual Result / Status**: Chưa chạy — regression, hành vi đã có (`company.service.ts:248-254`).

### TC-016 — Mời với `donViIds` rỗng

- **Requirement**: AC-01.6, E-008
- **Tầng**: BE-integration + UI-manual
- **Endpoint**: `POST /api/v1/companies/invite`
- **Preconditions**: —
- **Steps**: (UI) Bỏ tick hết công ty trong dialog, bấm Gửi. (BE) Gọi thẳng API với `donViIds: []`.
- **Test Data**: `donViIds: []`.
- **Expected Result**: UI chặn submit ngay, hiển thị "Chọn ít nhất 1 công ty", không gọi API. Gọi thẳng API: **400** Zod (`inviteUserSchema.donViIds.min(1)`).
- **Actual Result / Status**: Chưa chạy — BE validate đã có sẵn, UI cần code mới.

### TC-017 — Mời với `donViIds` chứa phần tử trùng lặp

- **Requirement**: SPEC-QA-005 (đã giải quyết)
- **Tầng**: BE-integration
- **Endpoint**: `POST /api/v1/companies/invite`
- **Preconditions**: Owner sở hữu công ty X.
- **Steps**: Gọi với `donViIds: [X, X]`.
- **Test Data**: `donViIds: [X.id, X.id]`.
- **Expected Result**: **400** `errors.fieldErrors.donViIds` = `VALIDATION.DON_VI_TRUNG` ("Danh sách công ty bị trùng") — theo `.refine` mới trong `inviteUserSchema` (`api-contract.md` Mục 4.6). **Trước khi fix** (hành vi cũ QA phát hiện): 403 `COMPANY.NO_ACCESS` sai bản chất — KHÔNG còn là kết quả mong đợi.
- **Actual Result / Status**: Chưa chạy — Ready, gap đã được Architect fix trong contract.

### TC-018 — Mời email đã có tài khoản của owner khác

- **Requirement**: AC-01.3, E-002, BR-008
- **Tầng**: BE-integration
- **Endpoint**: `POST /api/v1/companies/invite`
- **Preconditions**: Email `b@x.vn` đã là nhân viên/owner của tài khoản khác.
- **Steps**: Owner A mời `b@x.vn`.
- **Test Data**: `email: "b@x.vn"`.
- **Expected Result**: **409** `COMPANY.EMAIL_ALREADY_MEMBER`, không tạo `InviteRequest`.
- **Actual Result / Status**: Chưa chạy — regression, hành vi đã có.

### TC-019 — Mời lại email đã là nhân viên của CHÍNH owner

- **Requirement**: EC-02
- **Tầng**: BE-integration
- **Endpoint**: `POST /api/v1/companies/invite`
- **Preconditions**: `b@x.vn` đã là `OWNER_EMPLOYEE` của owner A.
- **Steps**: Owner A mời lại `b@x.vn` (muốn cấp thêm công ty khác).
- **Test Data**: `email: "b@x.vn"`.
- **Expected Result**: **409** `COMPANY.EMAIL_ALREADY_MEMBER` (giống hệt TC-018, wording chờ OQ-5). Hướng đúng: owner dùng panel Sửa quyền (US-04) thay vì mời lại.
- **Actual Result / Status**: Chưa chạy — regression; wording message có thể đổi tuỳ OQ-5 (không chặn tiến độ).

### TC-020 — Mời lại email đang có lời mời PENDING

- **Requirement**: AC-01.2, E-003
- **Tầng**: BE-integration
- **Endpoint**: `POST /api/v1/companies/invite`
- **Preconditions**: Có `InviteRequest` PENDING cho `email: "c@x.vn"` cùng owner A.
- **Steps**: Owner A gửi lại lời mời cùng email.
- **Test Data**: `email: "c@x.vn"`.
- **Expected Result**: **409** `COMPANY.INVITE_ALREADY_PENDING`, không tạo thêm bản ghi.
- **Actual Result / Status**: Chưa chạy — regression.

### TC-021 — Vượt trần nhân viên tại thời điểm MỜI

- **Requirement**: regression (`limits.service.ts`)
- **Tầng**: BE-integration
- **Endpoint**: `POST /api/v1/companies/invite`
- **Preconditions**: Owner đã có `employeeCount + pendingCount` = trần gói.
- **Steps**: Owner gửi thêm 1 lời mời mới.
- **Test Data**: Owner ở đúng ngưỡng trần.
- **Expected Result**: **403** `SUBSCRIPTION.USER_LIMIT_REACHED`, không tạo `InviteRequest`.
- **Actual Result / Status**: Chưa chạy — regression.

### TC-022 — Vượt trần nhân viên tại thời điểm DUYỆT (gói hạ sau khi mời)

- **Requirement**: regression, đối chiếu `inviteSeatQuota.test.ts` đã có
- **Tầng**: BE-integration
- **Endpoint**: `POST /api/v1/admin/companies/invites/:id/approve`
- **Preconditions**: Lời mời PENDING hợp lệ lúc tạo; sau đó owner hạ gói khiến trần nhân viên giảm dưới số hiện có.
- **Steps**: ADMIN duyệt lời mời.
- **Test Data**: Gói mới có `soNhanVienToiDa` thấp hơn `employeeCount` hiện tại.
- **Expected Result**: **403** `SUBSCRIPTION.USER_LIMIT_REACHED` — chặn trong transaction (bước 3, `data-model.md` Mục 5.1), lời mời vẫn `PENDING`, không tạo `User`.
- **Actual Result / Status**: Chưa chạy — test tương tự đã tồn tại (`src/__tests__/admin/inviteSeatQuota.test.ts`), chạy lại xác nhận không bị ảnh hưởng bởi thay đổi cách sinh mật khẩu.

### TC-023 — Gửi mail báo ADMIN thất bại lúc mời

- **Requirement**: regression
- **Tầng**: BE-integration
- **Endpoint**: `POST /api/v1/companies/invite`
- **Preconditions**: Mock `sendMail` (thông báo admin) ném lỗi.
- **Steps**: Owner gửi lời mời hợp lệ.
- **Test Data**: —
- **Expected Result**: **502** `COMPANY.INVITE_NOTIFY_FAILED`, `InviteRequest` vừa tạo bị xoá lại.
- **Actual Result / Status**: Chưa chạy — regression.

### TC-024 — ADMIN từ chối lời mời

- **Requirement**: regression, BR-004
- **Tầng**: BE-integration
- **Endpoint**: `POST /api/v1/admin/companies/invites/:id/reject`
- **Preconditions**: `InviteRequest` PENDING.
- **Steps**: ADMIN gọi endpoint kèm lý do.
- **Test Data**: `lyDoTuChoi: "Không hợp lệ"`.
- **Expected Result**: **200**, `status: REJECTED`, không tạo `User`, không gửi email mật khẩu.
- **Actual Result / Status**: Chưa chạy — regression, không đổi bởi feature này.

### TC-025 — Owner chỉ có 1 công ty

- **Requirement**: AC-01.5, EC-07
- **Tầng**: UI-manual
- **Preconditions**: Owner chỉ sở hữu 1 công ty X.
- **Steps**: Mở dialog Thêm nhân viên.
- **Test Data**: —
- **Expected Result**: Dialog chỉ hiển thị 1 dòng công ty X, đã tick sẵn, owner không cần thao tác chọn thêm.
- **Actual Result / Status**: Chưa chạy — UI mới cần code.

### TC-026 — Nhân viên gọi thẳng API mời nhân viên

- **Requirement**: E-001, BR-009
- **Tầng**: BE-integration/security
- **Endpoint**: `POST /api/v1/companies/invite`
- **Preconditions**: Token của `OWNER_EMPLOYEE`.
- **Steps**: Gọi endpoint trên.
- **Test Data**: Body hợp lệ bất kỳ.
- **Expected Result**: **403** `AUTH.FORBIDDEN` (guard `requireRole('OWNER')`, không có `code`).
- **Actual Result / Status**: Chưa chạy — regression.

## Nhóm 3 — Sửa quyền công ty + xem lương (US-04, BR-012/013/014, FR-009/010/011, E-009/010)

### TC-027 — Cấp thêm 1 công ty cho nhân viên đã duyệt

- **Requirement**: AC-04.1, FR-009
- **Tầng**: BE-integration
- **Endpoint**: `PUT /api/v1/companies/employees/:userId/access`
- **Preconditions**: Nhân viên C có `DonViAccess` ở công ty X, owner sở hữu thêm Y.
- **Steps**: Owner mở panel Sửa quyền của C, tick thêm Y, bấm Lưu.
- **Test Data**: `access: [{donViId: X}, {donViId: Y}]`.
- **Expected Result**: **200** `{ userId, donViIds: [X,Y], so_cong_ty: 2 }`; C thấy thêm Y ở lần gọi `GET /companies` tiếp theo (không cần đăng nhập lại).
- **Actual Result / Status**: Chưa chạy — dùng `setEmployeeAccess()` sẵn có, rủi ro thấp.

### TC-028 — Thu hồi 1 công ty (trong số nhiều công ty)

- **Requirement**: AC-04.2, AC-03.3
- **Tầng**: BE-integration
- **Endpoint**: `PUT /api/v1/companies/employees/:userId/access`
- **Preconditions**: Nhân viên C có quyền X và Y.
- **Steps**: Owner bỏ tick Y, bấm Lưu. C gọi API tiếp theo của Y.
- **Test Data**: `access: [{donViId: X}]`.
- **Expected Result**: **200**; request kế tiếp của C tới Y bị **403** `code: "COMPANY_NO_ACCESS"` ngay (`api-contract.md` Mục 4.11) — không cache; bảng nhân viên phía owner cập nhật ngay cột "Công ty được cấp".
- **Actual Result / Status**: Chưa chạy — logic BE đã có, UI cập nhật cần code.

### TC-029 — Bỏ tick TẤT CẢ công ty + xác nhận hộp thoại

- **Requirement**: AC-04.3, BR-013, EC-04c
- **Tầng**: UI-manual + BE-integration
- **Endpoint**: `PUT /api/v1/companies/employees/:userId/access`
- **Preconditions**: Nhân viên C có quyền X.
- **Steps**: Owner bỏ tick X (còn lại rỗng), bấm Lưu → hộp thoại cảnh báo hiện ra → owner xác nhận.
- **Test Data**: `access: []`.
- **Expected Result**: Hộp thoại hiện đúng nội dung cảnh báo "C sẽ mất quyền vào mọi công ty"; sau xác nhận, gọi API với `{ "access": [] }` → **200** `{ userId, donViIds: [], so_cong_ty: 0 }` (`api-contract.md` Mục 4.10 "Thu hồi hết công ty"); tài khoản C **không bị xoá**, `GET /companies` của C trả `[]`.
- **Actual Result / Status**: Chưa chạy — UI mới cần code; BE nhận `access: []` đã hoạt động đúng.

### TC-030 — Bỏ tick hết nhưng HỦY hộp thoại xác nhận

- **Requirement**: FR-010 (negative)
- **Tầng**: UI-manual
- **Preconditions**: Như TC-029.
- **Steps**: Owner bỏ tick hết, bấm Lưu, hộp thoại hiện ra, owner bấm Hủy.
- **Test Data**: —
- **Expected Result**: KHÔNG gọi API — BE không đòi cờ xác nhận nào (`api-contract.md` Mục 4.10 "Hộp thoại xác nhận là việc của FE"), việc chặn hoàn toàn ở FE.
- **Actual Result / Status**: Chưa chạy — UI mới cần code.

### TC-031 — Bật "Xem lương" cho công ty đã cấp quyền

- **Requirement**: AC-04.4, BR-014 ⚠️ (business sign-off còn mở)
- **Tầng**: BE-integration
- **Endpoint**: `PUT /api/v1/companies/employees/:userId/access`
- **Preconditions**: Nhân viên C có quyền X (`xemLuong=false`).
- **Steps**: Owner tick "Xem lương" của X, bấm Lưu (FE luôn gửi `xemLuong` tường minh — `api-contract.md` Mục 6.1).
- **Test Data**: `access: [{donViId: X, xemLuong: true}]`.
- **Expected Result**: **200**; C xem được dữ liệu lương của X theo đúng rule ADR-007 (không đổi rule). Kỹ thuật Ready (contract Mục 4.10 xác nhận BE tự đúng, không cần sửa code) — chỉ còn chờ business sign-off BR-014.
- **Actual Result / Status**: Chưa chạy — kỹ thuật Ready; **business sign-off BR-014 còn mở** (SPEC-QA-007).

### TC-032 — UI chặn tick "Xem lương" khi chưa cấp quyền công ty đó

- **Requirement**: BR-014 ⚠️
- **Tầng**: UI-manual
- **Preconditions**: Panel Sửa quyền đang mở, công ty Y chưa được tick "Cấp quyền".
- **Steps**: Thử tick "Xem lương" của dòng Y (chưa tick "Cấp quyền").
- **Test Data**: —
- **Expected Result**: Ô "Xem lương" của Y bị disabled cho tới khi "Cấp quyền" của Y được tick trước — ràng buộc UI thuần (BE không chặn ở tầng API vì không có cặp nào tồn tại ngoài `access` gửi lên).
- **Actual Result / Status**: Chưa chạy — UI mới cần code; business sign-off BR-014 còn mở.

### TC-033 — Gọi thẳng API với `donViId` không thuộc owner

- **Requirement**: AC-04.5, E-010, FR-011
- **Tầng**: BE-integration/security
- **Endpoint**: `PUT /api/v1/companies/employees/:userId/access`
- **Preconditions**: Công ty Z thuộc owner khác.
- **Steps**: Gọi thẳng với `access: [{donViId: Z}]`.
- **Test Data**: `donViId: Z.id`.
- **Expected Result**: **403** `COMPANY.NO_ACCESS` (**không** có `code` — đây là lỗi thao tác, khác nhánh route tenant, `api-contract.md` Mục 4.11), không ghi nhận thay đổi nào.
- **Actual Result / Status**: Chưa chạy — regression, hành vi đã có.

### TC-034 — `userId` không thuộc owner / không phải `OWNER_EMPLOYEE`

- **Requirement**: AC-04.6, E-009, BR-012
- **Tầng**: BE-integration/security
- **Endpoint**: `PUT /api/v1/companies/employees/:userId/access`
- **Preconditions**: (a) `userId` là nhân viên của owner khác. (b) `userId` là chính owner đang gọi. (c) `userId` không tồn tại.
- **Steps**: Gọi endpoint cho từng trường hợp.
- **Test Data**: 3 `userId` khác nhau theo 3 case trên.
- **Expected Result**: Cả 3 case đều **404** `USER.NOT_FOUND` — không phân biệt lý do (chống dò).
- **Actual Result / Status**: Chưa chạy — regression.

### TC-035 — 2 lượt `PUT .../access` song song cho cùng nhân viên

- **Requirement**: NFR-004, EC-10 (SPEC-QA-010 đã giải quyết)
- **Tầng**: BE-integration
- **Endpoint**: `PUT /api/v1/companies/employees/:userId/access`
- **Preconditions**: Nhân viên C có quyền X, Y.
- **Steps**: Gửi đồng thời 2 request với 2 danh sách công ty khác nhau cho cùng C.
- **Test Data**: Request 1: `access: [X]`; Request 2: `access: [Y]`.
- **Expected Result**: **KHÔNG có request nào trả 500** — `await khoaHanMuc(tx, 'nhan_vien', ownerId)` là câu đầu tiên trong giao dịch (`api-contract.md` Mục 4.10 điểm 1, `data-model.md` Mục 5.4); 2 request chạy tuần tự, kết quả cuối bằng đúng 1 trong 2 (người ghi sau thắng).
- **Actual Result / Status**: Chưa chạy — **Ready** (không còn phụ thuộc SPEC-QA-010, cơ chế khoá đã có trong contract).

### TC-036 — Thu hồi hết công ty vẫn tính vào trần nhân viên

- **Requirement**: BR-013, EC-04b
- **Tầng**: BE-integration
- **Endpoint**: `POST /api/v1/companies/invite` (kiểm gián tiếp)
- **Preconditions**: Owner ở đúng ngưỡng trần nhân viên; 1 trong số đó (C) bị thu hồi hết công ty (`access: []`).
- **Steps**: Owner cố mời thêm 1 nhân viên mới.
- **Test Data**: —
- **Expected Result**: **403** `SUBSCRIPTION.USER_LIMIT_REACHED` — C vẫn được tính vào `employeeCount` dù không còn công ty nào.
- **Actual Result / Status**: Chưa chạy — regression, hành vi đã có (không cần sửa code).

### TC-037 — Tick lại công ty đã từng bị thu hồi

- **Requirement**: states.md (KhongCoQuyen → CoQuyen)
- **Tầng**: BE-integration
- **Endpoint**: `PUT /api/v1/companies/employees/:userId/access`
- **Preconditions**: Nhân viên C từng có `DonViAccess` ở X với `xemLuong=true`, sau đó bị thu hồi X.
- **Steps**: Owner tick lại X cho C, bấm Lưu.
- **Test Data**: `access: [{donViId: X}]` (không gửi `xemLuong`).
- **Expected Result**: **200**; cặp `DonViAccess` mới tạo có `xemLuong=false` (mặc định) — KHÔNG khôi phục giá trị `true` cũ.
- **Actual Result / Status**: Chưa chạy — regression, hành vi đã có.

### TC-038 — Owner sửa quyền nhân viên KHÔNG thuộc tài khoản mình

- **Requirement**: BR-012, E-009
- **Tầng**: BE-integration/security
- **Endpoint**: `PUT /api/v1/companies/employees/:userId/access`
- **Preconditions**: Nhân viên D thuộc owner khác.
- **Steps**: Owner A gọi endpoint với `userId = D.id`.
- **Test Data**: —
- **Expected Result**: **404** `USER.NOT_FOUND` (không lộ D có tồn tại hay không).
- **Actual Result / Status**: Chưa chạy — regression, trùng TC-034(a), giữ riêng để nhấn mạnh góc nhìn bảo mật cross-owner.

## Nhóm 4 — Cách ly công ty / Tenant isolation (US-03, BR-002, FR-006/007, E-007)

### TC-039 — Nhân viên chỉ thấy đúng công ty được cấp

- **Requirement**: AC-03.1, FR-007
- **Tầng**: BE-integration
- **Endpoint**: `GET /api/v1/companies`
- **Preconditions**: Nhân viên A chỉ có `DonViAccess` ở X (owner còn có Y không cấp cho A).
- **Steps**: A gọi endpoint.
- **Test Data**: —
- **Expected Result**: **200**, chỉ chứa X, không có Y.
- **Actual Result / Status**: Chưa chạy — regression, không đổi.

### TC-040 — `switchCompany` sang công ty không được cấp

- **Requirement**: AC-03.2, E-007
- **Tầng**: BE-integration/security
- **Endpoint**: `POST /api/v1/companies/{Y}/switch`
- **Preconditions**: Như TC-039.
- **Steps**: A gọi thẳng API (bỏ qua UI).
- **Test Data**: `id: Y`.
- **Expected Result**: **403** `COMPANY.NO_ACCESS` — **KHÔNG có `code`** (`company.controller.ts:78` không nằm trong 4 điểm gắn `COMPANY_NO_ACCESS`, `api-contract.md` Mục 1.2/4.11), không cấp token mới.
- **Actual Result / Status**: Chưa chạy — regression.

### TC-041 — Gọi thẳng API dữ liệu tenant của công ty không được cấp

- **Requirement**: AC-03.2, E-007
- **Tầng**: BE-integration/security
- **Endpoint**: route tenant bất kỳ (HĐĐT/Tờ khai/DVC/HRM/Kế toán) của công ty Y, qua `resolveTenantDb`/`resolveTenantInfo`/`resolveTenantCtx`
- **Preconditions**: Như TC-039, A KHÔNG chọn Y ở header.
- **Steps**: A tự sửa request gọi API dữ liệu của Y ở từng module: (1) HĐĐT, (2) Tờ khai, (3) Dịch vụ công, (4) HRM, (5) Kế toán.
- **Test Data**: `donViId: Y`.
- **Expected Result**: Cả 5 module đều trả **403** `{ code: "COMPANY_NO_ACCESS", message: "..." }` — đúng 4 điểm kiểm trong `api-contract.md` Mục 1.2 (`resolveTenantDb.ts:57,70`, `kiemCongTyDangChon.ts:21`, `taiLieu.controller.ts:105`). Ngoại lệ: `hddt/gdt.controller.ts` KHÔNG ném lỗi này, tự trả `null` khi hết quyền (giữ nguyên, không có `code`).
- **Actual Result / Status**: Chưa chạy — regression trọng yếu MAXV, cần chạy lại thật khi Backend gắn `code` vào 4 điểm này.

### TC-042 — Thu hồi quyền GIỮA lúc nhân viên đang mở công ty đó

- **Requirement**: AC-03.3, EC-04a, EC-06
- **Tầng**: BE-integration
- **Endpoint**: route tenant bất kỳ của công ty X (sau khi bị thu hồi)
- **Preconditions**: Nhân viên A đang mở công ty X (token nhúng `donViId=X`).
- **Steps**: Owner thu hồi X khỏi A (qua panel Sửa quyền). A gọi tiếp API dữ liệu của X mà KHÔNG tải lại trang.
- **Test Data**: —
- **Expected Result**: Request tiếp theo của A bị **403** `code: "COMPANY_NO_ACCESS"` ngay lập tức. FE nhận `code` này sẽ tự đồng bộ lại (xem TC-073) — hành vi TỐT HƠN mức spec "chấp nhận trễ tới khi tải lại trang" (MT-06).
- **Actual Result / Status**: Chưa chạy — regression + FE mới cần code (TC-073).

### TC-043 — Chống truy cập chéo tenant bằng cách tự sửa `donViId`

- **Requirement**: BR-002 (data leakage — trọng yếu MAXV)
- **Tầng**: BE-integration/security
- **Endpoint**: route tenant bất kỳ + `POST /companies/{B}/switch`
- **Preconditions**: Nhân viên A có `DonViAccess` ở X, KHÔNG có ở B.
- **Steps**: A đăng nhập với token nhúng `donViId=X`, sau đó cố tự chèn `donViId=B` vào request (tuỳ route), hoặc gọi `/switch` sang B trước.
- **Test Data**: `donViId: B`.
- **Expected Result**: Không route nào trả về dữ liệu của B cho A trong bất kỳ kịch bản nào (`/switch` bị chặn ở TC-040, route tenant bị chặn ở TC-041/TC-042).
- **Actual Result / Status**: Chưa chạy — bài test cách ly tenant CỐT LÕI của MAXV, phải re-run mỗi khi có route mới.

### TC-044 — Nhân viên chưa được cấp công ty nào đăng nhập

- **Requirement**: EC-08
- **Tầng**: BE-integration/UI
- **Endpoint**: `GET /api/v1/companies`
- **Preconditions**: Nhân viên A có `donViIds` rỗng (chỉ xảy ra nếu bị thu hồi hết SAU khi duyệt, vì lúc mời `donViIds.min(1)` chặn từ đầu).
- **Steps**: A đăng nhập, gọi `GET /companies`.
- **Test Data**: —
- **Expected Result**: **200**, mảng rỗng `[]`; FE ẩn hẳn bộ chọn công ty ở header. Chưa có thông báo rõ ràng nào cho A biết lý do (OQ-8 còn mở) — hành vi HIỆN TẠI, chưa phải bug.
- **Actual Result / Status**: Chưa chạy — regression phần BE; phần thông báo UI phụ thuộc OQ-8.

## Nhóm 5 — Tương thích ngược (Regression)

### TC-045 — Nhân viên hiện có không bị bắt đổi mật khẩu vô cớ

- **Requirement**: `data-model.md` Mục 4.1
- **Tầng**: BE-integration
- **Endpoint**: `POST /api/v1/auth/login`
- **Preconditions**: Tài khoản `OWNER_EMPLOYEE` tạo TRƯỚC khi triển khai (migration mặc định `phaiDoiMatKhau=false`).
- **Steps**: Đăng nhập bằng mật khẩu hiện có.
- **Test Data**: —
- **Expected Result**: **200**, KHÔNG bị chặn bởi guard `PASSWORD_CHANGE_REQUIRED` — `NOT NULL DEFAULT false` áp dụng ngay khi migration chạy, không cần bước chuyển dữ liệu.
- **Actual Result / Status**: Chưa chạy — chờ code + migration thật.

### TC-046 — Luồng "Quên mật khẩu" (OTP) cho tài khoản thường không đổi hành vi

- **Requirement**: BR-011
- **Tầng**: BE-integration
- **Endpoint**: `POST /api/v1/auth/forgot-password`, `POST /api/v1/auth/reset-password`
- **Preconditions**: Tài khoản bình thường (`phaiDoiMatKhau=false`).
- **Steps**: Chạy lại luồng OTP như hiện có.
- **Test Data**: —
- **Expected Result**: Hành vi giống hệt hiện tại (rate limit theo giờ, hết hạn OTP, tăng `tokenVersion`); thêm `phaiDoiMatKhau: false` vào update không ảnh hưởng gì (đã là `false`).
- **Actual Result / Status**: Chưa chạy — regression thuần.

### TC-047 — Luồng ADMIN đặt lại mật khẩu không đổi hành vi

- **Requirement**: BR-011
- **Tầng**: BE-integration
- **Endpoint**: `adminResetPassword` (route admin sẵn có)
- **Preconditions**: ADMIN gọi cho 1 user bất kỳ.
- **Steps**: Chạy luồng hiện có.
- **Test Data**: —
- **Expected Result**: Vẫn dùng `bamMatKhauKhongAiBiet()` (KHÔNG đổi sang `sinhMatKhauTam()`), gửi `adminResetPasswordEmail` (hướng dẫn OTP, KHÔNG chứa mật khẩu), KHÔNG đụng cờ `phaiDoiMatKhau` (`api-contract.md` Mục 4.7.3 "Đối chiếu luồng adminResetPassword" — 2 luồng khác mục đích, không thống nhất, giữ nguyên 100%).
- **Actual Result / Status**: Chưa chạy — regression, xác nhận Backend không lỡ tay đổi luồng này.

### TC-048 — `fe_maxv` và UI duyệt lời mời ở `maxv/` vẫn chạy đúng

- **Requirement**: regression (contract cũ không đổi hình dạng)
- **Tầng**: FE-build / manual smoke
- **Preconditions**: `fe_maxv` (`EmployeesTable`, `InviteEmployeeDialog`) và `maxv/` (màn duyệt lời mời admin) build thành công.
- **Steps**: 1) `npm run build` cả 2 app. 2) Smoke: mời nhân viên qua `fe_maxv`, duyệt qua `maxv/`.
- **Test Data**: —
- **Expected Result**: Build pass; response duyệt không đổi hình dạng — câu "Hệ thống sẽ tạo tài khoản và gửi mật khẩu đăng nhập qua email" ở `maxv/` **nay đúng trở lại** (`api-contract.md` Mục 8). **Lưu ý mới từ contract**: nhân viên MỚI (duyệt sau triển khai) đăng nhập ở `fe_maxv` sẽ nhận 403 `PASSWORD_CHANGE_REQUIRED` ở MỌI request vì `fe_maxv` không có màn đổi mật khẩu và không đọc `code` — đây là hạn chế đã biết (MT-12), không phải bug của feature; nhân viên phải đổi mật khẩu ở `hdđt_maxv` trước.
- **Actual Result / Status**: Chưa chạy — Phase B, sau khi FE/BE code xong. Cần ghi rõ hướng dẫn nội bộ cho case `fe_maxv`.

### TC-049 — Email mới vẫn đi qua kênh SMTP bắt buộc TLS

- **Requirement**: NFR-002
- **Tầng**: BE-integration
- **Preconditions**: Cấu hình SMTP cổng khác 465 (STARTTLS).
- **Steps**: Gửi email chứa mật khẩu tạm (duyệt lời mời).
- **Test Data**: —
- **Expected Result**: `sendMail` dùng đúng `cauHinhSmtp` hiện có (`requireTLS: true` khi cổng != 465), không hạ chuẩn.
- **Actual Result / Status**: Chưa chạy — regression, không đổi `mailer.service.ts`, chỉ đổi nội dung template.

## Nhóm 6 — UI `hdđt_maxv` (manual)

### TC-050 — Chỉ owner thấy menu "Cài đặt → Nhân viên"

- **Requirement**: FR-008, AC-01.4, BR-009
- **Tầng**: UI-manual (desktop/tablet/mobile)
- **Preconditions**: 1 tài khoản OWNER, 1 tài khoản OWNER_EMPLOYEE.
- **Steps**: Đăng nhập lần lượt, mở trang Cài đặt trên 3 viewport (desktop ≥1024px, tablet ~768px, mobile ~375px).
- **Test Data**: —
- **Expected Result**: OWNER thấy mục "Nhân viên" ở cả 3 viewport (thêm vào `NAV_ITEMS`, `SettingsPage.tsx:21-26`); OWNER_EMPLOYEE KHÔNG thấy mục này ở bất kỳ viewport nào.
- **Actual Result / Status**: Chưa chạy — UI mới cần code.

### TC-051 — Trạng thái loading khi tải danh sách

- **Requirement**: UI base
- **Tầng**: UI-manual
- **Preconditions**: Network throttle chậm.
- **Steps**: Mở màn Cài đặt → Nhân viên.
- **Test Data**: —
- **Expected Result**: Hiển thị skeleton/spinner rõ ràng trong lúc chờ `GET /companies/employees` + `GET /companies/invites`.
- **Actual Result / Status**: Chưa chạy — UI mới cần code.

### TC-052 — Trạng thái lỗi khi tải danh sách thất bại

- **Requirement**: UI base
- **Tầng**: UI-manual
- **Preconditions**: Mock API trả 500 hoặc ngắt mạng.
- **Steps**: Mở màn Nhân viên.
- **Test Data**: —
- **Expected Result**: Hiển thị thông báo lỗi rõ ràng kèm nút "Thử lại".
- **Actual Result / Status**: Chưa chạy — UI mới cần code.

### TC-053 — Trạng thái rỗng: owner chưa mời ai

- **Requirement**: UI base
- **Tầng**: UI-manual
- **Preconditions**: Owner mới, chưa mời nhân viên nào.
- **Steps**: Mở màn Nhân viên.
- **Test Data**: —
- **Expected Result**: Bảng nhân viên chỉ có dòng chính owner; bảng "Đang chờ duyệt" hiển thị empty-state.
- **Actual Result / Status**: Chưa chạy — UI mới cần code.

### TC-054 — Empty-state nhân viên chưa có công ty (cross-ref TC-044)

- **Requirement**: EC-08 (phụ thuộc OQ-8)
- **Tầng**: UI-manual
- **Preconditions**: Như TC-044.
- **Steps**: Nhân viên đăng nhập, quan sát header/trang chủ.
- **Test Data**: —
- **Expected Result HIỆN TẠI**: Chỉ ẩn bộ chọn công ty, không có thông báo. **Kỳ vọng NẾU OQ-8 chốt "có"**: hiện dòng thông báo ngắn "Chưa được cấp công ty nào, liên hệ chủ tài khoản".
- **Actual Result / Status**: Chưa chạy — phụ thuộc OQ-8 (còn mở).

### TC-055 — Keyboard/accessibility cơ bản

- **Requirement**: UI base (accessibility)
- **Tầng**: UI-manual
- **Preconditions**: Dialog Thêm nhân viên và panel Sửa quyền đã code.
- **Steps**: Dùng Tab/Shift+Tab, Space/Enter, kiểm focus trap.
- **Test Data**: —
- **Expected Result**: Thứ tự tab hợp lý; checkbox có label liên kết đúng; focus quay lại đúng chỗ sau khi đóng dialog.
- **Actual Result / Status**: Chưa chạy — UI mới cần code.

## Nhóm 7 — Security bổ sung

### TC-056 — Rate limit mời nhân viên giữ nguyên

- **Requirement**: NFR-003
- **Tầng**: BE-integration
- **Endpoint**: `POST /api/v1/companies/invite`
- **Preconditions**: —
- **Steps**: Gửi 21 lời mời liên tiếp trong 1 giờ từ cùng 1 owner.
- **Test Data**: —
- **Expected Result**: Lời mời thứ 21 bị **429** (20 lượt/giờ theo owner, không đổi).
- **Actual Result / Status**: Chưa chạy — regression.

### TC-057 — Mật khẩu không lộ qua log request/response middleware

- **Requirement**: BR-007
- **Tầng**: BE-integration / code review
- **Endpoint**: `POST /api/v1/auth/change-password`
- **Preconditions**: Middleware log request/response (nếu có) đang bật.
- **Steps**: Gửi request đổi mật khẩu (body chứa `currentPassword`/`newPassword`), kiểm log sinh ra.
- **Test Data**: —
- **Expected Result**: Log không chứa giá trị mật khẩu dạng rõ.
- **Actual Result / Status**: Chưa chạy — cần xác nhận middleware log hiện tại có mask field nhạy cảm hay không.

### TC-058 — Validator chặn ký tự xuống dòng trong `hoTen`/`chucVu`

- **Requirement**: regression (chống chèn nội dung email)
- **Tầng**: BE-unit
- **Endpoint**: `POST /api/v1/companies/invite`
- **Preconditions**: —
- **Steps**: Gọi với `hoTen: "A\nBcc: attacker@evil.com"`.
- **Test Data**: Chuỗi chứa `\n`.
- **Expected Result**: **400** (regex `^[^\r\n]+$` đã chặn — regression).
- **Actual Result / Status**: Chưa chạy — regression.

### TC-059 — FE escape `hoTen`/`chucVu` khi hiển thị (chống XSS)

- **Requirement**: security UI
- **Tầng**: UI-manual/security
- **Preconditions**: Nhân viên có `chucVu` chứa `<img src=x onerror=alert(1)>` (seed trực tiếp, validator BE không chặn `<`/`>`, chỉ chặn xuống dòng).
- **Steps**: Mở bảng nhân viên ở `hdđt_maxv`, quan sát dòng nhân viên đó.
- **Test Data**: `chucVu: "<img src=x onerror=alert(1)>"`.
- **Expected Result**: React tự escape khi render text thường → không có alert nào chạy.
- **Actual Result / Status**: Chưa chạy — UI mới cần code, cần review code không dùng `dangerouslySetInnerHTML` cho field này.

### TC-060 — `GET /companies/employees` gọi bởi nhân viên / ADMIN (phụ thuộc OQ-7)

- **Requirement**: EC-09 (SPEC-QA-008, còn mở)
- **Tầng**: BE-integration/security
- **Endpoint**: `GET /api/v1/companies/employees`
- **Preconditions**: (a) Token `OWNER_EMPLOYEE`. (b) Token `ADMIN`.
- **Steps**: Gọi endpoint với từng token.
- **Test Data**: —
- **Expected Result HIỆN TẠI** (route chỉ `authenticate`): (a) 200, trả toàn bộ đồng nghiệp kèm `donViAccess`/`xemLuong`. (b) 404 `COMPANY.NOT_FOUND` (`resolveAccountOwnerId` trả `null` cho ADMIN). **Kỳ vọng NẾU OQ-7 chốt "có siết"** (`api-contract.md` Mục 4.8): guard đổi thành `[authenticate, requireRole('OWNER')]` → (a) **403** `AUTH.FORBIDDEN`; (b) **403** `AUTH.FORBIDDEN` (đổi từ 404 → 403, vì bị chặn ở guard trước khi vào service).
- **Actual Result / Status**: Chưa chạy — kết quả phụ thuộc hoàn toàn vào quyết định OQ-7 (còn mở); phải re-test ngay khi OQ-7 chốt.

## Nhóm 8 — TC mới thêm sau khi đối chiếu contract (TC-061 → TC-074, KHÔNG đánh số lại TC cũ)

### TC-061 — Đổi mật khẩu bắt buộc: sai mật khẩu hiện tại

- **Requirement**: FR-004, MT-03 (`api-contract.md`)
- **Tầng**: BE-integration/security
- **Endpoint**: `POST /api/v1/auth/change-password`
- **Preconditions**: Tài khoản đang `phaiDoiMatKhau=true` hoặc bình thường.
- **Steps**: Gọi với `currentPassword` sai.
- **Test Data**: `{ currentPassword: "SaiRoi123", newPassword: "MatKhauMoi123" }`.
- **Expected Result**: **400** (**không phải 401**) `message: AUTH.CURRENT_PASSWORD_WRONG` — cố ý không dùng 401 vì `hdđt_maxv` sẽ tự gọi `/auth/refresh` rồi lặp lại request khi thấy 401 (`lib/http.ts:131-145`), gây đếm rate limit 2 lần và báo lỗi sai (`api-contract.md` Mục 4.3). Không ghi mật khẩu, không tăng `tokenVersion`.
- **Actual Result / Status**: Chưa chạy — TC mới, chờ code.

### TC-062 — Đổi mật khẩu: mật khẩu mới trùng mật khẩu hiện tại

- **Requirement**: FR-004, MT-03
- **Tầng**: BE-integration
- **Endpoint**: `POST /api/v1/auth/change-password`
- **Preconditions**: Biết đúng `currentPassword`.
- **Steps**: Gọi với `newPassword === currentPassword`.
- **Test Data**: `{ currentPassword: "MatKhauTam123", newPassword: "MatKhauTam123" }`.
- **Expected Result**: **400** `errors.fieldErrors.newPassword`: `VALIDATION.PASSWORD_SAME` (refine Zod, `api-contract.md` Mục 4.3 bảng field) — ngăn "đổi" sang chính mật khẩu đang nằm trong email.
- **Actual Result / Status**: Chưa chạy — TC mới, chờ code.

### TC-063 — Đổi mật khẩu bắt buộc thành công → phiên cũ (trình duyệt/thiết bị khác) bị vô hiệu

- **Requirement**: FR-004, FR-005, `data-model.md` Mục 5.2
- **Tầng**: BE-integration/security
- **Endpoint**: `POST /api/v1/auth/change-password`, `POST /api/v1/auth/refresh`
- **Preconditions**: Nhân viên đăng nhập bằng mật khẩu tạm ở 2 trình duyệt A và B (cùng `tokenVersion`).
- **Steps**: 1) A đổi mật khẩu thành công (`tokenVersion+1`). 2) B (chưa refresh) gọi 1 route bất kỳ. 3) B gọi `POST /auth/refresh`.
- **Test Data**: —
- **Expected Result**: Bước 2: B vẫn bị **403** `PASSWORD_CHANGE_REQUIRED` (access token của B còn sống ≤15 phút nhưng mang claim `phaiDoiMatKhau: true` cũ). Bước 3: B nhận **401** `AUTH.REFRESH_INVALID` (`tokenVersion` trong refresh token của B lệch DB — `taiUserPhienConHieuLuc`).
- **Actual Result / Status**: Chưa chạy — TC mới (Ca biên #5 trong `api-contract.md` Mục 10), chờ code.

### TC-064 — Đặt lại mật khẩu qua OTP gỡ cờ ở mức DB (kiểm sâu hơn TC-012)

- **Requirement**: BR-011, MT-01
- **Tầng**: BE-integration
- **Endpoint**: `POST /api/v1/auth/reset-password`
- **Preconditions**: Tài khoản `phaiDoiMatKhau=true` (mới duyệt, chưa đăng nhập lần nào).
- **Steps**: Gọi `reset-password` với OTP hợp lệ + mật khẩu mới. Sau đó query trực tiếp `users.phaiDoiMatKhau`.
- **Test Data**: —
- **Expected Result**: Cột DB `phaiDoiMatKhau` chuyển thành `false` NGAY TRONG cùng `tx.user.update` với đổi mật khẩu (`data-model.md` Mục 5.3, không phải giao dịch riêng) — không có trạng thái trung gian nào mà mật khẩu đã đổi nhưng cờ vẫn `true`.
- **Actual Result / Status**: Chưa chạy — TC mới (mức DB, bổ sung cho TC-012 mức API), chờ code.

### TC-065 — Refresh token giữa phiên đọc cờ mới nhất từ DB (không dùng claim cũ)

- **Requirement**: FR-004, `data-model.md` Mục 6
- **Tầng**: BE-integration
- **Endpoint**: `POST /api/v1/auth/refresh`
- **Preconditions**: Nhân viên đăng nhập ở tab A (claim `phaiDoiMatKhau: true`), đổi mật khẩu ở tab B cùng lúc (giả lập 2 tab cùng phiên gốc trước khi `tokenVersion` bị tăng — dùng refresh token A còn hợp lệ ngay sau khi B vừa đổi).
- **Steps**: Ép access token của A hết hạn (hoặc chờ 15 phút), gọi `POST /auth/refresh` bằng refresh token A **trước khi** `tokenVersion` bị B làm lệch (test riêng nhánh đọc cờ, giả lập đổi cờ qua đường khác không tăng `tokenVersion` nếu có, hoặc test đơn giản hơn: refresh ngay sau khi đổi mật khẩu thành công ở CHÍNH request đó).
- **Test Data**: —
- **Expected Result**: `loadUserForRefresh` → `taiUserPhienConHieuLuc` `select` thêm `phaiDoiMatKhau: true`, payload vé mới chép ĐÚNG giá trị DB tại thời điểm refresh (`false` nếu đã đổi mật khẩu) — không lấy giá trị cũ từ claim của refresh token đang dùng (`api-contract.md` Mục 4.4 "đây là chỗ dễ quên nhất").
- **Actual Result / Status**: Chưa chạy — TC mới, chờ code. Cần Backend Engineer xác nhận test case này viết được đơn giản hơn (mock `taiUserPhienConHieuLuc` trả `phaiDoiMatKhau` đổi giá trị giữa 2 lần gọi) khi vào Phase B.

### TC-066 — Đổi công ty giữa phiên (`switch`) vẫn mang đúng cờ theo DB

- **Requirement**: FR-004, `data-model.md` Mục 6
- **Tầng**: BE-integration
- **Endpoint**: `POST /api/v1/companies/:id/switch`
- **Preconditions**: Nhân viên đã đổi mật khẩu xong (`phaiDoiMatKhau=false` trong DB), đang giữ vé cũ (lý thuyết — thực tế đổi mật khẩu đã cấp vé mới; test này xác nhận đường `loadUserForReissue` không tự ý đặt `true` khi cấp lại vé giữa phiên cho trường hợp còn lại: đổi công ty bình thường).
- **Steps**: Nhân viên (đã ở trạng thái bình thường) gọi `switch` sang 1 công ty khác còn quyền.
- **Test Data**: —
- **Expected Result**: **200**; vé mới cấp qua `loadUserForReissue` mang claim `phaiDoiMatKhau: false` đúng theo DB (không có claim `true` "hồi sinh" từ vé cũ) — `api-contract.md` Mục 6 dòng "Cấp lại giữa phiên".
- **Actual Result / Status**: Chưa chạy — TC mới, chờ code.

### TC-067 — Rollback do mail lỗi → ADMIN duyệt lại → mật khẩu MỚI khác lần trước

- **Requirement**: BR-010, E-004, `api-contract.md` Mục 4.7.3
- **Tầng**: BE-integration
- **Endpoint**: `POST /api/v1/admin/companies/invites/:id/approve` (gọi 2 lần)
- **Preconditions**: Nối tiếp TC-006 (lời mời đã quay lại `PENDING` sau rollback).
- **Steps**: 1) Ghi lại mật khẩu tạm lần 1 (từ mock trước khi mail lỗi, dùng cho so sánh — KHÔNG log thật). 2) Mock `sendMail` thành công. 3) ADMIN duyệt LẠI cùng lời mời.
- **Test Data**: —
- **Expected Result**: **200**; tạo `User` mới với mật khẩu tạm KHÁC lần 1 (mỗi lần duyệt sinh ngẫu nhiên mới, không cache/tái dùng); email lần 2 nêu rõ "nếu bạn nhận nhiều email loại này, chỉ email mới nhất có hiệu lực" (Mục 5 `api-contract.md`); email cũ (nếu tồn tại) không dùng được vì tài khoản lần 1 đã bị xoá khi rollback.
- **Actual Result / Status**: Chưa chạy — TC mới, chờ code.

### TC-068 — Phân biệt `code: COMPANY_NO_ACCESS` — chỉ ở route tenant, không ở thao tác quản trị

- **Requirement**: E-007, `api-contract.md` Mục 1.2
- **Tầng**: BE-integration
- **Endpoint**: so sánh `POST /companies/invite` (403 không `code`) vs. 1 route tenant bất kỳ (403 có `code`)
- **Preconditions**: 2 kịch bản 403 `COMPANY.NO_ACCESS` cùng message nhưng khác nguồn.
- **Steps**: 1) Gọi `POST /companies/invite` với công ty không thuộc owner. 2) Gọi 1 route tenant với công ty không được cấp (nhân viên).
- **Test Data**: —
- **Expected Result**: (1) 403 `{ success: false, message: "..." }` — **KHÔNG có `code`** (lỗi thao tác mời, không phải phiên lệch). (2) 403 `{ success: false, code: "COMPANY_NO_ACCESS", message: "..." }`. Đây là điểm dễ nhầm nhất khi FE viết handler — QA phải xác nhận rõ 2 nhánh không lẫn nhau.
- **Actual Result / Status**: Chưa chạy — TC mới, chờ code, quan trọng cho đúng F-4 (`api-contract.md` Mục 6.2).

### TC-069 — `PUT .../access` với `access` chứa `donViId` trùng lặp

- **Requirement**: SPEC-QA-005, MT-07 (`api-contract.md` Mục 4.10 điểm 2)
- **Tầng**: BE-integration
- **Endpoint**: `PUT /api/v1/companies/employees/:userId/access`
- **Preconditions**: Nhân viên C, owner sở hữu công ty X.
- **Steps**: Gọi với `access: [{donViId: X}, {donViId: X, xemLuong: true}]` (cùng `donViId`, khác `xemLuong`).
- **Test Data**: —
- **Expected Result**: **400** `errors.fieldErrors.access`: `VALIDATION.DON_VI_TRUNG` — refine mới chặn cả 2 dạng thân yêu cầu (`access` và `donViIds` cũ). Không ghi nhận thay đổi nào.
- **Actual Result / Status**: Chưa chạy — TC mới, chờ code.

### TC-070 — Hai ADMIN duyệt cùng 1 lời mời đồng thời

- **Requirement**: BR-004, `api-contract.md` Ca biên #8
- **Tầng**: BE-integration
- **Endpoint**: `POST /api/v1/admin/companies/invites/:id/approve` (gọi song song bởi 2 ADMIN)
- **Preconditions**: 1 `InviteRequest` PENDING.
- **Steps**: 2 ADMIN cùng bấm Duyệt gần như đồng thời.
- **Test Data**: —
- **Expected Result**: Đúng 1 request nhận **200** (tạo `User`, gửi 1 email); request còn lại nhận **409** `COMPANY.INVITE_NOT_PENDING` (`updateMany where status='PENDING'` chiếm lời mời có điều kiện TRƯỚC khi tạo tài khoản) — không có 2 tài khoản, không có 2 email.
- **Actual Result / Status**: Chưa chạy — TC mới (regression cơ chế đã có, xác nhận không đổi khi thêm cờ mật khẩu), chờ code.

### TC-071 — Vé ký TRƯỚC khi triển khai không có claim `phaiDoiMatKhau`

- **Requirement**: `data-model.md` Mục 6, `api-contract.md` Mục 3.3, 8
- **Tầng**: BE-integration
- **Endpoint**: bất kỳ route `authenticate`
- **Preconditions**: Access token cũ (ký trước khi deploy, không có claim `phaiDoiMatKhau`) còn hạn.
- **Steps**: Dùng token cũ gọi 1 route bất kỳ.
- **Test Data**: JWT giả lập thiếu claim `phaiDoiMatKhau`.
- **Expected Result**: KHÔNG bị chặn `PASSWORD_CHANGE_REQUIRED` — `req.user.phaiDoiMatKhau` `undefined` coi như falsy, guard chỉ chặn khi `=== true` tường minh. Tương thích ngược đầy đủ, không ai bị đá ra khi deploy.
- **Actual Result / Status**: Chưa chạy — TC mới, chờ code.

### TC-072 — FE: 403 `PASSWORD_CHANGE_REQUIRED` điều hướng đúng màn

- **Requirement**: FR-004, `api-contract.md` Mục 6.2 F-1/F-2
- **Tầng**: UI-manual
- **Preconditions**: Nhân viên đăng nhập bằng mật khẩu tạm, đang ở trang bất kỳ trong `hdđt_maxv`.
- **Steps**: Thao tác bất kỳ khiến gọi 1 API bị chặn (vd mở danh sách hoá đơn).
- **Test Data**: —
- **Expected Result**: FE nhận 403 `code=PASSWORD_CHANGE_REQUIRED` → `AuthContext` đặt `phaiDoiMatKhau=true` → `ProtectedRoute` tự điều hướng `/doi-mat-khau`; KHÔNG tự gọi `/auth/refresh`, KHÔNG đăng xuất. Route `/doi-mat-khau` không bị chuyển hướng vòng lặp.
- **Actual Result / Status**: Chưa chạy — UI mới cần code.

### TC-073 — FE: 403 `COMPANY_NO_ACCESS` đồng bộ lại danh sách công ty ngay lần đầu

- **Requirement**: AC-03.3, MT-06, `api-contract.md` Mục 6.2 F-4
- **Tầng**: UI-manual
- **Preconditions**: Nhân viên đang mở công ty X, bị owner thu hồi X.
- **Steps**: Nhân viên thao tác tiếp (không tải lại trang).
- **Test Data**: —
- **Expected Result**: Ngay ở lượt 403 `code=COMPANY_NO_ACCESS` ĐẦU TIÊN: handler toàn cục chạy single-flight `GET /auth/me` → cập nhật `companies` → nếu `activeDonViId` khác `currentCompanyId`: `queryClient.clear()` + `switch` sang công ty mới (hoặc ẩn bộ chọn nếu rỗng) — KHÔNG cần đợi tải lại trang như spec gốc chấp nhận (MT-06, hành vi FE tốt hơn mức spec yêu cầu — QA đề xuất cập nhật AC-03.3 theo hành vi mới này khi BA đồng bộ tài liệu).
- **Actual Result / Status**: Chưa chạy — UI mới cần code.

### TC-074 — `GET /companies/invites` gọi bởi nhân viên (hiện trạng, MT-08 mở rộng OQ-7)

- **Requirement**: EC-09, SPEC-QA-008 (mở rộng), MT-08
- **Tầng**: BE-integration/security
- **Endpoint**: `GET /api/v1/companies/invites`
- **Preconditions**: Token của `OWNER_EMPLOYEE`.
- **Steps**: Gọi endpoint.
- **Test Data**: —
- **Expected Result HIỆN TẠI**: **200** — route KHÔNG nằm trong phạm vi kỹ thuật của OQ-7 (`api-contract.md` Mục 4.9 "Không đổi... Vẫn mở cho nhân viên — xem MT-08"), trả toàn bộ lời mời (email/họ tên/chức vụ người được mời) cho nhân viên. **Nếu anh @phamvinh203 đồng ý mở rộng OQ-7** sang endpoint này (theo gợi ý coordinator + MT-08): kỳ vọng đổi thành 403 `AUTH.FORBIDDEN` giống `GET /companies/employees`.
- **Actual Result / Status**: Chưa chạy — phụ thuộc quyết định mở rộng OQ-7, hiện là gap thật (dữ liệu nhạy cảm bị lộ), cần theo dõi song song với TC-060.

## Tổng kết

- Tổng: **74 test case** (TC-001 → TC-074). Không TC nào bị đánh số lại — TC-061..074 là bổ sung mới sau khi đối chiếu `architecture/api-contract.md` + `data-model.md` (viết lại 2026-09-17).
- Theo tầng: BE-unit 4 · BE-integration 49 · UI-manual 14 · FE-build/smoke 1 · code-review thủ công lồng trong TC-004/TC-057.
- TC đã **hết blocked** sau khi đối chiếu contract: TC-009 (SPEC-QA-002), TC-012/TC-064 (SPEC-QA-003), TC-017/TC-069 (SPEC-QA-005), TC-035 (SPEC-QA-010).
- TC **vẫn còn blocked/treo**: TC-031/TC-032 (business sign-off BR-014, SPEC-QA-007 — kỹ thuật đã Ready), TC-054 (OQ-8), TC-060/TC-074 (OQ-7, còn mở — nay gồm cả `GET /companies/invites` theo MT-08).
- Không có AC nào thiếu test hoàn toàn — xem `qa/test-matrix.md` Mục 4 để đối chiếu đầy đủ.
