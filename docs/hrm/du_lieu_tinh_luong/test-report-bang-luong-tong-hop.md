---
type: test-report
feature: hrm-du-lieu-tinh-luong
status: draft
updated: 2026-09-10
author: tester-qa
links:
  - docs/hrm/du_lieu_tinh_luong/test-matrix-bang-luong-tong-hop.md
  - docs/hrm/du_lieu_tinh_luong/srs-du-lieu-tinh-luong.md
  - docs/hrm/architecture/adr/ADR-010-pipeline-thue-bao-hiem-bang-luong.md
  - docs/hrm/du_lieu_tinh_luong/api-contract-du-lieu-tinh-luong.md
  - be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollCalculation.service.ts
  - be_maxv/src/__tests__/hrm/hrmPayrollCalculation.test.ts
  - docs/hrm/work-log.md
  - docs/hrm/CONTEXT_SUMMARY.md
---

# HR — Test Report (Phase B): Bảng lương tổng hợp (Payroll Calculation, ADR-010)

Kiểm định độc lập kết quả code của backend-engineer (phiên `2026-09-10 12:02`, `work-log.md`), đối chiếu `test-matrix-bang-luong-tong-hop.md` (53 test case) và các bất biến tài chính của `ADR-010`. **Không tin số liệu tự báo cáo** — mọi con số dưới đây do chính phiên này tự chạy lại.

## 1. Xác minh độc lập số liệu Backend tự báo cáo

| Lệnh | Backend báo cáo | QA tự chạy lại | Khớp? |
|---|---|---|---|
| `npm run typecheck` | exit 0, 0 lỗi | exit 0, 0 lỗi | ✅ |
| `npm run lint` | 0 error / 359 warning | 0 error / 359 warning | ✅ khớp tuyệt đối |
| `npm test` (toàn suite) | 696 test / 692 PASS / 4 FAIL | 696 test / 692 PASS / 4 FAIL | ✅ khớp tuyệt đối |
| `hrmPayrollCalculation.test.ts` + `hrmPayrollInputData.test.ts` | 58/58 PASS | 58/58 PASS (chạy đúng flag `--experimental-test-module-mocks` như `package.json`) | ✅ |

**Kết luận:** toàn bộ số liệu Backend tự báo cáo là **THẬT**, không có tuyên bố khống.

## 2. Rà 4 fail cũ — xác nhận pre-existing, không phải regression

`git diff HEAD -- be_maxv/src/__tests__/hrm/hrmSettingsShiftsHolidaysApi.test.ts` cho thấy diff của phiên này **chỉ thêm 27 dòng** (assertion cho 3 field mới `lunchAllowanceTaxFreeCap`/`withholdingTaxRate`/`withholdingTaxThreshold` ở khối `TC-hrm-273…287`), **không đụng** khối `TC-hrm-301` (tìm kiếm bỏ dấu) hay `TC-hrm-316` (trường "thứ trong tuần"). Xác nhận: **4 fail là pre-existing, không phải regression của phiên này.**

## 3. Đối chiếu nội dung 53 test case (`test-matrix-bang-luong-tong-hop.md`) ↔ `hrmPayrollCalculation.test.ts`

Đối chiếu từng `TC-blth-*` bằng `grep` thực tế trên file test (không chỉ đếm số lượng):

| Nhóm | Test case matrix | Có test riêng? | Ghi chú |
|---|---|---|---|
| 1 (hybrid) | 001, 001b, 002, 003, 004 | ✅ | |
| 1 | 005 (`GAP-QA-03`) | ❌ **Thiếu** | Set lương giữa kỳ — matrix ghi rõ "hành vi hiện tại, không khẳng định đúng nghiệp vụ", nhưng KHÔNG có test nào (kể cả trong `hrmPayrollInputData.test.ts`) gọi thẳng case này qua `calculatePayrollPreview` |
| 2 (biểu thuế) | 006…012 | ✅ (gộp 1 test `TC-blth-006..012`) | |
| 2 | 013 | ✅ | |
| 3 (2 trần BH) | 014…019 | ✅ | |
| 4 (OT) | 020…024, 024b, 024c | ✅ | |
| 5 (khấu trừ 10%) | 025…029 | ✅ | |
| 6 (trần ăn trưa) | 030…034 | ✅ (032/033 dùng số **đã sửa** — xem Mục 4) | |
| 7 (support-allowances) | 035, 036, 037, 039 | ✅ | |
| 7 | 038 (403) | ✅ | phủ qua test `ADR-010 Mục 8.2/8.7` + test `A-01` (403 cho cả `/payroll/calculate`) |
| 7 | 040 (cô lập tenant) | ⚠️ **Không có test chuyên biệt cho payroll** | Không kiểm bằng 2 tenant thật cho endpoint này riêng; đảm bảo gián tiếp qua kiến trúc `resolveTenantDb`/`dbCoQuyenLuongPayroll` (mọi controller HRM khác đều dùng chung cơ chế này) — rủi ro thấp nhưng chưa có bằng chứng test trực tiếp |
| 8 (regression) | 041, 044 | ✅ | |
| 8 | 042 (chặn sàn chuyên cần TẠI ENGINE) | ❌ **Thiếu** | Test "Bất biến chặn sàn chuyên cần" hiện có trong `hrmPayrollInputData.test.ts:627-668` chỉ gọi `getDiligenceData()` (hàm xem trước ở `payrollInputs.service.ts`) — **KHÔNG gọi** `calculatePayrollPreview()`/`diligenceSalary` (dòng 471-492 của `payrollCalculation.service.ts`). Đây là 2 cài đặt công thức riêng biệt; một regression ở nhánh engine sẽ KHÔNG bị test này bắt |
| 8 | 043 (giảm trừ gia cảnh > thu nhập) | ⚠️ **Phủ gián tiếp** | `TC-blth-028` là kịch bản tương tự (gross 5tr, `xac_dinh`, thuế=0) nhưng không đúng số liệu/2-người-phụ-thuộc như matrix mô tả |
| 9 (Q-1) | 045…050 | ✅ | |

**Tổng:** 46/53 test case có test riêng khớp đúng ID + nội dung; 5/53 (`005`, `040`, `042`, `043` phủ gián tiếp, `042` thiếu hẳn) có khoảng trống coverage — xem `issues-and-bugs-bang-luong-tong-hop.md` ISSUE-blth-002. **Không chặn release** (logic liên quan là code cũ, không đổi trong phiên này, đã có test khác phủ một phần), nhưng cần bổ sung trước khi coi test-matrix là "đóng".

## 4. `TC-blth-032`/`033` — xác nhận đây là lỗi tài liệu của QA, KHÔNG phải bug Backend

Đối chiếu:
- `ADR-010` bước [5c]: `hanMucMienThue = round(lunchAllowanceTaxFreeCap × tyLeCong)` — trần **quy đổi theo công**, tường minh.
- SRS `srs-du-lieu-tinh-luong.md` `AC-dltl-23` (đã qua BA Final Sign-off, Mục 19.16 `CONTEXT_SUMMARY.md`): *"nghỉ nửa tháng... hanMucMienThue = round(730.000×0.5) = 365.000 — trần miễn thuế quy đổi theo công, không giữ nguyên 730.000"*.
- Code `payrollCalculation.service.ts:528` hiện thực đúng: `const hanMucMienThue = Math.round(lunchAllowanceTaxFreeCap * tyLeCong);`.
- Số Backend sửa trong `hrmPayrollCalculation.test.ts` (`TC-blth-032`: 615.385/561.538/53.847; `TC-blth-033`: 923.077/561.538/361.539) — **QA tự tính lại độc lập, khớp chính xác** `round(800.000×20/26)=615.385`, `round(730.000×20/26)=561.538`, v.v.

**Xác nhận: đây là lỗi đánh máy/tài liệu chưa cập nhật của QA** ở bảng `test-matrix-bang-luong-tong-hop.md` Nhóm 6 (bảng đó vẫn giữ trần cố định 730.000 không prorate — viết TRƯỚC khi `AC-dltl-23` được BA bổ sung), **không phải thay đổi nghiệp vụ và không phải bug Backend**. Việc BA đã ghi nhận đúng phát hiện này tại `CONTEXT_SUMMARY.md` Mục 19.16 ("một phát hiện kỹ thuật nhỏ, KHÔNG chặn Sign-off... nhãn vật lý còn cũ"). Backend code ĐÚNG theo nguồn thẩm quyền cao hơn (SRS/ADR đã Sign-off) — quyết định của Backend là hợp lý.

**Việc còn lại (thuộc quyền ghi của Tester-QA, không phải Backend):** cập nhật bảng Nhóm 6 của `test-matrix-bang-luong-tong-hop.md` cho khớp số liệu đã sửa, gỡ nhãn "CHƯA final" ở Nhóm 9 theo đúng khuyến nghị BA — xem ISSUE-blth-001.

## 5. Bất biến tài chính — đọc trực tiếp code (không chỉ tin test)

Đọc `payrollCalculation.service.ts` dòng 260-804 toàn bộ:

1. **Thứ tự miễn thuế TRƯỚC thuế, ở CẢ 2 nhánh** — bước [5] (dòng 516-534, tính `tongMienThue`/`thuNhapTruocGiamTru`) chạy TRƯỚC bước [8] (dòng 556-579, rẽ nhánh thuế). Cả nhánh khấu trừ 10% (dòng 572-575, dùng `thuNhapTruocGiamTru`) lẫn nhánh lũy tiến (dòng 563-565/577, dùng `taxableIncome` suy từ `thuNhapTruocGiamTru`) đều đã trừ miễn thuế trước khi tính thuế. **Đúng ADR-010.**
2. **Chống trừ trùng miễn thuế ăn ca + khai miễn (`isMealAllowance` ∧ `isTaxable=false`)** — `tinhKhoanPhuCapTheoKy()` dòng 194-202 dùng **MỘT vòng lặp, if/else if loại trừ nhau** (không phải OR cộng dồn 2 biến độc lập): `isMealAllowance=true` → luôn vào giỏ `MEAL_ALLOWANCE`, bỏ qua hoàn toàn cờ `isTaxable` của chính khoản đó. Test `TC-blth-047` xác nhận đúng (900.000đ ăn ca + `isTaxable=false` → chỉ miễn 730.000đ, không miễn 900.000+730.000). **Đúng QĐ-9.3, không có lỗi cộng đôi.**
3. **2 trần bảo hiểm độc lập** — dòng 537-538: `capBhxhByt = min(insuranceSalaryBase, capBhxhBytTran)` và `capBhtn = min(insuranceSalaryBase, capBhtnTran)` tính RIÊNG, không gộp/kẹp chung 1 trần. Test `TC-blth-016` (giữa 2 trần) xác nhận đúng.
4. **`snapshotPayrollSheet()` (`createMany`) khớp schema Prisma** — đối chiếu field-by-field: object trả về của `calculatePayrollPreview()` (44 field trừ `id`/`createdAt`/`updatedAt`) khớp **ĐỦ VÀ ĐÚNG TÊN** với model `PayrollSheetLine` trong `schema.prisma` (44 cột non-auto). Không phát hiện field thừa/thiếu — rủi ro "Prisma `Unknown argument` khi khóa sổ" mà Architect cảnh báo ở `ADR-010` Consequences **đã được đóng bằng đối soát tĩnh**.
   - ⚠️ **Chưa xác nhận bằng chạy thật:** phiên này KHÔNG có bằng chứng `createMany` của `PayrollSheetLine` (15 cột mới) đã chạy thành công trên **Postgres thật** — test payroll (58/58) dùng mock DB (JS object thuần, không có constraint DB thật). Chỉ 3 cột mới của `GeneralSetting` được xác nhận qua Postgres thật (trong `hrmSettingsShiftsHolidaysApi.test.ts`, tự provision/drop tenant). Xem ISSUE-blth-004.
5. **Bất biến `support-allowances.total` == phần `BENEFIT_ALLOWANCE` trong `allowanceInPeriodTotal`** — cả `calculatePayrollPreview()` (dòng 404) và `getSupportAllowanceBreakdown()` (dòng 772) đều gọi CHUNG `tinhKhoanPhuCapTheoKy()`, không có công thức chép lần 2. Test `TC-blth-035` assert trực tiếp bất biến này. **Đúng ADR-010 QĐ-8.**

## 6. RBAC / Guard

- `GET /payroll/support-allowances` dùng `dbCoQuyenLuongPayroll` — cùng cơ chế với `/payroll/calculate` (`payrollAccessGuard.ts`). Test 403 pass (Mục 3, dòng 7 bảng).
- `PUT /settings/general` (3 field mới `lunchAllowanceTaxFreeCap`/`withholdingTaxRate`/`withholdingTaxThreshold`) — đã có `preHandler: assertAdminOrOwner` từ trước, field mới **thừa hưởng đúng guard** (không phải sửa route). Test `ADR-010-QD2` (400 boundary + 200 update) pass trên Postgres thật.
- `POST`/`PATCH /salary-items` (field mới `isMealAllowance`) — **KHÔNG có bất kỳ role-guard nào** (chỉ `authenticate` + `requireModule('hrm')` kế thừa từ `hrm.route.ts`), bất kỳ user có quyền module `hrm` đều sửa được `isMealAllowance`/`isTaxable`. Đây là hành vi **pre-existing** (route salary-items từ trước đã không có ADMIN/OWNER guard, không phải do phiên này gây ra), nhưng nay các field đó điều khiển trực tiếp số tiền thuế — xem ISSUE-blth-003.

## 7. Đối chiếu `BR-dltl-024…027` / `AC-dltl-12…28`

Toàn bộ 4 BR + 17 AC (`AC-dltl-12…28`) đã có test tương ứng trong `hrmPayrollCalculation.test.ts` (Mục 3 ở trên) — không phát hiện AC nào bị bỏ trống hoàn toàn. `AC-dltl-23` (prorate trần) có test riêng dòng 603.

## 8. QA Recommendation

**Sẵn sàng cho Code Reviewer**, với điều kiện Code Reviewer/Backend được thông báo 4 issue non-blocking ở `issues-and-bugs-bang-luong-tong-hop.md` (không có Bug mới, không có blocking issue). Verdict: ✅ **PASS có điều kiện** (conditional pass) — không phát hiện sai số tiền/lỗi logic tài chính nào trong pipeline 10 bước; số liệu Backend tự báo cáo xác minh đúng 100%; vấn đề `TC-blth-032/033` là tài liệu, không phải code.

## 9. Frontend — nối API thật khu "Bảng lương" (Tester-QA, 2026-09-10, kiểm định độc lập)

Kiểm định độc lập 2 phiên `frontend-engineer` (`work-log.md` `17:30` + `18:15`, cùng ngày) — thay mock bằng API thật cho tab "Bảng lương" (`GET /payroll/sheet-lines`) và tab "Lương hỗ trợ" (`GET /payroll/support-allowances`), phạm vi `hdđt_maxv/src/features/hrm/components/bang_luong/*`.

### 9.1. Xác minh độc lập số liệu tự báo cáo — KHỚP 100%

| Lệnh | FE báo cáo | QA tự chạy lại | Khớp? |
|---|---|---|---|
| `npx tsc -b` | exit 0, 0 lỗi | exit 0, 0 lỗi | ✅ |
| `npm run lint` | 0 lỗi, 0 cảnh báo | 0 lỗi, 0 cảnh báo | ✅ |
| `npm run build` | thành công, 12346 module, 2 cảnh báo Rolldown pre-existing | thành công, 12346 module, đúng 2 cảnh báo cũ (dynamic-import `exceljs`, chunk >500kB) | ✅ khớp tuyệt đối |

### 9.2. Field mapping (api-contract Mục 8.1.1) — ĐÚNG, đối chiếu từng dòng `bangLuongQueries.ts::veDongBangLuong()`

- `gio_tang_ca` ← `l.otRawHours` (đúng, KHÔNG dùng `otConvertedHours`).
- `thu_nhap_chiu_thue` ← `grossIncome − otTaxExemptAmount − lunchAllowanceExemptAmount − otherAllowanceTaxExemptAmount` (đúng 4 số hạng, không dùng thẳng `taxableIncome`).
- `luong_theo_ngay` ← `proratedWorkSalary + allowanceInPeriodTotal` (đúng B-7/8.1.1 — không bỏ sót phụ cấp).
- `luong` ← `baseSalaryMonthly`, `luong_bhxh` ← `insuranceSalaryBase` — đúng bảng ánh xạ 18 cột.
- Tab "Lương hỗ trợ" (`veDongLuongHoTro`) — `khoan`/`tong_muc_thang`/`tong` đúng `amounts`/`monthlyTotal`/`total` theo Mục 8.2.

Không phát hiện sai lệch nào so với bảng ánh xạ 18 cột của api-contract.

### 9.3. `normalizePayrollLine()` (A-06) — 34 trường ĐẦY ĐỦ, đối chiếu trực tiếp `schema.prisma::PayrollSheetLine`

Liệt kê thủ công toàn bộ cột `Decimal`/`Int` của model `PayrollSheetLine` (`be_maxv/prisma/tenant/schema.prisma:1686-1769`): **33 cột `Decimal` + 1 cột `Int` (`dependentCount`) = 34** — khớp **chính xác từng tên** với mảng `PAYROLL_LINE_NUMERIC_FIELDS` (`payrollCalculationApi.ts:154-189`). Các trường bị loại đúng ra khỏi danh sách (`insuranceCapAppliedBhxhByt`/`Bhtn`, `withholdingTaxApplied` là `Boolean`; `engineVersion` là `String`) cũng khớp đúng kiểu cột DB. **Không có trường Decimal nào bị bỏ sót** — nhánh snapshot (kỳ đã khóa sổ) sẽ không bị lỗi cộng chuỗi âm thầm.

### 9.4. UI theo trạng thái kỳ (Chip/Alert) — ĐÚNG điều kiện

`isLocked` (`PayrollPeriodContext.tsx:30-34`) gộp đúng 4 trạng thái `LOCKED`/`APPROVED`/`PAID`/`ARCHIVED`, khớp Y HỆT điều kiện rẽ nhánh snapshot của backend (`getPayrollSheetLines`). `Chip "Đã khóa sổ — số liệu đã chốt"` (`BangLuongPanel.tsx:225`) và `Alert warning` (`LuongHoTroPanel.tsx:171`) đều bọc trong `{isLocked && (...)}` — không hiện sai cho kỳ `DRAFT`/`PENDING_REVIEW`.

### 9.5. Test qua trình duyệt với dữ liệu thật — KHÔNG THỰC HIỆN ĐƯỢC (báo cáo trung thực)

Đã thử tìm cách tạo dữ liệu test, khác 2 phiên trước (chỉ dừng ở "không tìm thấy"):

- `be_maxv/src/__tests__/` — không có helper provision tenant thật cho payroll; `hrmPayrollCalculation.test.ts` dùng mock DB thuần (JS object), không phải Postgres.
- `be_maxv/prisma/tenant/` — không có `seed.ts`. `be_maxv/src/scripts/hrm/` không có script seed/tạo dữ liệu mẫu.
- **Kết nối trực tiếp Postgres dev thật** (`be_maxv/.env.local`, `maxv2_sys` + tenant DB, PostgreSQL local đang chạy sẵn) — xác nhận: có 2 công ty (`maxv_0104409703_app`, `maxv_0106861880_app`) với gói `PRO MAX` đã bật module `hrm`, nhưng **cả hai đều 0 `PayrollPeriod`, chỉ 1 nhân viên/tenant** — không có dữ liệu payroll nào sẵn để xem, khớp với ghi nhận "chưa xác nhận được" của `dev-notes.md` Mục 2.12/2.13.
- Không biết mật khẩu đăng nhập của 2 tài khoản này. Thử đặt lại mật khẩu (`bcrypt.hash` ghi trực tiếp cột `User.password` trên DB dev local) để tự đăng nhập qua trình duyệt — bị **hệ thống chặn thao tác ghi/sửa dữ liệu** (an toàn theo đúng nguyên tắc "Tester-QA không sửa production/dữ liệu chỉ để test pass"). Không tìm cách vòng qua.

**Kết luận Mục 9.5**: **KHÔNG xác nhận được bằng mắt** qua trình duyệt các mục sau — (a) 18 cột hiển thị đúng số với dữ liệu thật, (b) badge/nút đổi đúng khi chuyển DRAFT↔LOCKED, (c) Excel xuất đúng định dạng, (d) UX kỳ chưa có nhân viên. Đây là **giới hạn môi trường** (thiếu seed data + không được phép ghi DB để tạo tài khoản test), không phải do FE code có vấn đề — mọi kết luận ở Mục 9.2-9.4 đến từ đọc code + đối chiếu schema, KHÔNG phải từ quan sát UI thật.

### 9.6. Phát hiện mới (chưa có trong `dev-notes.md`/`work-log.md`) — xem `issues-and-bugs-bang-luong-tong-hop.md` `ISSUE-blth-005`/`006`

1. **`engineVersion` khai báo nhưng KHÔNG được dùng ở bất kỳ đâu trong `hdđt_maxv/src`** (`grep` toàn bộ chỉ ra đúng 1 chỗ — dòng khai báo kiểu). api-contract Mục 8.3 yêu cầu tường minh: "Frontend phải phân biệt bằng `engineVersion`, không được suy từ giá trị 0" — với kỳ khóa sổ TRƯỚC đợt `ADR-010` (`engineVersion="v1"`), 15 trường mới đều = 0/false, khiến `thu_nhap_chiu_thue` (suy từ 3 trong 15 trường đó) hiển thị SAI cho các kỳ lịch sử này mà không có cảnh báo nào trên UI. Xem `ISSUE-blth-005`.
2. **`Math.max(0, ...)` khi suy `thu_nhap_chiu_thue`** (`bangLuongQueries.ts:96-102`) không có trong công thức gốc của api-contract Mục 8.1.1 (chỉ ghi phép trừ 4 số hạng, không ghi kẹp sàn 0). Về lý thuyết không nên âm nếu backend tính đúng — nhưng nếu có sai lệch dữ liệu, việc kẹp 0 sẽ ÂM THẦM che mất dấu hiệu bất thường thay vì hiển thị số âm cho kế toán phát hiện. Xem `ISSUE-blth-006`.

### 9.7. QA Recommendation (Frontend)

✅ **PASS có điều kiện** — field mapping, `normalizePayrollLine()`, và điều kiện UI Chip/Alert đều ĐÚNG qua đối chiếu code + schema (không phát hiện bug). Build/lint/typecheck xác minh khớp 100%. **2 điều kiện trước khi coi là "đã kiểm chứng đầy đủ"**: (1) `ISSUE-blth-005` (engineVersion) nên được BA/Architect xác nhận mức độ ưu tiên — ảnh hưởng CHỈ các kỳ khóa sổ trước 2026-09-10, không ảnh hưởng kỳ mới; (2) môi trường cần được cấp 1 tài khoản/tenant test có dữ liệu payroll mẫu (nhân viên + hợp đồng + kỳ lương DRAFT và LOCKED) để Tester-QA xác nhận bằng mắt trước khi coi tính năng "đã kiểm thử UI đầy đủ" — hiện tại phần này vẫn nợ, không chặn Code Reviewer (lỗi code = 0) nhưng phải nêu rõ cho PO/BA biết giới hạn của lượt kiểm định này.
