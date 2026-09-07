---
type: srs
feature: auth
status: draft
updated: 2026-09-04
links:
  - docs/auth/auth-urd.md
  - docs/auth/auth-brd.md
  - docs/auth/auth-prd.md
---

# Auth — Software Requirements Specification

## 1. Tổng quan

Tài liệu này mô tả yêu cầu chức năng, yêu cầu phi chức năng, quy tắc nghiệp vụ, ma trận lỗi, các câu hỏi mở và giả định cho feature auth của HRM-Accounting. Nguồn: [[docs/auth/auth-urd.md|Auth URD]], [[docs/auth/auth-brd.md|Auth BRD]], [[docs/auth/auth-prd.md|Auth PRD]].

Các giá trị số (số lần sai, thời hạn khóa, thời hạn link, thời hạn phiên, chính sách mật khẩu) là **assumption đề xuất chờ confirm** — xem Mục 7 Assumptions và Mục 8 Open Questions.

## 2. Functional Requirements

### Đăng nhập

**FR-auth-001** — Hệ thống cho phép người dùng đăng nhập bằng email và mật khẩu. Đăng nhập thành công khi: email tồn tại, tài khoản đang hoạt động, mật khẩu khớp. Thành công thì hệ thống mở phiên đăng nhập gắn với người dùng và vai trò hiện hành của họ.

**FR-auth-002** — Khi đăng nhập thất bại do sai email hoặc sai mật khẩu, hệ thống trả về một thông báo lỗi thống nhất ("Email hoặc mật khẩu không đúng") cho cả hai trường hợp, không tiết lộ thông tin nào khiến bên ngoài suy ra email có tồn tại hay không.

**FR-auth-003** — Khi đăng nhập thất bại do tài khoản đang bị khóa hoặc bị vô hiệu hóa, hệ thống từ chối đăng nhập với thông báo riêng cho từng trạng thái (khóa tạm / vô hiệu hóa), KHÔNG tính vào bộ đếm nhập sai và KHÔNG tiết lộ thêm thông tin tài khoản.

**FR-auth-004** — Hệ thống ghi nhận sự kiện đăng nhập thành công và đăng nhập thất bại (thời điểm, định danh tài khoản, kết quả, lý do thất bại ở mức phân loại) phục vụ truy vết.

### Đăng xuất

**FR-auth-005** — Hệ thống cho phép người dùng đăng xuất phiên hiện tại; sau khi đăng xuất, phiên đó không còn dùng được để truy cập. Đăng xuất thành công ngay cả khi phiên đã hết hạn trước đó (kết quả: người dùng ở trạng thái chưa đăng nhập).

### Duy trì phiên

**FR-auth-006** — Hệ thống cho phép gia hạn phiên đăng nhập cho người dùng đang có phiên hợp lệ mà không cần đăng nhập lại. Phiên có thời hạn sống theo BR-auth-004; phiên hết hạn thì mọi yêu cầu tiếp theo yêu cầu đăng nhập lại. Khi mật khẩu được đổi hoặc đặt lại, mọi phiên đang có của người dùng bị thu hồi (BR-auth-009).

### Khôi phục mật khẩu

**FR-auth-007** — Hệ thống cho phép người dùng yêu cầu đặt lại mật khẩu bằng cách cung cấp email. Phản hồi thống nhất ("Nếu email tồn tại, link đặt lại đã được gửi") bất kể email có tồn tại hay không, bất kể gửi mail thành công hay thất bại ở bước nội bộ.

**FR-auth-008** — Với email tồn tại và tài khoản đang hoạt động, hệ thống gửi email chứa link đặt lại mật khẩu. Link có đủ điều kiện: dùng đúng một lần, hết hạn sau 24 giờ (BR-auth-005), gắn với đúng một tài khoản. Yêu cầu link mới trong khi link cũ còn hạn thì link cũ bị vô hiệu.

**FR-auth-009** — Hệ thống cho phép người dùng đặt mật khẩu mới qua link hợp lệ. Đặt lại thành công thì: mật khẩu mới có hiệu lực, mọi phiên đang có bị thu hồi, mọi link đặt lại còn lại bị vô hiệu, bộ đếm nhập sai (nếu có) được xóa, và sự kiện được ghi nhật ký.

### Đổi mật khẩu

**FR-auth-010** — Hệ thống cho phép người dùng đã đăng nhập đổi mật khẩu khi cung cấp đúng mật khẩu hiện tại. Cung cấp sai mật khẩu hiện tại thì từ chối; lỗi này KHÔNG cộng vào bộ đếm nhập sai lúc đăng nhập (mục đích bộ đếm là chống dò mật khẩu ở cổng đăng nhập) nhưng vẫn ghi nhật ký.

**FR-auth-011** — Mật khẩu mới phải khác mật khẩu hiện tại và phải đạt chính sách độ mạnh theo BR-auth-003. Đổi thành công thì các phiên khác của cùng người dùng bị thu hồi (BR-auth-009) và sự kiện được ghi nhật ký.

### Phân quyền theo vai trò

**FR-auth-012** — Hệ thống gắn mỗi người dùng với đúng một vai trò trong tập: Admin hệ thống, HR, Kế toán, Nhân viên. Với mọi chức năng nghiệp vụ, hệ thống kiểm tra vai trò của người dùng trước khi thực hiện; yêu cầu vượt quyền bị từ chối và được ghi nhật ký. Ma trận "chức năng × vai trò" thuộc từng phân hệ nghiệp vụ (auth định nghĩa vai trò chuẩn và cơ chế kiểm tra).

### Khóa/mở khóa tài khoản

**FR-auth-013** — Hệ thống tự động khóa tài khoản khi đạt ngưỡng nhập sai theo BR-auth-001, và mở khóa tự động khi hết thời hạn khóa. Admin hệ thống được khóa/mở khóa thủ công bất kỳ tài khoản nào; thao tác ghi nhật ký với cả lý do (bắt buộc khi khóa thủ công). Tài khoản bị vô hiệu hóa (khác khóa tạm) chỉ Admin xử lý được — xem BR-auth-002.

### Nhật ký xác thực

**FR-auth-014** — Hệ thống ghi nhật ký các sự kiện: đăng nhập thành công/thất bại, đăng xuất, yêu cầu đặt lại mật khẩu, đặt lại mật khẩu thành công, đổi mật khẩu thành công, khóa tự động, khóa/mở khóa thủ công, từ chối vượt quyền. Nội dung nhật ký KHÔNG chứa mật khẩu, link đặt lại, hay dữ liệu xác thực nào khác (NFR-auth-003).

## 3. Non-functional Requirements

**NFR-auth-001** — Hiệu năng: yêu cầu đăng nhập trả kết quả trong ≤ 2 giây kể cả khi dịch vụ xác thực nội bộ hoạt động bình thường (thước đo BO-auth-06).

**NFR-auth-002** — Bảo mật lưu trữ: mật khẩu không được lưu dưới dạng đọc được (plaintext) và không được ghi vào bất kỳ log, nhật ký, thông báo lỗi nào.

**NFR-auth-003** — Bảo mật log: nhật ký xác thực không chứa mật khẩu, token, link đặt lại, hoặc dữ liệu cho phép giả mạo phiên.

**NFR-auth-004** — Chống dò tài khoản (anti-enumeration): thông báo lỗi đăng nhập và phản hồi yêu cầu đặt lại mật khẩu phải thống nhất để không suy ra được sự tồn tại của một email (xem FR-auth-002, FR-auth-007). Thời gian phản hồi giữa trường hợp "email tồn tại" và "email không tồn tại" không được chênh lệch đủ để suy ra kết quả.

**NFR-auth-005** — Bảo mật phiên: phiên hết hạn theo BR-auth-004; thu hồi phiên phải có hiệu lực tức thì cho các yêu cầu sau đó; phiên không được tái sử dụng sau khi đăng xuất.

**NFR-auth-006** — Kiểm toán: nhật ký xác thực lưu tối thiểu 12 tháng (assumption, OQ-9); sự kiện ghi đủ để trả lời "ai, làm gì, khi nào, kết quả" cho toàn bộ sự kiện liệt kê ở FR-auth-014.

**NFR-auth-007** — Tính sẵn sàng: chức năng đăng nhập là điều kiện vào của toàn hệ thống, downtime của auth đồng nghĩa downtime toàn hệ thống; sự cố auth phải cảnh báo cho người vận hành.

**NFR-auth-008** — Giới hạn gửi email: tối đa 3 email đặt lại mật khẩu cho một địa chỉ trong 1 giờ (assumption) để chống spam/email bombing (R-auth-03).

**NFR-auth-009** — Khả dụng: thông báo lỗi dùng wording tiếng Việt thống nhất theo Error Matrix Mục 5; lỗi hệ thống nội bộ không tiết lộ chi tiết kỹ thuật cho người dùng.

## 4. Business Rules

**BR-auth-001** (assumption chờ confirm) — Khóa tài khoản tự động: nhập sai mật khẩu **5 lần liên tiếp trong vòng 15 phút** thì tài khoản bị khóa **15 phút**. Bộ đếm về lại 0 khi: đăng nhập thành công, hoặc hết cửa sổ 15 phút không có lần sai nào. Lỗi "email không tồn tại" không cộng bộ đếm. Đăng nhập sai khi tài khoản đang khóa không kéo dài thời hạn khóa (không cộng dồn).

**BR-auth-002** — Phân biệt hai trạng thái chặn: **khóa tạm** (tự mở sau thời hạn, do sai mật khẩu lặp lại) và **vô hiệu hóa** (do Admin quyết định, vd nhân viên nghỉ việc — không tự mở). Chỉ Admin mở được vô hiệu hóa.

**BR-auth-003** (assumption chờ confirm) — Chính sách mật khẩu: độ dài tối thiểu **8 ký tự**, chứa ít nhất 1 chữ cái và 1 chữ số. Đặt lại/đổi mật khẩu bắt buộc đạt chính sách; đăng nhập không kiểm tra chính sách (chỉ so khớp).

**BR-auth-004** (assumption chờ confirm) — Thời hạn phiên: phiên tự hết hạn sau **8 giờ** không hoạt động (idle timeout). Người dùng hoạt động liên tục được gia hạn phiên trong ngày làm việc.

**BR-auth-005** (assumption chờ confirm) — Link đặt lại mật khẩu hết hạn sau **24 giờ** kể từ khi gửi, dùng đúng một lần.

**BR-auth-006** — Một email chỉ gắn với đúng một tài khoản; đăng nhập và đặt lại mật khẩu đều định danh theo email.

**BR-auth-007** — Vai trò là tập đóng: Admin hệ thống, HR, Kế toán, Nhân viên. Mỗi người dùng đúng một vai trò tại một thời điểm. Việc gán/thay đổi vai trò thuộc module quản lý người dùng (OQ-8).

**BR-auth-008** — Thao tác khóa thủ công của Admin bắt buộc kèm lý do; lý do được ghi vào nhật ký.

**BR-auth-009** — Đổi hoặc đặt lại mật khẩu thành công thì toàn bộ phiên đang có của người dùng (trừ phiên đang thực hiện thao tác đổi, nếu có) bị thu hồi ngay.

**BR-auth-010** — Thao tác nhạy cảm (đăng nhập, đặt lại, đổi mật khẩu, khóa/mở khóa) đều ghi nhật ký theo FR-auth-014 — không có ngoại lệ kể cả khi thao tác thất bại.

## 5. Error Matrix

| ID | Tình huống | Wording hiển thị (tiếng Việt) | Hệ quả nghiệp vụ |
|----|-----------|-------------------------------|------------------|
| E-auth-001 | Đăng nhập sai email hoặc sai mật khẩu | "Email hoặc mật khẩu không đúng." | Cộng bộ đếm sai +1 (BR-auth-001); ghi nhật ký thất bại |
| E-auth-002 | Đăng nhập khi tài khoản đang khóa tạm | "Tài khoản đang bị khóa tạm thời. Vui lòng thử lại sau hoặc liên hệ quản trị viên." | Không cộng bộ đếm; ghi nhật ký |
| E-auth-003 | Đăng nhập khi tài khoản bị vô hiệu hóa | "Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên." | Không cộng bộ đếm; ghi nhật ký |
| E-auth-004 | Đăng nhập thiếu email hoặc mật khẩu | "Vui lòng nhập email và mật khẩu." | Không cộng bộ đếm; không ghi nhật ký đăng nhập thất bại |
| E-auth-005 | Yêu cầu đặt lại mật khẩu | "Nếu email tồn tại trong hệ thống, link đặt lại mật khẩu đã được gửi." | Phản hồi thống nhất cả khi email không tồn tại (NFR-auth-004); giới hạn tần suất NFR-auth-008 áp ngầm |
| E-auth-006 | Link đặt lại hết hạn hoặc đã sử dụng | "Link đặt lại mật khẩu không còn hiệu lực. Vui lòng yêu cầu link mới." | Cho phép yêu cầu link mới theo FR-auth-008; ghi nhật ký |
| E-auth-007 | Mật khẩu mới không đạt chính sách | "Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ cái và chữ số." (assumption wording theo BR-auth-003) | Từ chối đặt lại/đổi; không thay đổi trạng thái |
| E-auth-008 | Đổi mật khẩu: mật khẩu hiện tại sai | "Mật khẩu hiện tại không đúng." | Từ chối; không cộng bộ đếm đăng nhập (FR-auth-010); ghi nhật ký |
| E-auth-009 | Đổi mật khẩu: mật khẩu mới trùng mật khẩu hiện tại | "Mật khẩu mới phải khác mật khẩu hiện tại." | Từ chối; ghi nhật ký |
| E-auth-010 | Đặt lại/đổi mật khẩu vượt tần suất gửi email | "Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau." | Áp khi chạm ngưỡng NFR-auth-008; ghi nhật ký |
| E-auth-011 | Yêu cầu vượt quyền | "Bạn không có quyền thực hiện chức năng này." | Từ chối; ghi nhật ký từ chối vượt quyền (FR-auth-012) |
| E-auth-012 | Phiên hết hạn hoặc không hợp lệ | "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." | Yêu cầu đăng nhập lại; ghi nhật ký nếu phát hiện dùng phiên đã thu hồi |

## 6. Traceability

| FR | Trả lời CAP | Trả lời BO |
|----|-------------|-----------|
| FR-auth-001…004 | CAP-auth-01 | BO-auth-01, 04, 05 |
| FR-auth-005 | CAP-auth-02 | BO-auth-07 |
| FR-auth-006 | CAP-auth-03 | BO-auth-06, 07 |
| FR-auth-007…009 | CAP-auth-04 | BO-auth-03, 05 |
| FR-auth-010…011 | CAP-auth-05 | BO-auth-03, 07 |
| FR-auth-012 | CAP-auth-06 | BO-auth-02 |
| FR-auth-013 | CAP-auth-07 | BO-auth-05 |
| FR-auth-014 | CAP-auth-08 | BO-auth-04 |

## 7. Assumptions

1. A-1 — Tài khoản do Admin cấp trước; auth chỉ xác thực tài khoản đã tồn tại (không có tự đăng ký).
2. A-2 — Số liệu đề xuất BR-auth-001/003/004/005 và NFR-auth-008 (5 lần/15 phút, chính sách mật khẩu 8 ký tự, phiên 8 giờ, link 24 giờ, 3 email/giờ) là giá trị khởi điểm chờ stakeholder confirm — có thể điều chỉnh qua cấu hình nghiệp vụ mà không đổi hành vi.
3. A-3 — Doanh nghiệp đã có dịch vụ gửi email ra ngoài; auth chỉ yêu cầu "gửi được email chứa link".
4. A-4 — Email của người dùng là duy nhất và dùng làm định danh đăng nhập (BR-auth-006).
5. A-5 — "Nhân viên" có thể tự xem thông tin cá nhân nhưng không truy cập dữ liệu của người khác; ranh giới chi tiết thuộc ma trận quyền của từng phân hệ.

## 8. Open Questions

| ID | Câu hỏi | Assumption đang dùng | Ảnh hưởng nếu khác |
|----|---------|---------------------|---------------------|
| OQ-1 | Có cần 2FA (OTP qua email/SMS/authenticator) không, và bắt buộc với vai trò nào (ít nhất Admin)? | Không có 2FA trong phạm vi hiện tại | Nếu có: thêm FR riêng, ảnh hưởng luồng đăng nhập và Error Matrix |
| OQ-2 | Có cần đăng nhập qua nhà cung cấp ngoài (Google/Microsoft Workspace) không? | Không có; chỉ email + mật khẩu | Nếu có: thêm quy trình liên kết tài khoản, thay đổi BR-auth-006 |
| OQ-3 | Thời hạn khóa tạm sau 5 lần sai: 15 phút có phù hợp không? Muốn tăng dần (5→15→30 phút) hay mở khóa chỉ do Admin? | 15 phút cố định, tự mở | Đổi ngưỡng ảnh hưởng BR-auth-001 và E-auth-002 |
| OQ-4 | Thời hạn phiên 8 giờ idle có phù hợp không? Có cần "ghi nhớ đăng nhập trên thiết bị này" không? | 8 giờ idle, không có ghi nhớ thiết bị | Đổi ảnh hưởng BR-auth-004, NFR-auth-005, UC-refresh-session |
| OQ-5 | Chính sách mật khẩu 8 ký tự + chữ + số có đủ không, hay cần ký tự đặc biệt/chặn mật khẩu phổ biến? | 8 ký tự, ≥1 chữ cái, ≥1 chữ số | Đổi ảnh hưởng BR-auth-003, E-auth-007 |
| OQ-6 | Nhà cung cấp dịch vụ gửi email nào sẽ dùng (mục đích nghiệp vụ: gửi link đặt lại)? | Chưa chọn — chỉ ràng buộc "gửi được, có khả năng gửi lại khi lỗi" | Ảnh hưởng khả năng gửi và NFR-auth-008 |
| OQ-7 | Tài khoản đầu tiên (Admin ban đầu) được tạo thế nào — seed khi triển khai hay quy trình cấp phát nội bộ? | Admin ban đầu được cấp ngoài hệ thống khi triển khai | Ảnh hưởng phạm vi FR-auth-013 và bàn giao triển khai |
| OQ-8 | Phạm vi quản lý tài khoản (tạo/sửa/xóa người dùng, gán vai trò) thuộc module nào — gộp vào auth hay module người dùng riêng? | Thuộc module quản lý người dùng, ngoài scope auth | Nếu gộp: auth mở rộng đáng kể scope |
| OQ-9 | Thời gian lưu nhật ký xác thực tối thiểu 12 tháng có phù hợp với yêu cầu kiểm toán nội bộ không? | 12 tháng | Đổi ảnh hưởng NFR-auth-006 |
| OQ-10 | Khi đặt lại mật khẩu, có cần khóa toàn bộ phiên hay chỉ phiên trên thiết bị thực hiện? | Thu hồi toàn bộ phiên (BR-auth-009) | Đổi ảnh hưởng FR-auth-009, FR-auth-011 |
