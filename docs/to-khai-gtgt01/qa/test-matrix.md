---
type: test-matrix
feature: to-khai-gtgt01
updated: 2026-09-16
links:
  - docs/to-khai-gtgt01/CONTEXT_SUMMARY.md
  - docs/to-khai-gtgt01/srs/to-khai-gtgt01-spec.md
  - docs/to-khai-gtgt01/srs/to-khai-gtgt01-flows.md
  - docs/to-khai-gtgt01/architecture/api-contract.md
  - docs/to-khai-gtgt01/architecture/adr/ADR-001-chi-tiet-hoa-don-theo-ky.md
---

# Ma trận kiểm thử: Xuất Excel kèm chi tiết hóa đơn & đổi mã "Chỉ tiêu tăng giảm"

> Phase A (Shift-Left). Contract API đã chốt (`docs/to-khai-gtgt01/architecture/api-contract.md`,
> `architecture/adr/ADR-001-chi-tiet-hoa-don-theo-ky.md`) — không còn TC nào "chờ contract". Endpoint
> mới: `GET /api/v1/to-khai/hoa-don/chi-tiet?nam&kyLoai&kySo&chieu`, response `{ total, datas, thayThe }`
> với mỗi `datas[]` có thêm `chiTiet: object | null`. FE xuất Excel gọi đúng **2 lượt** (mỗi chiều 1
> lượt, KHÔNG phải 4 như bản `flows.md` cũ — xem OQ-arch-002, BA cần cập nhật `flows.md` khi sign-off).

**Tầng test dùng trong ma trận:**
- `BE-unit` — `npx tsx --test src/__tests__/to_khai/<file>.test.ts` (hàm thuần, không cần DB)
- `BE-integration` — Fastify `app.inject()` + `mock.module` (theo mẫu `toKhaiRouteLimits.test.ts`) hoặc DB thật (theo mẫu `keKhaiKyGocDb.test.ts`)
- `FE-build` — `cd hdđt_maxv && npm run build` (chỉ bắt lỗi kiểu/biên dịch — **`hdđt_maxv` không có test runner**, xem Ghi chú cuối bảng)
- `FE-manual` — kiểm tay trên trình duyệt (không có Vitest/Jest trong `hdđt_maxv/package.json`)
- `Excel-manual` — mở file `.xlsx` tải về, đối chiếu thủ công (hoặc script Node dùng `exceljs` đọc lại buffer để so sánh, do QA/BE tự viết khi cần)

## Task 1 — Xuất Excel 4 sheet (endpoint `GET /to-khai/hoa-don/chi-tiet`)

| TC ID | Scenario | AC | FR/BR/E | Tầng test | Priority | Trạng thái |
|---|---|---|---|---|---|---|
| TC-to-khai-gtgt01-001 | Xuất Excel đủ 6 sheet đúng thứ tự khi kỳ CÓ phụ lục 204 | AC-001 | FR-001 | FE-manual + Excel-manual | P0 | Sẵn sàng |
| TC-to-khai-gtgt01-002 | Xuất Excel đủ 5 sheet đúng thứ tự khi kỳ KHÔNG có phụ lục | AC-001 | FR-001 | FE-manual + Excel-manual | P0 | Sẵn sàng |
| TC-to-khai-gtgt01-003 | Sheet "HĐ mua vào"/"HĐ bán ra" khớp bộ cột + định dạng số với bảng kê màn hình, đủ toàn bộ hóa đơn kỳ (không chỉ trang đang xem) | AC-002 | FR-002 | FE-manual + Excel-manual | P0 | Sẵn sàng |
| TC-to-khai-gtgt01-004 | Tập hóa đơn "Chi tiết mua vào" trùng tuyệt đối tập "HĐ mua vào" — happy path nhiều hóa đơn (đảm bảo bởi thiết kế: cả 2 sheet dựng từ CÙNG 1 response `/chi-tiet`, bất biến #1/#2 api-contract Mục 2.4) | AC-003 | FR-003, BR-001 | BE-integration (ưu tiên) + Excel-manual | P0 | Sẵn sàng |
| TC-to-khai-gtgt01-005 | Tập hóa đơn "Chi tiết bán ra" trùng tuyệt đối tập "HĐ bán ra" | AC-003 | FR-003, BR-001 | BE-integration + Excel-manual | P0 | Sẵn sàng |
| TC-to-khai-gtgt01-006 | 🔴 Hóa đơn ĐÃ BỊ THAY THẾ (tthai=4) — không xuất hiện ở `/chi-tiet.datas` (do gọi verbatim `layBangKeTheoKy`, không lọc lại/lọc thêm) — chặn regression nếu BE code lệch khỏi bất biến #1 | Edge case 2 | BR-001, FR-003 | BE-unit/integration (ưu tiên nhất) | P0 | Sẵn sàng |
| TC-to-khai-gtgt01-007 | 🔴 Hóa đơn ĐÃ BỊ HỦY (tthai=6) — không xuất hiện ở `/chi-tiet.datas` | Edge case 2 | BR-001, FR-003 | BE-unit/integration | P0 | Sẵn sàng |
| TC-to-khai-gtgt01-008 | Hóa đơn thay thế có ngày lập NGOÀI ranh giới lịch của kỳ nhưng đã được gán kỳ đó — vẫn xuất hiện đủ ở cả 2 sheet | Edge case 1 | BR-001 | BE-integration + Excel-manual | P0 | Sẵn sàng |
| TC-to-khai-gtgt01-009 | Hóa đơn CHƯA gán kỳ (chưa bấm "Kê khai") nhưng ngày lập nằm trong khoảng ngày lịch của kỳ — KHÔNG xuất hiện ở sheet nào | (suy từ BR-001 + cơ chế `layBangKeTheoKy`) | BR-001 | BE-integration | P0 | Sẵn sàng |
| TC-to-khai-gtgt01-010 | Hóa đơn đã gán kỳ, đang đánh dấu "Không kê khai" — vẫn xuất hiện ở cả sheet HĐ và Chi tiết | AC-008 | BR-006, FR-002 | BE-integration + Excel-manual | P0 | Sẵn sàng |
| TC-to-khai-gtgt01-011 | Hai hóa đơn khác nhau CÙNG ngày lập trong kỳ — STT ở sheet Chi tiết khớp đúng hóa đơn tương ứng ở sheet HĐ. Cơ chế THẬT theo contract: `datas[i].chiTiet` bung ra sheet Chi tiết với STT = `i+1` — CÙNG vị trí `i` trong CÙNG một mảng `datas` dùng để dựng cả 2 sheet, nên không có rủi ro lệch thứ tự giữa 2 truy vấn riêng như lo ngại ban đầu | AC-007 | FR-004, Edge case 4 | BE-integration + Excel-manual | P0 | Sẵn sàng — **xem Ghi chú spec↔contract cuối file** |
| TC-to-khai-gtgt01-011b | Mọi dòng chi tiết (bung theo hàng hóa) của CÙNG một hóa đơn đều mang CÙNG một số STT (= `i+1` của hóa đơn đó trong `datas`) | AC-007 | FR-004 | Excel-manual | P1 | Sẵn sàng |
| TC-to-khai-gtgt01-012 | Một chiều của kỳ không có hóa đơn nào được gán — sheet HĐ và Chi tiết chiều đó vẫn tạo đủ tiêu đề cột, dữ liệu trống, không lỗi (`/chi-tiet` trả `200 { total: 0, datas: [], thayThe: [] }`, không phải 404) | AC-004 | BR-005, FR-006 | FE-manual + Excel-manual | P0 | Sẵn sàng |
| TC-to-khai-gtgt01-012b | Kỳ CHƯA từng bấm "Kê khai" (cả 2 chiều rỗng) — đủ 4 sheet mới chỉ có tiêu đề, không lỗi | Edge case 3 | BR-005, FR-006 | FE-manual + Excel-manual | P0 | Sẵn sàng |
| TC-to-khai-gtgt01-013 | Một trong **2 lượt** (`chieu=purchase` hoặc `chieu=sold`) gọi `/chi-tiet` lỗi — hủy toàn bộ, không tải file, toast nêu đúng chiều lỗi (vd "Không tải được dữ liệu hóa đơn bán ra: <message BE>"), nút mở khóa lại trong `finally` | AC-005/006 (nhánh lỗi) | E-001 | FE-manual | P0 | Sẵn sàng |
| TC-to-khai-gtgt01-014 | Khoảng dữ liệu vượt trần kỹ thuật khi tải Chi tiết | AC-005 | E-002 | — | P3 | **N/A** — api-contract Mục 2.4 bất biến #5: không có trần khoảng ngày, tập đã giới hạn bởi kỳ (tối đa 1 quý), luôn nhỏ hơn trần 366 ngày của `/saved-details`. E-002/AC-005 không phát sinh trong thiết kế này |
| TC-to-khai-gtgt01-015 | Nút "Xuất Excel" chuyển trạng thái đang xử lý ngay khi bấm, chặn bấm lần 2 tới khi hoàn tất/lỗi | AC-006 | FR-005, NFR-001 | FE-manual | P1 | Sẵn sàng |
| TC-to-khai-gtgt01-016 | Bấm "Xuất Excel" 2 lần liên tiếp nhanh (double-click) — chỉ 1 lượt tải chạy (2 request, không phải 4), không sinh 2 file | (regression, suy từ FR-005) | FR-005, NFR-001 | FE-manual | P1 | Sẵn sàng |
| TC-to-khai-gtgt01-017 | Dữ liệu cũ `"tang"`/`"giam"` hiển thị nhất quán "38"/"37" ở CẢ bảng kê web (`/to-khai/hoa-don`) LẪN sheet "HĐ..." trong Excel (`/to-khai/hoa-don/chi-tiet`) — cùng đi qua 1 helper diễn giải duy nhất (api-contract Mục 3.3) | AC-011 (áp dụng chéo Task1×Task2) | FR-002, FR-009, BR-004 | Excel-manual | P0 | Sẵn sàng |
| TC-to-khai-gtgt01-018 | Hóa đơn có `chiTiet: null` (chưa từng "Tải chi tiết") — sheet Chi tiết vẫn có ĐÚNG 1 dòng cho hóa đơn đó: các cột thông tin hóa đơn (mẫu số, ký hiệu, số HĐ, ngày lập, MST/tên đối tác, MST CQT, trạng thái HĐ...) lấy từ chính dòng bảng kê (`datas[i]`, field GDT-native trùng tên với payload chi tiết — `khmshdon/khhdon/shdon/tdlap/nbmst/...`); các cột thuộc dòng hàng hóa (tên hàng, ĐVT, số lượng, đơn giá, thuế suất...) để trống; STT = `i+1` như mọi dòng khác. Một số cột phụ chỉ có trong payload chi tiết đầy đủ (mã CQT `mccqt`, ngày CQT ký, ghi chú `gchu`, website NB, biển số xe) sẽ RỖNG cho dòng này vì `SavedInvoiceRow` không có các field đó — chấp nhận được, không phải lỗi | (quyết định F1, api-contract Mục 5 OQ-arch-001 phương án (a) — **đã chốt**) | BR-001 | BE-integration + Excel-manual | P0 | Sẵn sàng |
| TC-to-khai-gtgt01-019 | Tenant isolation: `GET /to-khai/hoa-don/chi-tiet` chỉ trả dữ liệu của tenant DB hiện tại — công ty A không đọc được chi tiết hóa đơn của công ty B dù gọi đúng `nam/kyLoai/kySo/chieu` trùng nhau | (MAXV tenant isolation, không có AC riêng) | Constraint mục 7, NFR-002 | BE-integration | P0 | Sẵn sàng |
| TC-to-khai-gtgt01-020 | `GET /to-khai/hoa-don` không đổi gì ngoài diễn giải giá trị `chiTieuTangGiam` (api-contract Mục 2.4 bất biến #6, NFR-002) | — | NFR-002 | BE-integration (code review + so sánh query plan) | P1 | Sẵn sàng |
| TC-to-khai-gtgt01-042 | `datas[].chiTiet` luôn có mặt (object hoặc `null`) cho MỌI phần tử của `/chi-tiet` — không có phần tử nào thiếu key `chiTiet` | (bất biến #2 api-contract) | BR-001 | BE-integration | P1 | Sẵn sàng |
| TC-to-khai-gtgt01-043 | `datas[].id` (và thứ tự) của `GET /to-khai/hoa-don/chi-tiet` trùng ĐÚNG với `datas[].id` (và thứ tự) của `GET /to-khai/hoa-don`, gọi cùng `nam/kyLoai/kySo/chieu`, liên tiếp không có ghi xen giữa (cả 2 cùng gọi `layBangKeTheoKy`) — nền tảng của TC-003 (STT sheet HĐ khớp bảng kê web) và TC-011 (STT theo vị trí) | (bất biến #1, #3 api-contract) | BR-001, FR-004 | BE-integration | P0 | Sẵn sàng |
| TC-to-khai-gtgt01-044 | `GET /to-khai/hoa-don/chi-tiet` — `nam`/`kyLoai`/`kySo` sai hoặc thiếu → `400 { message: "Kỳ kê khai không hợp lệ..." }` | — | Error Matrix (api-contract Mục 2.5) | BE-integration | P1 | Sẵn sàng |
| TC-to-khai-gtgt01-045 | `GET /to-khai/hoa-don/chi-tiet` — `chieu` sai/thiếu (khác `purchase`/`sold`) → `400 { message: "Chiều hóa đơn không hợp lệ..." }` | — | Error Matrix | BE-integration | P1 | Sẵn sàng |
| TC-to-khai-gtgt01-046 | `GET /to-khai/hoa-don/chi-tiet` — thiếu/hết hạn JWT → `401 { success: false, message }` | — | Error Matrix | BE-integration | P1 | Sẵn sàng |
| TC-to-khai-gtgt01-047 | `GET /to-khai/hoa-don/chi-tiet` — gói không có module `tokhai` hoặc không có quyền công ty đang chọn → `403 { success: false, message }` | — | Error Matrix | BE-integration | P1 | Sẵn sàng |
| TC-to-khai-gtgt01-048 | `GET /to-khai/hoa-don/chi-tiet` — vượt 20 lượt/phút/người dùng → `429` (body mặc định `@fastify/rate-limit`). FE HIỆN CHƯA xử lý riêng 429 (rơi vào nhánh lỗi chung E-001, toast hiển thị message tiếng Anh mặc định của plugin thay vì message nghiệp vụ tiếng Việt) | — | Error Matrix | BE-integration (dựng bằng inject 21 lần, mẫu `toKhaiRouteLimits.test.ts`) | P2 🟢 | Sẵn sàng — ghi nhận là suggestion, KHÔNG chặn (theo quyết định user/Architect) |
| TC-to-khai-gtgt01-049 | 🔴 [BUG user báo] Sheet "HĐ mua vào" — cột "MST người bán.../Tên người bán..." phải đúng `nbmst`/`nbten` từng hóa đơn dù response API không có `mstDoiTac`/`tenDoiTac` gộp sẵn | (không có AC gốc — bug phát hiện ngoài phạm vi spec ban đầu) | FR-002 | Excel-manual + script Node gọi hàm thật | P0 | ✅ Pass (fix `mapInvoiceDatas`) |
| TC-to-khai-gtgt01-050 | 🔴 [BUG user báo] Sheet "HĐ bán ra" — cột "MST người mua.../Tên người mua..." phải đúng `nmmst`/`nmten` từng hóa đơn, đối xứng TC-049 | (không có AC gốc) | FR-002 | Excel-manual + script Node gọi hàm thật | P0 | ✅ Pass (cùng fix TC-049) |

## Task 2 — Đổi mã "Chỉ tiêu tăng giảm"

| TC ID | Scenario | AC | FR/BR/E | Tầng test | Priority | Trạng thái |
|---|---|---|---|---|---|---|
| TC-to-khai-gtgt01-021 | Dropdown "Chỉ tiêu tăng giảm" hiển thị đúng 3 lựa chọn: "—", "37 — Giảm", "38 — Tăng" | AC-009 | FR-007 | FE-manual | P0 | Sẵn sàng |
| TC-to-khai-gtgt01-022 | Chọn "38 — Tăng", lưu, tải lại trang — giá trị lưu trữ là `"38"`, dropdown hiển thị đúng lại | AC-010 | FR-008, BR-003 | FE-manual + BE-integration | P0 | Sẵn sàng |
| TC-to-khai-gtgt01-023 | Chọn "37 — Giảm", lưu, tải lại — giá trị `"37"` | (đối xứng AC-010) | FR-008, BR-003 | FE-manual + BE-integration | P0 | Sẵn sàng |
| TC-to-khai-gtgt01-024 | Giá trị lưu trữ cũ `"tang"` — đọc bảng kê trả về `"38"`, dropdown hiện "38 — Tăng", không lỗi/không rỗng | AC-011 | FR-009, BR-004 | BE-unit (hàm thuần cạnh `:356`, dùng ở `:526` — api-contract Mục 3.3) | P0 | Sẵn sàng |
| TC-to-khai-gtgt01-025 | Giá trị lưu trữ cũ `"giam"` — đọc bảng kê trả về `"37"` | AC-011 | FR-009, BR-004 | BE-unit | P0 | Sẵn sàng |
| TC-to-khai-gtgt01-026 | PATCH giá trị `"tang"` (mã cũ, gửi thẳng SAU khi đã đổi mã) — bị loại khỏi payload cập nhật, giá trị cũ đã lưu giữ nguyên | AC-012 | FR-010, E-003, BR-003 | BE-unit (`locQuyetDinh`) | P0 | Sẵn sàng |
| TC-to-khai-gtgt01-027 | PATCH giá trị `"giam"` — bị loại tương tự | AC-012 | FR-010, E-003 | BE-unit | P0 | Sẵn sàng |
| TC-to-khai-gtgt01-028 | PATCH giá trị rác `"xoay"` — bị loại (regression, test hiện có) | AC-012 | FR-010, E-003 | BE-unit | P0 | Sẵn sàng |
| TC-to-khai-gtgt01-029 | PATCH giá trị `"39"` (số hợp lý nhưng ngoài tập `{"","37","38"}`) — bị loại | AC-012 | FR-010, E-003 | BE-unit | P0 | Sẵn sàng |
| TC-to-khai-gtgt01-030 | PATCH đồng thời `chiTieuTangGiam: "xoay"` (invalid) + `ghiChu: "..."` (valid) trong cùng request — field hợp lệ vẫn được lưu, field invalid bị loại | AC-012 | FR-010, E-003 | BE-unit | P0 | Sẵn sàng |
| TC-to-khai-gtgt01-031 | PATCH giá trị `""` (xóa lựa chọn) — hợp lệ, lưu thành `null` trong DB | Edge case 6 | BR-003 | BE-unit (test hiện có) | P1 | Sẵn sàng |
| TC-to-khai-gtgt01-032 | Đổi "Chỉ tiêu tăng giảm" của 1 hoặc nhiều hóa đơn trong kỳ — số liệu ô nhập tay chỉ tiêu [37]/[38] trên form tờ khai KHÔNG đổi | AC-013 | BR-002 | BE-integration + FE-manual | P0 | Sẵn sàng |
| TC-to-khai-gtgt01-033 | Excel sheet "HĐ..." hiển thị mã thô "37"/"38" (không đổi thành nhãn chữ "Tăng"/"Giảm") | (Quyết định 3c, CONTEXT_SUMMARY) | — | Excel-manual | P1 | Sẵn sàng |
| TC-to-khai-gtgt01-034 | Ô "Chỉ tiêu tăng giảm" rỗng hiển thị "—" cả trên web lẫn Excel (hành vi cũ giữ nguyên) | (Quyết định 3e) | — | FE-manual + Excel-manual | P2 | Sẵn sàng |
| TC-to-khai-gtgt01-035 | Đổi từ giá trị cũ (`"tang"`, đang hiển thị "38 — Tăng") sang giá trị mới rồi lưu — dữ liệu lưu trữ chuyển hẳn sang mã mới, không còn giữ dạng chữ cũ | Edge case 5 | BR-004 | BE-integration | P1 | Sẵn sàng |

## Regression / Non-functional

| TC ID | Scenario | Liên quan | Tầng test | Priority | Trạng thái |
|---|---|---|---|---|---|
| TC-to-khai-gtgt01-036 | `quyetDinhKeKhai.test.ts` (đã sửa whitelist theo B6) — toàn bộ test cũ (payload rỗng, field lạ, field vắng mặt, ghi chú quá dài) vẫn pass sau khi đổi tập giá trị hợp lệ | Regression | BE-unit | P0 | Sẵn sàng — **file phải sửa trước, xem Mục "Test hiện có phải sửa"** |
| TC-to-khai-gtgt01-037 | Toàn bộ suite `be_maxv` (`npm test`) pass sau cả 2 task — không có test nào khác trong `to_khai/` bị vỡ do đổi `ChiTieuTangGiam` type hoặc thêm endpoint mới | Regression | BE full suite | P0 | Chờ code |
| TC-to-khai-gtgt01-038 | `be_maxv`: `npm run typecheck` + `npm run lint` pass | Regression | BE static | P0 | Chờ code |
| TC-to-khai-gtgt01-039 | `hdđt_maxv`: `npm run build` (`tsc -b && vite build`) pass sau khi sửa `ky.ts`, `OQuyetDinh.tsx`, `cotBangKe.ts`, `api/toKhai.ts`, `xuatToKhaiExcel.ts`, `exportXlsx.ts` (export `addStyledSheet`), `BangKeMotChieu.tsx`, `ToKhaiGtgt01Editor.tsx` (F1-F8 api-contract Mục 4) | Regression | FE-build | P0 | Chờ code |
| TC-to-khai-gtgt01-040 | `hdđt_maxv`: `npm run lint` pass | Regression | FE-build | P1 | Chờ code |
| TC-to-khai-gtgt01-041 | `tinhGtgt01.test.ts` / `CT_NHAP_TAY` — không có thay đổi hành vi (Task 2 không được đụng `tinhGtgt01.ts` theo Constraint mục 7) | Regression, xác nhận Constraint | BE-unit | P1 | Sẵn sàng |

## Test hiện có phải sửa (BE)

| File | Vì sao phải sửa | Việc cần làm |
|---|---|---|
| `be_maxv/src/__tests__/to_khai/quyetDinhKeKhai.test.ts` | Dòng 14-31 dùng literal `"giam"`/`"xoay"` làm giá trị test; sau Task 2 whitelist đổi thành `{"","37","38"}` nên `"giam"` không còn hợp lệ ở phía WRITE (`locQuyetDinh`) — test hiện tại `test("giữ đúng ba field hợp lệ")` dùng `chiTieuTangGiam: "giam"` sẽ FAIL | **Xác nhận theo api-contract Mục 4, B6**: đổi giá trị hợp lệ trong test sang `"37"`/`"38"`; thêm case `"tang"`/`"giam"` (mã cũ) bị lọc ở phía WRITE (đối lập rõ với phía READ, nơi `"tang"`/`"giam"` được diễn giải chứ không bị lọc); thêm test cho helper diễn giải mới (B2) |

## Test mới cần viết (BE)

| File đề xuất | Nội dung | Lệnh chạy |
|---|---|---|
| `be_maxv/src/__tests__/to_khai/quyetDinhKeKhai.test.ts` (bổ sung) | Unit test cho helper diễn giải dữ liệu cũ khi đọc (api-contract B2: hàm thuần đặt cạnh type `ChiTieuTangGiam` tại `keKhaiKy.service.ts:356`, dùng ở `:526`) — `"tang"→"38"`, `"giam"→"37"`, `null→""`, giá trị khác giữ nguyên. Hàm thuần nên test KHÔNG cần DB | `npx tsx --test src/__tests__/to_khai/quyetDinhKeKhai.test.ts` |
| `be_maxv/src/__tests__/to_khai/chiTietTheoKy.test.ts` (mới, tên đề xuất — theo B3/B4/B5 api-contract) | Test cho service/handler/route mới của Task 1: gọi verbatim `layBangKeTheoKy` (TC-004 đến TC-010, TC-042, TC-043), gắn `chiTiet` theo `id` theo lô ≤1000 (`chiaLo`), kỳ rỗng trả `200` rỗng (TC-012b), lỗi 400/401/403/429 (TC-044 đến TC-048) | Theo mẫu `keKhaiKyGocDb.test.ts` (DB thật) hoặc `toKhaiRouteLimits.test.ts` (`mock.module` + Fastify inject) |
| Bổ sung `toKhaiRouteLimits.test.ts` hoặc file route test riêng | Tenant isolation cho route mới (TC-019) — theo đúng mẫu header `x-cong-ty` đã dùng trong file này; rate limit 20/phút (TC-048) theo mẫu `POST /ke-khai: tối đa 10 lượt/phút` đã có | `npx tsx --test src/__tests__/to_khai/toKhaiRouteLimits.test.ts` |

**Không có test tự động phía FE** — `hdđt_maxv/package.json` chỉ có `dev`/`build`/`lint`/`preview`, không có Vitest/Jest nào được cài. Mọi kiểm thử FE trong Phase B là **build + kiểm tay trên browser**, không có gì tự động lặp lại được — QA khuyến nghị ghi nhận rõ trong `test-report.md` ở Phase B, KHÔNG báo "pass" nếu chưa thực sự mở browser bấm thử.

## Ghi chú spec ↔ contract (đối chiếu, KHÔNG sửa `srs/` — thuộc thẩm quyền BA)

- **FR-to-khai-gtgt01-004 / `srs/to-khai-gtgt01-spec.md` dùng từ "ghép theo khóa nghiệp vụ (mẫu số + ký hiệu + số hóa đơn + MST người bán), KHÔNG ghép theo vị trí dòng"** — mô tả cơ chế cũ dự kiến (FE tự tra `invoiceKey`/`invoiceSttMap` giữa 2 truy vấn riêng). Thiết kế đã chốt (api-contract Mục 2.6.6) lại ghép **theo vị trí `i` trong CÙNG một mảng `datas` dùng chung cho cả 2 sheet** — an toàn hơn (không còn rủi ro thứ tự lệch giữa 2 truy vấn riêng vì giờ chỉ còn 1 truy vấn), nhưng chữ "không ghép theo vị trí dòng" trong FR-004 không còn mô tả đúng cơ chế thật. AC-to-khai-gtgt01-007 (kết quả quan sát được) vẫn ĐÚNG và test được nguyên vẹn (xem TC-011) — đây là gap về WORDING mô tả cơ chế trong FR-004, không phải gap về hành vi/outcome. Đã được Architect flag một phần ở `api-contract.md` Mục 5, OQ-arch-002 (đề xuất BA cập nhật `flows.md` từ 4 lượt xuống 2 lượt); đề nghị BA khi sign-off tiện thể chỉnh luôn câu chữ FR-004 cho khớp cơ chế thật, tránh dev đọc FR-004 rồi cố cài lại `invoiceKey`/`invoiceSttMap` không cần thiết.
- **E-to-khai-gtgt01-002 / AC-to-khai-gtgt01-005** — theo api-contract Mục 2.4 bất biến #5, không phát sinh trong thiết kế đã chốt. Đề nghị BA đánh dấu N/A chính thức trong `srs/to-khai-gtgt01-spec.md` khi sign-off (đã ghi nhận ở đây tại TC-014, QA không tự sửa spec).
- **OQ-arch-001 (F1)** — đã được user chốt (phương án (a): dòng trống có nguồn từ bảng kê, xem TC-018). Đề nghị BA cập nhật `srs/to-khai-gtgt01-spec.md` Mục 11 "Edge Cases" bổ sung case này (hiện spec chưa có dòng nào cho "hóa đơn có trong bảng kê nhưng chưa tải chi tiết") — đây là gap phát hiện ở Phase A trước đó, nay đã có hướng xử lý cụ thể nhưng cần phản ánh ngược vào spec để không bị coi là "chưa có yêu cầu" khi review sau này.
