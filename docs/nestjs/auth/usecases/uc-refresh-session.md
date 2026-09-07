# UC-refresh-session: Làm mới phiên đăng nhập

## Scope

Feature auth — HRM-Accounting.

## Level

User goal.

## Primary Actor

Người dùng đang có phiên đăng nhập hoạt động liên tục trong giờ làm việc.

## Trigger

Phiên sắp hết hạn hoặc người dùng tiếp tục hoạt động sau một khoảng nghỉ; hệ thống gia hạn phiên để không phải đăng nhập lại.

## Preconditions

1. Người dùng đang nắm giữ phiên còn hợp lệ.

## Minimal Guarantees

- Không có thay đổi nào lên dữ liệu tài khoản.
- Phiên hết hạn thì mọi yêu cầu tiếp theo bị từ chối với E-auth-012 (không tự kéo dài phiên chết).

## Success Guarantees

- Phiên được tiếp tục với thời hạn mới tính từ thời điểm gia hạn (BR-auth-004).
- Người dùng không phải đăng nhập lại (thỏa BO-auth-06).

## Main Success Scenario

1. Người dùng tiếp tục sử dụng hệ thống với phiên hiện có.
2. Hệ thống xác nhận phiên còn hợp lệ.
3. Hệ thống gia hạn phiên (FR-auth-006).
4. Người dùng làm việc tiếp không gián đoạn.

## Extensions

- **2a.** Phiên đã hết hạn (quá 8 giờ không hoạt động — BR-auth-004): hệ thống từ chối với E-auth-012; người dùng phải đăng nhập lại. Không có cách nào phục hồi phiên đã chết.
- **2b.** Phiên đã bị thu hồi do mật khẩu vừa được đổi/đặt lại ở thiết bị khác (BR-auth-009): hệ thống từ chối với E-auth-012; người dùng đăng nhập lại bằng mật khẩu mới.
- **1a.** Yêu cầu bằng phiên không tồn tại/không đúng định dạng: từ chối với E-auth-012; ghi nhật ký nếu phát hiện dùng phiên đã thu hồi.

## Related Requirements

- FR-auth-006 — [[docs/auth/srs/auth-spec.md|Auth SRS]]
- BR-auth-004, BR-auth-009, NFR-auth-005
- Trả lời CAP-auth-03 (BO-auth-06, BO-auth-07)
- Liên quan OQ-4 (thời hạn phiên, ghi nhớ thiết bị)
