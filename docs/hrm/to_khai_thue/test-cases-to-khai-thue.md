---
type: test-cases
feature: hrm-to-khai-thue
status: draft
updated: 2026-09-14
author: tester-qa
links:
  - docs/hrm/to_khai_thue/srs-to-khai-thue.md
  - docs/hrm/to_khai_thue/test-matrix-to-khai-thue.md
---

# HR — TEST CASES: Thu nhập ngoài lương, Bảng tính thuế & Tờ khai thuế TNCN (`to_khai_thue`)

> **Giai đoạn**: Phase A — thiết kế, CHƯA CHẠY. Cột "Kết quả mong đợi" viết theo SRS; **Actual Result / Status để TRỐNG có chủ đích**, điền ở Phase B. Không ca nào ở đây được đánh PASS.
> **Quy ước áp dụng cho mọi ca** (suy đoán từ `docs/hrm/qa/test-matrix.md` Mục 2 lúc thiết kế — nay đã có `api-contract-to-khai-thue.md` chính thức, xem cảnh báo cập nhật ở `test-matrix-to-khai-thue.md` Mục 9 điểm 6, cần rà lại path trước khi chạy Phase B):
> - Base path `/api/v1/hrm/to-khai-thue/...` (suy đoán); xác thực cookie access httpOnly.
> - Thành công: `POST`→**201**, `GET/PUT/PATCH/DELETE`→**200**; vỏ `{ "success": true, "data": … }`.
> - Lỗi Zod→**400** `{success:false, errors}`; `ConflictError`→**409**; `NotFoundError`→**404**; `ForbiddenError`→**403**.
> - Trừ khi ghi rõ, tài khoản test là kế toán có "quyền xem dữ liệu lương" (OWNER hoặc OWNER_EMPLOYEE đủ quyền), tenant Công ty A, kỳ Quý III/2026 (T7-T9).
> - Ưu tiên: P0 = chặn phát hành · P1 = phải có trước bàn giao · P2 = nên có.

---

## Nhóm 1 — Danh mục loại thu nhập ngoài lương (BR-tkt-001…004, FR-tkt-001…004, E-tkt-001…003, UC-tkt-01) — TC-tkt-001…013

| ID | Loại | Yêu cầu | Tiền điều kiện | Các bước & dữ liệu vào | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|---|---|:--:|
| TC-tkt-001 | Happy | BR-tkt-001, AC-tkt-002 | Chưa có danh mục "Phụ cấp kiêm nhiệm" | `POST .../danh-muc-thu-nhap` `{name:"Phụ cấp kiêm nhiệm", taxTreatmentGroup:"WITHHOLDING_FLAT"}` (không nhập rate/threshold) | 201; `withholdingRate=10.0`, `withholdingThreshold=5000000` (mặc định tự áp) | P0 |
| TC-tkt-002 | Validation | BR-tkt-003, AC-tkt-001 | — | `POST .../danh-muc-thu-nhap` `{name:"Ăn ca thêm", taxTreatmentGroup:"EXEMPT_CAPPED"}` (bỏ trống `exemptCapAmount`) | 400 E-tkt-003 | P0 |
| TC-tkt-003 | Validation | BR-tkt-003 (bổ sung) | — | `POST` `{name:"Hoa hồng B", taxTreatmentGroup:"WITHHOLDING_FLAT", withholdingRate:null, withholdingThreshold:null}` cùng lúc thiếu CẢ 2 field bắt buộc theo nhóm | 400 E-tkt-003 — xác nhận validate không dừng ở field đầu tiên thiếu (AC-tkt-001 chỉ test case EXEMPT_CAPPED, đây là biến thể WITHHOLDING_FLAT) | P1 |
| TC-tkt-004 | Happy | BR-tkt-002, AC-tkt-003 | Tenant mới tạo, chưa có danh mục nào | Mở màn "Thu nhập ngoài lương" lần đầu (hoặc `GET .../danh-muc-thu-nhap` lần đầu) | Hệ thống tự sinh ≥1 danh mục "Ăn ca tiền mặt" `taxTreatmentGroup=EXEMPT_CAPPED`, `exemptCapAmount=1200000`, `exemptCapPeriod=MONTHLY` | P0 |
| TC-tkt-005 | Happy | BR-tkt-002 | nt | `GET .../danh-muc-thu-nhap` | Có ≥1 danh mục đại diện mỗi nhóm: `EXEMPT_FULL` (vd "Làm thêm giờ/ca đêm", **và "Ăn ca DN tự nấu" — chuyển nhóm theo quyết định BA 2026-09-14, xem BR-tkt-002 sửa**), `EXEMPT_CAPPED` gồm "Trang phục bằng tiền" (`exemptCapAmount=5000000`, `exemptCapPeriod=YEARLY` — ⚠️ giá trị treo OQ-tkt-03), `TAXABLE_FULL` (vd "Thưởng Tết"), `WITHHOLDING_FLAT` ("Hoa hồng/thù lao..."). **Không khẳng định số dòng chính xác** — đối chiếu đúng 12 danh mục theo `data-model-to-khai-thue.md` Mục 7.2 khi vào Phase B | P1 |
| TC-tkt-006 | Edge | BR-tkt-003, AC-tkt-004 | Đã có "Hoa hồng đại lý" | `POST` name="hoa hồng đại lý" (khác hoa/thường) | 400 E-tkt-001 | P0 |
| TC-tkt-007 | Edge | BR-tkt-003 (bổ sung) | Đã có `code="TN05"` | `POST` `{code:"TN05", name:"Tên khác hẳn"}` | 400 E-tkt-001 — xác nhận check trùng áp cho CẢ `code` lẫn `name` độc lập (AC-tkt-004 chỉ test trùng tên) | P1 |
| TC-tkt-008 | Happy | FR-tkt-003 | Danh mục `code="TN01"` tồn tại | `PUT .../danh-muc-thu-nhap/TN01` gửi kèm `code:"TN99"` trong payload | 200; đọc lại `code` vẫn `TN01` — mã bất biến sau tạo (FE strip hoặc BE `.omit()` field `code`) | P0 |
| TC-tkt-009 | Validation | BR-tkt-003 (bổ sung) | Danh mục `taxTreatmentGroup=TAXABLE_FULL` tồn tại | `PUT` đổi `taxTreatmentGroup="EXEMPT_CAPPED"` nhưng không kèm `exemptCapAmount` | 400 E-tkt-003 — xác nhận **sửa** cũng re-validate theo nhóm mới, không chỉ áp dụng lúc tạo | P0 |
| TC-tkt-010 | Edge | BR-tkt-004, AC-tkt-005 | Danh mục "Thưởng sáng kiến" đã có `OtherIncomeRecord` dùng | `DELETE .../danh-muc-thu-nhap/<id>` | 400 E-tkt-002, thông điệp gợi ý chuyển `INACTIVE` | P0 |
| TC-tkt-011 | Happy | FR-tkt-004 | Danh mục chưa/đã có bản ghi sử dụng | `PATCH` `{status:"INACTIVE"}` | 200; danh mục KHÔNG còn trong dropdown tạo bản ghi mới nhưng vẫn hiển thị đúng tên ở bản ghi cũ đã dùng nó | P0 |
| TC-tkt-012 | Happy | FR-tkt-002 | Có đủ 4 nhóm, có cả ACTIVE/INACTIVE | `GET .../danh-muc-thu-nhap?taxTreatmentGroup=WITHHOLDING_FLAT&status=ACTIVE` | 200, chỉ trả danh mục khớp cả 2 filter | P1 |
| TC-tkt-013 | Boundary | BR-tkt-003 | — | `POST` `name` đúng 200 ký tự → 201; `name` 201 ký tự → 400 | Biên đúng theo `String ≤200` của §4.1 | P2 |

---

## Nhóm 2 — Bản ghi thu nhập ngoài lương: nhân viên nội bộ (BR-tkt-005…009, FR-tkt-005…008, E-tkt-004…005, UC-tkt-02) — TC-tkt-014…024

| ID | Loại | Yêu cầu | Tiền điều kiện | Các bước & dữ liệu vào | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|---|---|:--:|
| TC-tkt-014 | Happy | FR-tkt-005 | `NV0001` tồn tại, kỳ T9/2026 tồn tại (Nháp) | `POST .../thu-nhap-ngoai-luong` `{payrollPeriodId, ma_nv:"NV0001", otherIncomeCategoryId:<TAXABLE_FULL "Thưởng">, paymentDate:"2026-09-15", paymentType:"GROSS", soTienChiTra:5000000}` | 201; `grossAmount=5000000`, `taxWithheld=0` | P0 |
| TC-tkt-015 | Happy | FR-tkt-005 | nt | `POST` chọn `ma_nv:"nv0001"` (chữ thường) | 201; `ma_nv` chuẩn hóa in hoa `NV0001` (đúng convention chung của HRM) | P1 |
| TC-tkt-016 | Happy | BR-tkt-005 | nt | `POST` đầy đủ trường bắt buộc cho nội bộ | 201, `grossAmount`/`netAmount` tính đúng theo nhóm danh mục | P0 |
| TC-tkt-017 | Validation | BR-tkt-005, AC-tkt-006 | — | `POST` bỏ trống `fullName` (trường hợp cố tình bỏ cả `ma_nv` lẫn tên) | 400 E-tkt-004 | P0 |
| TC-tkt-018 | Edge | BR-tkt-006, AC-tkt-007 | Đã có bản ghi hoa hồng 6.000.000đ ngày 10/09/2026 cho `NV0001` (kiêm nhiệm, `WITHHOLDING_FLAT`) | `POST` lại đúng bản ghi (cùng đối tượng+kỳ+loại+ngày+tiền) | 409 E-tkt-005 | P0 |
| TC-tkt-019 | Edge | BR-tkt-006, AC-tkt-008 | nt | `POST` thêm bản ghi 4.000.000đ ngày 20/09/2026 (khác ngày, khác tiền, cùng loại/đối tượng) | 201 — không bị coi trùng | P0 |
| TC-tkt-020 | Concurrency | BR-tkt-006, EC-tkt-07 | — | `Promise.all` 2 request `POST` cùng payload hệt nhau (double-click) | 1 request 201, request còn lại 409 E-tkt-005 — KHÔNG có 2 bản ghi trùng | P1 |
| TC-tkt-021 | Edge | BR-tkt-005 (GAP-QA-tkt-05) | — | `POST` với `ma_nv:"NV9999"` (không tồn tại) | 404 `E-tkt-016` (mã chính thức theo `api-contract-to-khai-thue.md` — cập nhật 2026-09-14, thay placeholder cũ) | P1 |
| TC-tkt-022 | Edge | BR-tkt-009, AC-tkt-015 | `NV0001` (nội bộ) | `POST` chọn danh mục `TAXABLE_FULL` cho bản ghi gắn `ma_nv` hợp lệ | 201 — hợp lệ (đối chứng dương cho BR-tkt-009, không phải chỉ test âm) | P0 |
| TC-tkt-023 | Happy | FR-tkt-006 | Bản ghi Nháp thuộc kỳ chưa chốt | `PUT .../thu-nhap-ngoai-luong/<id>` sửa `soTienChiTra` | 200; `grossAmount`/`netAmount`/`taxWithheld` TÍNH LẠI theo giá trị mới (re-check BR-tkt-007) | P0 |
| TC-tkt-024 | Edge | FR-tkt-006 | Bản ghi Nháp | `PUT` đổi `otherIncomeCategoryId` sang danh mục thuộc nhóm khác (vd từ `TAXABLE_FULL` sang `WITHHOLDING_FLAT`) | 200; toàn bộ field tính lại (`taxWithheld` xuất hiện nếu đổi sang `WITHHOLDING_FLAT`) — re-check đầy đủ BR-tkt-007/008/009 khi sửa, không chỉ khi tạo | P0 |

---

## Nhóm 3 — Bản ghi thu nhập ngoài lương: cá nhân vãng lai/CTV + Cam kết 08 (UC-tkt-03) — TC-tkt-025…033

| ID | Loại | Yêu cầu | Tiền điều kiện | Các bước & dữ liệu vào | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|---|---|:--:|
| TC-tkt-025 | Happy | BR-tkt-005, UC-tkt-03 | — | `POST` `{ma_nv:null, fullName:"Nguyễn Văn A", otherIncomeCategoryId:<WITHHOLDING_FLAT>, paymentDate, paymentType:"GROSS", soTienChiTra:6000000}` (không MST/CCCD) | 201 — MST/CCCD tùy chọn khi KHÔNG Cam kết 08 (A-tkt-06) | P0 |
| TC-tkt-026 | Happy | AC-tkt-011 | nt | Kế thừa TC-tkt-025 | `taxWithheld=600000`, `netAmount=5400000` | P0 |
| TC-tkt-027 | Happy (mới — chưa AC nào test NET) | BR-tkt-007 nhánh WITHHOLDING_FLAT/NET | Vãng lai, không Cam kết 08 | `POST` `paymentType:"NET"`, `soTienChiTra:5400000`, rate mặc định 10% | `grossAmount=round(5400000/0.9)=6000000`, `taxWithheld=600000`, `netAmount=5400000` — đối xứng đúng với TC-tkt-026 (GROSS↔NET) | P0 |
| TC-tkt-028 | Edge | AC-tkt-012 | — | `POST` GROSS, `soTienChiTra=4000000` (dưới ngưỡng 5tr), không tick yêu cầu khấu trừ | `taxWithheld=0` | P0 |
| TC-tkt-029 | Boundary (mới) | BR-tkt-008 | — | `POST` GROSS, `soTienChiTra=5000000` (ĐÚNG ngưỡng, không phải trên/dưới) | `taxWithheld=round(5000000×10%)=500000` — điều kiện code là `< threshold` nên đúng-ngưỡng RƠI VÀO nhánh khấu trừ, khớp chữ "≥5.000.000đ" của BR-tkt-008. **Đây là biên chưa AC nào test** (AC-tkt-011 dùng 6tr, AC-tkt-012 dùng 4tr) | P0 |
| TC-tkt-030 | Edge | AC-tkt-013 | Cá nhân có MST | `POST` tick Cam kết 08, `soTienChiTra=7000000` | `taxWithheld=0` dù vượt ngưỡng | P0 |
| TC-tkt-031 | Validation | AC-tkt-014 | — | `POST` tick Cam kết 08, bỏ trống `taxCode` | 400 E-tkt-006 | P0 |
| TC-tkt-032 | Edge | BR-tkt-009, AC-tkt-015 | Vãng lai (`ma_nv=null`) | `POST` chọn danh mục thuộc nhóm `TAXABLE_FULL` | 400 `E-tkt-021` (mã chính thức theo `api-contract-to-khai-thue.md` — cập nhật 2026-09-14, thay placeholder cũ); chỉ chấp nhận danh mục `WITHHOLDING_FLAT` | P0 |
| TC-tkt-033 | Edge (mới) | BR-tkt-008 | Vãng lai, `hasCommitment08=true`, `isResident=true`, CÓ `taxCode` | `POST` Cam kết 08 hợp lệ đủ 3 điều kiện NHƯNG `isResident=false` bị set nhầm trước đó rồi sửa lại true — test riêng: `hasCommitment08=true` nhưng `isResident=false` | Cam kết 08 KHÔNG được áp dụng (thiếu điều kiện `isResident=true`, theo đúng literal AND của BR-tkt-008 đã mở rộng ngữ nghĩa `E-tkt-006` 2026-09-14) → 400 `E-tkt-006` — biên tổ hợp 3 điều kiện nay đã có mã lỗi chính thức, không còn là giả định | P1 |

---

## Nhóm 4 — Công thức tính thuế theo bản ghi, 4 nhánh (BR-tkt-007) — kiểm chứng tay chi tiết — TC-tkt-034…051

> Đã tự tính tay toàn bộ công thức trong `test-matrix-to-khai-thue.md` Mục 0. Không phát hiện off-by-one trong 4 nhánh công thức tự thân; các gap phát hiện là THIẾU công thức (nhánh TAXABLE_FULL/NET) và THIẾU validation range (`withholdingRate`), không phải sai công thức đã có.

### 4.1 Nhánh EXEMPT_FULL

| ID | Kịch bản | Input | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|:--:|
| TC-tkt-034 | Happy, AC-tkt-009 | "Làm thêm giờ" (EXEMPT_FULL), 2.000.000đ | `grossAmount=netAmount=2000000`, `taxWithheld=0`, KHÔNG cộng `thu_nhap_ngoai` | P0 |
| TC-tkt-035 | Boundary (mới) | soTienChiTra = 0đ | *(giả định)* 400 — không có mã lỗi cụ thể cho "số tiền chi trả phải > 0" trong Error Matrix (không phải BR-tkt-004/005/006), test thiết kế để PHƠI BÀY khoảng trống validate số tiền tối thiểu | P2 |

### 4.2 Nhánh EXEMPT_CAPPED

| ID | Kịch bản | `exemptCapAmount` | `soTienChiTra` | `phanMienThue` | `phanVuotTran` | Ưu tiên |
|---|---|---|---|---|---|:--:|
| TC-tkt-036 | Dưới trần | 1.200.000 | 1.000.000 | 1.000.000 | 0 | P1 |
| TC-tkt-037 | Đúng trần (boundary, mới) | 1.200.000 | 1.200.000 | 1.200.000 | **0** | P0 |
| TC-tkt-038 | Vượt trần, AC-tkt-010 | 1.200.000 | 1.500.000 | 1.200.000 | 300.000 (cộng `thu_nhap_ngoai`) | P0 |
| TC-tkt-039 | Trần YEARLY, 1 lần chi trả trong năm (mới) | 5.000.000/năm | 3.000.000 (tháng 7) | 3.000.000 | 0 | P1 |
| TC-tkt-040 | Trần YEARLY, LẦN 2 trong CÙNG năm cho CÙNG người (mới, ĐÃ CHỐT 2026-09-14) | 5.000.000/năm | 3.000.000 (tháng 9, sau TC-tkt-039 đã dùng 3tr) | **2.000.000** (5tr − 3tr đã dùng trong năm — BA đã chốt tính LŨY KẾ theo năm, xem BR-tkt-002 sửa) | **1.000.000** (cộng `thu_nhap_ngoai`) | P0 |
| TC-tkt-041 | "Ăn ca DN tự nấu" (mới) | N/A — `[SỬA 2026-09-14]` chuyển sang nhóm `EXEMPT_FULL`, không còn thuộc `EXEMPT_CAPPED` | 50.000.000 (số cực đoan) | 50.000.000 (miễn toàn bộ, theo nhánh 4.1 EXEMPT_FULL) | 0 | P2 |

### 4.3 Nhánh TAXABLE_FULL

| ID | Kịch bản | Input | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|:--:|
| TC-tkt-042 | Happy | "Thưởng Tết" 5.000.000đ, `paymentType=GROSS`, `ma_nv` hợp lệ | `grossAmount=5000000`, `taxWithheld=0`, cộng `thu_nhap_ngoai` của tháng | P0 |
| TC-tkt-043 | Edge — thiếu ma_nv | Vãng lai chọn nhóm TAXABLE_FULL | Chặn ở BR-tkt-009 (xem TC-tkt-032), không tới được bước tính công thức | P0 |
| TC-tkt-044 | Edge, GAP-QA-tkt-01 (VẪN 🔴, CHƯA có quyết định BA) | `paymentType=NET`, `soTienChiTra=5000000`, `ma_nv` hợp lệ | *(GIẢ ĐỊNH — vẫn treo)* hệ thống tạm CHẶN 400 "chưa hỗ trợ NET cho nhóm chịu thuế toàn phần" — vì công thức quy đổi NET→GROSS chưa được định nghĩa (phụ thuộc vòng vào thuế suất lũy tiến biên chưa biết trước). Đây là gap 🔴 DUY NHẤT còn lại chưa được BA/Architect quyết định tại Final Sign-off 2026-09-14 | P0 |
| TC-tkt-045 | Edge (đối chứng) | `paymentType=NET` cho nhóm `EXEMPT_FULL`/`EXEMPT_CAPPED` | GROSS=NET (không có thuế nào để quy đổi) — nhánh NET vô hại cho 2 nhóm miễn thuế, chỉ nhóm TAXABLE_FULL mới có vấn đề (đối chứng cho TC-tkt-044, xác nhận vấn đề CHỈ ở TAXABLE_FULL) | P1 |

### 4.4 Nhánh WITHHOLDING_FLAT — bổ sung (phần chính đã ở Nhóm 3)

| ID | Kịch bản | Input | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|:--:|
| TC-tkt-046 | Boundary rounding NET | `paymentType=NET`, `soTienChiTra=5000000`, rate=10% | `grossAmount=round(5000000/0.9)=round(5555555.56)=5555556`; `taxWithheld=555556`; `netAmount=5000000` — kiểm quy tắc làm tròn không gây lệch netAmount | P1 |
| TC-tkt-047 | Edge (GAP-QA-tkt-03) | Danh mục có `withholdingRate=100` (không bị chặn lúc tạo — TC-tkt-014 Nhóm 1 không test range), `paymentType=NET`, `soTienChiTra=5000000` | *(PHƠI BÀY RỦI RO)* `grossAmount = round(5000000/(1-1)) = round(5000000/0) = Infinity/NaN` — kỳ vọng: hệ thống PHẢI chặn ở bước validate (400) trước khi tính, KHÔNG được cho ra `Infinity`/lỗi 500. Nếu ra 500 hoặc lưu `NaN` vào DB → BUG nghiêm trọng | P0 |
| TC-tkt-048 | Edge (GAP-QA-tkt-03) | Danh mục `withholdingRate=150` (>100, không bị chặn) | *(PHƠI BÀY RỦI RO)* nhánh NET: `1-rate/100 = -0.5` → `grossAmount` ÂM. Kỳ vọng: hệ thống chặn (400), không cho lưu số âm | P1 |
| TC-tkt-049 | Regression | GROSS, rate tùy chỉnh 15% (không phải mặc định 10%) | `taxWithheld=round(soTienChiTra×15%)` — xác nhận dùng đúng `withholdingRate` CỦA DANH MỤC, không hardcode 10% | P1 |
| TC-tkt-050 | Edge | `hasCommitment08=true`, `taxCode` có, nhưng `isResident=false` | Cam kết 08 KHÔNG áp dụng (điều kiện AND đủ 3 vế) → 400 `E-tkt-006` (xem TC-tkt-033, nay có mã chính thức) | P1 |
| TC-tkt-051 | Boundary | `soTienChiTra` âm hoặc = 0 | *(giả định)* 400 — cùng loại gap với TC-tkt-035, không có mã lỗi Error Matrix riêng cho "số tiền phải dương", áp dụng chung mọi nhánh | P2 |

---

## Nhóm 5 — Bảng tính thuế tháng: gộp thu nhập + tính lũy tiến + ranh giới bậc thuế (BR-tkt-010…012, FR-tkt-009…010) — TC-tkt-052…065

### 5.1 Giảm trừ khác (BR-tkt-010)

> **Cập nhật 2026-09-14 (BA Final Sign-off, phản biện P-17):** BH hưu trí tự nguyện/từ thiện xác nhận NGOÀI PHẠM VI đợt này — chưa có màn nhập liệu. `AC-tkt-016` đã sửa lại trong SRS để khớp thực tế. 3 test case dưới đây (TC-tkt-052…054, thiết kế theo AC-tkt-016 CŨ) nay chỉ còn giá trị tham khảo cho đợt sau khi bổ sung màn nhập liệu — KHÔNG áp dụng cho Phase B của đợt này.

| ID | Kịch bản | Input | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|:--:|
| TC-tkt-052 | ~~Happy~~ `[NGOÀI PHẠM VI 2026-09-14]` | BH hưu trí tự nguyện 4.000.000đ/tháng | `giam_tru_bao_hiem` chỉ cộng tối đa 3.000.000đ phần bảo hiểm hưu trí tự nguyện, phần vượt 1.000.000đ KHÔNG được trừ | P0→~~để đợt sau~~ |
| TC-tkt-053 | ~~Boundary~~ `[NGOÀI PHẠM VI 2026-09-14]` | BH hưu trí tự nguyện ĐÚNG 3.000.000đ | `giam_tru_bao_hiem` cộng đủ 3.000.000đ (không bị cắt bớt tại đúng biên) | P0→~~để đợt sau~~ |
| TC-tkt-054 | ~~Boundary~~ `[NGOÀI PHẠM VI 2026-09-14]` | BH hưu trí tự nguyện 2.999.999đ | `giam_tru_bao_hiem` cộng đủ 2.999.999đ (dưới trần, không chạm giới hạn) | P2→~~để đợt sau~~ |
| TC-tkt-052b `[MỚI 2026-09-14 — thay thế phạm vi test thật của Phase B]` | Happy, AC-tkt-016 (bản sửa) | Nhân viên nội bộ HĐLĐ ≥3 tháng có bảo hiểm bắt buộc trích theo lương, không có khoản hưu trí tự nguyện/từ thiện nào | `giam_tru_bao_hiem` chỉ gồm đúng phần BH bắt buộc 10,5% — không có phần nào khác | P0 |

### 5.2 Gộp thu nhập + ranh giới bậc thuế lũy tiến (BR-tkt-011, BR-tkt-012) — kiểm chứng tay ranh giới 10tr/30tr/60tr/100tr

> Bảng dưới verify công thức cộng dồn (`khoang` = ngưỡng trên lũy kế) của BR-hrm-081, áp dụng qua đường gộp MỚI của `to_khai_thue` (A-tkt-03: tái dùng engine, không viết lại). Nếu FAIL, nghi vấn đầu tiên là code gộp `thu_nhap_luong + thu_nhap_ngoai` của `to_khai_thue`, KHÔNG phải bản thân engine biểu thuế (đã test ở `hrm/qa` khác) — **lưu ý: `data-model-to-khai-thue.md` phản biện P-01 xác nhận engine hiện tại (`tinhThueLuyTien()`) đang hardcode biểu 7 bậc CŨ, nên các test dưới đây sẽ FAIL cho tới khi `task_defff3dd` được xử lý — đây là lỗi đã biết, không phải lỗi của code `to_khai_thue`.**

| ID | `thu_nhap_tinh_thue` | Vị trí | `thue_luy_tien` kỳ vọng | Công thức kiểm tay |
|---|---:|---|---:|---|
| TC-tkt-055 | 10.000.000 | Đúng biên bậc 1 (≤10tr → 5%) | 500.000 | `10.000.000×5%` |
| TC-tkt-056 | 10.000.001 | Vừa qua biên bậc 1→2 | 500.000,1 (làm tròn theo quy tắc kế thừa hrm-spec, KHÔNG phải quyết định của SRS này) | `500.000 + 1×10%` |
| TC-tkt-057 | 30.000.000 | Đúng biên bậc 2 (≤30tr → cộng dồn tới 10%) | 2.500.000 | `500.000 + 20.000.000×10%` |
| TC-tkt-058 | 60.000.000 | Đúng biên bậc 3 | 8.500.000 | `2.500.000 + 30.000.000×20%` |
| TC-tkt-059 | 100.000.000 | Đúng biên bậc 4 | 20.500.000 | `8.500.000 + 40.000.000×30%` |
| TC-tkt-060 | 100.000.001 | Vừa vào bậc 5 (bậc mở, 35%) | 20.500.000,35 | `20.500.000 + 1×35%` |

| ID | Kịch bản gộp (mới, khác AC-tkt-017) | Input | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|:--:|
| TC-tkt-061 | Happy, AC-tkt-017 (bản sửa 2026-09-14 — có điều kiện `trich_bhxh=false`) | lương 20tr + ngoài lương TAXABLE_FULL 5tr, giảm trừ bản thân 15,5tr, không có NPT, **hợp đồng không trích BHXH** | `thu_nhap_tinh_thue=9.500.000`, `thue_luy_tien=475.000` (bậc 1) — khớp SRS, KHÔNG phát hiện sai lệch | P0 |
| TC-tkt-062 | Edge (mới) — **gộp làm ĐỔI BẬC thuế** | Thu nhập tính thuế TỪ LƯƠNG riêng = 29.000.000 (bậc 2, thuế riêng = 2.400.000); cộng thêm `thu_nhap_ngoai` TAXABLE_FULL = 3.000.000 | Gộp: `thu_nhap_tinh_thue=32.000.000` (CHUYỂN sang bậc 3) → `thue_luy_tien = 2.500.000 + 2.000.000×20% = 2.900.000` — chứng minh việc gộp thu nhập ngoài lương có thể đẩy người lao động sang bậc thuế CAO HƠN so với tính riêng lương, đây là hành vi CỐT LÕI mới của feature này, cần test rõ ràng (không AC nào của SRS test case "đổi bậc") | P0 |
| TC-tkt-063 | Edge — GAP-QA-tkt-08 (ĐÃ CHỐT 2026-09-14, đảo ngược giả định ban đầu) | Vãng lai (`ma_nv=null`) có 2 bản ghi `WITHHOLDING_FLAT` trong CÙNG tháng (theo AC-tkt-008) | **Architect đã chốt dùng `recipientKey` (ADR-013 quyết định 5)**: cả 2 bản ghi GỘP thành **1 dòng duy nhất** `MonthlyTaxCalculationLine` (khóa `recipientKey = 'VL:' + tên chuẩn hóa`); `thue_toan_phan` của dòng đó = TỔNG `taxDeducted` của CẢ 2 bản ghi. Chỉ tiêu `[16]` đếm đúng 1 người. **Đảo ngược hoàn toàn giả định "không gộp" đã viết ban đầu — cần viết lại test case thật ở Phase B** | P0 |
| TC-tkt-064 | Edge | HĐ `thoi_vu_thu_viec` (NV0002) nhận thêm hoa hồng kiêm nhiệm qua màn này (EC-tkt-06, A-tkt-11) | `thue_toan_phan` = khấu trừ 10%/ngưỡng 5tr của khoản kiêm nhiệm (BR-tkt-008) CỘNG khấu trừ 10%/ngưỡng 2tr của chính lương thử việc (BR-dltl-026) — **2 CƠ CHẾ ĐỘC LẬP, KHÔNG gộp chung 1 ngưỡng** — theo đúng A-tkt-11 (vẫn đánh dấu CHƯA CHỐT chính thức, không đổi bởi quyết định `khoan` 2026-09-14 vì đây là case khác — `thu_viec`, không phải `khoan`) | P1 |
| TC-tkt-065 | Regression | Không có `thu_nhap_ngoai` nào trong tháng (mọi nhân viên) | `thu_nhap_ngoai=0`, `tong_thu_nhap=thu_nhap_luong`, kết quả thuế Bảng tính thuế tháng KHỚP HỆT engine `payrollCalculation.service.ts` hiện có (không lệch do code gộp mới) — regression gate quan trọng nhất của cả feature (NFR-tkt-005) | P0 |

---

## Nhóm 6 — Vòng đời Bảng tính thuế tháng: chốt/mở lại (BR-tkt-013, FR-tkt-011…012, E-tkt-007…009, UC-tkt-04/05) — TC-tkt-066…075

| ID | Loại | Yêu cầu | Tiền điều kiện | Bước & dữ liệu vào | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|---|---|:--:|
| TC-tkt-066 | Happy, AC-tkt-018 | BR-tkt-013 | Kỳ T9/2026 payroll gốc đã `LOCKED`, Bảng tính thuế đang Nháp | `POST .../bang-tinh-thue/T9-2026/chot` | 200; trạng thái Nháp→Đã chốt | P0 |
| TC-tkt-067 | Happy | FR-tkt-011 | nt, sau chốt | `PUT .../thu-nhap-ngoai-luong/<id>` (bản ghi thuộc T9) | 403 E-tkt-007 — xác nhận khóa áp dụng ngay sau chốt | P0 |
| TC-tkt-068 | Edge, AC-tkt-019 | E-tkt-007 | nt | `DELETE .../thu-nhap-ngoai-luong/<id>` (thuộc T9 đã chốt) | 403 E-tkt-007 | P0 |
| TC-tkt-069 | Happy, AC-tkt-020 | BR-tkt-013 | Quý III/2026 chứa T9 CHƯA "Đã xuất tờ khai"; T9 đã chốt | `POST .../bang-tinh-thue/T9-2026/mo-lai` | 200; Đã chốt→Nháp | P0 |
| TC-tkt-070 | Edge (mới) | FR-tkt-012 | Sau TC-tkt-069 | `PUT .../thu-nhap-ngoai-luong/<id>` (thuộc T9, nay đã Nháp lại) | 200 — sửa được lại bình thường, xác nhận Mở lại thực sự mở khóa | P1 |
| TC-tkt-071 | Edge, AC-tkt-021 | E-tkt-009 | T7,T8,T9/2026 đều "Đã chốt" VÀ quý III/2026 đã "Đã xuất tờ khai" | `POST .../bang-tinh-thue/T8-2026/mo-lai` | 403 E-tkt-009 | P0 |
| TC-tkt-072 | Edge, GAP-QA-tkt-06 — ĐÃ CHỐT 2026-09-14 | BR-tkt-013 (bản sửa) | T7,T8,T9/2026 đều "Đã chốt" → quý III tự chuyển "Sẵn sàng xuất" (row `hrm_to_khai_tncn05` đã được TẠO, `trang_thai=READY_TO_EXPORT`), quý CHƯA "Đã xuất tờ khai" | `POST .../bang-tinh-thue/T9-2026/mo-lai` | 200 (E-tkt-009 chỉ chặn khi "Đã xuất tờ khai", không chặn ở "Sẵn sàng xuất") — **VÀ trong CÙNG giao dịch, hệ thống PHẢI xóa luôn row `hrm_to_khai_tncn05` của Quý III/2026** (BR-tkt-013 sửa 2026-09-14, `api-contract-to-khai-thue.md` Mục 4.3) | P0 |
| TC-tkt-073 | Edge (nối tiếp TC-tkt-072) — ĐÃ CHỐT 2026-09-14 | nt | Sau khi mở lại T9 (theo TC-tkt-072) | `GET .../to-khai-quy?year=2026&quarter=3` | Row đã bị xóa ở TC-tkt-072 ⇒ trả `trangThai: 'CHUA_SAN_SANG'` (đúng lại điều kiện BR-tkt-014, chỉ còn 2/3 tháng chốt) — KHÔNG còn là data không nhất quán | P0 |
| TC-tkt-074 | Edge, E-tkt-008 | BR-tkt-013 | Payroll gốc (`hrm_payroll_periods`) của T9 CHƯA `LOCKED` | `POST .../bang-tinh-thue/T9-2026/chot` | 400 E-tkt-008 | P0 |
| TC-tkt-075 | Concurrency (mới) | BR-tkt-013 | Kỳ T9 đang Nháp, đủ điều kiện chốt | `Promise.all` 2 request `chot` đồng thời | Đúng 1 request thành công (200 `DA_CHOT`), request còn lại **409 `E-tkt-018`** (mã chính thức theo `api-contract-to-khai-thue.md`, thay kỳ vọng chung chung "409/400" ban đầu) | P1 |

---

## Nhóm 7 — Tờ khai TNCN quý: điều kiện đủ + xuất Excel/PDF (BR-tkt-014…016, FR-tkt-013…015, E-tkt-010, UC-tkt-06) — TC-tkt-076…084

| ID | Loại | Yêu cầu | Tiền điều kiện | Bước & dữ liệu vào | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|---|---|:--:|
| TC-tkt-076 | Edge, AC-tkt-022 | E-tkt-010 | T7,T8 đã "Đã chốt", T9 còn "Nháp" | `GET .../to-khai-quy?year=2026&quarter=3` | Báo "CHƯA Sẵn sàng xuất" (`trangThai: 'CHUA_SAN_SANG'`), `POST .../xuat` bị từ chối 400 E-tkt-010 | P0 |
| TC-tkt-077 | Happy | BR-tkt-014 | Đủ 3 tháng "Đã chốt" | `GET .../to-khai-quy?year=2026&quarter=3` | Trạng thái "Sẵn sàng xuất" (`READY_TO_EXPORT`), tự động — không cần thao tác thủ công "tạo" tờ khai | P0 |
| TC-tkt-078 | Happy, AC-tkt-023 | FR-tkt-014 | nt | `POST .../to-khai-quy/2026/3/xuat` | 200, sinh file Excel + PDF (KHÔNG có XML — BA quyết định 2026-09-14); trạng thái →"Đã xuất tờ khai"; khóa cả 3 tháng (Mở lại bị chặn từ giờ — trùng E-tkt-009) | P0 |
| TC-tkt-079 | Happy | FR-tkt-014 | Sau xuất | Kiểm nội dung file Excel/PDF | Đủ 17 chỉ tiêu `ct16`…`ct32` (đếm đúng số lượng) **và** đủ chỉ tiêu [01]-[15] thông tin người nộp thuế (bổ sung theo FR-tkt-014 sửa 2026-09-14). **Không verify được giá trị đúng/sai của `ct24/ct25/ct32`** cho tới khi `OQ-tkt-05` có câu trả lời | P0 |
| TC-tkt-080 | Edge (mới — GAP-QA-tkt-07, ĐÃ CHỐT 2026-09-14) | BR-tkt-015 | Tờ khai đã "Đã xuất tờ khai" | `POST .../to-khai-quy/2026/3/xuat` lần 2 (double-export) | 409 `E-tkt-020` (mã chính thức theo `api-contract-to-khai-thue.md` Mục 5.5 — thay giả định "tải lại file" ban đầu, Architect chọn hướng từ chối cứng thay vì idempotent-reload) | P1 |
| TC-tkt-081 | Boundary | BR-tkt-014 | Chỉ 2/3 tháng có payroll period tồn tại (tháng thứ 3 CHƯA từng được tạo — vd công ty mới đăng ký giữa quý) | `GET .../to-khai-quy?year=2026&quarter=3` | *(giả định)* Không đủ điều kiện (thiếu 1 tháng ⇒ không thể "Đã chốt") — tương tự TC-tkt-076 nhưng do THIẾU KỲ chứ không phải thiếu trạng thái chốt; SRS (EC-tkt-01) chỉ nói rõ case "1 nhân viên thiếu dữ liệu trong tháng", CHƯA nói rõ case "cả công ty thiếu nguyên kỳ lương tháng" | P2 |
| TC-tkt-082 | Regression, AC-tkt-024 | BR-tkt-016 | FE nháp còn lựa chọn "Theo Tháng" | Backend nhận request với `kyLoai:"thang"` (FE cũ chưa dọn theo Mục 14 điểm 3) | 400 — backend PHẢI từ chối kỳ tháng dù FE cũ còn gửi (validator chặn theo `api-contract-to-khai-thue.md`), không được âm thầm chấp nhận rồi xử lý sai | P1 |
| TC-tkt-083 | Happy | FR-tkt-015 | Tờ khai "Sẵn sàng xuất" hoặc đã xuất | `GET .../to-khai-quy/2026/3/chi-tiet-nhan-vien` | 200, bảng chi tiết theo từng nhân viên NỘI BỘ (không bắt buộc đủ mẫu chính thức, chỉ phục vụ đối chiếu nội bộ) | P1 |
| TC-tkt-084 | Edge | BR-tkt-014 | 1 trong 3 tháng bị Mở lại NGAY TRƯỚC lúc `GET` trạng thái quý (race giữa chốt/mở và đọc trạng thái) | `GET .../to-khai-quy?year=2026&quarter=3` đúng thời điểm 1 tháng đang chuyển trạng thái | Trạng thái trả về phải PHẢN ÁNH ĐÚNG thời điểm đọc — nay đã có cơ chế xóa row tự động (TC-tkt-072) nên rủi ro window đọc sai giảm đáng kể, nhưng vẫn cần test race thật ở Phase B | P2 |

---

## Nhóm 8 — Ghi đè chỉ tiêu tờ khai (BR-tkt-018, FR-tkt-016, E-tkt-011…012, UC-tkt-07) — TC-tkt-085…091

| ID | Loại | Yêu cầu | Tiền điều kiện | Bước & dữ liệu vào | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|---|---|:--:|
| TC-tkt-085 | Happy, AC-tkt-025 | BR-tkt-018 | Tờ khai Quý III/2026 "Sẵn sàng xuất", `ct22` tự tính = 500.000.000đ | `POST .../to-khai-quy/2026/3/ghi-de` `{indicator:"ct22", value:480000000, reason:"loại trừ khoản kê nhầm kỳ trước"}` | 200; `finalIndicators.ct22=480000000`; `ct21` (=`ct22+ct23`) tự tính lại theo giá trị mới | P0 |
| TC-tkt-086 | Validation, AC-tkt-026 | E-tkt-011 | nt | `POST .../ghi-de` thiếu `reason` | 400 E-tkt-011 | P0 |
| TC-tkt-087 | Validation, AC-tkt-027 | E-tkt-012 | nt | `POST .../ghi-de` `{indicator:"ct21", ...}` (chỉ tiêu TỔNG HỢP, không phải gốc) | 400 E-tkt-012 | P0 |
| TC-tkt-088 | Boundary (mới) | BR-tkt-018 | nt | `POST .../ghi-de` cho TỪNG chỉ tiêu gốc còn lại trong danh sách 13 mã (`ct16,17,19,20,22,23,24,25,27,28,30,31,32`) | Cả 13 mã đều chấp nhận ghi đè — xác nhận danh sách "chỉ tiêu gốc" đúng đủ 13 mã, không thiếu/thừa | P1 |
| TC-tkt-089 | Edge (mới) | BR-tkt-018 | `ct26=ct27+ct28` | Ghi đè `ct27` VÀ `ct28` cùng lúc (2 request liên tiếp) | `ct26` tự tính lại ĐÚNG theo tổng 2 giá trị MỚI (không dùng giá trị cũ của 1 trong 2) — kiểm tính lại tầng 2 (chỉ tiêu tổng phụ thuộc 2 chỉ tiêu gốc cùng lúc bị đổi) | P1 |
| TC-tkt-090 | Edge, GAP-QA-tkt-07 — ĐÃ CHỐT 2026-09-14 | BR-tkt-018 | Tờ khai đã "Đã xuất tờ khai" | `POST .../ghi-de` cho `ct22` | 403 `E-tkt-019` (mã chính thức theo `api-contract-to-khai-thue.md` Mục 5.3 — Architect đã thêm, không còn là giả định) | P0 |
| TC-tkt-091 | Edge, GAP-QA-tkt-07 — ĐÃ CHỐT 2026-09-14 | BR-tkt-018 | Tờ khai đã "Đã nộp" | `POST .../ghi-de` | 403 `E-tkt-019` (cùng mã với TC-tkt-090 — trạng thái `SUBMITTED` cũng ≠ `READY_TO_EXPORT` nên cùng nhánh chặn) | P0 |

---

## Nhóm 9 — Đánh dấu tờ khai đã nộp + lịch sử (BR-tkt-015, FR-tkt-017…018, E-tkt-013, UC-tkt-08) — TC-tkt-092…096

| ID | Loại | Yêu cầu | Tiền điều kiện | Bước & dữ liệu vào | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|---|---|:--:|
| TC-tkt-092 | Edge, AC-tkt-028 | E-tkt-013 | Tờ khai đang "Sẵn sàng xuất" (chưa xuất) | `POST .../to-khai-quy/2026/3/danh-dau-da-nop` | 400 E-tkt-013 | P0 |
| TC-tkt-093 | Happy | FR-tkt-017 | Tờ khai đã "Đã xuất tờ khai" | `POST .../danh-dau-da-nop` | 200; trạng thái →"Đã nộp"; `submittedBy`/`submittedAt` ghi nhận đúng người/thời điểm | P0 |
| TC-tkt-094 | Edge (mới) | BR-tkt-015 | Tờ khai đã "Đã nộp" | `POST .../danh-dau-da-nop` lần 2 | 400 `E-tkt-013` (cùng mã — `trangThai != EXPORTED` khi đã `SUBMITTED` cũng rơi vào cùng điều kiện chặn của `api-contract-to-khai-thue.md` Mục 5.7) | P1 |
| TC-tkt-095 | Regression | BR-tkt-015 | nt | Xác nhận KHÔNG có xác thực thật với GDT — chỉ là cờ nội bộ | Thao tác không gọi bất kỳ API ngoài (GDT) nào, không cần mock cổng thuế | P2 |
| TC-tkt-096 | Happy, FR-tkt-018 | — | Có ≥2 kỳ quý với trạng thái khác nhau | `GET .../to-khai-quy?year=2026` (danh sách lịch sử) | 200, mỗi kỳ hiển thị đúng trạng thái + ai xuất/ai nộp + thời điểm | P1 |

---

## Nhóm 10 — Phân quyền xuyên suốt (E-tkt-014, A-tkt-08) — TC-tkt-097…102

> Không có AC nguồn nào trong SRS (GAP-QA-tkt-11) — toàn bộ nhóm này MỚI, thiết kế từ Mục 3 (Actors) + Ma trận lỗi. **Cập nhật 2026-09-14:** `api-contract-to-khai-thue.md` Mục 0.1 đã xác nhận rõ phạm vi 2 mức phân quyền (GAP-QA-tkt-12 đã đóng) — CRUD cơ bản (danh mục, bản ghi, chốt tháng) chỉ cần "quyền xem dữ liệu lương"; CHỈ 3 thao tác (Mở lại, Xuất, Đánh dấu nộp) cần ADMIN/OWNER.

| ID | Loại | Yêu cầu | Tiền điều kiện | Bước & dữ liệu vào | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|---|---|:--:|
| TC-tkt-097 | Authorization | E-tkt-014 | User KHÔNG có "quyền xem dữ liệu lương" | `POST .../bang-tinh-thue/T9-2026/chot` | 403 E-tkt-014 | P0 |
| TC-tkt-098 | Authorization | E-tkt-014 | User CÓ quyền lương nhưng KHÔNG phải ADMIN/OWNER | `POST .../bang-tinh-thue/T9-2026/mo-lai` | 403 E-tkt-014 (yêu cầu ADMIN/OWNER, không chỉ quyền lương — đã xác nhận Mục 0.1 contract) | P0 |
| TC-tkt-099 | Authorization | E-tkt-014 | User CÓ quyền lương nhưng KHÔNG phải ADMIN/OWNER | `POST .../to-khai-quy/2026/3/xuat` và `.../danh-dau-da-nop` | 403 E-tkt-014 cho cả 2 (yêu cầu ADMIN/OWNER) | P0 |
| TC-tkt-100 | Authorization — ĐÃ CHỐT 2026-09-14 (GAP-QA-tkt-12 đóng) | A-tkt-08 | User CÓ "quyền xem dữ liệu lương" (không cần ADMIN/OWNER) | `POST .../danh-muc-thu-nhap` (tạo danh mục — CRUD cơ bản) | **200/201** — CRUD cơ bản chỉ cần quyền lương, KHÔNG cần ADMIN/OWNER (xác nhận theo `api-contract-to-khai-thue.md` Mục 0.1, đảo ngược giả định ban đầu "403") | P1 |
| TC-tkt-101 | Authorization — ĐÃ CHỐT 2026-09-14 (GAP-QA-tkt-12 đóng) | A-tkt-08 | User CÓ "quyền xem dữ liệu lương" | `POST .../thu-nhap-ngoai-luong` (tạo bản ghi) | **201** — cùng lý do TC-tkt-100 | P1 |
| TC-tkt-102 | Authorization | — | Không đăng nhập (không cookie) | Gọi bất kỳ endpoint nào của `to_khai_thue` | 401 (guard `authenticate` chung, kế thừa toàn hệ thống HRM) | P0 |

---

## Nhóm 11 — Edge cases bổ sung (Mục 12 SRS, EC-tkt-01…07) — TC-tkt-103…110

| ID | EC | Kịch bản | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|:--:|
| TC-tkt-103 | EC-tkt-01 | NV vào làm giữa quý (có dữ liệu lương T8,T9 nhưng không có T7) | Tính thuế tháng có dữ liệu (T8,T9); T7 bỏ qua khi tổng hợp quý cho người này, KHÔNG chặn quý "Sẵn sàng xuất" vì thiếu dữ liệu CỦA RIÊNG 1 người | P1 |
| TC-tkt-104 | EC-tkt-02 (đối chứng OOS) | NV có thu nhập từ 2 công ty khác nhau cùng MST | Hệ thống KHÔNG tự cộng dồn — chỉ phản ánh đúng dữ liệu nội bộ công ty hiện tại (xác nhận rõ giới hạn phạm vi, không phải bug) | P2 |
| TC-tkt-105 | EC-tkt-03 (đối chứng OOS) | Sửa số liệu lương SAU KHI quý đã "Đã xuất tờ khai" | Bị chặn bởi khóa module payroll gốc (kế thừa cơ chế chung) — hệ thống KHÔNG có cơ chế "khai bổ sung" đợt này, xác nhận đúng hạn chế đã biết trước | P2 |
| TC-tkt-106 | EC-tkt-04 | Người phụ thuộc đăng ký giữa tháng (vd hiệu lực từ 15/09/2026) | `giam_tru_phu_thuoc` tính theo THÁNG có đăng ký hợp lệ (dùng nguyên tắc hiện có `hrm_nguoi_phu_thuoc`) — *(GIẢ ĐỊNH: mức áp dụng đã là 6.200.000đ mới theo BR-hrm-080, cần Architect xác nhận logic hiện tại đã cập nhật đúng mức mới)* | P1 |
| TC-tkt-107 | EC-tkt-05 | Có dữ liệu Quý I/II 2026 theo dõi kiểu cũ (theo tháng) | Chỉ HIỂN THỊ lại, KHÔNG bắt buộc dựng tờ khai chuẩn 05/KK-TNCN mới cho các kỳ đó (theo giả định OQ-tkt-01 hiện dùng) | P2 |
| TC-tkt-108 | EC-tkt-06 | NV `thu_viec` nhận thêm hoa hồng kiêm nhiệm qua màn Thu nhập ngoài lương | Đã test chi tiết ở TC-tkt-064 — tham chiếu chéo, 2 cơ chế độc lập (CHƯA CHỐT chính thức, A-tkt-11) | P1 |
| TC-tkt-109 | EC-tkt-07 | Double-click tạo 2 bản ghi payload GIỐNG HỆT | Đã test ở TC-tkt-020 (Nhóm 2) — tham chiếu chéo | P1 |
| TC-tkt-110 | Mới (không có EC nguồn) | Payroll period tồn tại nhưng KHÔNG có nhân viên nào active trong tháng (toàn bộ nghỉ việc) | Bảng tính thuế tháng vẫn tính được (0 dòng hoặc dòng rỗng), KHÔNG lỗi 500; tháng vẫn chốt được bình thường nếu payroll gốc đã LOCKED | P2 |

---

## Nhóm 12 — Regression / Cô lập tenant / xuyên suốt — TC-tkt-111…116

| ID | Loại | Kịch bản | Kết quả mong đợi | Ưu tiên |
|---|---|---|---|:--:|
| TC-tkt-111 | Regression | BR-dltl-024…027 (2 trần BH, miễn OT, trần ăn trưa) vẫn hoạt động đúng khi tính Bảng tính thuế tháng của `to_khai_thue` | Kết quả `thu_nhap_luong`/`giam_tru_bao_hiem` phần LƯƠNG CHÍNH khớp HỆT test suite hiện có của `du_lieu_tinh_luong` (không bị feature mới làm lệch) | P0 |
| TC-tkt-112 | Regression | Biểu thuế TNCN 5 bậc (BR-hrm-081) không bị đổi ngầm sang biểu cũ khi qua đường tính của `to_khai_thue` | Dùng lại chính bộ test boundary Nhóm 5.2 (TC-tkt-055…060) làm regression guard — **sẽ FAIL cho tới khi `task_defff3dd` (P-01) được xử lý, xem ghi chú Nhóm 5.2** | P0 |
| TC-tkt-113 | **Security — Cô lập tenant (P0 bắt buộc theo quy ước MAXV)** | User Công ty A gọi `GET .../bang-tinh-thue/<periodId thuộc Công ty B>` hoặc `GET .../danh-muc-thu-nhap/<id thuộc Công ty B>` | KHÔNG trả dữ liệu Công ty B — `resolveTenantDb(req)` tách DB theo tenant nên ID của B không tồn tại trong DB của A → phải là 404, TUYỆT ĐỐI không rơi vào "tìm thấy nhưng khác tenant" | P0 |
| TC-tkt-114 | Security — Cô lập tenant | User Công ty A cố `POST .../thu-nhap-ngoai-luong` với `payrollPeriodId` thuộc Công ty B | 404 (period không tồn tại trong DB tenant A) — không được vô tình tạo bản ghi cross-tenant | P0 |
| TC-tkt-115 | Regression | `payrollCalculation.service.ts` (engine lương chính) không bị import/method nào của `to_khai_thue` sửa trực tiếp | Đọc code review: `to_khai_thue` chỉ GỌI/ĐỌC kết quả engine hiện có, không monkey-patch/duplicate logic tính thuế/BH của lương chính (NFR-tkt-005, A-tkt-03) — kiểm bằng code review + so kết quả TC-tkt-111/112 | P0 |
| TC-tkt-116 | Regression | Toàn bộ 3 màn (`thu-nhap-ngoai-luong`, `bang-tinh-thue`, `to-khai-tncn`) không phá vỡ 2 tab đã có sẵn UI nhưng ngoài phạm vi (`to-khai-quyet-toan`, `doi-soat-cong-thuc`) | 2 tab ngoài phạm vi vẫn hiển thị/hoạt động như cũ (placeholder hoặc chưa nối API), không bị lỗi runtime lây từ 3 màn mới | P2 |

---

## Nhóm 13 — Test theo giả định tạm cho các Gap phát hiện (`GAP-QA-tkt-01…08`, xem `test-matrix-to-khai-thue.md` Mục 0) — TC-tkt-117…126

> Nhóm này TỔNG HỢP LẠI (không lặp nội dung) các test case đã thiết kế theo giả định tường minh ở Nhóm 2-8, cộng thêm vài case MỚI thuần về validation dữ liệu đầu vào cho các gap chưa có chỗ nào chứa. **Cập nhật 2026-09-14: chỉ còn `GAP-QA-tkt-01` (TC-tkt-121) THẬT SỰ là giả định treo — 06/07/08 đã có quyết định chính thức (xem tham chiếu chéo tương ứng).**

| ID | Gap | Kịch bản | Ghi chú giả định | Ưu tiên |
|---|---|---|---|:--:|
| TC-tkt-117 | GAP-QA-tkt-03 | Tạo danh mục `WITHHOLDING_FLAT` với `withholdingRate=100` | *(giả định)* Nên bị chặn ngay lúc TẠO DANH MỤC (400) — phòng ngừa từ gốc, tốt hơn để lỗi xảy ra lúc tính bản ghi (xem TC-tkt-047) | P0 |
| TC-tkt-118 | GAP-QA-tkt-03 | Tạo danh mục `WITHHOLDING_FLAT` với `withholdingRate=0` | *(giả định)* 0% về bản chất là "không khấu trừ gì" — có thể HỢP LỆ (tương đương EXEMPT nhưng khai báo qua nhóm khác) hoặc bị chặn vì vô nghĩa; test PHƠI BÀY hành vi thật, không khẳng định trước | P2 |
| TC-tkt-119 | GAP-QA-tkt-03 | Tạo danh mục `withholdingRate=-5` (âm) | *(giả định)* 400 — số âm chắc chắn vô nghĩa nghiệp vụ dù SRS không nêu tường minh | P1 |
| TC-tkt-120 | GAP-QA-tkt-06 — ĐÃ CHỐT | Tham chiếu TC-tkt-072/073 (Nhóm 6) — quét lại ở đây để đảm bảo Phase B không bỏ sót | Đã có quyết định chính thức (xóa row khi mở lại), không còn giả định | P0 |
| TC-tkt-121 | GAP-QA-tkt-01 — VẪN TREO | Tham chiếu TC-tkt-044/045 (Nhóm 4) | Gap 🔴 DUY NHẤT còn lại chưa có quyết định BA/Architect | P0 |
| TC-tkt-122 | GAP-QA-tkt-07 — ĐÃ CHỐT | Tham chiếu TC-tkt-090/091 (Nhóm 8) | Đã có mã lỗi chính thức `E-tkt-019`, không còn giả định | P0 |
| TC-tkt-123 | GAP-QA-tkt-08 — ĐÃ CHỐT | Tham chiếu TC-tkt-063 (Nhóm 5) | Đã có quyết định chính thức (gộp theo `recipientKey`), không còn giả định | P0 |
| TC-tkt-124 | GAP-QA-tkt-02 | `api-contract-to-khai-thue.md` đã có tên field input thật (`amount`, thay `soTienChiTra`) — cần RÀ LẠI toàn bộ Nhóm 4 để đổi tên field trong request payload mẫu, KHÔNG đổi giá trị/kỳ vọng nghiệp vụ | Việc làm lại (rework) khi contract có — NAY ĐÃ CÓ, cần thực hiện đầu Phase B trước khi code | P1 |
| TC-tkt-125 | GAP-QA-tkt-04/05 — ĐÃ CHỐT | Đã thay mã lỗi chính thức `E-tkt-021` (BR-tkt-009) và `E-tkt-016` (ma_nv không tồn tại) vào TC-tkt-021/022/032 ở trên | Hoàn tất, không còn placeholder | P2 |
| TC-tkt-126 | GAP-QA-tkt-09/10 — ĐÃ CHỐT | BA đã sửa Mục 16 (trace off-by-one) và BR-tkt-002 (trích dẫn `OQ-tkt-02`→`OQ-tkt-03`) trong SRS ngày 2026-09-14 | Hoàn tất | P2 |

---

## Tổng kết bao phủ

**126 test case**, 13 nhóm, bao phủ đầy đủ 18 FR, 18 BR, 21 mã lỗi (14 gốc + 7 bổ sung 2026-09-14), 8 UC, và toàn bộ 28 AC (mỗi AC có ≥1 TC tương ứng trực tiếp, xem cột "Yêu cầu"/"Kịch bản" đối chiếu mã AC).

**Cập nhật 2026-09-14 (BA Final Sign-off, sau khi Architect bàn giao contract):** 3/4 gap 🔴 ban đầu (`GAP-QA-tkt-06, 07, 08`) đã có quyết định chính thức, chỉ còn **`GAP-QA-tkt-01`** (nhánh TAXABLE_FULL + paymentType NET, TC-tkt-044/045/121) THẬT SỰ vẫn là giả định treo, cần BA/Architect quyết trước khi Backend code nhánh đó. Toàn bộ mã lỗi placeholder đã được thay bằng mã chính thức (`E-tkt-016`, `E-tkt-018`, `E-tkt-019`, `E-tkt-020`, `E-tkt-021`). Việc rà soát lại field/path theo `api-contract-to-khai-thue.md` thật (GAP-QA-tkt-02, TC-tkt-124) và cập nhật Nhóm 5.1 (BH hưu trí tự nguyện — ngoài phạm vi, P-17) là 2 việc còn lại trước khi coi bộ test case này là **final** cho Phase B.
