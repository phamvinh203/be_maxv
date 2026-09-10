---
type: test-report
feature: hrm-du-lieu-tinh-luong
status: draft
updated: 2026-09-10
author: tester-qa
links:
  - docs/hrm/du_lieu_tinh_luong/test-report-bang-luong-tong-hop.md
  - docs/hrm/du_lieu_tinh_luong/test-matrix-bang-luong-tong-hop.md
  - docs/hrm/architecture/adr/ADR-010-pipeline-thue-bao-hiem-bang-luong.md
  - docs/hrm/review-findings.md
---

# HR — Issues & Bugs (Phase B): Bảng lương tổng hợp (Payroll Calculation, ADR-010)

## Tóm tắt

**0 Bug mới (Blocking/Critical/High) được phát hiện trong phiên kiểm định này.** Toàn bộ pipeline 10 bước của `ADR-010` được đọc trực tiếp và đối chiếu đúng: thứ tự miễn thuế trước thuế, chống trừ trùng ăn ca, 2 trần bảo hiểm độc lập, bất biến `support-allowances`. Số liệu Backend tự báo cáo (typecheck/lint/test) xác minh khớp 100%. Vấn đề `TC-blth-032/033` mà Backend nêu là **lỗi tài liệu của QA (phiên trước)**, không phải bug code — xem `test-report-bang-luong-tong-hop.md` Mục 4.

4 Issue non-blocking (Low/Medium) phát hiện ở lượt kiểm định Backend, cộng **2 issue mới** phát hiện ở lượt kiểm định Frontend (2026-09-10, xem `test-report-bang-luong-tong-hop.md` Mục 9) — tổng **6 issue non-blocking**, liệt kê dưới đây.

---

## Bugs

*(Không có bug nào ở mức Blocking/Critical/High trong phiên này.)*

---

## Issues / Tasks tồn đọng

### ISSUE-blth-001 🟢 Low — `test-matrix-bang-luong-tong-hop.md` Nhóm 6 còn số liệu chưa prorate (tài liệu, không phải code)

- **Mô tả:** Bảng Nhóm 6 (`TC-blth-032`/`033`) hiện vẫn ghi trần miễn thuế cố định 730.000đ (không quy đổi theo công), mâu thuẫn với `AC-dltl-23` (đã Sign-off) và `ADR-010` bước [5c]. Bảng này được viết TRƯỚC khi `AC-dltl-23` được BA bổ sung vào SRS, chưa được đồng bộ lại.
- **Bằng chứng:** `test-matrix-bang-luong-tong-hop.md` dòng 212-213 (`hanMucMienThue` ngầm định = 730.000 cố định) vs `ADR-010` dòng 73-75 + SRS `AC-dltl-23` (trần = `round(730.000 × tyLeCong)`).
- **Đã xác nhận đúng ở code:** `payrollCalculation.service.ts:528` và `hrmPayrollCalculation.test.ts` (`TC-blth-032`/`033`, số đã sửa) đều ĐÚNG theo AC-dltl-23.
- **Việc cần làm:** Tester-QA (không phải Backend) cập nhật bảng Nhóm 6 với số liệu prorate đúng (615.385/561.538/53.847 và 923.077/561.538/361.539), đồng thời gỡ nhãn "⚠️ CHƯA final"/"GAP-QA-09" còn sót ở Nhóm 9 và `TC-blth-050` (theo đúng khuyến nghị đã ghi ở `CONTEXT_SUMMARY.md` Mục 19.16 — BA đã xác nhận không cần sửa số liệu, chỉ gỡ nhãn).
- **Phụ trách:** tester-qa (đợt sau, không chặn Code Reviewer).

### ISSUE-blth-002 🟡 Medium — 5/53 test case của `test-matrix-bang-luong-tong-hop.md` chưa có test riêng khớp đúng nội dung

- **Mô tả:** `TC-blth-005` (set lương giữa kỳ, `GAP-QA-03`), `TC-blth-040` (cô lập tenant cho `support-allowances`), `TC-blth-042` (chặn sàn chuyên cần **tại `payrollCalculation.service.ts`**, không phải ở `payrollInputs.service.ts`), `TC-blth-043` (giảm trừ gia cảnh > thu nhập, kịch bản 2 người phụ thuộc) không có test riêng đúng ID/nội dung trong `hrmPayrollCalculation.test.ts`.
- **Rủi ro cụ thể nhất — `TC-blth-042`:** test hiện có "Bất biến chặn sàn chuyên cần" (`hrmPayrollInputData.test.ts:627-668`) chỉ gọi `getDiligenceData()` (hàm xem trước dữ liệu nhập của `payrollInputs.service.ts`), **KHÔNG gọi** `calculatePayrollPreview()`. Công thức `diligenceSalary = Math.max(0, diligenceAllowance - diligencePenalty)` ở `payrollCalculation.service.ts:491-492` là code RIÊNG, KHÔNG được test này bảo vệ — nếu ai lỡ xóa `Math.max(0, ...)` ở đúng dòng 492, mọi test hiện có vẫn PASS.
- **Mức độ:** không chặn (code liên quan là logic cũ, không sửa trong phiên `ADR-010` này, rủi ro thấp trong ngắn hạn), nhưng cần đóng trước khi coi bộ 53 test case là "đầy đủ" theo đúng tinh thần test-matrix đã thiết kế.
- **Việc cần làm:** Backend Engineer (hoặc Tester-QA viết, Backend review) bổ sung 4 test còn thiếu vào `hrmPayrollCalculation.test.ts`, đặc biệt ưu tiên `TC-blth-042` (test giả tương tự BUG-dltl-006 đã từng xảy ra ở `payrollInputs.service.ts` — cùng lớp rủi ro).
- **Phụ trách:** backend-engineer, đợt sau (không chặn Code Reviewer approve đợt này vì code không đổi ở nhánh chuyên cần).

### ISSUE-blth-003 🟡 Medium — `POST`/`PATCH /salary-items` không có RBAC ADMIN/OWNER dù nay điều khiển số tiền thuế qua `isMealAllowance`/`isTaxable`

- **Mô tả:** Route `salaryItems.route.ts` chỉ kế thừa guard chung `authenticate` + `requireModule('hrm')` từ `hrm.route.ts`, không có `assertAdminOrOwner` như `settings/general`. Bất kỳ user có quyền module `hrm` (kể cả không phải ADMIN/OWNER) đều tạo/sửa được khoản lương, bật/tắt `isMealAllowance` hoặc `isTaxable` — 2 cờ này giờ **trực tiếp quyết định số tiền thuế TNCN** qua pipeline `ADR-010` (QĐ-9).
- **Đây là hành vi pre-existing** (route salary-items chưa từng có ADMIN/OWNER guard, không phải lỗi phát sinh từ phiên `2026-09-10`), nhưng mức độ rủi ro tăng lên đáng kể sau `ADR-010` vì tác động tài chính trực tiếp và rõ ràng hơn trước.
- **Việc cần làm:** BA/Architect quyết định có cần siết `assertAdminOrOwner` cho `POST`/`PATCH`/`DELETE /salary-items` không (đối xứng với `settings/general`). Không tự ý sửa route trong phiên QA này (theo nguyên tắc "không sửa code chỉ để test pass"/không tự quyết business rule).
- **Phụ trách:** business-analyst/architect quyết định phạm vi, backend-engineer thực hiện nếu được chốt.

### ISSUE-blth-004 🟢 Low — `snapshotPayrollSheet()` (44 field `createMany`) chưa được xác nhận chạy thật trên Postgres cho `PayrollSheetLine`

- **Mô tả:** Đối soát tĩnh (field-by-field so với `schema.prisma`) xác nhận object trả về của `calculatePayrollPreview()` khớp đúng 44 cột non-auto của model `PayrollSheetLine`. Tuy nhiên, phiên test 58/58 PASS của payroll dùng **mock DB** (JS object, không có ràng buộc kiểu Decimal/constraint DB thật). Chỉ 3 cột mới của `GeneralSetting` được xác nhận qua Postgres thật (`hrmSettingsShiftsHolidaysApi.test.ts`, tự provision/drop tenant) — 15 cột mới của `PayrollSheetLine` **chưa** được xác nhận bằng một lượt khóa sổ (`lock`) thật trên Postgres.
- **Rủi ro:** đây chính là rủi ro Architect đã cảnh báo ở `ADR-010` Consequences ("thêm field mà thiếu cột ⇒ khóa sổ gãy, lỗi chỉ lộ lúc kế toán bấm Khóa sổ") — đối soát tĩnh làm giảm rủi ro nhưng không thay thế hoàn toàn một lượt test thật gọi `POST /payroll-periods/:id/lock` trên Postgres có đủ 15 cột mới.
- **Việc cần làm:** trước khi chạy `npm run sync:tenants` lên 10 tenant thật, cần ít nhất 1 test tích hợp (hoặc thao tác tay) gọi `lock` trên tenant test có schema mới để xác nhận `createMany` không ném `Unknown argument`/lỗi kiểu Decimal.
- **Phụ trách:** backend-engineer/devops-engineer, trước bước `npm run sync:tenants` (đã ghi nợ sẵn ở `work-log.md` phiên `12:02`, chưa đóng).

### ISSUE-blth-005 🟡 Medium — `engineVersion` khai báo nhưng KHÔNG được FE dùng để phân biệt kỳ khóa sổ `v1` (trước ADR-010)

- **Mô tả:** api-contract Mục 8.3 yêu cầu tường minh: kỳ đã khóa sổ TRƯỚC khi triển khai `ADR-010` trả `engineVersion="v1"` với toàn bộ 15 trường mới = 0/false — "Frontend phải phân biệt bằng `engineVersion`, không được suy từ giá trị 0. Đặc biệt với `otherAllowanceTaxExemptAmount`: 0 ở kỳ v1 nghĩa là 'công thức lúc đó chưa có khái niệm này', không phải 'nhân viên này không có phụ cấp miễn thuế'". `grep -rn "engineVersion" hdđt_maxv/src` chỉ ra đúng 1 kết quả — dòng khai báo kiểu ở `payrollCalculationApi.ts:86`. Không có branch/badge/tooltip nào đọc field này.
- **Hệ quả cụ thể:** cột `thu_nhap_chiu_thue` (UI) suy từ `grossIncome − otTaxExemptAmount − lunchAllowanceExemptAmount − otherAllowanceTaxExemptAmount` — với kỳ `v1`, 3 số hạng trừ đều = 0 nên UI hiển thị gần như `= grossIncome`, một con số **không phản ánh đúng thu nhập chịu thuế thực tế đã tính tại thời điểm khóa sổ cũ** (dùng `taxableIncome`/logic thuế của engine v1, không có bóc tách OT/ăn ca miễn thuế). Kế toán xem lại kỳ cũ sẽ thấy con số sai mà không có cảnh báo nào.
- **Phạm vi ảnh hưởng:** CHỈ các kỳ đã khóa sổ TRƯỚC 2026-09-10 (thời điểm triển khai `ADR-010`). Kỳ mới tạo/khóa sau đợt này đều là `v2`, không bị ảnh hưởng.
- **Việc cần làm:** BA/Architect xác nhận có cần hiển thị badge "Số liệu công thức cũ (v1) — một số cột chưa có" khi `engineVersion !== "v2"`, hoặc fallback `thu_nhap_chiu_thue` sang `taxableIncome` kèm ghi chú cho kỳ `v1`. Không tự quyết định hiển thị trong phiên QA này.
- **Phụ trách:** business-analyst/architect quyết định UX, frontend-engineer thực hiện nếu được chốt.

### ISSUE-blth-006 🟢 Low — `Math.max(0, ...)` khi suy `thu_nhap_chiu_thue` không có trong api-contract, có thể che dấu hiệu bất thường

- **Mô tả:** `bangLuongQueries.ts:96-102` kẹp sàn 0 cho `thu_nhap_chiu_thue` (`Math.max(0, grossIncome − otTaxExemptAmount − lunchAllowanceExemptAmount − otherAllowanceTaxExemptAmount)`), trong khi api-contract Mục 8.1.1 chỉ mô tả phép trừ 4 số hạng, không đề cập kẹp sàn. Về lý thuyết tổng 3 khoản miễn thuế là tập con của `grossIncome` nên kết quả không nên âm nếu backend tính đúng — phép `Math.max(0, ...)` là phòng thủ thêm của FE, không phải yêu cầu nghiệp vụ đã chốt.
- **Rủi ro:** nếu có sai lệch dữ liệu/logic ở backend khiến hiệu số thực sự âm, FE sẽ ÂM THẦM hiển thị 0 thay vì để lộ số âm — mất tín hiệu cảnh báo sớm cho QA/kế toán phát hiện bất thường.
- **Việc cần làm:** xác nhận với Architect/BA đây có phải bất biến toán học luôn đúng không (nếu đúng, việc kẹp là vô hại về mặt số liệu nhưng nên ghi chú lý do trong code); nếu không chắc, cân nhắc bỏ kẹp hoặc thêm cảnh báo console/log khi giá trị âm bị kẹp.
- **Phụ trách:** frontend-engineer xác nhận + ghi chú (đợt sau, không chặn Code Reviewer — chưa có bằng chứng giá trị thực tế từng âm).

---

## Carry-forward (đã có trước, KHÔNG re-audit trong phiên này — tham chiếu, không lặp lại)

- `docs/hrm/review-findings.md`: `A-04`…`A-09`, `RVW-003`…`RVW-017` (toàn bộ 🟡/🟢 non-blocking) — cố ý chưa đụng, ngoài phạm vi 8 lỗi 🔴 đã fix ở phiên `2026-09-09 18:30`.
- Nợ `taxBrackets` chưa nối (`ADR-010` QĐ-6) — hoãn có chủ đích, cần ADR riêng.
- `npm run sync:tenants` chưa chạy cho 10 tenant thật (19 cột mới) — chờ Architect/DevOps xác nhận thời điểm.
- `OQ-dltl-005` (cộng dồn trần OT theo năm), `OQ-dltl-010` (thêm `PENDING_REVIEW` vào guard chỉ-đọc 8 phân hệ) — việc nhỏ, độc lập.
- `Q-3` (hiển thị cột "Lương theo ngày") — không chặn Backend, thuần quyết định hiển thị FE.
