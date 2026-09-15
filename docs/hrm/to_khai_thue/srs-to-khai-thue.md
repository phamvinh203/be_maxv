---
type: srs
feature: hrm-to-khai-thue
status: draft
updated: 2026-09-14
author: business-analyst
links:
  - docs/hrm/CONTEXT_SUMMARY.md
  - docs/hrm/srs/hrm-spec.md
  - docs/hrm/to_khai_thue/brainstorms/2026-09-14-to-khai-thue-tncn-brainstorm.md
  - docs/hrm/du_lieu_tinh_luong/srs-du-lieu-tinh-luong.md
  - docs/hrm/cai_dat_luong/srs-cai-dat-luong.md
---

# HR — Đặc tả Yêu cầu Nghiệp vụ: Thu nhập ngoài lương, Bảng tính thuế & Tờ khai thuế TNCN (Extra Income, Tax Calculation & PIT Declaration Specification)

Sub-cụm `to_khai_thue` của phân hệ Quản trị Nhân sự (HRM) trên hệ thống `be_maxv`, gồm 3 màn hình: **Thu nhập ngoài lương** (`thu-nhap-ngoai-luong`), **Bảng tính thuế** (`bang-tinh-thue`), **Tờ khai thuế TNCN** (`to-khai-tncn`). Hai tab còn lại đã khai báo sẵn ở giao diện (`to-khai-quyet-toan`, `doi-soat-cong-thuc`) nằm ngoài phạm vi đợt này.

Tài liệu này hình thức hóa 7 Business Rule (BR-01 đến BR-07) đã chốt trong `docs/hrm/to_khai_thue/brainstorms/2026-09-14-to-khai-thue-tncn-brainstorm.md` thành các quy tắc có mã ID prefix `tkt`, có thể truy vết và kiểm thử. Prefix `tkt` được chọn theo đúng khuyến nghị brainstorm, không trùng `sal` (`cai_dat_luong`) hay `dltl` (`du_lieu_tinh_luong`).

**Quan hệ với `srs/hrm-spec.md`:** biểu thuế TNCN 5 bậc, giảm trừ gia cảnh và toàn vẹn cấu trúc biểu thuế (`GeneralSetting.taxBrackets`/`personalDeduction`/`dependentDeduction`) là cấu hình DÙNG CHUNG đã được đặc tả và ký duyệt tại `srs/hrm-spec.md` Mục 4.8, `BR-hrm-080` đến `BR-hrm-084`, `FR-hrm-045…047/055`, `A-hrm-11/12` (đã sửa riêng biệt ngày 2026-09-14 theo Luật 109/2025/QH15 — xem `CONTEXT_SUMMARY.md` Mục 15.2b). Tài liệu này **không lặp lại** các quy tắc đó — chỉ **tham chiếu** và đặc tả phần **MỚI**: danh mục thu nhập ngoài lương, bản ghi thu nhập ngoài lương, lớp tính thuế mở rộng gộp thu nhập ngoài lương, tổng hợp quý, và tờ khai mẫu 05/KK-TNCN.

---

## 0. Bối cảnh & Căn cứ pháp lý mới

Khung pháp lý thuế TNCN Việt Nam đổi toàn diện từ kỳ tính thuế 2026: Luật Thuế TNCN số 109/2025/QH15 (10/12/2025, sửa bởi Luật 09/2026/QH16), Nghị quyết 110/2025/UBTVQH15 (giảm trừ gia cảnh), Nghị định 253/2026/NĐ-CP (ngưỡng khấu trừ, giảm trừ khác), Thông tư 87/2026/TT-BTC (thay Thông tư 111/2013/TT-BTC), Thông tư 89/2026/TT-BTC (mẫu 05/KK-TNCN, kỳ khai). Toàn bộ số liệu trong Mục 5 dưới đây được copy nguyên văn từ brainstorm, không tự suy diễn số khác.

---

## 1. Mục tiêu nghiệp vụ (Business Goals)

| # | Mục tiêu | Đo bằng gì |
|---|---|---|
| G1 | Ghi nhận chuẩn hóa mọi khoản thu nhập chịu thuế TNCN mà người lao động/cá nhân nhận **ngoài lương cơ bản**, với quy tắc chịu thuế/miễn thuế/khấu trừ đúng luật cho từng loại | Danh mục loại thu nhập cấu hình được, sửa được khi luật đổi mà không cần deploy code |
| G2 | Tính đúng thuế TNCN tháng theo biểu lũy tiến hiện hành, gộp đầy đủ thu nhập ngoài lương vào thu nhập chịu thuế trước khi tính | Số thuế "Bảng tính thuế" khớp công thức BR-tkt-012, có thể đối chiếu tay từng bậc |
| G3 | Cung cấp số liệu tổng hợp quý và tờ khai đúng mẫu 05/KK-TNCN để kế toán tự nộp qua HTKK/eTax, không phải tính tay lại | Tờ khai xuất Excel/PDF có đủ 17 chỉ tiêu `ct16`–`ct32`, số liệu khớp bảng chi tiết nội bộ |
| G4 | Không mất dữ liệu lịch sử khi luật thuế thay đổi giữa chừng (đã xảy ra 2 lần trong 2026) | Biểu thuế/giảm trừ cũ và mới cùng tồn tại, tra đúng theo kỳ tính thuế của từng bản ghi (BR-tkt-017) |

---

## 2. Phạm vi (Scope)

### 2.1 Trong phạm vi

| Nhóm | Nội dung |
|---|---|
| Danh mục loại thu nhập ngoài lương | CRUD danh mục cấu hình được (không hardcode), seed mặc định theo luật hiện hành, 4 nhóm xử lý thuế |
| Thu nhập ngoài lương | Ghi/sửa/xóa bản ghi theo nhân viên nội bộ **hoặc** cá nhân vãng lai/CTV, theo kỳ tháng; xem danh sách kèm KPI tổng hợp |
| Bảng tính thuế | Tính thuế TNCN tháng gộp thu nhập ngoài lương vào thu nhập chịu thuế; chốt/mở lại theo tháng; tổng hợp theo quý |
| Tờ khai thuế TNCN | Xuất đúng mẫu 05/KK-TNCN (Excel + PDF) theo quý, kèm bảng chi tiết nhân viên nội bộ; ghi đè chỉ tiêu có lý do; đánh dấu đã nộp |

### 2.2 Ngoài phạm vi đợt này

Tab `to-khai-quyet-toan` (quyết toán năm, mẫu 05/QTT-TNCN) · Tab `doi-soat-cong-thuc` · Nộp tờ khai điện tử tự động qua GDT (không có API mở, cần đăng ký T-VAN) · Cá nhân không cư trú (khấu trừ 20% flat) — hệ thống ghi nhận enum tồn tại nhưng KHÔNG bắt buộc đúng đắn hoàn chỉnh cho luồng này đợt này, tập trung cá nhân cư trú có HĐLĐ ≥3 tháng và vãng lai/thử việc/thời vụ có xử lý khấu trừ 10% · Tự động đối chiếu chứng từ chi để tự nhận diện khoản ngoài lương (OCR/matching) · Rà soát/tính lại dữ liệu payroll các kỳ ĐÃ CHỐT trước ngày áp dụng biểu thuế mới (cần quyết định riêng, xem OQ-tkt-01) · Cơ chế "khai bổ sung" sau khi tờ khai quý đã ở trạng thái Đã xuất tờ khai (chỉ ghi nhận là hạn chế biết trước, xem Mục 12 EC-tkt-03) · Tự động cộng dồn thu nhập của 1 cá nhân có nhiều nguồn ngoài hệ thống (2 công ty cùng MST) — cá nhân đa nguồn tự quyết toán riêng.

---

## 3. Tác nhân (Actors)

| Tác nhân | Vai trò nghiệp vụ | Ánh xạ vào hệ thống phân quyền hiện có |
|---|---|---|
| Kế toán dịch vụ / nhân viên nhập liệu | Tạo/sửa/xóa danh mục và bản ghi thu nhập ngoài lương; xem Bảng tính thuế; xuất tờ khai | Người có **quyền xem dữ liệu lương** trong phạm vi `OWNER_EMPLOYEE` (BR-hrm-059) hoặc `OWNER` — vì đây là dữ liệu tài chính nhạy cảm tương đương Hợp đồng/Bảng lương |
| Kế toán trưởng / chủ doanh nghiệp khách hàng | Chốt Bảng tính thuế tháng, mở lại khi cần, xuất tờ khai, đánh dấu đã nộp — thao tác tài chính nhạy cảm | Đề xuất cùng ngưỡng "quyền xem dữ liệu lương" ở trên; vai trò hệ thống cụ thể (có tách riêng khỏi thao tác nhập liệu thường hay không) do Architect xác nhận — xem A-tkt-08 |
| Hệ thống (tự động) | Tự tính Bảng tính thuế tháng khi có đủ dữ liệu lương + thu nhập ngoài lương; tự tổng hợp quý khi đủ điều kiện | — |

---

## 4. Dữ liệu / Thực thể (Entities)

4 thực thể mới cho sub-cụm này (đánh dấu `[ĐỀ XUẤT]` do brainstorm chưa đặt tên kỹ thuật, suy luận từ code FE nháp đã có sẵn và pattern schema hiện có) — xem ghi chú đối soát với mã nguồn/giao diện hiện có ở Mục 14.

### 4.1 Danh mục loại thu nhập ngoài lương — `OtherIncomeCategory` → `hrm_other_income_categories` `[ĐỀ XUẤT]`

| Trường | B/T | Kiểu | Mặc định | Ý nghĩa nghiệp vụ & Ràng buộc |
|---|---|---|---|---|
| `id` | Hệ thống | String (uuid) | — | Định danh kỹ thuật |
| `code` | T khi tạo | String ≤20 | tự sinh `TN01`–`TN99` | Mã danh mục, tự sinh quét gap (cùng khuôn mẫu `KL01` của `SalaryItem`, `CA01` của `WorkShift`) hoặc tự nhập; duy nhất trong tenant |
| `name` | **B** | String ≤200 | — | Tên loại thu nhập hiển thị cho kế toán (vd "Ăn ca tiền mặt", "Hoa hồng đại lý", "Thưởng Tết"); duy nhất trong tenant, không phân biệt hoa/thường (BR-tkt-003) |
| `taxTreatmentGroup` | **B** | Enum `EXEMPT_FULL` / `EXEMPT_CAPPED` / `TAXABLE_FULL` / `WITHHOLDING_FLAT` | — | Nhóm xử lý thuế theo BR-tkt-001: miễn 100% / miễn có ngưỡng / chịu thuế toàn phần (cộng lũy tiến) / khấu trừ riêng theo tỷ lệ cố định |
| `exemptCapAmount` | T, **B nếu** nhóm = `EXEMPT_CAPPED` | Decimal(15,2) | — | Ngưỡng miễn thuế (vd 1.200.000 cho ăn ca tiền mặt/tháng, 5.000.000 cho trang phục/năm) |
| `exemptCapPeriod` | T, **B nếu có** `exemptCapAmount` | Enum `MONTHLY` / `YEARLY` | `MONTHLY` | Chu kỳ áp ngưỡng miễn |
| `withholdingRate` | T, **B nếu** nhóm = `WITHHOLDING_FLAT` | Decimal(5,2) | `10.0` | Tỷ lệ khấu trừ riêng (%) — BR-tkt-008 |
| `withholdingThreshold` | T, **B nếu** nhóm = `WITHHOLDING_FLAT` | Decimal(15,2) | `5000000` | Ngưỡng số tiền/lần chi trả bắt đầu phải khấu trừ (BR-tkt-008) |
| `legalBasisNote` | T | String ≤500 | — | Ghi chú căn cứ pháp lý hiển thị cho kế toán (vd "Điều 3 TT 87/2026, thay TT 111/2013") |
| `status` | T | Enum `ACTIVE` / `INACTIVE` | `ACTIVE` | Ngừng dùng thay vì xóa cứng khi đã phát sinh bản ghi (BR-tkt-004) |
| `createdAt` / `updatedAt` | Hệ thống | DateTime | — | |

**Trường tính lúc đọc:** `appliesToInternalOnly` (Đúng khi `taxTreatmentGroup` ∈ {`EXEMPT_FULL`, `EXEMPT_CAPPED`, `TAXABLE_FULL`}; Sai khi `WITHHOLDING_FLAT`) — quyết định danh mục có hiển thị cho cá nhân vãng lai khi ghi nhận hay không (BR-tkt-009). Không lưu thành cột riêng, tránh 2 nguồn sự thật.

### 4.2 Bản ghi thu nhập ngoài lương — `OtherIncomeRecord` → `hrm_other_income_records` `[ĐỀ XUẤT — tên đã khớp `OtherIncomeRecordDto` ở FE]`

| Trường | B/T | Kiểu | Mặc định | Ý nghĩa nghiệp vụ & Ràng buộc |
|---|---|---|---|---|
| `id` | Hệ thống | String (uuid) | — | |
| `payrollPeriodId` | **B** | FK → `hrm_payroll_periods` | — | Kỳ lương THÁNG ghi nhận khoản chi trả — quyết định bản ghi thuộc tháng nào để gộp vào Bảng tính thuế |
| `ma_nv` | T | String ≤24 (FK `hrm_nhan_vien`) | `null` | Có giá trị khi đối tượng là nhân viên nội bộ; `null` khi là cá nhân vãng lai |
| `otherIncomeCategoryId` | **B** | FK → `hrm_other_income_categories` | — | Loại thu nhập, quyết định cách tính thuế (BR-tkt-007) |
| `fullName` | **B** | String ≤254 | — | Họ tên người nhận (nội bộ đồng bộ từ `hrm_nhan_vien.ho_ten` lúc chọn, vẫn lưu bản sao để không phụ thuộc hồ sơ có thể đổi sau) |
| `taxCode` | T | String | — | Mã số thuế cá nhân — **bắt buộc khi** `hasCommitment08 = true` (E-tkt-006) |
| `idCardNumber` | T | String ≤20 | — | Số CCCD/hộ chiếu |
| `address` / `phone` / `email` | T | String | — | Thông tin liên hệ (chỉ thật sự cần với vãng lai; nội bộ đồng bộ từ hồ sơ nhân viên) |
| `isResident` | **B** | Boolean | `true` | Cá nhân cư trú tại Việt Nam — quyết định thuế suất khấu trừ riêng khi nhóm `WITHHOLDING_FLAT` (nhánh không cư trú 20% nằm ngoài phạm vi đợt này, xem Mục 2.2). `[SỬA 2026-09-15 — BUG-tkt-003]` Đợt này chỉ nhận `true`: gửi `false` bị từ chối 400 `E-tkt-004` cho tới khi làm nhánh 20% — chủ dự án chọn chặn thay vì để số thuế sai lên tờ khai |
| `paymentDate` | **B** | Date | — | Ngày chi trả thực tế; phải nằm trong tháng của `payrollPeriodId` |
| `paymentType` | **B** | Enum `GROSS` / `NET` | `GROSS` | Số tiền nhập là trước hay sau thuế — quyết định công thức quy đổi (BR-tkt-007) |
| `grossAmount` | Hệ thống (tính) | Decimal(15,2) | — | Số tiền trước thuế |
| `netAmount` | Hệ thống (tính) | Decimal(15,2) | — | Số tiền thực nhận sau thuế |
| `taxWithheld` | Hệ thống (tính) | Decimal(15,2) | `0` | Thuế đã khấu trừ riêng của bản ghi này — chỉ > 0 khi nhóm `WITHHOLDING_FLAT` áp dụng thật; = 0 với nhóm miễn hoặc nhóm chịu thuế toàn phần (phần đó cộng lũy tiến ở Bảng tính thuế, không khấu trừ tại đây) |
| `hasCommitment08` | T | Boolean | `false` | Cá nhân có Cam kết 08/CK-TNCN — chỉ hợp lệ khi nhóm `WITHHOLDING_FLAT` và `isResident = true` và có `taxCode` |
| `eWithholdingCertNo` / `eWithholdingCertDate` | T | String / Date | — | Số và ngày lập chứng từ khấu trừ thuế điện tử (khi có khấu trừ thật) |
| `note` | T | String ≤2000 | — | Ghi chú nội dung chi trả |
| `createdAt` / `updatedAt` | Hệ thống | DateTime | — | |

**Nguyên tắc bất biến snapshot `[ĐỀ XUẤT]`:** cùng khuôn mẫu đã dùng cho `PieceworkRecord.unitPrice` (BR-dltl-014) và `CommissionRecord.commissionRate` (BR-dltl-016) — `taxTreatmentGroup`, `withholdingRate`, `exemptCapAmount` của danh mục tại **thời điểm tạo bản ghi** nên được Architect cân nhắc sao chép cố định vào bản ghi (không tham chiếu động), để tránh việc sửa danh mục sau này làm đổi ngược số thuế của các bản ghi cũ đã tính (xem A-tkt-09).

### 4.3 Dòng Bảng tính thuế tháng theo nhân viên — `MonthlyTaxCalculationLine` → `hrm_tax_calculation_lines` `[ĐỀ XUẤT]`

> Field đặt theo đúng tên Vietnamese-snake đã có sẵn ở `DongBangTinhThueDto` (FE nháp `hdđt_maxv/.../types/toKhaiThue.ts`) — khác phong cách English-camelCase của engine tính lương hiện có (`payrollCalculation.service.ts` dùng `grossIncome`, `taxableIncome`, `personalIncomeTax`...). Đây là 1 điểm cần Architect thống nhất tên field khi viết `api-contract.md` (xem Mục 14 điểm 5).

| Trường | Nguồn | Ý nghĩa |
|---|---|---|
| `id` | Hệ thống | |
| `payrollPeriodId` | FK `hrm_payroll_periods` | Kỳ tháng |
| `ma_nv` | FK `hrm_nhan_vien`, nullable | `null` khi dòng đại diện 1 cá nhân vãng lai không có hồ sơ nhân viên |
| `otherIncomeRecordId` | FK `hrm_other_income_records`, nullable | Có giá trị khi dòng phát sinh từ 1 bản ghi vãng lai không gắn `ma_nv` |
| `ho_ten`, `mst_ca_nhan`, `so_cccd` | Tính lúc đọc | Nội bộ tra `hrm_nhan_vien`; vãng lai tra `hrm_other_income_records` |
| `loai_lao_dong` | Tính lúc đọc | `HOP_DONG_3_THANG_TRO_LEN` / `THOI_VU_THU_VIEC` / `VANG_LAI` — cách phân loại ở BR-tkt-011 |
| `cu_tru` | Tính lúc đọc | Cờ cá nhân cư trú |
| `so_nguoi_phu_thuoc` | Tính lúc đọc | Số người phụ thuộc hợp lệ trong tháng, tra `hrm_nguoi_phu_thuoc` theo kỳ đăng ký — chỉ áp dụng khi `loai_lao_dong = HOP_DONG_3_THANG_TRO_LEN` |
| `thu_nhap_luong` | Tính từ `payrollCalculation`/`hrm_payroll_sheet_lines` | Thu nhập chịu thuế từ bảng lương chính trong tháng |
| `thu_nhap_ngoai` | Tính từ `hrm_other_income_records`: nhóm `TAXABLE_FULL` + phần vượt trần của `EXEMPT_CAPPED` + **toàn bộ khoản `WITHHOLDING_FLAT` theo số gross** `[SỬA 2026-09-15]` | Tổng thu nhập ngoài lương chịu thuế trong tháng — gồm cả khoản đã khấu trừ riêng, để tờ khai quý báo đủ thu nhập ở chỉ tiêu [22]/[23] |
| `thu_nhap_khau_tru_rieng` `[MỚI 2026-09-15]` | = Σ gross các khoản `WITHHOLDING_FLAT` của người đó trong tháng | Phần của `thu_nhap_ngoai` đã khấu trừ riêng theo tỷ lệ cố định — **không** cộng vào nền lũy tiến (BR-tkt-001) |
| `tong_thu_nhap` | = `thu_nhap_luong` + `thu_nhap_ngoai` | |
| `thu_nhap_mien_thue` | Tính | Tổng phần miễn thuế đã loại trừ khỏi lương chính (OT vượt chuẩn BR-dltl-025, phụ cấp vượt trần miễn theo cấu hình) |
| `thu_nhap_chiu_thue` | = `tong_thu_nhap` − `thu_nhap_mien_thue` | |
| `giam_tru_ban_than` | = `GeneralSetting.personalDeduction` hiệu lực tại kỳ | Chỉ áp khi `loai_lao_dong = HOP_DONG_3_THANG_TRO_LEN` |
| `giam_tru_phu_thuoc` | = `so_nguoi_phu_thuoc` × `GeneralSetting.dependentDeduction` hiệu lực tại kỳ | nt |
| `giam_tru_bao_hiem` | BH bắt buộc NLĐ đóng + BH hưu trí tự nguyện (tối đa 3.000.000đ/tháng, BR-tkt-010) + từ thiện/nhân đạo/khuyến học hợp lệ trong năm | nt |
| `tong_giam_tru` | = 3 dòng trên cộng lại | Chỉ khác 0 khi `phuong_phap_tinh = LUY_TIEN` |
| `thu_nhap_tinh_thue` | = max(0, `thu_nhap_chiu_thue` − `thu_nhap_khau_tru_rieng` − `tong_giam_tru`) `[SỬA 2026-09-15]` | Chỉ áp cho nhánh lũy tiến |
| `phuong_phap_tinh` | Tính | `LUY_TIEN` / `KHAU_TRU_10` / `KHAU_TRU_20` (ngoài phạm vi) / `CAM_KET_08` / `DUOI_NGUONG` |
| `thue_luy_tien` | = biểu BR-hrm-081 áp cho `thu_nhap_tinh_thue` | 0 nếu phương pháp khác |
| `thue_toan_phan` | = Σ `taxWithheld` của mọi khoản khấu trừ cố định trong tháng của người đó (từ `hrm_other_income_records` nhóm `WITHHOLDING_FLAT` + từ chính lương nếu `loai_lao_dong = THOI_VU_THU_VIEC` theo BR-dltl-026) | Nhánh lũy tiến: chỉ còn thuế đã khấu trừ riêng của khoản `WITHHOLDING_FLAT` (0 nếu người đó không có khoản nào) `[SỬA 2026-09-15]` |
| `tong_thue_tncn` | = `thue_luy_tien` + `thue_toan_phan` | |
| `thuc_nhan` | = `tong_thu_nhap` − `tong_thue_tncn` − BH bắt buộc (đã trừ trong lương) | |
| `status` | Kế thừa khóa của kỳ tháng (BR-tkt-013) | `DRAFT` / `LOCKED` |

### 4.4 Tờ khai thuế TNCN theo quý — `QuarterlyTaxDeclaration` → `hrm_quarterly_tax_declarations` `[ĐỀ XUẤT]`

| Trường | B/T | Kiểu | Ý nghĩa |
|---|---|---|---|
| `id` | Hệ thống | | |
| `year` | **B** | Int | Năm dương lịch |
| `quarterNumber` | **B** | Int 1–4 | Quý (BR-tkt-016 — chỉ hỗ trợ quý) |
| `status` | Hệ thống | Enum `READY_TO_EXPORT` / `EXPORTED` / `SUBMITTED` | Bản ghi chỉ tồn tại khi đủ điều kiện `READY_TO_EXPORT` (BR-tkt-014) — trước đó không có dòng nào, giống cách `PayrollSheetLine` chỉ sinh khi khóa sổ |
| `calculatedIndicators` | Hệ thống | Json | Giá trị TỰ TÍNH cho từng chỉ tiêu mẫu 05/KK-TNCN (`ct16`–`ct32`) — tương ứng `ct_may` ở FE |
| `finalIndicators` | Hệ thống | Json | Giá trị CUỐI CÙNG hiển thị/xuất = `calculatedIndicators`, trừ chỉ tiêu nào có ghi đè thì lấy giá trị ghi đè (BR-tkt-018) — tương ứng `ct` ở FE |
| `overrides` | T | Json (map chỉ tiêu → {giá trị, lý do}) | Ghi đè thủ công cho các "chỉ tiêu gốc" — tương ứng `ghi_de` ở FE |
| `warnings` | Hệ thống | String[] | Cảnh báo tự động — tương ứng `canh_bao` |
| `calculatedAt` | Hệ thống | DateTime | Thời điểm tính lần gần nhất |
| `exportedBy` / `exportedAt` | Hệ thống | | Người xuất & thời điểm xuất (BR-tkt-015) |
| `submittedBy` / `submittedAt` | Hệ thống | | Người đánh dấu đã nộp & thời điểm (BR-tkt-015) — **MỚI so với FE scaffold hiện tại**, xem Mục 14 điểm 4 |
| `createdAt` / `updatedAt` | Hệ thống | | |

**Ràng buộc không định nghĩa lại ở đây (input phụ thuộc, thuộc `srs/hrm-spec.md`):** biểu thuế/giảm trừ gia cảnh hiệu lực theo kỳ (`BR-hrm-080`…`084`, quyết định lưu trữ effective-dated của `OQ-hrm-35` đã đóng) — thiết kế schema cụ thể là của Architect (xem A-tkt-02).

---

## 5. Quy tắc nghiệp vụ (Business Rules)

**BR-tkt-001** — Danh mục loại thu nhập ngoài lương được cấu hình qua UI (không hardcode trong code), mỗi danh mục thuộc đúng 1 trong 4 nhóm xử lý thuế: `EXEMPT_FULL` (miễn 100%), `EXEMPT_CAPPED` (miễn có ngưỡng, phần vượt chịu thuế), `TAXABLE_FULL` (chịu thuế toàn phần, cộng vào thu nhập chịu thuế tháng), `WITHHOLDING_FLAT` (khấu trừ riêng theo tỷ lệ cố định, không cộng vào lũy tiến).

**BR-tkt-002** — Seed dữ liệu mặc định khi khởi tạo hệ thống, đúng nguyên văn số liệu brainstorm Mục 4 BR-05, đã điều chỉnh 2 điểm theo phản biện Architect chấp thuận tại BA Final Sign-off 2026-09-14 (xem `data-model-to-khai-thue.md` P-06, P-09):
- Nhóm `EXEMPT_FULL`: làm thêm giờ/ca đêm (toàn bộ, không chỉ phần chênh lệch); trợ cấp thôi việc/mất việc (kể cả phần vượt mức luật định); trợ cấp thất nghiệp; công tác phí thực thanh toán có chứng từ; xe đưa đón tập thể/học phí con trả thẳng trường/khám sức khỏe chung (chi CHUNG, không ghi tên cá nhân); trang phục hiện vật có hoá đơn; thưởng sáng kiến được CƠ QUAN NHÀ NƯỚC có thẩm quyền công nhận; **ăn ca doanh nghiệp tự nấu/phiếu ăn** `[SỬA — chuyển từ EXEMPT_CAPPED]` (nhóm `EXEMPT_FULL` đã cho đúng kết quả miễn 100%, không cần khái niệm "trần vô hạn" tự mâu thuẫn với BR-tkt-003).
- Nhóm `EXEMPT_CAPPED`: ăn trưa/ăn ca tiền mặt, ngưỡng **1.200.000đ/người/tháng**; trang phục bằng tiền, ngưỡng **5.000.000đ/người/năm** (số liệu đang treo `OQ-tkt-03`, xem Mục 15) — **ngưỡng `YEARLY` tính lũy kế theo năm dương lịch** (tổng đã miễn của cùng người + cùng danh mục trong năm, không chia đều theo tháng).
- Nhóm `TAXABLE_FULL`: thưởng Tết/lễ/KPI/cuối năm/tháng 13; du lịch/nhà ở/phúc lợi khác GHI RÕ TÊN cá nhân hưởng.
- Nhóm `WITHHOLDING_FLAT`: hoa hồng/thù lao CTV/kiêm nhiệm không HĐLĐ hoặc HĐLĐ <3 tháng — `withholdingRate = 10.0`, `withholdingThreshold = 5.000.000`. Trường `forceWithholding` (bổ sung theo đề xuất Architect) hiện thực hóa nhánh "cá nhân yêu cầu khấu trừ dù dưới ngưỡng" đã nêu ở BR-tkt-008.

**BR-tkt-003** — Toàn vẹn danh mục: `code`/`name` duy nhất trong tenant (không phân biệt hoa/thường, vi phạm 400 E-tkt-001); field bắt buộc theo nhóm phải đủ (`EXEMPT_CAPPED` thiếu `exemptCapAmount`, hoặc `WITHHOLDING_FLAT` thiếu `withholdingRate`/`withholdingThreshold` → 400 E-tkt-003).

**BR-tkt-004** — Danh mục đã có bản ghi `OtherIncomeRecord` sử dụng thì không được xóa cứng, chỉ chuyển `status = INACTIVE` (cùng khuôn mẫu BR-sal-003). Vi phạm 400 E-tkt-002.

**BR-tkt-005** — Mỗi bản ghi thu nhập ngoài lương thuộc đúng 1 kỳ tháng (`payrollPeriodId`), gắn 1 trong 2 dạng đối tượng: nhân viên nội bộ (`ma_nv` khác null) hoặc cá nhân vãng lai (`ma_nv = null`, bắt buộc `fullName`). Thiếu `fullName`, `paymentDate`, hoặc `otherIncomeCategoryId` → 400 E-tkt-004.

**BR-tkt-006** — Chống trùng lặp: từ chối tạo bản ghi trùng **hoàn toàn** với 1 bản ghi đã có (cùng đối tượng nhận + cùng kỳ tháng + cùng loại thu nhập + cùng ngày chi trả + cùng số tiền) nhằm chống nhập trùng do double-submit (409 E-tkt-005). **KHÔNG chặn** nhiều bản ghi hợp lệ khác ngày hoặc khác số tiền trong cùng kỳ + loại — vd 1 CTV nhận 2 khoản hoa hồng khác ngày trong cùng tháng vẫn hợp lệ (xem lý do lựa chọn phạm vi hẹp này ở Mục 14).

**BR-tkt-007** — Công thức tính thuế của 1 bản ghi thu nhập ngoài lương, theo đúng 4 nhóm xử lý (khớp logic đã nháp sẵn ở `ThuNhapNgoaiLuongDialog.tsx`):

```
Với 1 OtherIncomeRecord, categoryGroup = otherIncomeCategoryId.taxTreatmentGroup:

Nếu categoryGroup = EXEMPT_FULL:
  grossAmount = netAmount = số tiền chi trả
  taxWithheld = 0
  # KHÔNG cộng vào thu_nhap_ngoai của Bảng tính thuế tháng

Nếu categoryGroup = EXEMPT_CAPPED:
  phanMienThue  = min(soTienChiTra, exemptCapAmount quy đổi theo exemptCapPeriod)
  phanVuotTran  = max(0, soTienChiTra − phanMienThue)
  taxWithheld   = 0
  # phanMienThue: KHÔNG cộng vào thu_nhap_ngoai
  # phanVuotTran: CỘNG vào thu_nhap_ngoai (xử lý như TAXABLE_FULL)

Nếu categoryGroup = TAXABLE_FULL:
  # chỉ hợp lệ khi ma_nv khác null — xem BR-tkt-009
  grossAmount = số tiền chi trả quy đổi theo paymentType
  taxWithheld = 0   # cộng dồn vào thu_nhap_ngoai rồi tính lũy tiến ở Bảng tính thuế tháng

Nếu categoryGroup = WITHHOLDING_FLAT:
  Nếu hasCommitment08 = true VÀ isResident = true VÀ có taxCode:
    taxWithheld = 0                       # BR-tkt-008 nhánh Cam kết 08
  Ngược lại nếu soTienChiTra < withholdingThreshold (mặc định 5.000.000):
    taxWithheld = 0                       # dưới ngưỡng — trừ khi cá nhân yêu cầu khấu trừ
  Ngược lại:
    rate = withholdingRate (mặc định 10%)
    Nếu paymentType = GROSS:
      taxWithheld = round(soTienChiTra × rate / 100)
      netAmount   = soTienChiTra − taxWithheld
      grossAmount = soTienChiTra
    Ngược lại (paymentType = NET):
      grossAmount = round(soTienChiTra / (1 − rate/100))
      taxWithheld = grossAmount − soTienChiTra
      netAmount   = soTienChiTra
  # [SỬA 2026-09-15 — tách 2 phần] grossAmount của MỌI khoản nhóm này (kể cả Cam kết 08, dưới ngưỡng)
  # CỘNG vào thu_nhap_ngoai VÀ thu_nhap_khau_tru_rieng của Bảng tính thuế tháng: có mặt ở chỉ tiêu
  # thu nhập của tờ khai quý, nhưng KHÔNG vào nền lũy tiến (thu_nhap_tinh_thue trừ lại phần này)
```

**BR-tkt-008** — Khấu trừ riêng 10% (nhóm `WITHHOLDING_FLAT`): áp dụng khi chi trả **≥5.000.000đ/lần** (tăng từ 2tr, NĐ 253/2026/NĐ-CP Điều 50 khoản 2, hiệu lực 01/07/2026). Dưới 5.000.000đ/lần: không khấu trừ, trừ khi cá nhân yêu cầu khấu trừ (`forceWithholding`, kế toán bật tay), hoặc cá nhân có Cam kết 08/CK-TNCN (chỉ 1 nguồn thu nhập, có MST, ước tính cả năm sau giảm trừ chưa đến mức nộp thuế) → tạm không khấu trừ. Cam kết 08 chỉ hợp lệ khi **đồng thời** đủ 3 điều kiện: danh mục thuộc nhóm `WITHHOLDING_FLAT`, cá nhân cư trú (`isResident=true`), và có mã số thuế — thiếu bất kỳ điều kiện nào đều trả **E-tkt-006** (mở rộng ngữ nghĩa, không chỉ riêng ca thiếu MST).

**BR-tkt-009** — Ràng buộc phạm vi nhóm theo đối tượng: nhóm `EXEMPT_FULL`, `EXEMPT_CAPPED`, `TAXABLE_FULL` chỉ được chọn khi bản ghi gắn `ma_nv` hợp lệ (nhân viên nội bộ); nhóm `WITHHOLDING_FLAT` dùng được cho cả nhân viên nội bộ (kiêm nhiệm/hoa hồng ngoài lương chính) lẫn cá nhân vãng lai không có `ma_nv`. Vi phạm trả 400.

**BR-tkt-010** `[SỬA 2026-09-14 — thu hẹp phạm vi theo BA Final Sign-off, xem P-17]` — Giảm trừ trước thuế khác (áp dụng cho nhánh lũy tiến): bảo hiểm bắt buộc NLĐ đóng 10,5% lương căn cứ đóng BH (8% hưu trí-tử tuất + 1,5% BHYT + 1% BHTN — không đổi) — **ĐÃ có nguồn dữ liệu** (engine lương hiện có, `giam_tru_bao_hiem` đợt này CHỈ gồm khoản này). Quy tắc pháp lý đầy đủ còn gồm bảo hiểm hưu trí tự nguyện tối đa **3.000.000đ/tháng** (NĐ 253/2026/NĐ-CP) và đóng góp từ thiện/nhân đạo/khuyến học theo chứng từ hợp pháp — **NGOÀI PHẠM VI đợt này**: chưa có màn nào cho kế toán nhập 2 khoản này. Bổ sung màn nhập liệu cho 2 khoản này để đợt sau.

**BR-tkt-011** — Phân loại `loai_lao_dong` của mỗi dòng Bảng tính thuế tháng: `HOP_DONG_3_THANG_TRO_LEN` khi `hrm_hop_dong.loai_hd` **không thuộc** {`thu_viec`, `thoi_vu`} → `phuong_phap_tinh = LUY_TIEN`; `THOI_VU_THU_VIEC` khi `loai_hd` **thuộc** {`thu_viec`, `thoi_vu`} → `phuong_phap_tinh` theo kết quả đã tính sẵn của BR-dltl-026 (khấu trừ 10%/không giảm trừ gia cảnh, KHÔNG tính lại ở đây); `VANG_LAI` khi không có `ma_nv` → `phuong_phap_tinh` lấy trực tiếp từ nhánh BR-tkt-007/008 của chính `OtherIncomeRecord` đó (`KHAU_TRU_10`/`CAM_KET_08`/`DUOI_NGUONG`).

**Xác nhận BA Final Sign-off 2026-09-14**: hợp đồng **khoán** (`loai_hd = khoan`) đi đúng nhánh `HOP_DONG_3_THANG_TRO_LEN`/`LUY_TIEN` như định nghĩa trên (không thuộc {thu_viec, thoi_vu}) — quyết định này đóng luôn `EC-dltl-07` của `srs-du-lieu-tinh-luong.md` với cùng kết luận. `EC-dltl-06` (hợp đồng `xac_dinh` <3 tháng) là câu hỏi KHÁC, vẫn treo, không bị ảnh hưởng.

**BR-tkt-012** — Công thức tổng Bảng tính thuế tháng (áp dụng nhánh `LUY_TIEN`): Thuế TNCN phải nộp = (Tổng thu nhập chịu thuế trong kỳ − Thu nhập đã khấu trừ riêng `[SỬA 2026-09-15]` − BH bắt buộc − Giảm trừ gia cảnh − Giảm trừ khác) × biểu lũy tiến `BR-hrm-081` (5 bậc: 10tr–5%, 30tr–10%, 60tr–20%, 100tr–30%, bậc mở–35%; giảm trừ gia cảnh 15.500.000đ bản thân + 6.200.000đ/người phụ thuộc theo `BR-hrm-080`…`084`).

**BR-tkt-013** — Vòng đời chốt/mở lại Bảng tính thuế tháng: hệ thống tự tính (trạng thái Nháp) khi có đủ dữ liệu lương + thu nhập ngoài lương của tháng; kế toán xác nhận Chốt số liệu (Nháp → Đã chốt) — không còn sửa thu nhập ngoài lương của tháng đó; Mở lại (Đã chốt → Nháp) chỉ được phép khi kỳ khai quý chứa tháng đó CHƯA "Đã xuất tờ khai". **`[SỬA 2026-09-14 — giải quyết mâu thuẫn BR-tkt-013/BR-tkt-014 do QA phát hiện]`** Nếu quý chứa tháng đó đang ở trạng thái "Sẵn sàng xuất" (chưa xuất) tại thời điểm Mở lại, hệ thống PHẢI xóa luôn bản ghi Tờ khai quý đó trong cùng giao dịch, để tự động quay về "Chưa sẵn sàng" thay vì để lại dữ liệu treo sai trạng thái. **Đề xuất kỹ thuật (không bắt buộc):** tái sử dụng cơ chế "Chốt số bảng kê" hiện có (`hrm_payroll_module_locks`, enum `PayrollModuleCode`) đã dùng cho 8 phân hệ nhập liệu khác của cùng kỳ lương, thêm 1 giá trị enum mới, thay vì tạo bảng khóa riêng.

**BR-tkt-014** — Điều kiện đủ để Tờ khai quý chuyển "Sẵn sàng xuất": cả 3 tháng trong quý đều ở trạng thái "Đã chốt" (tự động kiểm điều kiện, không cần thao tác thủ công).

**BR-tkt-015** — Vòng đời Tờ khai quý: Sẵn sàng xuất → (kế toán xuất Excel/PDF) → Đã xuất tờ khai (khóa cả 3 tháng lương trong quý, không cho Mở lại nữa) → (kế toán đánh dấu thủ công, sau khi nộp qua HTKK/eTax) → Đã nộp. Thao tác đánh dấu đã nộp không xác thực với GDT.

**BR-tkt-016** — Kỳ khai tờ khai TNCN (mẫu 05/KK-TNCN, Thông tư 89/2026/TT-BTC): **CHỈ THEO QUÝ** (bỏ kỳ tháng), không phụ thuộc ngưỡng doanh thu 50 tỷ như trước. Hạn nộp: chậm nhất ngày cuối tháng đầu quý sau.

**BR-tkt-017** — Mốc hiệu lực & lưu song song: BR-tkt-001 đến BR-tkt-016 áp dụng cho kỳ tính thuế 2026 trở đi; kỳ khai theo quý áp dụng từ kỳ tính thuế Quý III/2026. Biểu thuế/giảm trừ gia cảnh CŨ (trước 2026) phải được giữ song song để tính lại/tra cứu dữ liệu lịch sử — đây chính là quyết định đã đóng `OQ-hrm-35` (xem `srs/hrm-spec.md` Mục 15.2b và `A-hrm-12`); thiết kế lưu trữ effective-dated cụ thể là của Architect, ngoài phạm vi tài liệu này.

**BR-tkt-018** — Ghi đè chỉ tiêu tờ khai: hệ thống tự tính từng chỉ tiêu mẫu 05/KK-TNCN (`calculatedIndicators`); kế toán được ghi đè **chỉ** các "chỉ tiêu gốc" (leaf, danh sách cố định `ct16, ct17, ct19, ct20, ct22, ct23, ct24, ct25, ct27, ct28, ct30, ct31, ct32` — theo đúng `O_SUA_DUOC_TNCN05` đã nháp sẵn ở FE), bắt buộc nhập lý do; các chỉ tiêu tổng hợp không phải chỉ-tiêu-gốc (vd `ct18=ct19+ct20`, `ct21=ct22+ct23`, `ct26=ct27+ct28`, `ct29=ct30+ct31`) LUÔN tính lại tự động từ chỉ tiêu con, không cho ghi đè trực tiếp, để tránh mất cân đối tổng-thành phần.

---

## 6. Vòng đời trạng thái (State Transitions)

| Entity | Trạng thái hiện tại | Sự kiện | Trạng thái tiếp theo | Điều kiện |
|---|---|---|---|---|
| Bảng tính thuế (kỳ tháng) | (chưa có) | Hệ thống tự tính khi có đủ dữ liệu lương + thu nhập ngoài lương | Nháp | Tự động, tính lại nhiều lần được (BR-tkt-013) |
| Bảng tính thuế (kỳ tháng) | Nháp | Kế toán xác nhận chốt số liệu | Đã chốt | Không còn sửa thu nhập ngoài lương của tháng đó (trừ khi Mở lại) |
| Bảng tính thuế (kỳ tháng) | Đã chốt | Kế toán yêu cầu Mở lại | Nháp | Chỉ khi kỳ khai quý chứa tháng đó CHƯA "Đã xuất tờ khai" (E-tkt-009) |
| Tờ khai TNCN (kỳ quý) | (chưa có) | Đủ 3 tháng trong quý đều "Đã chốt" | Sẵn sàng xuất | Tự động kiểm điều kiện (BR-tkt-014) |
| Tờ khai TNCN (kỳ quý) | Sẵn sàng xuất | Kế toán xuất Excel/PDF | Đã xuất tờ khai | Khoá 3 tháng lương trong quý, không cho Mở lại nữa |
| Tờ khai TNCN (kỳ quý) | Đã xuất tờ khai | Kế toán đánh dấu đã nộp | Đã nộp | Thao tác thủ công, không xác thực với GDT |
| Thu nhập ngoài lương (bản ghi) | (chưa có) | Kế toán nhập | Nháp | |
| Thu nhập ngoài lương (bản ghi) | Nháp | Kỳ tháng chứa nó chuyển "Đã chốt" | Đã chốt | Kế thừa trạng thái khóa từ Bảng tính thuế tháng — không cho sửa/xóa (E-tkt-007) |

---

## 7. Yêu cầu chức năng (Functional Requirements)

**FR-tkt-001** — Hệ thống cho phép tạo danh mục loại thu nhập ngoài lương với tên và nhóm xử lý thuế bắt buộc; các field ngưỡng/tỷ lệ bắt buộc tùy theo nhóm (BR-tkt-001, BR-tkt-003).

**FR-tkt-002** — Hệ thống cho phép xem danh sách và chi tiết danh mục, lọc theo nhóm xử lý thuế và trạng thái.

**FR-tkt-003** — Hệ thống cho phép sửa danh mục (trừ mã); thay đổi field ngưỡng/tỷ lệ vẫn phải qua kiểm BR-tkt-003.

**FR-tkt-004** — Hệ thống cho phép chuyển danh mục sang `INACTIVE`; chặn xóa cứng khi đã có bản ghi thu nhập ngoài lương sử dụng (BR-tkt-004).

**FR-tkt-005** — Hệ thống cho phép tạo bản ghi thu nhập ngoài lương cho nhân viên nội bộ (chọn từ danh sách nhân viên) hoặc cá nhân vãng lai (nhập tay thông tin định danh), chọn 1 danh mục hợp lệ theo BR-tkt-009 (BR-tkt-005).

**FR-tkt-006** — Hệ thống cho phép sửa bản ghi thu nhập ngoài lương khi kỳ tháng đang ở trạng thái Nháp; kiểm lại BR-tkt-006/007/008 khi sửa.

**FR-tkt-007** — Hệ thống cho phép xóa bản ghi thu nhập ngoài lương khi kỳ tháng đang ở trạng thái Nháp; chặn khi kỳ đã "Đã chốt" (E-tkt-007).

**FR-tkt-008** — Hệ thống cho phép xem danh sách thu nhập ngoài lương theo kỳ, lọc theo cách tính thuế và cư trú, kèm 4 chỉ số tổng hợp: tổng số khoản, tổng gross, tổng thuế khấu trừ, tổng net.

**FR-tkt-009** — Hệ thống tính Bảng tính thuế tháng: gộp thu nhập chịu thuế từ bảng lương chính với thu nhập ngoài lương thuộc diện cộng lũy tiến, áp giảm trừ gia cảnh/giảm trừ khác, tính thuế theo đúng nhánh `phuong_phap_tinh` (BR-tkt-007, BR-tkt-010, BR-tkt-011, BR-tkt-012).

**FR-tkt-010** — Hệ thống cho phép xem Bảng tính thuế tháng theo nhân viên, lọc theo loại lao động (`HOP_DONG_3_THANG_TRO_LEN`/`THOI_VU_THU_VIEC`/`VANG_LAI`) và cờ cư trú.

**FR-tkt-011** — Hệ thống cho phép kế toán chốt Bảng tính thuế tháng (BR-tkt-013).

**FR-tkt-012** — Hệ thống cho phép mở lại Bảng tính thuế tháng đã chốt, có điều kiện theo BR-tkt-013 (E-tkt-009 khi vi phạm).

**FR-tkt-013** — Hệ thống tự động tổng hợp Tờ khai quý khi đủ điều kiện BR-tkt-014, không cần thao tác thủ công để "tạo" tờ khai.

**FR-tkt-014** — Hệ thống cho phép xuất Tờ khai TNCN đúng mẫu 05/KK-TNCN (Excel + PDF — đã cân nhắc XML để import HTKK, quyết định KHÔNG làm đợt này) theo quý, đủ 17 chỉ tiêu `ct16`–`ct32` (BR-tkt-015, BR-tkt-016), **kèm đầy đủ thông tin người nộp thuế ở phần đầu mẫu** (chỉ tiêu [01]-[15]: MST, tên, địa chỉ, cơ quan thuế quản lý, kỳ tính thuế...) — đọc từ `maxv2_sys.don_vi` (control-plane, khác mọi nguồn còn lại của sub-cụm nằm ở DB tenant).

**FR-tkt-015** — Hệ thống xuất kèm bảng chi tiết theo từng nhân viên nội bộ (không phải mẫu chính thức, phục vụ đối chiếu và chuẩn bị dữ liệu cho quyết toán năm sau).

**FR-tkt-016** — Hệ thống cho phép kế toán ghi đè giá trị 1 chỉ tiêu gốc kèm lý do bắt buộc; các chỉ tiêu tổng hợp tự tính lại theo BR-tkt-018.

**FR-tkt-017** — Hệ thống cho phép đánh dấu Tờ khai quý đã ở trạng thái "Đã xuất tờ khai" chuyển sang "Đã nộp" (BR-tkt-015).

**FR-tkt-018** — Hệ thống cho phép xem lịch sử/trạng thái các kỳ Tờ khai quý đã có, kèm ai xuất/ai đánh dấu nộp và khi nào.

---

## 8. Yêu cầu phi chức năng (NFR)

| Mã | Yêu cầu |
|---|---|
| NFR-tkt-001 | Cô lập đa tenant: mọi truy vấn phải qua `resolveTenantDb(req)`, không rò dữ liệu chéo công ty (kế thừa NFR-dltl-001) |
| NFR-tkt-002 | Toàn vẹn giao dịch: chốt/mở lại Bảng tính thuế tháng và xuất Tờ khai quý (đụng nhiều bảng) phải chạy trong 1 transaction (cùng khuôn mẫu BR-dltl-022) |
| NFR-tkt-003 | Khả năng kiểm toán: ghi đè chỉ tiêu tờ khai, chốt/mở lại Bảng tính thuế đều phải lưu vết ai làm + khi nào + lý do |
| NFR-tkt-004 | Số liệu pháp luật (biểu thuế, giảm trừ, ngưỡng khấu trừ, trần miễn thuế) đọc từ đúng 1 nguồn cấu hình hiệu lực theo kỳ, không hardcode rời rạc ở nhiều nơi |
| NFR-tkt-005 | Nhất quán với engine tính lương hiện có: không tính trùng hoặc tính khác kết quả `personalIncomeTax` mà `payrollCalculation.service.ts` đã tính cho phần lương chính (A-tkt-03) |

---

## 9. Ma trận lỗi (Error Matrix)

| Mã | HTTP | Tình huống | Hệ quả |
|---|:--:|---|---|
| E-tkt-001 | 400 | Trùng mã hoặc tên danh mục loại thu nhập ngoài lương | Từ chối lưu (BR-tkt-003) |
| E-tkt-002 | 400 | Xóa danh mục đã có bản ghi thu nhập ngoài lương sử dụng | Từ chối xóa, gợi ý chuyển `INACTIVE` (BR-tkt-004) |
| E-tkt-003 | 400 | Thiếu field ngưỡng/tỷ lệ bắt buộc theo nhóm xử lý thuế | Từ chối lưu (BR-tkt-003) |
| E-tkt-004 | 400 | Bản ghi thu nhập ngoài lương thiếu họ tên/ngày chi trả/danh mục | Từ chối lưu (BR-tkt-005) |
| E-tkt-005 | 409 | Trùng bản ghi thu nhập ngoài lương (đối tượng + kỳ + loại + ngày + số tiền) | Từ chối tạo (BR-tkt-006) |
| E-tkt-006 | 400 | Cam kết 08 nhưng thiếu mã số thuế cá nhân | Từ chối lưu (BR-tkt-008) |
| E-tkt-007 | 403 | Sửa/xóa bản ghi thu nhập ngoài lương khi kỳ tháng đã "Đã chốt" | Từ chối thao tác |
| E-tkt-008 | 400 | Chốt Bảng tính thuế tháng khi kỳ lương payroll gốc (`hrm_payroll_periods`) chưa `LOCKED` trở lên | Từ chối chốt |
| E-tkt-009 | 403 | Mở lại Bảng tính thuế tháng khi kỳ quý chứa tháng đó đã "Đã xuất tờ khai" | Từ chối mở lại (BR-tkt-013) |
| E-tkt-010 | 400 | Xuất Tờ khai quý khi chưa đủ 3 tháng "Đã chốt" | Từ chối xuất (BR-tkt-014) |
| E-tkt-011 | 400 | Ghi đè chỉ tiêu tờ khai thiếu lý do | Từ chối ghi đè (BR-tkt-018) |
| E-tkt-012 | 400 | Ghi đè chỉ tiêu KHÔNG thuộc danh sách chỉ tiêu gốc được phép sửa | Từ chối ghi đè (BR-tkt-018) |
| E-tkt-013 | 400 | Đánh dấu đã nộp khi tờ khai chưa ở trạng thái "Đã xuất tờ khai" | Từ chối thao tác (BR-tkt-015) |
| E-tkt-014 | 403 | Người dùng không có quyền xem dữ liệu lương cố thao tác chốt/mở lại/xuất/đánh dấu nộp | Từ chối thao tác (A-tkt-08) |
| E-tkt-015 `[MỚI 2026-09-14]` | 500 | Không tìm thấy chính sách thuế hiệu lực cho kỳ (mô hình effective-dated của ADR-012) | Lỗi hạ tầng có mã, không rơi vào 500 vô danh |
| E-tkt-016 `[MỚI 2026-09-14]` | 404 | Không tìm thấy bản ghi/danh mục theo `id` | Áp cho mọi endpoint `/:id` |
| E-tkt-017 `[MỚI 2026-09-14]` | 400 | `periodId` không tồn tại trong tenant | Phân biệt với 404 tài nguyên |
| E-tkt-018 `[MỚI 2026-09-14]` | 409 | Chốt tháng đã chốt / mở tháng chưa chốt (đua 2 người) | BR-tkt-013 |
| E-tkt-019 `[MỚI 2026-09-14]` | 403 | Sửa/xóa ghi đè chỉ tiêu khi tờ khai đã xuất | EC-tkt-03, BR-tkt-018 |
| E-tkt-020 `[MỚI 2026-09-14]` | 409 | Xuất lại tờ khai đã xuất (đua 2 người) | BR-tkt-015 |
| E-tkt-021 `[MỚI 2026-09-14]` | 400 | Vi phạm BR-tkt-009 (nhóm ≠ `WITHHOLDING_FLAT` mà `ma_nv` null) | AC-tkt-015 — BR-tkt-009 vốn chỉ nói "trả 400" nhưng chưa có mã riêng |

> 7 mã lỗi trên do Architect đề xuất khi thiết kế `api-contract-to-khai-thue.md` (phản biện P-15, P-16), BA đã duyệt bổ sung vào SRS.

---

## 10. Ca sử dụng (Use Cases)

| ID | Tác nhân | Mục tiêu | Luồng chính | Yêu cầu liên quan |
|---|---|---|---|---|
| UC-tkt-01 | Kế toán | Quản lý danh mục loại thu nhập ngoài lương | Mở danh mục → thêm/sửa loại thu nhập, chọn nhóm xử lý thuế và ngưỡng/tỷ lệ tương ứng → lưu | FR-tkt-001…004, BR-tkt-001…004, E-tkt-001…003 |
| UC-tkt-02 | Kế toán | Ghi nhận thu nhập ngoài lương cho nhân viên nội bộ | Chọn nhân viên, chọn danh mục thuộc nhóm cho phép nội bộ, nhập số tiền và ngày chi trả → hệ thống tính preview → lưu | FR-tkt-005…006, BR-tkt-005, BR-tkt-007, BR-tkt-009, E-tkt-004…005 |
| UC-tkt-03 | Kế toán | Ghi nhận thù lao cho cá nhân vãng lai/CTV | Chọn "vãng lai", nhập thông tin định danh, chọn danh mục khấu trừ riêng, xác nhận Cam kết 08 nếu có → hệ thống tính khấu trừ theo BR-tkt-008 → lưu | FR-tkt-005…006, BR-tkt-006, BR-tkt-008, E-tkt-005…006 |
| UC-tkt-04 | Kế toán | Xem và chốt Bảng tính thuế tháng | Mở Bảng tính thuế của kỳ → xem từng dòng nhân viên/vãng lai → xác nhận Chốt số liệu | FR-tkt-009…011, BR-tkt-011…013, E-tkt-008 |
| UC-tkt-05 | Kế toán trưởng | Mở lại Bảng tính thuế tháng đã chốt | Yêu cầu Mở lại → hệ thống kiểm kỳ quý chứa tháng đó chưa xuất tờ khai → chuyển về Nháp | FR-tkt-012, BR-tkt-013, E-tkt-009 |
| UC-tkt-06 | Kế toán | Xuất Tờ khai thuế TNCN theo quý | Mở màn Tờ khai → hệ thống báo "Sẵn sàng xuất" khi đủ 3 tháng đã chốt → xuất Excel/PDF | FR-tkt-013…015, BR-tkt-014…016, E-tkt-010 |
| UC-tkt-07 | Kế toán | Ghi đè chỉ tiêu tờ khai trước khi nộp | Chọn 1 chỉ tiêu gốc → nhập giá trị mới + lý do → hệ thống tính lại các chỉ tiêu tổng hợp liên quan | FR-tkt-016, BR-tkt-018, E-tkt-011…012 |
| UC-tkt-08 | Kế toán | Đánh dấu tờ khai đã nộp | Sau khi nộp qua HTKK/eTax, bấm "Đánh dấu đã nộp" | FR-tkt-017, BR-tkt-015, E-tkt-013 |

---

## 11. Tiêu chí nghiệm thu (Acceptance Criteria)

**AC-tkt-001** (FR-tkt-001, BR-tkt-001) — Given kế toán tạo danh mục mới với nhóm `EXEMPT_CAPPED`, When bỏ trống `exemptCapAmount`, Then hệ thống từ chối lưu với lỗi 400 E-tkt-003.

**AC-tkt-002** (BR-tkt-001) — Given kế toán tạo danh mục mới với nhóm `WITHHOLDING_FLAT` và không nhập tỷ lệ/ngưỡng, When lưu, Then hệ thống tự áp mặc định `withholdingRate = 10.0`, `withholdingThreshold = 5.000.000`.

**AC-tkt-003** (BR-tkt-002) — Given công ty vừa được tạo, chưa có danh mục nào, When mở màn "Thu nhập ngoài lương" lần đầu, Then hệ thống tự sinh danh mục "Ăn ca tiền mặt" với `taxTreatmentGroup = EXEMPT_CAPPED`, `exemptCapAmount = 1.200.000`, `exemptCapPeriod = MONTHLY`.

**AC-tkt-004** (BR-tkt-003) — Given danh mục "Hoa hồng đại lý" đã tồn tại, When tạo danh mục mới tên "hoa hồng đại lý" (khác hoa/thường), Then hệ thống từ chối với lỗi 400 E-tkt-001.

**AC-tkt-005** (BR-tkt-004) — Given danh mục "Thưởng sáng kiến" đã có bản ghi thu nhập ngoài lương sử dụng, When kế toán bấm xóa, Then hệ thống từ chối 400 E-tkt-002 và gợi ý chuyển trạng thái `INACTIVE`.

**AC-tkt-006** (FR-tkt-005, BR-tkt-005) — Given kế toán chọn "Cá nhân vãng lai", When bỏ trống họ tên, Then hệ thống từ chối lưu với lỗi 400 E-tkt-004.

**AC-tkt-007** (BR-tkt-006) — Given đã có 1 bản ghi hoa hồng 6.000.000đ ngày 10/09/2026 cho CTV "Nguyễn Văn A", When tạo lại đúng bản ghi này (cùng đối tượng + kỳ + loại + ngày + số tiền), Then hệ thống từ chối với lỗi 409 E-tkt-005.

**AC-tkt-008** (BR-tkt-006) — Given cùng CTV "Nguyễn Văn A" đã có bản ghi hoa hồng 6.000.000đ ngày 10/09/2026, When tạo thêm 1 bản ghi hoa hồng 4.000.000đ ngày 20/09/2026 (khác ngày, khác số tiền, cùng loại), Then hệ thống chấp nhận lưu — không bị coi là trùng lặp.

**AC-tkt-009** (BR-tkt-007, nhóm `EXEMPT_FULL`) — Given bản ghi "Làm thêm giờ" (nhóm `EXEMPT_FULL`) 2.000.000đ, When tính, Then `taxWithheld = 0` và khoản này KHÔNG cộng vào `thu_nhap_ngoai` của Bảng tính thuế tháng.

**AC-tkt-010** (BR-tkt-007, nhóm `EXEMPT_CAPPED`) — Given bản ghi "Ăn ca tiền mặt" 1.500.000đ/tháng (ngưỡng miễn 1.200.000đ), When tính, Then 1.200.000đ miễn thuế, 300.000đ còn lại được cộng vào `thu_nhap_ngoai` của Bảng tính thuế tháng, `taxWithheld = 0` tại chính bản ghi.

**AC-tkt-011** (BR-tkt-008) — Given cá nhân cư trú, không Cam kết 08, chi trả hoa hồng `GROSS` 6.000.000đ, When tính, Then `taxWithheld = 600.000`, `netAmount = 5.400.000`.

**AC-tkt-012** (BR-tkt-008) — Given chi trả 4.000.000đ/lần (dưới ngưỡng 5.000.000đ) và cá nhân không yêu cầu khấu trừ, When tính, Then `taxWithheld = 0`.

**AC-tkt-013** (BR-tkt-008) — Given cá nhân có MST, tick "Cam kết 08/CK-TNCN", chi trả 7.000.000đ/lần, When tính, Then `taxWithheld = 0` dù vượt ngưỡng 5.000.000đ.

**AC-tkt-014** (BR-tkt-008, E-tkt-006) — Given cá nhân tick "Cam kết 08/CK-TNCN" nhưng bỏ trống mã số thuế, When lưu, Then hệ thống từ chối 400 E-tkt-006.

**AC-tkt-015** (BR-tkt-009) — Given cá nhân vãng lai (không có `ma_nv`), When kế toán chọn 1 danh mục thuộc nhóm `TAXABLE_FULL`, Then hệ thống từ chối, chỉ hiển thị/chấp nhận danh mục thuộc nhóm `WITHHOLDING_FLAT`.

**AC-tkt-016** (BR-tkt-010) `[SỬA 2026-09-14 — BH hưu trí tự nguyện/từ thiện ngoài phạm vi đợt này]` — Given nhân viên nội bộ có bảo hiểm bắt buộc trích theo lương, không có khoản bảo hiểm hưu trí tự nguyện hay từ thiện nào (đợt này chưa có màn nhập 2 khoản đó), When tính Bảng tính thuế tháng, Then `giam_tru_bao_hiem` chỉ gồm đúng phần bảo hiểm bắt buộc 10,5% — không có phần nào khác để cộng thêm hay giới hạn trần.

**AC-tkt-017** (BR-tkt-011, BR-tkt-012) `[SỬA 2026-09-14 — bổ sung điều kiện BHXH cho khớp số]` — Given nhân viên nội bộ HĐLĐ ≥3 tháng, **hợp đồng không trích BHXH** (`trich_bhxh=false` — trường hợp hiếm nhưng có thật, dùng để giữ ví dụ đơn giản), thu nhập chịu thuế từ lương 20.000.000đ, thu nhập ngoài lương nhóm `TAXABLE_FULL` 5.000.000đ (thưởng), giảm trừ bản thân 15.500.000đ, không có người phụ thuộc, không giảm trừ khác, When tính, Then `thu_nhap_chiu_thue = 25.000.000`, `thu_nhap_tinh_thue = 9.500.000`, `phuong_phap_tinh = LUY_TIEN`, `thue_luy_tien = 9.500.000 × 5% = 475.000` (bậc 1, đến 10 triệu).

**AC-tkt-018** (BR-tkt-013) — Given kỳ lương payroll gốc của tháng đã `LOCKED`, đủ dữ liệu, When kế toán bấm "Chốt số liệu" Bảng tính thuế tháng, Then trạng thái chuyển Nháp → Đã chốt, không còn sửa được bản ghi thu nhập ngoài lương của tháng đó.

**AC-tkt-019** (BR-tkt-013, E-tkt-007) — Given Bảng tính thuế tháng 09/2026 đã "Đã chốt", When kế toán cố sửa 1 bản ghi thu nhập ngoài lương của tháng đó, Then hệ thống từ chối 403 E-tkt-007.

**AC-tkt-020** (BR-tkt-013) — Given kỳ quý III/2026 chứa tháng 09/2026 CHƯA "Đã xuất tờ khai", When kế toán trưởng yêu cầu Mở lại tháng 09/2026, Then hệ thống chuyển về Nháp thành công.

**AC-tkt-021** (BR-tkt-013, E-tkt-009) — Given kỳ quý III/2026 ĐÃ "Đã xuất tờ khai", When kế toán trưởng yêu cầu Mở lại tháng 08/2026 (thuộc quý đó), Then hệ thống từ chối 403 E-tkt-009.

**AC-tkt-022** (BR-tkt-014) — Given tháng 7 và tháng 8 của Quý III/2026 đã "Đã chốt", tháng 9 còn "Nháp", When kế toán mở màn Tờ khai quý, Then hệ thống báo CHƯA "Sẵn sàng xuất", không cho xuất.

**AC-tkt-023** (BR-tkt-015) — Given đủ 3 tháng Quý III/2026 đã "Đã chốt", When kế toán bấm "Xuất tờ khai", Then hệ thống xuất Excel/PDF, chuyển trạng thái "Đã xuất tờ khai", và khóa lại cả 3 tháng lương trong quý (không cho Mở lại nữa).

**AC-tkt-024** (BR-tkt-016) — Given UI đang cho phép chọn "Theo Tháng" hoặc "Theo Quý" khi xem Tờ khai (theo nháp FE hiện có), When hệ thống thật được nối API, Then chỉ chấp nhận tạo/xuất Tờ khai theo Quý — lựa chọn "Theo Tháng" phải được loại bỏ khỏi luồng thật (xem Mục 14 điểm 3).

**AC-tkt-025** (BR-tkt-018) — Given Tờ khai Quý III/2026 đang ở "Sẵn sàng xuất" với `ct22` (TNCT cá nhân cư trú) tự tính = 500.000.000đ, When kế toán ghi đè `ct22 = 480.000.000đ` kèm lý do "loại trừ 1 khoản đã kê nhầm kỳ trước", Then `finalIndicators.ct22 = 480.000.000` và `ct21` (tổng TNCT, `ct21 = ct22 + ct23`) tự tính lại theo giá trị mới.

**AC-tkt-026** (BR-tkt-018, E-tkt-011) — Given kế toán ghi đè `ct22` nhưng bỏ trống lý do, When lưu, Then hệ thống từ chối 400 E-tkt-011.

**AC-tkt-027** (BR-tkt-018, E-tkt-012) — Given kế toán cố ghi đè `ct21` (chỉ tiêu tổng hợp, không thuộc danh sách chỉ-tiêu-gốc), When lưu, Then hệ thống từ chối 400 E-tkt-012.

**AC-tkt-028** (BR-tkt-015, E-tkt-013) — Given Tờ khai Quý III/2026 đang ở "Sẵn sàng xuất" (chưa xuất), When kế toán bấm "Đánh dấu đã nộp", Then hệ thống từ chối 400 E-tkt-013.

---

## 12. Danh mục Edge Cases bổ sung

| # | Kịch bản | Xử lý đề xuất |
|---|---|---|
| EC-tkt-01 | NLĐ vào/nghỉ việc giữa kỳ quý | Tính thuế tháng có dữ liệu thì tính, tháng không có lương thì bỏ qua khi tổng hợp quý (brainstorm Mục 6) |
| EC-tkt-02 | NLĐ có nhiều nguồn thu nhập (2 công ty cùng MST) | Ngoài phạm vi đợt này — hệ thống chỉ biết dữ liệu nội bộ, không tự cộng dồn nguồn ngoài |
| EC-tkt-03 | Sửa số liệu lương/thu nhập ngoài lương SAU KHI kỳ quý đã "Đã xuất tờ khai" | Không cho sửa trực tiếp; cần cơ chế "khai bổ sung" — ngoài phạm vi đợt này, chỉ ghi nhận là hạn chế biết trước |
| EC-tkt-04 | Người phụ thuộc đăng ký/hủy giữa kỳ tháng | Giảm trừ tính theo THÁNG có đăng ký hợp lệ, theo nguyên tắc hiện có ở `hrm_nguoi_phu_thuoc`; cần Architect xác nhận logic hiện tại đã đúng với mức mới BR-hrm-080 (6.200.000đ) chưa |
| EC-tkt-05 | Mốc chuyển kỳ khai tháng→quý từ Quý III/2026 | Dữ liệu Quý I, II/2026 (nếu công ty từng theo dõi theo tháng) chỉ cần HIỂN THỊ lại, không bắt buộc dựng tờ khai lịch sử theo mẫu mới (liên quan `OQ-tkt-01`) |
| EC-tkt-06 | Nhân viên nội bộ có `loai_hd ∈ {thu_viec, thoi_vu}` (đã bị khấu trừ 10% trên chính lương theo BR-dltl-026) đồng thời nhận thêm "hoa hồng kiêm nhiệm" qua màn Thu nhập ngoài lương | Theo A-tkt-11: khoản hoa hồng đó xử lý độc lập theo BR-tkt-007/008 (nhóm `WITHHOLDING_FLAT`, ngưỡng 5tr/lần riêng), cộng vào `thue_toan_phan` — KHÔNG gộp chung ngưỡng với BR-dltl-026 (2tr/lần). Đây là 2 cơ chế độc lập cùng gốc pháp lý, xem Mục 14 điểm 5 |
| EC-tkt-07 | Tạo 2 bản ghi thu nhập ngoài lương rất nhanh liên tiếp (double-click) với payload giống hệt nhau | Chặn bởi BR-tkt-006 (409 E-tkt-005); nếu payload khác 1 field (vd số tiền) thì cả 2 đều được tạo — không coi là lỗi hệ thống |

---

## 13. Giả định (Assumptions)

**A-tkt-01** — Kế thừa `A-hrm-11`: thay đổi cấu hình (biểu thuế, giảm trừ...) không hồi tố các kỳ tính thuế đã chốt trong quá khứ.

**A-tkt-02** — Biểu thuế/giảm trừ gia cảnh hiệu lực theo kỳ (`BR-hrm-080`…`084`, cơ chế effective-dated theo quyết định `OQ-hrm-35` đã đóng) là input đọc từ `GeneralSetting` hoặc thực thể kế thừa có mốc hiệu lực — thiết kế lưu trữ cụ thể do Architect quyết, ngoài phạm vi SRS này.

**A-tkt-03** — "Bảng tính thuế" TÁI SỬ DỤNG engine tính thuế/bảo hiểm hiện có của `payrollCalculation.service.ts` (BR-dltl-024…027) cho phần thu nhập từ lương chính, chỉ bổ sung phần thu nhập ngoài lương lên trên — không viết lại từ đầu (theo PA2 Mục 2.2 brainstorm đã chọn).

**A-tkt-04** — 1 quý dương lịch = 3 tháng liên tiếp cố định (Q1 = T1-3, Q2 = T4-6, Q3 = T7-9, Q4 = T10-12), khớp field `year`/`month` của `hrm_payroll_periods` đã có, không cần bảng ánh xạ riêng.

**A-tkt-05** — "Người phụ thuộc hợp lệ" trong `giam_tru_phu_thuoc` tính theo kỳ đăng ký hiện có của `hrm_nguoi_phu_thuoc` (`dk_tu_thang/nam`, `dk_den_thang/nam`) — SRS này không sửa lại quy tắc đăng ký người phụ thuộc, chỉ tiêu thụ.

**A-tkt-06** — Cá nhân vãng lai/CTV không có `ma_nv` được coi là hợp lệ để ghi vào Tờ khai chừng nào có đủ họ tên; MST/CCCD là tùy chọn trừ khi chọn Cam kết 08 (bắt buộc MST).

**A-tkt-07** — Ngưỡng ≤3.000.000đ/tháng để 1 người được công nhận là người phụ thuộc (brainstorm BR-02, Thông tư 87/2026/TT-BTC) là điều kiện pháp lý mà kế toán tự chịu trách nhiệm khai đúng khi đăng ký người phụ thuộc; hệ thống đợt này KHÔNG tự động validate thu nhập thực tế của người phụ thuộc (không có nguồn dữ liệu để đối chiếu).

**A-tkt-08** — Thao tác chốt/mở-lại Bảng tính thuế, xuất tờ khai, đánh dấu đã nộp là hành động tài chính nhạy cảm; đề xuất áp dụng cùng ngưỡng phân quyền "quyền xem dữ liệu lương" (`BR-hrm-059`) đã dùng cho Hợp đồng/Bảng lương. Vai trò cụ thể (có tách riêng "chốt" khỏi "nhập liệu" hay không) do Architect xác nhận, theo đúng tiền lệ `OQ-dltl-004` (đã đóng bằng `assertAdminOrOwner`).

**A-tkt-09** — Nguyên tắc bất biến snapshot (giống `BR-dltl-014`/`BR-dltl-016`): nhóm xử lý thuế/tỷ lệ/ngưỡng của danh mục tại thời điểm tạo bản ghi thu nhập ngoài lương nên được sao chép cố định vào bản ghi, không tham chiếu động tới danh mục — tránh việc sửa danh mục sau này làm đổi ngược số thuế của các bản ghi cũ đã tính. `[ĐỀ XUẤT — Architect xác nhận cơ chế cụ thể]`

**A-tkt-10** — Đề xuất tái sử dụng cơ chế "Chốt số bảng kê" hiện có (`hrm_payroll_module_locks`, enum `PayrollModuleCode`) cho trạng thái Nháp/Đã chốt của Bảng tính thuế tháng thay vì tạo bảng khóa riêng — đúng khuôn mẫu đã áp dụng cho 8 phân hệ nhập liệu khác của cùng kỳ lương. `[ĐỀ XUẤT — Architect xác nhận]`

**A-tkt-11** — Đơn giản hóa nghiệp vụ theo đúng UI nháp đã có sẵn (`ThuNhapNgoaiLuongDialog.tsx`): mọi khoản thu nhập ngoài lương ghi cho đối tượng CÓ `ma_nv` không tự động phân biệt theo `loai_hd` của hợp đồng khi chọn nhóm `WITHHOLDING_FLAT`/`TAXABLE_FULL` — việc phân loại dựa hoàn toàn vào danh mục kế toán chọn, không dựa vào loại hợp đồng của nhân viên. Rủi ro đã biết (cùng tinh thần `EC-dltl-06`/`EC-dltl-07`): 1 nhân viên có `loai_hd ∈ {thu_viec, thoi_vu}` nhận thêm hoa hồng kiêm nhiệm qua màn này vẫn được xử lý độc lập theo BR-tkt-008 (ngưỡng 5tr/lần) thay vì gộp chung với ngưỡng khấu trừ trên chính lương của họ (BR-dltl-026, 2tr/lần) — CHƯA CHỐT, cần kế toán trưởng xác nhận nếu phát sinh thực tế.

---

## 14. Ghi chú đối soát với mã nguồn/giao diện hiện có

> Phát hiện qua tự khảo sát `hdđt_maxv/src/features/hrm/{types/toKhaiThue.ts, components/to_khai_thue/**}` (code nháp đã tồn tại, chưa nối API thật) và `be_maxv/prisma/tenant/schema.prisma`. Đây KHÔNG phải Open Question chính thức của brainstorm (Mục 15) — chỉ là ghi chú kỹ thuật cho Architect/Backend/Frontend khi triển khai.

1. **Ngưỡng khấu trừ 10% trong `ThuNhapNgoaiLuongDialog.tsx` đang hardcode 2.000.000đ/lần** (điều kiện `disabled={... chiSo(amountStr) >= 2_000_000}` và label "Khấu trừ 10% tại nguồn (Mức chi trả ≥ 2.000.000đ/lần...)") — lỗi thời so với BR-tkt-008 (5.000.000đ/lần theo NĐ 253/2026/NĐ-CP Điều 50 khoản 2). Cần sửa khi nối API thật.

2. **Danh sách `CAC_LOAI_THU_NHAP` trong dialog là mảng hardcode 6 chuỗi cố định** (Thù lao, Hoa hồng môi giới, Dịch vụ khoán việc, Tư vấn/Giảng dạy, Thưởng đột xuất ngoài bảng lương, Thu nhập vãng lai khác) — đây chính là phương án PA1 (danh mục cố định) mà brainstorm Mục 2.1 đã CHỌN PA2 (danh mục cấu hình được) thay thế. Cần đổi thành dropdown gọi từ API danh mục `OtherIncomeCategory` (BR-tkt-001).

3. **`ToKhaiTncn05Panel.tsx` đang cho chọn cả "Theo Tháng" lẫn "Theo Quý"** (`kyLoai: 'thang' | 'quy'`, có `MenuItem value="quy">Theo Quý"` cạnh 1 lựa chọn tháng) — mâu thuẫn BR-tkt-016 (chỉ quý, đã bỏ kỳ tháng theo luật mới). Cần bỏ lựa chọn "Theo Tháng" khỏi UI khi nối API thật (xem AC-tkt-024).

4. **`ToKhaiTncn05Dto.trang_thai` hiện chỉ có 2 giá trị** (`nhap`/`chot`) — chưa phản ánh đủ 3 trạng thái của Mục 6 SRS này (Sẵn sàng xuất → Đã xuất tờ khai → Đã nộp). Cần mở rộng enum khi thiết kế API contract thật.

5. **2 field pháp lý liên quan nhưng KHÔNG nằm trong phạm vi sửa đổi của brainstorm này:** `GeneralSetting.lunchAllowanceTaxFreeCap` (730.000đ, phục vụ `BR-dltl-027` cho phụ cấp ăn ca ĐỊNH KỲ trong bảng lương — SalaryItem có cờ `isMealAllowance`) và ngưỡng khấu trừ của `BR-dltl-026` (2.000.000đ/10%, cho hợp đồng thử việc/thời vụ CỦA CHÍNH nhân viên) đều dựa trên cùng gốc pháp lý (TT 26/2016, TT 111/2013, nay là NĐ 253/2026/NĐ-CP) đã đổi số trong brainstorm này (1.200.000đ cho ăn ca — BR-tkt-002; 5.000.000đ cho khấu trừ 10% — BR-tkt-008), nhưng brainstorm Mục 7 (danh sách sửa `srs/hrm-spec.md`) KHÔNG liệt kê 2 field này vì chúng thuộc `srs-du-lieu-tinh-luong.md` — một tài liệu ĐÃ KÝ DUYỆT và ĐÃ KÍCH HOẠT Backend Engineer (2026-09-10) của 1 sub-cụm khác. Đây là khoảng cách thật giữa 2 đợt brainstorm khác thời điểm; đã tạo task riêng để xử lý, KHÔNG sửa trong tài liệu này để tránh lẫn phạm vi.
>
> **✅ CẬP NHẬT 2026-09-14 (BUG-dltl-004 — việc này ĐÃ XONG, đoạn trên giữ lại làm lịch sử):** task riêng nói trên đã hoàn tất ngay trong ngày. `srs-du-lieu-tinh-luong.md` BR-dltl-025/026/027 nay đã theo luật 2026: trần ăn ca **1.200.000đ**, ngưỡng khấu trừ 10% **5.000.000đ/lần**, và tiền làm thêm giờ miễn thuế **100%** (trước chỉ miễn phần chênh lệch hệ số). Mã nguồn, mặc định cấu hình và dữ liệu tenant đều đã đồng bộ — xem `docs/hrm/work-log.md` phiên 19:50. **Đừng đọc đoạn trên rồi kết luận là 3 điểm đó còn lỗi thời.**

---

## 15. Câu hỏi mở (Open Questions)

> 4 câu hỏi dưới đây được mang nguyên từ `docs/hrm/to_khai_thue/brainstorms/2026-09-14-to-khai-thue-tncn-brainstorm.md` Mục 6, giữ nguyên nội dung và trạng thái MỞ — KHÔNG tự trả lời.

| ID | Câu hỏi | Ai trả lời | Chặn việc gì |
|---|---|---|---|
| OQ-tkt-01 | Mốc chuyển kỳ khai tháng→quý từ Quý III/2026: có cần import dữ liệu lịch sử trước 2026 (Quý I, II/2026 nếu công ty từng theo dõi theo tháng) vào hệ thống theo mẫu tờ khai mới không, hay chỉ cần HIỂN THỊ lại? | Kế toán trưởng / Product | Phạm vi công việc import dữ liệu lịch sử khi triển khai `to-khai-tncn` |
| OQ-tkt-02 | Nửa đầu 2026 (T1–T6) khấu trừ thuế TNCN hàng tháng có tạm áp biểu 7 bậc cũ trước khi chuyển sang biểu 5 bậc mới hay không? Nguồn nghiên cứu web chưa thống nhất hoàn toàn — nguồn đáng tin nhất (EY Vietnam, trích Điều 29 Luật 109/2025/QH15) cho rằng áp dụng biểu mới từ kỳ tính thuế 2026 (cả năm), nhưng có nguồn báo chí nói khấu trừ hàng tháng H1/2026 vẫn tạm theo biểu cũ | Kế toán trưởng, hoặc đọc thẳng Điều 29 Luật 109/2025/QH15 / Thông tư 87/2026/TT-BTC bản gốc | Cách tính lại/xác nhận dữ liệu payroll đã chốt của các kỳ T1–T6/2026 trước khi golive dữ liệu thật (mức độ rủi ro pháp lý CAO — cần xác nhận trước khi golive) |
| OQ-tkt-03 | Mức miễn thuế trang phục bằng tiền 5.000.000đ/người/năm: đây là mức MỚI theo luật 2025/2026 hay kế thừa mức cũ (vốn cũng là 5.000.000đ/năm theo Thông tư 111/2013)? | Kế toán trưởng, hoặc tra Thông tư 87/2026/TT-BTC bản gốc | Giá trị mặc định chính xác cho `exemptCapAmount` của danh mục "Trang phục bằng tiền" (BR-tkt-002) |
| OQ-tkt-04 | Bảo hiểm nhân thọ/bảo hiểm không bắt buộc có tích lũy phí do doanh nghiệp mua cho người lao động (khấu trừ 10% trên phí): Thông tư hướng dẫn Nghị định 253/2026/NĐ-CP có đổi mức khấu trừ này không, hay giữ nguyên quy tắc cũ? | Kế toán trưởng, hoặc chờ Thông tư hướng dẫn chính thức | Có cần thêm 1 nhóm xử lý thuế riêng cho loại thu nhập này trong danh mục (BR-tkt-001) hay xếp tạm vào `WITHHOLDING_FLAT` hiện có |
| OQ-tkt-05 `[MỚI 2026-09-14 — phát sinh từ phản biện Architect P-12]` | 3 chỉ tiêu `ct24`/`ct25`/`ct32` của mẫu 05/KK-TNCN chưa xác nhận được định nghĩa pháp lý chính xác (code nháp cũ để `0` cho cả 3; `ct32` đã có đề xuất công thức tạm ở `data-model-to-khai-thue.md` Mục 8) | Kế toán trưởng, đối chiếu Thông tư 89/2026/TT-BTC bản gốc | Nếu để `0`/công thức tạm, kế toán phải ghi đè tay 3 chỉ tiêu này mỗi quý — đi ngược mục tiêu G3. **Cập nhật 2026-09-15:** chủ dự án chốt tạm cả `ct24`, `ct25`, `ct32` = `0` (theo nhãn mẫu, `ct32` là thuế khấu trừ trên phí bảo hiểm nhân thọ của DN bảo hiểm nước ngoài — không phải thuế lương), kế toán ghi đè nếu phát sinh; bỏ công thức đề xuất cũ của `ct32` ở data-model. Vẫn chờ đối chiếu Thông tư 89/2026/TT-BTC bản gốc |

**Tham chiếu chéo (không thuộc 4 OQ trên, đã treo sẵn ở `srs/hrm-spec.md`):** `OQ-hrm-34` (quyết toán thuế TNCN theo năm suy ngưỡng bằng cách nhân 12 lần ngưỡng tháng hay công ty phải khai riêng 1 biểu năm) — liên quan tab `to-khai-quyet-toan`, để đợt sau, không chặn 3 tính năng đợt này.

---

## 16. Ma trận truy vết (Traceability)

| Nhóm | Business Rules | Functional Requirements | Error Matrix | Use Cases | Acceptance Criteria | Nguồn brainstorm |
|---|---|---|---|---|---|---|
| Danh mục thu nhập ngoài lương | BR-tkt-001…004 | FR-tkt-001…004 | E-tkt-001…003 | UC-tkt-01 | AC-tkt-001…005 | Mục 2.1 (PA2), Mục 4 BR-05 |
| Bản ghi thu nhập ngoài lương | BR-tkt-005…009 | FR-tkt-005…008 | E-tkt-004…006 | UC-tkt-02, UC-tkt-03 | AC-tkt-006…015 | Mục 4 BR-05 |
| Bảng tính thuế tháng | BR-tkt-010…013 | FR-tkt-009…012 | E-tkt-007…009 | UC-tkt-04, UC-tkt-05 | AC-tkt-016…021 | Mục 2.2 (PA2), Mục 4 BR-01…04, Mục 5 |
| Tờ khai TNCN quý | BR-tkt-014…018 | FR-tkt-013…018 | E-tkt-010…013 | UC-tkt-06, UC-tkt-07, UC-tkt-08 | AC-tkt-022…028 | Mục 2.3 (PA2), Mục 4 BR-06, Mục 5 |
| Xuyên suốt (hiệu lực & phân quyền) | BR-tkt-017, A-tkt-01…02, A-tkt-08 | Áp cho mọi FR | E-tkt-014 | Mọi UC | — | Mục 4 BR-07, `OQ-hrm-35` |
