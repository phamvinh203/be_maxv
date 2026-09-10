---
type: adr
feature: hrm
status: accepted
updated: 2026-09-10
---

# ADR-010: Thứ tự tính thuế — bảo hiểm trong bộ máy Bảng lương tổng hợp

> Phạm vi: `be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollCalculation.service.ts`.
> Nguồn yêu cầu: `srs-du-lieu-tinh-luong.md` Mục 15 (`BR-dltl-024…027`, công thức + `AC-dltl-12…23` ở Mục 15.3.1, quyết định chủ dự án ở Mục 15.8).
> Mô hình dữ liệu: `data-model-du-lieu-tinh-luong.md` Mục 11 · Hợp đồng API: `api-contract-du-lieu-tinh-luong.md` Mục 8.

## Context

Bộ máy tính lương hiện chạy được nhưng tính **một mạch thẳng**: cộng hết mọi khoản thành `grossIncome`, trừ bảo hiểm bằng **một tỷ lệ gộp không trần**, rồi đưa **toàn bộ** phần còn lại qua biểu lũy tiến 7 bậc. Đối chiếu luật Việt Nam, BA chỉ ra bốn chỗ sai (`BR-dltl-024…027`) và tất cả đều **sai số tiền**, không phải sai hiển thị:

1. **Bảo hiểm không có trần** — BHXH+BHYT có trần 20 lần lương cơ sở (46.800.000đ, NĐ 73/2024), BHTN có trần 20 lần lương tối thiểu vùng (99.200.000đ vùng 1, NĐ 74/2024). Hai trần **khác gốc, khác mức**, hiện gộp làm một tỷ lệ duy nhất nhân thẳng vào `luong_bhxh`.
2. **Tăng ca bị tính thuế toàn bộ** — Điều 3 TT 111/2013 miễn thuế **phần trả cao hơn** đơn giá giờ thường. Engine giữ `convertedHours` (đã nhân hệ số) mà **không giữ `hours` gốc** trong kết quả, nên không còn dữ liệu để bóc tách.
3. **Hợp đồng thử việc/thời vụ áp nhầm phương pháp** — Điều 25 TT 111/2013 buộc khấu trừ thẳng 10%, không giảm trừ gia cảnh; engine luôn gọi biểu lũy tiến bất kể `loai_hd`.
4. **Không có chỗ áp trần ăn ca 730.000đ** — hệ quả của một khoảng trống lớn hơn: engine chưa đọc nhóm `FIXED_ALLOWANCE`/`BENEFIT_ALLOWANCE` của "Cài đặt lương".

Bốn quy tắc **không độc lập với nhau**: (2) và (4) làm giảm gốc tính thuế; (1) đổi số bảo hiểm mà bảo hiểm lại là một khoản **giảm trừ** của nhánh lũy tiến; (3) quyết định có dùng giảm trừ hay không. **Đặt sai thứ tự là ra số khác** — nên thứ tự phải chốt thành quyết định kiến trúc, không để mỗi người tự sắp.

Chủ dự án đã chốt hai dữ kiện nghiệp vụ (SRS Mục 15.8), ADR này **không được đổi**:

- **QĐ nghiệp vụ 1** — lương lấy từ `hrm_hop_dong` (`luong_chinh`/`luong_bhxh`) **cộng thêm** tổng phụ cấp cố định trong "Cài đặt lương". Hai tầng bổ sung nhau, không thay thế nhau (đóng `OQ-dltl-011`).
- **QĐ nghiệp vụ 2** — biểu thuế TNCN **giữ 7 bậc hiện hành** (giảm trừ 11tr / 4,4tr), `tinhThueLuyTien()` **không sửa**.
- **QĐ nghiệp vụ 3** *(chốt bổ sung 2026-09-10, trả lời `Q-1` do chính ADR này nêu)* — **ô tick "chịu thuế TNCN" ở màn "Khoản lương" phải có hiệu lực thật**: phụ cấp khai miễn thuế được trừ khỏi thu nhập tính thuế, **không** chỉ hai ngoại lệ cứng (ăn ca trong trần, OT vượt chuẩn) như bản nháp đầu. Chi tiết và ranh giới ở **QĐ-9**.

BA đã viết sẵn công thức và `AC-dltl-12…23`; Tester-QA đã viết 44 ca kiểm bám theo đó. Vai trò của ADR này là **quyết phần BA cố ý để mở** (đánh dấu "gap kỹ thuật cho Architect") và **chốt thứ tự** để bốn công thức rời ghép lại thành một pipeline chạy được.

## Decision

### Thứ tự pipeline — 10 bước, không đảo

```
[1] Nền lương 2 tầng     contractBaseSalary  = hop_dong.luong_chinh
                         fixedAllowanceTotal = Σ EmployeeSalaryItem.amount (mức THÁNG)
                                               với category ∈ {FIXED_ALLOWANCE, BENEFIT_ALLOWANCE}
                         baseSalaryMonthly   = contractBaseSalary + fixedAllowanceTotal  → cột UI "Lương"

[2] Quy đổi theo công    tyLeCong = min(actualWorkDays / standardWorkDays, 1)
                         proratedWorkSalary     = round(contractBaseSalary × tyLeCong)      // CHỈ hợp đồng
                         allowanceInPeriodTotal = Σ theo TỪNG khoản:
                             calculationMethod ∈ {ACTUAL_WORKDAYS, HOURLY} → round(amount × tyLeCong)
                             còn lại (MONTHLY_FIXED…)                      → amount

[3] Tăng ca              otHourlyRate = otBase / (standardWorkDays × standardHoursPerDay)
                         otBase = contractBaseSalary + Σ khoản có isOvertimeBase = true
                         otAmount   = Σ round(otHourlyRate × r.convertedHours)   (từng dòng OT)
                         otRawHours = Σ r.hours

[4] Gộp thu nhập         grossIncome = proratedWorkSalary + allowanceInPeriodTotal + otAmount
                                     + pieceworkSalary + bonusSalary + kpiSalary
                                     + commissionSalary + diligenceSalary

[5] Bóc MIỄN THUẾ        5a. PHÂN GIỎ từng khoản phụ cấp đã cộng ở [2] — mỗi khoản vào ĐÚNG MỘT giỏ,
    (trước bảo hiểm)         xét theo thứ tự, dừng ở giỏ đầu tiên khớp (QĐ-9):
                             (i)   isMealAllowance = true            → giỏ ĂN CA (bỏ qua ô tick)
                             (ii)  laKhoanMienThue(khoản) = true     → giỏ MIỄN THEO KHAI BÁO
                             (iii) còn lại                           → chịu thuế, không vào giỏ nào

                             laKhoanMienThue = (SalaryStructureItem.taxTreatment = EXEMPT)
                                            ∨ (SalaryItem.isTaxable = false)        // OR, xem QĐ-9.2

                             mealAllowanceAmount           = Σ giỏ (i)   // số tiền TRONG KỲ (sau [2])
                             otherAllowanceTaxExemptAmount = Σ giỏ (ii)  // số tiền TRONG KỲ (sau [2])

                         5b. otTaxExemptAmount = Σ max(0, round(otHourlyRate × r.convertedHours)
                                                       − round(otHourlyRate × r.hours))  // TỪNG dòng OT

                         5c. hanMucMienThue             = round(lunchAllowanceTaxFreeCap × tyLeCong)
                             lunchAllowanceExemptAmount = min(mealAllowanceAmount, hanMucMienThue)
                             lunchAllowanceTaxableAmount= mealAllowanceAmount − lunchAllowanceExemptAmount

                         5d. tongMienThue        = otTaxExemptAmount
                                                 + lunchAllowanceExemptAmount
                                                 + otherAllowanceTaxExemptAmount
                             thuNhapTruocGiamTru = grossIncome − tongMienThue

[6] HAI TRẦN BẢO HIỂM    capBhxhByt = min(insuranceSalaryBase, baseSalary      × 20)
    (độc lập nhau)       capBhtn    = min(insuranceSalaryBase, regionMinSalary × 20)
                         employeeInsuranceDeduction = round(capBhxhByt × (BHXH+BHYT)nv%)
                                                    + round(capBhtn    × BHTNnv%)
                         companyInsuranceExpense    = round(capBhxhByt × (BHXH+BHYT)ct%)
                                                    + round(capBhtn    × BHTNct%)
                         trich_bhxh = false ⇒ cả hai = 0 (giữ nguyên)

[7] Công đoàn            giữ nguyên công thức hiện tại. KHÔNG phải khoản giảm trừ thuế (QĐ-5)

[8] RẼ NHÁNH THUẾ        tinh_tncn ≠ true                        → thuế 0, withholdingTaxApplied = false
                         loai_hd ∈ {thu_viec, thoi_vu}:
                             thuNhapTruocGiamTru ≥ withholdingTaxThreshold
                                 → taxableIncome = thuNhapTruocGiamTru
                                    thuế = round(taxableIncome × withholdingTaxRate%)
                                    withholdingTaxApplied = true        // KHÔNG giảm trừ gia cảnh
                             ngược lại → thuế 0, withholdingTaxApplied = false   (AC-dltl-19)
                         còn lại (khong_xac_dinh | xac_dinh | khoan):
                             taxableIncome = max(0, thuNhapTruocGiamTru − personalDeduction
                                                  − dependentCount × dependentDeduction
                                                  − employeeInsuranceDeduction)
                             thuế = tinhThueLuyTien(taxableIncome)

[9] Thực lĩnh            netTakeHomeSalary = grossIncome − employeeInsuranceDeduction − employeeUnionFee
                                           − personalIncomeTax − adjustmentNetAmount   (cho phép ÂM)

[10] Chi phí công ty     totalCompanyCost = grossIncome + companyInsuranceExpense + companyUnionExpense
```

**Bốn ràng buộc thứ tự bắt buộc, vi phạm là sai số tiền:**

- **[5] trước [8]** — bóc miễn thuế xong mới tính thuế, ở **cả hai** nhánh. Nhánh 10% cũng chỉ khấu trừ trên phần chịu thuế, không trên `grossIncome` thô (BA đã trả lời `GAP-QA-05` đúng hướng này).
- **[6] trước [8]** — bảo hiểm là một trong ba khoản giảm trừ của nhánh lũy tiến.
- **[5] và [6] không đụng nhau** — gốc đóng bảo hiểm là `hop_dong.luong_bhxh` do hợp đồng ấn định, **không** phải thu nhập sau khi bóc miễn thuế.
- **[5a] phân giỏ LOẠI TRỪ NHAU (`mealAllowanceAmount` ∩ `otherAllowanceTaxExemptAmount` = ∅)** — đây là ràng buộc **mới và nguy hiểm nhất** của đợt này. Một khoản tiền cơm vừa `isMealAllowance = true` vừa được tick miễn thuế mà lọt vào **cả hai** giỏ sẽ được miễn hai lần: 900.000 (giỏ tick) + 673.846 (trần) = 1.573.846 miễn trên một khoản chỉ có 900.000 tiền thật. Hệ quả: thu nhập tính thuế hụt, thuế nộp thiếu, **sai theo hướng có lợi cho doanh nghiệp** ⇒ đúng loại sai bị truy thu. Bắt buộc hiện thực bằng `if/else if` trên **cùng một vòng lặp**, cấm hai vòng lặp độc lập cộng vào hai biến.

### QĐ-1 — Đơn giá giờ tăng ca tính trên `contractBaseSalary`, mở rộng bằng `isOvertimeBase`

BA cảnh báo đúng ở SRS Mục 15.4: `baseSalaryMonthly` nay gồm cả phụ cấp, để nguyên `otHourlyRate = baseSalaryMonthly / quỹ giờ` thì **tiền tăng ca tự phồng theo phụ cấp xăng xe, điện thoại, nhà ở**.

Chốt: `otBase = contractBaseSalary + Σ(khoản có SalaryStructureItem.isOvertimeBase = true)`.

Cột `isOvertimeBase` **đã tồn tại trong schema và chưa nơi nào dùng** — đúng nghĩa cần: kế toán khai khoản nào nằm trong gốc tính tăng ca. Mặc định mọi khoản là `false` ⇒ **hành vi mặc định bằng đúng đề xuất tối giản của BA** (chỉ lương hợp đồng), không có rủi ro lệch `AC-dltl-15`; công ty nào cần thì bật cờ, không phải sửa mã.

### QĐ-2 — Hệ số trần bảo hiểm là **hằng số có trích dẫn luật**, không thành cột cấu hình

Gốc tính (`baseSalary`, `regionMinSalary`) đã là cột `GeneralSetting`, nên nghị định đổi lương cơ sở là trần tự đúng theo. Riêng con số `20` nằm trong Luật BHXH Điều 89 và Luật Việc làm Điều 58 — không phải thứ từng công ty tự đặt. Thêm cột cho nó chỉ tạo thêm một đường để cấu hình sai. Giữ hai hằng số có docblock trích luật (`constants/hrm/du_lieu_tinh_luong/insuranceCaps.ts`). Khớp nhận định BA: "không cần field DB mới, chỉ cần tách logic".

**Ngược lại, ba con số tiền/thuế suất thì thành cột** (`lunchAllowanceTaxFreeCap`, `withholdingTaxRate`, `withholdingTaxThreshold`) — cùng nhóm với `personalDeduction`/`dependentDeduction`/`unionFeeMaxAmount` đã có. Ranh giới: **số tiền và thuế suất → cấu hình; quy tắc cấu tạo công thức → hằng số**. Đây là trả lời cho chỗ BA để mở ("Architect cân nhắc thêm field mới hoặc hardcode").

**Bắt buộc tính riêng rồi cộng**, không kẹp trần một lần rồi nhân tỷ lệ gộp: người lương 60tr đóng BHXH+BHYT trên 46,8tr nhưng BHTN vẫn trên **đủ 60tr** (`AC-dltl-13`).

### QĐ-3 — Nhận diện hợp đồng khấu trừ 10% bằng **bộ gom nhóm RIÊNG**, phạm vi đúng `{thu_viec, thoi_vu}`

`hrm_hop_dong.loai_hd` là **chữ tự do** `VarChar(24)`. Đã có `loaiHdVeNhanVien()` (`hopDong.service.ts:61`) gom 3 nhóm — **KHÔNG dùng lại được**: hàm đó xếp `thoi_vu` vào nhóm `hdld`, trong khi thuế cần `thoi_vu` **cùng nhóm** với `thu_viec`.

Khai hàm thứ hai, tên nói rõ mục đích: `laHopDongKhauTruTaiNguon(loai_hd)` → `true` cho `{thu_viec, thoi_vu}` sau khi `trim().toLowerCase()`. **`khoan` KHÔNG nằm trong nhóm** — BA chốt phạm vi này và ghi `khoan` + `xac_dinh` ngắn hạn thành `EC-dltl-06/07` chờ kế toán trưởng.

Docblock phải ghi rõ **vì sao không dùng chung** với `loaiHdVeNhanVien`, dẫn `BUG-HRM-27`: chỗ hỏng cũ là gom **ngầm** hai luật vào một hàm, không phải việc tồn tại hai hàm.

**Cấm dò chuỗi tiếng Việt** (`includes('thử việc')`) — cột lưu slug ASCII.

`tinh_tncn = false` là **công tắc tổng**, kiểm **trước** rẽ nhánh (đúng thứ tự BA viết ở Mục 15.3.1).

### QĐ-4 — Nhận diện khoản ăn ca bằng cờ `SalaryItem.isMealAllowance`

Chọn phương án (a) mà BA khuyến nghị: một cờ boolean đứng cạnh `isSocialInsurance`/`isTaxable` đã có. Bác (b) "quy ước theo `code`" — mã khoản do kế toán tự đặt, đổi mã là vỡ thầm lặng. Bác cả phương án enum `TaxExemptionRule` mà Architect cân nhắc lúc đầu: hiện chỉ có **đúng một** quy tắc trần cần mã hóa, enum đứng lệch khỏi lối đã có của chính bảng đó; khi luật thêm quy tắc trần thứ hai thì di trú `true → MEAL_ALLOWANCE` là cơ học.

**Trần được quy đổi theo công** (`AC-dltl-23`): `hanMucMienThue = round(730.000 × tyLeCong)`. Nhiều khoản cùng đánh cờ là hợp lệ — trần áp trên **tổng**, không áp từng khoản.

### QĐ-9 — Ô tick "chịu thuế TNCN" **có hiệu lực thật**; khoản ăn ca chỉ áp **một** lớp miễn

> **Nguồn quyết định:** chủ dự án chốt `Q-1` ngày **2026-09-10** theo phương án *"Tôn trọng ô tick đã có"*. Đây là dữ kiện nghiệp vụ, Architect không được đổi. Bản nháp trước của ADR này (chỉ miễn hai ngoại lệ cứng: ăn ca trong trần + OT vượt chuẩn) **đã bị thay thế**.
>
> Quyết định này mang số hiệu 9 vì bổ sung sau, nhưng **đặt cạnh QĐ-4** vì cùng chủ đề miễn thuế phụ cấp — đọc QĐ-4 rồi QĐ-9 là một mạch, tách ra hai đầu tài liệu sẽ khiến người sau chỉ đọc một nửa.

#### QĐ-9.1 — Khoản khai miễn thuế được trừ thật khỏi thu nhập tính thuế

Duyệt **từng** khoản phụ cấp đã cộng vào lương ở bước [2]; khoản nào khai miễn thì cộng vào `otherAllowanceTaxExemptAmount` và trừ khỏi gốc tính thuế ở bước [5d], **cùng nhóm** với miễn thuế ăn ca (trong trần) và miễn thuế OT (phần vượt chuẩn).

Vì sao phải làm: hai cột `SalaryItem.isTaxable` và `SalaryStructureItem.taxTreatment` **đang tồn tại, đang được giao diện cho nhập, và người dùng đang tin là nó có tác dụng** — `salaryItems.service.ts:32` phơi ra `chiu_thue_tncn`, `salaryStructures.service.ts:37` phơi ra `phan_loai: 'tncn' | 'mien_thue'`, cả hai đều có ô nhập trên màn hình. Để engine bỏ qua chúng nghĩa là **kế toán tick "miễn thuế" mà hệ thống vẫn tính thuế, không báo gì** — đúng loại sai lặng lẽ mà ADR này tồn tại để chặn.

**Phạm vi có giới hạn, ghi rõ để không hiểu rộng ra:** chỉ áp cho **phụ cấp cố định** đi vào `allowanceInPeriodTotal` (`EmployeeSalaryItem` thuộc `FIXED_ALLOWANCE` / `BENEFIT_ALLOWANCE`). **KHÔNG** áp cho thưởng (`BonusRecord`), lương phần trăm (`CommissionRecord`), KPI, lương sản phẩm, chuyên cần — dù các bảng đó cũng trỏ `SalaryItem` có cột `isTaxable`. Ba lý do: (a) chủ dự án nêu phạm vi đúng là "khoản phụ cấp cố định đã cộng vào lương"; (b) luật chỉ miễn thuế cho thưởng **kèm danh hiệu Nhà nước / giải thưởng quốc gia** (Điều 2 TT 111/2013), không phải thưởng doanh nghiệp thông thường — mở cờ miễn cho `PERIODIC_BONUS` là mời gọi khai sai; (c) giữ nguyên phạm vi = **không đổi một đồng nào** ở các cấu phần đó so với hôm nay, nên không phải viết lại `AC` hay ca kiểm nào của QA. Muốn mở rộng phải là quyết định nghiệp vụ riêng.

#### QĐ-9.2 — Chốt `Q-2`: `EXEMPT` **hoặc** `isTaxable = false` là đủ (phép **OR**, bất đối xứng có chủ đích)

```
laKhoanMienThue(khoản) = (structureItem?.taxTreatment === 'EXEMPT') || (salaryItem.isTaxable === false)
```

**Đây là đảo ngược mặc định ghi ở bản nháp trước** ("cấu trúc lương thắng"). Lý do phải đảo: `SalaryStructureItem.taxTreatment` có `@default(TAXABLE)` ở schema (`1261`) **và** `.default('TAXABLE')` ở validator (`salaryStructures.validator.ts:17`) ⇒ mọi dòng cấu trúc lương từng tạo ra đều mang `TAXABLE` **kể cả khi chưa ai nhìn tới ô đó**. Cho `TAXABLE` quyền phủ quyết nghĩa là ô tick ở màn "Khoản lương" tiếp tục vô hiệu trong **ca phổ biến nhất** — tức là chốt Q-1 trên giấy mà không có tác dụng thật.

Bất đối xứng nằm ở chỗ: **`EXEMPT` là khai báo có chủ đích** (kế toán phải chủ động chọn "Miễn thuế" ở màn Cấu trúc lương), còn **`TAXABLE` có thể chỉ là giá trị mặc định chưa ai đụng**. Không thể coi hai giá trị này ngang quyền. Cùng logic đó, `isTaxable` có `@default(true)` nên `true` cũng không phủ quyết được `EXEMPT`.

Khoản **không có** dòng trong cấu trúc lương hiệu lực của kỳ ⇒ chỉ xét `SalaryItem.isTaxable` (khớp Mục 11.5 của `data-model`: khoản thiếu dòng cấu trúc thì mặc định `MONTHLY_FIXED` + `isOvertimeBase = false` + theo `isTaxable`).

**Đánh đổi phải chấp nhận:** không còn cách nào khai "khoản này miễn thuế ở danh mục nhưng **chịu** thuế trong cấu trúc lương kỳ này". Đây là mất mát thật nhưng nhỏ: chưa có yêu cầu nghiệp vụ nào cần nó, và cách xử lý đúng là sửa ở danh mục. Đổi lại, quy tắc chỉ có một chiều nên không bao giờ phải giải thích với kế toán "vì sao tick rồi mà không ăn thua".

#### QĐ-9.3 — Khoản ăn ca áp **MỘT** lớp (trần thắng ô tick), tuyệt đối không cộng dồn

Câu hỏi thực tế, và là **ca phổ biến chứ không phải ca biên**: khoản "Phụ cấp tiền cơm" gần như luôn được kế toán tick miễn thuế (dữ liệu mẫu của chính dự án: `hdđt_maxv/src/features/hrm/mock/seed.ts:265` — `KL08` `chiu_thue_tncn: false`). Vậy khoản vừa `isMealAllowance = true` vừa khai miễn thì áp mấy lớp?

**Chốt: chỉ một lớp — quy tắc trần thắng.** Khoản `isMealAllowance = true` vào **giỏ ăn ca**, `isTaxable` / `taxTreatment` của chính nó bị **bỏ qua hoàn toàn**; miễn đúng `min(tổng ăn ca, 730.000 × tỷ lệ công)`, phần vượt chịu thuế.

Ba lý do, xếp theo sức nặng:

1. **Cộng dồn hai lớp là sai số học, không phải sai lựa chọn.** Miễn 900.000 (theo tick) rồi miễn tiếp 673.846 (theo trần) trên cùng một khoản 900.000 là miễn nhiều hơn số tiền thực có. Không có cách diễn giải nghiệp vụ nào cho ra kết quả đó.
2. **Cho tick thắng thì `BR-dltl-027` chết ngay khi ra đời.** Trần 730.000 vừa thiết kế xong sẽ không bao giờ chạy, vì khoản duy nhất nó áp vào lại là khoản luôn được tick miễn. Đồng thời công ty **khai thiếu thuế** đúng phần vượt trần — rủi ro truy thu, và hệ thống là bên tạo ra con số sai đó.
3. **Trần là quy tắc chuyên biệt có căn cứ luật cụ thể** (TT 26/2016, 730.000đ/tháng), ô tick là khai báo tổng quát do người dùng tự đặt. Quy tắc chuyên biệt thắng quy tắc tổng quát — cùng nguyên tắc đã dùng ở QĐ-3 (`laHopDongKhauTruTaiNguon` thắng cách gom nhóm tổng quát `loaiHdVeNhanVien`).

Hệ quả cần nói rõ với người dùng ở giao diện: với khoản đã đánh dấu "Khoản ăn ca", ô "chịu thuế TNCN" **không còn tác dụng** — nên hiển thị chú thích ngay tại chỗ ("Khoản ăn ca luôn miễn thuế tới trần 730.000đ/tháng theo quy định; phần vượt trần chịu thuế"), thay vì để kế toán tự phát hiện qua con số.

**Trường hợp ngược lại cũng đã chốt:** khoản `isMealAllowance = true` mà `isTaxable = true` **vẫn** được miễn tới trần. Miễn thuế ăn ca trong trần là quy định của luật, không phải tùy chọn của doanh nghiệp.

#### QĐ-9.4 — Một trường mới tên `otherAllowanceTaxExemptAmount`; **không** đổi tên trường đã công bố

Thêm **`otherAllowanceTaxExemptAmount`** (số tiền phụ cấp miễn thuế theo khai báo, **trong kỳ**, **không** gồm ăn ca) vào response và snapshot.

**Lấy đúng tên Tester-QA đã đặt** trong `test-matrix-bang-luong-tong-hop.md` Nhóm 9 (`TC-blth-045…050`, viết cùng ngày khi QA nhận quyết định `Q-1` song song với Architect). Đây là câu trả lời chính thức cho `GAP-QA-09` mục (a). Ba lý do:

1. **QA đã viết 6 ca kiểm bám vào tên đó** — đặt tên khác là bắt viết lại, đúng thứ chính ADR này viện dẫn để không đổi tên trường khác. Áp cùng nguyên tắc cho mình.
2. **Cùng họ hậu tố với hai cấu phần miễn thuế đang có**: `otTaxExemptAmount` · `lunchAllowanceExemptAmount` · `otherAllowanceTaxExemptAmount`. Ba dòng cộng lại ra `tongMienThue`, đọc là biết cùng nhóm.
3. **Chữ `other` mã hóa luôn ràng buộc loại trừ ngay trong tên** — "khoản KHÁC", tức không gồm ăn ca. Một tên kiểu `nonTaxableAllowanceTotal` đọc ra là "tổng mọi phụ cấp miễn thuế" và sẽ dụ người sau cộng cả ăn ca vào — đúng cái bẫy cộng đôi ở QĐ-9.3.

`GAP-QA-09` mục (b) — quy tắc chống trừ trùng — QA giả định "chỉ áp 1 lớp, trần luật định thắng". **Giả định đó đúng**, nay thành QĐ-9.3 chính thức. Nhóm 9 của QA có thể chuyển từ "chưa final" sang "final" mà không phải sửa số liệu ca nào.

Đã cân nhắc và **bác** phương án đổi `lunchAllowanceTaxableAmount` thành tên khái quát hơn: hai trường mang **hai nghĩa ngược nhau** (`lunchAllowanceTaxableAmount` là phần **vượt trần phải chịu thuế**, không phải phần miễn) — dùng lại tên cho nghĩa khác là cách chắc chắn nhất để Backend cộng nhầm dấu. Ngoài ra QA đã viết `AC-dltl-21/23` và bộ ca kiểm bám vào tên cũ.

Tổng miễn thuế nay có **ba** cấu phần, tất cả đều xuất hiện tường minh trong response để giải trình được từng đồng:

```
tongMienThue = otTaxExemptAmount + lunchAllowanceExemptAmount + otherAllowanceTaxExemptAmount
```

### QĐ-5 — Đoàn phí công đoàn **không** phải khoản giảm trừ thuế

Bản mock Frontend (`calculations/bang_luong/bangLuong.ts:169`) cộng `congDoan` vào giảm trừ khi tính thuế. Điều 9 TT 111/2013 chỉ cho trừ: giảm trừ gia cảnh, **bảo hiểm bắt buộc**, quỹ hưu trí tự nguyện, đóng góp từ thiện/nhân đạo/khuyến học. Đoàn phí công đoàn **không** trong danh sách. Engine giữ đúng như hiện nay (không trừ) — khớp công thức BA viết ở Mục 15.3.1; **Frontend phải sửa mock cho khớp**, không phải ngược lại.

### QĐ-6 — **Hoãn** việc nối biểu thuế vào `GeneralSetting.taxBrackets` (ghi nợ, không làm trong đợt này)

Hiện có hai nguồn biểu thuế song song: `tinhThueLuyTien()` hardcode 7 bậc trong engine, và cột `GeneralSetting.taxBrackets` (JSONB) đã có validator `E-hrm-080/081/082`, đã có `restore-default`, đã được Frontend đọc — nhưng **backend chưa bao giờ đọc**. Hệ quả thực tế: **kế toán sửa biểu thuế trong "Cấu hình mặc định" thì bảng lương không đổi một đồng, và không có gì báo.**

Chủ dự án vừa chốt "`tinhThueLuyTien()` GIỮ NGUYÊN, không sửa biểu thuế" (SRS 15.8). Nối nguồn đọc **không** đổi con số với công ty chưa từng sửa cấu hình, nhưng **có** đổi với công ty đã sửa — đó là thay đổi hành vi nằm ngoài phạm vi bốn `BR` đợt này. Vì vậy: **giữ hardcode, ghi thành nợ 🟠**, đề xuất làm ở đợt riêng kèm hai điều kiện — (a) BA xác nhận công ty đã sửa biểu thuế sẽ thấy số đổi; (b) biểu dưới 2 bậc phải **ném lỗi**, tuyệt đối không trả thuế 0 im lặng (Frontend đã áp đúng nguyên tắc này qua `LOI_BIEU_THUE_KHONG_DU_BAC`).

### QĐ-7 — Snapshot lưu cả căn cứ, không chỉ số tiền

15 cột mới của `hrm_payroll_sheet_lines` (xem `data-model` Mục 11.4), gồm `insuranceCapAppliedBhxhByt`/`insuranceCapAppliedBhtn`, `withholdingTaxApplied`, `otherAllowanceTaxExemptAmount`, `engineVersion`. Bảng lương đã khóa là chứng từ giải trình thuế: phải trả lời được "vì sao người này 10%, người kia lũy tiến", "vì sao lương đóng bảo hiểm 60tr mà chỉ trừ trên 46,8tr" **từ chính snapshot**, không phải tính lại bằng cấu hình của hôm nay.

Kỳ đã `LOCKED` **không tính lại** theo công thức mới — dòng cũ `engineVersion = "v1"`, dòng mới `"v2"`.

### QĐ-8 — Một hàm quy đổi phụ cấp dùng chung cho 2 endpoint

`GET /payroll/calculate` và `GET /payroll/support-allowances` cùng quy đổi phụ cấp theo công. Tách `tinhKhoanPhuCapTheoKy()` cho cả hai gọi, **cấm chép công thức lần hai**: tab "Lương hỗ trợ" bóc tách phần **đã nằm trong** cột "Thu nhập" của tab kia — người dùng chắc chắn cộng thử, lệch một đồng là mất niềm tin vào cả bảng lương.

## Alternatives

| Phương án | Vì sao bác |
|---|---|
| **Bóc miễn thuế SAU khi trừ giảm trừ gia cảnh** | Sai luật: khoản miễn thuế không bao giờ vào thu nhập chịu thuế. Làm sau thì với người thu nhập thấp phần miễn biến mất vô hại, với người thu nhập cao lại tính thuế nhầm — sai **không đều**, khó phát hiện |
| **Kẹp một trần chung 46,8tr cho cả ba loại bảo hiểm** | Đơn giản hơn nhưng sai luật rõ ràng: người lương 60–99tr sẽ **đóng thiếu** BHTN (`AC-dltl-13` bắt đúng ca này) |
| **Cộng tổng OT rồi mới bóc miễn thuế** (thay vì từng dòng) | Lệch vài đồng do làm tròn so với `AC-dltl-15/17` mà QA đã viết theo từng dòng. Không có lợi ích bù lại |
| **Dò tên khoản để tìm phụ cấp ăn ca** | Tên khoản là chữ tự do, mỗi công ty gọi một kiểu ("Tiền cơm ca", "PC ăn trưa", "Hỗ trợ bữa ăn"), có dấu/không dấu. Vừa sót vừa dính nhầm, và **sai lặng lẽ đúng chỗ tiền thuế**. Tiền lệ hỏng đã ghi trong `docs/nestjs/payroll` |
| **Bỏ qua `isTaxable`/`taxTreatment`, chỉ miễn 2 ngoại lệ cứng** *(bản nháp đầu của chính ADR này)* | Chủ dự án đã bác (QĐ nghiệp vụ 3). Để nguyên thì ô tick trên giao diện là nút giả — kế toán khai miễn thuế mà hệ thống vẫn tính thuế và không báo gì |
| **Cấu trúc lương phủ quyết danh mục** (`taxTreatment` thắng tuyệt đối) — *mặc định ghi ở bản nháp trước* | `taxTreatment` có `@default(TAXABLE)` ở cả schema lẫn validator ⇒ mọi dòng cấu trúc chưa ai đụng tới đều mang `TAXABLE` ⇒ ô tick tiếp tục vô hiệu đúng trong ca phổ biến nhất. Chốt Q-1 trên giấy nhưng không có tác dụng thật (QĐ-9.2) |
| **Cộng dồn hai lớp miễn cho khoản ăn ca** (miễn theo tick **cộng** miễn theo trần) | Sai số học: miễn 1.573.846 trên một khoản chỉ có 900.000 tiền thật. Không có cách diễn giải nghiệp vụ nào ra kết quả đó (QĐ-9.3) |
| **Ô tick thắng trần với khoản ăn ca** (tick miễn ⇒ miễn trọn) | `BR-dltl-027` chết ngay khi ra đời: trần 730k không bao giờ chạy vì khoản duy nhất nó áp vào lại luôn được tick miễn. Kèm theo là khai thiếu thuế đúng phần vượt trần |
| **Áp `isTaxable` cho cả thưởng / hoa hồng / KPI / lương sản phẩm** | Vượt phạm vi chủ dự án chốt; luật chỉ miễn thưởng kèm danh hiệu Nhà nước, không phải thưởng doanh nghiệp. Mở cờ miễn cho `PERIODIC_BONUS` là mời gọi khai sai, và làm đổi số ở các cấu phần vốn không thuộc 4 `BR` đợt này |
| **Đổi tên `lunchAllowanceTaxableAmount` thành tên khái quát** cho phần miễn thuế mới | Hai trường nghĩa **ngược nhau** (một bên là phần **chịu** thuế vượt trần, một bên là phần **miễn**). Dùng lại tên cho nghĩa khác là cách chắc chắn nhất để Backend cộng nhầm dấu, và bắt QA viết lại `AC-dltl-21/23` mà không được gì |
| **Đặt tên mới kiểu `nonTaxableAllowanceTotal`** thay vì lấy tên QA đã dùng | Bắt QA sửa 6 ca kiểm vừa viết; lệch khỏi họ hậu tố `*ExemptAmount` của hai cấu phần miễn thuế đang có; và tên đó đọc ra là "tổng **mọi** phụ cấp miễn thuế" nên dụ người sau cộng cả ăn ca vào — đúng bẫy cộng đôi (QĐ-9.4) |
| **Thêm `category` mới `MEAL_ALLOWANCE`** | Trộn hai trục: `category` trả lời "thuộc nhóm nghiệp vụ nào" (quyết định cách tính), cờ ăn ca trả lời "miễn thuế theo quy tắc nào". Khoản ăn ca vẫn phải là `BENEFIT_ALLOWANCE` để tab "Lương hỗ trợ" gom đúng — đổi `category` sẽ làm nó rơi khỏi tab đó |
| **Lưu thẳng số tiền trần bảo hiểm vào cấu hình** | Sửa `baseSalary` mà quên sửa trần là sai âm thầm — đúng bệnh `unionFeeMaxAmount = 234.000` đang mắc |
| **Gộp `laHopDongKhauTruTaiNguon` vào `loaiHdVeNhanVien`** | Hai luật khác nhau (`thoi_vu` khác nhóm ở mỗi luật). Gộp là tái lập đúng `BUG-HRM-27` |
| **Nối `taxBrackets` ngay trong đợt này** | Đổi hành vi với công ty đã sửa cấu hình, nằm ngoài 4 `BR` — trộn hai loại thay đổi vào một đợt thì khi số sai không biết do đâu (QĐ-6) |
| **Tính lại toàn bộ snapshot cũ theo công thức mới** | Kỳ đã chốt là tiền đã chi và thuế đã kê khai. Tính lại làm lệch sổ sách với thực tế đã xảy ra |

## Trade-offs

**Được:**
- Bốn quy tắc pháp lý thực hiện đúng; bảng lương đã khóa **tự giải thích được** khi bị thanh tra.
- Ba cột nằm chết trong schema (`isOvertimeBase`, và nay `isMealAllowance`, `engineVersion`) được dùng đúng mục đích.
- **Hai cột đang bị engine bỏ qua (`isTaxable`, `taxTreatment`) nay có hiệu lực thật** — giao diện không còn hứa suông (QĐ-9).
- Bộ 44 ca kiểm của QA **không phải sửa kỳ vọng** ở phần đã viết: mọi khoản mặc định `isTaxable = true` / `taxTreatment = TAXABLE` ⇒ `otherAllowanceTaxExemptAmount = 0` ⇒ công thức thu về đúng bản BA viết ở SRS 15.3.1. Chỉ **thêm** ca cho nhánh miễn thuế mới, không viết lại ca cũ.

**Mất / phải chấp nhận:**
- **Pipeline dài và khó đọc hơn** — từ một mạch thẳng thành 10 bước có rẽ nhánh. Bù bằng cách giữ đúng thứ tự khối trong mã như sơ đồ và chú thích số bước.
- **Số tiền hiển thị đổi ngay sau khi triển khai** với mọi công ty đã nhập "Cài đặt lương" (cột "Lương" tăng bằng tổng phụ cấp). Hệ quả trực tiếp của QĐ nghiệp vụ 1 — **phải báo trước cho người dùng**.
- **Phụ thuộc kế toán đánh dấu khoản ăn ca.** Chưa đánh ⇒ trần không áp ⇒ hành vi như cũ. Đổi lại: hệ thống không đoán hộ, không dán nhãn sai cho dữ liệu của khách.
- **Thuế TNCN của công ty đã tick miễn thuế sẽ GIẢM ngay sau khi triển khai** (QĐ-9.1). Đây là hệ quả trực tiếp của quyết định chủ dự án, **không phải lỗi** — nhưng phải báo trước cho người dùng cùng với thay đổi cột "Lương" (B-1), vì hai thứ xuất hiện cùng lúc và kế toán sẽ hỏi.
- **Ô tick "chịu thuế TNCN" mất tác dụng với khoản đã đánh dấu ăn ca** (QĐ-9.3). Giao diện phải nói rõ tại chỗ, nếu không kế toán sẽ báo là lỗi.
- **Không khai được "miễn ở danh mục nhưng chịu thuế ở cấu trúc lương kỳ này"** — hệ quả của phép OR ở QĐ-9.2. Chưa có yêu cầu nghiệp vụ nào cần, cách xử lý đúng là sửa ở danh mục.
- **Thêm 15 cột vào bảng snapshot** (~27% payload mỗi lần khóa sổ). Chấp nhận: bảng chỉ ghi lúc khóa sổ, mỗi kỳ một lần.
- **Hai hàm gom nhóm `loai_hd` cùng tồn tại** — nguy cơ người sau sửa một mà quên hàm kia. Giảm bằng docblock chéo, không bằng cách gộp.
- **Nợ `taxBrackets` còn nguyên** (QĐ-6): sửa biểu thuế trong cấu hình vẫn là thao tác không có tác dụng, im lặng.

## Consequences

**Bắt buộc làm cùng một lượt** (thiếu một phần là hỏng hoặc vô dụng):

1. `prisma/tenant/schema.prisma` — **19 cột** (3 `GeneralSetting`, 1 `SalaryItem`, **15** `PayrollSheetLine`), rồi `npm run generate` + `npm run sync:tenants` (10 tenant).
2. `payrollCalculation.service.ts` — pipeline 10 bước + `getSupportAllowanceBreakdown()` + `tinhKhoanPhuCapTheoKy()` + `laHopDongKhauTruTaiNguon()` + `laKhoanMienThue()`.
   > 🔴 `tinhKhoanPhuCapTheoKy()` phải trả về **từng khoản kèm nhãn phân giỏ** (`ăn ca` / `miễn theo khai báo` / `chịu thuế`), không chỉ trả một con số tổng — nếu không, bước [5a] buộc phải duyệt lại danh sách lần hai và đó chính là chỗ sinh ra lỗi cộng đôi.
   > 🔴 `snapshotPayrollSheet()` đẩy **nguyên object** vào `createMany`. Thêm field mà thiếu cột ⇒ **khóa sổ gãy**, trong khi `GET /payroll/calculate` vẫn chạy — lỗi chỉ lộ lúc kế toán bấm "Khóa sổ".
3. `payrollCalculation.route.ts` + `.controller.ts` — endpoint `GET /payroll/support-allowances` (bắt buộc `dbCoQuyenLuongPayroll`).
4. `generalSettings` — validator + `restore-default` + response cho 3 cột mới; `salaryItems` — CRUD cho `isMealAllowance`. Không làm thì **cột thêm ra không ai đặt được giá trị** (đúng bẫy ADR-007: "chặn được nhưng không cấp được").
5. Giao diện `Cài đặt lương › Khoản lương` — ô chọn "Khoản ăn ca (miễn thuế tới trần)", kèm chú thích ngay tại chỗ rằng ô này **vô hiệu hóa** ô "chịu thuế TNCN" của cùng khoản (QĐ-9.3).

**Kéo theo:**
- `docs/hrm/architecture/api-contract.md` Mục 7D.0 và `docs/hrm/cai_dat_luong/api-contract-cai-dat-luong.md` cập nhật (3 + 1 trường).
- QA thêm `E-hrm-083` (400 — thẩm định 3 cột cấu hình mới) vào ma trận lỗi. **Không** thêm mã `E-dltl-*` nào.
- **QA — `GAP-QA-09` đóng, Nhóm 9 chuyển "final".** `test-matrix-bang-luong-tong-hop.md` Nhóm 9 (`TC-blth-045…050`) đã viết đúng cả tên trường lẫn quy tắc chống trừ trùng ⇒ **không phải sửa số liệu ca nào**, chỉ gỡ nhãn "CHƯA final" và cập nhật căn cứ trỏ về QĐ-9. Ba ca **nên thêm** cho các nhánh QĐ-9 mà Nhóm 9 chưa phủ: (a) `taxTreatment = EXEMPT` nhưng `isTaxable = true` ⇒ **vẫn miễn** (phép OR — QĐ-9.2); (b) khoản `isMealAllowance = true` mà `isTaxable = true` ⇒ **vẫn miễn tới trần** (QĐ-9.3); (c) khoản `PERIODIC_BONUS` / `COMMISSION_PERCENTAGE` có `isTaxable = false` ⇒ **vẫn chịu thuế** (ranh giới phạm vi QĐ-9.1). Bộ ca cũ **không phải sửa**: mặc định `isTaxable = true` cho ra đúng số cũ.
- Frontend sửa mock: bỏ đoàn phí khỏi giảm trừ thuế (QĐ-5); map `gio_tang_ca ← otRawHours`, `thu_nhap_chiu_thue` suy từ **4** trường, `luong_theo_ngay ← proratedWorkSalary + allowanceInPeriodTotal`. Phần miễn thuế phụ cấp của mock (`mock/hooks/bangLuong.ts:154`) nay **khớp** engine về nguyên tắc, chỉ khác ở chỗ mock chưa áp trần 730k cho khoản ăn ca.
- `srs-du-lieu-tinh-luong.md` Mục 15.3.1 nên ghi nhận 4 điểm ADR này chốt thay cho chỗ để mở: cờ `isMealAllowance`, hằng số hệ số trần, `withholdingTaxThreshold`/`withholdingTaxRate` thành cột cấu hình, và **bước [5a] phân giỏ miễn thuế theo QĐ-9** (công thức Mục 15.3.1 hiện chưa có bước này — BA cập nhật khi Final Sign-off).

**Không đụng trong đợt này** (ghi để khỏi tưởng đã xong): 🟠 `A-06` (Decimal ra chuỗi ở nhánh snapshot) · `A-04`, `A-05`, `A-08` · `@@index([periodId])` dư thừa · `unionFeeMaxAmount` lưu số tuyệt đối · nợ `taxBrackets` (QĐ-6) · `OQ-dltl-005` (cộng dồn trần OT theo năm) · `OQ-dltl-010` (thêm `PENDING_REVIEW` vào guard chỉ-đọc của 8 phân hệ — việc nhỏ, độc lập, nên làm ở phiên khác).

## Câu hỏi đã chốt & còn mở

### Đã chốt (2026-09-10)

| # | Mức | Câu hỏi | Kết luận | Ghi ở đâu |
|:--:|:--:|---|---|---|
| Q-1 | 🔴 | Khoản phụ cấp khai `isTaxable = false` / `taxTreatment = EXEMPT` có được miễn thuế không? | ✅ **CÓ — chủ dự án chốt phương án "Tôn trọng ô tick đã có"** (2026-09-10). Khoản khai miễn được trừ thật khỏi thu nhập tính thuế, cùng nhóm với ăn ca trong trần và OT vượt chuẩn. Phạm vi giới hạn ở **phụ cấp cố định**; thưởng/hoa hồng/KPI/lương sản phẩm/chuyên cần **giữ nguyên là chịu thuế** | **QĐ-9.1** · bước **[5a]/[5d]** · trường mới `otherAllowanceTaxExemptAmount` |
| Q-2 | 🟡 | Ưu tiên `taxTreatment` hay `isTaxable` khi hai bên khai ngược nhau? | ✅ **Phép OR — `EXEMPT` *hoặc* `isTaxable = false` là đủ.** Architect chốt, **đảo ngược** mặc định "cấu trúc lương thắng" ghi ở bản nháp trước, vì `taxTreatment` có `@default(TAXABLE)` nên `TAXABLE` không phải khai báo có chủ đích | **QĐ-9.2** |
| Q-1b | 🔴 | *(phát sinh từ Q-1)* Khoản vừa `isMealAllowance = true` vừa khai miễn thuế thì áp mấy lớp? | ✅ **Một lớp — trần thắng ô tick.** Hai giỏ miễn thuế **loại trừ nhau**, cấm cộng dồn | **QĐ-9.3** · ràng buộc thứ tự thứ 4 |
| `GAP-QA-09` | 🔴 | Tester-QA hỏi Architect 2 điểm: (a) tên trường chính thức cho phần miễn thuế mới, (b) quy tắc chống trừ trùng | ✅ **ĐÓNG.** (a) lấy đúng tên QA đã đặt: **`otherAllowanceTaxExemptAmount`**; (b) giả định của QA ("chỉ 1 lớp, trần luật định thắng") **đúng**, nay là QĐ-9.3 chính thức. Nhóm 9 (`TC-blth-045…050`) chuyển sang **final**, không phải sửa số liệu ca nào | **QĐ-9.3** · **QĐ-9.4** |

### Còn mở

| # | Mức | Câu hỏi | Vì sao Architect không tự chốt | Mặc định đang thiết kế |
|:--:|:--:|---|---|---|
| Q-3 | 🟡 | Cột UI "Lương theo ngày" hiển thị **chỉ phần hợp đồng** (`proratedWorkSalary`, đúng SRS 15.5) hay **gồm cả phụ cấp đã quy đổi** (đúng bản mock FE)? | Hai tài liệu nghiệp vụ đang nói khác nhau; đây là quyết định hiển thị của người dùng cuối | API trả **cả hai trường** để không phải đổi hợp đồng khi chốt; FE mặc định cộng hai trường (khớp mock) |

Q-3 **không chặn** Backend: thuần hiển thị, hợp đồng API đã trả đủ cả hai trường nên chốt lúc nào cũng được, không phải sửa backend.

> **Hai vấn đề 🟠 đã nêu ở lượt trước, đối chiếu lại sau khi chốt Q-1 — kết luận GIỮ NGUYÊN, không bị ảnh hưởng:**
>
> 1. **Đoàn phí công đoàn bị bản mock FE trừ sai vào thu nhập tính thuế** (`calculations/bang_luong/bangLuong.ts:171` cộng `congDoan` vào `giamTru`). Q-1 mở rộng phạm vi **miễn thuế của phụ cấp**, không đụng tới **danh sách khoản giảm trừ** của Điều 9 TT 111/2013 — đoàn phí vẫn không nằm trong danh sách đó. **QĐ-5 giữ nguyên**: engine không trừ, Frontend phải sửa mock. (Đáng chú ý: cùng file mock đó lại **đúng** ở phần miễn thuế phụ cấp — `mock/hooks/bangLuong.ts:154` đọc `chiu_thue_tncn` — nên sau đợt này engine và mock hội tụ ở điểm miễn thuế nhưng vẫn lệch ở điểm đoàn phí. FE sửa đúng một chỗ.)
> 2. **`AC-dltl-19` gộp hai tình huống vào cùng `withholdingTaxApplied = false`** ("HĐ chính thức tính lũy tiến" và "HĐ thử việc dưới ngưỡng 2.000.000"). Q-1 đổi **gốc tính thuế**, không đổi **cách rẽ nhánh phương pháp** ở bước [8]. **Kết luận giữ nguyên**: không đổi giá trị cờ (QA đã bám vào), giao diện muốn hiện phương pháp tính phải xét thêm `contractType` — ghi ở `api-contract` Mục 8.1.2.
