---
type: srs
feature: hr
status: draft
updated: 2026-09-05
links: []
---

# HR — Software Requirements Specification

Quản lý dữ liệu nền tảng của phân hệ Nhân sự: **Phòng ban**, **Nhân viên**, **Hợp đồng**, **Người phụ thuộc**, **Tài liệu**, **Cấu hình mặc định** (Thiết lập chung), **Ca làm việc**, **Lịch ngày lễ**. Đây là spec nghiệp vụ duy nhất cho module (feature quản lý dữ liệu CRUD — ưu tiên 1 tài liệu đầy đủ thay vì nhiều file rời).

## 1. Business Goal

Số hoá toàn bộ hồ sơ nhân sự (phòng ban, nhân viên, hợp đồng, người phụ thuộc, tài liệu/hồ sơ giấy tờ) và hệ thống tham số nền tảng (cấu hình ngày/giờ công, bảo hiểm, thuế, ca làm việc, lịch nghỉ lễ) hiện quản lý thủ công hoặc phân tán, thành dữ liệu tập trung có ràng buộc toàn vẹn và có phân quyền truy cập — làm nền dữ liệu đầu vào cho tính lương, chấm công, BHXH, thuế TNCN ở các module sau (Payroll, Chấm công...).

## 2. Stakeholders

| Stakeholder | Quan tâm điều gì |
|---|---|
| HR | Công cụ nhập/tra cứu/cập nhật hồ sơ nhân viên, hợp đồng, người phụ thuộc, ca làm việc và lịch ngày lễ nhanh, đúng, không sai sót thủ công |
| Kế toán (ACCOUNTANT) | Xem đúng, đủ dữ liệu lương/BHXH/TNCN, các tỷ lệ trích đóng bảo hiểm, mức giảm trừ gia cảnh, bậc thuế và ngày công chuẩn để tính lương chính xác |
| Admin hệ thống | Danh mục Phòng ban ổn định, toàn quyền kiểm soát các tham số cấu hình mặc định quan trọng của toàn doanh nghiệp |
| Ban giám đốc | Dữ liệu nhân sự chính xác, tuân thủ đúng Bộ luật Lao động và quy chế công ty, có kiểm soát truy cập theo vai trò |

## 3. Scope

1. Quản lý danh mục Phòng ban: tạo, xem, sửa, ngừng hoạt động (soft-delete khi đang có nhân viên).
2. Quản lý hồ sơ Nhân viên: tạo (có auto-gen Mã NV, bắt buộc tạo kèm Hợp đồng đầu tiên trong cùng giao dịch), xem/tra cứu, sửa, xoá — thông tin cá nhân, liên hệ, phòng ban, chức vụ, tài khoản ngân hàng.
3. Quản lý Hợp đồng (Contract) gắn với từng Nhân viên, lưu lịch sử đầy đủ theo thời gian: tạo (kèm lúc tạo Nhân viên, hoặc thêm mới cho Nhân viên đã tồn tại khi gia hạn/đổi loại/đổi lương), xem lịch sử và Hợp đồng hiện hành theo từng nhân viên, sửa (bao gồm chấm dứt sớm).
4. Quản lý Người phụ thuộc gắn với từng Nhân viên phục vụ đăng ký giảm trừ gia cảnh thuế TNCN: tạo, xem theo nhân viên, sửa, xoá.
5. Validate dữ liệu đầu vào theo đúng ràng buộc ở Mục 6 (định dạng, độ dài, bắt buộc/tuỳ chọn, giá trị enum, toàn vẹn tham chiếu FK).
6. Phân quyền truy cập theo vai trò cho cả 8 entity (Mục 5).
7. Quản lý Tài liệu (hồ sơ giấy tờ) gắn với từng Nhân viên, cho phép lưu nhiều bản ghi cho 1 Nhân viên (CCCD/CMND, Hộ chiếu, Bằng cấp, Chứng chỉ, Sơ yếu lý lịch...): tạo, xem theo nhân viên, sửa, xoá.
8. Quản lý Cấu hình mặc định (Thiết lập chung): phương pháp tính ngày công chuẩn, chính sách T7/CN, giờ công chuẩn/ngày, ngày phép cơ bản & thâm niên, hệ số và trần giờ tăng ca, lương cơ sở và lương tối thiểu vùng, tỷ lệ bảo hiểm NV/DN đóng, công đoàn & trần đoàn phí, mức giảm trừ gia cảnh bản thân & NPT, biểu thuế TNCN 5 bậc lũy tiến; hỗ trợ khôi phục về bộ cấu hình chuẩn mặc định.
9. Quản lý Ca làm việc: tạo (mã ca tự sinh CA01-CA99 hoặc nhập tay), xem danh sách, cập nhật, xóa ca làm việc; tự động tính số giờ công của ca dựa trên giờ vào, giờ ra và thời gian nghỉ giữa ca; tự động nhận diện ca làm việc qua đêm.
10. Quản lý Lịch ngày lễ: tạo, xem (lọc theo Năm nay, Hàng năm, Tất cả), sửa, xóa ngày lễ; hỗ trợ tính năng "Tạo nhanh" tự động sinh 11 ngày nghỉ lễ chuẩn Việt Nam theo Điều 112 Bộ luật Lao động 2019 cho một năm và tự loại bỏ ngày trùng lặp.

## 4. Out of Scope

1. Tính lương, BHXH, thuế TNCN thực tế (Payroll) — module này chỉ cung cấp dữ liệu đầu vào.
2. Chấm công, đơn từ, nghỉ phép.
3. Liên kết/tạo tài khoản đăng nhập (User ở feature auth) từ hồ sơ Nhân viên — xem OQ-hr-9.
4. Import/Export Excel — chưa xác nhận, xem OQ-hr-6.
5. Audit log chi tiết thay đổi dữ liệu (ai sửa, giá trị trước/sau) — chưa xác nhận, xem OQ-hr-7.
6. Giao diện người dùng (wireframe, màn hình) — hoãn giai đoạn frontend.
7. Nhân viên tự xem/sửa thông tin cá nhân của mình (self-service) — vai trò EMPLOYEE không có quyền truy cập module này trong phạm vi hiện tại (Mục 5).
8. Phân biệt "phụ lục hợp đồng" với "hợp đồng mới" — mọi thay đổi hợp đồng (gia hạn, đổi loại, đổi lương...) đều là một bản ghi Hợp đồng ngang hàng, không có khái niệm phụ lục riêng trong phạm vi tài liệu này (OQ-hr-22).
9. Validate/cảnh báo theo trần thời hạn hợp đồng lao động do luật lao động quy định (vd tối đa 36 tháng cho loại hợp đồng xác định thời hạn trước khi phải chuyển vô thời hạn) — hệ thống chỉ ghi nhận đúng dữ liệu do người dùng nhập, không tự kiểm tra tuân thủ pháp luật (OQ-hr-23).
10. Đính kèm/lưu trữ file hợp đồng (bản scan/PDF) — không thiết kế file storage trong phạm vi tài liệu này (OQ-hr-24).
11. Upload/lưu trữ trực tiếp file scan Tài liệu trong hạ tầng của hệ thống (server storage/DB) — file scan được upload thẳng vào Google Drive cá nhân của người dùng đang thao tác (quyết định OQ-hr-25, xem Mục 6.5), hệ thống chỉ lưu tham chiếu (tên file, link xem, người đã upload), không lưu file bytes.
12. Duyệt/liệt kê toàn bộ nội dung Google Drive của người dùng, hoặc thao tác trên file KHÔNG do hệ thống tạo ra — tích hợp chỉ xin quyền tối thiểu (`drive.file`, least-privilege) trên chính các file hệ thống tự upload, không truy cập gì khác trong Drive cá nhân của người dùng.
13. Tính năng cảnh báo/nhắc nhở tự động khi Tài liệu (CCCD, Hộ chiếu...) sắp hoặc đã hết hạn — chỉ lưu dữ liệu Ngày hết hạn (OQ-hr-26 resolved — có thêm field), chưa xây tính năng cảnh báo ở phạm vi này.
14. Checklist/kiểm tra hồ sơ Tài liệu còn thiếu theo danh mục bắt buộc phục vụ onboarding nhân viên mới — hệ thống chỉ lưu trữ Tài liệu tự do theo nhu cầu nhập liệu thực tế, không ép buộc phải đủ loại tài liệu nào trong phạm vi tài liệu này.

## 5. Actors & Phân quyền theo vai trò

Tái dùng 4 vai trò cố định đã có ở feature auth: ADMIN, HR, ACCOUNTANT, EMPLOYEE (BR-auth-007). Cơ chế kiểm tra vai trò dùng chung với auth (FR-auth-012).

| Entity | Create | Read | Update | Delete / Đổi trạng thái |
|---|---|---|---|---|
| Phòng ban | ADMIN, HR | ADMIN, HR, ACCOUNTANT | ADMIN, HR | ADMIN, HR (chỉ soft-delete khi đang có Nhân viên — BR-hr-008) |
| Nhân viên | ADMIN, HR | ADMIN, HR, ACCOUNTANT (đủ mọi trường, kể cả tài khoản ngân hàng) | ADMIN, HR | ADMIN, HR |
| Hợp đồng | ADMIN, HR | ADMIN, HR, ACCOUNTANT (đủ mọi trường, kể cả lương/BHXH/TNCN/Công đoàn) | ADMIN, HR | ADMIN, HR |
| Người phụ thuộc | ADMIN, HR | ADMIN, HR, ACCOUNTANT | ADMIN, HR | ADMIN, HR |
| Tài liệu | ADMIN, HR | ADMIN, HR, ACCOUNTANT (mặc định tạm thời — xem ghi chú dưới) | ADMIN, HR | ADMIN, HR |
| Cấu hình mặc định | ADMIN | ADMIN, HR, ACCOUNTANT | ADMIN | ADMIN (Khôi phục mặc định ban đầu — BR-hr-019) |
| Ca làm việc | ADMIN, HR | ADMIN, HR, ACCOUNTANT | ADMIN, HR | ADMIN, HR |
| Lịch ngày lễ | ADMIN, HR | ADMIN, HR, ACCOUNTANT | ADMIN, HR | ADMIN, HR |

EMPLOYEE: không có quyền truy cập module này ở phạm vi hiện tại (BR-hr-011).

Ghi chú (2026-09-05): dòng "Tài liệu" theo đúng khuôn mẫu 4 entity ban đầu. Riêng "Cấu hình mặc định" chi phối toàn bộ chính sách lương, thuế và bảo hiểm của cả doanh nghiệp nên chỉ ADMIN được quyền cập nhật hoặc khôi phục mặc định; HR và ACCOUNTANT có quyền Read để phục vụ đối soát và vận hành. "Ca làm việc" và "Lịch ngày lễ" do ADMIN và HR toàn quyền quản lý, ACCOUNTANT có quyền xem để tính công/lương.

## 6. Entities & Fields

### 6.1 Phòng ban (Department) — tự thiết kế

| Cột | Bắt buộc | Kiểu dữ liệu | Mô tả / Ghi chú |
|---|---|---|---|
| Mã phòng ban (*) | ✓ | Chuỗi | Duy nhất toàn hệ thống. Định dạng đề xuất DP + số thứ tự (vd DP001) theo dữ liệu mẫu hiện có. Tối đa 20 ký tự. Không sửa được sau khi tạo (A-hr-5, OQ-hr-8). |
| Tên phòng ban (*) | ✓ | Chuỗi | Bắt buộc, không để trống. Tối đa 200 ký tự. |
| Mô tả | | Chuỗi | Tuỳ chọn. Tối đa 500 ký tự. |
| Trạng thái | | Chọn từ list | Giá trị: Hoạt động / Ngừng hoạt động. Mặc định: Hoạt động. Dùng để xoá mềm phòng ban đang có nhân viên (BR-hr-008). |

Dữ liệu mẫu tham chiếu (theo dropdown Nhân viên hiện có): DP001 - Ban Giám Đốc, DP002 - phòng sản xuất, DP003 - phòng sale, DP004 - phòng hành chính, DP005 - kế toán.

### 6.2 Nhân viên (Employee)

| Cột | Bắt buộc | Kiểu dữ liệu | Mô tả / Ghi chú |
|---|---|---|---|
| Mã NV | | Chuỗi | Mã NV — bỏ trống để hệ thống tự sinh. Không được trùng lặp trong file. |
| Họ và tên (*) | ✓ | Chuỗi | Họ tên đầy đủ (bắt buộc). Không được để trống. |
| Ngày sinh | | Ngày (dd/mm/yyyy) | Định dạng dd/MM/yyyy |
| CCCD | | Chuỗi | Số CCCD (12 chữ số) — text format để giữ số 0 đầu. Tối đa 20 ký tự. |
| MST cá nhân | | Chuỗi | Tối đa 20 ký tự. |
| Số điện thoại | | Chuỗi | |
| Email | | Chuỗi | |
| Địa chỉ | | Chuỗi | Tối đa 500 ký tự. |
| Giới tính | | Chọn từ list | Giá trị: Nam / Nữ / Khác |
| Mã phòng ban | | Chọn từ list | Dropdown "Mã - Tên" (vd DP001 - Phòng IT). Phải tồn tại trong hệ thống (FK Phòng ban). Mẫu hiện có: DP001 - Ban Giám Đốc / DP005 - kế toán / DP004 - phòng hành chính / DP003 - phòng sale / DP002 - phòng sản xuất |
| Chức vụ | | Chuỗi | Tối đa 100 ký tự. |
| Miễn chấm công | | Có/Không | Có = NV không cần chấm công (vd giám đốc); Không = chấm công bình thường. Thuộc tính cá nhân/vai trò, không phụ thuộc Hợp đồng nào (A-hr-11). |
| Số tài khoản | | Chuỗi | Tối đa 30 ký tự |
| Tên tài khoản | | Chuỗi | Tối đa 100 ký tự |
| Ngân hàng | | Chọn từ list | Danh sách gợi ý + "Khác": Vietcombank/VietinBank/BIDV/Agribank/Techcombank/MBBank/ACB/VPBank/Sacombank/TPBank/OCB/HDBank/SHB/Eximbank/LienVietPostBank/SeABank/NCB/PVcomBank/BacABank/Khác |
| Ghi chú | | Chuỗi | Tối đa 2000 ký tự |

> Thông tin hợp đồng (số hợp đồng, loại hợp đồng, kiểu lương, lương, ngày hiệu lực, BHXH, TNCN, công đoàn) **không còn lưu trực tiếp trên Nhân viên** kể từ 2026-09-05 — xem Mục 6.4 Hợp đồng. Mỗi Nhân viên bắt buộc có ít nhất một Hợp đồng ngay từ khi tạo (BR-hr-014). Chi tiết quyết định và phạm vi ảnh hưởng xem A-hr-6 (Mục 15). Nhân viên cũng có thể có nhiều bản ghi Tài liệu đính kèm (CCCD, Hộ chiếu, Bằng cấp...) — xem Mục 6.5 Tài liệu.

### 6.3 Người phụ thuộc (Dependent)

| Cột | Bắt buộc | Kiểu dữ liệu | Mô tả / Ghi chú |
|---|---|---|---|
| Mã NV | ✓ | Chuỗi | Không để trống — FK tới Nhân viên |
| Tên nhân viên (tham khảo) | | Chuỗi | Chỉ để tham khảo/đối chiếu (vd lúc import Excel) — KHÔNG phải nguồn dữ liệu thật, nên lấy qua quan hệ với Nhân viên, không lưu cột riêng |
| Họ tên NPT | ✓ | Chuỗi | Không để trống. Tối đa 200 ký tự |
| Quan hệ | | Chuỗi | Vợ/Chồng/Con/Bố/Mẹ/Anh chị em/Khác. Tối đa 50 ký tự |
| Ngày sinh | | Chuỗi | Định dạng dd/MM/yyyy, nhưng kiểu dữ liệu là Chuỗi (text) — khác với Ngày sinh của Nhân viên (kiểu Ngày thật). Giữ nguyên theo yêu cầu nghiệp vụ; xem A-hr-7. |
| CCCD | | Chuỗi | Tối đa 20 ký tự |
| MST | | Chuỗi | Tối đa 20 ký tự |
| Số điện thoại | | Chuỗi | Tối đa 20 ký tự |
| Địa chỉ | | Chuỗi | Tối đa 255 ký tự |
| ĐK từ tháng | | Số nguyên | 1-12 |
| ĐK từ năm | | Số nguyên | 2000-2100 |
| ĐK đến tháng | | Số nguyên | 1-12 |
| ĐK đến năm | | Số nguyên | 2000-2100 |

(ĐK = đăng ký giảm trừ gia cảnh thuế TNCN — từ tháng/năm đến tháng/năm nào.)

### 6.4 Hợp đồng (Contract)

> **Quyết định 2026-09-05:** chuyển từ thiết kế field-nhúng-trên-Nhân viên (giả định A-hr-6 gốc) sang entity **Hợp đồng** riêng biệt, có lịch sử đầy đủ theo thời gian (1 Nhân viên — N Hợp đồng). Đây là thay đổi phá vỡ (breaking change) so với spec và code đã triển khai trước đó — chi tiết phạm vi ảnh hưởng xem A-hr-6 (Mục 15).

| Cột | Bắt buộc | Kiểu dữ liệu | Mô tả / Ghi chú |
|---|---|---|---|
| Mã NV | ✓ | Chuỗi | FK bắt buộc tới một Nhân viên đang tồn tại — mỗi Hợp đồng luôn gắn với đúng một Nhân viên. |
| Số hợp đồng (*) | ✓ | Chuỗi | vd HĐLĐ-001/2026. Bắt buộc, không để trống. Tối đa 100 ký tự. KHÔNG bắt buộc duy nhất (OQ-hr-2, đã gộp OQ-hr-18). |
| Loại hợp đồng (*) | ✓ | Chọn từ list | Bắt buộc. Giá trị: Thử việc / HĐLĐ - Hợp đồng lao động / HĐDV - Hợp đồng dịch vụ |
| Kiểu lương (*) | ✓ | Chọn từ list | Bắt buộc, chọn 1 trong 2 (Gross = NV tự đóng thuế / Net = công ty gross-up + đóng thuế thay). Giá trị: Gross - Lương trước thuế / Net - Lương sau thuế |
| Lương chính (*) | ✓ | Số nguyên (VND) | Bắt buộc. Đơn vị VND, số nguyên (không phần thập phân, khớp thực tế lương VN không lẻ đồng). Phải > 0 (BR-hr-012). |
| Lương đóng BHXH | ✓ khi Trích đóng BHXH = Có | Số nguyên (VND) | Bắt buộc CHỈ KHI Trích đóng BHXH = Có; bỏ trống/không áp dụng khi Trích đóng BHXH = Không. Đơn vị VND, số nguyên, phải > 0 khi áp dụng (BR-hr-012). |
| Ngày bắt đầu (*) | ✓ | Ngày (dd/mm/yyyy) | Ngày hợp đồng bắt đầu có hiệu lực. Bắt buộc. |
| Ngày kết thúc | | Ngày (dd/mm/yyyy) | Bỏ trống = vô thời hạn/chưa xác định. Phải SAU Ngày bắt đầu nếu có nhập (BR-hr-003). Có thể sửa thành giá trị sớm hơn dự kiến ban đầu để chấm dứt hợp đồng sớm (OQ-hr-15). |
| Trích đóng BHXH | | Có/Không | Có = trích đóng BHXH; Không = không trích; bỏ trống = Có (mặc định — BR-hr-005). |
| Tính thuế TNCN | | Có/Không | Có = tính thuế TNCN; Không = miễn thuế; bỏ trống = Có (mặc định — BR-hr-005). |
| Công đoàn | | Có/Không | Có = đóng phí công đoàn 1%; **HĐDV tự động sẽ là Không** (BR-hr-004 — theo Loại hợp đồng của CHÍNH hợp đồng này, không phải cấu hình toàn cục của Nhân viên). |
| Lý do chấm dứt | | Chuỗi | Tuỳ chọn. Tối đa 500 ký tự. Dùng khi chấm dứt hợp đồng sớm hơn Ngày kết thúc dự kiến ban đầu (OQ-hr-15). |

Ghi chú bổ sung:
- Không có field trạng thái tường minh (OQ-hr-14) — Hợp đồng "hiện hành" được suy ra tại thời điểm truy vấn bằng cách so sánh Ngày bắt đầu/Ngày kết thúc với ngày hiện tại.
- Tại một thời điểm, một Nhân viên chỉ có tối đa một Hợp đồng hiện hành — hệ thống từ chối lưu nếu khoảng thời gian chồng lấn với Hợp đồng khác của cùng Nhân viên (BR-hr-013).
- Mọi gia hạn/đổi loại hợp đồng/đổi lương là một bản ghi Hợp đồng MỚI, độc lập — không có khái niệm "phụ lục hợp đồng" trong phạm vi tài liệu này (OQ-hr-16, Mục 4 item 8).

### 6.5 Tài liệu (Document)

Cho phép một Nhân viên có nhiều bản ghi Tài liệu (1 Nhân viên — N Tài liệu), cùng kiểu quan hệ với Hợp đồng và Người phụ thuộc — ví dụ 1 nhân viên có thể có CCCD + Hộ chiếu + 2 Bằng cấp + Sơ yếu lý lịch cùng lúc.

| Cột | Bắt buộc | Kiểu dữ liệu | Mô tả / Ghi chú |
|---|---|---|---|
| Mã NV (*) | ✓ | Chuỗi | FK bắt buộc tới một Nhân viên đang tồn tại — mỗi Tài liệu luôn gắn với đúng một Nhân viên (BR-hr-015). |
| Loại tài liệu (*) | ✓ | Chọn từ list | Bắt buộc. Giá trị: CCCD/CMND / Hộ chiếu / Bằng cấp / Chứng chỉ / Sơ yếu lý lịch / Khác (nhập tự do khi chọn Khác — free-text có gợi ý, cùng cơ chế với Ngân hàng/Quan hệ NPT — A-hr-2, A-hr-13). |
| Số hiệu (*) | ✓ | Chuỗi | Số hiệu tài liệu (vd số CCCD, số hộ chiếu, số bằng/chứng chỉ). Bắt buộc, không để trống. Tối đa 50 ký tự. KHÔNG bắt buộc duy nhất — cho phép trùng (BR-hr-018). |
| Ngày cấp | | Ngày (dd/mm/yyyy) | Tuỳ chọn. Không được là ngày trong tương lai (BR-hr-016). |
| Nơi cấp | | Chuỗi | Tuỳ chọn. Tối đa 200 ký tự. |
| Ngày hết hạn | | Ngày (dd/mm/yyyy) | Tuỳ chọn, áp dụng chung cho mọi Loại tài liệu — KHÔNG bắt buộc riêng theo loại nào (quyết định user 2026-09-05, OQ-hr-26 resolved). Nếu có nhập cùng Ngày cấp thì phải SAU Ngày cấp (BR-hr-017). |
| Ghi chú | | Chuỗi | Tuỳ chọn. Tối đa 2000 ký tự. |
| File đính kèm (Google Drive) | | Tệp upload | Tuỳ chọn. Upload trực tiếp qua tích hợp Google Drive (OQ-hr-25 — resolved: Cách hiểu 2, xem dưới), lưu vào Drive cá nhân của người dùng đang thao tác; hệ thống chỉ lưu tham chiếu (tên file, link xem, người đã upload), KHÔNG lưu file vào DB. Mỗi bản ghi Tài liệu chỉ có đúng 1 file đính kèm (A-hr-12). Chi tiết kỹ thuật: `docs/hr/architecture/adr/ADR-004-google-drive-integration.md`. |

Ghi chú bổ sung:
- Trường hợp cần đính kèm nhiều ảnh cho 1 Tài liệu (vd CCCD chụp cả mặt trước lẫn mặt sau), người dùng tự gộp thành 1 file (vd ảnh ghép hoặc PDF nhiều trang) trước khi upload — hệ thống không thiết kế nhiều file song song cho 1 bản ghi (A-hr-12).
- Danh sách Loại tài liệu hiện giữ đúng 5 giá trị nghiệp vụ user đã nêu + "Khác" (A-hr-13) — có thể mở rộng thêm (vd Giấy khám sức khỏe, Ảnh chân dung, Bằng lái xe) khi có nhu cầu thực tế, không cần đổi cấu trúc dữ liệu vì đây là danh sách gợi ý free-text.
- Hệ thống không kiểm tra/chặn trùng lặp Loại tài liệu + Số hiệu (BR-hr-018) — nếu người dùng nhập trùng do nhầm lẫn (vd nhập 2 lần CCCD), đây là trách nhiệm nghiệp vụ của người nhập liệu, không phải ràng buộc hệ thống.
- Một Tài liệu vẫn có giá trị nghiệp vụ đầy đủ (loại, số hiệu, ngày cấp...) dù chưa/không có file đính kèm — file là bổ sung tuỳ chọn, không bắt buộc để tạo bản ghi Tài liệu.

> #### OQ-hr-25 — RESOLVED (2026-09-05): Cách hiểu 2 — tích hợp Google Drive API thật
>
> Yêu cầu gốc nêu file scan "lưu vào drive của người dùng... không lưu vào DB" — có 2 cách hiểu (chỉ lưu link tay, hoặc tích hợp Drive API thật với OAuth/upload tự động). User đã xác nhận trực tiếp qua AskUserQuestion: **chọn tích hợp Google Drive API thật** (OAuth, upload tự động vào Drive cá nhân người đang thao tác, scope tối thiểu `drive.file`) — mặc dù đây là tích hợp bên thứ 3 hoàn toàn mới cho dự án, quy mô tương đương 1 module riêng. Thiết kế kỹ thuật đầy đủ: `docs/hr/architecture/adr/ADR-004-google-drive-integration.md`.

### 6.6 Cấu hình mặc định (General Setting)

Cấu hình các tham số nền tảng dùng chung toàn công ty (Singleton per system/tenant). Lưu trữ bộ giá trị tham số gồm 5 nhóm chính:

#### 1. Ngày công & Giờ công
| Cột | Bắt buộc | Kiểu dữ liệu | Mặc định | Mô tả / Ghi chú |
|---|---|---|---|---|
| Phương pháp tính ngày công chuẩn (*) | ✓ | Chọn từ list | `co_dinh_26` | Giá trị: `co_dinh_26` (Cố định 26 ngày), `thuc_te` (Theo số ngày làm việc thực tế trong tháng). Quyết định mẫu số quy đổi lương tháng ra lương ngày. |
| Chính sách Thứ 7 (*) | ✓ | Chọn từ list | `lam_nua_ngay` | Giá trị: `nghi` (Nghỉ), `lam_ca_ngay` (Làm cả ngày), `lam_nua_ngay` (Làm nửa ngày - sáng). Dùng khi tính ngày công thực tế. |
| Chính sách Chủ nhật (*) | ✓ | Chọn từ list | `nghi` | Giá trị: `nghi` (Nghỉ), `lam_ca_ngay` (Làm cả ngày), `lam_nua_ngay` (Làm nửa ngày). Mặc định là ngày nghỉ tuần. |
| Giờ công chuẩn/ngày (*) | ✓ | Số thực (giờ) | 8 | Trong khoảng 1 đến 24 giờ, bước 0.5. Mẫu số quy đổi lương ngày ra lương giờ. |

#### 2. Nghỉ phép có lương
| Cột | Bắt buộc | Kiểu dữ liệu | Mặc định | Mô tả / Ghi chú |
|---|---|---|---|---|
| Số ngày phép cơ bản/năm (*) | ✓ | Số nguyên | 12 | Số ngày phép cơ bản của người lao động làm đủ 12 tháng (Điều 113 BLLĐ 2019). |
| Số năm thâm niên thêm 1 ngày phép (*) | ✓ | Số nguyên | 5 | Cứ đủ số năm thâm niên này tại công ty thì được cộng thêm 1 ngày phép (Điều 114 BLLĐ 2019). |

#### 3. Tăng ca (Overtime)
| Cột | Bắt buộc | Kiểu dữ liệu | Mặc định | Mô tả / Ghi chú |
|---|---|---|---|---|
| TC Ngày thường - Ban ngày (*) | ✓ | Tỷ lệ % | 150 | Tỷ lệ trả lương làm thêm ngày thường ban ngày (Điều 98 BLLĐ 2019). |
| TC Ngày thường - Ban đêm (*) | ✓ | Tỷ lệ % | 200 | Gồm 150% + 30% làm đêm + 20% phụ trội làm thêm ban đêm. |
| TC Chủ nhật - Ban ngày (*) | ✓ | Tỷ lệ % | 200 | Tỷ lệ trả lương làm thêm ngày nghỉ hàng tuần ban ngày (Điều 98 BLLĐ 2019). |
| TC Chủ nhật - Ban đêm (*) | ✓ | Tỷ lệ % | 270 | Gồm 200% + 30% làm đêm + 20% phụ trội làm thêm ban đêm. |
| TC Ngày lễ - Ban ngày (*) | ✓ | Tỷ lệ % | 300 | Chưa kể tiền lương ngày nghỉ lễ hưởng nguyên lương (Điều 98 BLLĐ 2019). |
| TC Ngày lễ - Ban đêm (*) | ✓ | Tỷ lệ % | 390 | Gồm 300% + 30% làm đêm + 20% phụ trội làm thêm ban đêm. |
| Giới hạn giờ TC / tháng (*) | ✓ | Số nguyên (giờ) | 40 | Mốc trần giờ làm thêm tối đa trong tháng theo luật định (Điều 107 BLLĐ 2019). |
| Ngưỡng cảnh báo TC / năm (*) | ✓ | Số nguyên (giờ) | 200 | Mốc cảnh báo tổng giờ làm thêm trong năm theo luật định (Điều 107 BLLĐ 2019). |
| Ngưỡng vượt mức TC / năm (*) | ✓ | Số nguyên (giờ) | 300 | Mốc trần tối đa trong năm cho các ngành nghề đặc thù được phép (Điều 107 BLLĐ 2019). |

#### 4. Lương nền, Bảo hiểm & Công đoàn
| Cột | Bắt buộc | Kiểu dữ liệu | Mặc định | Mô tả / Ghi chú |
|---|---|---|---|---|
| Lương cơ sở (*) | ✓ | Số nguyên (VND) | 2.340.000 | Lương cơ sở làm căn cứ đóng BHXH/BHYT tối đa (trần 20 lần) và đoàn phí (NĐ 73/2024/NĐ-CP). |
| Lương tối thiểu vùng (*) | ✓ | Số nguyên (VND) | 4.960.000 | Sàn lương thỏa thuận vùng I (NĐ 74/2024/NĐ-CP), trần BHTN tối đa 20 lần. |
| BHXH - Nhân viên đóng (*) | ✓ | Tỷ lệ % | 8 | Tỷ lệ trừ vào lương nhân viên. |
| BHYT - Nhân viên đóng (*) | ✓ | Tỷ lệ % | 1.5 | Tỷ lệ trừ vào lương nhân viên. |
| BHTN - Nhân viên đóng (*) | ✓ | Tỷ lệ % | 1 | Tỷ lệ trừ vào lương nhân viên. |
| BHXH - Công ty đóng (*) | ✓ | Tỷ lệ % | 17.5 | Công ty nộp trên quỹ lương đóng BHXH (Hưu trí-tử tuất 14%, Ốm đau-thai sản 3%, TNLĐ-BNN 0.5%). |
| BHYT - Công ty đóng (*) | ✓ | Tỷ lệ % | 3 | Công ty nộp trên quỹ lương đóng BHXH. |
| BHTN - Công ty đóng (*) | ✓ | Tỷ lệ % | 1 | Công ty nộp trên quỹ lương đóng BHTN. |
| Tỷ lệ đoàn phí công đoàn (*) | ✓ | Tỷ lệ % | 1 | Tỷ lệ trích từ lương đoàn viên (tối đa bằng trần cơ sở). |
| Trần cơ sở đóng đoàn phí (*) | ✓ | Số nguyên (VND) | 234.000 | Tối đa 10% mức lương cơ sở (QĐ 1908/QĐ-TLĐ). |
| Tỷ lệ kinh phí công đoàn (*) | ✓ | Tỷ lệ % | 2 | Công ty đóng 2% trên quỹ tiền lương làm căn cứ đóng BHXH (Luật Công đoàn). |

#### 5. Thuế Thu nhập cá nhân (TNCN)
| Cột | Bắt buộc | Kiểu dữ liệu | Mặc định | Mô tả / Ghi chú |
|---|---|---|---|---|
| Giảm trừ bản thân (*) | ✓ | Số nguyên (VND) | 11.000.000 | Mức giảm trừ gia cảnh cho bản thân người nộp thuế/tháng (NQ 954/2020/UBTVQH14). |
| Giảm trừ người phụ thuộc (*) | ✓ | Số nguyên (VND) | 4.400.000 | Mức giảm trừ cho mỗi người phụ thuộc đã đăng ký/tháng (NQ 954/2020/UBTVQH14). |
| Biểu thuế TNCN 5 bậc (*) | ✓ | Mảng đối tượng | 5 bậc lũy tiến | Danh sách gồm 5 bậc thuế lũy tiến: bậc 1 đến 5tr (5%), bậc 2 cộng 5tr (10%), bậc 3 cộng 8tr (15%), bậc 4 cộng 14tr (20%), bậc 5 phần vượt 32tr (25%). Ràng buộc: thuế suất bậc sau phải lớn hơn bậc trước. |

### 6.7 Ca làm việc (Work Shift)

| Cột | Bắt buộc | Kiểu dữ liệu | Mô tả / Ghi chú |
|---|---|---|---|
| Mã ca (*) | ✓ | Chuỗi | Duy nhất toàn hệ thống. Tối đa 20 ký tự. Hệ thống tự sinh theo mẫu CA + 2 chữ số (`CA01`-`CA99`) hoặc người dùng tự nhập. Không được trùng lặp. |
| Tên ca (*) | ✓ | Chuỗi | Tên gọi ca làm việc (vd: Ca hành chính, Ca sáng, Ca đêm...). Tối đa 100 ký tự. |
| Giờ vào (*) | ✓ | Giờ (HH:mm) | Giờ bắt đầu làm việc theo định dạng 24h (vd: `08:00`, `22:00`). |
| Giờ ra (*) | ✓ | Giờ (HH:mm) | Giờ kết thúc làm việc theo định dạng 24h (vd: `17:00`, `06:00`). |
| Nghỉ giữa ca (*) | ✓ | Số nguyên (phút) | Thời gian nghỉ giữa ca được trừ khỏi giờ làm việc. Bước nhảy 15 phút. $\ge 0$. |
| Trạng thái | ✓ | Chọn từ list | `1` = Đang dùng (Hoạt động), `0` = Ngừng dùng. Mặc định `1`. |

**Các thuộc tính suy ra (Computed Properties):**
- **Ca qua đêm (`is_overnight`)**: Tự động xác định `true` nếu `gio_ra <= gio_vao` (ví dụ: `gio_vao = 22:00`, `gio_ra = 06:00`). Khi đó giờ ra thuộc ngày hôm sau.
- **Số giờ công thực tế (`working_hours`)**: Tính bằng:
  - Nếu ca bình thường: `(giờ ra - giờ vào) - (phút nghỉ / 60)`.
  - Nếu ca qua đêm: `(giờ ra + 24 - giờ vào) - (phút nghỉ / 60)`.

### 6.8 Lịch ngày lễ (Holiday)

| Cột | Bắt buộc | Kiểu dữ liệu | Mô tả / Ghi chú |
|---|---|---|---|
| Ngày (*) | ✓ | Ngày (YYYY-MM-DD) | Ngày diễn ra ngày lễ. |
| Tên ngày lễ (*) | ✓ | Chuỗi | Tên ngày lễ (vd: Tết Dương lịch, Quốc khánh...). Tối đa 150 ký tự. |
| Loại lễ (*) | ✓ | Chọn từ list | `le_quoc_gia` (Ngày lễ quốc gia theo luật), `le_am_lich` (Lễ tính theo lịch âm: Tết Nguyên đán, Giỗ Tổ), `le_cong_ty` (Ngày lễ hoặc kỷ niệm riêng của doanh nghiệp). |
| Chu kỳ lặp | ✓ | Boolean | `true` = Lặp lại hàng năm (tự động áp dụng cho mọi năm theo ngày dương lịch); `false` = Chỉ áp dụng cho năm chỉ định. **Ràng buộc: Nếu `loai = le_am_lich` thì bắt buộc `lap_lai_hang_nam = false`**. |
| Có lương (*) | ✓ | Boolean | `true` = Nghỉ có hưởng nguyên lương (Điều 112 BLLĐ); `false` = Nghỉ không lương. Mặc định `true`. |
| Ghi chú | | Chuỗi | Ghi chú thêm (tối đa 500 ký tự). |

**Ràng buộc không trùng lặp:** Không được phép tồn tại 2 bản ghi cùng ngày dương lịch (`ngay`) và cùng tên ngày lễ (`ten`) trong hệ thống.

## 7. Business Rules

**BR-hr-001** — Mã NV bắt buộc duy nhất toàn hệ thống. Người dùng có thể tự nhập hoặc để trống để hệ thống tự sinh (định dạng đề xuất tại A-hr-1, chờ xác nhận OQ-hr-1).

**BR-hr-002** — Mã phòng ban gắn trên Nhân viên phải tồn tại trong danh mục Phòng ban tại thời điểm lưu (toàn vẹn tham chiếu). Không cho lưu Nhân viên với phòng ban không tồn tại.

**BR-hr-003** — Trên một Hợp đồng, nếu có nhập Ngày kết thúc, giá trị phải SAU Ngày bắt đầu của chính hợp đồng đó. Bỏ trống Ngày kết thúc nghĩa là hợp đồng vô thời hạn (chưa xác định ngày kết thúc). *(Chuyển ngữ cảnh áp dụng từ Nhân viên sang Hợp đồng — 2026-09-05, giữ nguyên ID.)*

**BR-hr-004** — Khi Loại hợp đồng của một Hợp đồng = "HĐDV - Hợp đồng dịch vụ", hệ thống luôn ghi nhận Công đoàn = Không cho hợp đồng đó; không chấp nhận giá trị "Có" cho trường hợp này dù người dùng chọn khác. *(Chuyển ngữ cảnh áp dụng từ Nhân viên sang Hợp đồng — 2026-09-05, giữ nguyên ID.)*

**BR-hr-005** — Trên một Hợp đồng, khi không nhập tường minh: Trích đóng BHXH mặc định = Có; Tính thuế TNCN mặc định = Có. *(Chuyển ngữ cảnh áp dụng từ Nhân viên sang Hợp đồng — 2026-09-05, giữ nguyên ID.)*

**BR-hr-006** — "Tên nhân viên (tham khảo)" của Người phụ thuộc không phải cột dữ liệu lưu độc lập — luôn suy ra từ quan hệ FK tới Nhân viên (Mã NV) tại thời điểm truy xuất; không cho nhập hoặc sửa trực tiếp giá trị này.

**BR-hr-007** — Mỗi Người phụ thuộc bắt buộc gắn với đúng một Nhân viên (Mã NV không được rỗng).

**BR-hr-008** — Mã phòng ban duy nhất toàn hệ thống. Không cho xoá cứng một Phòng ban đang có ít nhất một Nhân viên tham chiếu — chỉ cho chuyển trạng thái "Ngừng hoạt động" (soft-delete). Phòng ban "Ngừng hoạt động" không hiển thị trong danh sách chọn khi tạo/sửa Nhân viên mới, nhưng Nhân viên đã gắn từ trước vẫn giữ nguyên liên kết.

**BR-hr-009** — Với khoảng đăng ký giảm trừ gia cảnh của Người phụ thuộc: nếu cả mốc "từ" và "đến" đều được nhập, mốc "từ" (năm, sau đó đến tháng) phải trước hoặc bằng mốc "đến". Mốc "đến" có thể bỏ trống, nghĩa là đang áp dụng, chưa có thời điểm kết thúc.

**BR-hr-010** — Email, CCCD, MST cá nhân, Số điện thoại của Nhân viên KHÔNG có ràng buộc duy nhất (unique) trong phạm vi tài liệu này — có thể trùng giữa các bản ghi (xem A-hr-4).

**BR-hr-011** — Phân quyền theo vai trò: ADMIN và HR có toàn quyền Create/Read/Update/Delete trên cả 5 entity (Phòng ban, Nhân viên, Hợp đồng, Người phụ thuộc, Tài liệu). ACCOUNTANT chỉ có quyền Read trên cả 5 entity (bao gồm các trường lương/BHXH/TNCN/Công đoàn của Hợp đồng, số tài khoản ngân hàng của Nhân viên, và Số hiệu tài liệu định danh của Tài liệu) phục vụ tính lương — không có quyền tạo/sửa/xoá. EMPLOYEE không có quyền truy cập module này trong phạm vi hiện tại. Mọi yêu cầu vượt quyền bị từ chối theo cơ chế đã định nghĩa ở FR-auth-012. *(Mở rộng từ 4 sang 5 entity sau khi thêm Tài liệu — 2026-09-05; quyền Read của ACCOUNTANT trên Tài liệu là mặc định tạm thời, đang chờ xác nhận tại OQ-hr-27 — có thể bị siết chặt hơn.)*

**BR-hr-012** — Lương trên Hợp đồng: Lương chính là trường bắt buộc trên mọi Hợp đồng, phải là số nguyên dương (đơn vị VND). Lương đóng BHXH bắt buộc nhập (cũng phải là số nguyên dương) CHỈ KHI Trích đóng BHXH = Có; khi Trích đóng BHXH = Không thì Lương đóng BHXH không áp dụng, không bắt buộc. (Resolved theo default — OQ-hr-20.)

**BR-hr-013** — Chồng lấn thời gian hợp đồng: hệ thống từ chối tạo hoặc sửa một Hợp đồng nếu khoảng [Ngày bắt đầu, Ngày kết thúc] của hợp đồng đó chồng lấn với khoảng thời gian của bất kỳ Hợp đồng nào khác đã có của CÙNG một Nhân viên (Ngày kết thúc bỏ trống được coi là tới vô cực khi kiểm tra chồng lấn). Hệ quả: tại một thời điểm, mỗi Nhân viên chỉ có tối đa một Hợp đồng "hiện hành". (Resolved theo default — OQ-hr-13.)

**BR-hr-014** — Giao dịch tạo Nhân viên kèm Hợp đồng: tạo mới một Nhân viên bắt buộc phải đi kèm tạo Hợp đồng đầu tiên trong cùng một giao dịch (all-or-nothing). Nếu dữ liệu Hợp đồng không hợp lệ hoặc thiếu trường bắt buộc (Mục 6.4), toàn bộ giao dịch bị huỷ và hệ thống KHÔNG tạo Nhân viên — không tồn tại Nhân viên "mồ côi" không có Hợp đồng nào. (Resolved — quyết định user 2026-09-05, OQ-hr-17.)

**BR-hr-015** — Mỗi Tài liệu bắt buộc gắn với đúng một Nhân viên (Mã NV không được rỗng) — tương tự BR-hr-007 áp dụng cho Người phụ thuộc.

**BR-hr-016** — Ngày cấp của một Tài liệu, nếu có nhập, không được là ngày trong tương lai (sau ngày hệ thống hiện tại).

**BR-hr-017** — Ngày hết hạn của một Tài liệu, nếu có nhập, phải SAU Ngày cấp khi cả hai đều có giá trị.

**BR-hr-018** — Loại tài liệu và Số hiệu trên một Tài liệu KHÔNG có ràng buộc duy nhất (unique) — cho phép trùng giữa các bản ghi của cùng một Nhân viên hoặc giữa các Nhân viên khác nhau (đồng nhất tinh thần BR-hr-010).

**BR-hr-019** — Cấu hình mặc định là bản ghi duy nhất toàn hệ thống (Singleton). Khởi tạo mặc định theo quy định hiện hành của pháp luật Việt Nam (BLLĐ 2019, NĐ 73/2024/NĐ-CP, NĐ 74/2024/NĐ-CP, NQ 954/2020/UBTVQH14). ADMIN có quyền chỉnh sửa hoặc bấm "Khôi phục mặc định" để đưa toàn bộ tham số về bộ chuẩn gốc ban đầu. Khi chỉnh sửa trên giao diện, thay đổi được gom lại thành một lần lưu (batch update) sau khi sửa đổi nhiều ô tham số liên quan.

**BR-hr-020** — Giờ công chuẩn/ngày trên Cấu hình mặc định phải là số dương nằm trong khoảng từ 1.0 đến 24.0 giờ.

**BR-hr-021** — Lương cơ sở và Lương tối thiểu vùng trên Cấu hình mặc định phải là số nguyên dương (> 0).

**BR-hr-022** — Biểu thuế lũy tiến TNCN: Thuế suất của bậc thuế sau phải lớn hơn thuế suất của bậc thuế liền trước (`thue_suat[i] > thue_suat[i-1]`). Nếu vi phạm quy tắc lũy tiến này, hệ thống từ chối lưu cấu hình.

**BR-hr-023** — Mã ca làm việc bắt buộc duy nhất toàn hệ thống (unique). Người dùng có thể tự nhập hoặc để hệ thống tự sinh theo quy ước CA + 2 chữ số (từ `CA01` đến `CA99`).

**BR-hr-024** — Giờ vào và Giờ ra của Ca làm việc là bắt buộc, đúng định dạng `HH:mm`. Nếu `gio_ra <= gio_vao` (vd: 22:00 đến 06:00), hệ thống tự động xác định là ca qua đêm (giờ ra thuộc ngày hôm sau).

**BR-hr-025** — Thời gian nghỉ giữa ca phải là số nguyên không âm (≥ 0 phút). Tổng thời gian làm việc thực tế của ca sau khi trừ thời gian nghỉ giữa ca phải lớn hơn 0 giờ.

**BR-hr-026** — Ngày lễ loại âm lịch (`le_am_lich`) KHÔNG ĐƯỢC PHÉP bật cờ lặp lại hàng năm theo dương lịch (`lap_lai_hang_nam = false`), vì ngày dương của Tết âm lịch và Giỗ Tổ thay đổi theo từng năm. Hệ thống tự động khóa/bỏ cờ lặp nếu loại lễ là âm lịch.

**BR-hr-027** — Ràng buộc duy nhất ngày lễ: Hệ thống từ chối tạo mới hoặc sửa ngày lễ nếu đã tồn tại một ngày lễ khác trùng cả ngày dương lịch (`ngay`) và tên ngày lễ (`ten`).

**BR-hr-028** — Tính năng "Tạo nhanh" ngày lễ: Khi sinh lịch nghỉ lễ chuẩn Việt Nam cho một năm chỉ định theo Điều 112 BLLĐ 2019, hệ thống tự động bỏ qua những ngày lễ đã có sẵn (trùng ngày và tên) và chỉ bổ sung những ngày còn thiếu, không báo lỗi đè.

## 8. Functional Requirements

### Phòng ban

**FR-hr-001** — Hệ thống cho phép ADMIN/HR tạo mới Phòng ban với Mã phòng ban và Tên phòng ban bắt buộc, Mô tả tuỳ chọn; trạng thái mặc định "Hoạt động".

**FR-hr-002** — Hệ thống cho phép xem danh sách và xem chi tiết Phòng ban, gồm cả trạng thái hoạt động.

**FR-hr-003** — Hệ thống cho phép ADMIN/HR cập nhật Tên phòng ban, Mô tả, và trạng thái (Hoạt động/Ngừng hoạt động).

**FR-hr-004** — Hệ thống chỉ cho xoá cứng một Phòng ban khi phòng ban đó chưa từng được gắn cho Nhân viên nào; nếu đang có Nhân viên tham chiếu thì chỉ cho chuyển trạng thái "Ngừng hoạt động" (BR-hr-008).

### Nhân viên

**FR-hr-005** — Hệ thống cho phép ADMIN/HR tạo mới Nhân viên đồng thời với Hợp đồng đầu tiên của Nhân viên đó trong CÙNG một giao dịch (BR-hr-014). Trường bắt buộc phía Nhân viên: Họ và tên (Mã NV có thể để trống để hệ thống tự sinh — BR-hr-001). Trường bắt buộc phía Hợp đồng: Loại hợp đồng, Kiểu lương, Lương chính, Ngày bắt đầu (Mục 6.4). Nếu dữ liệu Hợp đồng không hợp lệ, hệ thống từ chối toàn bộ giao dịch và KHÔNG tạo Nhân viên (FR-hr-016). *(Cập nhật 2026-09-05 cho khớp quyết định bắt buộc-tạo-kèm-hợp-đồng.)*

**FR-hr-006** — Khi tạo hoặc sửa Nhân viên, hệ thống validate toàn bộ ràng buộc trường theo Mục 6.2 (định dạng ngày, độ dài tối đa, giá trị enum hợp lệ, Mã phòng ban tồn tại) trước khi lưu; vi phạm bất kỳ ràng buộc nào thì từ chối lưu và trả lỗi tương ứng cho từng trường (Mục 10).

**FR-hr-008** — Hệ thống cho phép tìm kiếm/lọc danh sách Nhân viên (tối thiểu theo Mã NV, Họ tên, Phòng ban, Loại hợp đồng của Hợp đồng hiện hành, Chức vụ — OQ-hr-10) và xem chi tiết đầy đủ mọi trường của 1 Nhân viên theo đúng phân quyền tại Mục 5.

**FR-hr-009** — Hệ thống cho phép ADMIN/HR cập nhật mọi trường của Nhân viên theo Mục 6.2 (không còn bao gồm trường hợp đồng — nay quản lý riêng ở Hợp đồng, Mục 6.4), ngoại trừ Mã NV (không đổi sau khi tạo).

**FR-hr-010** — Hệ thống cho phép ADMIN/HR xoá Nhân viên; hệ quả đối với Người phụ thuộc, Hợp đồng và Tài liệu liên quan tuân theo quyết định tại OQ-hr-4 (đã mở rộng phạm vi lần 2, bao gồm cả Tài liệu — 2026-09-05) — trong mọi trường hợp, hệ thống không được để Người phụ thuộc, Hợp đồng hoặc Tài liệu tham chiếu tới một Nhân viên không còn tồn tại.

### Hợp đồng

**FR-hr-016** — Hệ thống đảm bảo giao dịch tạo Nhân viên kèm Hợp đồng đầu tiên là all-or-nothing (BR-hr-014): nếu bất kỳ ràng buộc bắt buộc nào của Hợp đồng bị vi phạm (Mục 6.4, Mục 10 Error Matrix), toàn bộ giao dịch bị huỷ, hệ thống không lưu Nhân viên.

**FR-hr-007** — Khi tạo/sửa Hợp đồng với Loại hợp đồng = HĐDV, hệ thống tự động ghi Công đoàn = Không cho hợp đồng đó và không cho người dùng đổi thành Có (BR-hr-004). *(Chuyển từ mục Nhân viên sang mục Hợp đồng — 2026-09-05, giữ nguyên ID.)*

**FR-hr-017** — Hệ thống cho phép ADMIN/HR tạo mới một Hợp đồng cho một Nhân viên đã tồn tại (áp dụng khi gia hạn, đổi loại hợp đồng, đổi lương, hoặc bất kỳ thay đổi nào khác ngoài lúc tạo Nhân viên lần đầu — OQ-hr-16); hệ thống validate đầy đủ ràng buộc trường (Mục 6.4) và ràng buộc không chồng lấn với các Hợp đồng khác của cùng Nhân viên (BR-hr-013) trước khi lưu.

**FR-hr-018** — Hệ thống cho phép xem toàn bộ lịch sử Hợp đồng của một Nhân viên (danh sách tất cả Hợp đồng, sắp xếp theo Ngày bắt đầu) và xác định/hiển thị rõ Hợp đồng nào đang "hiện hành" tại thời điểm xem, suy ra từ so sánh Ngày bắt đầu/Ngày kết thúc với ngày hiện tại (OQ-hr-14) — theo đúng phân quyền tại Mục 5.

**FR-hr-019** — Hệ thống cho phép ADMIN/HR cập nhật một Hợp đồng đã tồn tại, bao gồm chấm dứt sớm bằng cách sửa Ngày kết thúc thành giá trị sớm hơn dự kiến ban đầu kèm nhập Lý do chấm dứt (tuỳ chọn — OQ-hr-15); mọi thay đổi vẫn phải thoả ràng buộc trường (Mục 6.4) và được kiểm tra lại ràng buộc không chồng lấn (BR-hr-013).

### Người phụ thuộc

**FR-hr-011** — Hệ thống cho phép tạo mới Người phụ thuộc khi chọn đúng một Nhân viên đang tồn tại (Mã NV) và nhập Họ tên NPT; các trường còn lại theo Mục 6.3 là tuỳ chọn.

**FR-hr-012** — Hệ thống cho phép xem danh sách Người phụ thuộc theo từng Nhân viên; khi hiển thị, "Tên nhân viên (tham khảo)" được suy ra từ quan hệ FK (BR-hr-006), không đọc từ cột lưu riêng.

**FR-hr-013** — Hệ thống cho phép cập nhật và xoá một Người phụ thuộc; xoá một Người phụ thuộc không ảnh hưởng tới Nhân viên liên quan hay các Người phụ thuộc khác.

**FR-hr-014** — Khi tạo/sửa Người phụ thuộc, hệ thống validate khoảng đăng ký giảm trừ gia cảnh (tháng trong 1-12, năm trong 2000-2100, mốc từ ≤ mốc đến — BR-hr-009) trước khi lưu.

### Tài liệu

**FR-hr-020** — Hệ thống cho phép ADMIN/HR tạo mới một bản ghi Tài liệu khi chọn đúng một Nhân viên đang tồn tại (Mã NV) và nhập Loại tài liệu + Số hiệu (bắt buộc); các trường còn lại theo Mục 6.5 (Ngày cấp, Nơi cấp, Ngày hết hạn, Ghi chú, Đường dẫn tài liệu) là tuỳ chọn.

**FR-hr-021** — Hệ thống cho phép xem danh sách Tài liệu theo từng Nhân viên (tối thiểu lọc theo Loại tài liệu) và xem chi tiết một bản ghi Tài liệu, theo đúng phân quyền tại Mục 5.

**FR-hr-022** — Hệ thống cho phép ADMIN/HR cập nhật và xoá một bản ghi Tài liệu; xoá một Tài liệu không ảnh hưởng tới Nhân viên liên quan hay các bản ghi Tài liệu khác của nhân viên đó.

**FR-hr-023** — Khi tạo/sửa Tài liệu, hệ thống validate ràng buộc trường theo Mục 6.5 (Loại tài liệu và Số hiệu bắt buộc, Ngày cấp không ở tương lai — BR-hr-016, Ngày hết hạn sau Ngày cấp — BR-hr-017, độ dài tối đa) trước khi lưu; vi phạm bất kỳ ràng buộc nào thì từ chối lưu và trả lỗi tương ứng (Mục 10).

### Cấu hình mặc định

**FR-hr-024** — Hệ thống cho phép ADMIN, HR, ACCOUNTANT xem toàn bộ thông tin Cấu hình mặc định hiện tại của hệ thống (ngày/giờ công, nghỉ phép, hệ số tăng ca, bảo hiểm, công đoàn, thuế TNCN).

**FR-hr-025** — Hệ thống cho phép ADMIN cập nhật Cấu hình mặc định; hệ thống validate giờ công chuẩn (1–24h — BR-hr-020), lương cơ sở/lương tối thiểu vùng > 0 (BR-hr-021), và tính lũy tiến tăng dần của bậc thuế (BR-hr-022) trước khi lưu.

**FR-hr-026** — Hệ thống cho phép ADMIN thực hiện chức năng "Khôi phục mặc định", đưa toàn bộ tham số cấu hình về bộ giá trị mẫu ban đầu theo quy định chuẩn của pháp luật Việt Nam (BR-hr-019).

### Ca làm việc

**FR-hr-027** — Hệ thống cho phép ADMIN/HR tạo mới Ca làm việc; người dùng có thể nhập Mã ca hoặc để hệ thống tự sinh mã theo dạng `CA01`-`CA99` (BR-hr-023); validate bắt buộc Tên ca, Giờ vào, Giờ ra, Nghỉ giữa ca ≥ 0 (BR-hr-024, BR-hr-025).

**FR-hr-028** — Hệ thống cho phép xem danh sách toàn bộ Ca làm việc, bao gồm trạng thái (Đang dùng/Ngừng), cờ ca qua đêm tự động xác định, và số giờ công thực tế của ca.

**FR-hr-029** — Hệ thống cho phép ADMIN/HR cập nhật thông tin Ca làm việc (Tên ca, Giờ vào, Giờ ra, Nghỉ giữa ca, Trạng thái) và xóa ca làm việc khi chưa có ràng buộc sử dụng.

### Lịch ngày lễ

**FR-hr-030** — Hệ thống cho phép ADMIN/HR tạo mới và cập nhật từng ngày lễ; validate bắt buộc Ngày, Tên ngày lễ, Loại lễ; tự động tắt/khóa cờ lặp lại hàng năm nếu Loại lễ là âm lịch (BR-hr-026); kiểm tra chống trùng lặp ngày + tên (BR-hr-027).

**FR-hr-031** — Hệ thống cho phép xem danh sách Lịch ngày lễ với các bộ lọc: "Năm nay" (ngày thuộc năm dương lịch hiện tại hoặc có cờ lặp hàng năm), "Hàng năm" (chỉ ngày có cờ lặp hàng năm), hoặc "Tất cả"; hiển thị kèm thứ trong tuần và cờ có hưởng lương.

**FR-hr-032** — Hệ thống cho phép ADMIN/HR xóa một ngày lễ khỏi lịch nghỉ lễ.

**FR-hr-033** — Hệ thống cung cấp chức năng "Tạo nhanh", cho phép ADMIN/HR chọn một năm và tự động tạo 11 ngày nghỉ lễ chuẩn Việt Nam theo Điều 112 BLLĐ 2019; hệ thống tự động bỏ qua những ngày đã tồn tại và chỉ bổ sung các ngày còn thiếu (BR-hr-028).

### Phân quyền

**FR-hr-015** — Trước khi thực hiện bất kỳ hành động Create/Read/Update/Delete nào trên 8 entity, hệ thống kiểm tra vai trò người dùng theo ma trận tại Mục 5 (BR-hr-011); yêu cầu vượt quyền bị từ chối.

## 9. Non-functional Requirements

**NFR-hr-001** — Toàn vẹn dữ liệu: mọi ràng buộc validate (định dạng, độ dài, FK) phải được hệ thống kiểm tra trước khi lưu, không chỉ ở giao diện nhập liệu.

**NFR-hr-002** — Hiệu năng tra cứu: chức năng tìm kiếm/lọc danh sách Nhân viên và Người phụ thuộc phải phản hồi nhanh và ổn định khi số lượng bản ghi tăng theo thời gian (chưa có ngưỡng cụ thể — đề xuất định lượng khi có ước tính quy mô dữ liệu thực tế).

**NFR-hr-003** — Bảo mật dữ liệu nhạy cảm: các trường lương/BHXH/TNCN/Công đoàn của Hợp đồng, số tài khoản ngân hàng của Nhân viên, và Số hiệu tài liệu định danh (CCCD/Hộ chiếu...) của Tài liệu chỉ trả về cho vai trò được phép đọc theo Mục 5 — kể cả trong kết quả tìm kiếm/danh sách, lịch sử Hợp đồng và danh sách Tài liệu. ACCOUNTANT giữ nguyên quyền Read trên Tài liệu như 4 entity còn lại, không siết chặt hơn (OQ-hr-27 resolved).

**NFR-hr-004** — Nhất quán tham chiếu: khi một Phòng ban chuyển "Ngừng hoạt động", dữ liệu Nhân viên đã gắn với phòng ban đó không được mất hoặc hiển thị sai lệch.

**NFR-hr-005** — Khả năng mở rộng danh mục: các trường "chọn từ list" dạng free-text có gợi ý (Ngân hàng, Quan hệ NPT, Loại tài liệu — xem A-hr-2, A-hr-13) cho phép thêm giá trị mới mà không cần thay đổi cấu trúc hệ thống.

**NFR-hr-006** — Tuân thủ bảo vệ dữ liệu cá nhân: Số hiệu tài liệu định danh (CCCD/Hộ chiếu) lưu trong Tài liệu là dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân — hệ thống phải đảm bảo chỉ vai trò được phép mới truy cập được (Mục 5, NFR-hr-003), không hiển thị/xuất ra ngoài phạm vi cho phép; biện pháp kỹ thuật cụ thể (mã hoá lưu trữ, ẩn một phần số hiệu khi hiển thị...) do Architect quyết định khi thiết kế.

## 10. Error Matrix

| ID | Tình huống | Wording hiển thị (tiếng Việt) | Hệ quả nghiệp vụ |
|---|---|---|---|
| E-hr-001 | Tạo/sửa Nhân viên thiếu Họ và tên | "Họ và tên không được để trống." | Từ chối lưu |
| E-hr-002 | Tạo/sửa Hợp đồng thiếu Số hợp đồng | "Số hợp đồng không được để trống." | Từ chối lưu |
| E-hr-003 | Tạo/sửa Hợp đồng không chọn Loại hợp đồng | "Vui lòng chọn Loại hợp đồng." | Từ chối lưu |
| E-hr-004 | Tạo/sửa Hợp đồng không chọn Kiểu lương | "Vui lòng chọn Kiểu lương (Gross/Net)." | Từ chối lưu |
| E-hr-005 | Tạo/sửa Hợp đồng thiếu Ngày bắt đầu | "Ngày bắt đầu không được để trống." | Từ chối lưu |
| E-hr-006 | Ngày kết thúc ≤ Ngày bắt đầu | "Ngày kết thúc phải sau Ngày bắt đầu." | Từ chối lưu (BR-hr-003) |
| E-hr-007 | Mã phòng ban không tồn tại trong danh mục | "Phòng ban không tồn tại. Vui lòng chọn phòng ban hợp lệ." | Từ chối lưu (BR-hr-002) |
| E-hr-008 | Mã NV nhập tay bị trùng | "Mã NV đã tồn tại. Vui lòng chọn mã khác hoặc để trống để hệ thống tự sinh." | Từ chối lưu (BR-hr-001) |
| E-hr-009 | Tạo Người phụ thuộc không chọn Nhân viên | "Vui lòng chọn Nhân viên." | Từ chối lưu (BR-hr-007) |
| E-hr-010 | Tạo/sửa Người phụ thuộc thiếu Họ tên NPT | "Họ tên người phụ thuộc không được để trống." | Từ chối lưu |
| E-hr-011 | ĐK từ tháng/đến tháng ngoài khoảng 1-12 | "Tháng phải từ 1 đến 12." | Từ chối lưu |
| E-hr-012 | ĐK từ năm/đến năm ngoài khoảng 2000-2100 | "Năm phải từ 2000 đến 2100." | Từ chối lưu |
| E-hr-013 | Mốc ĐK từ sau mốc ĐK đến | "Khoảng đăng ký giảm trừ không hợp lệ: mốc bắt đầu phải trước mốc kết thúc." | Từ chối lưu (BR-hr-009) |
| E-hr-014 | Xoá cứng Phòng ban đang có Nhân viên | "Không thể xoá phòng ban đang có nhân viên. Hãy chuyển sang Ngừng hoạt động hoặc chuyển nhân viên sang phòng ban khác trước." | Từ chối xoá cứng (BR-hr-008) |
| E-hr-015 | Mã phòng ban nhập tay bị trùng | "Mã phòng ban đã tồn tại." | Từ chối lưu |
| E-hr-016 | Người dùng không đủ quyền thao tác | "Bạn không có quyền thực hiện chức năng này." | Từ chối (FR-hr-015) |
| E-hr-017 | Tạo/sửa Hợp đồng thiếu Lương chính | "Lương chính không được để trống." | Từ chối lưu (BR-hr-012) |
| E-hr-018 | Lương chính hoặc Lương đóng BHXH ≤ 0 | "Lương phải là số dương." | Từ chối lưu (BR-hr-012) |
| E-hr-019 | Trích đóng BHXH = Có nhưng thiếu Lương đóng BHXH | "Lương đóng BHXH không được để trống khi có trích đóng BHXH." | Từ chối lưu (BR-hr-012) |
| E-hr-020 | Khoảng thời gian Hợp đồng chồng lấn với Hợp đồng khác của cùng Nhân viên | "Khoảng thời gian hợp đồng bị trùng với một hợp đồng khác đã có của nhân viên này." | Từ chối lưu (BR-hr-013) |
| E-hr-021 | Tạo Nhân viên nhưng dữ liệu Hợp đồng đi kèm không hợp lệ/thiếu bắt buộc | "Không thể tạo nhân viên vì thông tin hợp đồng đi kèm không hợp lệ." | Huỷ toàn bộ giao dịch, không tạo Nhân viên (BR-hr-014) |
| E-hr-022 | Tạo/sửa Tài liệu không chọn Nhân viên | "Vui lòng chọn Nhân viên." | Từ chối lưu (BR-hr-015) |
| E-hr-023 | Tạo/sửa Tài liệu không chọn Loại tài liệu | "Vui lòng chọn Loại tài liệu." | Từ chối lưu |
| E-hr-024 | Tạo/sửa Tài liệu thiếu Số hiệu | "Số hiệu không được để trống." | Từ chối lưu |
| E-hr-025 | Ngày cấp của Tài liệu là ngày trong tương lai | "Ngày cấp không được lớn hơn ngày hiện tại." | Từ chối lưu (BR-hr-016) |
| E-hr-026 | Ngày hết hạn ≤ Ngày cấp (khi cả hai đều có giá trị) | "Ngày hết hạn phải sau Ngày cấp." | Từ chối lưu (BR-hr-017) |
| E-hr-027 | Giờ công chuẩn/ngày không trong khoảng 1–24 | "Giờ công chuẩn/ngày phải nằm trong khoảng 1–24 giờ." | Từ chối lưu (BR-hr-020) |
| E-hr-028 | Lương cơ sở hoặc Lương tối thiểu vùng ≤ 0 | "Lương cơ sở và lương tối thiểu vùng phải lớn hơn 0." | Từ chối lưu (BR-hr-021) |
| E-hr-029 | Thuế suất bậc sau ≤ bậc trước | "Thuế suất bậc sau phải cao hơn bậc liền trước." | Từ chối lưu (BR-hr-022) |
| E-hr-030 | Tạo/sửa Ca làm việc thiếu Tên ca | "Tên ca không được để trống." | Từ chối lưu |
| E-hr-031 | Tạo/sửa Ca làm việc thiếu Giờ vào hoặc Giờ ra | "Ca làm việc phải có giờ vào và giờ ra." | Từ chối lưu (BR-hr-024) |
| E-hr-032 | Nghỉ giữa ca là số âm | "Nghỉ giữa ca không được là số âm." | Từ chối lưu (BR-hr-025) |
| E-hr-033 | Mã ca làm việc bị trùng | "Mã ca làm việc đã tồn tại." | Từ chối lưu (BR-hr-023) |
| E-hr-034 | Tạo/sửa Ngày lễ thiếu Tên hoặc Ngày | "Tên ngày lễ và ngày không được để trống." | Từ chối lưu |
| E-hr-035 | Lễ âm lịch nhưng bật lặp lại hàng năm | "Lễ theo âm lịch không lặp lại theo dương lịch được. Hãy tạo lại cho từng năm." | Từ chối lưu (BR-hr-026) |
| E-hr-036 | Ngày lễ bị trùng ngày và tên | "Ngày này đã có ngày lễ cùng tên." | Từ chối lưu (BR-hr-027) |

## 11. Use Cases (tóm tắt)

| ID | Actor | Mục tiêu | Luồng chính (tóm tắt) | Requirement liên quan |
|---|---|---|---|---|
| UC-hr-01 | ADMIN/HR | Tạo phòng ban mới | Nhập Mã + Tên (+Mô tả) → hệ thống kiểm tra trùng mã → lưu, trạng thái mặc định Hoạt động | FR-hr-001, E-hr-015 |
| UC-hr-02 | ADMIN/HR | Ngừng hoạt động phòng ban | Chọn phòng ban → đổi trạng thái Ngừng hoạt động → phòng ban biến mất khỏi dropdown tạo mới, Nhân viên cũ vẫn giữ liên kết | FR-hr-003, FR-hr-004, BR-hr-008 |
| UC-hr-03 | ADMIN/HR | Tạo hồ sơ nhân viên mới kèm Hợp đồng đầu tiên | Nhập thông tin Nhân viên (bỏ trống Mã NV để tự sinh) + thông tin Hợp đồng đầu tiên (Loại hợp đồng/Kiểu lương/Lương chính/Ngày bắt đầu...) → chọn Phòng ban tồn tại → hệ thống validate cả 2 phần trong 1 giao dịch, tự set Công đoàn nếu HĐDV → hợp lệ thì lưu cả Nhân viên và Hợp đồng; nếu Hợp đồng không hợp lệ thì huỷ toàn bộ, không tạo Nhân viên | FR-hr-005, FR-hr-007, FR-hr-016, BR-hr-001…004, BR-hr-012…014, E-hr-001…008, E-hr-017…021 |
| UC-hr-04 | ADMIN/HR | Cập nhật hồ sơ nhân viên | Mở hồ sơ → sửa trường (trừ Mã NV) → validate lại → lưu | FR-hr-009 |
| UC-hr-05 | ADMIN/HR/ACCOUNTANT | Tra cứu danh sách nhân viên | Nhập điều kiện lọc → hệ thống trả danh sách phù hợp, ẩn/hiện trường theo quyền | FR-hr-008, NFR-hr-003 |
| UC-hr-06 | ADMIN/HR | Thêm người phụ thuộc cho nhân viên | Chọn Nhân viên → nhập Họ tên NPT (+ thông tin khác + khoảng ĐK) → validate khoảng ĐK → lưu | FR-hr-011, FR-hr-014, BR-hr-007, BR-hr-009 |
| UC-hr-07 | ADMIN/HR/ACCOUNTANT | Xem người phụ thuộc theo nhân viên | Chọn Nhân viên → hệ thống liệt kê NPT, "Tên nhân viên" suy ra từ quan hệ FK | FR-hr-012, BR-hr-006 |
| UC-hr-08 | ADMIN/HR | Xoá người phụ thuộc | Chọn NPT → xác nhận xoá → xoá, không ảnh hưởng Nhân viên | FR-hr-013 |
| UC-hr-09 | ADMIN/HR | Xoá nhân viên | Chọn Nhân viên → xác nhận xoá → hệ quả với Người phụ thuộc và Hợp đồng liên quan theo quyết định OQ-hr-4 | FR-hr-010 |
| UC-hr-10 | ADMIN/HR | Thêm Hợp đồng mới cho nhân viên đã tồn tại | Chọn Nhân viên đã tồn tại → nhập thông tin Hợp đồng mới (gia hạn/đổi loại/đổi lương) → hệ thống validate ràng buộc trường + kiểm tra không chồng lấn với Hợp đồng khác của cùng nhân viên → lưu thành một bản ghi Hợp đồng mới, độc lập, giữ nguyên các Hợp đồng cũ làm lịch sử | FR-hr-017, BR-hr-012, BR-hr-013, E-hr-017…021 |
| UC-hr-11 | ADMIN/HR/ACCOUNTANT | Xem lịch sử và Hợp đồng hiện hành của nhân viên | Chọn Nhân viên → hệ thống liệt kê toàn bộ Hợp đồng theo thời gian, đánh dấu rõ Hợp đồng nào đang hiện hành (suy ra từ so sánh ngày) | FR-hr-018, OQ-hr-14 |
| UC-hr-12 | ADMIN/HR | Chấm dứt hợp đồng sớm | Mở Hợp đồng đang hiện hành của một Nhân viên → sửa Ngày kết thúc thành ngày sớm hơn dự kiến ban đầu → nhập Lý do chấm dứt (tuỳ chọn) → hệ thống validate lại ràng buộc trường/chồng lấn → lưu | FR-hr-019, BR-hr-013 |
| UC-hr-13 | ADMIN/HR | Thêm Tài liệu cho nhân viên | Chọn Nhân viên → chọn Loại tài liệu + nhập Số hiệu (+ Ngày cấp/Nơi cấp/Ngày hết hạn/Ghi chú/Đường dẫn tuỳ chọn) → hệ thống validate → lưu | FR-hr-020, FR-hr-023, BR-hr-015…018 |
| UC-hr-14 | ADMIN/HR/ACCOUNTANT | Xem danh sách Tài liệu theo nhân viên | Chọn Nhân viên → hệ thống liệt kê toàn bộ Tài liệu, ẩn/hiện trường nhạy cảm theo phân quyền | FR-hr-021, NFR-hr-003 |
| UC-hr-15 | ADMIN/HR | Cập nhật/Xoá Tài liệu | Chọn một bản ghi Tài liệu → sửa (validate lại) hoặc xoá → lưu/xoá, không ảnh hưởng Nhân viên hay Tài liệu khác | FR-hr-022, FR-hr-023 |
| UC-hr-16 | ADMIN | Xem và cập nhật Cấu hình mặc định | Mở tab Thiết lập chung → xem/sửa các tham số ngày công, bảo hiểm, thuế... → kiểm tra cảnh báo → bấm Lưu cấu hình → hệ thống validate (giờ công 1-24h, lương > 0, thuế lũy tiến) → lưu thành công | FR-hr-024, FR-hr-025, BR-hr-019…022, E-hr-027…029 |
| UC-hr-17 | ADMIN | Khôi phục cấu hình mặc định gốc | Bấm nút Khôi phục mặc định → hệ thống nạp lại bộ tham số chuẩn ban đầu theo luật định → bấm Lưu cấu hình để áp dụng | FR-hr-026, BR-hr-019 |
| UC-hr-18 | ADMIN/HR | Quản lý Ca làm việc (Thêm/Sửa/Xóa) | Mở danh sách ca → bấm Thêm ca (hoặc Sửa/Xóa) → nhập Tên, Giờ vào, Giờ ra, Nghỉ giữa ca → hệ thống tự tính số giờ công và gắn cờ ca qua đêm → lưu bản ghi ca ngay lập tức | FR-hr-027…029, BR-hr-023…025, E-hr-030…033 |
| UC-hr-19 | ADMIN/HR | Quản lý Lịch ngày lễ (Thêm/Sửa/Xóa) | Chọn tab Lịch ngày lễ → lọc theo Năm nay/Hàng năm/Tất cả → thêm ngày lễ mới (chọn Loại lễ, Ngày, cờ lặp, cờ có lương) → hệ thống validate không trùng và chặn lặp âm lịch → lưu | FR-hr-030…032, BR-hr-026, BR-hr-027, E-hr-034…036 |
| UC-hr-20 | ADMIN/HR | Tạo nhanh lịch nghỉ lễ chuẩn Việt Nam | Bấm nút Tạo nhanh → chọn Năm cần tạo → hệ thống hiển thị danh sách xem trước 11 ngày nghỉ lễ chuẩn theo BLLĐ 2019 và đánh dấu các ngày đã có → bấm Tạo → hệ thống thêm các ngày còn thiếu, bỏ qua ngày trùng | FR-hr-033, BR-hr-028 |

## 12. Acceptance Criteria (minh hoạ — Given/When/Then)

Chỉ minh hoạ các quy tắc có logic rẽ nhánh/nghiệp vụ đáng chú ý. Các validate bắt buộc/định dạng/độ dài cơ bản khác xem trực tiếp Mục 10 Error Matrix — không lặp lại dưới dạng Given/When/Then vì đã 1-1 rõ ràng với bảng lỗi.

**AC-hr-01** (FR-hr-005, FR-hr-016, BR-hr-001 — auto-gen Mã NV kèm Hợp đồng)
- Given người dùng đang tạo mới Nhân viên kèm Hợp đồng đầu tiên hợp lệ, và để trống Mã NV
- When người dùng lưu hồ sơ với đầy đủ các trường bắt buộc còn lại của cả Nhân viên và Hợp đồng
- Then hệ thống tự sinh Mã NV theo định dạng quy ước (A-hr-1), đảm bảo không trùng Mã NV đã tồn tại, tạo đồng thời Hợp đồng đầu tiên, và lưu thành công

**AC-hr-02** (FR-hr-007, BR-hr-004 — Công đoàn theo HĐDV)
- Given người dùng chọn Loại hợp đồng = "HĐDV - Hợp đồng dịch vụ" khi tạo/sửa một Hợp đồng
- When người dùng chọn Công đoàn = "Có" và lưu
- Then hệ thống ghi nhận Công đoàn = "Không" cho hợp đồng đó (không chấp nhận "Có" khi Loại hợp đồng là HĐDV)

**AC-hr-03** (FR-hr-006, BR-hr-002, E-hr-007 — toàn vẹn FK Phòng ban)
- Given Mã phòng ban nhập/chọn không tồn tại trong danh mục Phòng ban
- When người dùng lưu hồ sơ Nhân viên
- Then hệ thống từ chối lưu và hiển thị lỗi E-hr-007

**AC-hr-04** (FR-hr-017, FR-hr-019, BR-hr-003, E-hr-006 — Ngày kết thúc Hợp đồng)
- Given Ngày kết thúc của một Hợp đồng được nhập và có giá trị trước hoặc bằng Ngày bắt đầu
- When người dùng lưu Hợp đồng đó
- Then hệ thống từ chối lưu và hiển thị lỗi E-hr-006

**AC-hr-05** (FR-hr-012, BR-hr-006 — Tên nhân viên tham khảo)
- Given một Người phụ thuộc đã gắn với một Nhân viên
- When người dùng xem danh sách/chi tiết Người phụ thuộc đó
- Then hệ thống hiển thị "Tên nhân viên (tham khảo)" lấy theo tên hiện tại của Nhân viên qua quan hệ FK, không đọc từ cột lưu riêng

**AC-hr-06** (FR-hr-004, BR-hr-008 — Xoá Phòng ban)
- Given một Phòng ban đang có ít nhất một Nhân viên tham chiếu
- When người dùng thực hiện xoá cứng Phòng ban đó
- Then hệ thống từ chối, hiển thị lỗi E-hr-014, và gợi ý chuyển trạng thái "Ngừng hoạt động"

**AC-hr-07** (FR-hr-015, BR-hr-011 — RBAC Accountant read-only)
- Given người dùng đăng nhập với vai trò ACCOUNTANT
- When người dùng gửi yêu cầu tạo/sửa/xoá Nhân viên, Phòng ban, Hợp đồng hoặc Người phụ thuộc
- Then hệ thống từ chối với lỗi E-hr-016 (vượt quyền); riêng yêu cầu xem (Read) vẫn được phép

**AC-hr-08** (FR-hr-014, BR-hr-009 — khoảng ĐK giảm trừ)
- Given mốc ĐK từ (tháng/năm) muộn hơn mốc ĐK đến (tháng/năm) đã có giá trị
- When người dùng lưu Người phụ thuộc
- Then hệ thống từ chối lưu và hiển thị lỗi E-hr-013

**AC-hr-09** (BR-hr-012, E-hr-017/E-hr-018/E-hr-019 — Lương bắt buộc/dương/điều kiện)
- Given người dùng đang tạo/sửa một Hợp đồng
- When người dùng để trống Lương chính, hoặc nhập Lương chính/Lương đóng BHXH ≤ 0, hoặc để trống Lương đóng BHXH trong khi Trích đóng BHXH = Có
- Then hệ thống từ chối lưu và hiển thị lỗi tương ứng (E-hr-017, E-hr-018 hoặc E-hr-019)

**AC-hr-10** (BR-hr-013, E-hr-020 — chồng lấn thời gian Hợp đồng)
- Given một Nhân viên đã có một Hợp đồng với khoảng [Ngày bắt đầu, Ngày kết thúc] xác định
- When người dùng tạo hoặc sửa một Hợp đồng khác của CÙNG Nhân viên có khoảng thời gian chồng lấn với khoảng đã có
- Then hệ thống từ chối lưu và hiển thị lỗi E-hr-020

**AC-hr-11** (FR-hr-016, BR-hr-014, E-hr-021 — all-or-nothing tạo Nhân viên kèm Hợp đồng)
- Given người dùng đang tạo mới một Nhân viên kèm thông tin Hợp đồng đầu tiên
- When dữ liệu Hợp đồng vi phạm bất kỳ ràng buộc bắt buộc nào (Mục 6.4)
- Then hệ thống huỷ toàn bộ giao dịch, không tạo Nhân viên, và hiển thị lỗi E-hr-021 kèm chi tiết lỗi của từng trường Hợp đồng vi phạm

**AC-hr-12** (FR-hr-019 — chấm dứt hợp đồng sớm)
- Given một Hợp đồng đang hiện hành với Ngày kết thúc dự kiến ban đầu (hoặc bỏ trống)
- When người dùng sửa Ngày kết thúc thành một giá trị sớm hơn và nhập Lý do chấm dứt
- Then hệ thống chấp nhận, lưu Ngày kết thúc mới và Lý do chấm dứt; Lý do chấm dứt không phải trường bắt buộc

**AC-hr-13** (FR-hr-020, FR-hr-023 — bắt buộc Loại tài liệu + Số hiệu)
- Given người dùng đang tạo mới một Tài liệu cho một Nhân viên đã chọn
- When người dùng để trống Loại tài liệu hoặc để trống Số hiệu rồi lưu
- Then hệ thống từ chối lưu và hiển thị lỗi tương ứng (E-hr-023 hoặc E-hr-024)

**AC-hr-14** (BR-hr-016, E-hr-025 — Ngày cấp không ở tương lai)
- Given người dùng nhập Ngày cấp cho một Tài liệu
- When Ngày cấp đó là một ngày sau ngày hệ thống hiện tại
- Then hệ thống từ chối lưu và hiển thị lỗi E-hr-025

**AC-hr-15** (BR-hr-017, E-hr-026 — Ngày hết hạn sau Ngày cấp)
- Given một Tài liệu có cả Ngày cấp và Ngày hết hạn được nhập
- When Ngày hết hạn có giá trị trước hoặc bằng Ngày cấp
- Then hệ thống từ chối lưu và hiển thị lỗi E-hr-026

**AC-hr-16** (BR-hr-018 — không ràng buộc duy nhất Loại tài liệu + Số hiệu)
- Given một Nhân viên đã có sẵn một bản ghi Tài liệu với Loại tài liệu và Số hiệu xác định
- When người dùng tạo thêm một bản ghi Tài liệu khác (cùng hoặc khác Nhân viên) với CÙNG Loại tài liệu và CÙNG Số hiệu
- Then hệ thống vẫn chấp nhận lưu bình thường, không coi đây là lỗi trùng lặp

**AC-hr-17** (FR-hr-015 mở rộng, BR-hr-011 — RBAC cho Tài liệu)
- Given người dùng đăng nhập với vai trò ACCOUNTANT
- When người dùng gửi yêu cầu tạo/sửa/xoá một Tài liệu
- Then hệ thống từ chối với lỗi E-hr-016 (vượt quyền); yêu cầu xem (Read) vẫn được phép theo ma trận hiện tại (Mục 5)

**AC-hr-18** (FR-hr-025, BR-hr-022, E-hr-029 — Biểu thuế lũy tiến TNCN tăng dần)
- Given người dùng đang cập nhật Cấu hình mặc định
- When người dùng nhập thuế suất bậc sau nhỏ hơn hoặc bằng bậc liền trước (vd: bậc 2 có thuế suất 5% trong khi bậc 1 là 5%)
- Then hệ thống từ chối lưu và hiển thị lỗi E-hr-029

**AC-hr-19** (FR-hr-027, BR-hr-024, BR-hr-025 — Ca làm việc qua đêm và tự tính giờ công)
- Given người dùng tạo mới ca làm việc với `gio_vao = 22:00`, `gio_ra = 06:00`, `nghi_giua_ca = 30` phút
- When người dùng lưu ca làm việc
- Then hệ thống tự động xác định đây là ca qua đêm (`is_overnight = true`), tính số giờ công thực tế là 7.5 giờ, và lưu thành công

**AC-hr-20** (FR-hr-030, BR-hr-026, E-hr-035 — Khóa lặp lại hàng năm cho lễ âm lịch)
- Given người dùng chọn Loại lễ = "le_am_lich" (Lễ âm lịch)
- When người dùng bật cờ lặp lại hàng năm (`lap_lai_hang_nam = true`) và cố gắng lưu
- Then hệ thống từ chối lưu với lỗi E-hr-035 (lễ âm lịch có ngày dương đổi hàng năm, bắt buộc tạo theo từng năm)

**AC-hr-21** (FR-hr-033, BR-hr-028 — Tạo nhanh lịch ngày lễ tự động lọc trùng)
- Given trong hệ thống đã có sẵn ngày lễ "01/01/2026 - Tết Dương lịch"
- When người dùng bấm "Tạo nhanh" lịch ngày lễ cho năm 2026
- Then hệ thống chỉ tạo mới các ngày lễ còn thiếu trong năm 2026 theo Điều 112 BLLĐ (bỏ qua ngày 01/01/2026 đã tồn tại), không báo lỗi trùng lặp

**AC-hr-22** (FR-hr-015 mở rộng, BR-hr-019 — Phân quyền cập nhật Cấu hình mặc định)
- Given người dùng đăng nhập với vai trò HR hoặc ACCOUNTANT
- When người dùng gửi yêu cầu cập nhật hoặc khôi phục Cấu hình mặc định
- Then hệ thống từ chối với lỗi E-hr-016 (vượt quyền — chỉ ADMIN có quyền sửa cấu hình hệ thống); yêu cầu xem (Read) vẫn thành công

## 13. Process Flow

Đây là nghiệp vụ CRUD trực tiếp qua form (tạo/xem/sửa/xoá), không có quy trình đa bước/đa vai trò cần mô hình hoá bằng diagram riêng (không dùng BPMN/activity/sequence — tránh over-engineering cho 1 feature quản lý dữ liệu). Tạo Nhân viên kèm Hợp đồng đầu tiên (Mục 6.4, BR-hr-014) vẫn là một thao tác đơn-vai-trò, đơn-lượt-submit (all-or-nothing trong 1 giao dịch) — không phát sinh nhu cầu diagram đa vai trò/đa actor. Quản lý Tài liệu (Mục 6.5) cũng là CRUD đơn giản theo từng Nhân viên, không có quy trình phê duyệt hay đa vai trò — không cần diagram riêng. Luồng thao tác của từng nghiệp vụ xem Mục 11 Use Cases.

## 14. Traceability

| Entity | FR liên quan | BR liên quan | UC liên quan |
|---|---|---|---|
| Phòng ban | FR-hr-001…004 | BR-hr-008 | UC-hr-01, UC-hr-02 |
| Nhân viên | FR-hr-005, FR-hr-006, FR-hr-008…010, FR-hr-015, FR-hr-016 | BR-hr-001, BR-hr-002, BR-hr-010, BR-hr-011, BR-hr-014 | UC-hr-03, UC-hr-04, UC-hr-05, UC-hr-09 |
| Hợp đồng | FR-hr-007, FR-hr-016…019 | BR-hr-003, BR-hr-004, BR-hr-005, BR-hr-012, BR-hr-013, BR-hr-014 | UC-hr-03, UC-hr-10, UC-hr-11, UC-hr-12 |
| Người phụ thuộc | FR-hr-011…014 | BR-hr-006, BR-hr-007, BR-hr-009 | UC-hr-06, UC-hr-07, UC-hr-08 |
| Tài liệu | FR-hr-010 (hệ quả xoá NV), FR-hr-015 (phân quyền), FR-hr-020…023 | BR-hr-011 (phân quyền, mở rộng), BR-hr-015…018 | UC-hr-13, UC-hr-14, UC-hr-15 |
| Cấu hình mặc định | FR-hr-024…026 | BR-hr-019…022 | UC-hr-16, UC-hr-17 |
| Ca làm việc | FR-hr-027…029 | BR-hr-023…025 | UC-hr-18 |
| Lịch ngày lễ | FR-hr-030…033 | BR-hr-026…028 | UC-hr-19, UC-hr-20 |

## 15. Assumptions

1. **A-hr-1** — Định dạng Mã NV tự sinh khi để trống: đề xuất "NV" + số thứ tự 4 chữ số (vd NV0001), tăng dần, duy nhất toàn hệ thống — chờ xác nhận (OQ-hr-1).
2. **A-hr-2** — Ngân hàng và Quan hệ (Người phụ thuộc) là free-text có gợi ý hiển thị, không phải enum cố định ở tầng dữ liệu — người dùng vẫn nhập được giá trị ngoài danh sách gợi ý.
3. **A-hr-3** — Giới tính, Loại hợp đồng, Kiểu lương là danh sách giá trị cố định (enum) vì có rẽ nhánh nghiệp vụ thật (vd Công đoàn theo Loại hợp đồng — BR-hr-004).
4. **A-hr-4** — Email/CCCD/MST/SĐT của Nhân viên không bắt buộc duy nhất — khác với email tài khoản đăng nhập ở feature auth (vốn là định danh — BR-auth-006). Nhân viên trong module HR chưa chắc có tài khoản đăng nhập tương ứng trong phạm vi tài liệu này.
5. **A-hr-5** — Mã phòng ban không sửa được sau khi tạo (coi là khoá tự nhiên được nhiều Nhân viên tham chiếu); muốn đổi tên hiển thị thì sửa Tên phòng ban, không sửa Mã.
6. **A-hr-14** — Cấu hình mặc định áp dụng phạm vi toàn doanh nghiệp (Singleton per system/tenant). Khi một tham số cấu hình thay đổi (vd lương cơ sở, tỷ lệ bảo hiểm), các kỳ tính công/lương trong tương lai sẽ áp dụng giá trị mới, không tự động hồi tố sửa đổi các bảng lương của kỳ đã chốt trong quá khứ.
7. **A-hr-15** — Biểu thuế TNCN trên cấu hình mặc định sử dụng biểu 5 bậc lũy tiến rút gọn theo dữ liệu mẫu; các bậc thuế được lưu trữ có cấu trúc để sẵn sàng mở rộng số bậc nếu cần.
8. **A-hr-16** — Mã ca làm việc tự sinh theo dãy `CA01`-`CA99` (tối đa 99 ca), đảm bảo đủ đáp ứng quy mô hoạt động ca kíp của doanh nghiệp vừa và nhỏ.
9. **A-hr-17** — Bảng tra lịch âm cho tính năng "Tạo nhanh" ngày lễ bao gồm các năm hỗ trợ từ 2024 đến 2030, phục vụ việc tự động xác định ngày dương lịch của Tết Nguyên đán và Giỗ Tổ Hùng Vương.
6. **A-hr-6** — *(Giả định gốc, đã bị THAY THẾ bởi quyết định dưới đây — giữ ID để truy vết lịch sử.)* ~~Mỗi bản ghi Nhân viên chỉ lưu một bộ thông tin hợp đồng hiện hành (Số hợp đồng, Loại hợp đồng, Kiểu lương, Ngày vào làm, Ngày hiệu lực tới) — không lưu lịch sử nhiều hợp đồng qua các lần gia hạn/chuyển đổi loại hợp đồng.~~
   **Quyết định 2026-09-05 (thay thế giả định trên):** tách Hợp đồng thành entity riêng — **Hợp đồng (Contract)**, Mục 6.4 — có lịch sử đầy đủ, 1 Nhân viên có N Hợp đồng theo thời gian (Phương án B, quyết định user). Đây là thay đổi PHÁ VỠ (breaking change) so với spec/code đã build trước đó:
   - 8 field hợp đồng (Số hợp đồng, Loại hợp đồng, Kiểu lương, Ngày vào làm/Hiệu lực TỪ, Ngày hiệu lực TỚI, BHXH, TNCN, Công đoàn) đã xoá khỏi Nhân viên (Mục 6.2), chuyển hết sang Hợp đồng (Mục 6.4). Field "Công đoàn" được chuyển thêm ngoài 7 field ban đầu được liệt kê trong yêu cầu, vì BR-hr-004 (Công đoàn theo Loại hợp đồng) chỉ có ý nghĩa khi 2 field này cùng nằm trên một entity (xem A-hr-11). Field "Miễn chấm công" KHÔNG chuyển — giữ nguyên trên Nhân viên.
   - Code backend đã triển khai theo thiết kế cũ tại `Backend/src/hr/employees/` (service, DTO, employee-code service), với các field `contractNumber/contractType/salaryType/effectiveFrom/effectiveTo/hasSocialInsurance/hasPersonalIncomeTax/hasUnionFee` trên model `Employee` (`Backend/prisma/schema.prisma`). Đã xác minh có 57 unit test (`employees.service.spec.ts` 23 case + `employee-code.service.spec.ts` 8 case + `departments.service.spec.ts` 12 case + `dependents.service.spec.ts` 14 case) và 65 test e2e (`Backend/test/hr.e2e-spec.ts` 12 case + `Backend/test/hr-qa.e2e-spec.ts` 53 case) đang dùng các field này làm dữ liệu/assertion — Backend Engineer cần rà soát và viết lại phần liên quan.
   - 4 tài liệu kiến trúc đã có cũng cần Architect cập nhật lại: `docs/hr/architecture/hr-architecture.md`, `docs/hr/architecture/hr-api-contract.md`, `docs/hr/architecture/hr-data-model.md`, `docs/hr/architecture/adr/ADR-001-employee-code-generation.md`.
   - Database dev hiện có 3 bảng HR (`Department`, `Employee`, `Dependent` — theo `Backend/prisma/schema.prisma`); migration cần thêm bảng Hợp đồng (Contract) mới và xoá 8 cột hợp đồng khỏi bảng Employee. DB dev chưa có dữ liệu thật ngoài dữ liệu test — an toàn để đổi cấu trúc.
7. **A-hr-7** — Ngày sinh của Người phụ thuộc là dữ liệu dạng Chuỗi (text tự do dd/MM/yyyy), khác với Ngày sinh của Nhân viên (kiểu Ngày thật) — giữ nguyên có chủ đích vì dữ liệu người phụ thuộc trong thực tế hay thiếu hoặc không chắc chắn ngày chính xác; hệ thống không ép định dạng ngày hợp lệ nghiêm ngặt cho trường này.
8. **A-hr-8** — Danh sách "chọn từ list" của Ngân hàng và Quan hệ không có business logic rẽ nhánh nào khác ngoài hiển thị lựa chọn — không ảnh hưởng tính lương/thuế trong phạm vi tài liệu này.
9. **A-hr-9** — Trong phạm vi tài liệu này, việc tạo một Nhân viên (kèm Hợp đồng đầu tiên) không tự động tạo tài khoản đăng nhập (User) tương ứng ở feature auth; hai module độc lập trừ khi có yêu cầu khác ở giai đoạn sau (OQ-hr-9).
10. **A-hr-10** — Hệ thống không tự validate/tính toán theo trần đóng BHXH/BHYT/BHTN theo quy định pháp luật hiện hành (vd mức trần lương đóng BHXH tối đa 20 lần lương cơ sở) — chỉ ghi nhận đúng số liệu Lương đóng BHXH do người dùng nhập vào Hợp đồng (Mục 6.4). (Resolved theo default — OQ-hr-12.)
11. **A-hr-11** — Field "Công đoàn" chuyển từ Nhân viên sang Hợp đồng cùng đợt tái cấu trúc 2026-09-05 (xem A-hr-6), vì Business Rule chi phối nó (BR-hr-004 — Công đoàn theo Loại hợp đồng) chỉ có ý nghĩa khi Công đoàn và Loại hợp đồng cùng nằm trên một entity. Field "Miễn chấm công" KHÔNG chuyển theo — là thuộc tính của cá nhân/vai trò nhân viên (vd giám đốc không cần chấm công), độc lập với hợp đồng nào đang hiệu lực.
12. **A-hr-12** — Mỗi bản ghi Tài liệu chỉ có đúng 1 trường Đường dẫn/link (không thiết kế nhiều field link song song cho 1 bản ghi); nếu cần nhiều ảnh cho cùng 1 Tài liệu (vd CCCD 2 mặt), người dùng tự gộp vào 1 folder chia sẻ và dán link folder đó. Giả định này áp dụng bất kể kết quả OQ-hr-25 chọn Cách hiểu nào (Mục 6.5).
13. **A-hr-13** — Danh sách Loại tài liệu giữ đúng 5 giá trị user đã liệt kê (CCCD/CMND, Hộ chiếu, Bằng cấp, Chứng chỉ, Sơ yếu lý lịch) + "Khác" (free-text nhập tay khi chọn Khác, theo mẫu Ngân hàng/Quan hệ NPT — A-hr-2); có thể cân nhắc bổ sung thêm (Giấy khám sức khỏe, Ảnh chân dung, Bằng lái xe...) sau nếu nghiệp vụ thực tế cần, không cần đổi cấu trúc hệ thống vì đây là danh sách gợi ý free-text.

## 16. Open Questions

| ID | Câu hỏi | Ảnh hưởng nếu khác |
|---|---|---|
| OQ-hr-1 | Định dạng Mã NV tự sinh "NV0001" (4 chữ số) có đúng mong muốn không, hay công ty có quy ước khác (theo phòng ban, theo năm...)? | Ảnh hưởng A-hr-1, BR-hr-001 |
| OQ-hr-2 | Số hợp đồng (nay là field trên Hợp đồng, Mục 6.4, sau khi tách khỏi Nhân viên ngày 2026-09-05) có cần duy nhất toàn hệ thống, hay chỉ là số hiệu tham chiếu tự do có thể trùng? (Gộp chung với OQ-hr-18 cũ — cùng câu hỏi.) | Ảnh hưởng việc thêm ràng buộc unique mới cho Số hợp đồng trên Hợp đồng nếu cần |
| OQ-hr-3 | Xoá Nhân viên: cho xoá cứng, chặn xoá khi còn Người phụ thuộc, hay chuyển "Ngừng hoạt động" (soft-delete) như Phòng ban? Bảng trường Nhân viên hiện chưa có cột "Trạng thái làm việc" — cần bổ sung nếu chọn hướng soft-delete. | Ảnh hưởng FR-hr-010, Mục 6.2, và toàn bộ logic xoá |
| OQ-hr-4 | Khi xoá/ngừng hoạt động một Nhân viên, Người phụ thuộc, Hợp đồng VÀ Tài liệu (mở rộng phạm vi lần 2 ngày 2026-09-05 sau khi thêm entity Tài liệu) của nhân viên đó xử lý thế nào — xoá theo (cascade) hay giữ lại phục vụ lịch sử/kiểm toán thuế, BHXH và hồ sơ giấy tờ? | Ảnh hưởng FR-hr-010, UC-hr-09, và toàn vẹn lịch sử Hợp đồng (Mục 6.4) và Tài liệu (Mục 6.5) |
| OQ-hr-6 | Có cần chức năng Import/Export Excel cho Nhân viên và Người phụ thuộc không? Cấu trúc cột dữ liệu mẫu cho thấy nghiệp vụ đang dùng file Excel thủ công. | Thêm FR mới nếu có; ảnh hưởng phạm vi Mục 3/4 |
| OQ-hr-7 | Có cần audit log (ai sửa, khi nào, giá trị trước/sau) cho thay đổi dữ liệu Nhân viên/Phòng ban/Hợp đồng/Người phụ thuộc — tương tự AuditLog đã có ở feature auth — do đây là dữ liệu lương/PII nhạy cảm? | Thêm FR/NFR mới nếu có |
| OQ-hr-8 | Mã phòng ban có được phép sửa sau khi tạo không, hay cố định vĩnh viễn như đề xuất tại A-hr-5? | Ảnh hưởng Mục 6.1, FR-hr-003 |
| OQ-hr-9 | Một Nhân viên trong module HR có cần liên kết tới một tài khoản đăng nhập (User) ở feature auth không, và ai tạo liên kết đó? | Ảnh hưởng ranh giới 2 module, A-hr-9 |
| OQ-hr-10 | Mức độ chi tiết tìm kiếm/lọc danh sách Nhân viên cần thêm tiêu chí gì ngoài Mã NV/Họ tên/Phòng ban/Loại hợp đồng của Hợp đồng hiện hành/Chức vụ (vd theo trạng thái BHXH, theo khoảng ngày vào làm...)? | Ảnh hưởng FR-hr-008 |
| OQ-hr-11 | ACCOUNTANT có cần export báo cáo (Excel/PDF) danh sách lương/BHXH/TNCN từ dữ liệu Hợp đồng phục vụ tính lương hàng tháng, hay việc này thuộc một module Payroll riêng sẽ làm sau? | Thêm FR mới nếu có; ảnh hưởng Mục 5 phân quyền |
| OQ-hr-28 | Biểu thuế TNCN trên Cấu hình mặc định: Mock hiện dùng biểu rút gọn 5 bậc (theo dự thảo). Hệ thống có cần hỗ trợ cấu hình động linh hoạt N bậc để tương thích cả biểu 7 bậc hiện hành của Luật Thuế TNCN (áp dụng mức tối đa 35% cho phần vượt 80tr) hay cố định 5 bậc như mock? | Ảnh hưởng schema lưu trữ của `GeneralSetting.bac_thue` (JSON dynamic array vs fixed fields) |
| OQ-hr-29 | Cấu hình mặc định (General Setting) hiện là Singleton (1 bản ghi toàn hệ thống). Doanh nghiệp có nhu cầu phân tách cấu hình theo từng chi nhánh/pháp nhân (Multi-company/branch) trong tương lai không? | Ảnh hưởng thiết kế bảng GeneralSetting (thêm branch_id/tenant_id nếu có) |
| OQ-hr-30 | Khi xóa một Ca làm việc đã được sử dụng trong phân ca / bảng chấm công của nhân viên: nên chặn xóa cứng (RESTRICT) và yêu cầu chuyển trạng thái "Ngừng dùng", hay cho phép xóa mềm? | Ảnh hưởng ràng buộc xóa của Ca làm việc (FR-hr-029) |

Không câu hỏi nào trong bảng trên chặn Architect/Backend Engineer tiếp tục — OQ-hr-25 (cách lưu file scan Tài liệu) đã được user xác nhận (Cách hiểu 2, xem Mục 6.5 và bảng "Đã xử lý" dưới đây). Toàn bộ OQ còn lại trong bảng đều là điểm mở/tinh chỉnh độc lập, không chặn implementation.

### Đã xử lý (2026-09-05)

17 câu hỏi dưới đây (OQ-hr-5, OQ-hr-12…OQ-hr-27) đã được xử lý trong phiên phân tích ngày 2026-09-05 — không còn là Open Question treo, giữ lại bảng này để truy vết.

| ID | Câu hỏi (tóm tắt) | Kết quả xử lý |
|---|---|---|
| OQ-hr-5 | Cần lưu lịch sử nhiều hợp đồng theo thời gian (gia hạn, đổi loại, đổi lương)? | **Resolved — quyết định user (2026-09-05):** chọn Phương án B, tách Hợp đồng thành entity riêng có lịch sử đầy đủ. Xem Mục 6.4, A-hr-6. |
| OQ-hr-12 | Có validate theo trần đóng BHXH/BHYT/BHTN theo luật định không? | **Resolved theo default:** không tự validate, chỉ ghi nhận đúng số liệu người dùng nhập. Ghi nhận thành Assumption A-hr-10 (Mục 15). |
| OQ-hr-13 | Một Nhân viên có thể có nhiều Hợp đồng "active" cùng lúc không? | **Resolved theo default:** không — tại 1 thời điểm chỉ 1 Hợp đồng hiện hành; hệ thống từ chối chồng lấn. Xem BR-hr-013. |
| OQ-hr-14 | Có cần field trạng thái tường minh trên Hợp đồng không? | **Resolved theo default:** không thêm field trạng thái; "hiện hành" suy ra từ so sánh ngày tại thời điểm truy vấn. Xem Mục 6.4, FR-hr-018. |
| OQ-hr-15 | Có cho phép chấm dứt hợp đồng sớm kèm lý do không? | **Resolved theo default:** cho phép, thêm field "Lý do chấm dứt" (tuỳ chọn). Xem Mục 6.4, FR-hr-019. |
| OQ-hr-16 | Gia hạn hợp đồng có tạo một bản ghi Hợp đồng mới không? | **Tự resolve theo Phương án B:** đúng — mọi gia hạn/thay đổi là 1 bản ghi Hợp đồng mới, độc lập. Xem FR-hr-017. |
| OQ-hr-17 | "Đi kèm với thêm nhân viên" (tạo Hợp đồng) nghĩa là bắt buộc hay tuỳ chọn? | **Resolved — quyết định user (2026-09-05):** bắt buộc cùng lúc, all-or-nothing. Xem BR-hr-014, FR-hr-005, FR-hr-016. |
| OQ-hr-18 | Số hợp đồng (trên Hợp đồng) có cần duy nhất không? | **Gộp vào OQ-hr-2** — cùng câu hỏi sau khi Số hợp đồng chuyển sang Hợp đồng; vẫn giữ mở tại OQ-hr-2 ở bảng trên. |
| OQ-hr-19 | 7 field hợp đồng cũ trên Nhân viên xử lý thế nào sau khi tách Hợp đồng? | **Resolved theo default:** xoá hẳn khỏi Nhân viên (Mục 6.2), chuyển hết sang Hợp đồng (Mục 6.4). |
| OQ-hr-20 | Đơn vị/định dạng lương trên Hợp đồng? | **Resolved theo default:** VND, số nguyên, phải > 0; Lương chính bắt buộc, Lương đóng BHXH bắt buộc có điều kiện. Xem BR-hr-012. |
| OQ-hr-21 | Phân quyền cho entity Hợp đồng theo vai trò nào? | **Resolved theo default:** giữ nguyên ma trận cũ (ADMIN/HR CRUD, ACCOUNTANT Read, EMPLOYEE không quyền) — không siết thêm. Xem Mục 5, BR-hr-011. |
| OQ-hr-22 | Có phân biệt "phụ lục hợp đồng" với "hợp đồng mới" không? | **Đưa vào Out of Scope** — xem Mục 4, item 8. |
| OQ-hr-23 | Có validate trần thời hạn hợp đồng theo luật lao động (vd 36 tháng) không? | **Đưa vào Out of Scope** — xem Mục 4, item 9. |
| OQ-hr-24 | Có thiết kế đính kèm file hợp đồng (scan/PDF) không? | **Đưa vào Out of Scope** — xem Mục 4, item 10. |
| OQ-hr-25 | File scan Tài liệu lưu theo Cách hiểu 1 (chỉ lưu link tay) hay Cách hiểu 2 (tích hợp Google Drive API thật)? | **Resolved — quyết định user (2026-09-05):** Cách hiểu 2, tích hợp Google Drive API thật (OAuth, scope `drive.file`, upload tự động). Xem Mục 6.5, ADR-004. |
| OQ-hr-26 | Có cần field "Ngày hết hạn" cho Tài liệu để phục vụ cảnh báo hết hạn (CCCD đổi ở tuổi 25/40/60, Hộ chiếu có hạn dùng) sau này không? | **Resolved — quyết định user (2026-09-05):** có, thêm field (Mục 6.5) — tuỳ chọn cho mọi Loại tài liệu, chưa bắt buộc riêng theo loại. Chưa xây tính năng cảnh báo (Mục 4 item 13). |
| OQ-hr-27 | Có cần siết phân quyền chặt hơn cho Tài liệu (vd ACCOUNTANT không xem được Số hiệu CCCD/Hộ chiếu) không? | **Resolved — quyết định user (2026-09-05):** giữ nguyên ma trận cũ, ACCOUNTANT vẫn Read được Tài liệu như 4 entity còn lại. Xem Mục 5, NFR-hr-003. |
