---
type: urd
feature: auth
status: draft
updated: 2026-09-04
links: []
---

# Auth — User Requirements Document (URD)

Hệ thống HRM-Accounting lưu trữ dữ liệu nhân sự và số liệu kế toán — hai nhóm thông tin nhạy cảm của doanh nghiệp. Tài liệu này mô tả nhu cầu của người dùng đối với chức năng xác thực (auth): ai dùng hệ thống, họ cần gì, và những khó khăn hiện tại cần giải quyết.

## 1. Actors

| Actor | Mô tả | Mối quan hệ với hệ thống |
|-------|-------|--------------------------|
| Admin hệ thống | Người quản trị vận hành hệ thống, chịu trách nhiệm tài khoản và quyền hạn | Quản lý tài khoản, khóa/mở khóa tài khoản, theo dõi sự kiện xác thực |
| HR (quản trị nhân sự) | Chuyên viên/nhân sự bộ phận nhân sự | Sử dụng dữ liệu nhân sự của toàn công ty |
| Kế toán | Chuyên viên/nhân sự bộ phận kế toán | Sử dụng số liệu tài chính, chứng từ, công nợ |
| Nhân viên | Người lao động trong doanh nghiệp | Xem thông tin cá nhân, chấm công, đơn từ của mình |

## 2. User Needs

### 2.1 Mọi người dùng (Admin, HR, Kế toán, Nhân viên)

1. **N1** — Đăng nhập vào hệ thống bằng tài khoản cá nhân (email + mật khẩu) để được cấp quyền truy cập đúng vùng dữ liệu của mình.
2. **N2** — Khi quên mật khẩu, tự đặt lại mật khẩu qua email mà không phải chờ Admin xử lý.
3. **N3** — Đổi mật khẩu khi nghi ngờ tài khoản bị lộ hoặc theo yêu cầu bảo mật.
4. **N4** — Đăng xuất an toàn khi rời máy (đặc biệt khi dùng máy chung), đảm bảo người sau không vào được phiên của mình.
5. **N5** — Không phải đăng nhập lại liên tục trong giờ làm việc khi đang sử dụng hệ thống bình thường.

### 2.2 Admin hệ thống

1. **N6** — Khóa ngay một tài khoản khi nhân viên nghỉ việc, nghi ngờ bị chiếm quyền, hoặc vi phạm nội quy.
2. **N7** — Mở khóa tài khoản khi người dùng bị khóa oan hoặc đã qua thời gian khóa.
3. **N8** — Phân quyền theo vai trò: mỗi người chỉ truy cập được chức năng đúng vai trò của mình (Admin, HR, Kế toán, Nhân viên).
4. **N9** — Tra cứu được lịch sử sự kiện xác thực (ai đăng nhập, khi nào, đăng nhập sai bao nhiêu lần) phục vụ điều tra sự cố và kiểm toán.

### 2.3 Hệ thống / Doanh nghiệp

1. **N10** — Chặn nỗ lực dò tìm mật khẩu: tài khoản nhập sai mật khẩu nhiều lần liên tiếp phải bị khóa tạm thời.
2. **N11** — Không tiết lộ thông tin "email này có tồn tại trong hệ thống hay không" cho người ngoài (chống dò tìm tài khoản).
3. **N12** — Phiên đăng nhập phải tự hết hạn khi người dùng bỏ quên máy, không để phiên sống vô thời hạn.

## 3. Pain Points (bối cảnh chưa có auth)

1. Hệ thống hiện chưa có cơ chế xác thực — mọi API đều truy cập được mà không biết ai đang gọi. Dữ liệu lương, dữ liệu kế toán có nguy cơ bị xem/sửa trái phép.
2. Khi có sự cố dữ liệu, không xác định được ai đã thao tác — không có dấu vết người dùng.
3. Người dùng quên mật khẩu phải nhờ Admin can thiệp thủ công, tốn thời gian hai bên và chặn công việc.
4. Nếu chia sẻ chung một tài khoản cho cả phòng (cách làm tạm thời), không phân biệt được trách nhiệm từng người và không thu hồi quyền được khi có người rời đi.

## 4. Out of Scope (ở mức URD)

- Đăng nhập qua mạng xã hội / tài khoản doanh nghiệp bên thứ 3 (social login) — còn bỏ ngỏ, xem OQ trong [[docs/auth/srs/auth-spec.md|Auth SRS]].
- Xác thực 2 lớp (2FA/OTP) — còn bỏ ngỏ, xem OQ trong [[docs/auth/srs/auth-spec.md|Auth SRS]].
- Quản lý vòng đời tài khoản (tạo/sửa/xóa người dùng, gán vai trò) — thuộc module quản lý người dùng, xem OQ-8 trong [[docs/auth/srs/auth-spec.md|Auth SRS]].

## 5. Chuyển tiếp

Nhu cầu trên được lượng hóa thành mục tiêu kinh doanh trong [[docs/auth/auth-brd.md|Auth BRD]] và yêu cầu chức năng trong [[docs/auth/srs/auth-spec.md|Auth SRS]].
