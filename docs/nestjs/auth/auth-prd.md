---
type: prd
feature: auth
status: draft
updated: 2026-09-04
links:
  - docs/auth/auth-urd.md
  - docs/auth/auth-brd.md
---

# Auth — Product Requirements Document (PRD)

## 1. Tổng quan

Auth là nền tảng truy cập của HRM-Accounting: mọi phân hệ nhân sự và kế toán đều đặt sau lớp xác thực này. Feature bao gồm đăng nhập/đăng xuất, duy trì phiên, khôi phục mật khẩu, đổi mật khẩu, phân quyền theo vai trò và khóa tài khoản.

> Decided: 2026-09-04 | Frontend deferred — tài liệu này mô tả hành vi hệ thống ở mức nghiệp vụ, không mô tả giao diện.

## 2. Users

Xem [[docs/auth/auth-urd.md|Auth URD]] — 4 actors: Admin hệ thống, HR, Kế toán, Nhân viên.

## 3. Capabilities

| ID | Capability | Mô tả | Trả lời mục tiêu |
|----|-----------|-------|------------------|
| CAP-auth-01 | Đăng nhập | Xác thực email + mật khẩu; thành công thì mở phiên đăng nhập gắn vai trò của người dùng | BO-auth-01 |
| CAP-auth-02 | Đăng xuất | Kết thúc phiên hiện tại ngay khi người dùng yêu cầu | BO-auth-07 |
| CAP-auth-03 | Duy trì phiên | Phiên có thời hạn; người dùng hoạt động liên tục được gia hạn phiên mà không đăng nhập lại | BO-auth-06, BO-auth-07 |
| CAP-auth-04 | Khôi phục mật khẩu | Người dùng quên mật khẩu tự đặt lại qua link email dùng một lần, có thời hạn 24 giờ | BO-auth-03, BO-auth-05 |
| CAP-auth-05 | Đổi mật khẩu | Người dùng đã đăng nhập đổi mật khẩu sau khi xác nhận mật khẩu hiện tại | BO-auth-03, BO-auth-07 |
| CAP-auth-06 | Phân quyền theo vai trò | Hệ thống nhận diện vai trò của người dùng và kiểm soát quyền truy cập chức năng theo vai trò | BO-auth-02 |
| CAP-auth-07 | Khóa/mở khóa tài khoản | Khóa tự động khi nhập sai mật khẩu lặp lại; Admin khóa/mở khóa thủ công | BO-auth-05, BO-auth-04 |
| CAP-auth-08 | Nhật ký xác thực | Ghi nhận mọi sự kiện xác thực phục vụ truy vết | BO-auth-04 |

## 4. Feature Scope

### 4.1 Đăng nhập (CAP-auth-01)

- Người dùng đăng nhập bằng email + mật khẩu.
- Thất bại do sai thông tin → thông báo chung, không tiết lộ email có tồn tại hay không.
- Thất bại lặp lại đủ số lần → tài khoản bị khóa tạm thời theo BR-auth-001.
- Tài khoản đang khóa hoặc bị vô hiệu hóa → từ chối với thông báo phù hợp.
- Chi tiết hành vi: UC-login, FR-auth-001…004.

### 4.2 Đăng xuất (CAP-auth-02)

- Kết thúc phiên hiện tại; sau khi đăng xuất, sử dụng phiên đó để truy cập không còn hiệu lực.
- Chi tiết: UC-logout, FR-auth-005.

### 4.3 Duy trì phiên (CAP-auth-03)

- Phiên có thời hạn sống; hệ thống hỗ trợ gia hạn phiên cho người dùng đang hoạt động mà không cần đăng nhập lại.
- Đổi/đặt lại mật khẩu làm mất hiệu lực các phiên đang có.
- Giá trị thời hạn là assumption chờ confirm (BR-auth-004, OQ-4).
- Chi tiết: UC-refresh-session, FR-auth-006.

### 4.4 Khôi phục mật khẩu (CAP-auth-04)

- Người dùng yêu cầu đặt lại qua email; hệ thống gửi link một lần dùng, hết hạn sau 24 giờ.
- Phản hồi thống nhất bất kể email có tồn tại (chống dò tài khoản); giới hạn tần suất gửi email.
- Link hết hạn/đã dùng → cho phép yêu cầu link mới.
- Chi tiết: UC-reset-password, FR-auth-007…009.

### 4.5 Đổi mật khẩu (CAP-auth-05)

- Chỉ khi đã đăng nhập; phải cung cấp đúng mật khẩu hiện tại.
- Mật khẩu mới phải đạt chính sách độ mạnh (BR-auth-003) và khác mật khẩu hiện tại.
- Sau khi đổi, các phiên khác bị thu hồi.
- Chi tiết: UC-change-password, FR-auth-010…011.

### 4.6 Phân quyền theo vai trò (CAP-auth-06)

- Vai trò: Admin hệ thống, HR, Kế toán, Nhân viên.
- Mỗi chức năng nghiệp vụ khai báo vai trò được phép; hệ thống từ chối yêu cầu vượt quyền.
- Ma trận quyền chi tiết thuộc từng phân hệ nghiệp vụ — auth chỉ định nghĩa cơ chế và vai trò chuẩn.
- Chi tiết: FR-auth-012, BR-auth-007.

### 4.7 Khóa/mở khóa tài khoản (CAP-auth-07)

- Khóa tự động: đủ số lần sai liên tiếp trong cửa sổ thời gian → khóa (BR-auth-001).
- Khóa/mở khóa thủ công bởi Admin; thao tác được ghi nhật ký.
- Tài khoản khóa tạm tự hết khóa sau thời gian khóa hoặc được Admin mở sớm (OQ-3).
- Chi tiết: FR-auth-013.

### 4.8 Nhật ký xác thực (CAP-auth-08)

- Ghi: đăng nhập thành công/thất bại, khóa/mở khóa, đổi/đặt lại mật khẩu, đăng xuất — với người dùng, thời điểm, kết quả.
- Không ghi mật khẩu hay dữ liệu nhạy cảm vào nhật ký.
- Chi tiết: FR-auth-004, NFR-auth-006.

## 5. Ưu tiên

| Capability | Ưu tiên | Lý do |
|------------|---------|-------|
| CAP-auth-01 Đăng nhập | P0 | Không có đăng nhập thì không có bảo vệ dữ liệu |
| CAP-auth-02 Đăng xuất | P0 | Phần tất yếu của phiên đăng nhập |
| CAP-auth-03 Duy trì phiên | P0 | Trải nghiệm không gián đoạn; thiếu thì người dùng bị văng liên tục |
| CAP-auth-06 Phân quyền | P0 | Điều kiện để phân hệ nhân sự/kế toán kiểm soát dữ liệu đúng người |
| CAP-auth-04 Khôi phục mật khẩu | P1 | Giảm tải vận hành; có thể sống thiếu trong giai đoạn đầu với quy trình thủ công |
| CAP-auth-05 Đổi mật khẩu | P1 | Yêu cầu bảo mật cơ bản, ít khẩn hơn khôi phục |
| CAP-auth-07 Khóa/mở khóa | P1 | Chống brute force; khóa thủ công có thể thay bằng vô hiệu hóa tài khoản tạm thời |
| CAP-auth-08 Nhật ký xác thực | P1 | Cần cho kiểm toán; không chặn chức năng người dùng |

## 6. Ràng buộc

1. Không quyết định kỹ thuật trong tài liệu này (cơ chế phiên, thuật toán lưu mật khẩu) — thuộc Architect.
2. Ràng buộc nghiệp vụ bảo mật liệt kê tại SRS Mục NFR/BR: mật khẩu không lưu dạng đọc được, không ghi dữ liệu nhạy cảm vào log, phản hồi chống dò tài khoản.
3. Giao diện người dùng hoãn — các trạng thái lỗi/thành công được mô tả bằng nội dung thông báo, không mô tả màn hình.

## 7. Metrics

Xem Success Measures tại [[docs/auth/auth-brd.md|Auth BRD]] Mục 5 — phản hồi đăng nhập ≤ 2 giây, ≥ 90% tự đặt lại mật khẩu thành công, 0 lọt qua kiểm thử brute force/phân quyền, log lưu ≥ 12 tháng.

## 8. Risks

Xem [[docs/auth/auth-brd.md|Auth BRD]] Mục 6.

## 9. Open Questions

Danh sách OQ hợp nhất tại [[docs/auth/srs/auth-spec.md|Auth SRS]] Mục Open Questions (2FA, social login, thời hạn khóa tự động, thời hạn phiên, chính sách mật khẩu, giao nhận tài khoản ban đầu, nhà cung cấp email, phạm vi quản lý tài khoản, lưu giữ log).
