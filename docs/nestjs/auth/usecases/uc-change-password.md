# UC-change-password: Đổi mật khẩu

## Scope

Feature auth — HRM-Accounting.

## Level

User goal.

## Primary Actor

Người dùng đang đăng nhập muốn đổi mật khẩu (định kỳ hoặc nghi ngờ tài khoản bị lộ).

## Trigger

Người dùng chọn đổi mật khẩu trong hệ thống khi đã đăng nhập.

## Preconditions

1. Người dùng có phiên đăng nhập hợp lệ.
2. Người dùng biết mật khẩu hiện tại.

## Minimal Guarantees

- Thất bại ở bất kỳ bước nào không làm thay đổi mật khẩu hiện hành.
- Lỗi sai mật khẩu hiện tại không cộng vào bộ đếm nhập sai của đăng nhập (FR-auth-010).

## Success Guarantees

- Mật khẩu mới có hiệu lực; đăng nhập lần sau phải dùng mật khẩu mới.
- Các phiên khác của cùng người dùng bị thu hồi (BR-auth-009).
- Sự kiện được ghi nhật ký.

## Main Success Scenario

1. Người dùng nhập mật khẩu hiện tại và mật khẩu mới.
2. Hệ thống xác nhận mật khẩu hiện tại đúng (FR-auth-010).
3. Hệ thống kiểm tra mật khẩu mới: khác mật khẩu hiện tại, đạt chính sách (BR-auth-003).
4. Hệ thống cập nhật mật khẩu mới.
5. Hệ thống thu hồi các phiên khác của người dùng (BR-auth-009).
6. Hệ thống ghi nhật ký "đổi mật khẩu thành công" (FR-auth-011).
7. Người dùng tiếp tục làm việc trên phiên hiện tại.

## Extensions

- **2a.** Mật khẩu hiện tại sai: E-auth-008; không cộng bộ đếm đăng nhập; ghi nhật ký; về bước 1.
- **3a.** Mật khẩu mới trùng mật khẩu hiện tại: E-auth-009; về bước 1.
- **3b.** Mật khẩu mới không đạt chính sách: E-auth-007; về bước 1.
- **1a.** Thiếu một trong hai trường: hiện thông báo bắt buộc nhập đủ (cùng nhóm E-auth-004); về bước 1.
- **4a.** Lỗi kỹ thuật nội bộ khi cập nhật: mật khẩu hiện hành giữ nguyên; thông báo lỗi hệ thống chung; mời thử lại.

## Related Requirements

- FR-auth-010, FR-auth-011 — [[docs/auth/srs/auth-spec.md|Auth SRS]]
- BR-auth-003, BR-auth-009
- Trả lời CAP-auth-05 (BO-auth-03, BO-auth-07)
- Liên quan OQ-10 (phạm vi thu hồi phiên)
