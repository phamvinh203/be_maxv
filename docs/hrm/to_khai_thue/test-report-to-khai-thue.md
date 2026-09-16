---
type: test-report
feature: hrm-to-khai-thue
status: draft
updated: 2026-09-15
author: tester-qa
links:
  - docs/hrm/to_khai_thue/test-cases-to-khai-thue.md
  - docs/hrm/to_khai_thue/test-matrix-to-khai-thue.md
  - docs/hrm/to_khai_thue/api-contract-to-khai-thue.md
  - docs/hrm/to_khai_thue/issues-and-bugs-to-khai-thue.md
  - be_maxv/src/__tests__/hrm/hrmToKhaiThueApi.test.ts
  - docs/hrm/CONTEXT_SUMMARY.md
---

# HR — Test Report (Phase B): Thu nhập ngoài lương, Bảng tính thuế & Tờ khai TNCN (`to_khai_thue`)

Kiểm định động 23 endpoint của sub-cụm. **Lượt 1** chạy trên commit `11e2ab1`, tìm 3 lỗi sản phẩm và 2 vấn đề cần quyết. Chủ dự án chốt 3 quyết định, backend sửa; **lượt 2** chạy lại toàn bộ lúc 13:51 ngày 2026-09-15 (commit `9fd34ec`). Code-reviewer trả 7 finding cần sửa (RVW-721…727); backend sửa; **lượt 3** chạy lại toàn bộ cùng ngày, kèm 10 ca mới cho các finding (Mục 2a). Lượt review lại thêm RVW-732…736; backend sửa 4 điểm theo quyết định chủ dự án (chưa commit); **lượt 4** chạy lại toàn bộ lúc 16:30 (Mục 2b). Mọi con số dưới đây do chính phiên này chạy lại, không dùng số tự báo cáo.

## 1. Phạm vi và cách chạy

- **Bộ kiểm thử:** `be_maxv/src/__tests__/hrm/hrmToKhaiThueApi.test.ts` (commit `9fd34ec`; ca của lượt 3 chưa commit). Gọi HTTP thật trong tiến trình bằng `app.inject`, đi trọn đường: hook đăng nhập, `requireModule('hrm')`, controller, validator, service, Postgres, errorHandler.
- **Lệnh chạy** (từ `be_maxv/`, biến `NHAT_KY_TKT` tùy chọn để lưu nguyên văn mọi lượt gọi):

```bash
npx tsx --experimental-test-module-mocks --test src/__tests__/hrm/hrmToKhaiThueApi.test.ts
```

- **Môi trường:** Postgres local, có chốt chặn `batBuocDbKiemThu()`. Bộ test tự cấp 2 DB tenant riêng `maxv_9970000021_app` (A) và `maxv_9970000022_app` (B), chạy xong DROP. Không ghi vào tenant thật.
- **Tài khoản** sinh trong lượt chạy, mật khẩu ngẫu nhiên: OWNER · kế toán (OWNER_EMPLOYEE có quyền xem lương) · nhân sự (OWNER_EMPLOYEE không có quyền xem lương).
- **Đường dẫn và trường** theo `api-contract-to-khai-thue.md`, không theo đường suy đoán trong bộ ca (TC-tkt-124).
- **Dữ liệu:** kỳ lương tạo và khóa sổ qua API thật (T4–T11/2026, cố ý không có T12). Chính sách thuế, nhân viên, hợp đồng, người phụ thuộc nạp thẳng DB vì ngoài phạm vi bộ ca.

Nhân sự tenant A — số tiền chọn để tính tay được:

| Mã | Hợp đồng | Lương | BH bắt buộc | Dùng cho |
|---|---|---:|:--:|---|
| NV0001 | không xác định, từ 01/01/2026 | 20.000.000 | không | TC-061 gộp thu nhập |
| NV0002 | thử việc 01/07–30/09/2026 | 8.000.000 | không | TC-064 hai cơ chế khấu trừ |
| NV0003 | không xác định | 44.500.000 | không | TC-062 đổi bậc thuế |
| NV0004 | không xác định | 30.000.000 | có | TC-052b, 065, 111 đối chiếu engine lương |
| NV0005 | không xác định, từ 01/08/2026 | 15.000.000 | không | TC-103 vào giữa quý |
| NV0006 | không xác định + 1 người phụ thuộc từ 9/2026 | 25.000.000 | không | TC-106, KR-11 |
| NV0007 | không xác định, từ 01/10/2026 | 12.000.000 | không | KR-03, ISSUE-tkt-002 không thu nhập cả quý III |

Khoản ngoài lương tháng 9/2026: NV0001 thưởng 5.000.000 · NV0003 thưởng 3.000.000 · NV0002 hoa hồng khấu trừ tại nguồn 6.000.000 · vãng lai "Nguyễn Văn A" 6.000.000 ngày 10/09 và "nguyễn văn A" 4.000.000 ngày 20/09.

## 2. Kết luận

**Lượt 4 đạt cổng Phase B.** 132/132 ca lá đạt, 0 lỗi, 13 bỏ qua có lý do (Mục 8) — thêm 2 ca cho RVW-732, RVW-735 và siết 1 ca cũ cho RVW-736. Hồi quy toàn backend vẫn chỉ còn đúng 4 lỗi cũ có từ trước Phase B. Lượt 3 (130/130) đóng RVW-721…727; lượt 2 (120/120) đóng cả 5 điểm của lượt 1 (chi tiết ở `issues-and-bugs-to-khai-thue.md`).

Còn mở, không chặn: ISSUE-tkt-003 (mở lại tháng xóa ghi đè chỉ tiêu) · ISSUE-tkt-005 (`npm audit`) · TC-tkt-107 và nhánh xuất PDF qua endpoint chưa chạy · mã lỗi chọn cho hợp đồng Mục 3.4 dòng 4b/5c, `E-dltl-029` và `E-dltl-030` chờ Architect xác nhận · tenant thật chưa rà soát và chưa áp chỉ số chống trùng `hrm_oir_chong_trung_v2` (cần chủ dự án duyệt `npm run hrm:ra-soat` rồi `npm run hrm:constraints`, trình tự ở ADR-013 "Sửa đổi 2026-09-15" mục 4) · RVW-733 (🟢, DB giả truyền `db` làm `tx`) để sau. Code-reviewer review lại lượt 3: ⚠️ Approve with comments. Review lại lần 2 (phần sửa RVW-732…736): ⚠️ Approve with comments, thêm RVW-737…739 (xem `review-findings.md`). Lưu ý cho bộ kiểm thử (RVW-738): dòng vãng lai đã chốt duy nhất trên tenant kiểm thử là "Nguyễn Văn A" — chưa có ca tên mang chữ hoa ngoài ASCII và ca vãng lai có CCCD chốt ở v2.

## 2b. Lượt 4 — sau khi sửa RVW-732, RVW-734, RVW-735, RVW-736 (2026-09-15 16:30)

### 2b.1 Kết quả tổng

| Hạng mục | Kết quả |
|---|---|
| Bộ `hrmToKhaiThueApi.test.ts` | 145 ca lá: **132 đạt · 0 lỗi · 13 bỏ qua có lý do** (node:test đếm thêm 11 nhóm cha: 156 test, 143 đạt), 19 giây |
| Lượt gọi HTTP | 240: 131 thành công (2xx), 108 lỗi nghiệp vụ 4xx, 1 lỗi 5xx — `E-tkt-015` cố ý dựng ở KR-tkt-23 |
| Unit test liên quan (13 file) | 144/144 — thêm 3 ca: thứ tự dòng Bảng tính thuế · nạp lười ở `GET /tax-policies` · chặn xóa kỳ còn khoản ngoài lương |
| Hồi quy `npm test` toàn backend | 1191 test · 1174 đạt · 4 lỗi · 13 bỏ qua. 4 lỗi = đúng mốc trước Phase B (TC-hrm-301, TC-hrm-316 và 2 nhóm cha). Lượt 3 là 1186 · 1169; thêm 5 test = 2 ca HTTP + 3 ca unit |
| `tsc --noEmit` | 0 lỗi |
| `eslint` các file vừa sửa | 0 lỗi (cảnh báo có sẵn: `console` ở script seed, `any` ở `payrollPeriods.service.ts`:40) |

### 2b.2 Ca mới và ca đổi kỳ vọng

| Ca | Kiểm | Kết quả | Finding |
|---|---|---|---|
| TC-tkt-061 (thêm khẳng định) | Thứ tự dòng Bảng tính thuế T9 lúc Nháp | 6 dòng HĐLĐ từ 3 tháng theo họ tên (Đỗ Văn Bảy, Hoàng Văn Năm, Lê Văn Ba, Nguyễn Văn Một, Phạm Thị Bốn, Vũ Thị Sáu) → thời vụ → vãng lai; TC-tkt-066 khẳng định bảng Đã chốt trùng đúng thứ tự | RVW-736 |
| RVW-735 | Xóa kỳ T11 (`DRAFT`, còn 1 khoản ngoài lương) · xóa kỳ 1/2027 trống | 409 `E-dltl-030` "còn 1 khoản", kỳ và khoản còn nguyên · 200 | RVW-735 |
| RVW-732 | Rà soát tenant A: sạch → gắn CCCD cho dòng vãng lai T9 → gỡ tạm index v2, dựng khoản cùng CCCD gõ tên khác → áp lại ràng buộc | 0 / 0 · mục khóa cũ báo 9/2026, quý đã xuất · mục khoản trùng báo 1 nhóm, áp ràng buộc báo `vuongDuLieu` 23505 chứ không ném · dọn xong áp lại sạch | RVW-732 |
| KR-tkt-23, RVW-725 | Dựng chính sách thuế bằng hàm ánh xạ chung `veDuLieuChinhSach` | Vẫn đạt | RVW-734 |

## 2a. Lượt 3 — sau khi sửa findings review RVW-721…727 (2026-09-15 15:34)

### 2a.1 Kết quả tổng

| Hạng mục | Kết quả |
|---|---|
| Bộ `hrmToKhaiThueApi.test.ts` | 143 ca lá: **130 đạt · 0 lỗi · 13 bỏ qua có lý do** (node:test đếm thêm 11 nhóm cha: 154 test, 141 đạt), 39 giây |
| Ca mới của lượt 3 | 10/10 đạt (Mục 2a.2) |
| Lượt gọi HTTP | 237: 129 thành công (2xx), 107 lỗi nghiệp vụ 4xx, 1 lỗi 5xx — `E-tkt-015` cố ý dựng ở KR-tkt-23. Không có lỗi 500 vô danh |
| Unit test liên quan (12 file) | 115/115 — thêm 13 ca: giao dịch ghi khoản ngoài lương 3 · biên đầu vào 3 · mở lại / xóa kỳ lương 3 · thứ tự khóa khi chốt tháng 1 · engine thuế 1 · ghi đè chỉ tiêu 1 · nạp lười chính sách thuế 1 |
| Hồi quy `npm test` toàn backend | 1186 test · 1169 đạt · 4 lỗi · 13 bỏ qua. 4 lỗi = đúng mốc trước Phase B (TC-hrm-301, TC-hrm-316 và 2 nhóm cha). Lượt 2 là 1163 · 1146; thêm 23 test = 10 ca HTTP + 13 ca unit |
| `tsc --noEmit` | 0 lỗi |
| `eslint` các file vừa sửa | 0 lỗi (1 cảnh báo `any` có sẵn ở `payrollPeriods.service.ts`:40) |

### 2a.2 Ca mới và ca đổi kỳ vọng

| Ca | Kiểm | Kết quả | Finding |
|---|---|---|---|
| RVW-721 (tháng đã chốt) | Mở lại kỳ lương T9 | 409 `E-dltl-029`, kỳ vẫn `LOCKED`, còn đủ 8 dòng thuế | RVW-721 |
| RVW-721 (sau khi mở Bảng tính thuế) | Mở lại kỳ lương T9, rồi khóa sổ lại | 200 `DRAFT`; các ca sau vẫn khớp bộ số Q3 | RVW-721 |
| RVW-721 (lưới an toàn) | Kỳ T11 `DRAFT` còn khóa `TAX_SHEET` (dựng thẳng DB) ⇒ xóa kỳ | 409 `E-dltl-029`, kỳ và khoản ngoài lương còn nguyên | RVW-721 |
| RVW-721 (kịch bản A) | Quý III đã xuất ⇒ mở lại kỳ lương T8 | 409 `E-dltl-029`, kỳ vẫn `LOCKED` | RVW-721 |
| RVW-723 (danh mục) | Trần miễn thuế / ngưỡng khấu trừ 10.000 tỷ | 400 `E-tkt-003` cả hai | RVW-723 |
| RVW-723 (số tiền) | `amount` 0,004 · 1.500.000,5 · 1.000 tỷ; và 999.999.999.999 | 400 `E-tkt-004` ×3; số trần 200 | RVW-723 |
| RVW-723 (NET 99,99%) | Tính thử NET 999.999.999.999 với tỷ lệ 99,99% | 400 `E-tkt-004` "vượt giới hạn" | RVW-723 |
| TC-tkt-087 (thêm 2 khẳng định) | Ghi đè `ct16` = 3 tỷ người, `ct22` = 1e17 | 400 `E-tkt-012` cả hai, không ghi | RVW-723 |
| RVW-724 | Ngày 31/09 vào kỳ T10 · ngày chứng từ 45/13 · tính thử ngày 45/13 | 400 `E-tkt-004` ×3, không lưu | RVW-724 |
| KR-tkt-06 (thêm khẳng định) | Thứ tự danh sách T9; trang 1; kỳ không tồn tại | R5, R1, R3, R4, R2; trang 1 = R5, R1; 400 `E-tkt-017` | RVW-726 |
| RVW-727 | Hai "Nguyễn Văn Hùng" khác CCCD, cùng loại / ngày / 600.000; cùng CCCD gõ tên khác | 201, 201; 409 `E-tkt-005`; Bảng tính thuế T10 có 2 dòng `VL:001203000001`, `VL:001203000002` | RVW-727 |
| KR-tkt-23 (dựng lại) | Tenant B chỉ có một mốc chính sách 2099-01-01 | 500 `E-tkt-015` kèm hướng dẫn, không tự nạp đè | RVW-725 |
| RVW-725 | Tenant B cấp mới, bảng chính sách rỗng ⇒ GET Bảng tính thuế | 200, biểu 2026-01-01; tự có 2 mốc 1900-01-01 và 2026-01-01 | RVW-725 |
| TC-tkt-110 | Bỏ bước nạp chính sách bằng tay | Vẫn đạt: 0 dòng, khóa sổ + chốt tháng được | RVW-725 |

- Các ca đua dữ liệu TC-tkt-020 (double-click), TC-075 (chốt song song), TC-084 và KR-tkt-21 vẫn đạt sau khi chốt tháng chuyển sang khóa dòng kỳ lương.
- Chỉ số chống trùng mới `hrm_oir_chong_trung_v2` được kiểm trên 2 tenant cấp mới trong lượt chạy. Tenant thật chưa áp — ngoài phạm vi bộ kiểm thử.

## 3. Lượt 2 — sau khi sửa (2026-09-15 13:51)

### 3.1 Kết quả tổng

| Hạng mục | Kết quả |
|---|---|
| Bộ `hrmToKhaiThueApi.test.ts` | 133 ca lá: **120 đạt · 0 lỗi · 13 bỏ qua có lý do** (node:test đếm thêm 11 nhóm cha: 144 test, 131 đạt) |
| Theo mã bộ ca (126 mã TC-tkt) | **114 đạt qua API** · 0 lỗi · 5 không chạy được · 7 phủ bằng cách khác (Mục 8) |
| Ca kiểm riêng KR-tkt | 24/24 đạt |
| Lượt gọi HTTP | 213: 121 thành công (2xx), 91 lỗi nghiệp vụ 4xx, 1 lỗi 5xx — chính là `E-tkt-015` cố ý dựng ở KR-tkt-23. Không còn lỗi 500 vô danh |
| Unit test liên quan | engine thuế khoản 14/14 · tính chỉ tiêu tờ khai 12/12 · service tờ khai 14/14 · engine lương + dữ liệu tính lương 67/67 |
| Hồi quy `npm test` toàn backend | 1163 test · 1146 đạt · 4 lỗi · 13 bỏ qua. 4 lỗi = đúng mốc trước Phase B (TC-hrm-301, TC-hrm-316 và 2 nhóm cha). Lượt 1 là 1160 · 1132 · 15; thêm 3 test là 3 unit test mới |
| `npm run typecheck` | 0 lỗi |
| `eslint` các file vừa sửa | 0 lỗi |

### 3.2 Theo nhóm

| Nhóm | Ca lá | Đạt | Lỗi | Bỏ qua |
|---|---:|---:|---:|---:|
| 1 — Danh mục loại thu nhập | 19 | 19 | 0 | 0 |
| 2 — Bản ghi thu nhập ngoài lương | 20 | 20 | 0 | 0 |
| 3–4 — Công thức 4 nhánh | 19 | 19 | 0 | 0 |
| 5 — Bảng tính thuế tháng | 14 | 14 | 0 | 0 |
| 6 — Chốt / mở lại tháng | 13 | 13 | 0 | 0 |
| 7 — Tờ khai quý: điều kiện đủ, chỉ tiêu | 8 | 8 | 0 | 0 |
| 8 — Ghi đè chỉ tiêu | 8 | 8 | 0 | 0 |
| 9 — Xuất, tải lại, đã nộp, lịch sử | 13 | 13 | 0 | 0 |
| 10 — Phân quyền xuyên suốt | 2 | 2 | 0 | 0 |
| 11–12 — Cô lập tenant, biên dữ liệu | 4 | 4 | 0 | 0 |
| 13 — Không chạy tự động | 13 | — | — | 13 |
| **Tổng** | **133** | **120** | **0** | **13** |

### 3.3 Các ca lỗi của lượt 1 — kết quả lượt 2

| Ca | Lượt 2 | Liên kết |
|---|---|---|
| TC-tkt-021 | 404 `E-tkt-016` | BUG-tkt-001 |
| TC-tkt-015 | 201, lưu `NV0001` | BUG-tkt-001 |
| TC-tkt-117 | 201 — đạt theo hợp đồng Mục 2.3 (kỳ vọng đổi, Mục 3.4) | BUG-tkt-002 |
| TC-tkt-047 (tính thử) | 400 `E-tkt-004`; cùng danh mục trả GROSS: khấu trừ 5.000.000, thực nhận 0 | BUG-tkt-002 |
| TC-tkt-047 (ghi) | 400 `E-tkt-004`, 0 dòng được lưu | BUG-tkt-002 |
| KR-tkt-08 | 400 `E-tkt-004` ở tính thử và ghi, 0 dòng `isResident = false` | BUG-tkt-003 |
| KR-tkt-11 | T8, NV0006: engine lương đếm 0 người phụ thuộc, thuế 475.000 — bằng Bảng tính thuế 475.000 | ISSUE-tkt-001 |

### 3.4 Thay đổi ở bộ kiểm thử giữa hai lượt

| Ca | Lượt 1 kiểm | Lượt 2 kiểm | Lý do |
|---|---|---|---|
| TC-tkt-117 | Tạo danh mục tỷ lệ 100% → 400 | → 201 | Hợp đồng Mục 2.3 nhận `0..100`; kỳ vọng cũ là giả định của bộ ca |
| TC-tkt-118 | Ghi nhận hành vi (201 hoặc 400) | → 201 | Như trên |
| TC-tkt-047 (2 ca) | Chỉ kiểm status 400 | Kiểm 400 kèm mã `E-tkt-004`; thêm nhánh GROSS tỷ lệ 100% | Siết sau khi sửa BUG-tkt-002 |
| KR-tkt-08 | Nhãn phương pháp phải khớp số thuế | `isResident = false` → 400 `E-tkt-004`, không lưu | Chủ dự án chọn chặn (BUG-tkt-003) |
| TC-tkt-077, 096 (bộ số Q3) | [16] = 8, [17] = 6 | [16] = 7, [17] = 5 | Chủ dự án chốt không đếm người không được trả đồng nào (ISSUE-tkt-002) |
| KR-tkt-03 (quý) → ISSUE-tkt-002 (quý) | Quan sát NV0007 được đếm | 8 người có dòng trong quý nhưng [16] chỉ đếm 7 | Như trên |
| KR-tkt-03 (tháng) | Quan sát | Giữ nguyên kiểm tra, bỏ nhãn quan sát | Quyết định giữ dòng 0 đồng trên bảng tháng |

- TC-tkt-015 và 021 kiểm nguyên như lượt 1. Kỳ vọng in hoa `ma_nv` của TC-015 là đúng quy ước HRM — kết luận ISSUE-tkt-004 của lượt 1 sai.
- Unit test: thêm 3 ca (BUG-tkt-002 ở engine thuế khoản, ISSUE-tkt-002 ở phép đếm tờ khai, ISSUE-tkt-001 ở engine lương), cả 3 đã chạy thấy **đỏ** trước khi sửa mã. Sửa dữ liệu mẫu phi thực tế ở `hrmTaxDeclaration.test.ts` và `hrmTaxDeclarationCalc.test.ts`: dòng giả lập có thu nhập chịu thuế nhưng tổng thu nhập bằng 0, nay tổng thu nhập không nhỏ hơn thu nhập chịu thuế.

### 3.5 Các ca đua dữ liệu ở lượt 2

- TC-tkt-084: GET quý trả `CHUA_SAN_SANG`, lệnh mở lại T6 trả 200, không còn dòng tờ khai Q2 — đạt.
- KR-tkt-21: lệnh mở lại T5 thắng (200), xuất Q2 nhận 400 `E-tkt-010`, không có tờ khai "đã xuất" nửa vời — đạt. Cả hai lượt đều ra nhánh "mở lại thắng"; nhánh "xuất thắng" có trong ca kiểm nhưng chưa từng xảy ra thật.
- Double-click tạo khoản (TC-020) và chốt tháng song song (TC-075) đạt như lượt 1.

## 4. Lượt 1 — trước khi sửa (commit `11e2ab1`)

### 4.1 Kết quả tổng

| Hạng mục | Kết quả |
|---|---|
| Bộ `hrmToKhaiThueApi.test.ts` | 133 ca lá: 113 đạt · 7 lỗi · 13 bỏ qua có lý do (144 test gồm 11 nhóm cha: 120 đạt, 11 lỗi) |
| Theo mã bộ ca (126 mã TC-tkt) | 110 đạt qua API · 4 lỗi (TC-015, 021, 047, 117) · 5 không chạy được · 7 phủ bằng cách khác |
| Ca kiểm riêng KR-tkt-01…23 | 24 ca: 22 đạt, 2 lỗi (KR-08, KR-11) |
| Lượt gọi HTTP | 211: 121 thành công (2xx), 88 lỗi nghiệp vụ 4xx, 2 lỗi 5xx (1 là E-tkt-015 cố ý dựng, 1 là BUG-tkt-002) |
| Hồi quy `npm test` toàn backend | 1160 test · 1132 đạt · 15 lỗi · 13 bỏ qua. Mốc trước Phase B: 1016 · 1012 · 4. 15 lỗi = 4 lỗi cũ + 11 của bộ mới |
| `npm run typecheck` | 0 lỗi |
| `eslint` file test mới | 0 lỗi, 40 cảnh báo (`any`, `console` — cùng kiểu bộ HTTP có sẵn `hrmSettingsShiftsHolidaysApi.test.ts`) |
| `npm audit --omit=dev` | 13 lỗ hổng thư viện nền (8 high, 5 moderate) — không do cụm này, xem ISSUE-tkt-005 |
| Xuất PDF (kiểm riêng) | Script gọi thẳng `dungFileToKhai`: file 136.520 byte, đầu `%PDF-1.4` — đạt ở mức hàm, chưa qua endpoint |

### 4.2 Theo nhóm

| Nhóm | Ca lá | Đạt | Lỗi | Ghi chú |
|---|---:|---:|---:|---|
| 1 — Danh mục loại thu nhập | 19 | 18 | 1 | TC-117 |
| 2 — Bản ghi thu nhập ngoài lương | 20 | 18 | 2 | TC-015, TC-021 (BUG-tkt-001) |
| 3–4 — Công thức 4 nhánh | 19 | 16 | 3 | TC-047 hai lượt (BUG-tkt-002), KR-08 (BUG-tkt-003) |
| 5 — Bảng tính thuế tháng | 14 | 13 | 1 | KR-11 (ISSUE-tkt-001) |
| 6–12 | 48 | 48 | 0 | |
| 13 — Không chạy tự động | 13 | — | — | Bỏ qua có lý do |
| **Tổng** | **133** | **113** | **7** | |

### 4.3 Các ca lỗi

| Ca | Kỳ vọng | Thực tế | Liên kết |
|---|---|---|---|
| TC-tkt-021 | `ma_nv` "NV9999" không tồn tại → 404 `E-tkt-016` | 409, không có `code`: "Dữ liệu đang được sử dụng ở nơi khác, không thể thực hiện" | BUG-tkt-001 |
| TC-tkt-015 | "nv0001" → 201, chuẩn hóa NV0001 | 409, cùng thông điệp trên | BUG-tkt-001 |
| TC-tkt-117 | Tạo danh mục khấu trừ tỷ lệ 100% → 400 | 201 (validator nhận 0–100) | BUG-tkt-002 |
| TC-tkt-047 (tính thử) | Tỷ lệ 100% + NET → 400 | 200, `grossAmount: null`, `taxDeducted: null`, giải thích "quy ngược thành ∞đ" | BUG-tkt-002 |
| TC-tkt-047 (ghi) | 400, không lưu | 500 "Lỗi máy chủ nội bộ"; không lưu dòng nào | BUG-tkt-002 |
| KR-tkt-08 | Nhãn phương pháp khớp số thuế | `isResident = false`: `taxDeductionType` FLAT_20 nhưng `taxRate` 10, thuế 600.000 trên 6.000.000 | BUG-tkt-003 |
| KR-tkt-11 | T8, NV0006: bảng tính thuế và engine lương cùng số thuế | Engine đếm 1 người phụ thuộc, thuế 165.000; bảng thuế đếm 0, thuế 475.000 | ISSUE-tkt-001 |

## 5. Ca đạt nhưng kiểm theo hợp đồng thay vì bộ ca

Hợp đồng là nguồn thẩm quyền cao hơn bộ ca (bộ ca viết trước khi có hợp đồng).

| Ca | Bộ ca ghi | Hợp đồng / hành vi đã kiểm |
|---|---|---|
| Toàn bộ | Đường `danh-muc-thu-nhap`, `thu-nhap-ngoai-luong`, `bang-tinh-thue/T9-2026/chot`, `to-khai-quy/2026/3/xuat`; trường `soTienChiTra`, `indicator`, `value`, `reason` | `income-categories`, `other-income`, `tax-calculation/lock` và `/unlock` (thân `periodId`), `05-kk-tncn/*` (`nam`, `quy`); trường `amount`; ghi đè `overrides: { ctXX: { gia, lyDo } }` |
| TC-003 | Thiếu cả tỷ lệ lẫn ngưỡng → 400 | Không gửi thì tự áp 10% / 5.000.000 (TC-001 đạt); gửi `null` tường minh → 400 `E-tkt-003` |
| TC-011 | `PATCH {status}` | Hợp đồng chỉ có `PUT` — kiểm bằng `PUT {status: "INACTIVE"}` |
| TC-044, 121 | Giả định chặn 400 | Chặn 400 `E-tkt-004`. `GAP-QA-tkt-01` vẫn treo — ca đạt theo hành vi tạm |
| TC-082 | 400 | 400 `E-tkt-017` |
| TC-113, 114 | 404 | Kỳ lương của tenant khác là "kỳ không tồn tại" → 400 `E-tkt-017`; danh mục/bản ghi của tenant khác → 404 `E-tkt-016`; không ghi vào DB nào (đã đếm dòng cả hai DB) |
| TC-117, 118 (từ lượt 2) | Chặn tỷ lệ 100% lúc tạo / chưa khẳng định tỷ lệ 0% | 201 — Mục 2.3 chỉ từ chối tỷ lệ ngoài `0..100` |
| Tính thử | "Mọi POST trả 201" | `POST /other-income/preview` không ghi gì → 200 |
| TC-069, 072 | Mở lại tháng | Bắt buộc `lyDo` ≥ 20 ký tự, thiếu thì 400 `E-tkt-011` (KR-15 đạt) |

## 6. Điểm trọng yếu đã kiểm và đạt

- **Bảng tính thuế T9 khớp số tính tay từng trường** cho 8 dòng (7 nhân viên + 1 vãng lai): TC-061 thuế 475.000 · TC-062 gộp đổi bậc 2.900.000 (riêng lương 2.400.000) · TC-064 thử việc 1.400.000 · TC-052b bảo hiểm 3.150.000 · KPI thuế tháng 6.175.000. Dòng không có khoản ngoài lương khớp engine lương (TC-065).
- **Số thấy lúc Nháp đúng bằng số đóng băng sau chốt** — so nguyên danh sách và KPI (TC-066).
- **17 chỉ tiêu quý III khớp số tính tay:** [16] = 7, [17] = 5 (lượt 1 là 8 và 6, trước khi đổi cách đếm), [18] = [19] = 6, [21] = [22] = 436.500.000, [26] = [27] = 406.500.000, [29] = [30] = 15.245.000, các chỉ tiêu còn lại = 0.
- **File Excel tờ khai** đủ mã [16]…[32], mã số thuế, tên người nộp, kỳ, người ký, số [29]; tải lại file trùng từng ký tự với file lúc xuất; có `Cache-Control: no-store, private`.
- **Đua dữ liệu:** 2 lệnh chốt cùng lúc cho 1 thành công + 1 lỗi 409 `E-tkt-018`, không snapshot trùng · đọc quý đúng lúc mở lại tháng không để lại dòng tờ khai treo · xuất quý đúng lúc mở lại tháng không để lại tờ khai "đã xuất" nửa vời · double-click tạo khoản cho 1 bản 201 + 1 bản 409 `E-tkt-005`.
- **Chống trùng vãng lai** không phân biệt hoa/thường kể cả chữ có dấu ("PHẠM VĂN ĐÔI" trùng "Phạm Văn Đôi").
- **Trần miễn thuế theo năm tính lũy kế:** T10 chi 3.000.000 miễn hết, T11 chi tiếp 3.000.000 chỉ còn miễn 2.000.000.
- **Nhật ký kiểm toán:** chốt ghi `HRM_TAX_SHEET_LOCKED` kèm số dòng, lệnh thua cuộc không ghi; mở lại ghi `HRM_TAX_SHEET_UNLOCKED` kèm lý do.
- **Phân quyền:** 401 khi không đăng nhập ở 7 nhóm endpoint · 403 `E-tkt-014` cho người không có quyền xem lương kể cả thao tác đọc · kế toán không phải ADMIN/OWNER bị chặn đúng 4 thao tác mức 2 (mở lại, xuất, tải file, đánh dấu nộp) và làm được CRUD, chốt tháng, bảng chi tiết.
- **Hạ tầng:** tenant chưa nạp chính sách thuế trả 500 `E-tkt-015` kèm hướng dẫn `hrm:seed-thue` · kỳ không có nhân viên vẫn chốt được với 0 dòng.

## 7. Quan sát cần người quyết

- ~~KR-tkt-03: người không có thu nhập được đếm ở [16]/[17]~~ — đã quyết ở ISSUE-tkt-002: bảng tháng giữ dòng 0 đồng, tờ khai không đếm. Dòng 0 đồng vẫn hiện giảm trừ bản thân 15.500.000 (chỉ hiển thị, thuế = 0).
- **KR-tkt-19 (vẫn mở — ISSUE-tkt-003):** mở lại một tháng khi quý đang sẵn sàng xuất thì mất các ghi đè kế toán đã nhập; chốt lại, ghi đè về rỗng. Lượt 2 vẫn như vậy.
- ~~TC-tkt-118: tỷ lệ 0% được nhận~~ — đóng theo hợp đồng Mục 2.3.
- TC-tkt-084, KR-tkt-21: kết quả đua phụ thuộc thứ tự thực thi (Mục 3.5).

## 8. Ca không chạy tự động qua API

| Mã | Lý do | Cách phủ |
|---|---|---|
| TC-052, 053, 054 | Ngoài phạm vi từ 2026-09-14 (P-17) | Thay bằng TC-052b (đạt) |
| TC-104 | Đối chứng ngoài phạm vi (thu nhập từ 2 công ty) | Gián tiếp qua TC-113, 114 |
| TC-105 | Đối chứng ngoài phạm vi (khai bổ sung) | Khóa vĩnh viễn sau xuất: TC-071, 090, 091 đạt |
| TC-107 | Tenant kiểm thử không có dữ liệu quý I/II kiểu cũ | Cần bản sao DB thật — **chưa chạy** |
| TC-109 | Tham chiếu | TC-020 đạt |
| TC-115 | Rà mã, không phải hành vi API | **Đạt:** `to_khai_thue` chỉ gọi `getPayrollSheetLines`, `tinhThueLuyTien`, `laHopDongKhauTruTaiNguon` của engine lương; không có tỷ lệ bảo hiểm hay biểu thuế nào chép lại trong `services/client/hrm/to_khai_thue/` |
| TC-116 | Giao diện | Frontend đang tạm ngừng |
| TC-124 | Việc làm đầu Phase B | Đã làm trong file test |
| TC-125, 126 | Việc tài liệu Phase A đã xong | — |
| Nhánh `format=pdf` của TC-078 | Puppeteer giữ tiến trình test sống | Script dựng PDF đạt ở mức hàm; **chưa kiểm qua endpoint** |

---

## 9. Phase B giao diện — `hdđt_maxv` (2026-09-16)

**Phạm vi:** 4 màn của khu Tờ khai thuế sau đợt viết lại theo hợp đồng 23 endpoint. Kiểm THEO MÃ NGUỒN (đối chiếu hợp đồng, SRS, bộ ca Phase A) cộng ba lệnh kiểm tự động; CHƯA kiểm trên trình duyệt đã đăng nhập.

**Cách chạy:** hai lượt rà độc lập — một lượt đối chiếu từng endpoint với hợp đồng, một lượt rà hồi quy và quy ước khu HRM.

### 9.1 Kết quả tổng

| Hạng mục | Kết quả |
|---|---|
| `npx tsc -b --noEmit` | 0 lỗi |
| `npx eslint .` (toàn ứng dụng) | 0 lỗi, 0 cảnh báo |
| `npm run build` | thành công, 4 chunk màn sinh đủ |
| 50 ca kiểm tĩnh `TC-fe-tkt-001…050` | 44 đạt · 6 lỗi (1 🔴, 3 🟡, 2 🟢) |
| Đối chiếu 23 endpoint (đường dẫn, tham số, thân yêu cầu, kiểu phản hồi) | Khớp 100%, không chỗ nào gửi thừa tham số ngoài nhóm |

### 9.2 Điểm đã kiểm và đạt

- Ba endpoint trả file nhị phân đi qua `apiFetchBlob`, hai endpoint trả 204 đi qua `apiFetch` — không vướng bước bóc `data`.
- Ràng buộc nhập liệu khớp máy chủ: lý do mở lại ≥ 20 ký tự, lý do ghi đè ≥ 10 ký tự, ngày chi trả trong tháng của kỳ, `ma_nv` bắt buộc với nhóm khác `WITHHOLDING_FLAT`, mã số thuế bắt buộc khi có cam kết 08, số tiền luôn nguyên không âm.
- Bốn trạng thái tờ khai mở đúng bộ nút; cờ `periodLocked`, `coTheChot`, `coTheMoLai` dùng đúng.
- Mọi nhánh lỗi dùng `getErrorMessage`, không nuốt mã `E-tkt-*`; nhánh 500-sau-khi-đã-xuất hướng người dùng sang nút tải lại file.
- Làm mới cache đủ ba nhóm khóa sau mỗi lệnh ghi; xuất tờ khai làm mới thêm nhóm bảng tính thuế vì `coTheMoLai` đổi.
- Ba cảnh báo của SRS Mục 14 đã hết: không còn ngưỡng 2.000.000 và biểu 7 bậc chép cứng, danh mục lấy từ API, chỉ tiêu sửa được lấy từ `ctGocSuaDuoc`, kỳ khai chỉ còn theo quý.
- Hồi quy: không còn nơi nào gọi khóa truy vấn theo chữ ký cũ; 6/6 tab đều có route; hai thay đổi ở file dùng chung (`apiClient.ts`, `types/index.ts`) là thêm mới, 17 lời gọi `api.del()` cũ không ảnh hưởng. Không màn HRM nào khác bị tác động.

### 9.3 Lỗi phát hiện

Chi tiết từng lỗi ở `issues-and-bugs-to-khai-thue.md` mục "Phase B giao diện": `BUG-fe-tkt-001` (🔴 bấm hai lần nút Xuất tờ khai) · `BUG-fe-tkt-002` (🟡 thiếu khóa nút theo quyền ADMIN/OWNER) · `BUG-fe-tkt-003` (🟡 xuất Excel chỉ ra trang đang xem) · `BUG-fe-tkt-004` (🟡 hai route thừa `bang-tinh-thue-hdld`/`hddv`) · `BUG-fe-tkt-005` (🟢 cam kết 08 không phụ thuộc nhóm danh mục) · `BUG-fe-tkt-006` (🟢 trường chết `laChiTieuGoc`).

### 9.4 Ca KHÔNG kiểm được bằng đọc mã

| Việc | Cần gì |
|---|---|
| Bấm hai lần thật trên nút Xuất tờ khai và Chốt tháng | Trình duyệt đã đăng nhập, xem tab Network |
| Tên file tải về so với `Content-Disposition` thật | Chạy thật với máy chủ |
| Nhánh `TAXABLE_FULL` trả NET (`GAP-QA-tkt-01` còn treo) | Máy chủ thật, xem `preview` trả gì |
| Phân quyền thật theo từng vai | Tài khoản cho từng vai |
| Độ trễ render PDF qua Puppeteer | Chạy thật |

### 9.5 Kết luận

Chưa chuyển code-reviewer khi `BUG-fe-tkt-001` còn mở — đó là hành động không lùi được. Ba lỗi 🟡 nên sửa cùng đợt. Các mục 🟢 có thể gộp chung hoặc để lại thành việc riêng.

### 9.6 Sửa lỗi và chạy lại (cùng ngày)

Đã sửa 5/6 lỗi ngay trong đợt: BUG-fe-tkt-001 (🔴), 002 và 003 (🟡), 005 và 006 (🟢). Còn
BUG-fe-tkt-004 (hai route thừa) giữ OPEN, chờ chủ dự án xác nhận có định tách bảng theo loại hợp đồng.

Dọn thêm cùng lượt: bỏ 4 hook, 4 hàm API, 4 khóa truy vấn và 2 kiểu dữ liệu chưa màn nào dùng; sửa
chú thích lỗi thời ở màn "đang phát triển"; khóa danh sách cảnh báo theo nội dung thay vì chỉ số mảng.

Chạy lại sau khi sửa: `npx tsc -b --noEmit` 0 lỗi · `npx eslint .` 0 lỗi 0 cảnh báo · `npm run build`
thành công. Các lỗi 🔴 và 🟡 của mục 9.3 đã đóng; phần giao diện sẵn sàng cho code-reviewer, trừ điểm
còn chờ quyết ở BUG-fe-tkt-004.
