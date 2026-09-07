---
type: brd
feature: auth
status: draft
updated: 2026-09-04
links:
  - docs/auth/auth-urd.md
---

# Auth — Business Requirements Document (BRD)

## 1. Business Goal

Bảo vệ dữ liệu nhân sự và kế toán của doanh nghiệp bằng cơ chế xác thực người dùng và phân quyền theo vai trò, đồng thời giảm chi phí vận hành nhờ người dùng tự phục hồi mật khẩu.

Cụ thể: trước khi triển khai module nghiệp vụ (nhân sự, kế toán), hệ thống phải biết **ai** đang truy cập, **được phép làm gì**, và **ghi lại được dấu vết** — đây là điều kiện tiên quyết để mọi dữ liệu về sau có giá trị pháp lý và trách nhiệm rõ ràng.

## 2. Stakeholders

| Stakeholder | Vai trò | Quan tâm điều gì |
|-------------|---------|------------------|
| Ban giám đốc / chủ doanh nghiệp | Chủ sở hữu dữ liệu | Dữ liệu lương và tài chính không bị lộ, không bị sửa trái phép; có dấu vết truy vết khi có tranh chấp |
| Admin hệ thống | Vận hành | Công cụ khóa/mở khóa tài khoản, theo dõi sự kiện xác thực, ít phải xử lý thủ công |
| HR, Kế toán, Nhân viên | Người dùng cuối | Đăng nhập đơn giản, không bị gián đoạn trong giờ làm, tự khôi phục được khi quên mật khẩu |
| Nhóm phát triển | Xây dựng | Yêu cầu rõ ràng, đủ ràng buộc bảo mật để thiết kế đúng ngay từ đầu |
| Bộ phận kiểm toán / tuân thủ (nội bộ) | Kiểm tra | Lịch sử sự kiện xác thực đầy đủ, lưu trữ đủ lâu |

## 3. Scope

1. Đăng nhập bằng email + mật khẩu.
2. Đăng xuất.
3. Duy trì và làm mới phiên đăng nhập (refresh phiên); phiên tự hết hạn.
4. Quên mật khẩu và đặt lại mật khẩu qua email (link một lần dùng, có thời hạn).
5. Đổi mật khẩu khi đã đăng nhập.
6. Phân quyền theo vai trò ở mức nghiệp vụ: Admin hệ thống, HR, Kế toán, Nhân viên.
7. Khóa tài khoản tự động (nhập sai nhiều lần) và khóa/mở khóa thủ công bởi Admin.
8. Ghi nhận sự kiện xác thực phục vụ truy vết (audit log ở mức nghiệp vụ).

## 4. Out of Scope

1. Quản lý vòng đời tài khoản người dùng (tạo/sửa/xóa tài khoản, gán vai trò) — thuộc module quản lý người dùng; xem OQ-8 trong [[docs/auth/srs/auth-spec.md|Auth SRS]].
2. Xác thực 2 lớp (2FA/OTP) — còn bỏ ngỏ, xem OQ-1.
3. Đăng nhập qua nhà cung cấp bên ngoài (Google, Microsoft…) — còn bỏ ngỏ, xem OQ-2.
4. Giao diện người dùng (màn hình, wireframe) — hoãn giai đoạn frontend.
5. Thanh toán, hợp đồng, phân hệ kế toán chi tiết — thuộc feature khác.

## 5. Business Objectives & Success Measures

| ID | Mục tiêu | Thước đo thành công |
|----|----------|---------------------|
| BO-auth-01 | Chỉ người dùng đã xác thực mới truy cập được dữ liệu hệ thống | 100% chức năng nghiệp vụ yêu cầu đăng nhập; 0 điểm truy cập ẩn danh (ngoài health check và đăng nhập) |
| BO-auth-02 | Đúng người — đúng quyền: mỗi vai trò chỉ truy cập đúng vùng chức năng | 0 trường hợp truy cập chéo quyền được phát hiện trong kiểm thử phân quyền; ma trận quyền được duyệt bởi stakeholder trước khi xây dựng |
| BO-auth-03 | Người dùng tự phục hồi mật khẩu, giảm tải hỗ trợ | ≥ 90% yêu cầu đặt lại mật khẩu hoàn tất bởi chính người dùng trong 24 giờ; ≤ 5% người dùng phải liên hệ hỗ trợ vì vấn đề mật khẩu trong 3 tháng đầu |
| BO-auth-04 | Mọi sự kiện xác thực đều truy vết được | 100% sự kiện đăng nhập thành công/thất bại, khóa/mở khóa, đổi/đặt lại mật khẩu được ghi log; log lưu tối thiểu 12 tháng |
| BO-auth-05 | Chặn nỗ lực truy cập trái phép hàng loạt | Tài khoản nhập sai mật khẩu 5 lần liên tiếp bị khóa; 0 tài khoản bị dò thành công trong kiểm thử brute-force mô phỏng |
| BO-auth-06 | Trải nghiệm đăng nhập không cản trở công việc | ≥ 95% lượt đăng nhập phản hồi trong 2 giây; người dùng hoạt động liên tục trong giờ làm không phải đăng nhập lại quá 1 lần/ngày |
| BO-auth-07 | Phiên đăng nhập không bị lợi dụng khi người dùng bỏ quên máy | Phiên tự hết hạn khi không hoạt động (giá trị đề xuất: 8 giờ); đặt lại/đổi mật khẩu làm mất hiệu lực các phiên cũ |

## 6. Risks

| ID | Rủi ro | Mức độ | Giảm thiểu |
|----|--------|--------|------------|
| R-auth-01 | Dò mật khẩu tự động (brute force / credential stuffing) | Cao | Khóa tài khoản sau nhiều lần sai liên tiếp; thông báo lỗi thống nhất không tiết lộ thông tin tài khoản |
| R-auth-02 | Rò rỉ mật khẩu do lưu trữ sai cách | Cao | Ràng buộc nghiệp vụ: mật khẩu không được lưu dưới dạng đọc được; không ghi mật khẩu vào log (NFR-auth-002) |
| R-auth-03 | Spam email đặt lại mật khẩu (email bombing) làm tốn kém và quấy rối người dùng | Trung bình | Giới hạn tần suất gửi email đặt lại theo mỗi địa chỉ email (NFR-auth-008) |
| R-auth-04 | Tài khoản Admin bị chiếm quyền — thiệt hại lan rộng toàn hệ thống | Cao | Áp cùng chính sách khóa tài khoản; cân nhắc 2FA cho Admin (OQ-1); ghi audit log đầy đủ |
| R-auth-05 | Dịch vụ gửi email gặp sự cố → người dùng không đặt lại được mật khẩu | Trung bình | Hiển thị thông báo lỗi rõ ràng, cho phép thử lại; cân nhắc nhà cung cấp email dự phòng (OQ) |
| R-auth-06 | Ma trận phân quyền thiết kế sai → Kế toán xem được dữ liệu nhân sự hoặc ngược lại | Trung bình | Rà soát ma trận quyền với stakeholder trước khi xây dựng; kiểm thử phân quyền bắt buộc trước khi bàn giao |
| R-auth-07 | Phiên bị lợi dụng trên máy dùng chung | Trung bình | Đăng xuất vô hiệu hóa phiên ngay; đổi/đặt lại mật khẩu thu hồi các phiên còn lại; thời hạn phiên hợp lý (OQ-4) |
| R-auth-08 | Dự án frontend hoãn → auth không thể kiểm chứng trải nghiệm người dùng | Thấp | Xác nhận yêu cầu qua tài liệu và kiểm thử API trước; bổ sung kiểm chứng UI khi frontend triển khai |

## 7. Assumptions (mức BRD)

1. Tài khoản người dùng do Admin cấp (tạo tài khoản thuộc module khác) — hệ thống auth chỉ xác thực tài khoản đã tồn tại.
2. Doanh nghiệp có sẵn khả năng gửi email ra ngoài (dịch vụ email hoặc nhà cung cấp bên thứ 3) để gửi link đặt lại mật khẩu.
3. Email cá nhân của người dùng là duy nhất và được xác thực đúng trước khi cấp tài khoản.

## 8. Chuyển tiếp

Mục tiêu và rủi ro trên được cụ thể hóa thành năng lực sản phẩm trong [[docs/auth/auth-prd.md|Auth PRD]] và yêu cầu chi tiết trong [[docs/auth/srs/auth-spec.md|Auth SRS]].
