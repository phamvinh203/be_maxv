---
type: adr
feature: hrm
status: accepted
updated: 2026-09-14
---

# ADR-013: Bất biến số thuế — snapshot hai tầng và tái dùng khóa bảng kê cho Bảng tính thuế tháng

## Context

`srs-to-khai-thue.md` để ngỏ hai điểm cho Architect, thực chất là hai mặt của **một** câu hỏi: *số thuế đã chốt phải bất biến bằng cách nào?*

- `A-tkt-09` `[ĐỀ XUẤT]` — cơ chế snapshot cho bản ghi thu nhập ngoài lương, để sửa danh mục về sau không làm đổi ngược số thuế của khoản đã ghi.
- `A-tkt-10` `[ĐỀ XUẤT]` — chốt/mở lại Bảng tính thuế tháng: tái dùng `hrm_payroll_module_locks` hay tạo bảng khóa riêng.

Ràng buộc từ thực tế mã nguồn (đã đối chiếu từng dòng):

| Sự thật | Nguồn |
|---|---|
| `PayrollSheetLine` đã là snapshot bất biến, **chỉ ghi khi khóa sổ**; kỳ còn mở thì tính trực tiếp | `schema.prisma:1721-1724` |
| `PayrollModuleLock` theo triết lý "**CÓ dòng = đã chốt, mở chốt là xóa dòng**", có `@@unique([periodId, module])` + `lockedByUserId` + `lockedAt` | `schema.prisma:1448-1461` |
| `PayrollModuleCode` **đã có** 12 giá trị, gồm cả `OTHER_INCOME` và `TAX_DEDUCTION` | `schema.prisma:1393-1406` |
| `lockAllPayrollModules` lặp `PAYROLL_MODULE_CODES` — danh sách 12 bảng kê **tách rời** enum Prisma | `payrollClosing.service.ts:145`, `constants/hrm/payrollModules.ts:25` |
| `payrollModuleParamsSchema = z.enum(PAYROLL_MODULE_CODES)` — endpoint khóa/mở bảng kê validate theo **danh sách hằng**, không theo enum Prisma | `payrollClosing.validator.ts:10` |
| `PieceworkRecord.unitPrice` / `CommissionRecord.commissionRate` chép cứng tham số danh mục vào bản ghi | `BR-dltl-014/016`, `schema.prisma:1597, 1622` |

Rủi ro cụ thể nếu không chốt: kế toán sửa tỷ lệ khấu trừ của một danh mục từ 10% xuống 5% vào tháng 11 ⇒ mọi khoản đã ghi từ tháng 1 **đổi số thuế ngược về quá khứ** ⇒ tờ khai Quý I đã nộp cho cơ quan thuế không còn khớp với dữ liệu nội bộ, và không ai biết chuyện đó đã xảy ra.

## Decision

### 1. Tầng bản ghi — snapshot **KẾT QUẢ**, không snapshot **THAM SỐ**

`hrm_other_income_records` thêm **3 cột**: `taxTreatmentGroup`, `exemptAmount` (phần miễn), `taxableAmount` (phần phải cộng lũy tiến). Cùng với 4 cột đã có (`grossAmount`, `netAmount`, `taxRate`, `taxDeducted`), bản ghi **tự mô tả đủ** kết quả xử lý thuế của chính nó.

**Không** chép `withholdingThreshold` / `exemptCapAmount` / `withholdingRate` của danh mục sang bản ghi. Lý do: Bảng tính thuế chỉ cần biết **"cộng bao nhiêu vào thu nhập lũy tiến"** và **"đã khấu trừ bao nhiêu"** — đó chính là `taxableAmount` và `taxDeducted`. Giữ tham số đầu vào chỉ để chạy lại một phép tính đã có sẵn kết quả là 5 cột làm công việc của 2 cột.

Hệ quả quan trọng: **Bảng tính thuế không bao giờ phải đọc bảng danh mục.** Sửa danh mục về sau không có bất kỳ đường nào chạm tới số cũ.

### 2. Tầng tháng — snapshot `hrm_tax_calculation_lines`, chỉ sinh khi CHỐT

Đúng khuôn `PayrollSheetLine`:

| Trạng thái tháng | Nguồn số liệu |
|---|---|
| Chưa chốt | **Không có dòng nào.** Tính trực tiếp mỗi lần đọc |
| Đã chốt | Đọc thẳng bảng. **Không** tính lại |

Mỗi dòng ghim `taxPolicyId` (ADR-012) + `engineVersion` + `lockedByUserId` + `lockedAt`.

### 3. Khóa tháng — tái dùng `hrm_payroll_module_locks`, thêm đúng một giá trị enum `TAX_SHEET`

- **0 bảng mới.** `@@unique([periodId, module])` chặn đua hai người cùng chốt; `lockedByUserId`/`lockedAt` phục vụ `NFR-tkt-003`.
- **`TAX_SHEET` CỐ Ý nằm ngoài `PAYROLL_MODULE_CODES`** ⇒ hai hàng rào có sẵn tự bảo vệ, không phải viết thêm dòng nào:
  - `lockAllPayrollModules` không đụng tới ⇒ nút "Chốt toàn kỳ" của màn Chốt kỳ lương **không** vô tình chốt Bảng tính thuế mà bỏ qua bước ghi snapshot.
  - `payrollModuleParamsSchema` từ chối `TAX_SHEET` ⇒ `POST /payroll-periods/:id/modules/TAX_SHEET/lock` trả **400 Zod**, không có lối khóa chui.
- Khóa/mở đi qua hai endpoint riêng (`POST /to-khai-thue/tax-calculation/{lock,unlock}`) để mỗi lần khóa đều nằm **cùng transaction** với việc ghi/xóa snapshot.

### 4. Ranh giới giao dịch

```
CHỐT  [TX] kiểm kỳ lương LOCKED+ -> tính -> deleteMany dòng cũ -> createMany dòng mới
           -> create lock TAX_SHEET
MỞ    [TX] kiểm quý chưa EXPORTED -> delete lock -> deleteMany dòng
```

Nhật ký (`ghiNhatKyKyLuong`) ghi **ngoài** transaction, tái dùng hạ tầng "Lịch sử hoạt động" đã có của màn Chốt kỳ lương (`GET /payroll-periods/:id/activities`).

### 5. Dòng Bảng tính thuế là **theo NGƯỜI**, khóa bằng `recipientKey`

`recipientKey` = `ma_nv` (nhân viên nội bộ) hoặc `'VL:' + lower(btrim(fullName))` (cá nhân vãng lai), với `@@unique([periodId, recipientKey])`.

Đây là chỗ **lệch có chủ đích** so với `srs-to-khai-thue.md` Mục 4.3 (đề xuất `otherIncomeRecordId` nullable): một cá nhân vãng lai có thể nhận **nhiều** khoản trong cùng tháng — chính `AC-tkt-008` khẳng định điều đó là hợp lệ — trong khi chỉ tiêu `[16]` của tờ khai đếm **số người lao động**. Khóa theo bản ghi sẽ đếm một người thành hai lao động và làm sai tờ khai nộp cho cơ quan thuế.

### 6. Bỏ cột `status` trên dòng Bảng tính thuế

`srs-to-khai-thue.md` Mục 4.3 đề xuất `status: DRAFT | LOCKED`. Nhưng bảng chỉ có dòng khi đã chốt ⇒ cột này **luôn** bằng `LOCKED`: một cột hằng số, và là một cột có khả năng lệch với sự thật (dòng khóa). Sự có mặt của dòng khóa `TAX_SHEET` là trạng thái duy nhất.

## Alternatives

**A. Bản ghi tham chiếu động tới danh mục, không snapshot gì.**
Bỏ. Đây chính là lỗi mà `BR-dltl-014/016` đã sinh ra để ngăn: sửa danh mục là đổi ngược số của chứng từ đã phát hành. Với chứng từ thuế đã nộp cho cơ quan nhà nước, mức độ nghiêm trọng cao hơn hẳn so với lương sản phẩm.

**B. Snapshot đầy đủ 5 tham số của danh mục vào bản ghi (đúng chữ `A-tkt-09`).**
Bỏ. Thêm 5 cột để rồi vẫn phải chạy lại công thức mỗi lần đọc Bảng tính thuế — trong khi kết quả của công thức đó đã bất biến ngay lúc ghi. Snapshot kết quả vừa ít cột hơn vừa loại bỏ hẳn khả năng hai lần tính ra hai số khác nhau (do sửa công thức, do làm tròn, do lỗi).

**C. Không có `hrm_tax_calculation_lines`, mỗi lần cần thì tính lại từ `PayrollSheetLine` + bản ghi thu nhập ngoài lương.**
Bỏ. Về lý thuyết tính lại được — mọi đầu vào đều đã đóng băng khi tháng chốt, và ADR-012 đã đóng băng cả biểu thuế. Nhưng:
1. Một lần sửa lỗi engine sẽ **âm thầm đổi** số thuế của các quý đã nộp; không có gì phát hiện.
2. Mở tờ khai quý phải chạy lại `calculatePayrollPreview` cho 3 tháng × toàn bộ nhân viên, mà hàm đó đọc 8 bảng phát sinh + master data mỗi lượt.
3. Đi ngược tiền lệ `PayrollSheetLine` cho cùng loại dữ liệu, ở mức ràng buộc pháp lý cao hơn.

**D. Bảng khóa riêng `hrm_tax_month_locks`.**
Bỏ. Nhân bản đúng cấu trúc `PayrollModuleLock` (periodId + ai khóa + khi nào + unique) chỉ để tránh thêm một giá trị enum. Hai bảng khóa cho cùng một kỳ lương là hai chỗ phải nhớ khi đọc trạng thái, và chắc chắn sẽ có ngày ai đó chỉ đọc một chỗ.

**E. Dùng lại giá trị `TAX_DEDUCTION` đã có sẵn thay vì thêm `TAX_SHEET`.**
Bỏ. `TAX_DEDUCTION` **đang nằm trong** `PAYROLL_MODULE_CODES` ⇒ nút "Chốt toàn kỳ" sẽ tạo dòng khóa mà **không** ghi snapshot ⇒ sinh trạng thái "đã chốt nhưng không có số liệu chốt", mà không công cụ nào hiện có (typecheck, lint, test) phát hiện được. Muốn dùng thì phải gỡ `TAX_DEDUCTION` khỏi danh sách 12 bảng kê — tức đổi hành vi một màn đã bàn giao và đã có test.

**F. Bảng đầu-chi tiết: thêm `hrm_tax_calculation_periods` (1 dòng/tháng) làm đầu.**
Bỏ. Một dòng mỗi tháng chỉ để giữ `status` + `lockedByUserId` + `lockedAt` — đúng ba thứ mà `PayrollModuleLock` đã có sẵn.

## Trade-offs

**Được:**
- Số thuế đã chốt bất biến ở **cả hai** tầng (bản ghi và tháng).
- Sửa danh mục an toàn tuyệt đối với dữ liệu cũ — không cần cảnh báo, không cần khóa danh mục.
- 0 bảng khóa mới; tái dùng nguyên `@@unique` chống đua và hạ tầng nhật ký đã có.
- Tờ khai quý đọc từ dữ liệu đã đóng băng ⇒ xuất lại bao nhiêu lần cũng ra một kết quả.

**Mất:**
- Một giá trị enum nằm ngoài danh sách hằng cùng tên — **phải ghi chú thật rõ trong schema**, vì người đọc sau này rất dễ "dọn dẹp" bằng cách thêm `TAX_SHEET` vào `PAYROLL_MODULES` và phá cả hai hàng rào cùng lúc.
- `hrm_tax_calculation_lines` là dữ liệu suy được nên về lý thuyết có thể lệch với nguồn nếu ai đó sửa tay CSDL (đánh đổi cố ý, giống hệt `PayrollSheetLine`).
- `recipientKey` cho vãng lai dựa trên **họ tên chuẩn hóa** ⇒ hai người **trùng tên** trong cùng một tháng sẽ bị gộp thành một dòng. Hạn chế đã biết; giảm thiểu bằng cảnh báo ở giao diện khi trùng tên mà khác CCCD — **chưa làm ở đợt này**, ghi ra để không quên.

## Consequences

- `schema.prisma`: thêm `model TaxCalculationLine`, thêm 3 cột vào `OtherIncomeRecord`, thêm `TAX_SHEET` vào `PayrollModuleCode`.
- **Cấm** thêm `TAX_SHEET` vào `constants/hrm/payrollModules.ts`. Nếu một đợt sau cần hiển thị Bảng tính thuế trên màn "Chốt kỳ lương", phải làm bằng một mục riêng đọc khóa `TAX_SHEET`, **không** bằng cách nhét vào danh sách 12 bảng kê.
- Guard chặn ghi thu nhập ngoài lương (`E-tkt-007`) kiểm **cả hai** khóa: `TAX_SHEET` (bảng tính thuế đã chốt) **hoặc** `OTHER_INCOME` (bảng kê đã chốt từ màn Chốt kỳ lương). Hai cơ chế cùng khóa một loại dữ liệu — đúng ý đồ, không được bỏ bớt vế nào.
- Mở lại tháng **xóa** dòng snapshot: mất dữ liệu có chủ đích và không hoàn tác được ⇒ endpoint yêu cầu `assertAdminOrOwner` + lý do ≥ 20 ký tự, cùng mức thẩm quyền với "Mở lại kỳ lương".
- Sau khi xuất tờ khai quý, 3 tháng trong quý **vĩnh viễn** không mở lại được (BR-tkt-015) ⇒ snapshot của 3 tháng đó trở thành bất biến tuyệt đối.
- QA phải phủ: double-click chốt ⇒ đúng một lần 200 và một lần 409; sửa danh mục sau khi đã ghi bản ghi ⇒ số của bản ghi cũ **không đổi**; một vãng lai hai khoản trong tháng ⇒ đúng **một** dòng Bảng tính thuế và chỉ tiêu `[16]` đếm **một**.

## Nguồn

- `docs/hrm/to_khai_thue/srs-to-khai-thue.md` `A-tkt-09`, `A-tkt-10`, `BR-tkt-006`, `BR-tkt-013`, `BR-tkt-014`, `AC-tkt-008/018/019/020/021`.
- `be_maxv/prisma/tenant/schema.prisma:1393-1406, 1448-1461, 1592-1637, 1721-1808`.
- `be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollClosing.service.ts:136-151`.
- `be_maxv/src/validators/hrm/du_lieu_tinh_luong/payrollClosing.validator.ts:10`.
- `be_maxv/src/constants/hrm/payrollModules.ts:25`.
