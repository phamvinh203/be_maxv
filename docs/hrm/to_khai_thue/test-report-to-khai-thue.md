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

Kiểm định động 23 endpoint của sub-cụm. **Lượt 1** chạy trên commit `11e2ab1`, tìm 3 lỗi sản phẩm và 2 vấn đề cần quyết. Chủ dự án chốt 3 quyết định, backend sửa (chưa commit); **lượt 2** chạy lại toàn bộ lúc 13:51 ngày 2026-09-15. Mọi con số dưới đây do chính phiên này chạy lại, không dùng số tự báo cáo.

## 1. Phạm vi và cách chạy

- **Bộ kiểm thử:** `be_maxv/src/__tests__/hrm/hrmToKhaiThueApi.test.ts` (mới, chưa commit). Gọi HTTP thật trong tiến trình bằng `app.inject`, đi trọn đường: hook đăng nhập, `requireModule('hrm')`, controller, validator, service, Postgres, errorHandler.
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

**Lượt 2 đạt cổng Phase B.** 120/120 ca lá đạt, 0 lỗi, 13 bỏ qua có lý do (Mục 8). Hồi quy toàn backend chỉ còn đúng 4 lỗi cũ có từ trước Phase B. Cả 5 điểm của lượt 1 đã đóng (chi tiết ở `issues-and-bugs-to-khai-thue.md`).

Còn mở, không chặn: ISSUE-tkt-003 (mở lại tháng xóa ghi đè chỉ tiêu) · ISSUE-tkt-005 (`npm audit`) · TC-tkt-107 và nhánh xuất PDF qua endpoint chưa chạy · mã lỗi chọn cho hợp đồng Mục 3.4 dòng 4b/5c chờ Architect xác nhận. Bước tiếp theo: code-reviewer.

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
