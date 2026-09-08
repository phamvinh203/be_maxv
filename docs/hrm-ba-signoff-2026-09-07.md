---
type: ba-signoff
feature: hrm
status: approved
updated: 2026-09-07
signed_by: phamvinh203
links:
  - docs/hrm/CONTEXT_SUMMARY.md
  - docs/hrm/srs/hrm-spec.md
  - docs/hrm/architecture/api-contract.md
  - docs/hrm/architecture/data-model.md
  - docs/hrm/qa/test-cases.md
  - docs/hrm/qa/issues-and-bugs.md
---

# HRM — BIÊN BẢN CHỐT CỦA BUSINESS ANALYST

*Phân hệ Quản lý Nhân sự · MAXV v2 · Ngày chốt 2026-09-07 · Người chốt: `phamvinh203`*

> **Kết luận một dòng:** phân hệ HRM được chốt **`Ready for Implementation` cho toàn bộ đợt P0 và P1**. **20/20** quyết định nghiệp vụ đã có lời đáp. Chỉ **đợt P2** (bộ giấy tờ bắt buộc và hạn giấy tờ) còn giữ lại, chờ hai câu hỏi về nội dung danh mục và ngưỡng cảnh báo.

---

## 1. Biên bản này chốt cái gì

| | |
|:---|:---|
| **Phạm vi** | Phòng ban · Nhân viên · Lịch sử hợp đồng lao động · Người phụ thuộc · Hồ sơ tài liệu kèm tích hợp Google Drive |
| **Cổng** | Phase 2.5 — BA Final Sign-off, theo `.claude/CLAUDE.md` |
| **Điều kiện cổng** | Đặc tả, hợp đồng API và bộ ca kiểm thử không mâu thuẫn nhau; mọi tiêu chí nghiệm thu có ca kiểm thử; mọi quyết định nghiệp vụ chặn đã có lời đáp |
| **Kết quả** | **Đạt cho P0 và P1.** Chi tiết phạm vi ở Mục 5 |

---

## 2. Bộ tài liệu tại thời điểm chốt

| Tầng | Sản phẩm | Quy mô |
|:---|:---|:---|
| Business Analyst | `srs/hrm-spec.md` · `hrm-flows.md` · `hrm-states.md` · `hrm-erd.md` | **69** quy tắc nghiệp vụ · **44** yêu cầu chức năng · **11** yêu cầu phi chức năng · **64** mã lỗi · **56** tiêu chí nghiệm thu · 15 ca sử dụng |
| Architect | `architecture/api-contract.md` · `data-model.md` · `dev-notes.md` · 7 bản ghi quyết định kiến trúc | 21 endpoint hiện có + 2 nhóm endpoint mới · **13** thay đổi cấu trúc dữ liệu (M-01…M-13) |
| Tester-QA | `qa/test-matrix.md` · `test-cases.md` · `issues-and-bugs.md` | **266** ca kiểm thử · **32** bug và issue (2 nghiêm trọng · 10 cao · 13 trung bình · 7 thấp) |

Mọi sơ đồ là **Mermaid nhúng trực tiếp trong `.md`**, theo chính sách sửa ngày 2026-09-07 (`.claude/rules/diagram-selection.md`): không sinh file `.svg` / `.puml` / `.png`, không gọi PlantUML. Toàn bộ sơ đồ đã được kiểm biên dịch, **13/13 khối hợp lệ**.

---

## 3. Đường đi tới biên bản này

| Vòng | Ngày | Việc | Kết quả |
|:---|:---|:---|:---|
| 1 | 2026-09-07 | Rà soát 3 Amigos trên mã nguồn thật | 24 bug · 16 quyết định nghiệp vụ cần chốt |
| 2 | 2026-09-07 | Chủ dự án chốt **16/16** quyết định (4 đợt đầu + 12 đợt sau) | Mọi quyết định chặn có lời đáp |
| 3 | 2026-09-07 | Cập nhật tài liệu theo 16 quyết định, **một người viết tuần tự cả ba tầng rồi tự đối soát** | Bắt được 4 lỗi. **Vòng này thiếu phản biện chéo — đó là sai sót quy trình** |
| 4 | 2026-09-07 | **Phản biện độc lập** Architect ∥ Tester-QA, hai bên không đọc kết quả của nhau, chỉ đọc không ghi | **7 bug mới · 18 nhánh nghiệp vụ bỏ sót · 2 khoảng trống bao phủ kiểm thử** |
| 5 | 2026-09-07 | Vá 5 lỗi chặn, chốt nốt **4 quyết định** nặng nhất (QĐ #17…#20), **chạy thật SQL của hai ràng buộc mới trên PostgreSQL** rồi ROLLBACK | Cổng mở cho P0 và P1 |

**Điều phải ghi lại trung thực:** nếu dừng ở vòng 3, kỹ sư đã được khởi chạy với một đặc tả trong đó **quyền xem lương chặn được nhưng không cấp được cho ai**, **ràng buộc chống chồng lấn không bảo vệ được nghiệp vụ**, và **quyết định nghiêm trọng nhất về thuế thu nhập cá nhân không có một ca kiểm thử nào**. Vòng 4 là thứ đã ngăn điều đó, và nó chỉ diễn ra vì chủ dự án hỏi lại "đã bàn giao cho Architect và Tester-QA chưa".

---

## 4. Hai mươi quyết định nghiệp vụ đã chốt

| # | Nội dung | Chốt |
|:--:|:---|:---|
| 1 | Hai hợp đồng đồng thời | Cho phép — chỉ chặn trùng **cùng loại** |
| 2 | Hợp đồng ký trước cho tương lai | Tính là hiện hành ngay khi ký |
| 3 | Nghỉ việc | Bắt buộc nhập ngày nghỉ, hệ thống tự chốt hợp đồng |
| 4 | Số hợp đồng | Duy nhất toàn công ty |
| 5 | Ràng buộc lương | Lương chính lớn hơn 0; bật BHXH thì lương BHXH lớn hơn 0 |
| 6 | Hợp đồng một ngày | Cho phép |
| 7 | Người phụ thuộc trùng mã số thuế | Cấm — duy nhất toàn công ty |
| 8 | Ai được xem lương | Tách quyền riêng bên trong phạm vi nhân viên của chủ tài khoản |
| 9 | Vai trò quản trị hệ thống | Không có phạm vi công ty — **chủ ý**, giữ nguyên |
| 10 | Nối Google Drive | Chỉ chủ tài khoản nối và ngắt; nối xong ai cũng dùng được |
| 11 | Phòng ban ngừng hoạt động | Cảnh báo rồi cho; ẩn khỏi ô chọn trừ phòng đang gán |
| 12 | Xóa dòng giấy tờ có file | Xóa luôn file trên Drive, kiểu cố hết sức |
| 13 | File scan khi xóa mềm nhân viên | Giữ nguyên, chưa đặt thời hạn lưu trữ |
| 14 | Hồ sơ đủ/thiếu và hạn giấy tờ | Làm đủ cả hai |
| 15 | Nhật ký thao tác | Ghi 5 nhóm thao tác phá hủy và sửa lương; không ghi giá trị trước/sau |
| 16 | Ngưỡng hiệu năng | Chưa đặt số — đo thực tế trước |
| **17** | Mặc định quyền xem lương khi bật | Giữ nguyên người cũ, siết người mới |
| **18** | "Khác loại" hợp đồng hiểu theo nghĩa nào | Theo **nhóm nghiệp vụ**, ba nhóm |
| **19** | Người phụ thuộc chuyển giữa hai nhân viên | Duy nhất **có xét kỳ giảm trừ** |
| **20** | Đổi tên đường dẫn API sang tiếng Anh | **Hoãn** — contract về tiếng Việt |

Bốn quyết định cuối (#17…#20) sinh ra từ vòng phản biện độc lập và là bốn câu chặn nặng nhất. Chốt chúng là điều đã mở được cổng cho toàn bộ P0 và P1.

---

## 5. QUYẾT ĐỊNH CHỐT — phạm vi được phép triển khai

### 5.1. ✅ Được khởi chạy: toàn bộ đợt P0 và P1

| # | Hạng mục | Điều kiện bắt buộc kèm theo |
|:--:|:---|:---|
| 1 | **Chống chồng lấn hợp đồng** — hàm dùng chung cho cả ba đường ghi, khóa theo cặp (nhân viên, **nhóm nghiệp vụ**), khoảng ngày đóng hai đầu | Dùng hàm gom nhóm dùng chung, **không** khóa theo nhãn thô. Làm **cùng lượt** với việc thay mốc giờ UTC bằng mốc giờ Việt Nam — sửa một trong hai thì hai hàm bất đồng bảy tiếng mỗi ngày |
| 2 | **Hai ràng buộc duy nhất**: số hợp đồng toàn công ty, và người phụ thuộc theo (mã số thuế, kỳ giảm trừ) | Gộp **một đợt rà dữ liệu**. Dùng câu quét **có xét kỳ** ở M-09; câu quét cũ vừa báo thừa vừa thiếu bối cảnh |
| 3 | **Ràng buộc lương** | Rà và dọn dữ liệu cũ lương bằng 0 **trước khi** bật |
| 4 | **Quyền xem dữ liệu lương** | Ship **cùng một lượt bốn thứ**: cột quyền, bước chuyển dữ liệu cấp cho người cũ, đổi cách ghi phân quyền sang ghi theo cặp khóa, và màn cấp quyền. Thiếu một là hoặc không cấp được, hoặc mất quyền âm thầm |
| 5 | **Bắt buộc gửi trạng thái khi sửa nhân viên** | Bịt đường âm thầm đưa người đã nghỉ trở lại đang làm |
| 6 | **Toàn bộ đợt P1** | Ghi nhận nghỉ việc, guard phòng ban, xóa tài liệu kèm file Drive, siết quyền Drive, nhật ký thao tác, bọc giao dịch cho sinh mã |

**Đường dẫn API dùng tiếng Việt**, khớp mã nguồn và giao diện. Đợt đổi tên sang tiếng Anh đã hoãn.

### 5.2. 🔴 Giữ lại

| Hạng mục | Vì sao | Mở khi |
|:---|:---|:---|
| **Đợt P2 — bộ giấy tờ bắt buộc và hạn giấy tờ** | Quyết định #14 chốt "làm cả hai" nhưng không chốt **nội dung** danh mục giấy tờ bắt buộc, cũng không chốt **ngưỡng** cảnh báo sắp hết hạn. Dựng khả năng khai báo thì làm được, nhưng bật cảnh báo mà tự đặt ngưỡng là cảnh báo sai — người dùng sẽ học cách bỏ qua nó | **OQ-hrm-13** và **OQ-hrm-14** |

### 5.3. Bằng chứng đã chạy thật

Hai ràng buộc mới của QĐ #18 và QĐ #19 dùng **biểu thức hàm làm phần tử khóa** trong ràng buộc loại trừ — cú pháp dễ sai và không suy đoán được. Đã chạy thật trên PostgreSQL ngày 2026-09-07, toàn bộ trong một giao dịch rồi ROLLBACK, **không ghi gì vào cơ sở dữ liệu**:

| Kiểm | Kết quả |
|:---|:---|
| Cú pháp: extension, hai hàm, hai ràng buộc loại trừ có biểu thức và có mệnh đề lọc | **7/7 hợp lệ** |
| Hợp đồng khoán chạy song song hợp đồng lao động | **Được nhận** — đúng QĐ #1 |
| Hợp đồng *xác định* chồng hợp đồng *không xác định* (khác nhãn, **cùng nhóm**) | **Bị chặn** — đúng QĐ #18; khóa theo nhãn thô thì ca này lọt |
| Nhãn viết hoa `Khoan` chồng `khoan` | **Bị chặn** — hàm gom nhóm hạ chữ thường bên trong |
| Người phụ thuộc kỳ **nối tiếp** (tới hết tháng 6 / từ tháng 7) | **Được nhận** — đúng QĐ #19, ca chuyển người kê khai giữa năm |
| Người phụ thuộc kỳ **giao nhau ở tháng 6** | **Bị chặn** |
| Người phụ thuộc **chưa có mã số thuế**, nhiều dòng | **Được nhận** |

Hệ quả đáng chú ý: hàm gom nhóm tự hạ chữ thường, nên ràng buộc ở tầng cơ sở dữ liệu **an toàn ngay cả trước khi** tầng kiểm dữ liệu được sửa để chuẩn hóa.

## 6. Điều kiện cổng — đối chiếu trung thực

| Điều kiện | Đạt? | Ghi chú |
|:---|:---:|:---|
| Đặc tả, hợp đồng API và bộ ca kiểm thử không mâu thuẫn | ✅ **Đạt** | Đã giải hết: xung đột mã lỗi, gán nhầm mã bug, tên cơ sở dữ liệu tenant, trích dẫn dòng bịa, cơ chế migration, mâu thuẫn M-09, và đường dẫn API |
| Mọi quyết định nghiệp vụ chặn đã có lời đáp | ✅ **Đạt** | 20/20. Còn 20 câu hỏi mở nhưng **không câu nào chặn P0 hoặc P1** — bốn câu chặn nặng nhất đã chốt thành QĐ #17…#20 |
| Mọi tiêu chí nghiệm thu có ca kiểm thử | ⚠️ **Một phần** | Đã bổ sung nhóm ca cho QĐ #7 và ba mã lỗi kỹ thuật. **Còn nợ:** bốn tiêu chí phủ thiếu vế, và cột truy vết tiêu chí ↔ ca cho các nhóm 6B.1–6B.10 |
| Bộ ca kiểm thử chạy được ở Phase B | ❌ **Chưa** | `be_maxv/src/__tests__/` có 41 file, **0 file HRM**. Chưa có mẫu giả lập đồng hồ, chưa có mẫu giả lập gọi Google, ba ứng dụng giao diện **không có bộ chạy test nào** |

**Hai điều kiện chưa đạt là điều kiện của Phase B, không phải của Phase 3.** Chúng **không chặn Backend và Frontend viết code**, nhưng **chặn nghiệm thu**. Ghi rõ ở đây để không ai coi việc mở cổng là đã xong phần kiểm thử.

## 7. Việc còn lại

### 7.1. Trước khi nghiệm thu Phase B

| # | Việc | Chủ trì |
|:--:|:---|:---|
| 1 | Dựng **một file test HRM mẫu** kèm mẫu giả lập đồng hồ và mẫu giả lập gọi Google — không có mẫu thì 266 ca vẫn thuần giấy | QA, Backend |
| 2 | Bổ sung cột truy vết tiêu chí nghiệm thu cho các nhóm ca 6B.1–6B.10 | QA |
| 3 | Rà lại hai nhóm ca cũ có kỳ vọng lỗi thời (chồng lấn hợp đồng; trùng mã số thuế người phụ thuộc) — chạy nguyên trạng sẽ báo sai | QA |
| 4 | Phủ nốt bốn tiêu chí nghiệm thu còn thiếu vế | QA |
| 5 | Đo thật: `prisma db push` có xóa ràng buộc tạo tay không — quyết định lớp phòng thủ ở tầng cơ sở dữ liệu | Backend |

### 7.2. Để mở đợt P2

Trả lời **OQ-hrm-13** (bộ giấy tờ bắt buộc gồm những loại nào cho từng loại hợp đồng, ai được sửa danh mục) và **OQ-hrm-14** (ngưỡng "sắp hết hạn" bao nhiêu ngày, khai ở đâu).

### 7.3. Nợ kỹ thuật đã ghi nhận

Ràng buộc người phụ thuộc ở tầng cơ sở dữ liệu **chặt hơn** luật nghiệp vụ một chút: nó không bỏ qua được dòng thuộc nhân viên đã xóa mềm, vì ràng buộc loại trừ không tham chiếu được bảng khác. Chấp nhận cho đợt này — hệ quả xấu nhất là một ca hiếm bị chặn kèm thông báo chung chung, đổi lại không phải nuôi trigger đồng bộ cờ xóa mềm.

## 8. Dấu vết

| Nội dung | Nơi lưu |
|:---|:---|
| Nhật ký 16 quyết định nghiệp vụ, kèm hệ quả kỹ thuật từng quyết định | `docs/hrm/CONTEXT_SUMMARY.md` Mục 6.1 |
| Kết quả vòng cập nhật tài liệu và bốn phát hiện tự đối soát | `docs/hrm/CONTEXT_SUMMARY.md` Mục 8 |
| Kết quả vòng phản biện độc lập và phạm vi khởi chạy đã thu hẹp | `docs/hrm/CONTEXT_SUMMARY.md` Mục 9 |
| Bảy bug mới, khoảng trống kiểm thử, rào cản hạ tầng | `docs/hrm/qa/issues-and-bugs.md` Mục 7 |
| Kế hoạch hành động Sprint 0b | `docs/hrm/qa/issues-and-bugs.md` Mục 5 |
| 24 câu hỏi mở | `docs/hrm/srs/hrm-spec.md` Mục 15.1 và 15.1b |
| Quyết định về quyền xem lương và phạm vi vai trò quản trị | `docs/hrm/architecture/adr/ADR-007-pham-vi-quyen-xem-du-lieu-luong.md` |
| Cơ chế áp ràng buộc cho cơ sở dữ liệu từng công ty | `docs/hrm/architecture/data-model.md` Mục 8.0 |

---

*Biên bản lập ngày 2026-09-07, cập nhật cùng ngày sau khi chốt bốn quyết định đợt 3. Mọi thay đổi phạm vi sau ngày này phải cập nhật `docs/hrm/CONTEXT_SUMMARY.md` Mục 9.3b và ghi lý do tại đây.*
