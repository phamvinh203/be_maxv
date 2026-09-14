---
type: brainstorm
feature: hrm-to-khai-thue
status: draft
updated: 2026-09-14
author: business-analyst
links:
  - docs/hrm/CONTEXT_SUMMARY.md
  - docs/hrm/srs/hrm-spec.md
  - docs/hrm/du_lieu_tinh_luong/srs-du-lieu-tinh-luong.md
  - docs/hrm/cai_dat_luong/srs-cai-dat-luong.md
---

# Brainstorming: Thu nhập ngoài lương, Bảng tính thuế & Tờ khai thuế TNCN

- **Feature Slug**: hrm/to_khai_thue (sub-cụm của feature `hrm`, theo tiền lệ `cai_dat_luong/`, `du_lieu_tinh_luong/`)
- **Ngày tạo**: 2026-09-14
- **Tác giả**: business-analyst
- **Phân loại**: Architectural

## 1. Bối cảnh & Mục tiêu (Context & Business Goal)

`hdđt_maxv/src/features/hrm/components/to_khai_thue/` hiện chỉ là khung UI rỗng — `tabs.ts` đã khai sẵn 5 tab (`thu-nhap-ngoai-luong`, `bang-tinh-thue`, `to-khai-tncn`, `to-khai-quyet-toan`, `doi-soat-cong-thuc`), mọi route con render placeholder "đang phát triển". Đợt này làm đúng 3 tab đầu.

**Phát hiện quan trọng làm thay đổi phạm vi ban đầu**: khung pháp lý thuế TNCN Việt Nam đã đổi toàn diện, hiệu lực từ kỳ tính thuế 2026 (Luật Thuế TNCN số 109/2025/QH15 ngày 10/12/2025, sửa bởi Luật 09/2026/QH16; Nghị quyết 110/2025/UBTVQH15; Nghị định 253/2026/NĐ-CP; Thông tư 87/2026/TT-BTC thay Thông tư 111/2013/TT-BTC). Biểu thuế TNCN hiện lưu trong `GeneralSetting.taxBrackets` (7 bậc, theo Điều 22 Luật Thuế TNCN 2007/2012 — xem `srs/hrm-spec.md` BR-hrm-081) và mức giảm trừ gia cảnh (11tr/4,4tr theo NQ 954/2020/UBTVQH14) đã **lỗi thời**. Đây là quyết định đã được chủ dự án chốt ngày 2026-09-10 (`CONTEXT_SUMMARY.md` mục "Phân hệ Dữ liệu tính lương"), khi đó dựa trên luật cũ vì chưa có thông tin luật mới — nay đã xác nhận cập nhật lại theo luật hiện hành (xem Mục 4, Mục 7 dưới).

Đối tượng sử dụng: kế toán dịch vụ (thao tác nhập liệu, xuất tờ khai), kế toán trưởng/chủ doanh nghiệp khách hàng (xem/duyệt số liệu).

Mục tiêu 3 tính năng:
1. **Thu nhập ngoài lương** — ghi nhận các khoản thu nhập chịu thuế TNCN mà người lao động nhận ngoài lương cơ bản (thưởng, phụ cấp, hoa hồng, vãng lai...), mỗi loại có rule chịu thuế/miễn thuế/khấu trừ riêng.
2. **Bảng tính thuế** — tính thuế TNCN đúng theo biểu lũy tiến hiện hành, gộp thu nhập ngoài lương vào thu nhập chịu thuế, tổng hợp theo quý.
3. **Tờ khai thuế TNCN** — xuất số liệu đúng mẫu 05/KK-TNCN (Thông tư 89/2026/TT-BTC) theo kỳ quý, dạng Excel/PDF, để kế toán tự nộp qua HTKK/eTax.

Ngoài phạm vi đợt này: tab `to-khai-quyet-toan` (quyết toán năm, mẫu 05/QTT-TNCN) và `doi-soat-cong-thuc` — để đợt sau.

## 2. Ma trận các phương án giải quyết (Approaches & Trade-offs)

### 2.1 Thu nhập ngoài lương

| Tiêu chí | PA1 — Danh mục cố định | **PA2 — Danh mục cấu hình được (chọn)** | PA3 — Tự nhận diện từ chứng từ |
|:--|:--|:--|:--|
| Mô tả | Hardcode danh sách loại thu nhập (thưởng, phụ cấp ăn ca...) và ngưỡng miễn/thuế suất trong code | Danh mục loại thu nhập lưu trong DB, mỗi loại có rule (chịu thuế toàn phần / miễn có ngưỡng / miễn toàn bộ / khấu trừ riêng %); seed sẵn theo luật hiện hành, sửa được qua UI | Đọc hoá đơn/phiếu chi, dùng OCR/matching để tự gợi ý khoản ngoài lương |
| Ưu điểm | Nhanh nhất | Ngưỡng miễn/thuế suất đổi được không cần sửa code — quan trọng vì đã đổi 2 lần chỉ trong 2026 | Giảm thao tác nhập tay |
| Nhược điểm | Mỗi lần luật đổi phải sửa code + deploy | Cần thêm UI quản lý danh mục | Phức tạp, cần OCR/matching, rủi ro nhận diện sai |
| Độ phức tạp | Thấp | Trung bình | Cao |

**Đề xuất & đã chọn**: PA2 — nhất quán với hướng "cấu hình theo hiệu lực" đã chọn cho biểu thuế (Mục 4), và tránh lặp lại đúng vấn đề vừa gặp với `taxBrackets` (hardcode theo luật cũ, không tự cập nhật được).

### 2.2 Bảng tính thuế

| Tiêu chí | PA1 — Chỉ hiển thị lại số tháng | **PA2 — Gộp thu nhập ngoài lương + tổng hợp quý (chọn)** | PA3 — Tính lũy kế theo năm (tax equalization) |
|:--|:--|:--|:--|
| Mô tả | Tính thuế TNCN theo tháng dựa thẳng trên `PayrollSheetLine` hiện có, không đổi gì | Giữ luồng tính tháng hiện tại, bổ sung (a) tự gộp thu nhập ngoài lương trong tháng vào thu nhập chịu thuế trước khi tính, (b) thêm lớp tổng hợp theo quý (cộng dồn 3 tháng) để khớp kỳ khai mới | Redesign engine tính thuế lũy kế theo năm kiểu quốc tế |
| Ưu điểm | Không đụng code cũ | Đáp ứng đúng yêu cầu (thu nhập ngoài lương + kỳ khai quý) mà không phá vỡ luồng lương tháng đang chạy | Chính xác tuyệt đối theo từng thời điểm |
| Nhược điểm | Không tính được thu nhập ngoài lương, không có số liệu theo quý | Cần thêm tầng tổng hợp quý | Thuế TNCN VN vốn tính tháng rồi quyết toán năm — không cần lũy kế real-time, over-engineering |
| Độ phức tạp | Thấp | Trung bình | Cao |

**Đề xuất & đã chọn**: PA2.

### 2.3 Tờ khai thuế TNCN

| Tiêu chí | PA1 — Chỉ số liệu tổng hợp | **PA2 — Đúng mẫu 05/KK-TNCN + bảng chi tiết nội bộ (chọn)** | PA3 — Xuất XML nạp thẳng HTKK |
|:--|:--|:--|:--|
| Mô tả | Tổng hợp số liệu nội bộ, không theo form chính thức | Tính đúng số liệu mẫu 05/KK-TNCN (Thông tư 89/2026/TT-BTC), xuất Excel/PDF; kèm bảng chi tiết theo từng nhân viên (không phải mẫu chính thức, phục vụ đối chiếu + chuẩn bị dữ liệu cho quyết toán năm sau) | Sinh file XML theo cấu trúc HTKK để import thẳng |
| Ưu điểm | Đơn giản | Kế toán dùng được ngay để nộp, có dấu vết chi tiết | Giảm thao tác nhập tay nhiều nhất |
| Nhược điểm | Không dùng được để nộp thật | Vẫn phải nhập tay vào HTKK/eTax (không có shortcut) | Chuẩn XML HTKK không công khai chính thức — rủi ro sai định dạng, GDT không có API mở (phải đăng ký T-VAN mới nộp trực tiếp được) |
| Độ phức tạp | Thấp | Trung bình | Cao, rủi ro |

**Đề xuất & đã chọn**: PA2.

## 3. Ranh giới phạm vi (Scope & Boundaries)

**In-scope:**
- 3 màn: `thu-nhap-ngoai-luong`, `bang-tinh-thue`, `to-khai-tncn`.
- Danh mục loại thu nhập ngoài lương cấu hình được (BR-05).
- Biểu thuế/giảm trừ gia cảnh lưu theo mốc hiệu lực (effective-dated) — thay cho singleton hiện tại của `GeneralSetting`.
- Cập nhật số liệu biểu thuế/giảm trừ gia cảnh hiện hành (5 bậc/15,5tr/6,2tr) vào `GeneralSetting`, đồng thời sửa lại `srs/hrm-spec.md` (BR-hrm-081 và các mục liên quan) — xem Mục 7, thực hiện như một sửa đổi riêng biệt trên tài liệu đã ký duyệt, có L2 diff riêng.
- Tính thuế TNCN tháng (mở rộng `PayrollSheetLine`) + tổng hợp quý.
- Xuất mẫu 05/KK-TNCN (Excel + PDF) theo quý + bảng chi tiết nhân viên nội bộ.

**Out-of-scope (đợt này):**
- Tab `to-khai-quyet-toan` (quyết toán năm, mẫu 05/QTT-TNCN + phụ lục 05-1/05-2/05-3-BK) — đợt sau.
- Tab `doi-soat-cong-thuc` — chưa rõ mục đích, làm rõ riêng khi tới lượt.
- Nộp tờ khai điện tử tự động qua GDT (không có API mở, cần đăng ký T-VAN).
- Cá nhân không cư trú (20% flat) — biết tồn tại nhưng UI đợt này tập trung cá nhân cư trú có HĐLĐ ≥3 tháng; vãng lai <3 tháng/không HĐLĐ có xử lý khấu trừ 10% cơ bản.
- Tự động đối chiếu chứng từ chi để tự nhận diện khoản ngoài lương (PA3 Mục 2.1).
- **Rà soát/tính lại dữ liệu payroll các kỳ ĐÃ CHỐT trước ngày cập nhật này** dùng biểu 7 bậc cũ — xem OQ trong Mục 6, cần quyết định riêng có chạy lại hay không.

## 4. Quy tắc nghiệp vụ then chốt (Core Business Rules)

**[BR-01] Biểu thuế lũy tiến từng phần** (thu nhập từ tiền lương, tiền công, cá nhân cư trú, HĐLĐ ≥3 tháng), hiệu lực từ kỳ tính thuế 2026 — Luật 109/2025/QH15, Nghị định 253/2026/NĐ-CP (thay Điều 22 Luật Thuế TNCN 2007/2012 đang lưu trong `GeneralSetting`):

| Bậc | Thu nhập tính thuế/tháng | Thuế suất | Công thức nhanh |
|:--:|:--|:--:|:--|
| 1 | Đến 10 triệu | 5% | 5% × TNTT |
| 2 | Trên 10 đến 30 triệu | 10% | 10% × TNTT − 0,5tr |
| 3 | Trên 30 đến 60 triệu | 20% | 20% × TNTT − 3,5tr |
| 4 | Trên 60 đến 100 triệu | 30% | 30% × TNTT − 9,5tr |
| 5 | Trên 100 triệu (bậc mở) | 35% | 35% × TNTT − 14,5tr |

**[BR-02] Giảm trừ gia cảnh**: bản thân người nộp thuế 15.500.000đ/tháng; mỗi người phụ thuộc hợp lệ 6.200.000đ/tháng (Nghị quyết 110/2025/UBTVQH15, thay NQ 954/2020/UBTVQH14 đang lưu trong `GeneralSetting`). Ngưỡng thu nhập để 1 người được tính là người phụ thuộc: ≤3.000.000đ/tháng (Thông tư 87/2026/TT-BTC).

**[BR-03] Giảm trừ trước thuế khác**: bảo hiểm bắt buộc NLĐ đóng 10,5% lương căn cứ đóng BH (8% hưu trí-tử tuất + 1,5% BHYT + 1% BHTN — không đổi); bảo hiểm hưu trí tự nguyện tối đa 3.000.000đ/tháng (tăng từ 1tr, NĐ 253/2026/NĐ-CP); đóng góp từ thiện/nhân đạo/khuyến học theo chứng từ hợp pháp, tối đa không vượt thu nhập tính thuế từ lương trong năm, không chuyển năm sau.

**[BR-04] Công thức tính**: Thuế TNCN phải nộp = (Tổng thu nhập chịu thuế trong kỳ − BH bắt buộc − Giảm trừ gia cảnh − Giảm trừ khác) × biểu lũy tiến BR-01.

**[BR-05] Danh mục thu nhập ngoài lương** — mức miễn/chịu thuế mặc định khi khởi tạo hệ thống (cấu hình được theo PA2 Mục 2.1):
- **Miễn 100%**: làm thêm giờ/ca đêm (toàn bộ, không chỉ phần chênh lệch — thay đổi so với luật cũ); trợ cấp thôi việc/mất việc (kể cả phần vượt mức luật định); trợ cấp thất nghiệp (BHXH chi trả); công tác phí thực thanh toán có chứng từ; xe đưa đón tập thể, học phí con em trả thẳng trường, khám sức khỏe chung (chi CHUNG, không ghi tên cá nhân); trang phục hiện vật có hoá đơn; thưởng sáng kiến được CƠ QUAN NHÀ NƯỚC có thẩm quyền công nhận (không phải biên bản nội bộ DN).
- **Miễn có ngưỡng**: ăn trưa/ăn ca tiền mặt ≤1.200.000đ/người/tháng (tăng từ 730k, phần vượt chịu thuế); ăn ca DN tự nấu/phiếu ăn miễn toàn bộ không giới hạn; trang phục bằng tiền ≤5.000.000đ/người/năm (**OQ — xem Mục 6**, cần xác nhận đây là mức mới hay kế thừa mức cũ).
- **Chịu thuế toàn phần** (cộng vào thu nhập chịu thuế tháng, tính theo BR-01): thưởng Tết/lễ/KPI/cuối năm/tháng 13; du lịch/nhà ở/phúc lợi khác GHI RÕ TÊN cá nhân hưởng (riêng tiền nhà DN trả thay tối đa = 15% tổng thu nhập chịu thuế chưa gồm tiền nhà, phần vượt vẫn chịu thuế).
- **Khấu trừ riêng 10%** (không cộng vào thu nhập chịu thuế lũy tiến): hoa hồng/thù lao CTV/kiêm nhiệm không HĐLĐ hoặc HĐLĐ <3 tháng, khi chi trả ≥5.000.000đ/lần (tăng từ 2tr, NĐ 253/2026/NĐ-CP Điều 50 khoản 2, hiệu lực 01/07/2026). Dưới 5tr/lần: không khấu trừ trừ khi cá nhân yêu cầu, hoặc cá nhân có Cam kết 08/CK-TNCN (chỉ 1 nguồn thu nhập, có MST, ước tính cả năm sau giảm trừ chưa đến mức nộp thuế) → tạm không khấu trừ.
- **OQ — bảo hiểm nhân thọ/không bắt buộc có tích lũy phí DN mua cho NLĐ** (khấu trừ 10% trên phí): chưa xác nhận được Thông tư hướng dẫn NĐ253/2026 có đổi mức này không — giữ quy tắc cũ, đánh dấu cần rà lại (xem Mục 6).

**[BR-06] Kỳ khai tờ khai TNCN** (mẫu 05/KK-TNCN, Thông tư 89/2026/TT-BTC): CHỈ THEO QUÝ (bỏ kỳ tháng), không phụ thuộc ngưỡng doanh thu 50 tỷ như trước. Hạn nộp: chậm nhất ngày cuối tháng đầu quý sau.

**[BR-07] Mốc hiệu lực & lưu trữ song song**: BR-01 đến BR-06 áp dụng cho kỳ tính thuế 2026 trở đi; kỳ khai theo quý áp dụng từ kỳ tính thuế Quý III/2026. Hệ thống phải lưu **song song** được biểu thuế/mức giảm trừ CŨ (trước 2026) để tính lại/tra cứu dữ liệu lịch sử — không ghi đè mất. Đây chính là câu trả lời cho `OQ-hrm-35` đã treo sẵn trong `srs/hrm-spec.md` (xem Mục 7).

## 5. Bảng trạng thái thực thể (State Transitions Table)

| Entity | Trạng thái hiện tại | Sự kiện | Trạng thái tiếp theo | Điều kiện |
|:--|:--|:--|:--|:--|
| Bảng tính thuế (kỳ tháng) | (chưa có) | Hệ thống tự tính khi có đủ dữ liệu lương + thu nhập ngoài lương | Nháp | Tự động, tính lại nhiều lần được |
| Bảng tính thuế (kỳ tháng) | Nháp | Kế toán xác nhận chốt số liệu | Đã chốt | Không còn sửa thu nhập ngoài lương của tháng đó (trừ khi Mở lại) |
| Bảng tính thuế (kỳ tháng) | Đã chốt | Kế toán yêu cầu Mở lại | Nháp | Chỉ khi kỳ khai quý chứa tháng đó CHƯA "Đã xuất tờ khai" |
| Tờ khai TNCN (kỳ quý) | (chưa có) | Đủ 3 tháng trong quý đều "Đã chốt" | Sẵn sàng xuất | Tự động kiểm điều kiện |
| Tờ khai TNCN (kỳ quý) | Sẵn sàng xuất | Kế toán xuất Excel/PDF | Đã xuất tờ khai | Khoá 3 tháng lương trong quý, không cho Mở lại nữa |
| Tờ khai TNCN (kỳ quý) | Đã xuất tờ khai | Kế toán đánh dấu đã nộp (thủ công, sau khi nộp qua HTKK/eTax) | Đã nộp | Thao tác thủ công, không xác thực với GDT |
| Thu nhập ngoài lương (bản ghi/nhân viên/kỳ) | (chưa có) | Kế toán nhập/import | Nháp | |
| Thu nhập ngoài lương (bản ghi/nhân viên/kỳ) | Nháp | Kỳ tháng chứa nó chuyển "Đã chốt" | Đã chốt | Kế thừa trạng thái khóa từ Bảng tính thuế |

## 6. Danh mục Edge Cases & Câu hỏi cho QA/Architect

- NLĐ vào/nghỉ việc giữa kỳ quý — tính thuế tháng có dữ liệu thì tính, tháng không có lương thì bỏ qua khi tổng hợp quý.
- NLĐ có nhiều nguồn thu nhập (2 công ty cùng MST) — hệ thống chỉ biết dữ liệu nội bộ, không tự cộng dồn nguồn ngoài. **Đề xuất out-of-scope đợt này**, NLĐ đa nguồn tự quyết toán riêng.
- Sửa số liệu lương/thu nhập ngoài lương SAU KHI kỳ quý đã "Đã xuất tờ khai" — không cho sửa trực tiếp, cần cơ chế "khai bổ sung" (out-of-scope đợt này, chỉ ghi nhận là hạn chế biết trước).
- Người phụ thuộc đăng ký/hủy giữa kỳ tháng — giảm trừ tính theo THÁNG có đăng ký hợp lệ, theo nguyên tắc hiện có ở `hrm_nguoi_phu_thuoc` — cần Architect xác nhận logic hiện tại đã đúng chưa với mức mới BR-02.
- Mốc chuyển kỳ khai tháng→quý từ Quý III/2026 — dữ liệu Quý I, II/2026 nếu công ty từng theo dõi theo tháng thì hệ thống chỉ cần HIỂN THỊ lại, không bắt buộc dựng tờ khai lịch sử theo mẫu mới. **OQ**: có cần import dữ liệu lịch sử trước 2026 không?
- **OQ pháp lý (mức độ rủi ro cao — cần xác nhận trước khi golive dữ liệu thật)**: nửa đầu 2026 (T1-T6) khấu trừ hàng tháng theo biểu 7 bậc cũ hay 5 bậc mới — nguồn nghiên cứu web không thống nhất hoàn toàn; nguồn đáng tin nhất (EY Vietnam, trích Điều 29 Luật 109/2025/QH15) cho rằng nội dung tiền lương/tiền công của cá nhân cư trú áp dụng từ kỳ tính thuế 2026 (cả năm), nhưng có nguồn báo chí nói khấu trừ hàng tháng H1/2026 vẫn tạm theo biểu cũ, quyết toán cuối năm mới áp biểu mới cho toàn bộ năm. Vì đã chọn kiến trúc "cấu hình theo hiệu lực" (BR-07) nên hệ thống KHÔNG bị chặn kỹ thuật bởi câu hỏi này (chỉ cần đúng ngày hiệu lực gán cho từng bản ghi biểu thuế) — nhưng dữ liệu thật cần **xác nhận với kế toán trưởng hoặc đọc thẳng Điều 29 Luật 109/2025/QH15 / Thông tư 87/2026/TT-BTC bản gốc** trước khi golive.
- **OQ — mức miễn thuế trang phục tiền mặt 5.000.000đ/năm** (BR-05): nguồn nghiên cứu chưa xác nhận chắc đây là số MỚI hay kế thừa quy định cũ — cần tra Thông tư 87/2026/TT-BTC bản gốc trước khi khoá cứng làm giá trị mặc định.
- **OQ — bảo hiểm nhân thọ/không bắt buộc DN mua cho NLĐ** (BR-05): chưa xác nhận Thông tư hướng dẫn NĐ253/2026 có đổi mức khấu trừ 10% trên phí bảo hiểm hay không.
- **Lưu ý kỹ thuật cho Architect**: `GeneralSetting` hiện là singleton (1 dòng duy nhất, xem `srs/hrm-spec.md` A-hrm-11/A-hrm-12) — cần đổi sang có LỊCH SỬ hiệu lực (nhiều bản ghi/nhiều phiên bản kèm ngày hiệu lực) mới đáp ứng BR-07 và trả lời được `OQ-hrm-35`. Ảnh hưởng cách `Cài đặt lương` (`cai_dat_luong`) và `Bảng lương` (`du_lieu_tinh_luong`) đang đọc cấu hình này — cần đánh giá tác động ngược trước khi đổi schema.
- **Lưu ý — remediation dữ liệu cũ**: `srs/hrm-spec.md` đã có sẵn FR-hrm-055 (rà soát & chuẩn hóa biểu thuế, không ghi đè biểu công ty tự chỉnh) từ đợt sửa lỗi 2026-09-08, nhưng target khi đó là "biểu 7 bậc chuẩn" (luật cũ). Khi triển khai, Architect/Backend cần đánh giá **chạy thêm 1 đợt rà soát tương tự** để đưa công ty đang ở biểu 7 bậc (mới remediate xong tuần trước) sang biểu 5 bậc chuẩn mới — tái dùng cùng cơ chế bảo vệ "không ghi đè biểu công ty đã tự chỉnh" (BR-hrm-083). Việc này nằm NGOÀI 3 tính năng đang bàn nhưng là điều kiện tiên quyết để `GeneralSetting` không có 2 nguồn sự thật.
- OQ kế thừa còn mở, liên quan nhưng chưa chặn đợt này: `OQ-hrm-34` (quyết toán năm suy ngưỡng theo 12 lần tháng hay khai riêng biểu năm — liên quan tab `to-khai-quyet-toan` để sau).

## 7. Sửa đổi liên quan trên tài liệu đã ký duyệt (`srs/hrm-spec.md`)

Vì `GeneralSetting.taxBrackets`/`personalDeduction`/`dependentDeduction` là nguồn dùng chung với cụm "Cấu hình mặc định" (đã có SRS ký duyệt trong `srs/hrm-spec.md`, BR-hrm-080…083), quyết định áp dụng luật mới (Mục 4) kéo theo sửa đổi trực tiếp trên tài liệu đó — không phải tài liệu mới, thực hiện như một **thay đổi riêng, có L2 diff riêng**, không gộp lẫn vào việc ghi file brainstorm này. Phạm vi sửa: BR-hrm-081 (biểu chuẩn 7→5 bậc), giá trị mặc định `personalDeduction`/`dependentDeduction`, bảng biểu Mục 4.8, AC-hrm-67, AC-hrm-71, FR-hrm-045…047, A-hrm-12, và đóng `OQ-hrm-35` bằng quyết định BR-07 ở trên.
