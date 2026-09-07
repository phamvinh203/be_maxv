# UC-login: Đăng nhập

## Scope

Feature auth — HRM-Accounting.

## Level

User goal.

## Primary Actor

Mọi người dùng của hệ thống (Admin hệ thống, HR, Kế toán, Nhân viên).

## Trigger

Người dùng muốn truy cập hệ thống và chưa có phiên hợp lệ.

## Preconditions

1. Tài khoản đã được Admin cấp (A-1 trong [[docs/auth/srs/auth-spec.md|Auth SRS]]).
2. Người dùng biết email và mật khẩu của tài khoản.

## Minimal Guarantees

- Không có thay đổi nào lên dữ liệu tài khoản khi đăng nhập thất bại, ngoài bộ đếm nhập sai và nhật ký.
- Không tiết lộ thông tin tài khoản cho bên ngoài (NFR-auth-004).

## Success Guarantees

- Phiên đăng nhập hợp lệ được mở, gắn vai trò hiện hành của người dùng.
- Bộ đếm nhập sai (nếu có) về 0.
- Sự kiện được ghi nhật ký.

## Main Success Scenario

1. Người dùng nhập email và mật khẩu.
2. Hệ thống kiểm tra email tồn tại và tài khoản đang hoạt động.
3. Hệ thống so khớp mật khẩu — khớp.
4. Hệ thống xóa bộ đếm nhập sai (BR-auth-001).
5. Hệ thống mở phiên đăng nhập gắn vai trò (FR-auth-001).
6. Hệ thống ghi nhật ký "đăng nhập thành công" (FR-auth-004).
7. Người dùng được đưa vào hệ thống theo vai trò.

## Extensions

- **2a.** Email không tồn tại hoặc mật khẩu sai: hệ thống trả "Email hoặc mật khẩu không đúng." (E-auth-001), bộ đếm +1 nếu email tồn tại, ghi nhật ký; về bước 1. Nếu email không tồn tại: phản hồi y hệt, không cộng bộ đếm.
- **2b.** Tài khoản đang khóa tạm: từ chối với E-auth-002, không cộng bộ đếm; về bước 1. Trường hợp lặp lại liên tục không kéo dài thời hạn khóa (BR-auth-001).
- **2c.** Tài khoản bị vô hiệu hóa: từ chối với E-auth-003, không cộng bộ đếm (FR-auth-003).
- **1a.** Thiếu email hoặc mật khẩu: hiện E-auth-004, không ghi nhật ký đăng nhập thất bại; về bước 1.
- **4a.** Bộ đếm đạt 5 lần sai trong 15 phút: khóa tài khoản 15 phút (BR-auth-001), ghi nhật ký khóa tự động; lần thử tiếp theo đi theo 2b.
- **3a.** Lỗi kỹ thuật nội bộ (không xác định được kết quả so khớp): thông báo lỗi hệ thống chung, không cộng bộ đếm, ghi nhật ký; mời thử lại.

## Related Requirements

- FR-auth-001, FR-auth-002, FR-auth-003, FR-auth-004 — [[docs/auth/srs/auth-spec.md|Auth SRS]]
- BR-auth-001, BR-auth-002, NFR-auth-004
- Trả lời CAP-auth-01 (BO-auth-01, BO-auth-04, BO-auth-05)
