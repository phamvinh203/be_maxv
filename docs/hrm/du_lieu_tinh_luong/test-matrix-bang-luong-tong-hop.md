---
type: test-matrix
feature: hrm-du-lieu-tinh-luong
status: draft
updated: 2026-09-10
author: tester-qa
links:
  - docs/hrm/du_lieu_tinh_luong/srs-du-lieu-tinh-luong.md
  - docs/hrm/du_lieu_tinh_luong/qa-report-du-lieu-tinh-luong.md
  - docs/hrm/du_lieu_tinh_luong/data-model-du-lieu-tinh-luong.md
  - docs/hrm/du_lieu_tinh_luong/api-contract-du-lieu-tinh-luong.md
  - docs/hrm/architecture/adr/ADR-010-pipeline-thue-bao-hiem-bang-luong.md
  - be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollCalculation.service.ts
  - be_maxv/src/__tests__/hrm/hrmPayrollInputData.test.ts
  - docs/hrm/CONTEXT_SUMMARY.md
---

# HR — Test Matrix & Test Cases (ATDD): Bảng lương tổng hợp (Payroll Calculation)

Phase A (Shift-Left) — thiết kế test TRƯỚC khi Backend Engineer code, chạy song song với Architect.

**Rà soát lần 2 (2026-09-10, cùng ngày với lượt viết đầu).** BA đã trả lời trực tiếp `GAP-QA-01/02/05` (`srs-du-lieu-tinh-luong.md` Mục 15.10) và Architect đã khóa pipeline 10 bước trong `ADR-010-pipeline-thue-bao-hiem-bang-luong.md`. Đồng thời chủ dự án ra thêm một quyết định mới giải quyết câu hỏi Q-1 của Architect: hệ thống **tôn trọng ô tick "chịu thuế TNCN"** có sẵn ở màn "Khoản lương" (`SalaryItem.isTaxable`) — khoản phụ cấp cố định nào được đánh dấu miễn thuế thì thực sự bị trừ khỏi thu nhập tính thuế, **không còn giới hạn** ở 2 ngoại lệ cứng (OT vượt chuẩn, ăn trưa trong trần 730k). Lượt rà soát này: (1) sửa số liệu Nhóm 1/4/5/6 theo đúng pipeline `ADR-010`, (2) đóng `GAP-QA-01/02/05`, (3) bổ sung Nhóm 9 cho quyết định Q-1 mới.

⚠️ **Lưu ý quan trọng phát hiện khi đối chiếu lại:** tại thời điểm QA đọc `ADR-010` (bản cập nhật `2026-09-10 10:59`), file đó **vẫn liệt Q-1 là câu hỏi mở** với hành vi mặc định đang thiết kế là "bỏ qua" (`isTaxable`/`taxTreatment` không có tác dụng). Quyết định "tôn trọng tick" được truyền đạt cho QA qua kênh khác (orchestrator), **chưa khớp với văn bản ADR-010 QA đọc được**. Nhóm 9 dưới đây dùng quyết định mới làm giả định thiết kế test — đánh dấu rõ `GAP-QA-09`, cần Architect cập nhật lại `ADR-010` xác nhận bằng văn bản trước khi Backend code phần này.

Phạm vi: 2 quyết định gốc của chủ dự án (nguồn lương cơ bản hybrid, giữ biểu thuế 7 bậc) + 4 Business Rule mới (`BR-dltl-024…027`) + quyết định Q-1 mới (miễn thuế theo `isTaxable`) + endpoint mới `GET /payroll/support-allowances` + 5 edge case an toàn tài chính đã có phải giữ nguyên (regression). KHÔNG chạy test thật ở bước này — chưa có code Backend Engineer viết cho phần mở rộng.

---

## 0. Đối chiếu chéo với đặc tả BA — mâu thuẫn/thiếu sót cần làm rõ TRƯỚC khi Backend code

> Theo đúng vai trò Phase A "phản biện lại Architect và BA để chốt thiết kế chuẩn nhất". Các gap dưới đây **chặn** một phần hoặc toàn phần của nhóm test tương ứng — đã ghi rõ mức độ chặn. KHÔNG tự đoán số liệu cho các gap còn mở trong Mục 3/4.

| Mã | Gap | Ảnh hưởng | Mức chặn |
|---|---|---|---|
| GAP-QA-01 | **✅ ĐÃ ĐÓNG** (`srs-du-lieu-tinh-luong.md` Mục 15.10, đối chiếu `ADR-010` bước [1]). Quyết định: `fixedAllowanceTotal` gồm **CẢ 2** category `FIXED_ALLOWANCE` + `BENEFIT_ALLOWANCE` (kể cả khoản ăn trưa) — khoản ăn trưa vẫn cộng vào "Lương"/thực lĩnh như mọi phụ cấp cố định khác; trần thuế 730k (BR-dltl-027) là việc RIÊNG, độc lập, không loại trừ nhau. Giả định cũ của QA (chỉ tính `FIXED_ALLOWANCE`, loại `BENEFIT_ALLOWANCE`) đã **SAI so với chỉ đạo gốc**, đã sửa | Nhóm 1 (`TC-blth-001`, `001b`) + Nhóm 6 đã cập nhật theo công thức đúng | ✅ Không còn chặn |
| GAP-QA-02 | **✅ ĐÃ ĐÓNG** (SRS Mục 15.10 + `ADR-010` bước [2]). Quyết định: phương án (b) — mỗi `EmployeeSalaryItem` tự quy đổi theo `SalaryStructureItem.calculationMethod` RIÊNG (`MONTHLY_FIXED` = không quy đổi, `ACTUAL_WORKDAYS`/`HOURLY` = quy đổi theo `actualWorkDays/standardWorkDays`), KHÔNG gộp chung 1 tỷ lệ với `luong_chinh`. Làm rõ thêm: `baseSalaryMonthly` (cột "Lương") **không quy đổi công gì cả** — chỉ `allowanceInPeriodTotal` (phần vào `grossIncome`) mới quy đổi | Nhóm 1 (`TC-blth-001b` mới) | ✅ Không còn chặn |
| GAP-QA-03 | *(không đổi so với lượt trước)* `EmployeeSalary.ma_nv` unique, code không lọc theo `effectiveFrom`/`effectiveTo` — set lương sửa giữa kỳ áp ngược cho kỳ đang tính. Chưa rõ đây là bug hay chủ đích | Test Nhóm 1 case "set lương thay đổi giữa kỳ" (`TC-blth-005`) — viết được theo hành vi hiện tại, chưa xác nhận đúng nghiệp vụ | 🟡 Không chặn viết test, chặn việc coi PASS = đúng nghiệp vụ |
| GAP-QA-04 | *(không đổi)* `BR-dltl-024` không nói rõ cách làm tròn 2 trần bảo hiểm (từng phần rồi cộng, hay cộng rồi làm tròn 1 lần) — ảnh hưởng ±1đ | Test Nhóm 3 | 🟢 Không chặn — test dùng số chia hết |
| GAP-QA-05 | **✅ ĐÃ ĐÓNG** (SRS Mục 15.10 + `ADR-010` bước [5]→[8]). Quyết định: miễn thuế OT **áp dụng cho cả** HĐ thử việc/thời vụ, trừ `otTaxExemptAmount` (và `lunchAllowanceExemptAmount`) khỏi `thuNhapTruocGiamTru` **TRƯỚC KHI** nhân 10%, dùng chung công thức cho cả 2 nhánh thuế. `tinh_tncn = false` là công tắc TỔNG, kiểm TRƯỚC khi rẽ nhánh `loai_hd`, đè lên cả 2 cơ chế | Nhóm 5 (`TC-blth-029` đóng lại với số liệu cụ thể, không còn "Open") | ✅ Không còn chặn |
| GAP-QA-06 | *(không đổi hoàn toàn — làm rõ thêm)* Ngưỡng "≥2.000.000đ/lần trả" nay rõ hơn nhờ `ADR-010` bước [8]: so sánh dùng `thuNhapTruocGiamTru` (= `grossIncome − otTaxExemptAmount − lunchAllowanceExemptAmount`), KHÔNG phải `grossIncome` thô như giả định ban đầu của QA. Nhưng vẫn CHƯA có xác nhận bằng văn bản của BA cho đúng field/công thức này (chỉ suy ra từ ADR Architect viết) | Test Nhóm 5 | 🟡 Không chặn viết test (đã cập nhật giả định theo ADR-010), cần BA ack trước khi coi là final |
| GAP-QA-07 | *(cập nhật)* SRS Mục 15.6 xác nhận cần endpoint — `api-contract-du-lieu-tinh-luong.md` Mục 8.2 (cập nhật SAU khi QA viết Nhóm 7 lượt đầu) **nay đã có response shape đầy đủ** (`columns`/`items`/`amounts`/`monthlyTotal`/`total`). Nhóm 7 vẫn ở mức hành vi/HTTP status — viết lại field-level là việc của lượt rà soát KẾ TIẾP, ngoài phạm vi nhiệm vụ lần này (chỉ giới hạn Nhóm 1/2/4/6 + GAP-QA-01/02/05 + Q-1) | Test Nhóm 7 | 🟡 Không chặn — ghi nhận cơ hội cập nhật, chưa thực hiện đợt này |
| GAP-QA-08 | *(không đổi)* Nhân viên có Set lương `APPROVED` nhưng không có dòng `BENEFIT_ALLOWANCE` nào — endpoint mới trả 1 dòng "tổng = 0" hay loại khỏi danh sách. `api-contract` Mục 8.2 mô tả rõ hành vi cho **cột** (`columns`) khi chưa ai gán, nhưng chưa nói rõ hành vi cho **nhân viên** hoàn toàn không có dòng nào | Test Nhóm 7 (`TC-blth-039`) | 🟢 Không chặn — vẫn đợi Architect chốt |
| GAP-QA-09 *(mới, phát sinh từ quyết định Q-1)* | Quyết định Q-1 (chủ dự án, truyền đạt qua orchestrator — **chưa** thấy ghi nhận trong văn bản `ADR-010` tại thời điểm QA đọc, file đó vẫn liệt Q-1 là câu hỏi mở với default "bỏ qua"): khoản phụ cấp tick `SalaryItem.isTaxable = false` bị trừ khỏi thu nhập tính thuế. Không rõ: (a) tên field trả về mới (`otherAllowanceTaxExemptAmount` — QA tự đặt tạm), (b) cách xử lý khi 1 khoản VỪA `isMealAllowance=true` VỪA `isTaxable=false` — trừ **2 lớp** (miễn toàn bộ theo `isTaxable` CỘNG áp trần 730k theo `isMealAllowance`) hay chỉ **1 lớp** (QA giả định: lớp trần luật định BR-dltl-027 thắng, không cộng thêm lớp `isTaxable` cho khoản đã tính vào `mealAllowanceAmount` — tránh miễn vượt luật định) | Nhóm 9 (`TC-blth-045…050`) — thiết kế được test theo giả định QA, KHÔNG được coi PASS = đúng nghiệp vụ cho tới khi Architect cập nhật `ADR-010` | 🔴 Chặn việc coi Nhóm 9 là final, không chặn việc viết test |

**Kết luận Mục 0:** 3 gap 🔴 gốc (`GAP-QA-01`, `02`, `05`) đã **ĐÓNG** theo `srs-du-lieu-tinh-luong.md` Mục 15.10 + `ADR-010`. Phát sinh 1 gap 🔴 **MỚI** (`GAP-QA-09`) từ quyết định Q-1 — chặn việc coi Nhóm 9 (6 test case) là final, KHÔNG chặn Nhóm 1–8 (47 test case còn lại, có thể code thẳng). Các gap 🟡/🟢 còn lại (`GAP-QA-03, 04, 06, 07, 08`) giữ nguyên mức độ như lượt trước, không đổi trạng thái.

---

## 1. Dữ liệu cấu hình chuẩn dùng chung (fixture)

Theo đúng `DEFAULT_GENERAL_SETTING` đã có trong `hrmPayrollInputData.test.ts` (giữ nguyên để không lệch convention test hiện tại), cập nhật thêm 3 field cấu hình mới đã chốt ở `ADR-010` QĐ-2:

| Tham số | Giá trị |
|---|---|
| `standardWorkingDaysMethod` | `FIXED_26` → `standardWorkDays = 26` |
| `standardHoursPerDay` | `8.0` |
| `baseSalary` (lương cơ sở, NĐ73/2024) | `2.340.000đ` → trần BHXH+BHYT = `2.340.000 × 20 = 46.800.000đ` |
| `regionMinSalary` (lương tối thiểu vùng) | `4.960.000đ` → trần BHTN = `4.960.000 × 20 = 99.200.000đ` |
| `insuranceEmployeeSocial` / `Health` / `Unemployment` | `8.0% / 1.5% / 1.0%` → nhóm BHXH+BHYT = `9.5%`, nhóm BHTN = `1.0%` |
| `insuranceCompanySocial` / `Health` / `Unemployment` | `17.5% / 3.0% / 1.0%` → nhóm BHXH+BHYT = `20.5%`, nhóm BHTN = `1.0%` |
| `personalDeduction` / `dependentDeduction` | `11.000.000đ / 4.400.000đ` |
| `unionFeeEmployeeRate` / `unionFeeMaxAmount` / `unionFeeCompanyRate` | `1.0% / 234.000đ / 2.0%` |
| Hệ số trần bảo hiểm (`× 20`) | **HẰNG SỐ có trích dẫn luật** (Luật BHXH Điều 89, Luật Việc làm Điều 58) — KHÔNG phải field cấu hình (`ADR-010` QĐ-2, đóng câu hỏi cũ "cần Architect xác nhận có thêm field hay không") |
| `GeneralSetting.lunchAllowanceTaxFreeCap` (TT26/2016/TT-BLĐTBXH) | `730.000đ/tháng` — **✅ ĐÃ CHỐT là field cấu hình mới** (`ADR-010` QĐ-2, `data-model-du-lieu-tinh-luong.md` Mục 11), không hardcode |
| `GeneralSetting.withholdingTaxThreshold` (Điều 25 TT111/2013) | `2.000.000đ/lần trả` — field cấu hình mới (`ADR-010` QĐ-2) |
| `GeneralSetting.withholdingTaxRate` | `10%` — field cấu hình mới (`ADR-010` QĐ-2) |
| `otBase`/`otHourlyRate` mẫu (dùng cho Nhóm 4) | `contractBaseSalary = 15.600.000đ` (mặc định KHÔNG cộng phụ cấp — chỉ cộng khoản có `SalaryStructureItem.isOvertimeBase = true`, `ADR-010` QĐ-1) → `otHourlyRate = 15.600.000 / (26 × 8) = 75.000đ/giờ` |

---

## 2. Ma trận Business Rule ↔ Test Case

| Mã BR | Tên | Test case | Ưu tiên |
|---|---|---|---|
| BR-dltl-028 *(mới, QA đề xuất — thực chất là câu trả lời cho OQ-dltl-011)* | Công thức lương cơ bản hybrid: `luong_chinh` + Σ phụ cấp cố định (cả 2 category) | TC-blth-001, 001b, 002…005 | P0 |
| BR-dltl-002x (đối chiếu, không đổi) | Biểu thuế TNCN 7 bậc — KHÔNG đổi sang 5 bậc | TC-blth-006…013 | P0 |
| BR-dltl-024 | 2 trần bảo hiểm độc lập (BHXH+BHYT 46.8tr, BHTN 99.2tr) | TC-blth-014…019 | P0 |
| BR-dltl-025 | Miễn thuế OT vượt chuẩn (Điều 3 TT111/2013), `otBase` theo ADR-010 QĐ-1 | TC-blth-020…024, 024b, 024c | P0 |
| BR-dltl-026 | Khấu trừ 10% tại nguồn HĐ thử việc/thời vụ | TC-blth-025…029 (029 đã đóng) | P0 |
| BR-dltl-027 | Trần miễn thuế ăn trưa 730k/tháng + prorate | TC-blth-030…034 | P0 |
| BR-dltl-029 *(mới, QA đề xuất)* | Endpoint `GET /payroll/support-allowances` | TC-blth-035…040 | P1 |
| BR-dltl-021, BR-dltl-018, (giảm trừ > thu nhập) | Regression — 3 bất biến tài chính đã có | TC-blth-041…044 | P0 (regression gate) |
| Q-1 *(chủ dự án, qua orchestrator 2026-09-10 — CHƯA có trong văn bản `ADR-010`, xem `GAP-QA-09`)* | Miễn thuế phụ cấp cố định theo cờ `isTaxable=false` | TC-blth-045…050 | 🔴 P0 nhưng CHƯA final |

Tổng: **53 test case** (9 nhóm).

---

## 3. Test Cases chi tiết (Given/When/Then)

### Nhóm 1 — Nguồn lương cơ bản hybrid (BR-dltl-028) — ✅ GAP-QA-01, GAP-QA-02 đã đóng

> **Công thức CHỐT** (SRS Mục 15.10 + `ADR-010` bước [1]/[2]): `fixedAllowanceTotal` = tổng `EmployeeSalaryItem.amount` (MỨC THÁNG, chưa quy đổi công) của Set lương `APPROVED`, gồm **cả 2** category `FIXED_ALLOWANCE` VÀ `BENEFIT_ALLOWANCE` (kể cả khoản ăn trưa — `GAP-QA-01` đóng). `baseSalaryMonthly = contractBaseSalary (luong_chinh) + fixedAllowanceTotal` — đây là cột UI "Lương", **KHÔNG quy đổi theo công**.
>
> Phân biệt với `allowanceInPeriodTotal` (dùng cho `grossIncome`/thực lĩnh, CÓ quy đổi công): mỗi khoản tự quy đổi theo `SalaryStructureItem.calculationMethod` RIÊNG của chính nó — `calculationMethod ∈ {ACTUAL_WORKDAYS, HOURLY}` → `round(amount × actualWorkDays/standardWorkDays)`; còn lại (`MONTHLY_FIXED`…) → giữ nguyên mức tháng, KHÔNG quy đổi (`GAP-QA-02` đóng, phương án (b) — không gộp chung 1 tỷ lệ với `luong_chinh`).

**TC-blth-001 — Có Set lương, phụ cấp cố định thuộc CẢ 2 category, đủ công**
- Given: `hrm_hop_dong.luong_chinh = 12.000.000đ`; Set lương `APPROVED` có 3 dòng: "Phụ cấp điện thoại" `500.000đ` (`FIXED_ALLOWANCE`, `MONTHLY_FIXED`) + "Phụ cấp xăng xe" `300.000đ` (`FIXED_ALLOWANCE`, `MONTHLY_FIXED`) + "Phụ cấp ăn trưa" `700.000đ` (`BENEFIT_ALLOWANCE`, `MONTHLY_FIXED`, `isMealAllowance=true`).
- When: `calculatePayrollPreview` chạy, nhân viên đủ công (`actualWorkDays = standardWorkDays = 26`).
- Then: `fixedAllowanceTotal = 500.000+300.000+700.000 = 1.500.000đ` (GỒM CẢ khoản ăn trưa — `GAP-QA-01`); `baseSalaryMonthly = 12.000.000 + 1.500.000 = 13.500.000đ` (cột "Lương"). Phần THUẾ của khoản ăn trưa xử lý độc lập ở Nhóm 6 (không ảnh hưởng số này).

**TC-blth-001b (MỚI — đóng GAP-QA-02) — Cùng dữ liệu TC-001 nhưng THIẾU công, quy đổi RIÊNG từng khoản theo `calculationMethod`**
- Given: như TC-001, nhưng đổi "Phụ cấp xăng xe" sang `calculationMethod = ACTUAL_WORKDAYS`; `actualWorkDays = 20/26`.
- Then: `baseSalaryMonthly` **VẪN = `13.500.000đ`** (không đổi — mức tháng nominal, không quy đổi công). `allowanceInPeriodTotal` (phần thực vào `grossIncome`) quy đổi RIÊNG từng khoản: điện thoại `MONTHLY_FIXED` → `500.000đ` (nguyên); xăng xe `ACTUAL_WORKDAYS` → `round(300.000×20/26) = 230.769đ`; ăn trưa `MONTHLY_FIXED` → `700.000đ` (nguyên) → `allowanceInPeriodTotal = 500.000+230.769+700.000 = 1.430.769đ`. `proratedWorkSalary = round(12.000.000×20/26) = 9.230.769đ` (chỉ phần hợp đồng). Xác nhận KHÔNG gộp chung 1 tỷ lệ `actualWorkDays/standardWorkDays` cho toàn bộ phụ cấp.

**TC-blth-002 — Có Set lương nhưng không có dòng `FIXED_ALLOWANCE`/`BENEFIT_ALLOWANCE` nào**
- Given: `luong_chinh = 12.000.000đ`; Set lương `APPROVED` chỉ có dòng `ATTENDANCE_ALLOWANCE`/`KPI_PERFORMANCE`, không có `FIXED_ALLOWANCE` hay `BENEFIT_ALLOWANCE`.
- Then: `fixedAllowanceTotal = 0`; `baseSalaryMonthly = 12.000.000đ` (không cộng thêm gì).

**TC-blth-003 — Không có Set lương nào** *(không đổi)*
- Given: `luong_chinh = 12.000.000đ`; không tồn tại bản ghi `EmployeeSalary` cho nhân viên.
- Then: `baseSalaryMonthly = 12.000.000đ` (chỉ từ hợp đồng — khớp hành vi fallback hiện tại `es ? ... : 0`).

**TC-blth-004 — Set lương tồn tại nhưng chưa `APPROVED`** *(không đổi)*
- Given: `luong_chinh = 12.000.000đ`; có `EmployeeSalary` với `status = PENDING_APPROVAL` chứa dòng `FIXED_ALLOWANCE 500.000đ`.
- Then: `baseSalaryMonthly = 12.000.000đ` (dòng `PENDING_APPROVAL` KHÔNG được tính — đúng theo filter `status: 'APPROVED'` đã có trong query).

**TC-blth-005 — Set lương thay đổi giữa kỳ (khẳng định hành vi hiện tại, KHÔNG khẳng định đúng nghiệp vụ — `GAP-QA-03` vẫn mở, ngoài phạm vi lượt rà soát này)**
- Given: kỳ lương tháng 09/2026 (01/09–30/09). `EmployeeSalary.effectiveFrom = 01/10/2026` (hiệu lực THÁNG SAU), `FIXED_ALLOWANCE = 1.000.000đ`.
- When: tính lương cho kỳ 09/2026.
- Then (hành vi hiện tại, do code không lọc `effectiveFrom`/`effectiveTo`): `baseSalaryMonthly` VẪN cộng `1.000.000đ` dù set lương chưa hiệu lực trong kỳ — **PASS test này = xác nhận đúng code, KHÔNG đồng nghĩa đúng nghiệp vụ**. Chờ BA/Architect quyết định có cần lọc theo `effectiveFrom`/`effectiveTo` không.

---

### Nhóm 2 — Biểu thuế TNCN 7 bậc giữ nguyên (đối chiếu, không phải BR mới) — không thay đổi lượt này

Regression test trên `tinhThueLuyTien()` — xác nhận KHÔNG bị đổi sang biểu 5 bậc (từng sai ở cụm HRM khác, `BR-hrm-080`). Đã đối chiếu lại với `ADR-010` (QĐ-6, "giữ hardcode") và SRS Mục 15.8 — không có gì thay đổi, biểu thuế và công thức dưới đây giữ nguyên nguyên trạng.

| TC | Thu nhập tính thuế | Kỳ vọng | Công thức |
|---|---|---|---|
| TC-blth-006 | 5.000.000đ (đúng bậc 1) | 250.000đ | `5.000.000 × 5%` |
| TC-blth-007 | 10.000.000đ (đúng bậc 2) | 750.000đ | `250.000 + 5.000.000×10%` |
| TC-blth-008 | 18.000.000đ (đúng bậc 3) | 1.950.000đ | `750.000 + 8.000.000×15%` |
| TC-blth-009 | 32.000.000đ (đúng bậc 4) | 4.750.000đ | `1.950.000 + 14.000.000×20%` |
| TC-blth-010 | 52.000.000đ (đúng bậc 5) | 9.750.000đ | `4.750.000 + 20.000.000×25%` |
| TC-blth-011 | 80.000.000đ (đúng bậc 6) | 18.150.000đ | `9.750.000 + 28.000.000×30%` |
| TC-blth-012 | 100.000.000đ (bậc 7, mở) | 25.150.000đ | `18.150.000 + 20.000.000×35%` |
| TC-blth-013 | 100.000.000đ **KHÔNG được bằng** kết quả biểu 5 bậc | ≠ giá trị biểu 5 bậc (nếu ai đó lỡ đổi công thức, biểu 5 bậc dừng ở mức 25% sẽ cho kết quả thấp hơn hẳn) | Regression guard, so sánh khác giá trị sai đã từng phát hiện ở cụm HRM khác |

---

### Nhóm 3 — 2 trần bảo hiểm độc lập (BR-dltl-024) — không thay đổi lượt này

> Công thức (khớp `ADR-010` bước [6], QĐ-2 — cộng riêng rồi mới cộng, KHÔNG kẹp 1 trần chung):
> `employeeInsuranceDeduction = round(min(insuranceSalaryBase, 46.800.000) × 9,5%) + round(min(insuranceSalaryBase, 99.200.000) × 1,0%)`
> Tương tự cho `companyInsuranceExpense` với tỷ lệ `20,5%` / `1,0%`. `GAP-QA-04` (cách làm tròn) vẫn 🟢 mở, không ảnh hưởng các số liệu chia hết dưới đây.

| TC | `insuranceSalaryBase` (= `luong_bhxh`) | BHXH+BHYT (nền × 9,5%) | BHTN (nền × 1,0%) | `employeeInsuranceDeduction` | `companyInsuranceExpense` (20,5%/1,0%) |
|---|---|---|---|---|---|
| TC-blth-014 (dưới cả 2 trần) | 20.000.000đ | 20.000.000 × 9,5% = 1.900.000 | 20.000.000 × 1% = 200.000 | 2.100.000đ | 20.000.000×20,5%+20.000.000×1%=4.300.000đ |
| TC-blth-015 (vượt cả 2 trần) | 120.000.000đ | **min(120tr, 46,8tr)**=46.800.000 × 9,5% = 4.446.000 | **min(120tr, 99,2tr)**=99.200.000 × 1% = 992.000 | 5.438.000đ | 46.800.000×20,5%+99.200.000×1%=10.586.000đ |
| TC-blth-016 (giữa 2 trần) | 70.000.000đ | **min(70tr, 46,8tr)**=46.800.000 × 9,5% = 4.446.000 | 70.000.000 (< 99,2tr, không capped) × 1% = 700.000 | 5.146.000đ | 46.800.000×20,5%+70.000.000×1%=10.294.000đ |
| TC-blth-017 (boundary trần 1) | đúng 46.800.000đ | 46.800.000 × 9,5% = 4.446.000 (không capped, bằng trần vẫn tính đủ) | 46.800.000 × 1% = 468.000 | 4.914.000đ | — |
| TC-blth-018 (boundary trần 2) | đúng 99.200.000đ | min(99,2tr,46,8tr)=46.800.000 × 9,5%=4.446.000 | 99.200.000 × 1% = 992.000 (bằng trần, không capped thêm) | 5.438.000đ | — |
| TC-blth-019 (`trich_bhxh = false`) | bất kỳ (vd 20.000.000đ) | — | — | **0đ** (regression giữ nguyên hành vi hiện tại, không đóng BH) | 0đ |

---

### Nhóm 4 — Miễn thuế OT vượt chuẩn (BR-dltl-025, Điều 3 TT111/2013) — ⚠️ cập nhật theo `ADR-010` QĐ-1

> **Cập nhật quan trọng (sửa nguy cơ regression B-5, `api-contract` Mục 8.1.3):** `otHourlyRate = otBase / (standardWorkDays × standardHoursPerDay)`, với `otBase = contractBaseSalary + Σ (khoản có SalaryStructureItem.isOvertimeBase = true)`. **KHÔNG dùng `baseSalaryMonthly`** — nếu code nhầm dùng `baseSalaryMonthly` (đã gồm phụ cấp cố định từ lượt cập nhật GAP-QA-01), tiền OT sẽ tự phồng theo phụ cấp cố định mới cộng vào, một lỗi tính tiền nghiêm trọng. Mặc định `isOvertimeBase = false` cho mọi khoản ⇒ `otBase = contractBaseSalary` — số học giữ nguyên như lượt viết ban đầu (chỉ đổi TÊN biến/nguồn, không đổi số nếu không khoản nào bật cờ).
>
> Công thức miễn thuế (không đổi): với mỗi `OvertimeRecord` r trong kỳ, `tienMienThue_r = max(0, round(otHourlyRate×r.convertedHours) − round(otHourlyRate×r.hours))`; `otTaxExemptAmount = Σ tienMienThue_r`; `thuNhapTruocGiamTru = grossIncome − otTaxExemptAmount − lunchAllowanceExemptAmount` (`grossIncome`/`otAmount`/`netTakeHomeSalary` giữ nguyên, chỉ phần TÍNH THUẾ giảm).
>
> Fixture: `contractBaseSalary = 15.600.000đ`, không có khoản `isOvertimeBase=true` → `otHourlyRate = 75.000đ/giờ`.

| TC | Loại OT | Giờ gốc | `ratePercent` | `otAmount` (đủ) | Phần miễn thuế = `hours × otHourlyRate × (rate/100−1)` |
|---|---|---|---|---|---|
| TC-blth-020 | Ngày thường (`ngay_thuong_ngay`) | 10h | 150% | 10×75.000×1,5=1.125.000đ | 10×75.000×0,5=**375.000đ miễn** |
| TC-blth-021 | Ngày nghỉ (`chu_nhat_ngay`) | 5h | 200% | 5×75.000×2,0=750.000đ | 5×75.000×1,0=**375.000đ miễn** |
| TC-blth-022 | Ngày lễ (`ngay_le_ngay`) | 4h | 300% | 4×75.000×3,0=900.000đ | 4×75.000×2,0=**600.000đ miễn** |
| TC-blth-023 | Cộng dồn cả 3 loại trong 1 kỳ | 10h+5h+4h | — | Tổng `otAmount = 2.775.000đ` | Tổng miễn = 375.000+375.000+600.000=**1.350.000đ**; `thuNhapTruocGiamTru` giảm đúng 1.350.000đ so với cách tính cũ (KHÔNG giảm `grossIncome`) |
| TC-blth-024 | `tinh_tncn = false` (HĐ không tính thuế) | 10h, 150% | — | `otAmount` vẫn tính đủ vào `grossIncome`/`netTakeHomeSalary` | `personalIncomeTax = 0` bất kể miễn trừ OT (regression — miễn trừ chỉ có ý nghĩa khi `tinh_tncn=true`) |

**TC-blth-024b (MỚI — regression chặn lỗi B-5) — `otBase` KHÔNG được phồng theo phụ cấp cố định mặc định**
- Given: `contractBaseSalary = 15.600.000đ`; có thêm phụ cấp cố định `fixedAllowanceTotal = 2.000.000đ` (mọi khoản `isOvertimeBase = false` mặc định) → `baseSalaryMonthly = 17.600.000đ`; 1 dòng OT ngày thường (`hours=10`, `convertedHours=15`).
- Then: `otHourlyRate` **VẪN PHẢI** = `15.600.000/(26×8) = 75.000đ/giờ` (dùng `contractBaseSalary`, KHÔNG dùng `baseSalaryMonthly=17.600.000` — nếu sai sẽ ra `84.615đ/giờ`, thổi phồng chi phí OT). `otAmount = round(75.000×15) = 1.125.000đ`, không phải `1.269.231đ`.

**TC-blth-024c (MỚI) — Opt-in: khoản có `isOvertimeBase = true` ĐƯỢC cộng vào `otBase`**
- Given: như TC-024b, nhưng "Phụ cấp trách nhiệm" `2.080.000đ/tháng` (`MONTHLY_FIXED`) được kế toán bật cờ `isOvertimeBase = true`.
- Then: `otBase = 15.600.000 + 2.080.000 = 17.680.000đ` → `otHourlyRate = 17.680.000/208 = 85.000đ/giờ` — xác nhận cờ hoạt động đúng khi kế toán chủ động bật.

---

### Nhóm 5 — Khấu trừ 10% tại nguồn HĐ thử việc/thời vụ (BR-dltl-026, Điều 25 TT111/2013) — ✅ GAP-QA-05 đã đóng

> **Cập nhật theo `ADR-010` bước [8]:** ngưỡng so sánh dùng `thuNhapTruocGiamTru = grossIncome − otTaxExemptAmount − lunchAllowanceExemptAmount` (đã trừ phần miễn thuế OT/ăn trưa nếu có), **không phải** `grossIncome` thô — trả lời đúng hướng `GAP-QA-05` (miễn thuế OT áp dụng CẢ cho HĐ thử việc/thời vụ, trừ TRƯỚC khi nhân 10%). `GAP-QA-06` (ngưỡng tính trên field nào) nay rõ hơn nhờ ADR nhưng vẫn 🟡 chờ BA ack chính thức bằng văn bản cho field `thuNhapTruocGiamTru`. `loai_hd` áp dụng: `thu_viec`, `thoi_vu` — nhận diện qua `laHopDongKhauTruTaiNguon()` (`ADR-010` QĐ-3), KHÔNG dùng lại `loaiHdVeNhanVien()` cũ (2 luật gom nhóm khác nhau).
>
> Các test dưới đây KHÔNG có OT/phụ cấp ăn trưa nên `thuNhapTruocGiamTru = grossIncome` — số liệu không đổi so với lượt trước, chỉ đổi tên biến so sánh.

| TC | `loai_hd` | `grossIncome` | Công thức | `personalIncomeTax` | Giảm trừ gia cảnh |
|---|---|---|---|---|---|
| TC-blth-025 | `thu_viec` | 5.000.000đ (≥2tr) | `round(5.000.000 × 10%)` | **500.000đ** | KHÔNG áp dụng (`personalDeduction`/`dependentDeduction` = 0 trong công thức này) |
| TC-blth-026 | `thoi_vu` | 1.800.000đ (<2tr) | Không khấu trừ | **0đ** | N/A |
| TC-blth-027 | `thu_viec` | đúng 2.000.000đ (boundary, ≥ → có khấu trừ) | `round(2.000.000 × 10%)` | **200.000đ** | KHÔNG áp dụng |
| TC-blth-028 | `xac_dinh` (HĐ dài hạn, đối chiếu) | 5.000.000đ (cùng mức TC-025) | `tinhThueLuyTien(max(0, 5.000.000 − 11.000.000 − dependentDeduction×N − BH))` | **0đ** (dưới ngưỡng chịu thuế do có giảm trừ) — khác hẳn TC-025 dù cùng gross, chứng minh 2 cơ chế độc lập | Áp dụng đầy đủ |
| TC-blth-029 | `thu_viec`, `tinh_tncn = false` — **ĐÃ ĐÓNG (GAP-QA-05)** | 5.000.000đ | `tinh_tncn ≠ true` → thuế 0 (công tắc TỔNG, kiểm TRƯỚC rẽ nhánh `loai_hd`, `ADR-010` bước [8]) | **0đ** | N/A |

- Then TC-blth-029: `personalIncomeTax = 0đ`, `withholdingTaxApplied = false` — cờ `tinh_tncn=false` ĐÈ LÊN cả 2 cơ chế (khấu trừ 10% lẫn biểu lũy tiến), bất kể `loai_hd` là gì.

---

### Nhóm 6 — Trần miễn thuế phụ cấp ăn trưa 730k/tháng (BR-dltl-027) — ✅ GAP-QA-01/02 đã đóng, không còn chặn

> Khoản ăn trưa là 1 dòng `EmployeeSalaryItem` category `BENEFIT_ALLOWANCE`, cờ `isMealAllowance=true` (`ADR-010` QĐ-4). `GAP-QA-01` xác nhận khoản này **vẫn nằm trong** `fixedAllowanceTotal`/"Lương" (Nhóm 1) ĐỒNG THỜI có xử lý thuế riêng ở đây — 2 việc độc lập, không loại trừ nhau. Prorate trần theo đúng `tyLeCong = min(actualWorkDays/standardWorkDays, 1)`: `hanMucMienThue = round(GeneralSetting.lunchAllowanceTaxFreeCap × tyLeCong)`. Nếu khoản ăn trưa CÒN được tick `isTaxable=false` — xem Nhóm 9 (`TC-blth-047`/`048`) về cách tránh trừ trùng 2 lớp (`GAP-QA-09`, chưa final).

| TC | Số tiền cấu hình/tháng | `actualWorkDays` | Số tiền sau prorate (`mealAllowanceAmount`) | Phần miễn thuế `lunchAllowanceExemptAmount = min(prorated, hanMucMienThue)` | Phần chịu thuế `lunchAllowanceTaxableAmount` |
|---|---|---|---|---|---|
| TC-blth-030 (trong trần, đủ công) | 700.000đ | 26/26 | 700.000đ | 700.000đ | 0đ |
| TC-blth-031 (vượt trần, đủ công) | 900.000đ | 26/26 | 900.000đ | 730.000đ | **170.000đ** |
| TC-blth-032 (trong trần sau prorate) | 800.000đ | 20/26 | `round(800.000×20/26)=615.385đ` | 615.385đ | 0đ |
| TC-blth-033 (vượt trần sau prorate) | 1.200.000đ | 20/26 | `round(1.200.000×20/26)=923.077đ` | 730.000đ | **193.077đ** |
| TC-blth-034 (boundary đúng trần) | 730.000đ | 26/26 | 730.000đ | 730.000đ | 0đ |

---

### Nhóm 7 — Endpoint mới `GET /payroll/support-allowances` (BR-dltl-029) — mức test hành vi, chưa assert field-level (GAP-QA-07)

> `api-contract-du-lieu-tinh-luong.md` Mục 8.2 (cập nhật `2026-09-10 11:00`, SAU khi QA viết nhóm này) nay ĐÃ có response shape đầy đủ (`columns[]` với `code/name/calculationMethod/isTaxable/isMealAllowance`, `items[]` với `amounts/monthlyTotal/total`). Viết lại assertion field-level cho Nhóm 7 là việc của lượt rà soát KẾ TIẾP — ngoài phạm vi nhiệm vụ được giao lần này (chỉ giới hạn Nhóm 1/2/4/6 + GAP-QA-01/02/05 + Q-1). Các test case dưới đây GIỮ NGUYÊN như lượt trước.

**TC-blth-035 — Trả đúng breakdown nhiều nhân viên, nhiều khoản**
- Given: kỳ có 2 nhân viên đang hoạt động, mỗi người có Set lương `APPROVED` với ≥1 dòng `BENEFIT_ALLOWANCE`.
- When: `GET /payroll/support-allowances?periodId=<id>`.
- Then: HTTP 200, response là mảng có 2 phần tử (1/nhân viên), mỗi phần tử có breakdown theo từng khoản + tổng khớp Σ các khoản của người đó.

**TC-blth-036 — Kỳ chưa có nhân viên nào đang hoạt động**
- Given: kỳ tồn tại hợp lệ nhưng toàn bộ nhân viên `da_xoa=true`/`status≠'1'`.
- Then: HTTP 200, response là mảng rỗng `[]` (không lỗi).

**TC-blth-037 — `periodId` không tồn tại**
- Given: `periodId` không có trong DB.
- Then: HTTP 404, `code = "E-dltl-025"` (nhất quán với các endpoint payroll khác dùng `getPayrollPeriodOrThrow`).

**TC-blth-038 — Không có quyền xem lương (`xemLuong = false`)**
- Given: user có `xemLuong: false` trong context.
- Then: HTTP 403 (nhất quán guard `assertXemLuong` đã áp cho `GET /payroll/calculate`, `GET /payroll/sheet-lines`).

**TC-blth-039 — Nhân viên có Set lương nhưng không có dòng `BENEFIT_ALLOWANCE` nào**
- Given: nhân viên có `EmployeeSalary APPROVED` chỉ có dòng `FIXED_ALLOWANCE`/`KPI_PERFORMANCE`, không có `BENEFIT_ALLOWANCE`.
- Then: *(Open — GAP-QA-08)* cần Architect chốt: (a) vẫn xuất hiện 1 dòng breakdown rỗng/tổng=0, hay (b) bị loại khỏi response. Thiết kế test theo hướng (a) là mặc định an toàn hơn — **đề xuất, không phải quyết định cuối**.

**TC-blth-040 — Cô lập tenant (P0 security, theo quy ước MAXV)**
- Given: 2 tenant/công ty khác nhau (Công ty A, Công ty B), mỗi bên có kỳ lương + nhân viên riêng.
- When: user Công ty A gọi endpoint với `periodId` thuộc Công ty B (dù có bằng cách nào đoán được ID).
- Then: KHÔNG trả dữ liệu Công ty B — vì `resolveTenantDb(req)` đã tách DB theo tenant, `periodId` của Công ty B sẽ không tồn tại trong DB của Công ty A → phải rơi vào case TC-blth-037 (404), TUYỆT ĐỐI không rơi vào case trả rỗng-vì-tìm-thấy-nhưng-khác-tenant.

---

### Nhóm 8 — Regression: 3 bất biến tài chính đã có (giữ nguyên, không phá)

**TC-blth-041 — Thực lĩnh âm không bị ép về 0 (EC-03 / BR-dltl-021)**
- Given: `netTakeHomeSalary` âm do `adjustmentNetAmount` (tạm ứng) lớn hơn thu nhập kỳ, VÀ kỳ này có thêm OT-miễn-thuế + 2 trần BH mới + (nếu Nhóm 9 áp dụng) khoản miễn thuế theo `isTaxable`.
- Then: `netTakeHomeSalary` vẫn là số âm đúng giá trị, không có `Math.max(0, ...)` nào được thêm vào vô tình khi Backend sửa công thức thuế/BH.

**TC-blth-042 — Chặn sàn chuyên cần không âm (BR-dltl-018)**
- Given: đơn giá chuyên cần 1.000.000đ, tổng phạt khai báo 1.500.000đ.
- Then: `diligenceSalary = 0` (không âm) — giữ nguyên công thức `max(0, diligenceAllowance − min(tongPhat, diligenceAllowance))`, không bị ảnh hưởng bởi thay đổi ở Nhóm 1 (nguồn `diligenceAllowance` vẫn đọc `ATTENDANCE_ALLOWANCE`, tách biệt khỏi `FIXED_ALLOWANCE`/`BENEFIT_ALLOWANCE`).

**TC-blth-043 — Giảm trừ gia cảnh lớn hơn thu nhập → thuế = 0 (chỉ áp dụng HĐ dài hạn)**
- Given: `loai_hd = xac_dinh`, `grossIncome = 8.000.000đ`, `personalDeduction + dependentDeduction×N = 15.400.000đ` (2 người phụ thuộc).
- Then: `taxableIncome = max(0, 8.000.000 − 15.400.000 − BH) = 0` → `personalIncomeTax = 0`.

**TC-blth-044 — Kết hợp chéo: HĐ thử việc + tạm ứng lớn hơn thu nhập (regression mới×cũ)**
- Given: `loai_hd = thu_viec`, `grossIncome = 3.000.000đ` → `personalIncomeTax = round(3.000.000×10%) = 300.000đ` (cơ chế Nhóm 5, KHÔNG dùng `taxableIncome`/giảm trừ); đồng thời `adjustmentNetAmount = 4.000.000đ` (tạm ứng lớn).
- Then: `netTakeHomeSalary = 3.000.000 − BH − 300.000 − 4.000.000` = số âm đúng công thức, không bị ép về 0; xác nhận 2 cơ chế mới (Nhóm 5 + Nhóm 8 cũ) không xung đột nhau.

---

### Nhóm 9 (MỚI, 2026-09-10 rà soát lần 2) — Miễn thuế theo cờ `isTaxable=false` (Q-1, `ADR-010`) — ⚠️ GAP-QA-09, CHƯA final

> **Bối cảnh:** chủ dự án ra quyết định mới (truyền đạt qua orchestrator, giải quyết Q-1 mà Architect nêu trong `ADR-010`): hệ thống phải tôn trọng ô tick "chịu thuế TNCN" có sẵn (`SalaryItem.isTaxable`) — khoản phụ cấp cố định nào bị đánh dấu miễn thuế thì bị trừ khỏi thu nhập tính thuế, KHÔNG còn giới hạn ở 2 ngoại lệ cứng (OT vượt chuẩn, ăn trưa trong trần). **Tại thời điểm QA đọc lại `ADR-010` (bản cập nhật `2026-09-10 10:59`), file này VẪN liệt Q-1 là câu hỏi mở** với hành vi mặc định đang thiết kế là "bỏ qua" (mọi phụ cấp chịu thuế trừ ăn ca) — TRÁI với quyết định mới được truyền đạt cho QA. Nhóm 9 dùng quyết định MỚI (tôn trọng tick) làm giả định thiết kế test, đánh dấu rõ `GAP-QA-09` — **CẦN Architect cập nhật lại `ADR-010` xác nhận bằng văn bản trước khi coi Nhóm 9 là final**, đặc biệt tên field trả về và quy tắc chống trừ trùng với BR-dltl-027.
>
> **Công thức giả định (QA đề xuất, CHƯA xác nhận):**
> ```
> otherAllowanceTaxExemptAmount = Σ (giá trị SAU quy đổi công, tức phần đã cộng vào allowanceInPeriodTotal)
>     của mọi EmployeeSalaryItem có salaryItem.isTaxable = false VÀ isMealAllowance = false
>     (loại trừ khoản ăn trưa — tránh trừ trùng, xem quy tắc dưới)
>
> Nếu 1 khoản VỪA isMealAllowance=true VỪA isTaxable=false:
>     CHỈ áp 1 lớp — lớp trần luật định BR-dltl-027 (min(mealAllowanceAmount, hanMucMienThue)) THẮNG,
>     KHÔNG cộng thêm miễn toàn bộ theo isTaxable (tránh miễn vượt luật định 730k)
>
> thuNhapTruocGiamTru = grossIncome − otTaxExemptAmount − lunchAllowanceExemptAmount − otherAllowanceTaxExemptAmount
> ```

**TC-blth-045 — 1 khoản phụ cấp tick miễn thuế, không phải ăn trưa**
- Given: `luong_chinh = 12.000.000đ`; "Phụ cấp trách nhiệm" `1.000.000đ` (`FIXED_ALLOWANCE`, `MONTHLY_FIXED`, `isTaxable = false`, `isMealAllowance = false`); đủ công 26/26; không OT, không phụ cấp ăn trưa.
- Then: `fixedAllowanceTotal = 1.000.000đ`, `baseSalaryMonthly = 13.000.000đ`, `allowanceInPeriodTotal = 1.000.000đ` (VẪN được trả đầy đủ, vào `grossIncome` — KHÔNG bị trừ khỏi thực lĩnh) nhưng `otherAllowanceTaxExemptAmount = 1.000.000đ` → `thuNhapTruocGiamTru` giảm đúng `1.000.000đ` so với trường hợp không tick.

**TC-blth-046 — 2 khoản, 1 tick miễn thuế 1 không (chỉ đúng khoản tick mới bị trừ khỏi thuế)**
- Given: "Phụ cấp trách nhiệm" `1.000.000đ` (`isTaxable = false`) + "Phụ cấp điện thoại" `500.000đ` (`isTaxable = true`, mặc định); đủ công.
- Then: `allowanceInPeriodTotal = 1.500.000đ` (cả 2 khoản vẫn được trả đủ); `otherAllowanceTaxExemptAmount = 1.000.000đ` (CHỈ khoản tick) — phần `500.000đ` phụ cấp điện thoại VẪN nằm trong thu nhập tính thuế.

**TC-blth-047 — Phụ cấp ăn trưa VỪA tick `isTaxable=false` VỪA có trần 730k (chống trừ trùng 2 lớp)**
- Given: "Phụ cấp ăn trưa" `900.000đ/tháng` (`isMealAllowance = true`, `isTaxable = false`), đủ công 26/26.
- Then (theo giả định QA, `GAP-QA-09` chưa final): `mealAllowanceAmount = 900.000đ`, `hanMucMienThue = 730.000đ`, `lunchAllowanceExemptAmount = 730.000đ`, `lunchAllowanceTaxableAmount = 170.000đ` — **KHÔNG được miễn toàn bộ `900.000đ` dù có tick `isTaxable=false`** (nếu code miễn toàn bộ 900.000đ là SAI luật BR-dltl-027, phải FAIL test này); `otherAllowanceTaxExemptAmount` KHÔNG cộng thêm cho khoản này.

**TC-blth-048 — Phụ cấp ăn trưa CHỈ tick `isMealAllowance`, KHÔNG tick `isTaxable=false` (mặc định chịu thuế)**
- Given: "Phụ cấp ăn trưa" `900.000đ`, `isMealAllowance = true`, `isTaxable = true` (mặc định).
- Then: trần 730k VẪN áp dụng y hệt TC-047 (`lunchAllowanceExemptAmount = 730.000đ`, `lunchAllowanceTaxableAmount = 170.000đ`) — xác nhận trần ăn trưa hoạt động ĐỘC LẬP với cờ `isTaxable` (không phải điều kiện áp dụng trần).

**TC-blth-049 — Regression: không khoản nào tick miễn thuế**
- Given: mọi khoản phụ cấp `isTaxable` mặc định (không set hoặc `true`).
- Then: `otherAllowanceTaxExemptAmount = 0` — hành vi giống hệt công thức gốc SRS/`ADR-010` khi Q-1 chưa "bật" cho khoản nào (không phá 44 test case gốc của Nhóm 1–8).

**TC-blth-050 — `SalaryStructureItem.taxTreatment` mâu thuẫn với `SalaryItem.isTaxable` (Q-2, `ADR-010`)**
- Given: `SalaryItem.isTaxable = true` (mặc định chịu thuế) NHƯNG cấu trúc lương đang active của nhân viên khai `SalaryStructureItem.taxTreatment = EXEMPT` cho khoản đó.
- Then (theo default `ADR-010` Q-2 "cấu trúc lương thắng"): khoản này VẪN được miễn thuế (theo `taxTreatment`, ghi đè `isTaxable` gốc) — `otherAllowanceTaxExemptAmount` cộng khoản này. *(Giả định — Q-2 chỉ phát sinh NẾU Q-1 chốt "có miễn", theo đúng ghi chú `ADR-010`; test này phụ thuộc `GAP-QA-09`.)*

---

## 4. Traceability nhanh

`BR-dltl-024…027` (chốt, SRS Mục 15.3.1) + `BR-dltl-028…029` (QA đề xuất, BA xác nhận nội dung hợp lệ nhưng KHÔNG cấp ID mới — SRS Mục 15.10, nội dung đã có sẵn ở Mục 15.4/15.6) + Q-1 (chủ dự án, qua orchestrator, **CHƯA có trong văn bản `ADR-010`** — `GAP-QA-09`) ↔ `TC-blth-001…050` (53 test case, 9 nhóm) ↔ `GAP-QA-01…09` (Mục 0: `01/02/05` **ĐÃ ĐÓNG**, `03/04/06/07/08` còn mở như lượt trước, `09` mới mở) ↔ `OQ-dltl-011` (RESOLVED, SRS Mục 15.8/15.10 + `ADR-010` bước [1]).

---

## 5. Khuyến nghị cho Architect (song song, không chặn phần không liên quan gap)

1. ✅ **Đã xong** — `api-contract-du-lieu-tinh-luong.md` + `data-model-du-lieu-tinh-luong.md` + `ADR-010` đã thiết kế đủ cho `BR-dltl-024…027`, khớp công thức Mục 15.3.1/15.4 của SRS.
2. ✅ **`GAP-QA-01`/`02` đã đóng** — Backend có thể code thẳng phần "Lương" (Nhóm 1) và "Phụ cấp ăn trưa" (Nhóm 6) theo `ADR-010` bước [1]/[2]/[5], không cần khoan lại như khuyến nghị lượt trước.
3. Endpoint `support-allowances` (Nhóm 7): response shape đã có ở `api-contract` Mục 8.2 — QA sẽ bổ sung assertion field-level cho Nhóm 7 ở lượt rà soát kế tiếp (ngoài phạm vi nhiệm vụ lần này).
4. **QUAN TRỌNG — cần xử lý trước khi Backend code phần Q-1:** `ADR-010` cần được cập nhật để chốt Q-1 theo đúng quyết định chủ dự án đã truyền đạt cho QA (tôn trọng tick `isTaxable`) — hiện văn bản `ADR-010` QA đọc được vẫn liệt Q-1 là "câu hỏi mở" với default "bỏ qua". Đây là **mâu thuẫn giữa nguồn chỉ đạo QA nhận được và văn bản ADR-010 hiện hành** — nếu Backend code theo default "bỏ qua" ghi trong ADR hiện tại, Nhóm 9 (6 test case) sẽ FAIL vì kỳ vọng sai. Cần đối soát lại và note rõ trong `ADR-010` (kèm tên field chính thức, thay `otherAllowanceTaxExemptAmount` QA tạm đặt) trước khi bàn giao cho Backend.

---

## 6. Open Questions dành cho BA/Architect (không tự đoán)

| Mã | Câu hỏi |
|---|---|
| GAP-QA-03 | Set lương sửa GIỮA kỳ (sau khi kỳ đã có dữ liệu, trước khi khóa sổ) — có cần lọc theo `effectiveFrom`/`effectiveTo` không, hay hành vi hiện tại (áp giá trị mới nhất) là chủ đích? |
| GAP-QA-04 | 2 trần bảo hiểm (BR-dltl-024): làm tròn từng phần (BHXH+BHYT riêng, BHTN riêng) rồi cộng, hay cộng trước rồi làm tròn 1 lần? |
| GAP-QA-06 | Ngưỡng "≥2.000.000đ/lần trả" (BR-dltl-026) — BA xác nhận field `thuNhapTruocGiamTru` (theo `ADR-010` bước [8]) là đúng cơ sở so sánh, hay có ý khác? |
| GAP-QA-07 | Response shape `GET /payroll/support-allowances` đã có ở `api-contract` Mục 8.2 — QA cần cập nhật lại Nhóm 7 với assertion field-level ở lượt kế tiếp, không phải câu hỏi mở nữa nhưng cần lịch làm. |
| GAP-QA-08 | Nhân viên không có khoản `BENEFIT_ALLOWANCE` nào — endpoint mới trả 1 dòng tổng=0 hay loại khỏi danh sách? |
| GAP-QA-09 *(mới)* | Q-1 (miễn thuế theo `isTaxable=false`) — Architect xác nhận lại bằng văn bản trong `ADR-010`: (a) tên field trả về chính thức, (b) quy tắc chống trừ trùng khi 1 khoản vừa `isMealAllowance=true` vừa `isTaxable=false` (QA giả định: chỉ áp trần luật định, không cộng thêm lớp `isTaxable`) — **bắt buộc phải trả lời trước khi Backend code Nhóm 9**, vì đổi trực tiếp số tiền thuế. |
