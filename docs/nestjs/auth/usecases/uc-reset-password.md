# UC-reset-password: Đặt lại mật khẩu qua email

## Scope

Feature auth — HRM-Accounting.

## Level

User goal.

## Primary Actor

Người dùng quên mật khẩu (không đăng nhập được).

## Trigger

Người dùng chọn "Quên mật khẩu" và nhập email của tài khoản.

## Preconditions

1. Người dùng truy cập được email đã đăng ký của tài khoản (để nhận link).

## Minimal Guarantees

- Phản hồi cho yêu cầu đặt lại luôn thống nhất bất kể email có tồn tại (NFR-auth-004) — bên ngoài không suy ra được tài khoản nào có thật.
- Link đặt lại (nếu gửi) dùng đúng một lần, hết hạn 24 giờ (BR-auth-005).
- Không có thay đổi mật khẩu cho đến khi người dùng hoàn tất đặt lại bằng link hợp lệ.

## Success Guarantees

- Mật khẩu mới có hiệu lực; đăng nhập bằng mật khẩu mới thành công.
- Mọi phiên đang có bị thu hồi (BR-auth-009); mọi link đặt lại còn lại bị vô hiệu; bộ đếm nhập sai (nếu có) về 0.
- Sự kiện được ghi nhật ký.

## Main Success Scenario

1. Người dùng nhập email và yêu cầu đặt lại mật khẩu.
2. Hệ thống kiểm tra tần suất gửi — chưa vượt giới hạn (NFR-auth-008).
3. Hệ thống ghi nhật ký "yêu cầu đặt lại mật khẩu".
4. Hệ thống trả thông báo thống nhất E-auth-005.
5. Email tồn tại và tài khoản đang hoạt động: hệ thống vô hiệu link cũ (nếu còn hạn) và gửi email chứa link đặt lại (FR-auth-008).
6. Người dùng mở email, bấm link, nhập mật khẩu mới.
7. Hệ thống kiểm tra: link còn hạn, chưa dùng, mật khẩu mới đạt chính sách (BR-auth-003).
8. Hệ thống cập nhật mật khẩu, thu hồi mọi phiên, vô hiệu mọi link còn lại, xóa bộ đếm sai (FR-auth-009).
9. Hệ thống ghi nhật ký "đặt lại mật khẩu thành công".
10. Người dùng được mời đăng nhập lại bằng mật khẩu mới.

## Extensions

- **2a.** Vượt giới hạn 3 email/giờ cho một địa chỉ (NFR-auth-008): từ chối gửi với E-auth-010; về trạng thái chờ.
- **5a.** Email không tồn tại: không gửi gì — thông báo đã trả ở bước 4 giữ nguyên (anti-enumeration); ghi nhật ký yêu cầu.
- **5b.** Tài khoản bị vô hiệu hóa: không gửi link; thông báo đã trả ở bước 4 giữ nguyên. Người dùng liên hệ Admin (đặt lại mật khẩu không phải là đường mở lại tài khoản vô hiệu hóa — BR-auth-002).
- **5c.** Lỗi gửi email ở dịch vụ email: thông báo đã trả ở bước 4 giữ nguyên; hệ thống ghi nhật ký lỗi gửi; người dùng có thể yêu cầu lại trong giới hạn tần suất (R-auth-05).
- **7a.** Link hết hạn hoặc đã dùng: E-auth-006; cho phép yêu cầu link mới (về bước 1).
- **7b.** Mật khẩu mới không đạt chính sách: E-auth-007; về bước 6, link vẫn còn hạn.
- **7c.** Người dùng nhập trùng mật khẩu cũ (nếu nhớ ra): chấp nhận theo chính sách — không cấm trong luồng đặt lại, vì người dùng đang khôi phục quyền truy cập; ghi nhật ký bình thường.
- **6a.** Người dùng bỏ dở giữa chừng (đã mở link nhưng không gửi mật khẩu mới): không có thay đổi nào; link còn hạn cho đến khi hết hạn hoặc có link mới.

## Related Requirements

- FR-auth-007, FR-auth-008, FR-auth-009 — [[docs/auth/srs/auth-spec.md|Auth SRS]]
- BR-auth-002, BR-auth-003, BR-auth-005, BR-auth-009; NFR-auth-004, NFR-auth-008
- Trả lời CAP-auth-04 (BO-auth-03, BO-auth-05)
- Liên quan OQ-6 (nhà cung cấp email)
