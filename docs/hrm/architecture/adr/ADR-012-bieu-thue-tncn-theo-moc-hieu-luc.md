---
type: adr
feature: hrm
status: accepted
updated: 2026-09-14
---

# ADR-012: Biểu thuế TNCN và giảm trừ gia cảnh lưu theo mốc hiệu lực

## Context

`OQ-hrm-35` đã được BA đóng ngày 2026-09-14 với câu trả lời **"Có"**: biểu thuế và giảm trừ gia cảnh phải lưu kèm mốc hiệu lực, nhiều phiên bản theo ngày, không còn singleton. `srs-to-khai-thue.md` (`A-tkt-02`, `BR-tkt-017`) chuyển phần thiết kế kỹ thuật cụ thể sang Architect.

Vì sao chuyện này thành cấp bách trong năm 2026:

- Luật Thuế TNCN **109/2025/QH15** đổi biểu 7 bậc thành **5 bậc**; `NQ 110/2025/UBTVQH15` đổi giảm trừ gia cảnh **11tr → 15,5tr** (bản thân) và **4,4tr → 6,2tr** (người phụ thuộc), áp từ kỳ tính thuế 2026. Khung pháp lý đã đổi **hai lần** trong cùng một năm.
- `OQ-tkt-02` **vẫn còn mở**: chưa rõ nửa đầu 2026 (T1–T6) khấu trừ hàng tháng có tạm áp biểu cũ hay không. Nghĩa là mốc hiệu lực thật **có thể là `2026-01-01` hoặc `2026-07-01`**, và chỉ biết chắc sau khi kế toán trưởng đọc Điều 29 Luật 109/2025/QH15 bản gốc.
- `BR-tkt-017` yêu cầu giữ song song biểu cũ để tra cứu và tính lại dữ liệu lịch sử — thanh tra thuế phải tính ra **đúng** con số đã nộp năm ngoái, bằng **đúng** biểu của năm ngoái.

Hiện trạng đo được trong mã nguồn:

| Nơi | Vấn đề |
|---|---|
| `GeneralSetting` (`schema.prisma:1105-1153`) | **Singleton `id = "DEFAULT"`**, một dòng duy nhất cho cả lịch sử công ty. Sửa giảm trừ là mất giá trị cũ, không hoàn tác |
| `tinhThueLuyTien()` (`payrollCalculation.service.ts:21-42`) | Biểu 7 bậc **hardcode trong code**, không đọc `GeneralSetting.taxBrackets` |
| `PayrollSheetLine` (`schema.prisma:1796`) | Đã có `engineVersion` để truy vết *phiên bản công thức*, nhưng **không có gì** truy vết *phiên bản biểu thuế* |
| 6 cột thuế của `GeneralSetting` | `personalDeduction`, `dependentDeduction`, `taxBrackets`, `withholdingTaxRate`, `withholdingTaxThreshold`, `lunchAllowanceTaxFreeCap` — đều là con số do **pháp luật** quy định, nằm lẫn với ~25 cột cấu hình do **doanh nghiệp** tự quyết (ngày công chuẩn, chính sách thứ Bảy, hệ số tăng ca…) |

## Decision

**1. Bảng mới `hrm_tax_policies`, một dòng cho mỗi mốc hiệu lực.** Chứa **đúng** những con số do pháp luật quy định: 6 cột chuyển từ `GeneralSetting` + `voluntaryPensionMonthlyCap` mới của `BR-tkt-010`.

**2. Chỉ có `effectiveFrom`, KHÔNG có `effectiveTo`.** Dòng có `effectiveFrom` lớn hơn kế tiếp tự động thay thế dòng trước. `effectiveFrom` khai `@unique`. Mô hình này **không thể** sinh khoảng trống (gap) hay chồng lấn (overlap) — hai lỗi mà cặp from/to luôn phải kiểm bằng tay và luôn có ngày kiểm sót.

**3. Tra cứu theo `period.startDate`, không theo ngày chi trả của từng bản ghi.**

```ts
findFirst({ where: { effectiveFrom: { lte: period.startDate } }, orderBy: { effectiveFrom: 'desc' } })
```

Cả kỳ tháng dùng đúng một biểu thuế — nếu không, hai khoản cùng tháng tính theo hai biểu khác nhau và phép lũy tiến trên tổng thu nhập tính thuế mất ý nghĩa.

**4. `hrm_tax_calculation_lines` ghim `taxPolicyId`** (FK `onDelete: Restrict`). Đây là phần trả lời trực tiếp cho nhu cầu "thanh tra thuế / sửa sai" mà `OQ-hrm-35` nêu: mở một dòng bất kỳ là biết ngay nó được tính bằng biểu nào, giảm trừ bao nhiêu.

**5. `GeneralSetting` nhả 6 cột thuế theo lộ trình 4 bước** (M-1…M-4, `data-model-to-khai-thue.md` Mục 6). Kết thúc M-4 chỉ còn **một** nguồn sự thật (NFR-tkt-004). Màn "Cài đặt chung" (`FR-hrm-045/046/047`) chuyển sang đọc/ghi dòng chính sách **đang hiệu lực** — giao diện người dùng **không đổi**.

**6. Khởi tạo 2 dòng:**
- `1900-01-01` — chụp nguyên hiện trạng đang chạy (11tr / 4,4tr / biểu 7 bậc / 2tr / 730k / 1tr).
- `2026-01-01` — mang số mới đã ký (15,5tr / 6,2tr / biểu 5 bậc / 3tr).

Hai con số `withholdingTaxThreshold` và `lunchAllowanceTaxFreeCap` **giữ nguyên giá trị cũ ở cả hai dòng** — chúng thuộc `srs-du-lieu-tinh-luong.md` đã ký duyệt, và SRS `to_khai_thue` Mục 14 điểm 5 nói rõ không sửa trong đợt này. Đổi số ở đây là Architect tự ý đổi quyết định nghiệp vụ.

**7. Ràng buộc toàn vẹn biểu thuế `BR-hrm-082` áp nguyên vẹn** khi ghi vào `taxBrackets` của bảng mới: tối thiểu 2 bậc (E-hrm-081), ngưỡng lũy kế tăng nghiêm ngặt (E-hrm-080), thuế suất tăng nghiêm ngặt (E-hrm-069), bậc cuối là bậc mở (E-hrm-082). Ngữ nghĩa `khoang` = **ngưỡng trên lũy kế** (`BR-hrm-080`) giữ nguyên một chiều, cấm mọi quy đổi ngầm.

## Alternatives

**A. Thêm `effectiveFrom` vào chính `GeneralSetting`, bỏ singleton.**
Bỏ. `GeneralSetting` có khoảng 30 cột mà chỉ 6 cột là số pháp luật; phiên bản hóa cả bảng buộc phải sinh dòng mới mỗi lần ai đó đổi… chính sách ngày thứ Bảy hay số ngày phép cơ bản. Ngoài ra mọi chỗ đang đọc `findUnique({ where: { id: SINGLETON_ID } })` (nhiều điểm gọi, gồm cả engine lương) phải đổi cùng lúc — đúng kiểu thay đổi "big bang" mà ADR-011 đã từ chối cho UI và không có lý do gì áp dụng ở đây.

**B. Lưu nhiều phiên bản ngay trong cột `taxBrackets` JSONB** (dạng `[{ effectiveFrom, brackets }]`).
Bỏ. JSONB không ràng buộc được tính duy nhất của mốc hiệu lực; không truy vấn được "biểu nào đang hiệu lực" bằng SQL; và `personalDeduction`/`dependentDeduction` vẫn nằm ngoài mảng nên vẫn tồn tại hai mô hình phiên bản song song cho cùng một mốc luật.

**C. Không phiên bản hóa — chỉ snapshot kết quả lên `hrm_tax_calculation_lines`.**
Bỏ. Snapshot trả lời được "số đã chốt là bao nhiêu" nhưng **không** trả lời được "vì sao ra số đó", và **không** cho phép **tính lại** một kỳ đã chốt — đúng hai nhu cầu mà `OQ-hrm-35` nêu. Ngoài ra khi `OQ-tkt-02` có lời giải, phương án này không cho phép đổi mốc hiệu lực mà không sửa code.

**D. Cặp `effectiveFrom` + `effectiveTo` (theo khuôn `SalaryStructure`).**
Bỏ. Biểu diễn được nhiều thứ hơn — gồm cả "khoảng thời gian không có chính sách nào", một trạng thái vô nghĩa ở đây — đổi lại phải tự kiểm chồng lấn và khoảng trống ở tầng ứng dụng. Với bài toán "luôn có đúng một chính sách tại mọi thời điểm", mô hình chỉ-`effectiveFrom` là biểu diễn chính xác hơn và ít code hơn.

## Trade-offs

**Được:**
- Đổi mốc hiệu lực khi `OQ-tkt-02` có lời giải chỉ là **sửa một dòng dữ liệu**, không sửa code.
- Tính lại được kỳ đã chốt bằng đúng biểu của kỳ đó (thanh tra thuế, sửa sai).
- Mỗi dòng thuế đã chốt tự giải trình được bằng `taxPolicyId`.
- Số do pháp luật quy định tách khỏi số doanh nghiệp tự quyết — nhìn vào bảng là biết ngay cột nào được phép sửa tùy ý, cột nào phải chờ văn bản pháp luật.

**Mất:**
- Thêm một bảng và một hàm tra cứu trên đường tính thuế (một truy vấn mỗi kỳ — không đáng kể).
- **M-3/M-4 phá vỡ tương thích ngược** với `GeneralSetting`, bắt buộc phải sửa `generalSettings.service.ts` và `payrollCalculation.service.ts` trong cùng đợt.
- Trong khoảng M-1 → M-3 tồn tại **hai nguồn** cho cùng 6 con số (rủi ro có thật). Giảm thiểu: M-2 chỉ đọc-chép chứ không cho sửa ở nguồn mới, và M-3 chuyển hẳn trong một lần, không để lửng.

## Consequences

- `schema.prisma` thêm `model TaxPolicy`; `TaxCalculationLine.taxPolicyId` FK `Restrict` ⇒ **không xóa được** chính sách đã có kỳ tham chiếu.
- `payrollCalculation.service.ts` phải bỏ `tinhThueLuyTien()` hardcode và tính theo `taxBrackets` của chính sách hiệu lực. **Đây là thay đổi hành vi thật của bảng lương** (biểu 7 bậc → 5 bậc) — phải qua BA và QA hồi quy, không được làm thầm lặng. Xem phản biện **P-01** trong `data-model-to-khai-thue.md`.
- Mọi kỳ lương đã `LOCKED` trước M-3 giữ nguyên số đã snapshot ở `PayrollSheetLine` (`A-tkt-01`, `A-hrm-11`) — thay đổi **không hồi tố**.
- Cần mã lỗi mới `E-tkt-015` (500) cho ca không tìm thấy chính sách hiệu lực. Dòng `1900-01-01` khiến ca này gần như không xảy ra, nhưng vẫn phải có mã để không rơi vào lỗi 500 vô danh.
- Khi `OQ-tkt-02` kết luận "H1/2026 vẫn áp biểu cũ": sửa `effectiveFrom` của dòng thứ hai thành `2026-07-01` và thêm một dòng cho H1. **Không** sửa dòng code nào.
- Màn "Cài đặt chung" sau M-3 sửa cấu hình thuế là **tạo/sửa dòng chính sách hiệu lực hôm nay**, không phải ghi đè lịch sử — cần bổ sung ghi chú cho người dùng ở giao diện (ngoài phạm vi đợt này, ghi ra để không quên).

## Nguồn

- `docs/hrm/srs/hrm-spec.md` Mục 4.8, `BR-hrm-080`…`084`, `OQ-hrm-35` (đóng 2026-09-14).
- `docs/hrm/to_khai_thue/srs-to-khai-thue.md` `A-tkt-01`, `A-tkt-02`, `BR-tkt-010`, `BR-tkt-012`, `BR-tkt-017`, `OQ-tkt-02`.
- `be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollCalculation.service.ts:21-42, 354-389`.
- `be_maxv/prisma/tenant/schema.prisma:1105-1153, 1796`.
