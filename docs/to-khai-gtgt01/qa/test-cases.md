---
type: test-cases
feature: to-khai-gtgt01
updated: 2026-09-16
links:
  - docs/to-khai-gtgt01/qa/test-matrix.md
  - docs/to-khai-gtgt01/srs/to-khai-gtgt01-spec.md
  - docs/to-khai-gtgt01/srs/to-khai-gtgt01-flows.md
  - docs/to-khai-gtgt01/architecture/api-contract.md
  - docs/to-khai-gtgt01/architecture/adr/ADR-001-chi-tiet-hoa-don-theo-ky.md
---

# Test cases chi tiết: Xuất Excel kèm chi tiết hóa đơn & đổi mã "Chỉ tiêu tăng giảm"

> Xem `docs/to-khai-gtgt01/qa/test-matrix.md` cho bảng tổng hợp AC/FR/BR/E ↔ TC ID, tầng test, priority.
> Contract đã chốt: `GET /api/v1/to-khai/hoa-don/chi-tiet?nam&kyLoai&kySo&chieu` — auth Bearer JWT +
> `requireModule("tokhai")`, rate limit 20/phút/người dùng, response `{ total, datas, thayThe }` với
> mỗi `datas[]` có thêm `chiTiet: object | null`. FE xuất Excel gọi đúng **2 lượt** (không phải 4).

## Task 1 — Xuất Excel 4 sheet

### TC-to-khai-gtgt01-001 — Đủ 6 sheet đúng thứ tự khi kỳ có phụ lục 204

- **Requirement**: AC-to-khai-gtgt01-001, FR-to-khai-gtgt01-001
- **Preconditions**: Đăng nhập, chọn công ty có kỳ tính thuế mà `ban.phuLuc` khác null (kỳ có hàng hóa/dịch vụ thuế suất 8%). Kỳ đã có hóa đơn gán ở cả hai chiều.
- **Steps**:
  1. Mở màn Tờ khai, chọn đúng kỳ nêu trên.
  2. Bấm "Xuất Excel".
  3. Mở file `.xlsx` vừa tải về.
- **Test Data**: Kỳ bất kỳ có `phuLuc` khác null (đối chiếu qua API `GET /to-khai/gtgt01` hoặc DB).
- **Expected Result**: File có đúng 6 sheet, đúng thứ tự: "01-GTGT", "PL 204-2025", "HĐ mua vào", "HĐ bán ra", "Chi tiết mua vào", "Chi tiết bán ra".
- **Actual Result / Status**: Chưa chạy — chờ code (Phase B).

### TC-to-khai-gtgt01-002 — Đủ 5 sheet đúng thứ tự khi kỳ không có phụ lục

- **Requirement**: AC-to-khai-gtgt01-001, FR-to-khai-gtgt01-001
- **Preconditions**: Kỳ mà `ban.phuLuc` là null.
- **Steps**: Như TC-001.
- **Expected Result**: File có đúng 5 sheet, thứ tự: "01-GTGT", "HĐ mua vào", "HĐ bán ra", "Chi tiết mua vào", "Chi tiết bán ra" — không có "PL 204-2025".
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-003 — Sheet "HĐ..." khớp bảng kê màn hình, đủ toàn bộ hóa đơn kỳ

- **Requirement**: AC-to-khai-gtgt01-002, FR-to-khai-gtgt01-002
- **Preconditions**: Kỳ có > 1 trang dữ liệu trên bảng kê màn hình (nếu bảng kê có phân trang) hoặc ít nhất đủ nhiều hóa đơn để phân biệt "toàn bộ kỳ" với "trang đang xem".
- **Steps**:
  1. Mở bảng kê mua vào của kỳ trên màn hình (`GET /to-khai/hoa-don`), ghi lại tổng số dòng + vài dòng mẫu (STT, số HĐ, số tiền).
  2. Xuất Excel, mở sheet "HĐ mua vào" (dựng từ `GET /to-khai/hoa-don/chi-tiet`).
  3. Đếm số dòng dữ liệu, so cột/thứ tự cột/định dạng số (`#,##0;(#,##0)` cho cột tiền) với `overviewToKhai("purchase")` (26 cột, xem `hdđt_maxv/src/features/to_khai/templates/cotBangKe.ts`).
- **Expected Result**: Số dòng sheet = tổng số hóa đơn đã gán kỳ (không giới hạn theo trang UI); 26 cột đúng thứ tự, đúng header, đúng định dạng số âm dạng ngoặc `(...)`; thứ tự dòng khớp `GET /to-khai/hoa-don` (xem TC-043 — cả 2 endpoint cùng gọi `layBangKeTheoKy`).
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-004 — Tập hóa đơn Chi tiết mua vào trùng tuyệt đối tập HĐ mua vào

- **Requirement**: AC-to-khai-gtgt01-003, FR-to-khai-gtgt01-003, BR-to-khai-gtgt01-001
- **Preconditions**: Kỳ có ≥ 5 hóa đơn mua vào đã gán, trạng thái hỗn hợp (có cả "Kê khai" và "Không kê khai").
- **Steps**:
  1. Gọi `GET /api/v1/to-khai/hoa-don/chi-tiet?nam=...&kyLoai=...&kySo=...&chieu=purchase`.
  2. Lấy danh sách `id` (hoặc khóa `mauHd|soSeri|soHd|sellerMst`) từ toàn bộ `datas[]`.
  3. Trong Excel, đối chiếu danh sách khóa hóa đơn ở sheet "HĐ mua vào" với danh sách khóa distinct ở sheet "Chi tiết mua vào".
- **Test Data**: Endpoint `GET /api/v1/to-khai/hoa-don/chi-tiet`.
- **Expected Result**: Hai tập bằng nhau tuyệt đối — không phần tử nào chỉ có ở 1 trong 2 tập. Về mặt thiết kế, điều này được đảm bảo TỰ ĐỘNG vì cả 2 sheet dựng từ CÙNG 1 mảng `datas` của CÙNG 1 response (api-contract Mục 2.4 bất biến #1/#2) — TC này xác nhận implementation không lệch khỏi thiết kế (vd không lỡ tự lọc lại theo `chiTiet !== null`).
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-005 — Tập hóa đơn Chi tiết bán ra trùng tuyệt đối tập HĐ bán ra

- Tương tự TC-004, đổi `chieu=sold`.
- **Requirement**: AC-to-khai-gtgt01-003, FR-to-khai-gtgt01-003, BR-to-khai-gtgt01-001
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-006 — 🔴 Hóa đơn ĐÃ BỊ THAY THẾ (tthai=4) không xuất hiện ở `/chi-tiet`

- **Requirement**: Edge case "Hóa đơn có trạng thái đã bị thay thế hoặc đã bị hủy", BR-to-khai-gtgt01-001
- **Rủi ro nghiệp vụ**: `layBangKeTheoKy` lọc 2 lớp: (1) đã gán kỳ, (2) `duocTinh(tthai)` loại tthai=4/6 (`keKhaiKy.service.ts:502-531`). Theo api-contract Mục 2.4 bất biến #1, endpoint `/chi-tiet` PHẢI gọi verbatim `layBangKeTheoKy` — "không lọc lại, không lọc thêm". Nếu implementation vô tình viết lại logic lọc (thay vì gọi thẳng hàm này) và bỏ sót lớp `duocTinh`, sheet "Chi tiết..." sẽ THỪA hóa đơn đã bị thay thế.
- **Preconditions**: Có ít nhất 1 hóa đơn `tthai=4` đã từng được gán vào kỳ (do đồng bộ trước khi bị thay thế, hoặc set thủ công trong môi trường test).
- **Steps**:
  1. Xác nhận hóa đơn đó KHÔNG xuất hiện trong bảng kê màn hình / `GET /to-khai/hoa-don` (đã đúng theo code hiện tại).
  2. Gọi `GET /to-khai/hoa-don/chi-tiet` cho kỳ + chiều tương ứng.
  3. Tìm khóa hóa đơn đó trong `datas[]`.
- **Expected Result**: Không có mặt trong `datas[]` → không xuất hiện ở sheet "HĐ..." lẫn "Chi tiết...".
- **Tầng test**: BE-unit (nếu `layBangKeTheoKy` được gọi qua mock) hoặc BE-integration (DB thật, ưu tiên vì đây là test quan trọng nhất của Task 1).
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-007 — 🔴 Hóa đơn ĐÃ BỊ HỦY (tthai=6) không xuất hiện ở `/chi-tiet`

- Tương tự TC-006, `tthai=6`.
- **Requirement**: Edge case, BR-to-khai-gtgt01-001
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-008 — Hóa đơn thay thế ngày lập ngoài ranh giới kỳ nhưng đã gán kỳ

- **Requirement**: Edge case "Hóa đơn thay thế/điều chỉnh có ngày lập nằm ngoài ranh giới lịch của kỳ", BR-to-khai-gtgt01-001
- **Bối cảnh kỹ thuật**: `khoangDocBangKe` nới khoảng đọc ra tới ngày lập xa nhất trong số hóa đơn ĐÃ GÁN — nên hóa đơn thay thế lập ở kỳ sau vẫn được đọc về nếu đã gán vào kỳ trước đó (xem `keKhaiKy.service.ts:453-476`). `/chi-tiet` thừa hưởng hành vi này nguyên vẹn vì gọi thẳng `layBangKeTheoKy`.
- **Preconditions**: Kỳ T7/2026 có 1 hóa đơn thay thế lập ngày trong T8/2026 nhưng đã được gán vào kỳ T7/2026 (do hóa đơn gốc thuộc T7).
- **Steps**:
  1. Xác nhận hóa đơn đó có mặt trong bảng kê màn hình của kỳ T7.
  2. Gọi `GET /to-khai/hoa-don/chi-tiet` cho kỳ T7.
  3. Tìm hóa đơn đó trong `datas[]`, kiểm `chiTiet` khác null (đã có chi tiết) hoặc null (chưa tải — xem TC-018).
- **Expected Result**: Xuất hiện đầy đủ, đúng dữ liệu ở cả sheet "HĐ..." và "Chi tiết..." — không bị bỏ sót vì ngày lập nằm ngoài khoảng lịch của kỳ.
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-009 — Hóa đơn chưa gán kỳ, ngày lập nằm trong kỳ — không lên sheet nào

- **Requirement**: Suy từ BR-to-khai-gtgt01-001 và cơ chế `layBangKeTheoKy` ("Lọc theo danh sách đã gán, KHÔNG theo khoảng ngày")
- **Preconditions**: Có hóa đơn với `tdlap` nằm trong khoảng lịch của kỳ đang xuất, nhưng CHƯA từng bấm "Kê khai" (không có bản ghi `tokhai_ky_hoa_don` cho hóa đơn này ở kỳ đó) — ví dụ hóa đơn mới đồng bộ về sau lần "Kê khai" gần nhất.
- **Steps**:
  1. Xác nhận hóa đơn KHÔNG có trong bảng kê màn hình.
  2. Gọi `GET /to-khai/hoa-don/chi-tiet`.
  3. Tìm hóa đơn đó trong `datas[]`.
- **Expected Result**: Không có mặt trong `datas[]` — không xuất hiện ở sheet nào, kể cả sheet Chi tiết (đúng BR-001, endpoint không suy tập hóa đơn theo khoảng ngày độc lập với bảng kê).
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-010 — Hóa đơn "Không kê khai" vẫn xuất hiện ở sheet HĐ và Chi tiết

- **Requirement**: AC-to-khai-gtgt01-008, BR-to-khai-gtgt01-006
- **Preconditions**: 1 hóa đơn đã gán kỳ, `keKhai = false` (đã đánh dấu "Không kê khai" qua `OKeKhai`).
- **Steps**:
  1. Xác nhận hóa đơn hiện diện trên bảng kê màn hình với dropdown "Không kê khai".
  2. Xuất Excel.
  3. Tìm hóa đơn ở sheet "HĐ..." (cột "Kê khai/không kê khai" = "Không kê khai") và sheet "Chi tiết...".
- **Expected Result**: Xuất hiện ở cả 2 sheet, giống hệt cách hiển thị trên bảng kê màn hình. Số tiền của nó KHÔNG được cộng vào chỉ tiêu tờ khai (kiểm chéo qua sheet "01-GTGT" — không phải phạm vi TC này nhưng ghi chú để không hiểu nhầm "ẩn khỏi Excel = loại khỏi tính toán").
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-011 — STT khớp đúng khi nhiều hóa đơn trùng ngày lập

- **Requirement**: AC-to-khai-gtgt01-007, FR-to-khai-gtgt01-004, Edge case 4
- **Cơ chế thật theo contract (đối chiếu Ghi chú spec↔contract ở test-matrix.md)**: sheet "HĐ..." dùng STT = vị trí `i+1` trong `datas`; sheet "Chi tiết..." dựng bằng `datas.flatMap((r, i) => toDetailRows(r.chiTiet, i + 1, ...))` — STT của mọi dòng chi tiết thuộc hóa đơn thứ `i` LUÔN bằng `i+1`, vì lấy từ CÙNG một phần tử mảng `datas[i]` dùng để dựng cả 2 sheet. Đây KHÔNG còn là "ghép theo khóa nghiệp vụ giữa 2 truy vấn riêng" như mô tả gốc ở FR-004 (đã lỗi thời so với thiết kế, xem ghi chú trong test-matrix.md) — nhưng KẾT QUẢ quan sát được (AC-007) vẫn y hệt: không đảo lẫn STT dù trùng ngày lập, vì giờ chỉ còn 1 nguồn dữ liệu duy nhất, không có 2 truy vấn `ORDER BY tdlap` độc lập nào có thể trả về thứ tự khác nhau.
- **Preconditions**: Kỳ có ≥ 3 hóa đơn khác nhau (khác số HĐ hoặc khác ký hiệu) nhưng CÙNG ngày lập (`tdlap`).
- **Steps**:
  1. Xuất Excel, mở sheet "HĐ mua vào" — ghi lại STT của từng hóa đơn trùng ngày (cột A).
  2. Mở sheet "Chi tiết mua vào" — với mỗi hóa đơn, kiểm cột STT của các dòng chi tiết thuộc hóa đơn đó.
- **Expected Result**: STT ở sheet Chi tiết của mỗi hóa đơn khớp CHÍNH XÁC với STT của đúng hóa đơn đó ở sheet HĐ — không có trường hợp 2 hóa đơn trùng ngày bị đảo STT cho nhau.
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-011b — Mọi dòng chi tiết của cùng 1 hóa đơn mang cùng 1 STT

- **Requirement**: AC-to-khai-gtgt01-007, FR-to-khai-gtgt01-004
- **Preconditions**: 1 hóa đơn có ≥ 3 dòng hàng hóa/dịch vụ (`hdhhdvu.length >= 3`).
- **Steps**: Mở sheet Chi tiết, xác định tất cả dòng thuộc hóa đơn đó (cùng khóa nghiệp vụ), kiểm cột STT của từng dòng.
- **Expected Result**: Toàn bộ các dòng của hóa đơn đó có cùng 1 giá trị STT, đúng bằng `i+1` (vị trí hóa đơn đó trong `datas`, cũng là STT của nó ở sheet HĐ).
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-012 — Một chiều của kỳ không có hóa đơn — sheet vẫn tạo đủ, không lỗi

- **Requirement**: AC-to-khai-gtgt01-004, BR-to-khai-gtgt01-005, FR-to-khai-gtgt01-006
- **Preconditions**: Kỳ có hóa đơn bán ra nhưng KHÔNG có hóa đơn mua vào nào được gán (hoặc ngược lại).
- **Steps**:
  1. Gọi `GET /to-khai/hoa-don/chi-tiet?...&chieu=purchase` — kỳ vọng `200 { total: 0, datas: [], thayThe: [] }`.
  2. Xuất Excel, mở sheet "HĐ mua vào" và "Chi tiết mua vào".
- **Expected Result**: Response là `200` rỗng (KHÔNG phải 404 — api-contract Mục 2.3). Cả 2 sheet vẫn tồn tại, có đủ dòng tiêu đề cột (26 cột cho "HĐ mua vào"), phần dữ liệu trống — không có lỗi/exception, không bị bỏ qua sheet.
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-012b — Kỳ chưa từng "Kê khai" — 4 sheet mới chỉ có tiêu đề

- **Requirement**: Edge case 3, BR-to-khai-gtgt01-005, FR-to-khai-gtgt01-006
- **Preconditions**: Kỳ hoàn toàn mới, chưa bấm "Kê khai" lần nào (`tokhai_ky_hoa_don` rỗng cho kỳ này).
- **Steps**: Xuất Excel.
- **Expected Result**: Cả 4 sheet mới đều chỉ có tiêu đề cột, không dữ liệu, không lỗi. (`layBangKeTheoKy` return sớm `{ total: 0, datas: [], thayThe: [] }` khi `daGan.length === 0` — không gọi `GDTService`, không đọc `detail` — endpoint `/chi-tiet` thừa hưởng early-exit này vì gọi thẳng hàm.)
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-013 — Một trong 2 lượt gọi `/chi-tiet` lỗi — hủy toàn bộ, không tải file

- **Requirement**: AC-to-khai-gtgt01-005/006 (nhánh lỗi), E-to-khai-gtgt01-001
- **Preconditions**: Giả lập lỗi mạng/server cho 1 trong 2 lượt gọi `GET /to-khai/hoa-don/chi-tiet` (vd DevTools throttle "Offline"/chặn request đúng lúc gọi `chieu=sold`, hoặc test double trả 500).
- **Steps**:
  1. Bấm "Xuất Excel" (khởi 2 lượt song song: `chieu=purchase` và `chieu=sold`, theo api-contract Mục 2.6 bước 2).
  2. Quan sát khi 1 trong 2 request thất bại (ví dụ lượt `sold` trả 500/timeout).
- **Expected Result**: Không có file nào được tải về; toast nêu ĐÚNG chiều lỗi theo mẫu "Không tải được dữ liệu hóa đơn bán ra: <message BE>" (api-contract Mục 2.6 bước 3), không phải thông báo chung chung; nút "Xuất Excel" trở lại trạng thái bình thường trong `finally`.
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-014 — [N/A] Vượt trần kỹ thuật khi tải dữ liệu Chi tiết

- **Requirement**: AC-to-khai-gtgt01-005, E-to-khai-gtgt01-002
- **Kết luận**: **N/A** — api-contract Mục 2.4 bất biến #5 xác nhận endpoint `/chi-tiet` KHÔNG có trần khoảng ngày; tập hóa đơn đã giới hạn tự nhiên bởi kỳ (tối đa 1 quý), luôn nhỏ hơn trần 366 ngày của `/gdt/invoices/:direction/saved-details`. E-to-khai-gtgt01-002/AC-to-khai-gtgt01-005 không phát sinh trong thiết kế đã chốt. BA cần đánh dấu N/A chính thức trong `srs/to-khai-gtgt01-spec.md` khi sign-off (QA không tự sửa spec).
- **Status**: N/A — không chạy.

### TC-to-khai-gtgt01-015 — Nút "Xuất Excel" chuyển trạng thái đang xử lý, chặn bấm lần 2

- **Requirement**: AC-to-khai-gtgt01-006, FR-to-khai-gtgt01-005, NFR-to-khai-gtgt01-001
- **Preconditions**: Kỳ có đủ dữ liệu để lượt tải mất > 1 giây (network throttle nếu cần để quan sát rõ).
- **Steps**:
  1. Bấm "Xuất Excel".
  2. Ngay lập tức quan sát trạng thái nút (disabled/label đổi/spinner) — theo `ToKhaiGtgt01Editor.tsx` state đang xuất (api-contract F8).
  3. Thử bấm lại trong lúc đang tải.
- **Expected Result**: Nút chuyển trạng thái đang xử lý NGAY khi bấm (không có khoảng trễ "đứng im"); bấm lần 2 không có tác dụng (không gửi thêm request); nút trở lại bình thường khi hoàn tất hoặc lỗi (mở khóa trong `finally`).
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-016 — Bấm "Xuất Excel" 2 lần liên tiếp nhanh (double-click)

- **Requirement**: FR-to-khai-gtgt01-005 (hệ quả), regression
- **Preconditions**: Như TC-015.
- **Steps**: Double-click nhanh vào nút "Xuất Excel" (2 click trong < 300ms).
- **Expected Result**: Chỉ 1 lượt tải dữ liệu chạy (kiểm qua Network tab — đúng 2 request `/chi-tiet`, KHÔNG phải 4), chỉ 1 file được tải về, không lỗi console.
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-017 — Dữ liệu cũ "tang"/"giam" nhất quán giữa bảng kê web và Excel

- **Requirement**: AC-to-khai-gtgt01-011 áp dụng chéo Task 1 × Task 2
- **Preconditions**: Có ≥ 1 hóa đơn với `chi_tieu_tang_giam = "tang"` và ≥ 1 hóa đơn với `"giam"` trong DB (dữ liệu cũ, trước khi đổi mã).
- **Steps**:
  1. Mở bảng kê màn hình (`GET /to-khai/hoa-don`), quan sát dropdown 2 hóa đơn đó — kỳ vọng "38 — Tăng" và "37 — Giảm".
  2. Xuất Excel (`GET /to-khai/hoa-don/chi-tiet`), mở sheet "HĐ..." tương ứng, xem cột "Chỉ tiêu tăng giảm".
- **Expected Result**: Web hiển thị "38 — Tăng"/"37 — Giảm"; Excel hiển thị mã thô "38"/"37" (không phải "tang"/"giam" cũ, không phải chữ "Tăng"/"Giảm"). Cả 2 endpoint đi qua CÙNG 1 helper diễn giải duy nhất (api-contract Mục 3.3, B2) — không có logic diễn giải riêng ở FE hay ở endpoint khác.
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-018 — Hóa đơn có `chiTiet: null` (chưa từng "Tải chi tiết")

- **Requirement**: BR-to-khai-gtgt01-001; quyết định F1 đã chốt (api-contract Mục 5 OQ-arch-001, phương án (a))
- **Preconditions**: 1 hóa đơn đã gán kỳ + `duocTinh` = true (có mặt ở bảng kê), nhưng cột `detail` trong `vct50view`/`vct60view` là NULL (chưa từng chạy "Tải chi tiết"/"Đồng bộ").
- **Test Data**: Hóa đơn với `chiTiet: null` trong response `/chi-tiet`.
- **Steps**:
  1. Xác nhận hóa đơn có mặt ở bảng kê màn hình.
  2. Gọi `GET /to-khai/hoa-don/chi-tiet`, xác nhận phần tử tương ứng có `chiTiet: null` (không phải object rỗng, không bị lược bỏ khỏi `datas[]`).
  3. Xuất Excel, mở sheet "Chi tiết..." tương ứng.
- **Expected Result**:
  - Hóa đơn vẫn có ĐÚNG 1 dòng trong sheet "Chi tiết..." (không bị bỏ sót — giữ đúng BR-001).
  - Các cột thông tin hóa đơn lấy từ `datas[i]` (dòng bảng kê, KHÔNG phải từ `chiTiet`): mẫu số, ký hiệu, số HĐ, ngày lập, MST/tên/địa chỉ đối tác, mã NT, tỷ giá, tổng tiền hàng/thuế/CK/phí/thanh toán, trạng thái HĐ, kết quả kiểm tra — các field này TRÙNG TÊN giữa `SavedInvoiceRow` (`khmshdon/khhdon/shdon/tdlap/nbmst/nbten/...`) và payload chi tiết GDT nên hiển thị đúng.
  - Các cột thuộc dòng hàng hóa (tên hàng, mã VT, ĐVT, số lượng, đơn giá, tiền CK, thuế suất, tiền thuế theo dòng...) để TRỐNG (giống `EMPTY_LINE` của `toDetailRows`).
  - Một số cột phụ chỉ có trong payload chi tiết đầy đủ, KHÔNG có trong `SavedInvoiceRow` — cũng để trống, chấp nhận được: mã CQT (`mccqt`), ngày CQT ký, ghi chú (`gchu`), website người bán, biển số xe, mã tra cứu NCC/link tra cứu (`msttcgp` CÓ trong `SavedInvoiceRow` qua `extras` nên link tra cứu NCC vẫn hoạt động — chỉ các field còn lại kể trên mới trống).
  - STT của dòng này = `i+1` như bình thường, khớp đúng STT của nó ở sheet "HĐ...".
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-019 — Tenant isolation: endpoint `/chi-tiet`

- **Requirement**: Không có AC riêng — quy ước bắt buộc MAXV (multi-tenant), Constraint mục 7
- **Preconditions**: 2 công ty (tenant DB khác nhau) cùng có kỳ T7/2026 với hóa đơn khác nhau.
- **Steps** (theo mẫu `toKhaiRouteLimits.test.ts` — header `x-cong-ty` chọn tenant DB):
  1. Gọi `GET /api/v1/to-khai/hoa-don/chi-tiet?nam=2026&kyLoai=thang&kySo=7&chieu=purchase` kèm header/token công ty A.
  2. Gọi lại y hệt tham số kỳ nhưng đổi header/token sang công ty B.
- **Expected Result**: Kết quả trả về của công ty A CHỈ chứa hóa đơn của công ty A; công ty B chỉ chứa của công ty B — không rò rỉ chéo dù cùng tham số kỳ.
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-020 — Endpoint mới không ảnh hưởng `GET /to-khai/hoa-don` hiện có

- **Requirement**: NFR-to-khai-gtgt01-002
- **Steps**: Code review xác nhận endpoint mới là handler/route riêng (B4/B5, không đổi `keKhaiKy.controller.ts` phần đọc bảng kê hiện có ngoài helper diễn giải dùng chung — B1/B2); đo thời gian phản hồi `GET /to-khai/hoa-don` trước/sau khi thêm endpoint mới (không nên đổi đáng kể).
- **Expected Result**: Không có thay đổi hành vi/hiệu năng của bảng kê hiện có, đúng api-contract Mục 2.4 bất biến #6.
- **Status**: Chưa chạy — chủ yếu qua code review ở Phase B.

### TC-to-khai-gtgt01-042 — `datas[].chiTiet` luôn có mặt cho mọi phần tử

- **Requirement**: BR-to-khai-gtgt01-001 (api-contract Mục 2.4 bất biến #2)
- **Preconditions**: Kỳ có hỗn hợp hóa đơn đã tải chi tiết và chưa tải chi tiết.
- **Steps**: Gọi `/chi-tiet`, kiểm mọi phần tử `datas[]` đều có key `chiTiet` (dùng `"chiTiet" in item`), giá trị là object hoặc `null`, không phải `undefined`/thiếu key.
- **Expected Result**: 100% phần tử có key `chiTiet` tường minh.
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-043 — `datas[].id` + thứ tự của `/chi-tiet` trùng đúng với `/hoa-don`

- **Requirement**: BR-to-khai-gtgt01-001, FR-to-khai-gtgt01-004 (api-contract Mục 2.4 bất biến #1, #3)
- **Preconditions**: Kỳ có ≥ 5 hóa đơn, không có thao tác ghi (PATCH quyết định, "Kê khai" lại, "Tính lại") xen giữa 2 lượt gọi.
- **Steps**:
  1. Gọi `GET /to-khai/hoa-don?nam=...&kyLoai=...&kySo=...&chieu=purchase`, lấy mảng `id` theo đúng thứ tự `datas[]`.
  2. Gọi ngay sau đó `GET /to-khai/hoa-don/chi-tiet` với cùng tham số, lấy mảng `id` theo thứ tự `datas[]`.
  3. So sánh 2 mảng `id` (deep-equal theo thứ tự, không phải chỉ set-equal).
- **Expected Result**: 2 mảng `id` giống hệt nhau, kể cả thứ tự — vì cả 2 endpoint cùng gọi `layBangKeTheoKy(db, ky, chieu)` không tham số nào khác. Đây là nền tảng cho TC-003 (STT sheet HĐ khớp bảng kê web) và TC-011 (STT sheet Chi tiết không lệch khi trùng ngày lập).
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-044 — 400 khi `nam`/`kyLoai`/`kySo` sai hoặc thiếu

- **Requirement**: Error Matrix, api-contract Mục 2.5
- **Test Data**: Ví dụ `GET /to-khai/hoa-don/chi-tiet?nam=abc&kyLoai=thang&kySo=7&chieu=purchase`, hoặc thiếu hẳn `kySo`, hoặc `kySo=13` với `kyLoai=thang`.
- **Expected Result**: `400 { "message": "Kỳ kê khai không hợp lệ (kiểm tra lại loại kỳ, số kỳ và năm)." }`.
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-045 — 400 khi `chieu` sai hoặc thiếu

- **Requirement**: Error Matrix, api-contract Mục 2.5
- **Test Data**: `chieu=xyz` hoặc thiếu `chieu`.
- **Expected Result**: `400 { "message": "Chiều hóa đơn không hợp lệ (chỉ nhận purchase hoặc sold)." }`.
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-046 — 401 khi thiếu/hết hạn JWT

- **Requirement**: Error Matrix, api-contract Mục 2.5
- **Steps**: Gọi endpoint không kèm Bearer token (hoặc token hết hạn).
- **Expected Result**: `401 { "success": false, "message": ... }`.
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-047 — 403 khi thiếu module `tokhai` hoặc quyền công ty

- **Requirement**: Error Matrix, api-contract Mục 2.5
- **Preconditions**: Tài khoản/gói KHÔNG có module `tokhai`, hoặc không có quyền truy cập công ty đang chọn.
- **Expected Result**: `403 { "success": false, "message": ... }`.
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-048 — 429 khi vượt 20 lượt/phút/người dùng

- **Requirement**: Error Matrix, api-contract Mục 2.5 (`gioiHanTheoNguoiDung(20, "1 minute")`)
- **Steps** (theo mẫu `toKhaiRouteLimits.test.ts` — `POST /ke-khai: tối đa 10 lượt/phút`): gọi endpoint 21 lần liên tiếp trong 1 phút, cùng user.
- **Expected Result**: 20 lượt đầu `200`, lượt thứ 21 `429` với body mặc định `@fastify/rate-limit` (không phải body nghiệp vụ tiếng Việt).
- **🟢 Ghi chú (không chặn)**: FE HIỆN CHƯA xử lý riêng mã 429 cho luồng xuất Excel — rơi vào nhánh lỗi chung E-001 (toast hiển thị message tiếng Anh mặc định của plugin thay vì câu nghiệp vụ như "Không tải được dữ liệu hóa đơn..."). Đây là suggestion cải thiện UX, KHÔNG phải điều kiện chặn merge, theo quyết định của user/Architect.
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-049 — 🔴 [BUG user báo] Sheet "HĐ mua vào": cột MST/Tên người bán KHÔNG được trống dù API không trả `mstDoiTac`/`tenDoiTac`

- **Requirement**: FR-to-khai-gtgt01-002 (bộ cột, thứ tự cột khớp bảng kê màn hình) — bug người dùng báo 2026-09-16, không thuộc phạm vi FR/AC gốc của đợt này nhưng phát hiện trong lúc xuất Excel/xem bảng kê
- **Bối cảnh kỹ thuật**: `toDisplayRow` (`hddt/invoiceRow.ts`) đọc trực tiếp `r.mstDoiTac`/`r.tenDoiTac` để đổ vào cột "MST người bán.../Tên người bán..." (chiều mua vào). Response thật của `GET /to-khai/hoa-don` và `GET /to-khai/hoa-don/chi-tiet` KHÔNG có 2 field gộp này — chỉ có field GDT gốc `nbmst`/`nbten` (người bán) và `nmmst`/`nmten` (người mua). Thiếu bước gộp field thì `mstDoiTac`/`tenDoiTac` là `undefined`, cột trên bảng kê web VÀ sheet "HĐ mua vào" đều trống.
- **Preconditions**: Kỳ có ≥ 1 hóa đơn mua vào đã gán, response API chỉ có `nbmst`/`nbten` (không có `mstDoiTac`/`tenDoiTac` — đúng shape BE thật, KHÔNG tự thêm 2 field gộp vào fixture test).
- **Steps**:
  1. Gọi `GET /to-khai/hoa-don/chi-tiet?...&chieu=purchase`, xác nhận response `datas[]` không có `mstDoiTac`/`tenDoiTac`.
  2. Xuất Excel, mở sheet "HĐ mua vào".
  3. Xem cột "MST người bán/MST người xuất hàng" và "Tên người bán/Tên người xuất hàng".
- **Expected Result**: Hai cột có đúng giá trị `nbmst`/`nbten` của từng hóa đơn — KHÔNG trống, KHÔNG lệch giữa các dòng (mỗi hóa đơn phải ra đúng MST/tên người bán CỦA CHÍNH NÓ, không bị lặp lại giá trị của hóa đơn khác do đọc nhầm field).
- **Fix đã áp dụng**: `getBangKe`/`getBangKeChiTiet` (`features/to_khai/api/toKhai.ts`) đi qua `mapInvoiceDatas` (export từ `features/hddt/api/gdt.ts`, dùng lại đúng hàm `getSavedInvoices`/`getInvoices` bên HĐĐT đang dùng) để gộp `mstDoiTac`/`tenDoiTac` từ `nbmst`/`nbten` (chiều mua vào) trước khi trả cho component/hàm xuất Excel — không nhân đôi logic gộp field.
- **Tầng test**: Script Node gọi thẳng `xuatToKhaiGtgt01()` thật (không tự dựng lại), fixture CHỈ có field GDT gốc.
- **Status**: ✅ Pass — xem `qa/test-report.md` mục "Vòng Frontend — chạy lại sau fix RVW-T12 + bug MST/Tên đối tác".

### TC-to-khai-gtgt01-050 — 🔴 [BUG user báo] Sheet "HĐ bán ra": cột MST/Tên người mua KHÔNG được trống dù API không trả `mstDoiTac`/`tenDoiTac`

- Đối xứng TC-049, chiều `sold`: cột "MST người mua/MST người nhận hàng" và "Tên người mua/Tên người nhận hàng" phải đúng `nmmst`/`nmten` của từng hóa đơn.
- **Requirement**: FR-to-khai-gtgt01-002 — cùng bug TC-049, đối xứng chiều bán ra.
- **Status**: ✅ Pass — cùng bằng chứng với TC-049 (cùng 1 fix `mapInvoiceDatas`, dùng chung `PARTNER_FIELD.sold = { mst: "nmmst", ten: "nmten" }`).

## Task 2 — Đổi mã "Chỉ tiêu tăng giảm"

### TC-to-khai-gtgt01-021 — Dropdown hiển thị đúng 3 lựa chọn

- **Requirement**: AC-to-khai-gtgt01-009, FR-to-khai-gtgt01-007
- **Steps**: Mở bảng kê, click dropdown "Chỉ tiêu tăng giảm" trên 1 dòng bất kỳ.
- **Expected Result**: Đúng 3 mục: "—" (giá trị rỗng), "37 — Giảm", "38 — Tăng" — đúng thứ tự này.
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-022 — Chọn "38 — Tăng", lưu, tải lại — giá trị đúng

- **Requirement**: AC-to-khai-gtgt01-010, FR-to-khai-gtgt01-008, BR-to-khai-gtgt01-003
- **Steps**:
  1. Chọn "38 — Tăng" cho 1 hóa đơn (PATCH `/to-khai/hoa-don/:chieu/:id`, body `{ chiTieuTangGiam: "38" }`).
  2. Đợi `200 { "ok": true }` (không lỗi).
  3. Tải lại trang (F5) hoặc điều hướng đi rồi quay lại.
- **Expected Result**: Dropdown vẫn hiển thị "38 — Tăng"; kiểm DB/API trả `chiTieuTangGiam: "38"`.
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-023 — Chọn "37 — Giảm", lưu, tải lại — giá trị đúng

- Đối xứng TC-022 với "37 — Giảm".
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-024 — Giá trị cũ "tang" đọc ra "38" khi hiển thị

- **Requirement**: AC-to-khai-gtgt01-011, FR-to-khai-gtgt01-009, BR-to-khai-gtgt01-004
- **Preconditions**: DB có sẵn 1 dòng `tokhai_ky_hoa_don.chi_tieu_tang_giam = 'tang'` (set trực tiếp qua SQL/fixture, mô phỏng dữ liệu trước khi đổi mã).
- **Test Data**: `chi_tieu_tang_giam = 'tang'`.
- **Steps**: Gọi helper diễn giải (api-contract B2, hàm thuần cạnh `keKhaiKy.service.ts:356`) trực tiếp với input `"tang"`, hoặc gọi `layBangKeTheoKy`/`GET /to-khai/hoa-don` cho hóa đơn đó.
- **Expected Result**: Trả về `"38"` (không phải `"tang"`, không rỗng, không lỗi).
- **Tầng test**: BE-unit — hàm đã được xác nhận là hàm thuần theo api-contract, test trực tiếp không cần DB.
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-025 — Giá trị cũ "giam" đọc ra "37"

- Đối xứng TC-024, `chi_tieu_tang_giam = 'giam'` → `"37"`.
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-026 — PATCH giá trị "tang" (mã cũ) sau khi đổi mã — bị loại

- **Requirement**: AC-to-khai-gtgt01-012, FR-to-khai-gtgt01-010, E-to-khai-gtgt01-003, BR-to-khai-gtgt01-003
- **Test Data**: `locQuyetDinh({ chiTieuTangGiam: "tang" })`
- **Expected Result**: `chiTieuTangGiam` KHÔNG có mặt trong object trả về (`"chiTieuTangGiam" in kq === false`) — đối lập rõ với hành vi READ (TC-024, nơi `"tang"` được diễn giải thành `"38"`, không bị loại). Ghi rõ 2 test case riêng biệt để không nhầm. PATCH vẫn trả `200 { "ok": true }`, DB không đổi (api-contract Mục 3.2).
- **Tầng test**: BE-unit (`npx tsx --test src/__tests__/to_khai/quyetDinhKeKhai.test.ts`)
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-027 — PATCH giá trị "giam" — bị loại

- Tương tự TC-026, `"giam"`.
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-028 — PATCH giá trị rác "xoay" — bị loại (regression)

- **Test Data**: `locQuyetDinh({ chiTieuTangGiam: "xoay" })` — test này đã tồn tại (dòng 19 của `quyetDinhKeKhai.test.ts`, gộp chung với field khác), giữ nguyên hành vi sau khi đổi whitelist.
- **Expected Result**: `chiTieuTangGiam` không có trong kết quả.
- **Status**: Chưa chạy — xác nhận KHÔNG regress sau khi sửa whitelist.

### TC-to-khai-gtgt01-029 — PATCH giá trị "39" (số hợp lý nhưng ngoài tập) — bị loại

- **Test Data**: `locQuyetDinh({ chiTieuTangGiam: "39" })`
- **Expected Result**: Bị loại — chỉ đúng 3 giá trị `""`, `"37"`, `"38"` được chấp nhận.
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-030 — PATCH đồng thời field invalid + field valid — field valid vẫn lưu

- **Requirement**: E-to-khai-gtgt01-003 ("không từ chối toàn bộ yêu cầu nếu còn field hợp lệ khác")
- **Test Data**: `locQuyetDinh({ chiTieuTangGiam: "tang", ghiChu: "ghi chú hợp lệ" })` (dùng mã CŨ thay vì "xoay" để phủ đúng case thực tế nhất: kế toán/hệ thống cũ vô tình gửi lại mã cũ lẫn với field khác hợp lệ)
- **Expected Result**: Kết quả có `ghiChu: "ghi chú hợp lệ"`, KHÔNG có `chiTieuTangGiam`.
- **Status**: Chưa chạy — test hiện có tương tự (dòng 18-21 `quyetDinhKeKhai.test.ts`) dùng `"xoay"`, cần bổ sung case combo cụ thể với giá trị cũ "tang"/"giam".

### TC-to-khai-gtgt01-031 — PATCH giá trị rỗng "" — hợp lệ, lưu null

- Test hiện có, giữ nguyên (Edge case 6).
- **Status**: Sẵn sàng — không cần sửa, chỉ chạy lại xác nhận không regress.

### TC-to-khai-gtgt01-032 — Đổi "Chỉ tiêu tăng giảm" không làm đổi ct37/ct38 của tờ khai

- **Requirement**: AC-to-khai-gtgt01-013, BR-to-khai-gtgt01-002
- **Preconditions**: Form tờ khai của kỳ đang có giá trị cụ thể ở ô nhập tay chỉ tiêu [37] hoặc [38] (`ban.ghiDe["ct37"]` hoặc `["ct38"]`).
- **Steps**:
  1. Ghi lại giá trị hiện tại của ô [37]/[38] trên form.
  2. Đổi "Chỉ tiêu tăng giảm" của 1 hoặc nhiều hóa đơn trong kỳ (PATCH qua `OChiTieuTangGiam`).
  3. Tải lại / lấy lại dữ liệu tờ khai (`GET /to-khai/gtgt01` hoặc tương đương).
- **Expected Result**: Giá trị ô [37]/[38] KHÔNG đổi — hai cơ chế hoàn toàn độc lập (`CT_NHAP_TAY` không đọc `chi_tieu_tang_giam`, api-contract Mục 3.1 xác nhận "không đọc trong `tinhGtgt01`").
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-033 — Excel hiển thị mã thô "37"/"38", không đổi thành chữ

- **Requirement**: Quyết định 3c (CONTEXT_SUMMARY Mục 2)
- **Steps**: Xuất Excel, mở sheet "HĐ...", xem cột "Chỉ tiêu tăng giảm" của hóa đơn có giá trị `"37"`/`"38"`.
- **Expected Result**: Ô hiển thị đúng `"37"`/`"38"` (chuỗi số thô), KHÔNG phải "Điều chỉnh giảm"/"Điều chỉnh tăng" hay "Tăng"/"Giảm".
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-034 — Ô rỗng hiển thị "—" cả web lẫn Excel

- **Requirement**: Quyết định 3e — hành vi giữ nguyên, không đổi.
- **Status**: Sẵn sàng — kiểm regression, không phải logic mới.

### TC-to-khai-gtgt01-035 — Đổi từ giá trị cũ sang giá trị mới — DB chuyển hẳn sang mã mới

- **Requirement**: Edge case 5, BR-to-khai-gtgt01-004
- **Preconditions**: Hóa đơn có `chi_tieu_tang_giam = "tang"` (hiển thị "38 — Tăng").
- **Steps**:
  1. Xác nhận dropdown hiện "38 — Tăng".
  2. Đổi sang "37 — Giảm", lưu.
  3. Kiểm DB trực tiếp giá trị cột `chi_tieu_tang_giam`.
- **Expected Result**: DB lưu `"37"` (mã mới), KHÔNG còn `"giam"`/`"tang"` dạng chữ cũ cho hóa đơn này (api-contract Mục 3.3: "Bản ghi cũ chỉ chuyển sang mã mới khi kế toán lưu một giá trị KHÁC giá trị đang hiển thị").
- **Status**: Chưa chạy.

## Regression / Non-functional

### TC-to-khai-gtgt01-036 — `quyetDinhKeKhai.test.ts` pass toàn bộ sau khi sửa whitelist

- **Steps**: `cd be_maxv && npx tsx --test src/__tests__/to_khai/quyetDinhKeKhai.test.ts`
- **Expected Result**: Toàn bộ test pass, gồm cả test mới thêm cho TC-026/027/028/029/030 và helper diễn giải (TC-024/025).
- **Status**: Chưa chạy — file PHẢI được backend-engineer sửa trước (api-contract B6).

### TC-to-khai-gtgt01-037 — Toàn bộ suite `be_maxv` pass

- **Steps**: `cd be_maxv && npm test`
- **Expected Result**: Không có test nào khác trong `to_khai/` (hoặc ngoài) bị vỡ do đổi type `ChiTieuTangGiam` hoặc thêm endpoint mới. Đặc biệt kiểm `tinhGtgt01.test.ts`, `toKhaiGtgt01Ghide.test.ts`, `soatToKhai.test.ts` — các file đọc `layBangKeTheoKy`/`DongBangKe` gián tiếp.
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-038 — `be_maxv` typecheck + lint pass

- **Steps**: `cd be_maxv && npm run typecheck && npm run lint`
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-039 — `hdđt_maxv` build pass

- **Steps**: `cd hdđt_maxv && npm run build`
- **Expected Result**: `tsc -b` không lỗi kiểu (đặc biệt `ChiTieuTangGiam` union đổi giá trị ảnh hưởng `ky.ts`, `OQuyetDinh.tsx`, `cotBangKe.ts`, `api/toKhai.ts`, `BangKeMotChieu.tsx`, `xuatToKhaiExcel.ts`, `exportXlsx.ts`, `ToKhaiGtgt01Editor.tsx` — api-contract Mục 4 F1-F8); `vite build` thành công.
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-040 — `hdđt_maxv` lint pass

- **Steps**: `cd hdđt_maxv && npm run lint`
- **Status**: Chưa chạy.

### TC-to-khai-gtgt01-041 — `tinhGtgt01.ts`/`CT_NHAP_TAY` không đổi hành vi

- **Steps**: `cd be_maxv && npx tsx --test src/__tests__/to_khai/tinhGtgt01.test.ts`
- **Expected Result**: Pass không đổi — xác nhận Task 2 không đụng `tinhGtgt01.ts` (Constraint mục 7).
- **Status**: Chưa chạy.
