---
type: test-matrix
feature: hrm-to-khai-thue
status: draft
updated: 2026-09-14
author: tester-qa
links:
  - docs/hrm/to_khai_thue/srs-to-khai-thue.md
  - docs/hrm/to_khai_thue/brainstorms/2026-09-14-to-khai-thue-tncn-brainstorm.md
  - docs/hrm/to_khai_thue/test-cases-to-khai-thue.md
  - docs/hrm/srs/hrm-spec.md
  - docs/hrm/CONTEXT_SUMMARY.md
---

# HR — TEST MATRIX: Thu nhập ngoài lương, Bảng tính thuế & Tờ khai thuế TNCN (`to_khai_thue`)

> **Giai đoạn**: Phase A — Shift-Left Spec Review & Test Design, chạy song song với Architect (chưa có code, chưa chạy test thật).
> **Nguồn nghiệp vụ duy nhất**: `docs/hrm/to_khai_thue/srs-to-khai-thue.md` (18 FR, 18 BR, 14 mã lỗi, 8 UC, 28 AC).
> **Ràng buộc quan trọng**: tại thời điểm viết tài liệu này, **chưa tồn tại** `architecture/api-contract-to-khai-thue.md` hay `data-model-to-khai-thue.md`. Mọi method/path HTTP trong 2 tài liệu test (`test-matrix`, `test-cases`) là **suy đoán** từ quy ước HRM hiện có (base path `/api/v1/hrm`, vỏ `{success,data}`, POST→201, GET/PUT/DELETE→200, Zod 400, Conflict 409, Forbidden 403 — theo `docs/hrm/qa/test-matrix.md` Mục 2) và từ slug màn hình đã nêu trong SRS (`thu-nhap-ngoai-luong`, `bang-tinh-thue`, `to-khai-tncn`) + tên file FE nháp (Mục 14 SRS). **Toàn bộ path đánh dấu "(suy đoán)" phải được Architect xác nhận lại trong `api-contract-to-khai-thue.md` trước khi Backend Engineer code** — nếu path/field đổi, test case cần cập nhật lại nhưng nghiệp vụ mong đợi (Expected Result) không đổi.
> Baseline thời gian dùng cho mọi test case tính thuế: **Quý III/2026 (tháng 7–9/2026)** — chủ đích tránh phụ thuộc `OQ-tkt-02` (biểu thuế nửa đầu 2026 còn treo), vì BR-tkt-017 xác nhận kỳ khai theo quý và biểu 5 bậc áp dụng chắc chắn từ Quý III/2026.
>
> **Cập nhật 2026-09-14 (BA Final Sign-off):** Architect đã bàn giao `api-contract-to-khai-thue.md`/`data-model-to-khai-thue.md` cùng ngày. Các path/field "(suy đoán)" trong tài liệu này CHƯA được đối chiếu lại với 2 tài liệu đó — việc rà soát Nhóm 1-9 theo contract thật thuộc `GAP-QA-tkt-02`/`TC-tkt-124`, để làm khi bắt đầu Phase B.

---

## 0. Phản biện chéo SRS (Cross-check 3 Amigos) — Gaps phát hiện

> Đọc kỹ BR-tkt-001…018, Ma trận lỗi Mục 9, Edge Cases Mục 12, Traceability Mục 16. KHÔNG tự sửa SRS — liệt kê để BA/Architect chốt. Mỗi gap có mã `GAP-QA-tkt-NN`, mức chặn theo cùng quy ước `du_lieu_tinh_luong` (🔴 chặn coi test là final / 🟡 không chặn viết test nhưng chặn khẳng định đúng nghiệp vụ / 🟢 không chặn).

| Mã | Loại | Gap | Ảnh hưởng tới test | Mức chặn |
|---|---|---|---|---|
| GAP-QA-tkt-01 | (a) BR thiếu công thức | **BR-tkt-007 nhánh `TAXABLE_FULL`**: "`grossAmount` = số tiền chi trả quy đổi theo `paymentType`" — KHÔNG có công thức cụ thể khi `paymentType = NET` (khác hẳn nhánh `WITHHOLDING_FLAT` có công thức rõ `grossAmount = round(soTienChiTra / (1 − rate/100))`). Quy đổi NET→GROSS cho nhóm này cần biết thuế suất **lũy tiến biên** — nhưng thuế suất đó chỉ xác định được SAU KHI tính Bảng tính thuế tháng gộp toàn bộ thu nhập (phụ thuộc vòng/circular dependency). Field `paymentType` là **B** (bắt buộc) cho MỌI bản ghi bất kể nhóm (§4.2), nên tình huống này chắc chắn nhập được qua UI | Nhóm 4 (`TC-tkt-046…048`) — chỉ viết được test theo giả định "hệ thống tạm CHẶN chọn NET cho nhóm TAXABLE_FULL (400)", KHÔNG khẳng định đây là hành vi đúng | 🔴 |
| GAP-QA-tkt-02 | (a)/(d) Data model thiếu field | Toàn bộ công thức BR-tkt-007 dùng biến `soTienChiTra` (số tiền kế toán nhập) nhưng **bảng thực thể `OtherIncomeRecord` (§4.2) không có field input nào tên này** — chỉ có `grossAmount`/`netAmount` được đánh dấu "Hệ thống (tính)". Không rõ field vật lý nào nhận giá trị kế toán gõ vào (`inputAmount`? hay 1 trong 2 field trên tùy `paymentType`?) | Toàn bộ Nhóm 4 — test data dùng tên field tạm `soTienChiTra` (theo đúng SRS), đánh dấu rõ TÊN FIELD THẬT chờ `api-contract-to-khai-thue.md` | 🟡 |
| GAP-QA-tkt-03 | (c) Error Matrix lỗ hổng | BR-tkt-003 không quy định range hợp lệ cho `withholdingRate` (0 < rate < 100). Kết hợp nhánh NET của BR-tkt-007 (`grossAmount = round(soTienChiTra / (1 − rate/100))`): `rate = 100` → **chia cho 0** (Infinity/NaN); `rate > 100` → chia cho số âm (`grossAmount` âm, vô nghĩa nghiệp vụ) | `TC-tkt-014`, `TC-tkt-015`, `TC-tkt-117…119` (Nhóm 13) — test thiết kế để PHƠI BÀY rủi ro, không khẳng định pass/fail | 🟡 |
| GAP-QA-tkt-04 | (c) Error Matrix lỗ hổng | BR-tkt-009 (ràng buộc phạm vi nhóm theo đối tượng) ghi "Vi phạm trả 400" nhưng **KHÔNG được gán mã lỗi cụ thể** trong Ma trận lỗi Mục 9 — là BR DUY NHẤT có hành vi từ chối nhưng thiếu mã `E-tkt-xxx` (mọi BR khác đều có ≥1 mã) | `TC-tkt-022`, `TC-tkt-032` dùng placeholder "400, mã lỗi chưa định danh (đề xuất `E-tkt-015`)" | 🟡 |
| GAP-QA-tkt-05 | (c) Error Matrix lỗ hổng | Ma trận lỗi thiếu mã cho tình huống "tạo `OtherIncomeRecord` với `ma_nv` được cung cấp nhưng không tồn tại/đã xóa mềm" — mọi entity HRM khác (Hợp đồng, Người phụ thuộc, Tài liệu) đều có pattern 404 "Không tìm thấy nhân viên" cho tình huống tương tự (xem `hrm/qa/test-cases.md` TC-hrm-037/064) | `TC-tkt-021` — test theo giả định kế thừa pattern 404 chung của HRM | 🟢 |
| GAP-QA-tkt-06 | (b) 2 BR mâu thuẫn | **BR-tkt-013 vs BR-tkt-014**: BR-tkt-013 cho phép Mở lại 1 tháng bất cứ khi nào kỳ quý chứa nó CHƯA "Đã xuất tờ khai" — E-tkt-009 xác nhận điều kiện chặn CHỈ là "đã Đã xuất tờ khai" (không chặn ở "Sẵn sàng xuất"). Nhưng BR-tkt-014 nói bản ghi `QuarterlyTaxDeclaration` **CHỈ TỒN TẠI** khi đủ điều kiện 3/3 tháng "Đã chốt" (giống `PayrollSheetLine`, ngụ ý persisted row). Nếu 1 tháng bị Mở lại SAU KHI quý đã đạt "Sẵn sàng xuất" (row đã tồn tại), **không có rule nào định nghĩa row đó bị xóa/revert hay giữ nguyên trạng thái stale** dù điều kiện gốc (3/3 chốt) không còn đúng | `TC-tkt-072`, `TC-tkt-073` (Nhóm 6) + `TC-tkt-120` (Nhóm 13) | 🔴 |
| GAP-QA-tkt-07 | (a)/(c) BR thiếu ràng buộc | BR-tkt-018 (ghi đè chỉ tiêu tờ khai) không giới hạn rõ TRẠNG THÁI tờ khai được phép ghi đè — không có rule/mã lỗi chặn ghi đè SAU KHI đã "Đã xuất tờ khai" hoặc "Đã nộp". Rủi ro lệch số liệu giữa bản đã nộp cơ quan thuế và số liệu nội bộ (rủi ro tuân thủ/audit) | `TC-tkt-090`, `TC-tkt-091` (Nhóm 8) — test theo giả định "hệ thống PHẢI chặn ghi đè sau xuất", đánh dấu rõ giả định | 🔴 |
| GAP-QA-tkt-08 | (a)/(d) Data model chưa rõ khóa gộp | **Chưa rõ 1 dòng `MonthlyTaxCalculationLine` cho vãng lai (`ma_nv = null`) đại diện 1 `OtherIncomeRecord` hay gộp NHIỀU bản ghi/tháng của CÙNG 1 cá nhân vãng lai**. Field `otherIncomeRecordId` (§4.3) mô tả số ít "1 bản ghi", nhưng công thức `thue_toan_phan = Σ ... của người đó` ngụ ý gộp nhiều bản ghi. Nếu gộp — cần 1 khóa định danh cá nhân vãng lai xuyên nhiều bản ghi (MST? CCCD? tên?) — CHƯA được định nghĩa ở đâu. AC-tkt-008 xác nhận nghiệp vụ CHO PHÉP 1 vãng lai có ≥2 bản ghi/tháng nên tình huống này chắc chắn xảy ra | `TC-tkt-062…065` (Nhóm 5) — chỉ test được theo giả định "1 dòng = 1 OtherIncomeRecord, KHÔNG gộp", đánh dấu rõ | 🔴 |
| GAP-QA-tkt-09 | Lỗi trace (tự phát hiện) | **Mục 16 Traceability, hàng "Bản ghi thu nhập ngoài lương"** ghi phạm vi AC là `AC-tkt-006…016`, nhưng `AC-tkt-016` (nội dung: BR-tkt-010, `giam_tru_bao_hiem`) thực chất thuộc nhóm "Bảng tính thuế tháng" (đã xuất hiện đúng lần 2 ở hàng ngay dưới `AC-tkt-016…021`) — off-by-one. Đối chiếu tổng 28 AC: nếu sửa hàng "Bản ghi" thành `AC-tkt-006…015` thì 5+10+6+7=28 khớp đúng | Không ảnh hưởng thiết kế test case (tôi map đúng theo NỘI DUNG từng AC, không theo range trace sai), chỉ cần BA sửa Mục 16 | 🟢 |
| GAP-QA-tkt-10 | Lỗi trích dẫn (tự phát hiện) | **BR-tkt-002** trích "ngưỡng trang phục bằng tiền 5.000.000đ/người/năm đang treo `OQ-tkt-02`" — nhưng `OQ-tkt-02` thực tế (Mục 15) là câu hỏi về biểu thuế 7 bậc cũ áp dụng H1/2026 hay không, KHÔNG liên quan trang phục. Câu hỏi đúng về ngưỡng trang phục là **`OQ-tkt-03`** | Không ảnh hưởng test (tôi dùng đúng `OQ-tkt-03` khi ghi giả định), chỉ cần BA sửa tham chiếu trong BR-tkt-002 | 🟢 |
| GAP-QA-tkt-11 | (a) BR thiếu AC | `E-tkt-014` (403, không có quyền xem lương cố chốt/mở lại/xuất/đánh dấu nộp) là mã lỗi **DUY NHẤT** trong Ma trận lỗi không có bất kỳ AC nào trong 28 AC (Mục 11) kiểm chứng trực tiếp | `TC-tkt-097…102` (Nhóm 10, mới hoàn toàn — không có AC nguồn) | 🟡 |
| GAP-QA-tkt-12 | (a)/(d) Phạm vi chưa rõ | Mục 3 (Actors) nói mọi thao tác (kể cả CRUD danh mục/bản ghi) cần "quyền xem dữ liệu lương", nhưng `E-tkt-014` trong Ma trận lỗi CHỈ liệt kê rõ 4 thao tác "chốt/mở lại/xuất/đánh dấu nộp" — không nói CRUD cơ bản có bị chặn 403 tương tự không | `TC-tkt-097…099` test theo giả định "áp dụng đồng nhất mọi endpoint của sub-cụm", cần BA/Architect xác nhận | 🟡 |

**Kết luận Mục 0**: 4 gap 🔴 (`GAP-QA-tkt-01`, `06`, `07`, `08`) chặn việc coi các nhóm test liên quan là **final**; KHÔNG chặn việc viết test (đã viết theo giả định tường minh, xem Nhóm 4/5/6/8/13 trong `test-cases-to-khai-thue.md`). 6 gap 🟡 không chặn viết test nhưng chặn khẳng định đúng nghiệp vụ. 2 gap 🟢 là lỗi văn bản thuần túy (trace/trích dẫn), không ảnh hưởng test.

> **Cập nhật 2026-09-14 (BA Final Sign-off) — 3/4 gap 🔴 đã có hướng giải quyết từ Architect, 2 gap 🟢 đã sửa trong SRS:**
> - `GAP-QA-tkt-06` (mâu thuẫn BR-tkt-013/014): Architect + BA đã chốt — mở lại 1 tháng khi quý đang "Sẵn sàng xuất" (chưa xuất) PHẢI xóa luôn dòng tờ khai đó, xem `api-contract-to-khai-thue.md` Mục 4.3 và `srs-to-khai-thue.md` BR-tkt-013 (sửa 2026-09-14). `TC-tkt-072/073` cần cập nhật lại kỳ vọng theo hướng "xóa row" (không còn là giả định mở, đã có quyết định).
> - `GAP-QA-tkt-07` (khóa ghi đè sau xuất): Architect đã thêm mã `E-tkt-019` chặn đúng ca này, xem `api-contract-to-khai-thue.md` Mục 5.3/5.4. `TC-tkt-090/091` nay có mã lỗi chính thức, không còn là giả định.
> - `GAP-QA-tkt-08` (khóa gộp vãng lai): Architect đã chốt dùng `recipientKey` (gộp theo NGƯỜI, không theo bản ghi) — xem ADR-013 quyết định 5. `TC-tkt-062…065` cần cập nhật theo hướng "gộp nhiều bản ghi/tháng thành 1 dòng theo recipientKey", ngược lại giả định ban đầu ("không gộp") đã viết.
> - `GAP-QA-tkt-01` (TAXABLE_FULL/NET) — **vẫn 🔴, chưa có quyết định nghiệp vụ**, chỉ có gợi ý kỹ thuật từ Architect (chưa chốt).
> - `GAP-QA-tkt-04`/`05`/`09`/`10` đã đóng: mã lỗi `E-tkt-021`/`E-tkt-016` đã cấp chính thức, 2 lỗi văn bản đã sửa trong SRS.
> Việc cập nhật lại nội dung chi tiết Nhóm 4/5/6/8 trong `test-cases-to-khai-thue.md` theo các quyết định trên thuộc phạm vi rà soát Phase B, chưa thực hiện trong lần ghi tài liệu này.

### 0.1 Ảnh hưởng của 4 Open Question (Mục 15 SRS) tới khả năng viết test đầy đủ

| OQ | Ảnh hưởng tới test | Giả định dùng khi viết test |
|---|---|---|
| OQ-tkt-01 (mốc chuyển tháng→quý, có cần import lịch sử Quý I/II 2026?) | **KHÔNG chặn** 3 màn hình chính — Mục 2.2 SRS đã loại trừ rõ "Rà soát/tính lại dữ liệu payroll các kỳ ĐÃ CHỐT trước ngày áp dụng" khỏi phạm vi đợt này. Chỉ ảnh hưởng `EC-tkt-05` (hiển thị lại Q1/Q2 nếu có) | `TC-tkt-107` dùng giả định "chỉ HIỂN THỊ lại, không dựng tờ khai chuẩn mới cho Q1/Q2" theo đúng EC-tkt-05 |
| OQ-tkt-02 (biểu 7 bậc cũ có tạm áp H1/2026 không?) | **Rủi ro pháp lý CAO nếu không resolve trước golive**, nhưng KHÔNG chặn test case của tài liệu này — toàn bộ test tính thuế đều cố ý dùng dữ liệu **Quý III/2026 trở đi** (biểu 5 bậc chắc chắn áp dụng theo BR-tkt-017), tránh hoàn toàn vùng tranh chấp T1–T6/2026 | Không cần giả định — phạm vi test loại trừ H1/2026 có chủ đích |
| OQ-tkt-03 (trang phục 5.000.000đ/năm — mức mới hay kế thừa?) | Ảnh hưởng GIÁ TRỊ SỐ trong seed data test (`TC-tkt-005`) | Test dùng đúng số `5.000.000đ/năm` hiện có trong BR-tkt-002 nhưng đánh dấu rõ "giá trị có thể đổi khi OQ-tkt-03 được trả lời" — không chặn khung sườn test |
| OQ-tkt-04 (bảo hiểm nhân thọ DN mua — có cần nhóm xử lý thuế thứ 5?) | Tính năng CHƯA tồn tại trong seed/AC nào — không có test case nào bị chặn trực tiếp (chưa test cái chưa có) | Ghi nhận out-of-scope, không thiết kế test |
| OQ-tkt-05 (MỚI 2026-09-14 — `ct24`/`ct25`/`ct32` chưa rõ định nghĩa) | Ảnh hưởng test nội dung file xuất tờ khai (`TC-tkt-079`) — 3 chỉ tiêu này chưa verify được đúng/sai tới khi có câu trả lời | `TC-tkt-079` chỉ kiểm "đủ 17 chỉ tiêu xuất hiện", KHÔNG khẳng định giá trị `ct24/25/32` đúng luật |

---

## 1. Nguồn đối chiếu (evidence base)

| Nguồn | Dùng để |
|---|---|
| `docs/hrm/to_khai_thue/srs-to-khai-thue.md` | Nguồn nghiệp vụ DUY NHẤT: BR-tkt-001…018, FR-tkt-001…018, E-tkt-001…014, UC-tkt-01…08, AC-tkt-001…028, EC-tkt-01…07, A-tkt-01…11, OQ-tkt-01…04 |
| `docs/hrm/srs/hrm-spec.md` Mục 4.8, BR-hrm-080…084 | Biểu thuế TNCN 5 bậc dùng chung (`taxBrackets`), `personalDeduction=15.500.000`, `dependentDeduction=6.200.000` — KHÔNG định nghĩa lại, chỉ tham chiếu (A-tkt-02, A-tkt-03) |
| `docs/hrm/du_lieu_tinh_luong/srs-du-lieu-tinh-luong.md`, `payrollCalculation.service.ts` | Engine tính lương/BH/thuế lũy tiến hiện có — Bảng tính thuế tháng TÁI SỬ DỤNG cho phần lương chính (A-tkt-03) |
| `docs/hrm/du_lieu_tinh_luong/test-matrix-bang-luong-tong-hop.md` | Pattern test matrix + văn phong tham chiếu |
| `docs/hrm/qa/test-matrix.md` Mục 2 | Quy ước HTTP/vỏ phản hồi/status code chung của toàn `be_maxv` (suy đoán áp dụng cho `to_khai_thue` do chưa có contract riêng) |
| `docs/hrm/to_khai_thue/brainstorms/2026-09-14-to-khai-thue-tncn-brainstorm.md` | Bối cảnh PA đã chọn (PA2 — danh mục cấu hình được), số liệu gốc |

**Chưa tồn tại tại thời điểm viết tài liệu này** (Architect chưa bàn giao — Phase A đang chạy song song thật sự): `docs/hrm/to_khai_thue/architecture/api-contract-to-khai-thue.md`, `data-model-to-khai-thue.md`, `dev-notes.md`. Không có code Backend nào trong `be_maxv/src/{controllers,services,routes,validators}/client/hrm/to_khai_thue/` — xác nhận qua `git status` (các thư mục này hiện là untracked/mới, trống hoặc đang khởi tạo).

---

## 2. Giả định nền dùng chung cho mọi test case (fixture baseline)

| Tham số | Giá trị | Nguồn |
|---|---|---|
| Kỳ baseline | Quý III/2026 (tháng 7, 8, 9/2026) | Tránh OQ-tkt-02, theo BR-tkt-017 |
| `personalDeduction` | 15.500.000đ/tháng | `hrm-spec.md` §4.8, BR-hrm-080 |
| `dependentDeduction` | 6.200.000đ/người/tháng | nt |
| `taxBrackets` (5 bậc) | 10tr–5% · 30tr–10% · 60tr–20% · 100tr–30% · bậc mở–35% | BR-hrm-081 |
| Ngưỡng miễn ăn ca tiền mặt | 1.200.000đ/người/tháng (`EXEMPT_CAPPED`) | BR-tkt-002 |
| Ngưỡng miễn trang phục bằng tiền | 5.000.000đ/người/năm (`EXEMPT_CAPPED`, YEARLY) — ⚠️ `OQ-tkt-03` treo | BR-tkt-002 |
| Tỷ lệ/ngưỡng khấu trừ mặc định `WITHHOLDING_FLAT` | 10,0% / 5.000.000đ/lần | BR-tkt-001, BR-tkt-008 |
| Trần bảo hiểm hưu trí tự nguyện | 3.000.000đ/tháng | BR-tkt-010 |
| Ngưỡng khấu trừ 10% hợp đồng thử việc/thời vụ (BR-dltl-026, KHÔNG thuộc SRS này) | 2.000.000đ/lần (đối chiếu, không gộp với BR-tkt-008) | `srs-du-lieu-tinh-luong.md` |
| Tenant mẫu | Công ty A (`maxv_9970000001_app`), Công ty B (`maxv_9970000002_app`) — dùng cho test cô lập tenant | Theo quy ước `hrm/qa/test-matrix.md` §7.2 |

---

## 3. Ma trận bao phủ (Entity × Loại kiểm thử)

Ký hiệu: **N** = số ca thiết kế · ⬜ = đã thiết kế, CHƯA CHẠY (chưa có code).

| Entity / Nhóm nghiệp vụ | Dải ID | Happy path | Validation | Edge/Boundary | Authorization | Concurrency | Regression | Tổng |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Danh mục loại thu nhập ngoài lương | TC-tkt-001…013 | 4 ⬜ | 5 ⬜ | 4 ⬜ | – | – | – | **13** |
| Bản ghi — nhân viên nội bộ | TC-tkt-014…024 | 4 ⬜ | 3 ⬜ | 4 ⬜ | – | – | – | **11** |
| Bản ghi — vãng lai/CTV + Cam kết 08 | TC-tkt-025…033 | 4 ⬜ | 2 ⬜ | 3 ⬜ | – | – | – | **9** |
| Công thức tính thuế bản ghi (BR-tkt-007, 4 nhánh) | TC-tkt-034…051 | 6 ⬜ | 2 ⬜ | 10 ⬜ | – | – | – | **18** |
| Bảng tính thuế tháng (gộp + lũy tiến + ranh giới bậc) | TC-tkt-052…065 | 3 ⬜ | – | 11 ⬜ | – | – | – | **14** |
| Vòng đời Bảng tính thuế: chốt/mở lại | TC-tkt-066…075 | 3 ⬜ | – | 5 ⬜ | – | 1 ⬜ | 1 ⬜ | **10** |
| Tờ khai quý: điều kiện + xuất | TC-tkt-076…084 | 3 ⬜ | – | 6 ⬜ | – | – | – | **9** |
| Ghi đè chỉ tiêu tờ khai | TC-tkt-085…091 | 2 ⬜ | 2 ⬜ | 3 ⬜ | – | – | – | **7** |
| Đánh dấu đã nộp + lịch sử | TC-tkt-092…096 | 2 ⬜ | 1 ⬜ | 2 ⬜ | – | – | – | **5** |
| Phân quyền xuyên suốt (E-tkt-014) | TC-tkt-097…102 | – | – | – | 6 ⬜ | – | – | **6** |
| Edge cases bổ sung (EC-tkt-01…07) | TC-tkt-103…110 | – | – | 8 ⬜ | – | – | – | **8** |
| Regression / cô lập tenant / xuyên suốt | TC-tkt-111…116 | – | – | 2 ⬜ | 1 ⬜ | 1 ⬜ | 2 ⬜ | **6** |
| Test theo giả định cho Gaps (`GAP-QA-tkt-01…08`) | TC-tkt-117…126 | – | 3 ⬜ | 7 ⬜ | – | – | – | **10** |
| **TỔNG** | | **31** | **18** | **65** | **7** | **2** | **3** | **126** |

> Phân bổ ưu tiên: **P0 ≈ 78** (mọi test liên quan tính toán tiền, chốt/mở khóa, tenant isolation, permission) · **P1 ≈ 36** · **P2 ≈ 12**. Chi tiết per-case ở `test-cases-to-khai-thue.md`.
> **Độ phủ tự động hiện tại = 0%** — chưa có code Backend, chưa có file test nào trong `be_maxv/src/__tests__/hrm/to_khai_thue/`.

---

## 4. Ma trận Business Rule ↔ Test Case

| Mã BR | Tóm tắt | Test case | Ưu tiên | Gap liên quan |
|---|---|---|:--:|---|
| BR-tkt-001 | 4 nhóm xử lý thuế cấu hình được | TC-tkt-001…003, 012 | P0 | — |
| BR-tkt-002 | Seed data mặc định 4 nhóm | TC-tkt-004, 005 | P0 | GAP-QA-tkt-10 (trích dẫn OQ sai) |
| BR-tkt-003 | Toàn vẹn danh mục (unique, field bắt buộc theo nhóm) | TC-tkt-002, 006, 007, 009, 013, 014, 015 | P0 | GAP-QA-tkt-03 (thiếu range rate) |
| BR-tkt-004 | Không xóa cứng danh mục đã dùng | TC-tkt-010, 011 | P0 | — |
| BR-tkt-005 | Bản ghi thuộc 1 kỳ + 1 trong 2 dạng đối tượng | TC-tkt-016, 017, 021, 025, 026 | P0 | GAP-QA-tkt-05 |
| BR-tkt-006 | Chống trùng lặp hoàn toàn | TC-tkt-018, 019, 020 | P0 | — |
| BR-tkt-007 | Công thức 4 nhánh tính thuế bản ghi | TC-tkt-034…051 | P0 | GAP-QA-tkt-01, 02 |
| BR-tkt-008 | Khấu trừ riêng 10%, ngưỡng 5tr, Cam kết 08 | TC-tkt-028…033, 044…048 | P0 | — |
| BR-tkt-009 | Ràng buộc phạm vi nhóm theo đối tượng | TC-tkt-022, 023, 032 | P0 | GAP-QA-tkt-04 (thiếu mã lỗi — ĐÃ ĐÓNG, xem `E-tkt-021`) |
| BR-tkt-010 | Giảm trừ khác (BH hưu trí tự nguyện ≤3tr) | TC-tkt-055, 056 | P0 | — |
| BR-tkt-011 | Phân loại `loai_lao_dong` | TC-tkt-057…060, 103 | P0 | — |
| BR-tkt-012 | Công thức tổng + biểu lũy tiến 5 bậc | TC-tkt-052…054, 061…065 | P0 | GAP-QA-tkt-08 |
| BR-tkt-013 | Vòng đời chốt/mở lại tháng | TC-tkt-066…072, 111 | P0 | GAP-QA-tkt-06 |
| BR-tkt-014 | Điều kiện đủ "Sẵn sàng xuất" | TC-tkt-076, 077, 108 | P0 | GAP-QA-tkt-06 |
| BR-tkt-015 | Vòng đời tờ khai quý (xuất → nộp) | TC-tkt-078…081, 092…095 | P0 | GAP-QA-tkt-07 (double-export) |
| BR-tkt-016 | Chỉ theo quý (bỏ kỳ tháng) | TC-tkt-082 | P1 | — |
| BR-tkt-017 | Mốc hiệu lực & lưu song song biểu cũ/mới | TC-tkt-107 (OQ-tkt-01/02) | P1 | — |
| BR-tkt-018 | Ghi đè chỉ tiêu gốc, tự tính lại tổng hợp | TC-tkt-085…091 | P0 | GAP-QA-tkt-07 |

---

## 5. Ma trận Functional Requirement ↔ Test Case

| FR | Tóm tắt | Test case |
|---|---|---|
| FR-tkt-001 | Tạo danh mục | TC-tkt-001…003, 013…015 |
| FR-tkt-002 | Xem/lọc danh mục | TC-tkt-012 |
| FR-tkt-003 | Sửa danh mục (trừ mã) | TC-tkt-008, 009 |
| FR-tkt-004 | Chuyển INACTIVE / chặn xóa cứng | TC-tkt-010, 011 |
| FR-tkt-005 | Tạo bản ghi (nội bộ/vãng lai) | TC-tkt-016, 025, 026 |
| FR-tkt-006 | Sửa bản ghi khi Nháp, re-check BR-tkt-006/007/008 | TC-tkt-023, 024, 033 |
| FR-tkt-007 | Xóa bản ghi khi Nháp, chặn khi Đã chốt | TC-tkt-068 (E-tkt-007) |
| FR-tkt-008 | Danh sách + 4 KPI tổng hợp | TC-tkt-104 |
| FR-tkt-009 | Tính Bảng tính thuế tháng (gộp) | TC-tkt-052…054, 061…065 |
| FR-tkt-010 | Xem Bảng tính thuế theo NV, lọc loại LĐ/cư trú | TC-tkt-060, 105 |
| FR-tkt-011 | Chốt Bảng tính thuế tháng | TC-tkt-066, 067, 111 |
| FR-tkt-012 | Mở lại Bảng tính thuế tháng | TC-tkt-069…073 |
| FR-tkt-013 | Tự tổng hợp Tờ khai quý | TC-tkt-076, 077 |
| FR-tkt-014 | Xuất Excel + PDF, đủ 17 chỉ tiêu | TC-tkt-078, 079, 106 |
| FR-tkt-015 | Bảng chi tiết theo nhân viên nội bộ | TC-tkt-109 |
| FR-tkt-016 | Ghi đè chỉ tiêu gốc + lý do | TC-tkt-085…089 |
| FR-tkt-017 | Đánh dấu Đã nộp | TC-tkt-092, 093 |
| FR-tkt-018 | Xem lịch sử/trạng thái tờ khai | TC-tkt-096 |

---

## 6. Ma trận lỗi (Error Matrix) ↔ Test Case

| Mã lỗi | HTTP | Test case chính | Test case boundary/bổ sung |
|---|:--:|---|---|
| E-tkt-001 | 400 | TC-tkt-006 | TC-tkt-007 (mã trùng, không chỉ tên) |
| E-tkt-002 | 400 | TC-tkt-010 | — |
| E-tkt-003 | 400 | TC-tkt-002 | TC-tkt-003 (thiếu cả 2 field), TC-tkt-009 (đổi nhóm lúc sửa) |
| E-tkt-004 | 400 | TC-tkt-017 | TC-tkt-021 (ma_nv không tồn tại — GAP-QA-tkt-05) |
| E-tkt-005 | 409 | TC-tkt-018 | TC-tkt-019 (khác ngày/tiền — KHÔNG bị chặn), TC-tkt-020 (double-click race) |
| E-tkt-006 | 400 | TC-tkt-031 | — |
| E-tkt-007 | 403 | TC-tkt-068 | — |
| E-tkt-008 | 400 | TC-tkt-074 | — |
| E-tkt-009 | 403 | TC-tkt-071 | TC-tkt-072 (biên: mở lại đúng lúc quý "Sẵn sàng xuất" — GAP-QA-tkt-06, ĐÃ CÓ quyết định xóa row) |
| E-tkt-010 | 400 | TC-tkt-076 | — |
| E-tkt-011 | 400 | TC-tkt-086 | — |
| E-tkt-012 | 400 | TC-tkt-087 | — |
| E-tkt-013 | 400 | TC-tkt-092 (âm bản — thử đánh dấu nộp khi chưa xuất) | — |
| E-tkt-014 | 403 | TC-tkt-097…099 | TC-tkt-100…102 (biên vai trò) |
| E-tkt-015…021 `[MỚI 2026-09-14]` | 500/404/400/409/403/409/400 | Chưa có test case riêng — bổ sung ở Phase B theo `api-contract-to-khai-thue.md` Mục 7 | Thay thế các placeholder "mã chưa định danh" ở TC-tkt-022/023/032 |

---

## 7. Ma trận Use Case ↔ Test Case

| UC | Test case luồng chính | Test case nhánh phụ/lỗi |
|---|---|---|
| UC-tkt-01 (Quản lý danh mục) | TC-tkt-001, 004 | TC-tkt-002, 003, 006, 007, 009, 010, 013…015 |
| UC-tkt-02 (Ghi nhận thu nhập ngoài lương — nội bộ) | TC-tkt-016, 022 | TC-tkt-017, 018, 021, 023, 024 |
| UC-tkt-03 (Ghi nhận thù lao vãng lai/CTV) | TC-tkt-025, 028 | TC-tkt-026, 029…033 |
| UC-tkt-04 (Xem và chốt Bảng tính thuế) | TC-tkt-052, 066 | TC-tkt-057…060, 074 |
| UC-tkt-05 (Mở lại Bảng tính thuế) | TC-tkt-069 | TC-tkt-070…073 |
| UC-tkt-06 (Xuất Tờ khai theo quý) | TC-tkt-076, 078 | TC-tkt-077, 082, 106 |
| UC-tkt-07 (Ghi đè chỉ tiêu trước khi nộp) | TC-tkt-085 | TC-tkt-086…091 |
| UC-tkt-08 (Đánh dấu tờ khai đã nộp) | TC-tkt-092 | TC-tkt-093…095 |

---

## 8. Điều kiện môi trường & dữ liệu kiểm thử (Phase B, chuẩn bị trước)

| Hạng mục | Yêu cầu |
|---|---|
| DB | 1 tenant chính (Công ty A) + 1 tenant phụ (Công ty B) để test cô lập (TC-tkt-113) |
| Fixture nhân viên | `NV0001` HĐLĐ ≥3 tháng đang hiệu lực · `NV0002` HĐ `thu_viec` · `NV0003` HĐ `thoi_vu` |
| Fixture kỳ lương | `hrm_payroll_periods` T7, T8, T9/2026 đều tồn tại, đã có dữ liệu lương (payroll chính) ở trạng thái `LOCKED` cho đa số test Nhóm 5–7 (trừ test cố ý dựng thiếu điều kiện) |
| Fixture người phụ thuộc | `NV0001` có 1 người phụ thuộc đăng ký hợp lệ trong kỳ T7-T9/2026 |
| Fixture danh mục | Đủ 4 nhóm theo BR-tkt-002 (seed mặc định) + 1 danh mục `WITHHOLDING_FLAT` tùy chỉnh rate=15% để test khác mặc định |
| Múi giờ | `TZ=Asia/Ho_Chi_Minh` cho mọi test liên quan `paymentDate`/ranh giới tháng |
| Vai trò tài khoản | `OWNER`/`ADMIN` (đủ quyền) · `OWNER_EMPLOYEE` có/không "quyền xem dữ liệu lương" (Nhóm 10) · không đăng nhập (401) |

---

## 9. Tiêu chí ra (Exit criteria) đề xuất cho Phase B

1. 100% test case **P0** (~78 ca) tự động hóa và PASS trước khi coi feature sẵn sàng golive.
2. 4 gap 🔴 (`GAP-QA-tkt-01, 06, 07, 08`) phải có quyết định bằng văn bản từ BA/Architect trước khi Backend code phần liên quan — **cập nhật 2026-09-14: 3/4 đã có quyết định** (06, 07, 08 — xem hộp cảnh báo Mục 0), chỉ còn `GAP-QA-tkt-01` (nhánh TAXABLE_FULL+NET) thật sự còn treo.
3. `npm run typecheck` + `npm run lint` (`be_maxv`) giữ 0 lỗi sau khi thêm code `to_khai_thue`.
4. `npm test` có ≥1 file test tích hợp HTTP cho `to_khai_thue` (theo pattern `hrmSettingsShiftsHolidaysApi.test.ts`).
5. Mọi BR/FR/E/UC trong SRS có ≥1 test case ánh xạ (đã đạt — xem Mục 4–7); không có test case mồ côi.
6. `api-contract-to-khai-thue.md` đã tồn tại (bàn giao 2026-09-14) — Phase B phải rà lại toàn bộ path/field "(suy đoán)" trong `test-cases-to-khai-thue.md` theo đúng contract thật trước khi coi test case là final (GAP-QA-tkt-02, TC-tkt-124).
