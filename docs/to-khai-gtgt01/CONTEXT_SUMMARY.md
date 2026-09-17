# BỘ NHỚ NGỮ CẢNH: TỜ KHAI 01/GTGT (`to-khai-gtgt01`)
*(Module: `to_khai` — Workspace: `maxv_v2`)*

---

## 1. Tổng quan phạm vi đợt này (2026-09-16)

Đợt này KHÔNG viết lại đặc tả toàn bộ tính năng Tờ khai 01/GTGT — xem `docs/to-khai-gtgt01/kien-truc-to-khai-gtgt01.md` cho kiến trúc tổng thể đã có (hướng dẫn đọc/sửa code cho dev). Đợt này chỉ đặc tả **2 thay đổi nhỏ** do user đề xuất, đã qua một vòng BA đối soát code (read-only, đối chiếu từng khẳng định với file:line thật) và đã được user duyệt kết quả đối soát.

1. **Xuất Excel tại tab Tờ khai — thêm 4 sheet**: "HĐ mua vào", "HĐ bán ra" (bảng kê hóa đơn theo kỳ, khớp bảng kê đang hiển thị trên màn hình) và "Chi tiết mua vào", "Chi tiết bán ra" (chi tiết từng dòng hàng hóa/dịch vụ của các hóa đơn đó) — thêm cạnh sheet "01-GTGT" (+ "PL 204-2025" nếu kỳ có phụ lục) đã có sẵn trong file Excel hiện tại.
2. **Đổi mã giá trị cột "Chỉ tiêu tăng giảm"** trên bảng kê hóa đơn: từ `"tang"`/`"giam"` sang `"38"`/`"37"` — khớp đúng số chỉ tiêu trên mẫu 01/GTGT (chỉ tiêu [37] = Điều chỉnh giảm, chỉ tiêu [38] = Điều chỉnh tăng). Đây chỉ là đổi nhãn/mã ghi chú gắn theo từng hóa đơn, KHÔNG cộng dồn vào số liệu chỉ tiêu [37]/[38] của tờ khai (hai ô đó luôn nhập tay riêng, độc lập hoàn toàn).

---

## 2. Quyết định đã chốt (2026-09-16, user quyết định trực tiếp)

| # | Câu hỏi | Quyết định |
|---|---|---|
| 1 | Nguồn dữ liệu "chi tiết" cho sheet Chi tiết mua vào/bán ra lấy theo khoảng ngày hay theo đúng tập hóa đơn bảng kê? | **Phương án A** — Backend thêm khả năng trả chi tiết hóa đơn theo kỳ tờ khai (`nam`/`kyLoai`/`kySo`/`chieu`), dùng ĐÚNG tập hóa đơn mà `layBangKeTheoKy` đang dùng cho bảng kê (đã gán kỳ qua thao tác "Kê khai" + đã qua `duocTinh()`, loại hóa đơn thay thế/hủy) — để sheet Chi tiết khớp tuyệt đối sheet HĐ mua vào/bán ra. Shape endpoint/response cụ thể do Architect chốt; spec chỉ ràng buộc yêu cầu nghiệp vụ và điều kiện "cùng tập hóa đơn với bảng kê". |
| 2 | "37"/"38" có cộng vào số chỉ tiêu [37]/[38] của tờ khai không? | **Không.** Chỉ là nhãn ghi chú per-hóa đơn trên bảng kê. Chỉ tiêu [37]/[38] của tờ khai (`tokhai_gtgt01.ghi_de`, nằm trong `CT_NHAP_TAY`) luôn nhập tay, độc lập hoàn toàn với cột này — xem BR-to-khai-gtgt01-002. |
| 3a | Tên 4 sheet mới | Tự chốt: "HĐ mua vào", "HĐ bán ra", "Chi tiết mua vào", "Chi tiết bán ra". |
| 3b | Kỳ/chiều không có hóa đơn | Sheet vẫn được tạo, đủ tiêu đề cột, phần dữ liệu để trống — không bỏ sheet. |
| 3c | Cách Excel hiển thị "Chỉ tiêu tăng giảm" | Hiển thị mã thô "37"/"38" (đúng hành vi cột dữ liệu sẵn có, không đổi thành nhãn chữ "Tăng"/"Giảm"). |
| 3d | Dữ liệu cũ `"tang"`/`"giam"` đã lưu trước khi đổi mã | Map một chiều khi ĐỌC tại BE: `tang` → `"38"`, `giam` → `"37"`. KHÔNG chạy script UPDATE hàng loạt trên DB. |
| 3e | Ô rỗng "—" | Giữ nguyên, không đổi. |

---

## 3. File & route liên quan (đã xác minh bằng code khi đối soát — read-only)

### Task 1 — Xuất Excel 4 sheet

| File | Vai trò |
|---|---|
| `hdđt_maxv/src/features/to_khai/xuatToKhaiExcel.ts:104-173` | `xuatToKhaiGtgt01()` — nơi thêm 4 sheet mới, đổi chữ ký sang async chờ dữ liệu |
| `hdđt_maxv/src/features/hddt/exportXlsx.ts:89-211` | `addStyledSheet` — hàm dựng sheet dùng chung, hiện **private, chưa export**; cần export để tái dùng thay vì viết lại logic dựng sheet |
| `hdđt_maxv/src/features/hddt/exportXlsx.ts:249-268` | `buildSummaryWorkbookBuffer` — KHÔNG tái dùng trực tiếp được (tự tạo `Workbook` riêng bên trong, trả buffer, không nhận workbook injected từ ngoài) |
| `hdđt_maxv/src/features/to_khai/templates/cotBangKe.ts:55-254` | `overviewToKhai(direction)` — 26 cột cho sheet "HĐ mua vào"/"HĐ bán ra", khớp bảng kê trên màn hình |
| `hdđt_maxv/src/features/to_khai/api/toKhai.ts:56-58` | `getBangKe(ky, chieu)` — nguồn dữ liệu sheet HĐ, gọi `GET /to-khai/hoa-don` |
| `be_maxv/src/services/client/to_khai/application/keKhaiKy.service.ts:502-531` | `layBangKeTheoKy` — logic lọc hóa đơn theo kỳ (đã gán + `duocTinh`) mà API chi tiết mới PHẢI dùng lại nguyên vẹn |
| `be_maxv/src/services/client/to_khai/application/keKhaiKy.service.ts:453-476` | `khoangDocBangKe` — cách tính khoảng ngày đọc bảng kê hiện tại, tham khảo khi Architect thiết kế API chi tiết mới |
| `hdđt_maxv/src/features/hddt/api/invoiceDetail.ts:20-29` | `getSavedDetails` — API chi tiết hiện có (lọc theo `tuNgay`/`denNgay`, KHÔNG theo kỳ) — không dùng trực tiếp cho Task 1 vì phạm vi hóa đơn có thể lệch bảng kê |
| `be_maxv/src/services/client/hddt/gdt.service.ts:1201-1228` | `getSavedInvoiceDetails` — chỉ `select: { detail: true }`, KHÔNG trả `id`/khóa định danh hóa đơn |
| `be_maxv/src/controllers/client/hddt/gdt.controller.ts:66` | `KHOANG_NGAY_TOI_DA = 366` — trần khoảng ngày hiện áp cho `saved-details`, tham khảo khi thiết kế endpoint mới |
| `hdđt_maxv/src/features/hddt/detailRow.ts:225+` | `toDetailRows` — chuyển payload GDT thô thành dòng hiển thị (bung theo dòng hàng hóa `hdhhdvu`), cần thêm `stt`/`replacedBy`/`danhMucNcc` |
| `hdđt_maxv/src/features/hddt/invoiceFileName.ts:45-69` | `invoiceKey`/`invoiceSttMap` — cách ghép STT hóa đơn giữa 2 bảng theo khóa nghiệp vụ, KHÔNG theo vị trí dòng |
| `hdđt_maxv/src/features/hddt/components/InvoiceListTabs.tsx:1255-1256` | Tab "Tổng quát"/"Chi tiết hoá đơn" — nguồn xác nhận "chi tiết" trong yêu cầu đúng là tab này |

### Task 2 — Đổi mã "Chỉ tiêu tăng giảm"

| File | Vai trò |
|---|---|
| `hdđt_maxv/src/features/to_khai/ky.ts:7` | `type ChiTieuTangGiam = "" \| "tang" \| "giam"` (định nghĩa phía FE) |
| `hdđt_maxv/src/features/to_khai/components/OQuyetDinh.tsx:22-26` | `CHI_TIEU_OPTIONS` — options select hiển thị cho kế toán |
| `hdđt_maxv/src/features/to_khai/templates/cotBangKe.ts:113-124` | Cột "Chỉ tiêu tăng giảm" trong bảng kê — comment cũ nhắc "tang"/"giam", cần cập nhật theo |
| `be_maxv/src/services/client/to_khai/application/keKhaiKy.service.ts:356` | `type ChiTieuTangGiam` — định nghĩa RIÊNG ở BE, không import từ FE, phải sửa cả hai nơi |
| `be_maxv/src/services/client/to_khai/application/keKhaiKy.service.ts:381` | Whitelist giá trị hợp lệ khi ghi (`locQuyetDinh`) |
| `be_maxv/src/services/client/to_khai/application/keKhaiKy.service.ts:526` | Nơi ĐỌC giá trị từ DB trả cho FE (`layBangKeTheoKy`) — chỗ cần thêm map một chiều `tang→"38"`, `giam→"37"` |
| `be_maxv/prisma/tenant/schema.prisma:757` | `chi_tieu_tang_giam String? @db.VarChar(32)` — không CHECK constraint, không cần migration |
| `hdđt_maxv/src/features/_shared/to_khai/gtgt01Layout.ts:108-109` | `ct37 = "Điều chỉnh giảm"`, `ct38 = "Điều chỉnh tăng"` — nguồn xác nhận chiều map đúng |
| `be_maxv/src/services/client/to_khai/domain/tinhGtgt01.ts:22-41` | `CT_NHAP_TAY` — xác nhận ct37/ct38 là ô nhập tay của tờ khai, KHÔNG liên quan tới `chiTieuTangGiam` per-hóa đơn |
| `be_maxv/src/__tests__/to_khai/quyetDinhKeKhai.test.ts:14-31` | Test dùng literal `"tang"`/`"giam"`/`"xoay"` — phải cập nhật cùng lúc đổi whitelist, nếu không test sẽ fail |

---

## 4. Vì sao không có `states.md` / `erd.md`

- **Không tạo `srs/to-khai-gtgt01-states.md`**: không có entity nào đổi vòng đời trạng thái trong 2 thay đổi này. Cột `chi_tieu_tang_giam` chỉ đổi TẬP GIÁ TRỊ hợp lệ của một field ghi chú per-hóa đơn, không phải state machine (không có transition bị cấm, không có trigger chuyển trạng thái).
- **Không tạo `srs/to-khai-gtgt01-erd.md`**: không có entity/bảng/cột mới. `chi_tieu_tang_giam` là cột đã tồn tại sẵn trên `tokhai_ky_hoa_don`, chỉ đổi giá trị hợp lệ; API mới của Task 1 là một endpoint đọc (GET), không đổi data model nào.

---

## 5. Phân luồng agent

- **Task 1**: Architect chốt contract API chi tiết theo kỳ (Phase A, song song Tester-QA) → Backend Engineer triển khai endpoint mới, tái dùng đúng logic lọc của `layBangKeTheoKy` → Frontend Engineer export `addStyledSheet`, dựng 4 sheet vào workbook hiện có, đổi nút "Xuất Excel" sang async/loading.
- **Task 2**: Backend Engineer trước (đổi whitelist + type + thêm map đọc dữ liệu cũ tại `layBangKeTheoKy` + sửa test `quyetDinhKeKhai.test.ts`) → Frontend Engineer (đổi options + type FE). Không cần Architect tham gia sâu — không đổi contract HTTP, không đổi DB schema.
- Cả 2 task đi qua Tester-QA Phase A (song song Architect, đối chiếu chéo với Acceptance Criteria ở `srs/to-khai-gtgt01-spec.md`) rồi Phase B sau khi code xong, theo đúng luồng chuẩn ở `.claude/CLAUDE.md`.

---

## 6. Thiết kế kỹ thuật đã chốt (Architect, 2026-09-16)

Chi tiết: `architecture/api-contract.md`, quyết định: `architecture/adr/ADR-001-chi-tiet-hoa-don-theo-ky.md`.

| Route | Thay đổi |
|---|---|
| `GET /api/v1/to-khai/hoa-don/chi-tiet?nam&kyLoai&kySo&chieu` | MỚI. Trả `{ total, datas, thayThe }` như `GET /hoa-don`, mỗi dòng thêm `chiTiet: object \| null` (payload GDT gốc). BE gọi nguyên `layBangKeTheoKy` rồi gắn `detail` theo `id`. Guard `tokhai`, rate limit 20 lượt/phút/người dùng, không trần khoảng ngày. FE xuất Excel gọi 2 lượt (mỗi chiều 1), dựng cả sheet "HĐ..." và "Chi tiết..." từ cùng response |
| `GET /api/v1/to-khai/hoa-don` | Không đổi hình dạng; `chiTieuTangGiam` trả `""`/`"37"`/`"38"` (đọc `tang`→`38`, `giam`→`37`) |
| `PATCH /api/v1/to-khai/hoa-don/:chieu/:id` | Không đổi hình dạng; whitelist `chiTieuTangGiam` = `""`/`"37"`/`"38"`, giá trị khác bị bỏ, vẫn `200 { ok: true }` |

- **Không có `architecture/data-model.md`**: không thêm/đổi bảng, cột, index hay constraint; `chi_tieu_tang_giam VarChar(32)` không có CHECK nên nhận mã mới không cần migration.
- **Chờ chốt**: OQ-arch-001 (sheet Chi tiết thể hiện hóa đơn chưa tải chi tiết thế nào), OQ-arch-002 (BA cập nhật `flows.md` 4 lượt → 2 lượt, AC-005 không phát sinh) — xem Mục 5 của contract.

---

## 7. Mục tiến độ

| Ngày | Người | Việc đã làm |
|---|---|---|
| 2026-09-16 | @phamvinh203 | BA đối soát + viết spec |
| 2026-09-16 | architect | Chốt contract: endpoint `GET /to-khai/hoa-don/chi-tiet`, tập giá trị `chiTieuTangGiam` 37/38, ADR-001 |
| 2026-09-16 | @phamvinh203 | BA: sign-off |
| 2026-09-16 | backend-engineer | Backend xong: endpoint `GET /to-khai/hoa-don/chi-tiet` + đổi mã "Chỉ tiêu tăng giảm" `37/38`; typecheck/lint/test pass (1223 test, 1206 pass, 4 fail pre-existing không liên quan); xem `work-log.md` + `architecture/dev-notes.md` Mục Backend |
| 2026-09-16 | frontend-engineer | Frontend xong (Phase 3): 4 sheet Excel mới ("HĐ mua vào/bán ra", "Chi tiết mua vào/bán ra") trong `xuatToKhaiExcel.ts` + đổi FE sang mã "37"/"38" (`ky.ts`, `OQuyetDinh.tsx`); nút "Xuất Excel" có trạng thái đang xử lý; `npm run lint`/`npm run build` (`hdđt_maxv`) đều pass, 0 lỗi. Chưa kiểm tay trên trình duyệt. Xem `work-log.md` + `architecture/dev-notes.md` Mục Frontend |
| 2026-09-16 | tester-qa | **Vòng Frontend Phase B**: `lint`/`build` pass (0 lỗi). Script v1 dựng sheet qua các hàm production trực tiếp — 20/20 assertion pass NHƯNG assertion thứ tự sheet tự dựng lại trình tự nên không bắt được lỗi thứ tự thật; đã ghi ISSUE-004 (sheet "Chi tiết..." thiếu cột "STT" riêng, ban đầu đánh giá Low). |
| 2026-09-16 | code-reviewer | Phát hiện RVW-T09 🔴 (thứ tự sheet sai FR-to-khai-gtgt01-001, "Chi tiết mua vào" đứng trước "HĐ bán ra") + nâng ISSUE-004 thành RVW-T12 🔴 (thiếu cột STT vi phạm FR-004/AC-007) + RVW-T10/T11 🟢. Xem `review-findings.md`. |
| 2026-09-16 | frontend-engineer | Fix RVW-T09/T10/T11 (tách `themSheetHd`/`themSheetChiTiet`, gọi đúng thứ tự 2×HĐ rồi 2×Chi tiết; `BangKeChiTietResult` dùng `Omit`/mở rộng thay vì chép tay; gộp import). RVW-T12 (thêm cột STT vào sheet Chi tiết) đang sửa. |
| 2026-09-16 | tester-qa | **Chạy lại sau fix RVW-T09/T10/T11**: `lint`/`build` pass lại (0 lỗi). Viết script v2 (`excelSheetCheckV2.ts`) gọi THẲNG hàm export thật `xuatToKhaiGtgt01()` (chỉ mock `lib/http.ts` + `lib/downloadFile.ts` qua Node loader, không tự dựng lại trình tự) — 11/11 assertion pass, xác nhận đúng thứ tự 6 sheet + nhánh lỗi E-001 qua `Promise.all` thật. TC-to-khai-gtgt01-011/011b giữ trạng thái "Chờ fix RVW-T12 — chạy lại sau", KHÔNG PASS. Xem `qa/test-report.md` + `qa/issues-and-bugs.md`. |
| 2026-09-16 | frontend-engineer | Fix RVW-T12 (thêm `COT_STT_CHI_TIET` ở đầu sheet "Chi tiết..."). Đồng thời fix BUG-001 (user báo): `getBangKe`/`getBangKeChiTiet` gọi thêm `mapInvoiceDatas` (export mới từ `hddt/api/gdt.ts`) để gộp `mstDoiTac`/`tenDoiTac` từ `nbmst/nbten`/`nmmst/nmten` — trước đó cột MST/Tên đối tác trống trên cả bảng kê web lẫn sheet "HĐ...". |
| 2026-09-16 | tester-qa | **Chạy lại sau fix RVW-T12 + BUG-001**: `lint`/`build` pass lại lần 3 (0 lỗi). Mở rộng script v2 thêm assertion cột "STT" sheet Chi tiết + cột MST/Tên đối tác (TC mới TC-049/TC-050, thêm vào `test-cases.md`+`test-matrix.md`) + tách lượt "chiều rỗng" riêng để regression — **25/25 assertion pass**. TC-to-khai-gtgt01-011/011b và TC-049/050: ✅ PASS. Cập nhật checklist kiểm tay lên 16 bước (thêm bước kiểm cột đối tác web+Excel, sửa bước STT dùng cột mới). Xem `qa/test-report.md` + `qa/issues-and-bugs.md` (BUG-001, ISSUE-004 FIXED). |
| 2026-09-16 | user | Kiểm tay checklist 16 bước trên trình duyệt thật: **16/16 Đạt** — vòng Frontend PASS. Lưu ý phát hành: BE + FE phải deploy cùng lượt (RVW-T05). |

---

Status: Ready for Implementation
