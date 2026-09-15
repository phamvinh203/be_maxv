---
type: srs
feature: to_khai_thue
status: approved
updated: 2026-09-14
links:
  - docs/hrm/to_khai_thue/srs-to-khai-thue.md
  - docs/hrm/to_khai_thue/api-contract-to-khai-thue.md
  - docs/hrm/to_khai_thue/data-model-to-khai-thue.md
  - docs/hrm/architecture/adr/ADR-012-bieu-thue-tncn-theo-moc-hieu-luc.md
  - docs/hrm/architecture/adr/ADR-013-bat-bien-so-thue-snapshot-hai-tang.md
---

# Đối soát mã nháp `to_khai_thue` với đặc tả đã ký

> **Mục đích:** trả lời đúng một câu hỏi — bộ mã nháp có sẵn nên **SỬA** hay **VIẾT LẠI**, và theo thứ tự nào. Đây là đầu vào cho phase `backend-engineer`, không phải đặc tả mới.
>
> **Ngày:** 2026-09-14, sau BA Final Sign-off cùng ngày và sau khi đóng 2 lỗi chặn BUG-dltl-003/004.
>
> **Đối tượng đối soát:** 8 file backend (~2.000 dòng, chưa commit) + 11 file frontend (~4.500 dòng, chưa commit), đều viết **TRƯỚC** khi có SRS.
>
> **Nguồn sự thật:** `srs-to-khai-thue.md` · `api-contract-to-khai-thue.md` · `data-model-to-khai-thue.md` · ADR-012 · ADR-013.

---

## 1. Kết luận

**Backend: viết lại phần lõi.** Mã nháp được viết cho một **mô hình nghiệp vụ khác**: không có danh mục thu nhập với 4 nhóm xử lý thuế, không có snapshot kết quả, không có chính sách thuế theo mốc hiệu lực, không có snapshot tháng, vòng đời tờ khai 2 trạng thái thay vì 4. **ADR-012 và ADR-013 đều ở mức 0%.** Bốn khái niệm thiếu đều nằm ở trung tâm chứ không ở rìa — vá từng chỗ sẽ để lại mô hình dữ liệu cũ bên dưới.

| Nhóm | File | Quyết định |
|---|---|---|
| Xương sống nghiệp vụ | `otherIncome.service.ts` (450) · `taxCalculation.service.ts` (279) · `toKhaiTncn05.service.ts` (680) | **VIẾT LẠI** |
| Biên vào/ra | `route.ts` (30) · `controller.ts` (176) · `validator.ts` (131) | **VIẾT LẠI**, giữ nguyên khuôn đã đúng (`dbCoQuyenLuongPayroll` đầu controller, `validateBody/Query/Params`, `sendOk/sendCreated`) |
| Kiểu dữ liệu | `types.ts` (122) | **SỬA** — `DongBangTinhThue` đã phủ đủ 21 trường của SRS Mục 4.3 |
| Ngoài phạm vi | `xuatXmlTncn05.ts` (152) | **XÓA** — BA đã bỏ XML tại Final Sign-off |

Tái dùng được ước tính **15–20%** (~300/2.000 dòng).

**Frontend: giữ khung, viết lại phần tính toán và gọi API.** Mức tái dùng ~55–60% khung giao diện: bảng tính thuế ~70%, thu nhập ngoài lương ~55%, tờ khai 05 ~50%. Vai trò `frontend-engineer` đang TẠM NGỪNG nên phần này là tài liệu chuẩn bị.

---

## 2. Phải tái dùng, đừng viết lại từ đầu

1. `toKhaiTncn05.service.ts:51-99` — `kiemTraCanDoiToKhai05`, **9 luật cân đối**. `data-model` Mục 8 ghi rõ "giữ nguyên 9 luật đã có". Chép sang nguyên vẹn.
2. `toKhaiTncn05.service.ts:170-225` — công thức `ct16`/`ct17`/`ct19`–`ct31`, khớp đúng bảng ánh xạ `data-model` Mục 8. Chỉ đổi **nguồn** (đọc `hrm_tax_calculation_lines` thay vì tính trực tiếp) và **khóa gom** (`recipientKey`); giữ nguyên phép tính.
3. `taxCalculation.service.ts:94-110` — bộ lọc người phụ thuộc theo `dk_tu_thang/nam`–`dk_den_thang/nam` (A-tkt-05).
4. `types.ts:35-62` — `DongBangTinhThue`, `CtTagTncn05`, `ChiTieuTncn05Map`, `GhiDeMap`.
5. `tncn05Layout.ts` (frontend) — bố cục 17 chỉ tiêu `ct16`–`ct32` kèm quan hệ tổng–thành phần. **13 mã sửa-được trong đó trùng khớp chính xác** danh sách `CT_GOC_SUA_DUOC` mà BR-tkt-018 chốt; đặc tả còn ghi rõ là lấy theo đúng bản nháp này. Chỉ cần đổi từ hằng số cục bộ sang đọc `ctGocSuaDuoc` từ API.

---

## 3. Backend — lỗi sai số thuế (nhóm nghiêm trọng nhất)

| # | Vị trí | Mã nháp đang làm | Đặc tả đòi |
|---|---|---|---|
| L-01 | `otherIncome.service.ts:35-43` | Khấu trừ 10% **từ đồng đầu tiên** — không ngưỡng nào | BR-tkt-008: chỉ khi **≥ 5.000.000đ/lần**; dưới ngưỡng `taxWithheld = 0` trừ khi `forceWithholding` |
| L-02 | `otherIncome.service.ts:9-61` | Chỉ 3 nhánh `PROGRESSIVE`/`FLAT_10`/`FLAT_20`; **không có** nhánh miễn toàn phần và miễn có trần | BR-tkt-007: 4 nhóm `EXEMPT_FULL` / `EXEMPT_CAPPED` (trần ăn ca 1.200.000đ/tháng) / `TAXABLE_FULL` / `WITHHOLDING_FLAT` |
| L-03 | `taxCalculation.service.ts:126` | `thu_nhap_ngoai = Σ grossAmount` của **mọi** bản ghi | `data-model` Mục 5.1: `Σ taxableAmount`. Hiện cộng nhầm cả khoản miễn 100%, cả phần trong trần, cả khoản đã khấu trừ riêng ⇒ **đánh thuế hai lần** |
| L-04 | `taxCalculation.service.ts:159-160` | Thử việc/thời vụ: **tính lại** `thuNhapChiuThue × 0.1` | BR-tkt-011 + NFR-tkt-005: **lấy thẳng** `personalIncomeTax` của engine lương. Hiện bỏ qua cả ngưỡng lẫn công tắc `tinh_tncn` ⇒ hợp đồng khai "không tính TNCN" vẫn bị đánh thuế ở màn này |
| L-05 | `taxCalculation.service.ts:112-114` · `otherIncome.service.ts:191-192`, `:385-386` | Hợp đồng **`khoan`** rơi vào nhánh khấu trừ 10% | BR-tkt-011: `khoan` đi nhánh lũy tiến. Helper chuẩn đã có: `laHopDongKhauTruTaiNguon()` |
| L-06 | `taxCalculation.service.ts:139`, `:147-150` | Nhánh lũy tiến: `thue_toan_phan` luôn `0` | `data-model` Mục 5.2 + EC-tkt-06: phải cộng `Σ taxDeducted` nhóm `WITHHOLDING_FLAT` của chính người đó ⇒ thuế hoa hồng kiêm nhiệm đang **biến mất** khỏi bảng và khỏi `ct29` |
| L-07 | `otherIncome.service.ts:169-196` | Suy cách tính thuế từ `loai_hd` của hợp đồng | A-tkt-11 + BR-tkt-007: phân loại dựa **hoàn toàn vào danh mục kế toán chọn** |
| L-08 | `taxCalculation.service.ts:20-24` | Đọc `GeneralSetting` singleton | ADR-012: đọc `hrm_tax_policies` theo `period.startDate`, ghim `taxPolicyId` vào dòng chốt, thiếu chính sách ⇒ 500 `E-tkt-015` |

## 4. Backend — thiếu hẳn khái niệm đặc tả đòi

| # | Thiếu gì | Hệ quả cụ thể |
|---|---|---|
| L-11 | Danh mục thu nhập (`otherIncomeCategoryId`) — đang là chuỗi tự do `incomeType` | Đây đúng là **PA1** mà brainstorm đã loại để chọn PA2 (danh mục cấu hình được, sửa khi luật đổi không cần deploy) |
| L-12 | Snapshot kết quả cấp bản ghi: `taxTreatmentGroup` + `exemptAmount` + `taxableAmount` (ADR-013 Mục 1) | Không có 3 cột này thì **sửa danh mục làm đổi ngược số thuế của quý đã nộp** |
| L-13 | `hrm_tax_calculation_lines` + khóa `TAX_SHEET` (ADR-013 Mục 2+3) | Không có khái niệm chốt tháng; FR-tkt-011/012 không thực hiện được |
| L-14 | `recipientKey` gom cá nhân vãng lai | Một người có 2 khoản (một khai MST, một không) thành **2 dòng** ⇒ chỉ tiêu `[16]` đếm 2 lao động trên tờ khai nộp cơ quan thuế |
| L-15 | Chống trùng (unique index + bắt `P2002` ⇒ 409 `E-tkt-005`) | **Double-click tạo 2 bản ghi và nhân đôi thuế** |
| L-16 | Guard ghi theo khóa `TAX_SHEET`/`OTHER_INCOME` | Hiện dùng `assertPayrollPeriodWritable` ⇒ **chặn nhầm luồng chuẩn**: hợp đồng bắt kỳ lương phải `LOCKED` mới chốt được Bảng tính thuế (E-tkt-008), nhưng vừa `LOCKED` là không nhập được thu nhập ngoài lương nữa ⇒ AC-tkt-018 không đi hết được |
| L-17 | Kiểm đủ-3-tháng-đã-chốt | Tờ khai tạo được bất kể tháng nào chưa chốt, trái BR-tkt-014 |
| L-18 | Đọc snapshot thay vì tính trực tiếp | Tờ khai **đổi số mỗi lần mở** nếu dữ liệu lương đổi — phá bất biến ADR-013 |
| L-19 | Chặn ghi đè chỉ tiêu tổng hợp | Cho ghi đè cả 17 mã; `ct18/ct21/ct26/ct29` phải LUÔN suy lại từ chỉ tiêu con (400 `E-tkt-012`) |
| L-20 | Vòng đời 4 trạng thái | Đang `nhap`→`chot`→**mở khóa được**; `moKhoaToKhai05()` đi ngược BR-tkt-015 ("đã xuất là vĩnh viễn không lùi") và phải bị xóa |
| L-21 | Chỉ kỳ quý | Đang hỗ trợ cả `thang` lẫn `quy`; validator cho `kySo` 1..12 |
| L-23 | Thông tin người nộp thuế từ `maxv2_sys.don_vi` | Chỉ tiêu [01]–[15] của mẫu; nháp chỉ đọc nó trong handler XML sắp xóa |

## 5. Backend — hợp đồng API

- **Phủ đúng đường dẫn và ý nghĩa: 7/22.** Nhưng **không endpoint nào** đạt hợp đồng về payload/DTO/status/mã lỗi.
- **Sai đường dẫn: 2** (`/ghi-de` → `/overrides`).
- **Thiếu hoàn toàn: 13** — 5 endpoint danh mục · `preview` · `lock` · `unlock` · `periods` · `export` · `detail-sheet` · `mark-submitted` · `tax-policies`.
- **Route thừa phải xóa: 6** — `batch-apply`, `delete-all`, `delete-employee` (xóa hàng loạt chứng từ thuế, không FR nào phủ), `chot`, `mo-khoa` (đi ngược BR-tkt-015), `export-xml`.
- **Mã lỗi: 0/21.** Lỗi hiện chỉ có `message` tiếng Việt, không có trường `code`. Điều kiện nghiệm thu của QA là grep được 21 mã `E-tkt-*` trong phản hồi thật. Khuôn có sẵn để noi theo: `PayrollError` + `PAYROLL_ERROR_CODES` của `du_lieu_tinh_luong`.
- **Tiền trả về dạng chuỗi** (`Decimal` serialize thành `"6000000.00"`) — vi phạm hợp đồng Mục 0.3 "mọi trường tiền là `number`".
- 🔴 **Lỗ hổng quyền (đã xác minh trực tiếp):** `controller.ts:141-143` — `exportXmlToKhai05` gọi `resolveTenantInfo` + `getTenantDb` thẳng, **không** qua `dbCoQuyenLuongPayroll` như 8 handler còn lại (`:32`–`:84`). Bất kỳ ai có module `hrm` đều tải được toàn bộ số liệu thuế của công ty. Endpoint này sẽ bị xóa, nhưng **mẫu code này tuyệt đối không được bê sang** endpoint xuất Excel/PDF mới.
- **Không có `$transaction` nào** trong toàn bộ mã nháp, trái NFR-tkt-002 (chốt/mở lại/xuất đều đụng nhiều bảng). Riêng kết xuất Excel/PDF phải nằm **ngoài** transaction.

## 6. Backend — về số liệu pháp lý

Điểm bất ngờ: **8 file nháp không chứa hằng số 2.000.000, 730.000, 11.000.000, 4.400.000 hay biểu 7 bậc nào.** Vấn đề thật tệ hơn "còn sót số cũ" — là **không có ngưỡng nào cả** (L-01). Hai chỗ đã sửa trong đợt BUG-dltl-003 (`taxCalculation.service.ts:23-24` fallback 15,5tr/6,2tr và `:149` truyền biểu thuế) nay đúng luật, nhưng vẫn phải thay bằng `resolveTaxPolicy` khi cài ADR-012.

> ⚠️ **Rủi ro còn lại là DỮ LIỆU, không phải mã.** Tenant chưa chạy `scripts/hrm/chuan-hoa-bieu-thue.ts` thì cột `taxBrackets` vẫn là biểu 7 bậc cũ ⇒ mã "trông đúng" nhưng ra số của luật cũ, và `AC-tkt-017` sẽ fail với 700.000 thay vì 475.000. Người đọc rất dễ đi sửa nhầm đoạn code đang đúng (cảnh báo P-01).

---

## 7. Frontend — 14 vị trí hiển thị khung pháp lý cũ

Nguy hiểm nhất trong nhóm này: giao diện đang trình cho kế toán **toàn bộ khung pháp lý cũ như thể đang có hiệu lực**, kèm trích dẫn văn bản đã bị thay thế. Đây là rủi ro pháp lý, không chỉ lỗi hiển thị.

| Vị trí | Sai | Đúng |
|---|---|---|
| `ThuNhapNgoaiLuongDialog.tsx:499`, `:518`, `:520` | ngưỡng khấu trừ **2.000.000đ/lần** (cả nhãn lẫn điều kiện chặn nút) | **5.000.000đ/lần**, và nên do máy chủ quyết |
| `ThuNhapNgoaiLuongPanel.tsx:1021`, `:1023` | "biểu lũy tiến **7 bậc** theo Điều 25 **TT 111/2013**"; "từ **2.000.000đ/lần**" | 5 bậc, **TT 87/2026/TT-BTC**; từ 5.000.000đ/lần |
| `BangTinhThuePanel.tsx:792-799` | **mảng 7 bậc hardcode dùng để TÍNH** | đọc từ `bieuThueApDung.taxBrackets` của API |
| `BangTinhThuePanel.tsx:886-898` | **liệt kê 7 bậc lần thứ hai** trong văn bản hướng dẫn, kèm 6 hằng số giảm trừ nhanh (0.25tr · 0.75tr · 1.65tr · 3.25tr · 5.85tr · 9.85tr) | 6 hằng số này **không còn tồn tại** ở biểu 5 bậc |
| `BangTinhThuePanel.tsx:873`, `:875` | ăn trưa **730k**; giảm trừ **11tr / 4,4tr** | **1,2tr**; **15,5tr / 6,2tr** |
| `BangTinhThuePanel.tsx:773`, `:879`, `:883` | "7 bậc (Điều 22 Luật Thuế TNCN)" ×3 chỗ | 5 bậc, Luật 109/2025/QH15 |
| `tabs.ts:42` | "**TT 80/2021**, kết xuất **XML** qua eTax" | TT 89/2026; **bỏ XML** |

> **Bẫy:** biểu 7 bậc xuất hiện **hai lần** trong cùng `BangTinhThuePanel.tsx` — một lần làm dữ liệu tính toán, một lần làm văn bản hướng dẫn. Sửa một chỗ quên chỗ kia là rất dễ.

## 8. Frontend — lệch nghiệp vụ

1. 🔴 **FE tự tính thuế ở hai chỗ, và số tự tính được gửi lên làm dữ liệu ghi** (`ThuNhapNgoaiLuongDialog.tsx:174-215` → `:256-257`). Tức số thuế lưu vào CSDL **do trình duyệt quyết định** — vi phạm NFR-tkt-004. Chỗ thứ hai (`BangTinhThuePanel.tsx:800-818`) bóc tách thuế từng bậc bằng biểu đã hết hiệu lực, rồi đặt cạnh dòng tổng lấy từ máy chủ ⇒ hai số **không khớp nhau** mà người dùng không biết tin số nào.
2. 🔴 **Xuất tờ khai chạy bằng `exceljs` trong trình duyệt** (`ToKhaiTncn05Panel.tsx:115-163`), bỏ mất chuyển trạng thái không đảo ngược `READY_TO_EXPORT → EXPORTED`, không khóa 3 tháng, không lưu vết ai xuất, và file phát cho kế toán **không phải** bộ số đã chốt.
3. **Nhầm chủ thể chốt/mở**: FE gắn "chốt"/"mở khóa" vào **tờ khai**; theo BR-tkt-013/015 đó là vòng đời của **Bảng tính thuế tháng**. Hai nút đang nằm sai màn hình.
4. **Danh mục cố định** `CAC_LOAI_THU_NHAP` 6 chuỗi hardcode — chọn sai phương án ngay từ gốc, kéo theo **toàn bộ nhánh miễn thuế có trần hiện không có đường nào nhập vào hệ thống**.
5. `manualCt24/25/32` là `useState` cục bộ — mất khi tải lại trang, không lưu vết, không có lý do. Phải chuyển sang `PUT /overrides`.

**Phủ endpoint:** 7/22; 15 endpoint mới FE chưa gọi tới. Ngoài ra `types/toKhaiThue.ts` dùng `snake_case` trong khi hợp đồng dùng `camelCase`, và `ct` không nullable trong khi hợp đồng trả `null` khi `CHUA_SAN_SANG` ⇒ **FE hiện sẽ nổ khi đọc `ct.ct16` của kỳ chưa sẵn sàng**.

---

## 9. Đính chính đối với báo cáo tự động

Hai khẳng định của agent đối soát đã được kiểm lại trực tiếp trên mã nguồn:

| Khẳng định | Kết luận |
|---|---|
| "Engine lương vẫn miễn thuế OT một phần ⇒ cần task riêng" (S-05) | ❌ **SAI, đã lỗi thời.** Việc này đã đóng cùng ngày bởi BUG-dltl-004: `payrollCalculation.service.ts:461-472` nay `otTaxExemptAmount += tienOtR` (miễn 100%). **Không cần task riêng.** Agent nhiều khả năng suy từ `srs-to-khai-thue.md` Mục 14 điểm 5 — đoạn đó viết trước khi sửa và nay đã lỗi thời, cần cập nhật |
| "`controller.ts:141-143` bỏ qua guard quyền lương" (L-25) | ✅ **ĐÚNG, đã xác minh.** 8 handler khác đều dùng `dbCoQuyenLuongPayroll`, riêng handler này không |

---

## 10. Thứ tự việc cho phase `backend-engineer`

Bám ràng buộc phụ thuộc thật, không theo số thứ tự endpoint.

| Bước | Việc | Chặn bước sau vì |
|:--:|---|---|
| **0** | **M-1 + M-2** của lộ trình di trú (`data-model` Mục 6): 4 enum · 3 bảng mới · `TAX_SHEET` · 5 cột mới cho `hrm_other_income_records` · 2 unique index raw SQL · seed 2 dòng `TaxPolicy` + 12 danh mục. **Đồng thời chạy `scripts/hrm/chuan-hoa-bieu-thue.ts` trên mọi tenant** | Không có bảng thì không endpoint nào code được; chưa chuẩn hóa biểu thuế thì mọi test số đều fail vì dữ liệu |
| **1** | `resolveTaxPolicy(db, period.startDate)` + `E-tkt-015` + `GET /tax-policies`. Cài **ADR-012** | Mọi phép tính thuế phụ thuộc |
| **2** | Hạ tầng lỗi mang `code` cho đủ 21 mã `E-tkt-*`, gồm cả lỗi Zod | Làm sau thì phải sờ lại từng service; QA không nghiệm thu được endpoint nào |
| **3** | Danh mục thu nhập: 5 endpoint + seed lười + `usageCount` + chặn xóa `E-tkt-002` | Bản ghi thu nhập tham chiếu danh mục |
| **4** | Thu nhập ngoài lương viết lại: engine 4 nhóm → `preview` → CRUD. Snapshot cấp bản ghi (**ADR-013 tầng 1**); `P2002` ⇒ 409; guard theo khóa ⇒ 403 `E-tkt-007` | Bảng tính thuế đọc `taxableAmount`/`taxDeducted` của bước này |
| **5** | Bảng tính thuế: `GET` hai nguồn + `lock` + `unlock`, mỗi cái một transaction, ghim `taxPolicyId` + `engineVersion`, gom theo `recipientKey`. Cài **ADR-013 tầng 2** | Tờ khai quý đọc `hrm_tax_calculation_lines` |
| **6** | Tờ khai quý: `GET` 4 trạng thái + `cacThang` + thông tin người nộp thuế · `periods` · `overrides` · `export` Excel+PDF ngoài transaction · `detail-sheet` · `mark-submitted` | — |
| **7** | Dọn: xóa 6 route thừa, xóa `xuatXmlTncn05.ts` + handler, gắn `assertAdminOrOwner` cho `unlock`/`export`/`mark-submitted`, gom `toDto()` (đang chép 6 lần) | — |

> **Trạng thái 2026-09-15:** đã làm xong cả 8 bước. Khác kế hoạch ở 2 điểm: (1) mã nháp **không xóa hẳn** mà cất vào git stash — nó chưa từng được commit nên xóa là mất vĩnh viễn; (2) quyền ADMIN/OWNER kiểm bằng `assertQuanTriToKhaiThue` ở đầu controller (mang mã `E-tkt-014`) thay vì `assertAdminOrOwner`, áp cho cả endpoint thứ 23 tải lại file. Chi tiết từng bước và commit ở `docs/hrm/work-log.md`.

---

## 11. Điểm còn treo

| ID | Nội dung | Trạng thái mã nháp |
|---|---|---|
| `GAP-QA-tkt-01` | Quy đổi NET→GROSS cho thu nhập chịu thuế toàn phần (phụ thuộc vòng vào thuế suất biên) | **Đang trả lời ngầm bằng giả định chưa ai duyệt**: `otherIncome.service.ts:27-34` gán thẳng `gross = net`, không quy đổi, **không cảnh báo**. Kế toán nhập NET 10 triệu sẽ thấy gross 10 triệu và tin là đúng. Khi viết lại: hoặc **chặn** `NET` cho nhóm `TAXABLE_FULL` (400 kèm thông điệp rõ), hoặc cho qua nhưng `explain` phải nói thẳng "chưa quy đổi". **Không giữ cách im lặng hiện tại** |
| `OQ-tkt-02` | T1–T6/2026 áp biểu cũ hay mới | Mã nháp không có khái niệm mốc hiệu lực ⇒ mặc định ngầm "biểu mới cho cả năm 2026". Khi ADR-012 cài đúng, nhánh còn lại chỉ tốn **một dòng dữ liệu**; với mã nháp hiện tại thì phải sửa code. Là **lý do kỹ thuật bổ sung để làm ADR-012 trước** |
| `OQ-tkt-05` | Định nghĩa pháp lý của `ct24`/`ct25`/`ct32` | Đúng 3 ô mà FE nháp để `useState` cục bộ; backend để `ct32 = 0` cố định |
| `OQ-tkt-03` | Trần miễn thuế trang phục bằng tiền 5.000.000đ/năm | Giá trị mặc định của danh mục `EXEMPT_CAPPED` |

## 12. Việc ngoài phạm vi sub-cụm, phát hiện khi đối soát

`hdđt_maxv/src/features/hrm/api/cau_hinh_mac_dinh/cauHinhQueries.ts:239-255` — hàm `cauHinhMacDinhGoc()` chứa nguyên bộ số của luật cũ (giảm trừ 11tr/4,4tr · trần ăn ca 730k · ngưỡng khấu trừ 2tr · biểu 7 bậc đầy đủ). Đây là **code đã commit**, dùng làm giá trị dự phòng của `useCauHinh()` khi dữ liệu chưa tải xong, và được **7 màn** tiêu thụ. Hệ quả: màn Cài đặt chung có thể chớp lên biểu 7 bậc trong khi máy chủ đã tính 5 bậc.

Không thuộc `to_khai_thue`; là nốt cuối của chính lỗi BUG-dltl-003/004 ở phía giao diện.

> ✅ **ĐÃ XỬ LÝ 2026-09-14 20:50** — chủ dự án kích hoạt riêng. Ngoài `cauHinhQueries.ts`, còn sửa thêm 3 chỗ **chữ hiện ra cho người dùng** vẫn ghi "7 bậc chuẩn (Điều 22)" ở `CauHinhPanel.tsx`:69,180 và `ThueSection.tsx`:147 — sửa hằng số mà để nguyên chữ thì màn hình tự mâu thuẫn. Chi tiết ở `work-log.md`. **14 vị trí trong mã nháp `to_khai_thue` (Mục 7) vẫn còn nguyên** — thuộc đợt bật lại FE.
