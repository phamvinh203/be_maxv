---
type: issues-and-bugs
feature: hrm-to-khai-thue
status: draft
updated: 2026-09-15
author: tester-qa
links:
  - docs/hrm/to_khai_thue/test-report-to-khai-thue.md
  - docs/hrm/to_khai_thue/test-cases-to-khai-thue.md
  - docs/hrm/to_khai_thue/api-contract-to-khai-thue.md
  - docs/hrm/to_khai_thue/srs-to-khai-thue.md
  - be_maxv/src/__tests__/hrm/hrmToKhaiThueApi.test.ts
---

# HR — Issues & Bugs (Phase B): `to_khai_thue`

## Tóm tắt

| Mã | Mức | Tiêu đề | Phụ trách | Trạng thái |
|---|---|---|---|---|
| BUG-tkt-001 | 🟡 Medium | Mã nhân viên không tồn tại trả 409 không mã thay vì 404 `E-tkt-016` | backend-engineer | ✅ FIXED 2026-09-15 |
| BUG-tkt-002 | 🔴 High | Danh mục khấu trừ 100% + trả NET: tính thử trả số rỗng, ghi thật lỗi 500 | backend-engineer | ✅ FIXED 2026-09-15 |
| BUG-tkt-003 | 🟡 Medium | Cá nhân không cư trú: nhãn khấu trừ 20% nhưng tính 10% | backend-engineer (chủ dự án chọn chặn) | ✅ FIXED 2026-09-15 |
| ISSUE-tkt-001 | 🔴 High (ngoài cụm) | Engine lương đếm người phụ thuộc không theo kỳ đăng ký, lệch với bảng tính thuế | backend-engineer (chủ dự án chọn sửa luôn) | ✅ FIXED 2026-09-15 |
| ISSUE-tkt-002 | 🟡 Medium | Người không có thu nhập trong kỳ vẫn được đếm vào [16]/[17] | backend-engineer (chủ dự án chọn không đếm) | ✅ FIXED 2026-09-15 |
| ISSUE-tkt-003 | 🟢 Low | Mở lại tháng xóa mất ghi đè chỉ tiêu mà không cảnh báo | BA, frontend khi bật lại | OPEN |
| ISSUE-tkt-004 | 🟢 Low | Kỳ vọng chuẩn hóa chữ hoa `ma_nv` của TC-015 chưa có căn cứ quy ước | tester-qa | ĐÓNG — kết luận gốc sai, lỗi thật gộp vào BUG-tkt-001 |
| ISSUE-tkt-005 | 🟡 Medium (ngoài cụm) | `npm audit` production: 13 lỗ hổng thư viện nền | backend-engineer (task riêng) | OPEN |
| ISSUE-tkt-006 | 🟢 Low | Bộ ca Phase A lệch hợp đồng ở đường dẫn, trường, mã lỗi | tester-qa | Một phần — đã sửa TC-117/118 |

Kết quả chạy lại sau khi sửa: `test-report-to-khai-thue.md` Mục 3 (120/120 ca lá đạt, 0 lỗi).

---

## Bugs

### BUG-tkt-001 🟡 Medium — Mã nhân viên không tồn tại trả 409 không mã thay vì 404 `E-tkt-016`

- **Ca phát hiện:** TC-tkt-021 (P1), kéo theo TC-tkt-015.
- **Bước tái hiện:**
  1. Đăng nhập OWNER, chọn công ty có kỳ lương tháng 10/2026 đang Nháp.
  2. `POST /api/v1/hrm/to-khai-thue/other-income` với thân `{ periodId: <kỳ T10>, ma_nv: "NV9999", fullName: "Người Không Có", otherIncomeCategoryId: <TN11>, paymentDate: "2026-10-05", amount: 1000000 }`.
- **Kỳ vọng:** 404, `code: "E-tkt-016"` (bộ ca TC-021 theo hợp đồng; hợp đồng Mục 0.2 đòi mọi lỗi có trường `code`).
- **Thực tế (lượt 1):** 409 `{"success":false,"message":"Dữ liệu đang được sử dụng ở nơi khác, không thể thực hiện"}` — không có `code`, thông điệp khiến kế toán không biết mình gõ sai mã nhân viên. Gửi `"nv0001"` (chữ thường) cho kết quả y hệt.
- **Nguyên nhân:** `be_maxv/src/services/client/hrm/to_khai_thue/otherIncomeRecord.service.ts` không kiểm nhân viên tồn tại. Lệnh ghi vỡ khóa ngoại `nhan_vien` (P2003), khối `catch` chỉ bắt P2002 nên lỗi rơi xuống `be_maxv/src/plugins/errorHandler.plugin.ts:116-121` (ánh xạ chung 409 "còn được tham chiếu"). Validator `otherIncomeRecord.validator.ts` lại không in hoa `ma_nv` như các màn hồ sơ nhân sự, nên "nv0001" không khớp mã đã lưu "NV0001".
- **Đề xuất sửa:** kiểm `hrm_nhan_vien` theo `ma_nv` ngay trong `tinhSnapshot` (một chỗ dùng chung cho tính thử, tạo, sửa) và ném `E-tkt-016`.
- **Trạng thái:** ~~OPEN~~
  → **FIXED [2026-09-15]** — `be_maxv/src/services/client/hrm/to_khai_thue/otherIncomeRecord.service.ts`:233 kiểm nhân viên có thật và chưa xóa mềm ngay trong `tinhSnapshot` (cùng luật `assertNhanVienTonTai` của hồ sơ hợp đồng) ⇒ 404 `E-tkt-016` · `be_maxv/src/validators/hrm/to_khai_thue/otherIncomeRecord.validator.ts`:25 in hoa `ma_nv` (chuỗi rỗng coi là vãng lai), :76 in hoa bộ lọc `maNv` của danh sách. Không thêm nhánh bắt P2003 cho ca nhân viên bị xóa chen giữa: nhân viên chỉ bị xóa mềm. Hợp đồng Mục 3.4 thêm dòng 4b (mã chờ Architect xác nhận). Kiểm chứng lượt 2: TC-tkt-021 404 `E-tkt-016`, TC-tkt-015 201 lưu `NV0001`. Chưa commit.

### BUG-tkt-002 🔴 High — Danh mục khấu trừ 100% + trả NET: tính thử trả số rỗng, ghi thật lỗi 500

- **Ca phát hiện:** TC-tkt-047 (P0, hai lượt), gốc ở TC-tkt-117 (P0).
- **Bước tái hiện:**
  1. `POST /api/v1/hrm/to-khai-thue/income-categories` `{ name: "Thù lao khấu trừ 100%", taxTreatmentGroup: "WITHHOLDING_FLAT", withholdingRate: 100 }` → 201.
  2. `POST /api/v1/hrm/to-khai-thue/other-income/preview` `{ ma_nv: null, fullName: "Khách Chia Không", otherIncomeCategoryId: <danh mục trên>, paymentDate: "2026-11-20", paymentType: "NET", amount: 5000000 }`.
  3. `POST /api/v1/hrm/to-khai-thue/other-income` cùng thân, thêm `periodId` kỳ T10 và `paymentDate: "2026-10-09"`.
- **Kỳ vọng:** bị chặn 400; không bao giờ trả số rỗng hay lỗi 500.
- **Thực tế (lượt 1):**
  - Bước 2: 200 `"grossAmount":null, "taxDeducted":null`, `explain` "…trả theo số thực nhận ⇒ quy ngược thành ∞đ trước thuế, khấu trừ 100%: ∞đ."
  - Bước 3: 500 `{"success":false,"message":"Lỗi máy chủ nội bộ"}`; không lưu dòng nào (đã đếm DB).
- **Nguyên nhân:** `be_maxv/src/services/client/hrm/to_khai_thue/otherIncomeTax.ts` tính `Math.round(soTien / (1 - tyLe / 100))` — chia cho 0 ra `Infinity`; JSON hóa `Infinity` thành `null`; Postgres từ chối số vô hạn vào cột `Decimal(18,2)` nên rơi xuống nhánh 500 chung.
- **Ảnh hưởng:** tính thử là nguồn số duy nhất của giao diện (NFR-tkt-004) — màn hình sẽ hiện ô trống, kế toán không biết lỗi nằm ở danh mục.
- **Đề xuất sửa (lượt 1):** (1) chặn nhánh NET khi tỷ lệ ≥ 100 bằng lỗi nghiệp vụ có mã; (2) BA chốt biên tỷ lệ khấu trừ hợp lệ của danh mục.
- **Trạng thái:** ~~OPEN~~
  → **FIXED [2026-09-15]** — (1) `be_maxv/src/services/client/hrm/to_khai_thue/otherIncomeTax.ts`:187 chặn nhánh NET khi tỷ lệ ≥ 100 ⇒ 400 `E-tkt-004` kèm hướng dẫn nhập GROSS hoặc sửa tỷ lệ; trả GROSS với tỷ lệ 100% vẫn tính (khấu trừ toàn bộ, thực nhận 0). Chặn nằm ở engine nên phủ cả tính thử, tạo, sửa. (2) Không cần BA: hợp đồng Mục 2.3 đã quy định tỷ lệ hợp lệ là `0..100` ⇒ giữ validator, tester-qa sửa kỳ vọng TC-117/118 thành 201. Hợp đồng Mục 3.4 thêm dòng 5c (mã chờ Architect xác nhận). Kiểm chứng: unit test `be_maxv/src/__tests__/hrm/hrmOtherIncomeTax.test.ts`:187 (đỏ trước khi sửa: "Missing expected exception"; sau khi sửa 14/14) · lượt 2: TC-047 tính thử và ghi đều 400 `E-tkt-004`, 0 dòng được lưu; TC-117/118 đạt. Chưa commit.

### BUG-tkt-003 🟡 Medium — Cá nhân không cư trú: nhãn khấu trừ 20% nhưng tính 10%

- **Ca phát hiện:** KR-tkt-08.
- **Bước tái hiện:** `POST /api/v1/hrm/to-khai-thue/other-income/preview` `{ ma_nv: null, fullName: "Người Nước Ngoài", isResident: false, otherIncomeCategoryId: <TN12>, paymentDate: "2026-11-20", amount: 6000000 }`.
- **Kỳ vọng:** nhãn phương pháp khớp số thuế. SRS Mục 2.2 và bảng trường `isResident` ghi nhánh không cư trú 20% nằm ngoài phạm vi đợt này.
- **Thực tế (lượt 1):** 200 `"taxDeductionType":"FLAT_20","taxRate":10,"taxDeducted":600000`, giải thích "khấu trừ 10% tại nguồn".
- **Nguyên nhân:** `otherIncomeTax.ts` gán nhãn theo `isResident`, còn tỷ lệ lấy của danh mục; validator nhận `isResident: false`.
- **Ảnh hưởng dây chuyền:** dòng bảng tính thuế của người đó có `cu_tru = false` nên tờ khai đưa vào [20]/[23]/[28]/[31] với số thuế tính theo 10%.
- **Hướng sửa:** chủ dự án chọn (2026-09-15) **chặn cho tới khi làm nhánh khấu trừ 20%**.
- **Trạng thái:** ~~OPEN — chờ BA chọn hướng~~
  → **FIXED [2026-09-15]** — `be_maxv/src/services/client/hrm/to_khai_thue/otherIncomeRecord.service.ts`:252 `isResident = false` ⇒ 400 `E-tkt-004` "Chưa hỗ trợ khoản chi trả cho cá nhân không cư trú…". Đặt SAU kiểm Cam kết 08 để ca "Cam kết 08 + không cư trú" vẫn ra `E-tkt-006` (TC-033/050 vẫn đạt). Engine giữ nguyên nhãn FLAT_20 cho đợt làm nhánh 20%. Hợp đồng Mục 3.4 dòng 5b + SRS bảng trường `isResident` đã ghi. Kiểm chứng lượt 2: KR-tkt-08 400 `E-tkt-004` ở tính thử và ghi, 0 dòng `isResident = false` trong DB. Chưa commit.

---

## Issues / Tasks tồn đọng

### ISSUE-tkt-001 🔴 High (ngoài cụm) — Engine lương đếm người phụ thuộc không theo kỳ đăng ký

- **Ca phát hiện:** KR-tkt-11 (lỗi), đối chiếu TC-tkt-106 (đạt).
- **Hiện tượng (lượt 1):** NV0006 có 1 người phụ thuộc đăng ký từ 9/2026. Tháng 8: `GET /api/v1/hrm/payroll/calculate` trả `dependentCount: 1`, thuế 165.000; Bảng tính thuế tháng 8 trả `so_nguoi_phu_thuoc: 0`, thuế 475.000.
- **Nguyên nhân:** `payrollCalculation.service.ts` lấy `emp.nguoi_phu_thuoc.length` (mọi người phụ thuộc); bảng tính thuế dùng `demNguoiPhuThuocTrongKy` đúng A-tkt-05.
- **Ảnh hưởng:** thuế thực khấu trừ trên bảng lương khác số thuế lên tờ khai cho cùng người, cùng tháng.
- **Ghi chú mã:** tài liệu cũ gọi việc này là "BUG-dltl-005", nhưng `du_lieu_tinh_luong/qa-report-du-lieu-tinh-luong.md:429` đã dùng BUG-dltl-005 cho lỗi lịch công chuẩn — không dùng tiếp mã đó.
- **Trạng thái:** ~~OPEN~~
  → **FIXED [2026-09-15]** — chủ dự án chọn sửa luôn trong đợt này. `be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollCalculation.service.ts`:596 dùng `demNguoiPhuThuocTrongKy` (import :11) theo năm/tháng của kỳ lương. Kỳ đã khóa sổ đọc snapshot nên không đổi số; kỳ còn mở và lần khóa sổ sau dùng cách đếm mới. Hợp đồng `du_lieu_tinh_luong` Mục 8.1.1 (`dependentCount`) + dev-notes 1.12 đã ghi. Kiểm chứng: unit test `be_maxv/src/__tests__/hrm/hrmPayrollCalculation.test.ts`:977 (đỏ trước khi sửa: 3 !== 1) · engine lương + dữ liệu tính lương 67/67 · lượt 2 KR-tkt-11: T8 NV0006 engine đếm 0 người, thuế 475.000 bằng Bảng tính thuế. Chưa commit.

### ISSUE-tkt-002 🟡 Medium — Người không có thu nhập trong kỳ vẫn được đếm vào [16]/[17]

- **Ca phát hiện:** KR-tkt-03 (tháng và quý).
- **Hiện tượng (lượt 1):** NV0007 hợp đồng từ 01/10/2026 có 3 dòng 0 đồng trong quý III; dòng tháng vẫn ghi `giam_tru_ban_than` 15.500.000; tờ khai quý đếm người này ở [16] = 8 và [17] = 6.
- **Nguyên nhân:** engine lương lấy mọi nhân viên đang làm, không xét hợp đồng; bảng tính thuế ghi giảm trừ bản thân không điều kiện; `taxDeclarationCalc.ts` đếm mọi người có dòng (đúng data-model Mục 8 lúc đó).
- **Hướng sửa:** chủ dự án chọn (2026-09-15) **không đếm người không được trả đồng nào vào [16]/[17]**; Bảng tính thuế tháng vẫn giữ đủ dòng như bảng lương.
- **Trạng thái:** ~~OPEN — chờ BA quyết~~
  → **FIXED [2026-09-15]** — `be_maxv/src/services/client/hrm/to_khai_thue/taxDeclarationCalc.ts`:118 và :121–122 chỉ đếm người có tổng thu nhập cả quý > 0; chỉ tiêu tiền không đổi (người đó cộng thêm 0). data-model Mục 8 dòng [16]/[17] đã sửa công thức. Q3 kiểm thử: [16] 8 → 7, [17] 6 → 5. Kiểm chứng: unit test `be_maxv/src/__tests__/hrm/hrmTaxDeclarationCalc.test.ts`:108 (đỏ trước khi sửa: 5 !== 4) · lượt 2 TC-077, TC-096 và ca ISSUE-tkt-002 (quý) đạt. Sửa kèm dữ liệu mẫu phi thực tế (thu nhập chịu thuế > 0 nhưng tổng thu nhập = 0) ở `hrmTaxDeclaration.test.ts`:72 và `hrmTaxDeclarationCalc.test.ts`:43. Còn lại theo đúng lựa chọn: dòng 0 đồng trên bảng tháng vẫn hiện giảm trừ bản thân (chỉ hiển thị, thuế = 0). Chưa commit.

### ISSUE-tkt-003 🟢 Low — Mở lại tháng xóa mất ghi đè chỉ tiêu mà không cảnh báo

- **Ca phát hiện:** KR-tkt-19 (TC-072, 073 đạt).
- **Hiện tượng:** quý đang sẵn sàng xuất, kế toán đã ghi đè [22] kèm lý do; OWNER mở lại tháng 9 thì dòng tờ khai bị xóa (đúng BR-tkt-013 bản sửa); chốt lại thì tờ khai sẵn sàng xuất trở lại với ghi đè rỗng. Lý do ghi đè biến mất, không có cảnh báo. Lượt 2 vẫn như vậy.
- **Vị trí:** `be_maxv/src/services/client/hrm/to_khai_thue/taxSheet.service.ts:424-431`.
- **Việc cần quyết (BA):** (a) giữ `ghi_de` qua lần mở lại, chỉ xóa số máy — phải đổi vòng đời dòng tờ khai (data-model/ADR); hoặc (b) giữ hành vi hiện tại và giao diện cảnh báo "mở lại sẽ xóa N ghi đè" trước khi xác nhận.
- **Trạng thái:** OPEN

### ISSUE-tkt-004 🟢 Low — Kỳ vọng chuẩn hóa chữ hoa `ma_nv` của TC-015 chưa có căn cứ quy ước

- **Ca phát hiện:** TC-tkt-015.
- **Mô tả (lượt 1):** bộ ca coi chuẩn hóa `ma_nv` về chữ hoa là "quy ước chung của HRM", nhưng không validator nào trong `be_maxv/src/validators/hrm` chuẩn hóa `ma_nv`.
- **Trạng thái:** **ĐÓNG [2026-09-15] — kết luận gốc SAI.** Lượt 1 chỉ tìm `toUpperCase` trên cùng dòng với `ma_nv` nên bỏ sót: validator nhân viên (`maNvTuyChon`), hợp đồng và người phụ thuộc đều in hoa `ma_nv`, mã nhân viên luôn được lưu in hoa ⇒ kỳ vọng của TC-015 đúng. Lỗi thật là validator thu nhập ngoài lương thiếu bước in hoa — đã sửa cùng BUG-tkt-001, TC-015 đạt ở lượt 2. Ghi chú ngoài cụm: `be_maxv/src/validators/hrm/du_lieu_tinh_luong/inputs.validator.ts` (chấm công, chuyên cần) cũng chưa in hoa `ma_nv` — chưa kiểm hành vi.

### ISSUE-tkt-005 🟡 Medium (ngoài cụm) — `npm audit` production: 13 lỗ hổng thư viện nền

- **Kết quả `npm audit --omit=dev` (2026-09-15):** high — `fast-uri`, `find-my-way`, `nodemailer`, `sharp`, `prisma` (qua `@prisma/config`, `deepmerge-ts`, `mysql2`); moderate — `fastify`, `hono`, `@hono/node-server`, `valibot`.
- **Không do cụm này:** các commit `to_khai_thue` chỉ thêm script `hrm:seed-thue` vào `be_maxv/package.json`, không thêm thư viện.
- **Việc cần làm:** task riêng nâng phiên bản, chạy lại toàn bộ test sau khi nâng.
- **Trạng thái:** OPEN

### ISSUE-tkt-006 🟢 Low — Bộ ca Phase A lệch hợp đồng

- **Mô tả:** `test-cases-to-khai-thue.md` viết trước khi có hợp đồng: đường dẫn và trường cũ (TC-124), TC-003 (bỏ trống và `null`), TC-011 (`PATCH` thay vì `PUT`), TC-113/114 (404 thay vì 400 `E-tkt-017` cho kỳ của tenant khác), quy ước "mọi POST trả 201" (tính thử trả 200), TC-117/118 (tỷ lệ 100% và 0%). Bản chạy đã theo hợp đồng — chi tiết ở `test-report-to-khai-thue.md` Mục 5.
- **Trạng thái:** Một phần — [2026-09-15] đã sửa dòng TC-117/118 trong bảng ca; các lệch còn lại vẫn chỉ ghi ở test-report Mục 5.

---

## Tồn đọng từ trước (không phải phát hiện mới của Phase B)

- `GAP-QA-tkt-01` — khoản chịu thuế toàn phần trả NET đang chặn bằng `E-tkt-004` (TC-044 đạt theo hành vi tạm).
- `OQ-tkt-03` (mức trần trang phục) · `OQ-tkt-05` (chỉ tiêu [24], [25], [32] để 0, kế toán ghi đè).
- Chưa có nơi lưu "cơ quan thuế quản lý" — ô này trên file tờ khai để trống; phần đầu mẫu chưa đánh số [01]–[15].
- Hai lỗ hổng đặc tả từ bước 5: người thời vụ/thử việc có khoản chịu thuế toàn phần, và người không có hợp đồng hiệu lực nhận thưởng — cả hai chưa phát sinh thuế trên khoản đó.
- Giao diện nháp `hdđt_maxv` còn gọi route cũ đã bỏ — sửa khi bật lại frontend.
- TC-tkt-107 chưa chạy (cần bản sao DB có dữ liệu quý I/II kiểu cũ) · nhánh xuất PDF chưa kiểm qua endpoint.

---

## Phase B giao diện (`hdđt_maxv`, 2026-09-16)

| Mã | Mức | Tiêu đề | Phụ trách | Trạng thái |
|---|---|---|---|---|
| BUG-fe-tkt-001 | 🔴 High | Bấm hai lần nút "Xuất tờ khai" (và "Chốt tháng") vẫn gửi được hai lệnh | frontend-engineer | FIXED 2026-09-16 |
| BUG-fe-tkt-002 | 🟡 Medium | Bốn thao tác chỉ dành ADMIN/OWNER không khóa nút theo vai | frontend-engineer | FIXED 2026-09-16 |
| BUG-fe-tkt-003 | 🟡 Medium | Xuất Excel thu nhập ngoài lương chỉ ra trang đang xem, trong khi dòng tổng nói "toàn bộ bộ lọc" | frontend-engineer | FIXED 2026-09-16 |
| BUG-fe-tkt-004 | 🟡 Medium | Hai route `bang-tinh-thue-hdld` / `bang-tinh-thue-hddv` không có lối vào, không có trong đặc tả | frontend-engineer | FIXED 2026-09-16 |
| BUG-fe-tkt-005 | 🟢 Low | Ô "Cam kết 08" và "Yêu cầu khấu trừ" bật được cả khi danh mục không thuộc nhóm khấu trừ tại nguồn | frontend-engineer | FIXED 2026-09-16 |
| BUG-fe-tkt-006 | 🟢 Low | Trường chết `laChiTieuGoc` còn trong `tncn05Layout.ts`, lại thiếu `ct16` | frontend-engineer | FIXED 2026-09-16 |

### BUG-fe-tkt-001 🔴 High — Bấm hai lần nút "Xuất tờ khai" vẫn gửi được hai lệnh

- **Vị trí:** `hdđt_maxv/src/features/hrm/components/XacNhanXoaDialog.tsx` (nút xác nhận không nhận `disabled`); nơi dùng: `to_khai_tncn/ToKhaiTncn05Panel.tsx` (Xuất tờ khai) và `bang_tinh_thue/BangTinhThuePanel.tsx` (Chốt tháng).
- **Hiện tượng:** hai nơi này chỉ đổi NHÃN nút thành "Đang xuất…" / "Đang chốt…", còn nút vẫn bấm được cho tới khi dialog đóng ở nhánh `finally`. Bấm nhanh hai lần là gửi hai lệnh.
- **Vì sao nghiêm trọng:** xuất tờ khai là việc KHÔNG lùi lại được (khóa vĩnh viễn ba tháng của quý). Máy chủ có chặn lần hai (409 `E-tkt-020` cho xuất, 409 `E-tkt-018` cho chốt) nên dữ liệu không hỏng, nhưng người dùng nhận một toast thành công lẫn một toast lỗi cùng lúc, và với PDF thì chạy Puppeteer hai lượt vô ích, có thể chạm hàng đợi (429).
- **Đối chiếu:** hai nút cùng loại đã làm đúng — "Mở lại tháng" (`MoLaiBangTinhThueDialog.tsx`) và "Đánh dấu đã nộp" (`ToKhaiTncn05Panel.tsx`) đều khóa nút khi đang chạy.
- **Đề xuất fix:** thêm prop `dangXuLy` (hoặc `disabled`) cho `XacNhanXoaDialog`, truyền `xuatMut.isPending` và `chotMut.isPending` ở hai nơi gọi.
- **Trạng thái:** ~~OPEN~~ FIXED [2026-09-16] — `XacNhanXoaDialog.tsx` nhận thêm prop `dangXuLy`, khóa cả nút Hủy lẫn nút xác nhận khi đang gửi; `ToKhaiTncn05Panel.tsx` truyền `xuatMut.isPending`, `BangTinhThuePanel.tsx` truyền `chotMut.isPending`.

### BUG-fe-tkt-002 🟡 Medium — Bốn thao tác chỉ dành ADMIN/OWNER không khóa nút theo vai

- **Vị trí:** `bang_tinh_thue/BangTinhThuePanel.tsx` (Mở lại tháng); `to_khai_tncn/ToKhaiTncn05Panel.tsx` (Xuất tờ khai, Tải lại file, Đánh dấu đã nộp).
- **Hiện tượng:** người có quyền xem lương nhưng không phải ADMIN/OWNER vẫn thấy đủ nút, bấm được, với "Mở lại" còn phải gõ đủ 20 ký tự lý do rồi mới nhận 403 `E-tkt-014`.
- **Đối chiếu:** cùng khu HRM đã có `chot_ky_luong/useLaChuTaiKhoan.ts` dùng cho các nút vòng đời kỳ lương, kèm ghi chú "khóa nút chỉ để báo sớm, máy chủ mới là hàng rào thật".
- **Đề xuất fix:** dùng lại `useLaChuTaiKhoan()` để khóa bốn nút trên kèm tooltip giải thích.
- **Trạng thái:** ~~OPEN~~ FIXED [2026-09-16] — dùng lại `chot_ky_luong/useLaChuTaiKhoan.ts`: bốn thao tác (mở lại tháng, xuất tờ khai, tải lại file, đánh dấu đã nộp) khóa nút kèm tooltip giải thích. Máy chủ vẫn là bên chặn thật.

### BUG-fe-tkt-003 🟡 Medium — Xuất Excel chỉ ra trang đang xem

- **Vị trí:** `thu_nhap_ngoai_luong/ThuNhapNgoaiLuongPanel.tsx` — `xuatExcel()` ghi đúng `data.records`, tức là trang hiện tại (25/50/100 dòng).
- **Hiện tượng:** ngay phía trên bảng có dòng "Tổng tính trên toàn bộ bộ lọc, không riêng trang đang xem", nên kế toán tin file đã đủ. Kỳ nào có nhiều hơn một trang là file thiếu dòng mà không có cảnh báo nào.
- **Đề xuất fix:** trước khi xuất thì gọi lại danh sách với `limit` đủ lớn theo `summary.totalRecords`, hoặc đổi nhãn nút thành "Xuất Excel (trang đang xem)".
- **Trạng thái:** ~~OPEN~~ FIXED [2026-09-16] — `xuatExcel()` tải lần lượt từng trang 500 dòng (trần `limit` của hợp đồng) cho tới khi đủ `summary.totalRecords` rồi mới dựng file, nên file khớp đúng dòng tổng trên màn.

### BUG-fe-tkt-004 🟡 Medium — Hai route không có lối vào, không có trong đặc tả

- **Vị trí:** `hdđt_maxv/src/routes/AppRouter.tsx` — `bang-tinh-thue-hdld` và `bang-tinh-thue-hddv`, cả hai render đúng `BangTinhThuePanel`.
- **Hiện tượng:** `MAN_HINH_TO_KHAI_THUE` không có hai path này nên thanh tab không bao giờ dẫn tới; panel cũng không đọc đường dẫn để phân biệt, nên ba route hiện y hệt nhau. SRS Mục 0 chỉ có ba màn.
- **Quyết định của chủ dự án [2026-09-16]:** xóa, không tách bảng theo loại hợp đồng.
- **Trạng thái:** ~~OPEN~~ FIXED [2026-09-16] — gỡ hai `<Route>` và hai path tương ứng trong danh sách loại trừ ở `routes/AppRouter.tsx`; grep xác nhận không còn nơi nào nhắc tới. Ba lệnh kiểm chạy lại đều sạch.

### BUG-fe-tkt-005 🟢 Low — Cam kết 08 không phụ thuộc nhóm danh mục

- **Vị trí:** `thu_nhap_ngoai_luong/ThuNhapNgoaiLuongDialog.tsx` — hai ô tích luôn bật được, `soatForm()` chỉ kiểm thiếu mã số thuế.
- **Hiện tượng:** BR-tkt-008 đòi cam kết 08 chỉ hợp lệ khi nhóm là khấu trừ tại nguồn, cá nhân cư trú và có mã số thuế. Chọn danh mục nhóm khác rồi tích cam kết 08 vẫn gửi được, máy chủ mới chặn bằng 400 `E-tkt-006`.
- **Đề xuất fix:** khóa hai ô tích khi nhóm của danh mục đang chọn không phải `WITHHOLDING_FLAT`.
- **Trạng thái:** ~~OPEN~~ FIXED [2026-09-16] — hai ô tích khóa khi danh mục đang chọn không thuộc nhóm khấu trừ tại nguồn, và `soatForm()` chặn thêm trường hợp tích cam kết 08 ở nhóm khác (BR-tkt-008).

### BUG-fe-tkt-006 🟢 Low — Trường chết `laChiTieuGoc`

- **Vị trí:** `to_khai_tncn/tncn05Layout.ts` — trường gán cho 12 chỉ tiêu (thiếu `ct16`) nhưng không nơi nào đọc.
- **Hiện tượng:** vừa thừa vừa sai. Ai đó "tối ưu" chuyển sang dùng trường này thay cho `ctGocSuaDuoc` là tái tạo đúng lỗi bản sao thứ hai mà SRS đã cảnh báo, kèm mất khả năng sửa `ct16`.
- **Đề xuất fix:** xóa trường khỏi interface và dữ liệu.
- **Trạng thái:** ~~OPEN~~ FIXED [2026-09-16] — xóa trường `laChiTieuGoc` khỏi `HangChiTieuTncn05` và toàn bộ dữ liệu; chỉ tiêu sửa được chỉ còn một nguồn là `ctGocSuaDuoc` của máy chủ.

### Ghi nhận không lập lỗi riêng

- ~~Bốn hook đã export nhưng chưa màn nào dùng~~ — [2026-09-16] đã xóa cả 4 hook, 4 hàm API, 4 khóa truy vấn và 2 kiểu dữ liệu tương ứng; tầng API nay nối 19/23 endpoint, phần còn lại viết khi dựng màn cần tới.
- `lib/apiClient.ts` thêm tham số `body` cho `api.del` nhưng không nơi nào truyền — di sản của hướng đi đã bỏ.
- Ba file vượt 430 dòng, lớn hơn mức quen thuộc của khu HRM (đỉnh cũ 358 dòng) — nên tách bớt khi có dịp.
- Số trường của `DongBangTinhThueDto`: hợp đồng Mục 4.1 ghi 25, đếm trong mã được 24 — cần đối chiếu `data-model-to-khai-thue.md` Mục 3.4 để biết bên nào đếm nhầm.
