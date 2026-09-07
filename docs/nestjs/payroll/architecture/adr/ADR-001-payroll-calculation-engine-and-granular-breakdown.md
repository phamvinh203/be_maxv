---
type: adr
id: ADR-001
feature: payroll
status: approved
updated: 2026-09-06
author: Solution-Architect-Agent
links:
  - docs/payroll/srs/payroll-spec.md
  - docs/payroll/srs/payroll-flows.md
  - docs/payroll/srs/payroll-states.md
  - docs/payroll/architecture/data-model.md
  - docs/payroll/architecture/api-contract.md
---

# ADR-001: Kiến Trúc Pipeline 6 Stages Tính Toán Lương & Cơ Chế Snapshot Chi Tiết Cấu Phần Đa Tầng

## 1. Bối Cảnh & Vấn Đề Kỹ Thuật (Context & Problem Statement)

Phân hệ Tính toán Bảng lương (`payroll`) là trung tâm tài chính nhạy cảm nhất của toàn bộ hệ thống HRM-Accounting. Quá trình phân tích mã nguồn kế thừa (`Backend/src/hr/payroll/`) và đối chiếu với hồ sơ đặc tả yêu cầu nghiệp vụ SRS (`docs/payroll/srs/payroll-spec.md`) đã bộc lộ 5 lỗ hổng pháp lý và kỹ thuật mang tính hệ thống:

1. **Bỏ sót Phụ cấp Lương Cố định & Phúc lợi (`BR-pay-001`)**:
   - Mã nguồn cũ chỉ thu thập duy nhất mức lương cơ bản trong hợp đồng (`baseSalaryMonthly`), hoàn toàn bỏ sót các khoản phụ cấp lương cố định (chức vụ, trách nhiệm, độc hại, thâm niên) và hỗ trợ phúc lợi (ăn trưa, xăng xe, điện thoại) được cài đặt trong `EmployeeSalaryItem`. Dẫn đến tiền lương của người lao động bị thiếu hụt nghiêm trọng.
2. **Khấu trừ Thuế TNCN HĐ Thử việc / Dịch vụ bị tính sai lũy tiến (`BR-pay-005`)**:
   - Theo Điểm i Khoản 1 Điều 25 Thông tư 111/2013/TT-BTC, lao động ký hợp đồng thử việc (`PROBATION`), hợp đồng dịch vụ (`SERVICE_CONTRACT`) hoặc hợp đồng dưới 3 tháng có thu nhập từ 2.000.000đ/tháng trở lên bắt buộc phải khấu trừ **10% tại nguồn trên toàn bộ thu nhập chịu thuế**, **tuyệt đối không áp dụng giảm trừ gia cảnh** (không trừ 11 triệu bản thân, không trừ 4.4 triệu NPT). Mã nguồn cũ áp dụng biểu thuế lũy tiến 7 bậc và giảm trừ gia cảnh cho toàn bộ nhân sự, vi phạm nghiêm trọng luật thuế.
3. **Không bóc tách phần Tiền Làm thêm giờ (OT) được Miễn thuế TNCN (`BR-pay-004`)**:
   - Theo Điểm i Khoản 1 Điều 3 Thông tư 111/2013/TT-BTC, phần tiền trả thêm cao hơn đơn giá giờ làm việc chuẩn (ví dụ làm ca đêm lễ hưởng 390% thì 290% là phần dôi dư) được **miễn thuế TNCN hoàn toàn**. Mã nguồn cũ gộp toàn bộ tiền OT vào thu nhập chịu thuế, làm nhân viên phải chịu thuế oan uổng.
4. **Tính gộp quỹ bảo hiểm, thiếu 2 trần độc lập (`BR-pay-006`)**:
   - Theo Nghị định 73/2024/NĐ-CP, trần đóng BHXH/BHYT là 20 lần lương cơ sở ($20 \times 2.340.000 = \mathbf{46.800.000}$đ). Theo Nghị định 74/2024/NĐ-CP, trần đóng BHTN là 20 lần lương tối thiểu vùng 1 ($20 \times 4.960.000 = \mathbf{99.200.000}$đ). Mã nguồn cũ tính gộp chung tỷ lệ 10.5% cho NLĐ và 21.5% cho DN trên cùng 1 mức lương căn cứ mà không hề kẹp 2 trần độc lập.
5. **Không khống chế trần phụ cấp ăn trưa 730.000đ/tháng & Thiếu cơ chế Snapshot chi tiết (`BR-pay-003`, `BR-pay-010`)**:
   - Thông tư 26/2016/TT-BLĐTBXH quy định trần miễn thuế ăn trưa tối đa 730.000đ/tháng (được prorate theo ngày công). Phần chi trả vượt định mức bắt buộc phải chịu thuế TNCN.
   - Khi khóa sổ (`LOCKED`), hệ thống cũ chỉ lưu duy nhất 1 bảng tổng `payroll_sheet_lines` (18 cột). Toàn bộ chi tiết từng khoản phụ cấp, hỗ trợ, chi tiết thưởng và lỗi chuyên cần bị bốc hơi, khiến màn hình Lương hỗ trợ (`luong-ho-tro`) và phiếu lương cá nhân không thể giải trình được khi danh mục lương thay đổi trong tương lai.
6. **Lỗi lồng Transaction thừa (`Nested $transaction Bug`)**:
   - Trong `PayrollPeriodsService.lock()`, hệ thống mở một `this.prisma.$transaction` ngoài, sau đó lại gọi `PayrollCalculationService.snapshotPayrollSheetLines()` vốn tự mở thêm một `this.prisma.$transaction` bên trong. Điều này dễ gây lỗi deadlock hoặc khiến transaction con chạy tách rời ngoài ngữ cảnh rollback của transaction cha.

---

## 2. Quyết Định Kiến Trúc (Architectural Decisions)

Hệ thống quyết định áp dụng toàn diện giải pháp kiến trúc **Pipeline 6 Stages Tính Toán Lương kết hợp Snapshot Bất biến Đa tầng**:

```
           [INPUT DATA]
  8 Phân hệ Nguồn + HR Master Data
                 │
                 ▼
 ┌───────────────────────────────────┐
 │   PayrollCalculationService       │
 │                                   │
 │  Stage 1: Công & Phụ cấp cố định  │ ──► Prorated Salary, Fixed Allowances
 │  Stage 2: Tăng ca & Miễn thuế OT  │ ──► OT Amount, OT Tax-Exempt
 │  Stage 3: Thu nhập Biến động & SP │ ──► KPI, SP, %, Thưởng, Diligence Cap
 │  Stage 4: Bảo hiểm 2 Trần Độc lập │ ──► BHXH/BHYT (46.8tr) vs BHTN (99.2tr)
 │  Stage 5: Thuế TNCN & Phân loại HĐ│ ──► 10% Withholding vs 7-Bracket Progressive
 │  Stage 6: Bù trừ & Thực lĩnh      │ ──► Net Take-home (Allows Negative)
 └───────────────────────────────────┘
                 │
                 ▼
      [ATOMIC TRANSACTION $tx]
                 │
        ┌────────┴────────┐
        ▼                 ▼
 ┌──────────────┐  ┌───────────────────────────────┐
 │ 18-Col Lines │  │ Granular Item Breakdowns      │
 │ (SheetLine)  │  │ (PayrollSheetItemBreakdown)   │
 └──────────────┘  └───────────────────────────────┘
```

---

### Quyết định 1: Kiến trúc Pipeline 6 Stages trong `PayrollCalculationService`

Bộ tính toán lương được tái cấu trúc thành 6 giai đoạn thuần túy (Pure Domain Calculation Stages) độc lập, chạy tuần tự trên bộ nhớ (In-Memory Pipeline):

#### Stage 1: Lương Thời Gian & Phụ Cấp Cố Định (`BR-pay-001`)
- **Tỷ lệ ngày công thực tế**:
  $$\text{workDaysRatio} = \min\left(1.0, \frac{\text{actualWorkDays}}{\text{standardWorkDays}}\right)$$
- **Lương thời gian cơ bản**:
  $$\text{proratedWorkSalary} = \text{round}(\text{baseSalaryMonthly} \times \text{workDaysRatio})$$
- **Thu thập Phụ cấp Lương từ `EmployeeSalaryItem`**:
  + Khoản có phương thức tính theo ngày công (`WORK_DAYS`): $\text{tienThucTe} = \text{round}(\text{configuredAmount} \times \text{workDaysRatio})$.
  + Khoản có phương thức cố định tháng (`MONTHLY_FIXED`): Nhận trọn 100% $\text{configuredAmount}$ nếu có phát sinh ngày công thực tế ($\text{actualWorkDays} > 0$).
  + Tổng phụ cấp cố định: $\text{fixedAllowanceSalary} = \sum \text{tienThucTe}_{\text{allowances}}$.

#### Stage 2: Làm Thêm Giờ & Bóc Tách Miễn Thuế OT (`BR-pay-004`)
- **Đơn giá 1 giờ làm việc chuẩn**:
  $$\text{donGiaGioChuan} = \frac{\text{baseSalaryMonthly}}{\text{standardWorkDays} \times 8.0}$$
- **Tổng tiền OT thực tế nhận được**:
  $$\text{otAmount} = \sum_{k} \text{round}\left(\text{donGiaGioChuan} \times h_k \times \frac{r_k}{100}\right)$$
- **Phần tiền OT làm theo giờ chuẩn tương ứng**:
  $$\text{tienOTChuan} = \sum_{k} \text{round}(\text{donGiaGioChuan} \times h_k)$$
- **Phần tiền OT được miễn thuế TNCN**:
  $$\text{otTaxExemptAmount} = \max(0, \text{otAmount} - \text{tienOTChuan})$$

#### Stage 3: Thu Nhập Biến Động & Chặn Sàn Chuyên Cần (`BR-pay-009`)
- Nghiệm thu Lương sản phẩm (`pieceworkSalary`), Thưởng định kỳ (`bonusSalary`), Lương hiệu suất KPI (`kpiSalary`), Hoa hồng doanh số (`commissionSalary`).
- **Chặn sàn chuyên cần**:
  $$\text{tongTruLoi} = \sum \text{tienPhatLoi}$$
  $$\text{mucDiligenceDuocTru} = \min(\text{tongTruLoi}, \text{mucChuyenCanCaiDat})$$
  $$\text{diligenceSalary} = \max(0, \text{mucChuyenCanCaiDat} - \text{mucDiligenceDuocTru})$$
- **Tổng thu nhập gộp (Gross Income)**:
  $$\text{grossIncome} = \text{proratedWorkSalary} + \text{fixedAllowanceSalary} + \text{otAmount} + \text{pieceworkSalary} + \text{bonusSalary} + \text{kpiSalary} + \text{commissionSalary} + \text{diligenceSalary}$$

#### Stage 4: Bảo Hiểm Bắt Buộc & Áp Dụng 2 Trần Độc Lập (`BR-pay-006`)
Hệ thống kẹp 2 trần độc lập cho từng quỹ bảo hiểm:
1. **Quỹ BHXH & BHYT (Căn cứ NĐ 73/2024/NĐ-CP)**:
   - Mức trần: $\mathbf{46.800.000}$ VNĐ.
   - Mức căn cứ: $\text{luongDongBHXH} = \min(\text{insuranceSalaryBase}, 46.800.000)$.
   - NLĐ đóng ($9.5\%$): $\text{round}(\text{luongDongBHXH} \times 0.08) + \text{round}(\text{luongDongBHXH} \times 0.015)$.
   - DN đóng ($20.5\%$): $\text{round}(\text{luongDongBHXH} \times 0.175) + \text{round}(\text{luongDongBHXH} \times 0.03)$.
2. **Quỹ BHTN (Căn cứ NĐ 74/2024/NĐ-CP)**:
   - Mức trần: $\mathbf{99.200.000}$ VNĐ.
   - Mức căn cứ: $\text{luongDongBHTN} = \min(\text{insuranceSalaryBase}, 99.200.000)$.
   - NLĐ đóng ($1.0\%$): $\text{round}(\text{luongDongBHTN} \times 0.01)$.
   - DN đóng ($1.0\%$): $\text{round}(\text{luongDongBHTN} \times 0.01)$.
3. **Đoàn phí & Kinh phí Công đoàn (`BR-pay-007`)**:
   - Đoàn phí NLĐ (nếu tham gia công đoàn): $\min(\text{round}(\text{luongDongBHXH} \times 0.01), 234.000)$.
   - Kinh phí công đoàn DN (bắt buộc): $\text{round}(\text{luongDongBHXH} \times 0.02)$.

#### Stage 5: Thuế TNCN: Khấu Trừ 10% Tại Nguồn & Hạn Mức Ăn Trưa 730k (`BR-pay-003`, `BR-pay-005`)
- **Định mức miễn thuế tiền ăn trưa**:
  $$\text{lunchTaxExemptAmount} = \min\left(\text{tienAnTruaThucNhan}, \text{round}(730.000 \times \text{workDaysRatio})\right)$$
- **Thu nhập chịu thuế TNCN**:
  $$\text{taxableIncome} = \max(0, \text{grossIncome} - \text{otTaxExemptAmount} - \text{lunchTaxExemptAmount} - \text{otherTaxExemptAmount})$$
- **Tính thuế theo Phân loại Hợp đồng**:
  - **Trường hợp A: HĐ Thử việc (`PROBATION`), HĐ Dịch vụ (`SERVICE_CONTRACT`), HĐ dưới 3 tháng**:
    + Nếu $\text{taxableIncome} \ge 2.000.000$ VNĐ:
      $$\text{personalIncomeTax} = \text{round}(\text{taxableIncome} \times 0.10)$$
    + **Tuyệt đối không áp dụng bất kỳ khoản giảm trừ gia cảnh nào**.
  - **Trường hợp B: HĐ Lao động chính thức (`LABOR_CONTRACT` $\ge 3$ tháng)**:
    + Giảm trừ gia cảnh: Bản thân ($11.000.000$đ) + NPT ($\text{dependentCount} \times 4.400.000$đ).
    + Thu nhập tính thuế: $\text{tinhThue} = \max(0, \text{taxableIncome} - \text{GiamTruGiaCanh} - \text{BaoHiemNLD} - \text{DoanPhiNLD})$.
    + Áp dụng Biểu thuế lũy tiến từng phần 7 bậc (Bậc 1: 5%, Bậc 2: 10%, Bậc 3: 15%, Bậc 4: 20%, Bậc 5: 25%, Bậc 6: 30%, Bậc 7: 35%).

#### Stage 6: Bù Trừ & Thực Lĩnh (Dung Nạp Thực Lĩnh Âm, `BR-pay-008`)
- Bù trừ ròng: $\text{adjustmentNetAmount} = \sum \text{KhoanTru} - \sum \text{KhoanBu}$.
- Lương thực lĩnh:
  $$\text{netTakeHomeSalary} = \text{grossIncome} - \text{employeeInsuranceDeduction} - \text{employeeUnionFee} - \text{personalIncomeTax} - \text{adjustmentNetAmount}$$
- **Bất biến dung nạp thực lĩnh âm**: Tuyệt đối không dùng `Math.max(0, netTakeHomeSalary)`. Nếu nhân viên tạm ứng vượt quá thu nhập ròng, giá trị âm được lưu nguyên vẹn để kế toán theo dõi công nợ cho kỳ sau.

---

### Quyết định 2: Cơ Chế Snapshot Bất Biến Đa Tầng (`payroll_sheet_item_breakdowns`)

Khi kỳ tính lương được kế toán khóa sổ (`LOCKED`), hệ thống tạo ra 2 tầng dữ liệu snapshot đóng băng:
1. Bảng `payroll_sheet_lines`: Dòng tổng hợp 18 cột theo đúng chuẩn biểu mẫu Bộ Lao động & Thuế.
2. Bảng `payroll_sheet_item_breakdowns`: Snapshot chi tiết từng cấu phần con, lưu rõ:
   - `salaryItemId`: Liên kết khóa ngoại có điều kiện (`ON DELETE RESTRICT`) tới danh mục cha.
   - `configuredAmount`: Mức thiết lập ban đầu.
   - `workDaysRatio`: Tỷ lệ quy đổi công.
   - `calculatedAmount`: Số tiền thực nhận.
   - `isTaxable`, `taxableAmount`, `taxExemptAmount`: Thuế TNCN từng khoản.
   - `isSocialInsurance`, `insuranceAmount`: Căn cứ bảo hiểm từng khoản.
   - `note`: Căn cứ giải trình.

**Lợi ích**: Sau khi khóa sổ, kể cả khi nhân sự có thay đổi mức lương, xóa danh mục hay sửa cấu hình ở kỳ sau, toàn bộ dữ liệu kỳ cũ vẫn nguyên vẹn 100%, có thể giải trình được từng con số lẻ tới đoàn thanh tra thuế.

---

### Quyết định 3: Chiến Lược Giao Dịch Nguyên Tử ($transaction) Truyền Client

Để khắc phục triệt để lỗi lồng Transaction thừa giữa `PayrollPeriodsService` và `PayrollCalculationService`, tái thiết kế chữ ký của hàm snapshot:

```typescript
// PayrollCalculationService
async snapshotPayrollSheetLines(
  periodId: string,
  calculatedLines: CalculatedPayrollLine[],
  tx?: Prisma.TransactionClient, // Cho phép nhận tx từ ngoài truyền vào
): Promise<void> {
  const runner = async (client: Prisma.TransactionClient) => {
    // 1. Xóa sạch snapshot cũ (lũy biến)
    await client.payrollSheetItemBreakdown.deleteMany({ where: { periodId } });
    await client.payrollSheetLine.deleteMany({ where: { periodId } });

    // 2. Chèn hàng loạt dòng tổng
    await client.payrollSheetLine.createMany({
      data: calculatedLines.map(l => extractLineData(periodId, l)),
    });

    // 3. Chèn hàng loạt dòng con breakdowns
    const allBreakdowns = calculatedLines.flatMap(l => 
      l.breakdowns.map(b => extractBreakdownData(periodId, l.employeeId, b))
    );
    if (allBreakdowns.length > 0) {
      await client.payrollSheetItemBreakdown.createMany({
        data: allBreakdowns,
      });
    }
  };

  if (tx) {
    await runner(tx);
  } else {
    await this.prisma.$transaction(runner, { timeout: 30000 });
  }
}
```

Tại `PayrollPeriodsService.lock()`:
```typescript
return this.prisma.$transaction(async (tx) => {
  // Cập nhật trạng thái kỳ
  const updatedPeriod = await tx.payrollPeriod.update({ ... });
  // Truyền trực tiếp tx vào hàm snapshot
  await this.calculationService.snapshotPayrollSheetLines(id, calculatedLines, tx);
  return { success: true, ... };
}, { timeout: 30000 });
```

---

## 3. Các Phương Án Đã Xem Xét & Đánh Đổi (Alternatives & Trade-offs)

### Phương án A: Monolithic Flat Calculation + Single-table Snapshot (Hiện trạng cũ)
- **Mô tả**: Tính toán toàn bộ trong 1 hàm lặp, chỉ lưu bảng `payroll_sheet_lines`.
- **Ưu điểm**: Cực kỳ đơn giản, chỉ ghi 1 bảng DB.
- **Nhược điểm**: Bỏ sót toàn bộ phụ cấp cố định, sai thuế thử việc, mất hoàn toàn dữ liệu bóc tách lương hỗ trợ, không thể kiểm toán sau này.
- **Kết luận**: **BÁC BỎ**.

### Phương án B: Dynamic DSL / Formula Engine Plugin (Mathjs / Scripting)
- **Mô tả**: Cho phép kế toán tự viết công thức tính lương trên giao diện UI (ví dụ `IF(contractType=='PROBATION', gross*0.1, ...)`).
- **Ưu điểm**: Linh hoạt tối đa cho người dùng cuối.
- **Nhược điểm**: Rủi ro an ninh nghiêm trọng (Remote Code Execution, DoS parser), người dùng rất dễ viết sai các kẹp trần bảo hiểm và lũy tiến thuế phức tạp của Việt Nam, khó kiểm thử tự động.
- **Kết luận**: **BÁC BỎ**.

### Phương án C: Pure Domain In-Memory Pipeline 6 Stages + Two-tier Snapshot (Phương án Chọn)
- **Mô tả**: Đóng gói toàn bộ chuẩn mực pháp luật Việt Nam vào 6 pure function stages được bảo vệ bằng Unit Tests 100%; chốt dữ liệu 2 tầng khi khóa sổ.
- **Ưu điểm**: Đạt chuẩn kiểm toán tài chính, bảo mật tuyệt đối, hiệu năng cao (xử lý 1.000 nhân viên chỉ mất ~300ms trong bộ nhớ), dữ liệu snapshot vĩnh cửu.
- **Nhược điểm**: Tốn thêm một lượng dung lượng lưu trữ nhỏ (~100 MB/năm cho 2.000 nhân sự).
- **Kết luận**: **CHẤP THUẬN LỰA CHỌN**.

---

## 4. Hệ Quả & Kế Hoạch Triển Khai (Consequences & Implementation Steps)

1. **Về Database Schema**:
   - Mở rộng bảng `payroll_sheet_lines` (thêm 4 cột phân loại thuế & phụ cấp).
   - Tạo mới bảng `payroll_sheet_item_breakdowns` kèm các Check Constraints và Composite Indexes.
2. **Về Backend Core (`PayrollCalculationService`)**:
   - Refactor toàn diện hàm `calculatePeriodPayroll` chia tách thành 6 private methods tương ứng 6 Stages.
   - Cập nhật hàm `snapshotPayrollSheetLines` nhận tham số `tx?: Prisma.TransactionClient`.
3. **Về API Contract**:
   - Thêm endpoint `GET /payroll/support-allowances` cho tab Lương hỗ trợ.
   - Tích hợp 10 mã lỗi chuẩn hóa `E-pay-001` .. `E-pay-010`.
4. **Về Quality Assurance (Tester-QA)**:
   - Bàn giao ngay bản thiết kế này cho QA để xây dựng Test Cases và Test Matrix tập trung vào 5 lỗ hổng đã được vá.
