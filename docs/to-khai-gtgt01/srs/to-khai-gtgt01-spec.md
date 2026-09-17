---
type: srs
feature: to-khai-gtgt01
status: approved
updated: 2026-09-16
links:
  - docs/to-khai-gtgt01/CONTEXT_SUMMARY.md
  - docs/to-khai-gtgt01/kien-truc-to-khai-gtgt01.md
---

# Đặc tả nghiệp vụ: Xuất Excel kèm chi tiết hóa đơn & đổi mã "Chỉ tiêu tăng giảm"

## 1. Business Goal & Stakeholders

**Mục tiêu nghiệp vụ:** Kế toán đang lập tờ khai 01/GTGT cần một file Excel duy nhất, xuất ra từ màn Tờ khai, chứa đủ cả bảng kê hóa đơn và chi tiết từng dòng hàng hóa/dịch vụ của kỳ đang lập, để đối chiếu số thuế mà không phải mở thêm màn Hóa đơn điện tử và tự ghép dữ liệu bằng tay. Đồng thời, cột "Chỉ tiêu tăng giảm" trên bảng kê cần dùng đúng mã số chỉ tiêu in trên mẫu 01/GTGT (37/38) thay vì chữ mô tả (Tăng/Giảm), để khớp trực tiếp khi đối chiếu hồ sơ giấy.

**Stakeholders:**
- Kế toán phụ trách lập tờ khai GTGT (người dùng trực tiếp).
- Kế toán trưởng / người soát hồ sơ (người nhận file Excel để đối chiếu).
- Backend Engineer, Frontend Engineer (triển khai).
- Architect, Tester-QA (thiết kế kỹ thuật và kiểm thử).

## 2. Scope & Out of Scope

**Trong phạm vi:**
- Thêm 4 sheet vào file Excel xuất từ nút "Xuất Excel" tại màn Tờ khai: "HĐ mua vào", "HĐ bán ra", "Chi tiết mua vào", "Chi tiết bán ra".
- Một endpoint đọc mới (BE) trả chi tiết hóa đơn theo đúng tập hóa đơn của kỳ tờ khai (không lệch tập hóa đơn với bảng kê).
- Đổi mã giá trị của cột "Chỉ tiêu tăng giảm" trên bảng kê hóa đơn từ `"tang"`/`"giam"` sang `"38"`/`"37"`.
- Diễn giải tương thích ngược cho dữ liệu cũ `"tang"`/`"giam"` đã lưu trước khi đổi mã.

**Ngoài phạm vi (Out of Scope):**
- Không thay đổi sheet "01-GTGT" và "PL 204-2025" đã có.
- Không thay đổi cách tính toán chỉ tiêu [37]/[38] của tờ khai (`ghi_de`, nhập tay) — xem BR-to-khai-gtgt01-002.
- Không thêm chức năng lọc/tùy chỉnh cột cho 4 sheet mới — bám đúng bộ cột đã có (`overviewToKhai`, `detailColumns`).
- Không cập nhật hàng loạt (UPDATE) dữ liệu `chi_tieu_tang_giam` cũ trên DB — chỉ diễn giải khi đọc.
- Không thay đổi luồng "Kê khai"/"Không kê khai" (`ke_khai`) hay tính toán chỉ tiêu chính của tờ khai.

## 3. Actors

| Actor | Vai trò trong 2 thay đổi này |
|---|---|
| Kế toán | Bấm "Xuất Excel" tại màn Tờ khai; chọn giá trị "Chỉ tiêu tăng giảm" cho từng hóa đơn trên bảng kê |
| Hệ thống (FE) | Gọi dữ liệu, dựng file Excel, hiển thị dropdown đã chuẩn hóa mã |
| Hệ thống (BE) | Trả bảng kê + chi tiết hóa đơn theo kỳ, lưu/diễn giải giá trị "Chỉ tiêu tăng giảm" |

## 4. Business Rules

**BR-to-khai-gtgt01-001**: Tập hóa đơn xuất hiện trong sheet "Chi tiết mua vào"/"Chi tiết bán ra" PHẢI trùng tuyệt đối với tập hóa đơn xuất hiện trong sheet "HĐ mua vào"/"HĐ bán ra" tương ứng — cùng một nguồn xác định tập hóa đơn (hóa đơn đã gán vào kỳ qua thao tác "Kê khai" và còn hợp lệ để tính, tức chưa bị thay thế/hủy — đúng logic `layBangKeTheoKy` đang dùng cho bảng kê). Không được suy tập hóa đơn "chi tiết" từ một khoảng ngày lập tính độc lập với bảng kê.

**BR-to-khai-gtgt01-002**: Cột "Chỉ tiêu tăng giảm" (mã 37/38) trên bảng kê hóa đơn là nhãn/ghi chú của kế toán gắn cho TỪNG hóa đơn, hoàn toàn tách biệt khỏi số liệu chỉ tiêu [37]/[38] hiển thị trên tờ khai 01/GTGT. Đổi giá trị cột này trên bảng kê KHÔNG làm thay đổi và KHÔNG cộng dồn vào số tiền của chỉ tiêu [37]/[38] — hai chỉ tiêu đó luôn do kế toán tự nhập tay riêng trên form tờ khai (ô nhập tay, xem `CT_NHAP_TAY`).

**BR-to-khai-gtgt01-003**: Giá trị hợp lệ của cột "Chỉ tiêu tăng giảm" chỉ gồm: rỗng (chưa chọn), `"37"` (Giảm — khớp chỉ tiêu [37] "Điều chỉnh giảm"), `"38"` (Tăng — khớp chỉ tiêu [38] "Điều chỉnh tăng").

**BR-to-khai-gtgt01-004**: Dữ liệu cũ đã lưu dạng `"tang"`/`"giam"` (trước thời điểm đổi mã) không bị sửa trực tiếp trong DB. Hệ thống diễn giải một chiều khi đọc: `"tang"` tương đương `"38"`, `"giam"` tương đương `"37"`. Không chạy script cập nhật hàng loạt trên dữ liệu đã lưu.

**BR-to-khai-gtgt01-005**: Một kỳ hoặc một chiều (mua vào/bán ra) không có hóa đơn nào được gán vẫn phải xuất đủ sheet tương ứng trong file Excel, có tiêu đề cột đầy đủ, không được bỏ qua sheet.

**BR-to-khai-gtgt01-006**: Hóa đơn đã gán vào kỳ nhưng đang bị kế toán đánh dấu "Không kê khai" vẫn xuất hiện ở sheet "HĐ..." và sheet "Chi tiết..." tương ứng — giống hệt cách nó vẫn hiển thị trên bảng kê màn hình. Việc số tiền của hóa đơn đó KHÔNG được cộng vào chỉ tiêu tờ khai là do bước tính toán riêng loại trừ hóa đơn "Không kê khai", không phải do bị ẩn khỏi Excel.

## 5. Functional Requirements

**FR-to-khai-gtgt01-001**: Khi kế toán bấm "Xuất Excel" tại màn Tờ khai, hệ thống xuất một file `.xlsx` gồm các sheet theo đúng thứ tự: "01-GTGT", "PL 204-2025" (chỉ khi kỳ có phụ lục giảm thuế 8%), "HĐ mua vào", "HĐ bán ra", "Chi tiết mua vào", "Chi tiết bán ra".

**FR-to-khai-gtgt01-002**: Sheet "HĐ mua vào"/"HĐ bán ra" chứa toàn bộ hóa đơn đã gán vào kỳ đang xem, chiều tương ứng, còn hợp lệ để tính (chưa bị thay thế/hủy) — bất kể đang đánh dấu "Kê khai" hay "Không kê khai" — với bộ cột, thứ tự cột và định dạng số giống hệt bảng kê đang hiển thị trên màn hình (26 cột).

**FR-to-khai-gtgt01-003**: Sheet "Chi tiết mua vào"/"Chi tiết bán ra" chứa chi tiết từng dòng hàng hóa/dịch vụ (bung theo hóa đơn) của ĐÚNG tập hóa đơn xuất hiện ở sheet "HĐ mua vào"/"HĐ bán ra" tương ứng — không thừa, không thiếu hóa đơn nào so với sheet đó.

**FR-to-khai-gtgt01-004**: Cột STT của một hóa đơn tại sheet "Chi tiết..." phải khớp đúng cột STT của chính hóa đơn đó tại sheet "HĐ..." tương ứng. Cơ chế: sheet "HĐ..." và sheet "Chi tiết..." của cùng một chiều được dựng từ CÙNG một lần gọi dữ liệu duy nhất (một mảng hóa đơn có sẵn thông tin chi tiết đính kèm từng dòng); STT của một hóa đơn tại sheet "Chi tiết..." lấy đúng bằng STT của chính hóa đơn đó (vị trí của nó trong mảng dùng chung) tại sheet "HĐ...", không cần ghép qua hai nguồn dữ liệu riêng biệt.

**FR-to-khai-gtgt01-011**: Hóa đơn thuộc tập hóa đơn của kỳ (xuất hiện ở sheet "HĐ...") nhưng chưa có chi tiết đã tải (chưa từng chạy "Tải chi tiết" ở module Hóa đơn điện tử) vẫn có đúng một dòng tương ứng ở sheet "Chi tiết...": các cột thông tin hóa đơn (mẫu số, ký hiệu, số hóa đơn, ngày lập, MST/tên đối tác, trạng thái hóa đơn...) lấy từ chính dòng hóa đơn đó ở sheet "HĐ...", các cột thuộc về dòng hàng hóa/dịch vụ (tên hàng, đơn vị tính, số lượng, đơn giá, thuế suất...) để trống, STT khớp đúng theo FR-to-khai-gtgt01-004.

**FR-to-khai-gtgt01-005**: Trong lúc hệ thống tải dữ liệu để xuất Excel (bảng kê và chi tiết của cả hai chiều), nút "Xuất Excel" chuyển sang trạng thái đang xử lý và không cho bấm lần thứ hai tới khi hoàn tất hoặc gặp lỗi.

**FR-to-khai-gtgt01-006**: Nếu một kỳ hoặc một chiều không có hóa đơn nào được gán, sheet "HĐ..." và sheet "Chi tiết..." tương ứng vẫn được tạo với đủ tiêu đề cột, phần dữ liệu để trống.

**FR-to-khai-gtgt01-007**: Dropdown "Chỉ tiêu tăng giảm" trên bảng kê hiển thị đúng ba lựa chọn: "—" (rỗng), "37 — Giảm", "38 — Tăng".

**FR-to-khai-gtgt01-008**: Khi kế toán chọn một giá trị và lưu, hệ thống ghi giá trị mã `"37"`, `"38"` hoặc rỗng vào cột lưu trữ quyết định của hóa đơn đó.

**FR-to-khai-gtgt01-009**: Khi đọc bảng kê từ dữ liệu đã lưu, hệ thống tự động diễn giải các giá trị cũ: `"tang"` hiển thị thành "38 — Tăng", `"giam"` hiển thị thành "37 — Giảm" — kế toán không cần chọn lại.

**FR-to-khai-gtgt01-010**: Hệ thống từ chối lưu giá trị "Chỉ tiêu tăng giảm" không thuộc tập `{"", "37", "38"}` khi nhận yêu cầu cập nhật quyết định của một hóa đơn — giá trị lạ bị loại khỏi payload cập nhật, các field hợp lệ khác trong cùng yêu cầu vẫn được lưu bình thường.

## 6. Non-Functional Requirements

**NFR-to-khai-gtgt01-001**: Thao tác xuất Excel không được để giao diện "đứng im không phản hồi" — nút xuất phải chuyển trạng thái đang xử lý ngay khi bấm (xem FR-to-khai-gtgt01-005), và trả về trạng thái bình thường ngay khi hoàn tất hoặc gặp lỗi.

**NFR-to-khai-gtgt01-002**: Endpoint chi tiết hóa đơn theo kỳ (mới) không được đổi hành vi hoặc hiệu năng của bảng kê hiện có (`GET /to-khai/hoa-don`) — là một endpoint đọc riêng, không chèn thêm truy vấn vào luồng hiển thị bảng kê trên màn hình.

## 7. Constraints

- Endpoint chi tiết theo kỳ mới (Task 1) phải dùng lại đúng logic lọc hóa đơn của `layBangKeTheoKy` (BE) — không được viết logic lọc riêng có nguy cơ trôi khỏi bảng kê theo thời gian khi một bên sửa mà bên kia quên sửa theo.
- Không được thay đổi cơ chế tính toán chỉ tiêu [37]/[38] hiện có (`CT_NHAP_TAY`, nhập tay) — Task 2 không được đụng tới `tinhGtgt01.ts`.
- Không tạo migration cho tenant DB — cột `chi_tieu_tang_giam` đã đủ kiểu dữ liệu (`VarChar(32)`, không CHECK constraint) cho tập giá trị mới.
- Định nghĩa tập giá trị hợp lệ của "Chỉ tiêu tăng giảm" hiện tồn tại độc lập ở cả FE (`ky.ts`) và BE (`keKhaiKy.service.ts`) — cả hai nơi phải đổi đồng bộ.

## 8. Assumptions

- Một số tenant có thể đã có bản ghi `chi_tieu_tang_giam = "tang"`/`"giam"` từ trước (trường này ra đời khoảng 2 tuần trước ngày viết spec này, đã qua nhiều đợt dùng và sửa lỗi) — spec giả định CÓ dữ liệu cũ cần diễn giải, dù chưa xác minh được số lượng bản ghi thật qua DB (nằm ngoài phạm vi đọc-only của vòng đối soát).
- "Chi tiết" trong yêu cầu ban đầu của kế toán được hiểu đúng là tab "Chi tiết hoá đơn" hiện có ở module Hóa đơn điện tử (bung mỗi hóa đơn thành nhiều dòng theo mảng hàng hóa/dịch vụ).

## 9. Error Matrix

| Mã lỗi | Tình huống | Hành vi hệ thống |
|---|---|---|
| E-to-khai-gtgt01-001 | Một trong các lời gọi tải dữ liệu (bảng kê hoặc chi tiết, mua vào hoặc bán ra) thất bại khi đang xuất Excel | Hủy toàn bộ thao tác xuất, không tạo ra file thiếu sheet; thông báo rõ nguồn dữ liệu bị lỗi cho kế toán (ví dụ "Không tải được chi tiết hóa đơn bán ra") |
| E-to-khai-gtgt01-002 | **N/A** — Khoảng dữ liệu cần đọc để dựng sheet Chi tiết vượt giới hạn kỹ thuật cho phép trong một lần gọi | Không phát sinh trong thiết kế đã chốt: endpoint chi tiết theo kỳ không áp trần khoảng ngày, vì tập dữ liệu đã bị giới hạn sẵn bởi kỳ (tối đa 1 quý), luôn nhỏ hơn trần 366 ngày đang áp cho endpoint chi tiết khác của module Hóa đơn điện tử. Giữ ID để không tái dùng cho mục đích khác. |
| E-to-khai-gtgt01-003 | Giá trị "Chỉ tiêu tăng giảm" gửi lên để cập nhật không thuộc `{"", "37", "38"}` | Hệ thống loại bỏ giá trị đó khỏi yêu cầu cập nhật, giữ nguyên giá trị cũ đã lưu; không từ chối toàn bộ yêu cầu nếu còn field hợp lệ khác |

## 10. User Stories & Acceptance Criteria

### US-to-khai-gtgt01-01

Là kế toán phụ trách lập tờ khai, tôi muốn một file Excel xuất ra từ tab Tờ khai có luôn cả bảng kê và chi tiết hóa đơn mua vào/bán ra của đúng kỳ đang lập, để tôi đối chiếu số thuế mà không phải mở thêm màn Hóa đơn điện tử và tự ghép dữ liệu bằng tay.

**AC-to-khai-gtgt01-001**
- Given kế toán đang xem tờ khai của một kỳ đã có hóa đơn được gán ở cả hai chiều
- When kế toán bấm "Xuất Excel"
- Then file tải về có các sheet đúng thứ tự: "01-GTGT", "PL 204-2025" (nếu kỳ có phụ lục), "HĐ mua vào", "HĐ bán ra", "Chi tiết mua vào", "Chi tiết bán ra"

**AC-to-khai-gtgt01-002**
- Given sheet "HĐ mua vào"/"HĐ bán ra" trong file vừa xuất
- When mở file và so sánh với bảng kê hiển thị trên màn hình cùng kỳ
- Then bộ cột, thứ tự cột và định dạng số khớp hoàn toàn, và dữ liệu là toàn bộ hóa đơn đã gán của kỳ (không chỉ trang đang xem trên màn hình)

**AC-to-khai-gtgt01-003**
- Given sheet "Chi tiết mua vào"/"Chi tiết bán ra" và sheet "HĐ mua vào"/"HĐ bán ra" trong cùng file
- When đối chiếu tập hóa đơn xuất hiện ở hai sheet
- Then tập hóa đơn trùng nhau tuyệt đối — mỗi hóa đơn ở sheet "HĐ..." có đủ dòng chi tiết tương ứng ở sheet "Chi tiết...", không thừa không thiếu hóa đơn nào

**AC-to-khai-gtgt01-004**
- Given một chiều của kỳ (ví dụ mua vào) không có hóa đơn nào được gán
- When kế toán xuất Excel
- Then sheet "HĐ mua vào" và "Chi tiết mua vào" vẫn được tạo với đầy đủ tiêu đề cột, phần dữ liệu để trống, không báo lỗi và không bị bỏ qua

**AC-to-khai-gtgt01-005** — **N/A** (không phát sinh trong thiết kế đã chốt)
- Endpoint chi tiết theo kỳ không áp trần khoảng ngày: tập dữ liệu đã bị giới hạn sẵn bởi kỳ (tối đa 1 quý), luôn nhỏ hơn trần khoảng ngày của endpoint chi tiết khác đang có trong hệ thống. Giữ ID này để không tái dùng cho mục đích khác; không xóa khỏi tài liệu.

**AC-to-khai-gtgt01-006**
- Given hệ thống đang tải hai nguồn dữ liệu song song để xuất Excel (một lượt gọi cho mỗi chiều mua vào/bán ra, mỗi lượt trả về cả bảng kê lẫn chi tiết của chiều đó)
- When kế toán vừa bấm "Xuất Excel"
- Then nút chuyển sang trạng thái đang xử lý, chặn bấm lần hai tới khi hoàn tất hoặc gặp lỗi

**AC-to-khai-gtgt01-007**
- Given hóa đơn X đứng ở vị trí thứ k trên sheet "HĐ mua vào" (cột STT = k)
- When tra cứu các dòng chi tiết của hóa đơn X trên sheet "Chi tiết mua vào"
- Then toàn bộ các dòng chi tiết đó có cột STT = k, khớp đúng với sheet "HĐ mua vào", không lệch do trùng ngày lập giữa nhiều hóa đơn

**AC-to-khai-gtgt01-008**
- Given một hóa đơn đã gán vào kỳ nhưng đang bị đánh dấu "Không kê khai"
- When kế toán xuất Excel
- Then hóa đơn đó vẫn xuất hiện ở sheet "HĐ..." và sheet "Chi tiết..." tương ứng (khớp với cách nó vẫn hiển thị trên bảng kê màn hình), đúng theo BR-to-khai-gtgt01-006

**AC-to-khai-gtgt01-014**
- Given một hóa đơn thuộc tập hóa đơn của kỳ nhưng chưa từng được tải chi tiết
- When kế toán xuất Excel
- Then sheet "Chi tiết..." vẫn có đúng một dòng cho hóa đơn đó — cột thông tin hóa đơn lấy từ dòng bảng kê tương ứng, cột thuộc dòng hàng hóa/dịch vụ để trống, STT khớp đúng sheet "HĐ..." — đúng theo FR-to-khai-gtgt01-011

### US-to-khai-gtgt01-02

Là kế toán, tôi muốn chọn đúng mã chỉ tiêu 37/38 khi đánh dấu "Chỉ tiêu tăng giảm" cho từng hóa đơn, để khớp trực tiếp với số chỉ tiêu trên mẫu tờ khai 01/GTGT khi đối chiếu hồ sơ, thay vì phải tra chéo giữa tên gọi "Tăng"/"Giảm" và số chỉ tiêu.

**AC-to-khai-gtgt01-009**
- Given kế toán mở dropdown "Chỉ tiêu tăng giảm" trên một dòng bảng kê
- When xem danh sách lựa chọn
- Then thấy đúng ba mục: "—" (rỗng), "37 — Giảm", "38 — Tăng"

**AC-to-khai-gtgt01-010**
- Given kế toán chọn "38 — Tăng" cho một hóa đơn rồi lưu
- When đọc lại trang (làm mới dữ liệu)
- Then giá trị lưu trữ là `"38"` và dropdown hiển thị đúng lại "38 — Tăng"

**AC-to-khai-gtgt01-011**
- Given một hóa đơn có giá trị lưu trữ là `"tang"` hoặc `"giam"` từ trước khi đổi mã
- When bảng kê tải dữ liệu của hóa đơn đó
- Then giá trị trả về cho giao diện đã được diễn giải thành `"38"` (từ `"tang"`) hoặc `"37"` (từ `"giam"`) tương ứng — dropdown hiển thị đúng nhãn mới, không hiện rỗng và không báo lỗi

**AC-to-khai-gtgt01-012**
- Given kế toán gửi yêu cầu cập nhật quyết định với giá trị "Chỉ tiêu tăng giảm" không thuộc `{"", "37", "38"}` (ví dụ giá trị cũ `"tang"` gửi thẳng lên sau khi đã đổi mã, hoặc giá trị rác)
- When hệ thống nhận yêu cầu
- Then giá trị đó bị loại khỏi phần cập nhật, giá trị đã lưu trước đó của hóa đơn giữ nguyên, các field hợp lệ khác trong cùng yêu cầu (nếu có) vẫn được lưu

**AC-to-khai-gtgt01-013**
- Given ô nhập tay chỉ tiêu [37]/[38] trên form tờ khai đang có một giá trị cụ thể
- When kế toán đổi cột "Chỉ tiêu tăng giảm" trên bảng kê của một hoặc nhiều hóa đơn trong cùng kỳ
- Then số liệu chỉ tiêu [37]/[38] hiển thị trên form tờ khai KHÔNG đổi — hai cơ chế độc lập hoàn toàn, đúng theo BR-to-khai-gtgt01-002

## 11. Edge Cases

- Hóa đơn thay thế/điều chỉnh có ngày lập nằm ngoài ranh giới lịch của kỳ (tháng/quý) nhưng vẫn được gán vào kỳ đó (do bảng kê tự nới khoảng đọc theo ngày lập thật của các hóa đơn đã gán) — vẫn phải xuất hiện đúng và đầy đủ ở cả sheet "HĐ..." lẫn sheet "Chi tiết..." tương ứng, không bị bỏ sót vì nằm ngoài khoảng ngày lịch.
- Hóa đơn có trạng thái đã bị thay thế hoặc đã bị hủy — không xuất hiện ở bất kỳ sheet nào trong bốn sheet mới, đúng theo cách bảng kê hiện tại loại các hóa đơn này khỏi hiển thị.
- Kỳ chưa từng bấm "Kê khai" lần nào (chưa có hóa đơn nào được gán) — cả bốn sheet mới đều chỉ có tiêu đề cột, không có dữ liệu, không có lỗi.
- Hai hóa đơn khác nhau có cùng ngày lập trong cùng một kỳ — cột STT ở sheet "Chi tiết..." vẫn phải khớp đúng hóa đơn tương ứng ở sheet "HĐ...", không bị đảo lẫn (cả hai sheet dựng từ cùng một mảng dữ liệu duy nhất nên không phụ thuộc thứ tự sắp xếp giữa hai nguồn riêng biệt).
- Hóa đơn thuộc tập hóa đơn của kỳ nhưng chưa từng được tải chi tiết (thường gặp ở chiều mua vào, khi kế toán chưa chạy "Tải chi tiết" ở module Hóa đơn điện tử) — vẫn có một dòng ở sheet "Chi tiết...", chỉ để trống phần thông tin hàng hóa/dịch vụ, theo FR-to-khai-gtgt01-011.
- Kế toán đổi "Chỉ tiêu tăng giảm" của một hóa đơn từ giá trị cũ (`"tang"`/`"giam"`, đã được diễn giải hiển thị thành "38"/"37") sang giá trị mới rồi lưu lại — sau khi lưu, dữ liệu lưu trữ chuyển hẳn sang mã mới (`"37"`/`"38"`/rỗng), không còn giữ dạng chữ cũ cho hóa đơn đó.
- Kế toán xóa lựa chọn "Chỉ tiêu tăng giảm" về "—" cho một hóa đơn đang có giá trị — giá trị lưu trữ trở về rỗng, không báo lỗi (rỗng là giá trị hợp lệ).

## 12. Requirement Traceability

| FR/BR/E | Acceptance Criteria liên quan |
|---|---|
| FR-to-khai-gtgt01-001, BR-to-khai-gtgt01-005 | AC-to-khai-gtgt01-001, AC-to-khai-gtgt01-004 |
| FR-to-khai-gtgt01-002, BR-to-khai-gtgt01-001, BR-to-khai-gtgt01-006 | AC-to-khai-gtgt01-002, AC-to-khai-gtgt01-008 |
| FR-to-khai-gtgt01-003, BR-to-khai-gtgt01-001 | AC-to-khai-gtgt01-003 |
| FR-to-khai-gtgt01-004 | AC-to-khai-gtgt01-007 |
| FR-to-khai-gtgt01-005, NFR-to-khai-gtgt01-001 | AC-to-khai-gtgt01-006 |
| FR-to-khai-gtgt01-006, BR-to-khai-gtgt01-005 | AC-to-khai-gtgt01-004 |
| FR-to-khai-gtgt01-011 | AC-to-khai-gtgt01-014 |
| E-to-khai-gtgt01-001 | AC-to-khai-gtgt01-006 (nhánh lỗi) |
| E-to-khai-gtgt01-002 | AC-to-khai-gtgt01-005 (cả hai N/A trong thiết kế đã chốt — xem Mục 9 và AC-005) |
| FR-to-khai-gtgt01-007 | AC-to-khai-gtgt01-009 |
| FR-to-khai-gtgt01-008, BR-to-khai-gtgt01-003 | AC-to-khai-gtgt01-010 |
| FR-to-khai-gtgt01-009, BR-to-khai-gtgt01-004 | AC-to-khai-gtgt01-011 |
| FR-to-khai-gtgt01-010, E-to-khai-gtgt01-003 | AC-to-khai-gtgt01-012 |
| BR-to-khai-gtgt01-002 | AC-to-khai-gtgt01-013 |
