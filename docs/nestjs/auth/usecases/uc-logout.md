# UC-logout: Đăng xuất

## Scope

Feature auth — HRM-Accounting.

## Level

User goal.

## Primary Actor

Người dùng đang có phiên đăng nhập (Admin hệ thống, HR, Kế toán, Nhân viên).

## Trigger

Người dùng yêu cầu kết thúc phiên làm việc (đặc biệt khi rời máy dùng chung).

## Preconditions

1. Người dùng đã từng đăng nhập và nắm giữ một phiên (phiên có thể đã hết hạn trước đó).

## Minimal Guarantees

- Thao tác không làm thay đổi dữ liệu tài khoản.
- Nếu phiên còn hợp lệ: phiên không dùng lại được sau khi đăng xuất (NFR-auth-005).

## Success Guarantees

- Phiên hiện tại kết thúc; các yêu cầu sau đó bằng phiên này bị từ chối với E-auth-012.
- Sự kiện được ghi nhật ký.

## Main Success Scenario

1. Người dùng yêu cầu đăng xuất.
2. Hệ thống kết thúc phiên hiện tại (FR-auth-005).
3. Hệ thống ghi nhật ký "đăng xuất".
4. Người dùng quay về trạng thái chưa đăng nhập.

## Extensions

- **2a.** Phiên đã hết hạn hoặc không hợp lệ trước đó: hệ thống vẫn trả kết quả "đã đăng xuất" (idempotent — người dùng ở trạng thái chưa đăng nhập); ghi nhật ký nếu phát hiện phiên đã thu hồi được dùng lại.
- **2b.** Lỗi kỹ thuật nội bộ: hệ thống không khẳng định được phiên đã kết thúc; hiển thị thông báo lỗi hệ thống chung và mời thử lại (an toàn phía người dùng: phiên tự hết hạn theo BR-auth-004).

## Related Requirements

- FR-auth-005 — [[docs/auth/srs/auth-spec.md|Auth SRS]]
- BR-auth-004, NFR-auth-005
- Trả lời CAP-auth-02 (BO-auth-07)
