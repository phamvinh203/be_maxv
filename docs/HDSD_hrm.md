# Hướng dẫn sử dụng Phân hệ Nhân sự - Tiền lương (HRM)

## 1. Giới thiệu

Phân hệ **HRM** dùng để quản lý toàn bộ nghiệp vụ nhân sự và tính lương của công ty: từ tổ chức phòng ban, hồ sơ nhân viên, hợp đồng lao động, đến chấm công, tăng ca, thưởng, và cuối cùng ra bảng lương hằng tháng kèm số thuế thu nhập cá nhân, bảo hiểm phải nộp.

**Cách vào phân hệ:** Đăng nhập vào ứng dụng, trên thanh menu ở đầu trang (cạnh logo MAXV) bấm nút **HRM**. Nút này chỉ hiện ra nếu tài khoản của bạn đã được cấp quyền dùng module HRM — nếu không thấy nút, liên hệ quản trị viên công ty để được bật module.

Vào phân hệ, bạn sẽ thấy một dải tab lớn ở trên cùng gồm 8 khu:

| Tab | Dùng để làm gì |
|---|---|
| **Dashboard** | Xem nhanh số nhân viên đang làm, số phòng ban, những hợp đồng sắp hết hạn cần xử lý. |
| **Dữ liệu nhân viên** | Quản lý Phòng ban, Nhân viên, Người phụ thuộc. |
| **Cấu hình mặc định** | Cài các tham số nghiệp vụ dùng chung: ngày công, bảo hiểm, thuế, ca làm việc, lịch nghỉ lễ. |
| **Cài đặt lương** | Khai danh mục các khoản lương/phụ cấp, cấu trúc lương chuẩn của công ty, và set mức lương cho từng người. |
| **Dữ liệu tính lương** | Nhập chấm công, tăng ca, KPI, thưởng... cho từng kỳ lương. |
| **Bảng lương** | Xem kết quả tính lương cuối cùng của kỳ. |
| **Tờ khai thuế** | Đang trong quá trình xây dựng, chưa dùng được. |
| **Hồ sơ lương** | Đang trong quá trình xây dựng, chưa dùng được. |

Hướng dẫn này đi lần lượt qua từng khu theo đúng thứ tự công việc thực tế: khai tổ chức và nhân viên trước, rồi tới cấu hình tham số, cài đặt lương, nhập liệu theo từng kỳ, và cuối cùng xem bảng lương ra kết quả.

**Màn hình Dashboard** cho bạn cái nhìn tổng quan mỗi khi mở phân hệ: số nhân viên đang làm/đã nghỉ, số phòng ban, số người phụ thuộc đã đăng ký giảm trừ, số người tham gia công đoàn, biểu đồ nhân viên theo từng phòng ban, và một bảng cảnh báo các hợp đồng sắp hết hạn trong 90 ngày tới hoặc đã quá hạn mà chưa ký tiếp — bấm "Mở danh sách" trên cảnh báo để nhảy thẳng tới danh sách nhân viên cần xử lý.

---

## 2. Tổ chức & Nhân sự

Vào **HRM › Dữ liệu nhân viên**, bạn sẽ thấy 3 tab con: **Phòng ban**, **Nhân viên**, **Người phụ thuộc**.

### 2.1 Phòng ban

Đây là nơi khai cây tổ chức của công ty.

**Xem danh sách:** Bảng hiện đủ Mã, Tên phòng ban (thụt lề theo cấp bậc trong cây tổ chức, phòng ban cấp cao nhất in đậm), phòng ban trực thuộc cấp trên, cấp bậc, số nhân viên đang có, trạng thái Đang dùng/Ngừng. Gõ vào ô tìm kiếm phía trên để lọc theo mã hoặc tên.

**Thêm phòng ban:** Bấm nút **Thêm phòng ban**. Điền:
- Tên phòng ban (bắt buộc).
- Trực thuộc phòng ban nào — chọn phòng ban cha, để trống nếu đây là phòng ban cấp cao nhất. Hệ thống tự loại các phòng ban con-cháu của chính nó ra khỏi danh sách chọn để tránh tạo vòng lặp trong cây tổ chức.
- Mô tả (tùy chọn).

Bấm **Thêm phòng ban** để lưu. Mã phòng ban do hệ thống tự sinh.

**Sửa phòng ban:** Bấm biểu tượng bút chì ở cuối dòng. Ngoài các ô trên, khi sửa còn có thêm ô **Trạng thái** — chuyển "Ngừng" khi phòng ban đã giải thể nhưng vẫn muốn giữ lại để tra cứu chứng từ cũ (KHÔNG xóa hẳn).

**Xóa phòng ban:** Bấm biểu tượng thùng rác, xác nhận trong hộp thoại hiện ra. Thao tác này không hoàn tác được.

**Gán nhanh phòng ban:** Nếu có nhiều nhân viên chưa được gán vào phòng ban nào (hoặc muốn chuyển hàng loạt nhân viên sang phòng ban khác), bấm nút **Gán nhanh phòng ban**. Hộp thoại hiện ra 2 bước:
1. Chọn nhân viên — lọc theo phòng ban hiện tại (mặc định lọc "Chưa có phòng ban"), tìm theo mã/tên, tick chọn từng người hoặc bấm "Chọn tất cả đang hiển thị".
2. Chọn phòng ban đích, rồi bấm **Gán**. Phòng ban hiện tại của những người đã chọn sẽ bị thay thế bằng phòng ban đích.

### 2.2 Nhân viên

**Xem danh sách:** Bảng mặc định chỉ hiện nhân viên **đang làm** (đổi ở ô lọc "Trạng thái" nếu muốn xem cả người đã nghỉ hoặc tất cả). Có thể lọc theo phòng ban hoặc tìm theo mã, tên, số CCCD, số điện thoại. Mỗi dòng cho biết: mã nhân viên, họ tên, phòng ban, chức vụ, số hợp đồng hiện hành, kiểu lương (GROSS/NET), điện thoại, email, có tham gia công đoàn không, ngày vào làm, số người phụ thuộc.

**Thêm nhân viên:** Bấm **Thêm nhân viên**, hộp thoại mở toàn màn hình với các nhóm thông tin:
- *Thông tin cá nhân*: Số CCCD, MST cá nhân, Mã nhân viên (có thể sửa lại trước khi lưu, sau khi lưu thì khóa cứng), Họ và tên (bắt buộc), Ngày sinh, Giới tính, Điện thoại, Email, Địa chỉ, Ghi chú.
- *Công việc & lương*: Phòng ban, Chức vụ, Cấp bậc (gõ tự do, ví dụ "Nhân viên chính", "Quản lý cấp trung"), Ngày vào (đồng thời là ngày hiệu lực của hợp đồng đầu tiên), tick **Tham gia công đoàn** nếu có (sẽ trích 1% phí công đoàn trên lương đóng BHXH).
- *Thông tin hợp đồng*: có thể điền ngay hợp đồng đầu tiên tại đây (số hợp đồng, loại hợp đồng, kiểu lương, lương chính, lương đóng BHXH, ngày bắt đầu/kết thúc, có trích BHXH không, có tính thuế TNCN không) — hoặc để trống toàn bộ nhóm này và ký hợp đồng sau ở tab "Lịch sử hợp đồng".
- *Tài khoản ngân hàng*: Ngân hàng, Số tài khoản, Tên chủ tài khoản (tự động viết in hoa không dấu).

Bấm **Lưu nhân viên**. Sau khi lưu xong lần đầu, hộp thoại tự động chuyển sang chế độ sửa và mở thêm 3 tab: **Lịch sử hợp đồng**, **Hồ sơ, tài liệu**, **Người phụ thuộc** — bạn nhập tiếp các thông tin này ngay tại đây mà không cần đóng ra tìm lại người vừa tạo.

**Sửa hồ sơ nhân viên:** Bấm biểu tượng bút chì ở dòng nhân viên.

**Xem chi tiết (không sửa):** Bấm biểu tượng con mắt.

**Xóa nhân viên:** Bấm biểu tượng thùng rác, xác nhận trong hộp thoại. Lưu ý: xóa nhân viên sẽ xóa kèm toàn bộ hợp đồng và tài liệu của người đó; người phụ thuộc của họ KHÔNG bị xóa mà chỉ ẩn theo hồ sơ (thông báo sẽ báo rõ số người phụ thuộc bị ẩn kèm).

> Lưu ý về quyền: nếu tài khoản của bạn không có quyền xem thông tin lương, nhóm "Thông tin hợp đồng" và "Tài khoản ngân hàng" sẽ không hiện ra trong form, và tab "Lịch sử hợp đồng" bị khóa kèm ghi chú lý do. Liên hệ quản trị viên nếu cần được cấp quyền.

### 2.3 Hợp đồng

Lịch sử hợp đồng của một nhân viên nằm trong tab **Lịch sử hợp đồng** khi mở hồ sơ nhân viên đó (không phải màn hình riêng ở menu ngoài).

**Xem lịch sử:** Bảng liệt kê mọi hợp đồng đã ký của người này: số HĐ, loại (Không xác định thời hạn / Xác định thời hạn / Thử việc / Thời vụ / Khoán), kiểu lương, lương chính, lương đóng BHXH, từ ngày, đến ngày, có trích BHXH không, có tính TNCN không, và **trạng thái** tự động: "Hiệu lực" (đang chạy), "Sắp tới" (chưa tới ngày bắt đầu), "Hết hạn".

**Thêm/sửa một dòng hợp đồng:** Bấm **Thêm hợp đồng** hoặc biểu tượng bút chì ở dòng cần sửa — dùng khi chỉ cần chỉnh sửa một bản ghi lịch sử (ví dụ gõ nhầm số hợp đồng), KHÔNG dùng để "gia hạn" hay "đổi hợp đồng mới" (xem mục dưới).

**Nghiệp vụ "đổi hợp đồng" (ký hợp đồng mới thay cho hợp đồng cũ):** Đây là thao tác nghiệp vụ đúng khi nhân viên hết hạn thử việc lên chính thức, gia hạn hợp đồng, hoặc đổi mức lương mới. Vào tab "Thông tin nhân viên" của hồ sơ, ở nhóm "Thông tin hợp đồng" bấm **"Xem và ký hợp đồng ở tab Lịch sử hợp đồng"**, chuyển qua đó bấm nút mở hộp thoại đổi hợp đồng. Hộp thoại gồm 2 phần:
1. **Chốt hợp đồng hiện tại** — hiện tóm tắt hợp đồng đang chạy, bạn nhập "Ngày chốt hợp đồng" (sẽ ghi thành ngày kết thúc của hợp đồng cũ). Nếu nhân viên đang có nhiều hợp đồng cùng hiệu lực (ví dụ vừa có hợp đồng lao động vừa có hợp đồng khoán), phải chọn rõ "Hợp đồng cần chốt" là hợp đồng nào.
2. **Hợp đồng mới** — điền số hợp đồng, loại, kiểu lương, lương chính, lương đóng BHXH (bắt buộc), ngày bắt đầu (mặc định là ngày sau ngày chốt hợp đồng cũ 1 ngày), ngày kết thúc, có trích BHXH/tính TNCN không, ghi chú.

Bấm **Lưu** — hệ thống tự động chốt hợp đồng cũ và tạo hợp đồng mới trong cùng một lần thao tác.

**Xóa một dòng hợp đồng:** Bấm biểu tượng thùng rác ở dòng đó, xác nhận. Lưu ý đây chỉ xóa đúng một bản ghi trong lịch sử, không phải nghiệp vụ chấm dứt hợp đồng.

### 2.4 Người phụ thuộc

Dùng để đăng ký người phụ thuộc giảm trừ gia cảnh khi tính thuế TNCN cho nhân viên. Có thể quản lý từ 2 chỗ: màn hình riêng **HRM › Dữ liệu nhân viên › Người phụ thuộc** (xem/tìm toàn công ty) hoặc ngay trong tab "Người phụ thuộc" của từng hồ sơ nhân viên.

**Xem danh sách (màn hình riêng):** Bảng hiện Mã NV, Tên nhân viên, Họ tên người phụ thuộc, Quan hệ, Ngày sinh, CCCD, MST, và kỳ đăng ký giảm trừ (Từ tháng → Đến tháng). Tìm theo tên nhân viên, tên người phụ thuộc, CCCD hoặc MST.

**Thêm/sửa người phụ thuộc:** Bấm **Thêm người phụ thuộc** (hoặc bút chì để sửa). Điền:
- Họ và tên người phụ thuộc (bắt buộc).
- Quan hệ với nhân viên (con, cha mẹ, vợ/chồng...).
- Ngày sinh, Số CCCD, MST cá nhân, Điện thoại, Địa chỉ.
- **Đăng ký giảm trừ gia cảnh**: Từ tháng, Đến tháng — để trống "Đến tháng" nếu đăng ký còn hiệu lực (chưa có ngày kết thúc).

Bấm **Lưu**. Xóa người phụ thuộc bằng biểu tượng thùng rác kèm xác nhận.

Mức giảm trừ tiền cụ thể cho mỗi người phụ thuộc do bạn khai ở **Cấu hình mặc định** (xem Mục 3), không khai ở đây — ở đây chỉ khai "ai là người phụ thuộc của ai, trong khoảng thời gian nào".

### 2.5 Hồ sơ, tài liệu

Mỗi nhân viên có một tab **"Hồ sơ, tài liệu"** trong hồ sơ của họ, dùng để quản lý các giấy tờ đã scan: CCCD/CMND, Hộ chiếu, Bằng cấp, Chứng chỉ, Sơ yếu lý lịch.

File scan được lưu trên **Google Drive** của công ty (không lưu trực tiếp trên máy chủ MAXV) — lần đầu đính file, hệ thống sẽ mở cửa sổ đăng nhập Google để kết nối. Màn hình luôn cho biết đang kết nối Drive của tài khoản Google nào, và có nút "Ngắt kết nối" nếu cần đổi tài khoản.

Mỗi dòng trong bảng là **một loại giấy tờ**, có thể đính kèm nhiều file (ví dụ CCCD 2 mặt) vào cùng một dòng — bấm "Đính file"/"Đính thêm file" ngay trong ô "File scan" của dòng đó. Giới hạn: mỗi file tối đa 10MB, mỗi giấy tờ tối đa 20 file, nhận định dạng ảnh hoặc PDF. Có thể xem file ngay trong ứng dụng (bấm biểu tượng con mắt cạnh file) hoặc gỡ từng file riêng lẻ. Xóa cả dòng giấy tờ sẽ xóa kèm toàn bộ file scan của dòng đó trên Google Drive — không hoàn tác được.

---

## 3. Cấu hình mặc định

Vào **HRM › Cấu hình mặc định**, có 2 tab con: **Thiết lập chung** và **Lịch ngày lễ**. Đây là nơi khai các tham số nghiệp vụ áp dụng chung cho toàn công ty, dùng làm gốc để tính lương, bảo hiểm, thuế cho mọi nhân viên — nên cần rà soát kỹ trước khi bắt đầu tính lương thật.

### 3.1 Thiết lập chung

Màn hình có nhiều nhóm tham số xếp theo khối, sửa xong bấm nút **Lưu cấu hình** ở thanh trên cùng để ghi lại toàn bộ một lần (không lưu riêng từng ô). Có nút **Hoàn tác** để bỏ các thay đổi chưa lưu, và nút **Khôi phục mặc định** để ghi đè toàn bộ về bộ tham số chuẩn theo quy định hiện hành (thao tác này không hoàn tác được, hệ thống sẽ hỏi xác nhận trước).

**a) Ngày công & giờ công**
- *Phương pháp tính ngày công chuẩn*: chọn cách quy đổi lương tháng ra lương ngày/giờ — cố định 26 ngày, cố định 24 ngày, hoặc tự đếm theo ngày thực tế trong tháng (có trừ ngày lễ hưởng lương).
- *Chính sách thứ 7* và *Chính sách chủ nhật*: ngày đó tính đủ công, nửa công, hay nghỉ hẳn.
- *Giờ công chuẩn/ngày*: mặc định 8 giờ.

**b) Nghỉ phép có lương**
- *Số ngày phép cơ bản/năm*: mặc định 12 ngày.
- *Số năm thâm niên cho 1 ngày phép thêm*: mặc định cứ đủ 5 năm làm việc thì cộng thêm 1 ngày phép.

**c) Hệ số tăng ca**

Tỷ lệ phần trăm so với đơn giá giờ công bình thường — ví dụ 150% nghĩa là 1 giờ tăng ca được trả bằng 1,5 giờ công thường. Khai riêng cho 6 trường hợp: Ngày thường (ban ngày/ban đêm), Chủ nhật (ban ngày/ban đêm), Ngày lễ (ban ngày/ban đêm). Mức mặc định theo luật: ngày thường 150%/200%, chủ nhật 200%/270%, ngày lễ 300%/390%.

**d) Giới hạn giờ tăng ca**
- *Trần giờ tăng ca mỗi tháng*: mặc định 40 giờ — vượt mức này bảng tăng ca sẽ tô đỏ cảnh báo (không tự chặn nhập).
- *Ngưỡng cảnh báo giờ tăng ca/năm*: mặc định 200 giờ.
- *Ngưỡng vượt mức giờ tăng ca/năm*: mặc định 300 giờ.

**e) Lương cơ sở / Tối thiểu vùng**
- *Lương cơ sở*: dùng làm trần đóng bảo hiểm và đoàn phí. Mặc định 2.340.000đ/tháng.
- *Lương tối thiểu vùng*: sàn của lương thỏa thuận. Mặc định 4.960.000đ/tháng.

**f) Bảo hiểm — Nhân viên đóng / Công ty đóng**

Ba loại bảo hiểm bắt buộc, khai riêng tỷ lệ % của phần Nhân viên đóng và phần Công ty đóng: Bảo hiểm xã hội (BHXH), Bảo hiểm y tế (BHYT), Bảo hiểm thất nghiệp (BHTN). Mức mặc định: Nhân viên đóng 8% + 1,5% + 1% (tổng 10,5%); Công ty đóng 17,5% + 3% + 1% (tổng 21,5%). Màn hình tự cộng tổng tỷ lệ mỗi bên để đối chiếu nhanh.

**g) Công đoàn**
- *Tỷ lệ đoàn phí (Nhân viên đóng)*: mặc định 1% trên lương đóng BHXH — chỉ trích với người có tick "Tham gia công đoàn" ở hồ sơ.
- *Trần cơ sở đóng đoàn phí*: phần lương vượt trần này không tính thêm đoàn phí. Mặc định 234.000đ (bằng 10% lương cơ sở).
- *Tỷ lệ kinh phí công đoàn (Công ty đóng)*: mặc định 2%, tính trên quỹ lương đóng BHXH của toàn công ty (không phụ thuộc nhân viên có tham gia công đoàn hay không).

**h) Giảm trừ thuế TNCN**
- *Giảm trừ bản thân*: mặc định 11.000.000đ/tháng cho mỗi người lao động.
- *Giảm trừ người phụ thuộc*: mặc định 4.400.000đ/người/tháng, nhân với số người phụ thuộc đã đăng ký giảm trừ còn hiệu lực (xem Mục 2.4).

**i) Bậc thuế TNCN lũy tiến từng phần**

Bảng biểu thuế theo Điều 22 Luật Thuế TNCN, mỗi dòng là một bậc gồm ô "Ngưỡng thu nhập tính thuế lũy kế" (mức thu nhập tối đa bậc đó áp tới, không phải độ rộng của riêng bậc) và ô "Thuế suất" (%). Bậc cuối cùng luôn là bậc mở (không giới hạn trên) và không xóa được. Có thể bấm **Thêm bậc** để thêm bậc mới trước bậc mở, hoặc xóa bớt bậc (tối thiểu phải còn 2 bậc). Biểu chuẩn hiện hành có 7 bậc: đến 5 triệu (5%), trên 5-10 triệu (10%), trên 10-18 triệu (15%), trên 18-32 triệu (20%), trên 32-52 triệu (25%), trên 52-80 triệu (30%), trên 80 triệu (35%). Nếu công ty tự sửa lệch biểu chuẩn, hệ thống vẫn cho lưu nhưng sẽ cảnh báo để kế toán đối chiếu lại trước khi tính lương.

**j) Ba tham số mới về thuế TNCN (áp dụng tự động, hiện chưa có ô chỉnh trên giao diện)**

Ngoài các tham số trên, hệ thống có thêm 3 tham số nghiệp vụ mới vừa được bổ sung ở tầng tính lương, áp dụng tự động theo mức mặc định pháp luật quy định — kế toán **chưa chỉnh được các mức này trực tiếp trên màn hình Cấu hình mặc định** (cần bổ sung ô nhập ở đợt phát triển sau nếu công ty cần tùy chỉnh):
- **Trần miễn thuế phụ cấp ăn trưa/ăn ca**: 730.000đ/tháng. Khoản phụ cấp nào được đánh dấu là "phụ cấp ăn trưa" (xem Mục 4.1) thì phần trong hạn mức này được miễn thuế TNCN, phần vượt hạn mức mới tính vào thu nhập chịu thuế. Mức này được quy đổi theo ngày công thực tế khi tính lương.
- **Thuế suất khấu trừ tại nguồn cho hợp đồng thử việc/thời vụ**: 10%. Áp dụng Điều 25 Thông tư 111/2013 — nhân viên ký hợp đồng loại "Thử việc" hoặc "Thời vụ" sẽ bị khấu trừ thẳng 10% trên thu nhập mỗi lần trả, thay vì tính theo biểu thuế lũy tiến 7 bậc như hợp đồng chính thức.
- **Ngưỡng thu nhập bắt đầu khấu trừ 10%**: 2.000.000đ/lần trả. Nhân viên thử việc/thời vụ có thu nhập mỗi lần trả từ mức này trở lên mới bị khấu trừ 10%; dưới mức này thì không khấu trừ.

**k) Ca làm việc**

Ở cuối trang "Thiết lập chung" là danh sách ca làm việc — **lưu ngay khi bấm, không cần bấm nút "Lưu cấu hình"** ở trên (vì đây là danh mục riêng, khác các tham số phía trên).

Bấm **Thêm ca làm việc**, điền: Tên ca, Giờ vào, Giờ ra, Nghỉ giữa ca (phút). Hệ thống tự tính và hiện "Số giờ công" của ca ngay trong hộp thoại. Nếu Giờ ra sớm hơn hoặc bằng Giờ vào, hệ thống hiểu đây là **ca qua đêm** (giờ ra thuộc ngày hôm sau) và gắn nhãn "Qua đêm" trong danh sách. Ca có số giờ vượt quá 12 giờ/ngày vẫn lưu được (dành cho ca trực y tế, an ninh, cứu hộ) nhưng sẽ có cảnh báo nhắc rà soát lại theo Điều 105 & 107 Bộ luật Lao động 2019. Sửa/xóa ca bằng các biểu tượng ở cuối dòng.

### 3.2 Lịch ngày lễ

Khai lịch các ngày nghỉ lễ, tết trong năm — dữ liệu này quyết định hệ số tăng ca 300%/390% khi chấm công rơi vào đúng ngày lễ, và trừ ra khỏi ngày công chuẩn nếu chọn phương pháp "tự đếm theo ngày thực tế" ở mục 3.1.a.

**Lọc xem:** 3 nút lọc nhanh — "Ngày lễ" (tất cả), "Hàng năm" (chỉ ngày lặp lại mọi năm), "Năm nay".

**Tạo nhanh 11 ngày lễ chuẩn:** Bấm nút **Tạo nhanh**, chọn năm cần tạo (hệ thống hỗ trợ khoảng năm nhất định, ví dụ 2024-2030), xem trước danh sách 11 ngày lễ chuẩn Việt Nam theo Điều 112 Bộ luật Lao động 2019 (Tết Dương lịch, Tết Âm lịch nhiều ngày, Giỗ Tổ Hùng Vương, 30/4, 1/5, Quốc khánh...). Ngày nào đã có sẵn trong lịch công ty (hoặc đã được một dòng "lặp lại hàng năm" phủ sẵn) sẽ được đánh dấu mờ đi và tự động bỏ qua, không tạo trùng. Bấm **Tạo lịch năm [XXXX]** để xác nhận — bấm lại nhiều lần cũng không sao vì hệ thống tự loại trùng.

**Thêm ngày lễ thủ công:** Bấm **Thêm ngày lễ**, điền:
- Tên ngày lễ, Loại lễ (chọn trong danh mục có sẵn, ví dụ lễ dương lịch, lễ âm lịch, nghỉ bù...), Ngày (bắt buộc).
- **Lặp lại mọi năm (theo dương lịch)**: chỉ bật được với ngày lễ dương lịch cố định. Lễ âm lịch (ngày dương đổi mỗi năm) và Nghỉ bù (gắn với một dịp cụ thể của đúng năm đó) hệ thống tự khóa ô này lại vì không lặp lại được — phải tạo lại từng năm.
- **Có lương**: tick nếu nhân viên nghỉ ngày này vẫn được tính đủ công (ảnh hưởng tới cách tính ngày công chuẩn ở phương pháp "tự đếm theo ngày thực tế").
- Ghi chú.

Sửa/xóa từng ngày lễ bằng các biểu tượng ở cuối dòng.

---

## 4. Cài đặt lương

Vào **HRM › Cài đặt lương**, có 2 tab con: **Danh mục lương & phụ cấp** và **Set lương**.

### 4.1 Danh mục khoản lương

Đây là nơi khai ra "sổ tay" các khoản lương/phụ cấp mà công ty có thể trả cho nhân viên — mọi khoản dùng trong Cấu trúc lương, Set lương, và các màn nhập liệu ở khu "Dữ liệu tính lương" (Thưởng, Lương sản phẩm, Lương phần trăm...) đều lấy từ đúng danh mục này.

Màn hình chia 2 cột: cột trái là **"Tạo danh mục"** liệt kê 7 loại khoản (bấm dấu cộng ở mỗi loại để tạo khoản mới đúng loại đó, bấm vào tên loại để lọc bảng bên phải chỉ hiện khoản thuộc loại đó); cột phải là bảng danh sách toàn bộ khoản đã tạo.

**7 loại khoản lương, ý nghĩa từng loại:**

| Loại | Ý nghĩa nghiệp vụ |
|---|---|
| **Lương/Phụ cấp** | Khoản trả cố định hằng tháng theo hợp đồng (ví dụ lương cơ bản, phụ cấp trách nhiệm). |
| **Lương hỗ trợ** | Hỗ trợ ăn ca, xăng xe, điện thoại — không tính vào gốc đóng BHXH. |
| **Lương nghiệm thu** | Trả theo khối lượng công việc đã nghiệm thu. |
| **Lương phần trăm** | Hoa hồng tính theo tỷ lệ % trên doanh số. |
| **Lương KPI** | Trả theo mức hoàn thành chỉ tiêu công việc. |
| **Lương thưởng** | Thưởng lễ, tết, thành tích — trả không định kỳ. |
| **Lương chuyên cần** | Trả khi đi làm đủ công, không nghỉ không phép. |

**Thêm một khoản:** Bấm dấu cộng cạnh loại muốn tạo (hoặc bấm tên loại để lọc rồi dùng nút tạo tương ứng). Điền:
- Tên khoản (bắt buộc).
- Ghi chú/Mô tả.
- Tỷ lệ mặc định (%) — chỉ hiện với loại "Lương phần trăm", là tỷ lệ hoa hồng gợi ý khi áp cho một nhân viên (mỗi người vẫn sửa lại tỷ lệ riêng được).
- **Tính vào lương đóng BHXH**: tick nếu khoản này cộng vào gốc tính BHXH và phí công đoàn — chỉ có ở một số loại (không hiện với "Lương hỗ trợ" vì loại này mặc định không tính BHXH).
- **Chịu thuế TNCN**: tick nếu khoản này cộng vào thu nhập chịu thuế thu nhập cá nhân. **Đây chính là cách đánh dấu "miễn thuế TNCN"** cho một khoản — chỉ cần KHÔNG tick ô này.

Bấm **Tạo khoản** (hoặc **Lưu thay đổi** khi sửa). Khi sửa còn có thêm ô Trạng thái — chuyển "Ngừng" thay vì xóa hẳn nếu khoản đã áp cho các kỳ lương cũ (giữ lại để bảng lương cũ vẫn đọc được tên khoản).

**Đánh dấu "phụ cấp ăn trưa" (để được miễn thuế theo trần 730.000đ ở Mục 3.1.j):** hiện tại việc đánh dấu này do bộ phận kỹ thuật thiết lập sẵn ở phía hệ thống khi khởi tạo danh mục cho công ty, **chưa có ô tick riêng trên màn hình "Danh mục khoản lương"** để kế toán tự đánh dấu — nếu công ty cần đổi khoản nào là phụ cấp ăn trưa, cần báo bộ phận kỹ thuật hỗ trợ (đây là điểm cần bổ sung giao diện ở đợt phát triển sau).

### 4.2 Cấu trúc lương

Nằm trong tab **Set lương**, phần trên cùng — đây là "khuôn mẫu" chung của công ty, gồm những khoản nào sẽ xuất hiện trong bảng lương của mọi nhân viên.

**Thời gian hiệu lực:** Điền "Từ ngày" (bắt buộc), "Đến ngày" (để trống nếu áp dụng vô thời hạn), Ghi chú.

**Cấu trúc lương (bảng các khoản):** Bấm **"Thêm khoản có sẵn"**, chọn một khoản từ Danh mục khoản lương (Mục 4.1) chưa được đưa vào cấu trúc. Với mỗi khoản trong bảng, bạn khai:
- **Phân loại**: TNCN hoặc Miễn thuế — mặc định kế thừa theo cờ "Chịu thuế TNCN" đã khai ở danh mục, sửa lại được riêng cho cấu trúc này.
- **Tăng ca**: bật/tắt — khoản này có được tính làm gốc quy đổi tăng ca hay không.
- **Tiêu thức tính**: Cố định theo tháng / Theo ngày công thực tế / Theo giờ công / Theo sản lượng nghiệm thu / Theo doanh số (%) / Theo mức hoàn thành KPI / Nhập tay từng kỳ.
- **Tiền lương/phụ cấp**: mức mặc định (VNĐ) của khoản này.

Bảng tự cộng "Tổng mức mặc định" ở dòng cuối. Xóa một khoản khỏi cấu trúc bằng biểu tượng thùng rác ở cuối dòng. Sửa xong bấm **Lưu cấu trúc lương** ở thanh nút phía trên (có 3 nút Tải file mẫu/Nhập Excel/Xuất Excel hiện đang chưa nối chức năng thật, bấm sẽ chỉ hiện thông báo "sẽ nối ở bản sau"; nút **Duyệt lương** dùng để duyệt hàng loạt các bản set lương đang chờ duyệt).

### 4.3 Set lương nhân viên

Nằm dưới phần Cấu trúc lương trong cùng tab **Set lương** — đây là nơi gán **mức lương cụ thể của từng người** theo đúng các khoản đã khai ở Cấu trúc lương.

**Xem danh sách:** 2 nút lọc "Đã set lương" / "Chưa set lương" (kèm số đếm), có thể lọc thêm theo phòng ban, loại hợp đồng, hoặc tìm theo mã/tên/số tài khoản. Bảng hiện: mã NV, họ tên, chức vụ, loại hợp đồng, số lần đã thiết lập, thời gian hiệu lực, số tài khoản, tổng lương, và trạng thái: **Nháp** (đang soạn) / **Chờ duyệt** / **Đã duyệt**.

**Thiết lập lương cho một người:** Bấm biểu tượng bút chì ở dòng nhân viên (hoặc "Xem" nếu chỉ muốn xem, không sửa). Hộp thoại hiện đúng danh sách khoản trong Cấu trúc lương, mỗi dòng điền sẵn mức mặc định của cấu trúc (hoặc mức đã set trước đó nếu có) — bạn chỉ cần sửa lại số tiền riêng cho người này ở cột "Số tiền". Bảng tự cộng ra "Tổng lương". Bấm **Lưu** — bản set lương chuyển ngay về trạng thái **Chờ duyệt**, kể cả khi trước đó đã ở trạng thái Đã duyệt (mọi lần sửa đều cần duyệt lại).

**Duyệt lương:** dùng nút **Duyệt lương** ở phần Cấu trúc lương (Mục 4.2) để duyệt hàng loạt các bản đang Chờ duyệt.

**Xóa set lương của một người:** bấm biểu tượng thùng rác ở dòng đó — nhân viên sẽ quay lại danh sách "Chưa set lương".

---

## 5. Dữ liệu tính lương

Vào **HRM › Dữ liệu tính lương**. Đây là khu nhập liệu chi tiết theo từng kỳ lương (chấm công, tăng ca, thưởng...), gồm 8 tab con: **Chấm công, Tăng ca, KPI, Thưởng, Lương sản phẩm, Lương phần trăm, Lương chuyên cần, Các khoản ứng - bù trừ lương**.

### Bắt buộc chọn Kỳ lương trước

Ngay phía trên dải tab con, luôn có thanh **"Kỳ lương"** — đây là điều kiện bắt buộc trước khi nhập bất kỳ mục nào trong khu này (thanh này cũng xuất hiện y hệt ở khu "Bảng lương" ở Mục 6, và nhớ chung một kỳ đang chọn giữa hai khu).

- **Chọn kỳ lương đang có**: dùng ô dropdown liệt kê các kỳ đã tạo (ví dụ "Kỳ lương tháng 9/2026").
- **Tạo kỳ lương mới**: bấm **Tạo kỳ mới**, chọn Tháng, Năm, Tên kỳ lương (tự gợi ý theo tháng/năm, sửa lại được), bấm **Tạo kỳ lương**.
- **Trạng thái kỳ lương** hiện ngay cạnh ô chọn bằng nhãn màu: **Bản nháp** (đang mở, nhập liệu bình thường) → **Chờ duyệt** → **Đã khóa sổ** (khóa, không sửa được nữa) → **Đã duyệt** → **Đã chi trả** → **Lưu trữ**. Lưu ý: bước **Khóa sổ** có thể thực hiện thẳng từ Bản nháp (bỏ qua Chờ duyệt) hoặc từ Chờ duyệt — không bắt buộc phải trình duyệt trước mới khóa sổ được; nhưng **Duyệt kỳ lương chỉ thực hiện được khi kỳ đã ở đúng trạng thái Đã khóa sổ**, chưa khóa sổ thì chưa duyệt được.
- Khi kỳ đang ở **Bản nháp**, có 2 nút: **Khóa sổ** (chốt số liệu ngay, chuyển thẳng sang Đã khóa sổ) và **Trình duyệt** (gửi kỳ sang trạng thái Chờ duyệt để người khác xét duyệt số liệu trước khi khóa sổ).
- Khi kỳ đang **Chờ duyệt**, có 2 nút: **Từ chối** (trả kỳ về Bản nháp để sửa lại số liệu) và **Khóa sổ** (chốt số liệu, chuyển sang Đã khóa sổ).
- Khi kỳ đã **Đã khóa sổ**, có 2 nút: **Mở lại kỳ lương** (bấm vào phải nhập **lý do giải trình tối thiểu 20 ký tự** — bắt buộc theo quy định kiểm toán — rồi mới mở lại được về Bản nháp để sửa tiếp) và **Duyệt kỳ lương** (chuyển kỳ sang Đã duyệt).
- Khi kỳ **đã khóa sổ hoặc đang chờ duyệt**, toàn bộ màn hình nhập liệu bên dưới sẽ hiện cảnh báo màu vàng và **khóa lại, không cho sửa**. Muốn chỉnh lại số liệu: kỳ đang **Chờ duyệt** thì bấm **Từ chối** để trả về Bản nháp; kỳ đã **Đã khóa sổ** thì bấm **Mở lại kỳ lương** (kèm lý do ≥ 20 ký tự).

### Cách làm việc chung của 8 tab (trừ Chấm công)

Bảy tab Tăng ca, KPI, Thưởng, Lương sản phẩm, Lương phần trăm, Lương chuyên cần, Ứng-bù trừ đều theo đúng một khuôn mẫu thao tác:

1. **Soạn một "bảng nháp"** ở phần trên — mỗi dòng là một khoản/loại + số liệu tương ứng (ví dụ "Tăng ca ngày thường ban ngày — 10 giờ"). Bấm **Thêm dòng** để thêm, biểu tượng thùng rác để xóa từng dòng, **Xóa tất cả** để xóa sạch bảng nháp.
2. **Chọn phạm vi áp dụng** ở phần dưới: **Nhân viên** (lọc theo tìm kiếm/phòng ban/loại hợp đồng, áp cho đúng danh sách đang lọc ra), **Phòng ban** (áp cho cả một phòng ban), hoặc **Toàn công ty**.
3. Bấm nút **"Áp dụng [tên nghiệp vụ]"** — hệ thống ghi bảng nháp đang soạn cho TOÀN BỘ nhân viên đang hiện trong danh sách đã lọc ở bước 2. Hộp thoại xác nhận sẽ nói rõ áp cho bao nhiêu người, theo phạm vi nào, và cảnh báo dữ liệu cũ của những người này (nếu có) sẽ bị **thay thế**.
4. Có thể **Tái sử dụng** — chép lại bảng của một nhân viên đã áp trong kỳ này (tiện khi cả tổ có cùng số liệu, chỉ cần sửa vài số) thay vì gõ lại từ đầu.
5. Có thể **Tải mẫu / Nhập Excel / Xuất Excel** để làm việc theo file thay vì nhập tay từng dòng trên web.
6. Nút **"Quản lý [tên nghiệp vụ]"** mở ra danh mục các loại/chỉ tiêu dùng trong bảng nháp (xem chi tiết riêng từng tab bên dưới) — đây là nơi tạo mới loại/chỉ tiêu nếu danh mục chưa có sẵn cái bạn cần.

Danh sách bên dưới cho biết ai đã có dữ liệu trong kỳ, có nút xóa riêng cho từng người.

### 5.1 Chấm công

Khác các tab còn lại — đây là bảng lưới trực tiếp theo ngày, không qua bước "bảng nháp rồi áp dụng".

Bảng hiện mỗi hàng là một nhân viên đang làm việc, mỗi cột là một ngày trong tháng của kỳ lương đang chọn. Ô nào tô màu đỏ nhạt là ngày lễ, tô vàng nhạt là ngày nghỉ theo lịch (thứ 7/chủ nhật theo chính sách đã khai ở Cấu hình mặc định). Ô chưa chỉnh tay sẽ tự đọc theo lịch chuẩn — nghĩa là bạn chỉ cần sửa những ngày khác thường (nghỉ phép, ốm, đi công tác...), phần lớn còn lại hệ thống đã tự tính đúng.

**Chấm một ô:** Bấm vào ô ngày cần chấm cho đúng nhân viên, một bảng chọn nhỏ hiện lên ngay tại ô đó với 8 loại công (bấm chọn bằng chuột hoặc gõ phím tắt 1-8 khi bảng đang mở):

| Phím | Loại công | Ký hiệu | Có tính vào ngày công không |
|---|---|---|---|
| 1 | Làm việc | 1 | Có |
| 2 | Nửa ngày | 1/2 | Có (nửa công) |
| 3 | Công tác | CT | Không |
| 4 | Nghỉ phép | P | Không |
| 5 | Nghỉ lễ | NL | Không |
| 6 | Ốm | O | Không |
| 7 | Không lương | X | Không |
| 8 | Khác | K | Không |

Có thể nhập thêm **số giờ làm cụ thể** (chỉ áp dụng với loại có tính công), tối đa bằng giờ công chuẩn/ngày đã khai ở Cấu hình mặc định. Bấm **Lưu** trong bảng chọn (hoặc phím Enter) để ghi lại, **Xóa ô** để đưa ô về đúng giá trị mặc định theo lịch (không phải xóa trắng hoàn toàn).

Cuối mỗi hàng, bảng tự tổng hợp: **Ngày công chuẩn** (của cả tháng, đã trừ ngày lễ/nghỉ theo cấu hình), **Ngày công thực tế** (tô đỏ nếu thiếu so với chuẩn, tô xanh nếu dư), và số ngày theo từng loại công (nghỉ phép, ốm, không lương...).

### 5.2 Tăng ca

**Bảng tăng ca (nháp):** mỗi dòng chọn "Loại tăng ca" (Ngày thường/Chủ nhật/Ngày lễ × Ban ngày/Ban đêm — 6 loại, mỗi loại chỉ dùng được một dòng trong cùng bảng) và nhập "Số giờ OT". Cột "Quy đổi" tự tính = Số giờ OT × hệ số của loại (hệ số lấy từ Cấu hình mặc định, Mục 3.1.c — KHÔNG sửa được ở đây, chỉ sửa qua nút "Quản lý tăng ca"). Bảng tự cảnh báo nếu tổng giờ vượt trần giờ tăng ca/tháng đã khai.

**Quản lý tăng ca:** mở đúng các ô hệ số và trần giờ tăng ca ở Cấu hình mặc định (Mục 3.1.c, 3.1.d) ngay tại đây cho tiện, sửa ở đây tức là sửa cho toàn công ty (không phải riêng màn hình này).

**Danh sách nhân viên áp tăng ca:** ngoài số giờ theo tháng, còn có cột **"Tổng giờ năm"** — đối chiếu với ngưỡng cảnh báo/vượt mức năm; và cột "Quy đổi" cho biết số giờ công đã nhân hệ số (đây là con số thật sự nhân với đơn giá để ra tiền tăng ca trong bảng lương).

### 5.3 KPI

**Danh mục chỉ tiêu KPI:** bấm **Quản lý KPI**, tạo chỉ tiêu với Tên chỉ tiêu, Đơn vị (đồng, đơn, %...), Trọng số mặc định, Ghi chú.

**Bảng KPI (nháp):** mỗi dòng chọn một Chỉ tiêu (đã có ở danh mục), nhập Trọng số (mượn theo trọng số mặc định nếu để trống), Mục tiêu, Thực thi — cột **"Tỉ lệ HT"** tự tính = Thực thi / Mục tiêu (%). Phía trên bảng có Chip tổng trọng số (nên bằng 100, khác thì chỉ cảnh báo màu vàng chứ không chặn — có công ty chấm theo thang khác) và Chip "Hiệu suất chung" = bình quân theo trọng số của các chỉ tiêu.

### 5.4 Thưởng

**Danh mục loại thưởng:** bấm **Quản lý thưởng** — đây chính là các khoản thuộc loại "Lương thưởng" trong Danh mục khoản lương (Mục 4.1), mở ngay tại đây cho tiện, tạo/sửa một khoản ở đây cũng chính là sửa trong danh mục chung.

**Bảng thưởng (nháp):** mỗi dòng chọn Loại thưởng, nhập **Số tiền** (mức của MỘT nhân viên). Cột "Thành tiền" = Số tiền × số nhân viên đang chọn ở phạm vi áp dụng — giúp thấy ngay tổng quỹ thưởng sẽ chi trước khi bấm Áp dụng.

### 5.5 Lương sản phẩm

**Danh mục sản phẩm:** bấm **Quản lý sản phẩm**, tạo sản phẩm với Tên sản phẩm, Đơn vị tính, Đơn giá mặc định, Ghi chú.

**Bảng lương sản phẩm (nháp):** mỗi dòng chọn Sản phẩm, Đơn giá (mượn theo bảng giá danh mục, sửa được riêng cho dòng này — có cảnh báo nếu lệch bảng giá gốc, không chặn vì đơn giá kỳ trước có thể khác kỳ này), Số lượng nghiệm thu. Thành tiền = Đơn giá × Số lượng.

### 5.6 Lương phần trăm

**Danh mục loại %:** bấm **Quản lý phần trăm** — cũng là các khoản thuộc loại "Lương phần trăm" trong Danh mục khoản lương (Mục 4.1).

**Bảng lương phần trăm (nháp):** mỗi dòng chọn Loại %, Tỉ lệ % (mượn theo tỷ lệ mặc định của khoản, sửa riêng được), Số tiền cơ sở (doanh số làm gốc tính hoa hồng). Thành tiền = Số tiền cơ sở × Tỉ lệ %.

### 5.7 Chuyên cần

Khác các tab khác ở chỗ: mỗi dòng trong bảng nháp là **một LẦN vi phạm cụ thể**, không phải một tổng số — đi trễ 3 hôm khác ngày thì phải ghi 3 dòng riêng.

**Danh mục loại chuyên cần:** bấm **Quản lý chuyên cần**, tạo loại vi phạm với Tên loại, **Cách trừ** (3 kiểu: "Trừ theo giờ" — trừ theo đơn giá ₫/giờ nhân với số giờ trễ/nghỉ; "Trừ trọn mức mỗi lần" — trừ cố định ₫/lần bất kể số giờ; "Mất toàn bộ chuyên cần" — trừ đúng bằng khoản chuyên cần của riêng từng người, không khai mức trừ), Mức trừ (ẩn nếu chọn "Mất toàn bộ"), Ghi chú.

**Bảng chuyên cần (nháp):** mỗi dòng chọn Loại chuyên cần, Số giờ trễ/nghỉ (chỉ có ý nghĩa với cách trừ "Trừ theo giờ", các cách khác vẫn nhập được nhưng ghi chú rõ "không tính vào tiền trừ" — chỉ để lưu vết biên bản), Ngày vi phạm (bắt buộc). Vì mức trừ của loại "Mất toàn bộ" khác nhau theo từng người, bảng nháp không hiện cột tiền — số tiền thật xem ở bảng danh sách nhân viên bên dưới (cột Đơn giá → Tổng trừ → Thành tiền).

Áp bảng **trống** (không có dòng nào) cũng là một thao tác hợp lệ — nghĩa là chốt "kỳ này không vi phạm", nhân viên nhận đủ khoản chuyên cần.

### 5.8 Các khoản ứng - bù trừ lương

Dùng cho tạm ứng lương, các khoản khấu trừ hoặc bù thêm ngoài lương chính thức.

**Danh mục khoản bù trừ:** bấm **Quản lý khoản bù trừ**, tạo khoản với Tên khoản, **Chiều** ("Trừ vào lương" hoặc "Bù thêm vào lương" — quyết định dấu cộng/trừ khi gộp vào bảng lương), Ghi chú.

**Bảng bù trừ (nháp):** mỗi dòng chọn Khoản bù trừ, nhập Số tiền.

> Lưu ý quan trọng: đây là màn hình dễ gây hậu quả nhất trong khu Dữ liệu tính lương vì số tiền ở đây thường là tiền đã tạm ứng thật cho từng cá nhân riêng lẻ — áp nhầm cho cả phòng ban là trừ oan tiền của người không hề tạm ứng. Hộp thoại xác nhận khi bấm "Áp dụng bù trừ" luôn nhắc lại rõ số tiền và số người sẽ bị ghi; hãy kiểm tra kỹ danh sách phạm vi áp dụng trước khi xác nhận, đặc biệt khi phạm vi không phải "Nhân viên" đơn lẻ.

---

## 6. Bảng lương

Vào **HRM › Bảng lương**, có thanh **Kỳ lương** giống hệt Mục 5 ở trên (dùng chung kỳ đang chọn với khu Dữ liệu tính lương), và 2 tab con: **Bảng lương** và **Lương hỗ trợ**.

Đây là màn hình **chỉ xem kết quả**, mọi con số đã được máy chủ tự tính sẵn từ Hợp đồng, Cài đặt lương, Chấm công và toàn bộ dữ liệu đã nhập ở khu "Dữ liệu tính lương" — không có ô nhập tay nào ở đây.

### 6.1 Bảng lương tổng hợp

**3 thẻ tổng số** ở đầu trang: Tổng quỹ lương (gồm cả bảo hiểm và kinh phí công đoàn phần công ty đóng), Tổng thực lĩnh (số tiền thực trả cho nhân viên), Tổng thuế TNCN (khấu trừ nộp thay nhân viên).

**Đọc bảng (18 cột):** bảng khá rộng nên có thể cuộn ngang — 2 cột đầu (Họ và tên, Bộ phận/Chức vụ) luôn dính lại bên trái để không mất dấu đang xem lương của ai. Ý nghĩa gộp các nhóm cột chính:

| Nhóm cột | Ý nghĩa |
|---|---|
| Họ và tên, Bộ phận/Chức vụ, NPT | Thông tin định danh và số người phụ thuộc đang giảm trừ. |
| Lương, Ngày công, Giờ tăng ca, Tiền tăng ca, Lương theo ngày, Lương theo sản phẩm, Thưởng, KPI | Các khoản thu nhập theo từng nguồn, khớp với dữ liệu đã nhập ở khu Dữ liệu tính lương. |
| **Thu nhập** | Tổng toàn bộ các khoản thu nhập cộng lại — **di chuột vào số này sẽ hiện chú thích (tooltip)** liệt kê đủ 7 khoản cấu thành: Lương theo ngày, Tăng ca, Sản phẩm, Thưởng, KPI, Lương % và Chuyên cần. Hai khoản Lương % và Chuyên cần không có cột riêng trên bảng, chỉ thấy được qua tooltip này. |
| Bảo hiểm, Công đoàn, KPCĐ (cty) | Các khoản trích nộp bảo hiểm/công đoàn. |
| Các khoản bù trừ | Tổng các khoản ứng/bù trừ đã áp ở Mục 5.8 — số màu đỏ có dấu trừ là bị khấu trừ, số màu xanh có dấu cộng là được bù thêm. |
| Thuế TNCN | Số thuế thu nhập cá nhân phải khấu trừ trong kỳ. |
| **Thực lĩnh** | Số tiền cuối cùng nhân viên thực nhận. Nếu số này âm (hiện màu đỏ) nghĩa là khoản tạm ứng trong kỳ vượt quá lương được nhận, nhân viên đang còn nợ lại công ty. |

**Chế độ hiển thị:** đổi ô "Chế độ" để xem theo GROSS hay NET tùy nhu cầu đối chiếu; đổi ô "Chi tiết" sang **"Rút gọn"** nếu chỉ cần xem các cột chính (ẩn bớt cột phụ, vẫn giữ đủ Thu nhập/Bảo hiểm/Bù trừ/Thuế/Thực lĩnh).

**Tính lại lương / Tải lại số liệu:** khi kỳ đang **Bản nháp**, nút này ghi là "Tính lại lương" — bấm để tính lại ngay theo dữ liệu nguồn mới nhất (dùng sau khi vừa sửa chấm công, tăng ca... ở khu Dữ liệu tính lương). Khi kỳ **đã khóa sổ**, nút đổi thành "Tải lại số liệu" và bảng lương đọc từ **bản chốt cứng (snapshot) tại đúng lúc khóa sổ** — sẽ **không** tự tính lại dù dữ liệu nguồn có đổi sau đó. Có nhãn **"Đã khóa sổ — số liệu đã chốt"** màu vàng hiện cạnh tên kỳ để nhắc rõ điều này. Muốn sửa số liệu của một kỳ đã khóa sổ, phải quay lại thanh Kỳ lương bấm "Mở lại kỳ lương" (xem Mục 5) trước.

**Xuất Excel:** bấm **Xuất Excel** để tải file đầy đủ 18 cột theo đúng đơn vị đồng.

### 6.2 Lương hỗ trợ

Tab riêng để xem breakdown chi tiết các khoản **phụ cấp hỗ trợ** (loại "Lương hỗ trợ" ở Mục 4.1 — ăn ca, xăng xe, điện thoại, nhà ở...) mà không cần lọc trong bảng lương tổng hợp.

Số cột trong bảng này **thay đổi linh động theo Danh mục khoản lương**: mỗi khoản hỗ trợ đang "Đang dùng" là một cột riêng — thêm một khoản hỗ trợ mới ở Cài đặt lương là bảng này tự có thêm cột, không cần chỉnh gì thêm. Cột cuối "Tổng hỗ trợ" cộng tất cả các cột hỗ trợ của người đó; di chuột vào số Tổng hỗ trợ sẽ hiện chú thích cho biết mức đủ tháng là bao nhiêu và đã quy theo bao nhiêu ngày công thực tế (nếu bị cắt so với mức tháng do chấm công thiếu công thì số hiện màu cam).

Số liệu ở đây đã được quy theo ngày công, nên cộng đúng khớp với phần "hỗ trợ" nằm bên trong cột Thu nhập của tab Bảng lương (Mục 6.1) — dùng để đối chiếu chéo hai tab với nhau.

> Lưu ý: tab Lương hỗ trợ hiện **chưa có bản chốt cứng (snapshot) riêng** như tab Bảng lương — dù kỳ đã khóa sổ, số liệu ở đây vẫn tính theo dữ liệu hiện tại (tính "sống"), nên có thể lệch với tab Bảng lương nếu mức phụ cấp bị đổi sau thời điểm khóa sổ. Hệ thống sẽ tự hiện cảnh báo màu vàng nhắc điều này khi kỳ đang chọn đã khóa sổ.

---

## 7. Ví dụ minh họa thực tế (dữ liệu mẫu để thực hành)

Môi trường thử nghiệm hiện đã có sẵn một công ty mẫu, dựng đủ dữ liệu để bạn thực hành qua tất cả các màn hình ở Mục 2 đến Mục 6 mà không cần tự nhập từ đầu:

- **Công ty**: CÔNG TY TNHH ĐẦU TƯ SẢN XUẤT VÀ XNK THÀNH CÔNG — MST `0111142786`.
- **Tài khoản đăng nhập**: `test1@gmail.com` / mật khẩu `12345abc`.
- **Tổ chức**: 5 phòng ban (Kinh doanh, Kế toán, Sản xuất, Kho vận, Hành chính - Nhân sự), 16 nhân viên (rải ngẫu nhiên 2-5 người/phòng ban) với đủ loại hợp đồng, kiểu lương khác nhau để xem đa dạng tình huống.
- **Danh mục lương** đã có sẵn đủ khoản mẫu cho cả 7 loại (Lương cơ bản, Phụ cấp ăn trưa — đã đánh dấu miễn thuế theo trần 730.000đ, Phụ cấp điện thoại, Phụ cấp trách nhiệm, Lương giao hàng, Hoa hồng doanh số, Thưởng KPI, Thưởng định kỳ, Phụ cấp chuyên cần), cùng lịch nghỉ lễ đã tạo nhanh đủ 11 ngày chuẩn và 4 ca làm việc mẫu (ca hành chính, ca có tăng ca tự nhiên, ca đêm xuyên ca, ca nửa ngày sáng).
- **2 kỳ lương mẫu**:
  - Kỳ lương tháng trước (ví dụ `2026-08`) — đã **khóa sổ**, dùng để xem giao diện tab Bảng lương hiện badge **"Đã khóa sổ — số liệu đã chốt"**, nút đổi thành "Tải lại số liệu", và thử nghiệp vụ "Mở lại kỳ lương".
  - Kỳ lương tháng hiện tại (ví dụ `2026-09`) — vẫn ở trạng thái **Bản nháp**, mở sẵn để bạn thực hành nhập liệu (chấm công, tăng ca, thưởng...) và xem bảng lương tính "sống" ngay khi sửa dữ liệu nguồn.

**Cách thực hành theo đúng thứ tự của hướng dẫn này:**

1. Đăng nhập bằng tài khoản `test1@gmail.com` / `12345abc`. Nếu tài khoản có nhiều công ty, chọn đúng công ty MST `0111142786` ở góc phải thanh menu trước khi bấm **HRM**.
2. Vào **Dữ liệu nhân viên**: xem cây 5 phòng ban, mở vài hồ sơ nhân viên để xem hợp đồng/người phụ thuộc/hồ sơ tài liệu đã có sẵn (theo Mục 2).
3. Vào **Cấu hình mặc định**: xem các tham số đang set (bảo hiểm, thuế, ngày công, ca làm việc, lịch 11 ngày lễ đã tạo sẵn) — thử sửa thử một tham số rồi bấm Hoàn tác để không ảnh hưởng dữ liệu chung (theo Mục 3).
4. Vào **Cài đặt lương**: xem danh mục khoản lương mẫu, cấu trúc lương công ty, và set lương của vài nhân viên đã có sẵn (theo Mục 4).
5. Vào **Dữ liệu tính lương**, ở thanh Kỳ lương chọn kỳ tháng hiện tại (đang Bản nháp) — thử nhập chấm công, tăng ca, thưởng cho một vài nhân viên rồi bấm Áp dụng (theo Mục 5).
6. Vào **Bảng lương**, vẫn ở kỳ tháng hiện tại, bấm "Tính lại lương" để thấy số liệu vừa nhập ở bước 5 phản ánh ngay vào bảng lương; sau đó đổi thanh Kỳ lương sang kỳ tháng trước (đã khóa sổ) để so sánh giao diện khi kỳ đã chốt — nhãn "Đã khóa sổ" hiện ra, nút đổi thành "Tải lại số liệu", và mọi khu Dữ liệu tính lương của kỳ đó chuyển sang khóa, chỉ đọc (theo Mục 6).
