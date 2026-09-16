---
type: api-contract
feature: to-khai-gtgt01
status: in-review
updated: 2026-09-16
links:
  - docs/to-khai-gtgt01/CONTEXT_SUMMARY.md
  - docs/to-khai-gtgt01/srs/to-khai-gtgt01-spec.md
  - docs/to-khai-gtgt01/srs/to-khai-gtgt01-flows.md
  - docs/to-khai-gtgt01/kien-truc-to-khai-gtgt01.md
  - docs/to-khai-gtgt01/architecture/adr/ADR-001-chi-tiet-hoa-don-theo-ky.md
---

# Tờ khai 01/GTGT — API contract đợt 2026-09-16

Chỉ ghi phần THAY ĐỔI của đợt này. Các endpoint khác của mô-đun giữ nguyên như code hiện tại
(`be_maxv/src/routes/to_khai/toKhai.route.ts`).

## 1. Quy ước chung của mô-đun (đã có, không đổi)

| Hạng mục | Giá trị | Bằng chứng |
|---|---|---|
| Prefix | `/api/v1/to-khai` | `be_maxv/src/routes/index.route.ts:57` |
| Ứng dụng gọi | `hdđt_maxv` (`src/features/to_khai/api/toKhai.ts`) | — |
| Auth | Bearer JWT (`fastify.authenticate`) | `toKhai.route.ts:30` |
| Guard gói | `requireModule("tokhai")` | `toKhai.route.ts:30` |
| Tenant | DB của công ty đang chọn (`resolveTenantDb`) | `keKhaiKy.controller.ts:94` |
| Token GDT | KHÔNG cần — mọi route chỉ đọc/ghi DB tenant | `toKhai.route.ts:21-26` |
| Envelope thành công | Payload trần, KHÔNG bọc `{ success, data }` | `keKhaiKy.controller.ts:98` |
| Envelope lỗi do controller | `{ "message": string }`, thêm `"code"` khi FE cần rẽ nhánh (`da_chot`, `dang_ke_khai`) | `keKhaiKy.controller.ts:50,56,58` |
| Envelope lỗi do guard | `{ "success": false, "message": string }` (401/403) | `plugins/errorHandler.plugin.ts` |

## 2. Endpoint MỚI — bảng kê của kỳ kèm chi tiết từng hóa đơn

Phục vụ FR-to-khai-gtgt01-001..004, 006; BR-to-khai-gtgt01-001, 005, 006; NFR-to-khai-gtgt01-002.
Lý do chọn hình dạng này: xem ADR-001.

### 2.1. Định danh

| Hạng mục | Giá trị |
|---|---|
| Method | `GET` |
| Endpoint | `/api/v1/to-khai/hoa-don/chi-tiet` |
| Auth | Bearer JWT |
| Authorization | `requireModule("tokhai")`; dữ liệu giới hạn trong DB tenant của công ty đang chọn |
| Rate limit | `gioiHanTheoNguoiDung(20, "1 minute")` — cùng mức `/gtgt01/tinh` (đọc toàn bộ hóa đơn của kỳ vào RAM) |
| Idempotency | GET chỉ đọc, gọi lại bao nhiêu lần cũng không đổi dữ liệu |
| Pagination / filter / sort | Không có. Trả TOÀN BỘ hóa đơn của kỳ + chiều (AC-to-khai-gtgt01-002 cần đủ, không theo trang) |

### 2.2. Request — query string

| Tham số | Kiểu | Bắt buộc | Validation (dùng lại `controllers/client/to_khai/docThamSo.ts`) |
|---|---|---|---|
| `nam` | số nguyên | Có | `docKy` → `kyHopLe` |
| `kyLoai` | `"thang"` \| `"quy"` | Có | `docKy` → `kyHopLe` |
| `kySo` | số nguyên (1-12 nếu tháng, 1-4 nếu quý) | Có | `docKy` → `kyHopLe` |
| `chieu` | `"purchase"` \| `"sold"` | Có | `docChieu` |

Ví dụ: `GET /api/v1/to-khai/hoa-don/chi-tiet?nam=2026&kyLoai=quy&kySo=3&chieu=sold`

### 2.3. Response 200

Hình dạng = đúng response của `GET /to-khai/hoa-don` (`{ total, datas, thayThe }`), mỗi phần tử
`datas` có thêm đúng một field `chiTiet`.

| Field | Kiểu | Ý nghĩa |
|---|---|---|
| `total` | number | Số hóa đơn trong bảng kê = `datas.length` |
| `datas[]` | object | Một hóa đơn của bảng kê — y hệt phần tử `datas` của `GET /to-khai/hoa-don` (các field `SavedInvoiceRow` + `keKhai` + `chiTieuTangGiam`) |
| `datas[].chiTieuTangGiam` | `""` \| `"37"` \| `"38"` | Đã diễn giải dữ liệu cũ, xem Mục 3.3 |
| `datas[].chiTiet` | object \| `null` | Payload chi tiết GDT gốc của CHÍNH hóa đơn đó (có mảng hàng hóa `hdhhdvu`), các field ngày đã qua `normalizeDetailDates`. `null` = hóa đơn chưa tải chi tiết |
| `thayThe[]` | `ReplacementRow[]` | Như `GET /to-khai/hoa-don` — FE dựng `buildReplacedByMap` cho cả hai sheet |

```json
{
  "total": 2,
  "datas": [
    {
      "id": "3f6c1a0e-...",
      "khmshdon": "1",
      "khhdon": "C26TAA",
      "shdon": "1024",
      "tdlap": "2026-07-15T00:00:00",
      "nbmst": "0312345678",
      "nbten": "CÔNG TY A",
      "nmmst": "0109876543",
      "nmten": "CÔNG TY B",
      "dvtte": "VND",
      "tgia": 1,
      "tgtcthue": 1000000,
      "tgtthue": 100000,
      "tgtttbso": 1100000,
      "tthai": "1",
      "ttxly": "5",
      "tt_tai": "OK",
      "msttcgp": "0101300842",
      "tenHang": "Dịch vụ tư vấn",
      "keKhai": true,
      "chiTieuTangGiam": "38",
      "chiTiet": {
        "khmshdon": 1,
        "khhdon": "C26TAA",
        "shdon": 1024,
        "tdlap": "2026-07-15T00:00:00",
        "nbmst": "0312345678",
        "tthai": 1,
        "hdhhdvu": [
          { "ten": "Dịch vụ tư vấn", "dvtinh": "Gói", "sluong": 1, "dgia": 1000000, "thtien": 1000000, "ltsuat": "10%" }
        ]
      }
    },
    {
      "id": "8b21d7c4-...",
      "khmshdon": "1",
      "khhdon": "C26TBB",
      "shdon": "77",
      "tdlap": "2026-07-15T00:00:00",
      "tthai": "1",
      "tt_tai": null,
      "keKhai": false,
      "chiTieuTangGiam": "",
      "chiTiet": null
    }
  ],
  "thayThe": []
}
```

Kỳ/chiều chưa có hóa đơn nào được gán: `200 { "total": 0, "datas": [], "thayThe": [] }` — không
phải 404 (BR-to-khai-gtgt01-005).

### 2.4. Bất biến backend phải giữ (QA kiểm theo đây)

1. **Cùng tập hóa đơn (BR-to-khai-gtgt01-001).** `layBangKeChiTietTheoKy` (`keKhaiKy.service.ts:593`)
   lấy tập và thứ tự `datas` bằng cách GỌI `layBangKeTheoKy(db, ky, chieu)` (`keKhaiKy.service.ts:518`),
   không lọc lại, không lọc thêm. Tập
   hóa đơn chỉ được định nghĩa ở đúng một chỗ đó; endpoint này chỉ đọc thêm cột `detail` theo `id` của
   các hóa đơn nó đã trả.
2. **Không thừa, không thiếu.** Mỗi phần tử `datas` đều có key `chiTiet` (object hoặc `null`). Không có
   chi tiết nào của hóa đơn nằm ngoài `datas`.
3. **Ghép chi tiết theo định danh hóa đơn, không theo vị trí.** BE gắn `detail` vào dòng theo `id`
   (`vct50view`/`vct60view`, tương đương khóa unique mẫu số + ký hiệu + số + MST người bán). Không có
   truy vấn thứ hai mà thứ tự cần khớp.
4. Đọc `detail` theo lô id (`locChiTietTheoId`, `CO_LO_DOC_DETAIL = 1000`, dùng `chiaLo`), không truyền
   cả danh sách id vào một `IN` (trần 65.535 tham số của Postgres).
5. Không trần khoảng ngày. Tập đã giới hạn bởi kỳ (tối đa 1 quý), luôn nhỏ hơn trần 366 ngày của
   `/gdt/invoices/:direction/saved-details` (`gdt.controller.ts:66`). Vì vậy
   **E-to-khai-gtgt01-002 / AC-to-khai-gtgt01-005 không phát sinh**.
6. `GET /to-khai/hoa-don` không đổi gì ngoài diễn giải giá trị ở Mục 3.3 (NFR-to-khai-gtgt01-002).

### 2.5. Lỗi

| HTTP | Khi nào | Body |
|---|---|---|
| 400 | `nam`/`kyLoai`/`kySo` sai hoặc thiếu | `{ "message": "Kỳ kê khai không hợp lệ (kiểm tra lại loại kỳ, số kỳ và năm)." }` |
| 400 | `chieu` sai hoặc thiếu | `{ "message": "Chiều hóa đơn không hợp lệ (chỉ nhận purchase hoặc sold)." }` |
| 400 | Lỗi khi đọc dữ liệu (DB…) | `{ "message": "Không đọc được chi tiết hóa đơn của kỳ." }` (qua `thongDiepLoiAnToan`, cùng mẫu `bangKeTheoKy`) |
| 401 | Thiếu/hết hạn JWT | `{ "success": false, "message": ... }` |
| 403 | Gói không có mô-đun `tokhai` / không có quyền công ty | `{ "success": false, "message": ... }` |
| 429 | Quá 20 lượt/phút/người dùng | Body mặc định của `@fastify/rate-limit` (`statusCode`, `error`, `message` tiếng Anh) |

### 2.6. Cách FE dùng khi xuất Excel (bắt buộc để khớp FR)

1. Bấm "Xuất Excel": khóa nút ngay (FR-to-khai-gtgt01-005), chụp `ky` tại thời điểm bấm.
2. Gọi **2 lượt song song** — `chieu=purchase` và `chieu=sold`. KHÔNG gọi thêm `GET /to-khai/hoa-don`:
   sheet "HĐ..." và sheet "Chi tiết..." của một chiều cùng lấy từ MỘT response nên không thể lệch tập.
3. Chỉ dựng workbook khi CẢ HAI lượt thành công. Một lượt lỗi thì hủy, không tải file, toast nêu đúng
   chiều bị lỗi, ví dụ "Không tải được dữ liệu hóa đơn bán ra: <message BE>" (E-to-khai-gtgt01-001).
   Mở khóa nút trong `finally`.
4. Thứ tự sheet: "01-GTGT", "PL 204-2025" (nếu có), "HĐ mua vào", "HĐ bán ra", "Chi tiết mua vào",
   "Chi tiết bán ra" (FR-to-khai-gtgt01-001).
5. Sheet "HĐ...": `rows` = `datas` ánh xạ sang `ToKhaiRow` bằng CÙNG hàm với `BangKeMotChieu`, giữ
   nguyên thứ tự BE, không lọc/sắp xếp; cột `overviewToKhai(chieu)`; STT = vị trí trong `rows` (1-based).
6. Sheet "Chi tiết...": cột "STT" đặt ĐẦU (STT của hóa đơn cha, cùng một số cho mọi dòng hàng của 1
   hóa đơn), sau đó là nguyên `detailColumns(chieu)` của HĐĐT — không sửa `detailColumns`/module HĐĐT;
   `rows.flatMap((r, i) => toDetailRows(datas[i].chiTiet ?? datas[i], i + 1, replacedBy, ...))`
   — STT dòng chi tiết = STT dòng cha ở sheet "HĐ..." vì cùng phần tử trong cùng response
   (FR-to-khai-gtgt01-004, AC-to-khai-gtgt01-007). Hóa đơn `chiTiet === null` vẫn ra đúng 1 dòng: thông
   tin hóa đơn lấy từ dòng bảng kê, các cột hàng hóa để trống (FR-to-khai-gtgt01-011,
   AC-to-khai-gtgt01-014).
7. Chiều không có hóa đơn: vẫn gọi `addStyledSheet` với `rows = []` → sheet có đủ tiêu đề cột
   (FR-to-khai-gtgt01-006).

## 3. Thay đổi tập giá trị `chiTieuTangGiam`

Phục vụ FR-to-khai-gtgt01-007..010, BR-to-khai-gtgt01-002..004, E-to-khai-gtgt01-003.

### 3.1. Tập giá trị

| Mã | Nhãn FE | Nghĩa | Trước đây |
|---|---|---|---|
| `""` | — | Chưa chọn / xóa lựa chọn | `""` |
| `"37"` | 37 — Giảm | Khớp chỉ tiêu [37] Điều chỉnh giảm | `"giam"` |
| `"38"` | 38 — Tăng | Khớp chỉ tiêu [38] Điều chỉnh tăng | `"tang"` |

Chỉ là nhãn per-hóa đơn. Không đọc trong `tinhGtgt01`, không ảnh hưởng `ct37`/`ct38` (BR-to-khai-gtgt01-002).

### 3.2. `PATCH /api/v1/to-khai/hoa-don/:chieu/:id` — không đổi hình dạng

Method, path, auth, guard, body `{ keKhai?, chiTieuTangGiam?, ghiChu? }`, response `200 { "ok": true }`,
lỗi 400/409 `da_chot` giữ nguyên (`keKhaiKy.controller.ts:137`). Chỉ đổi whitelist trong
`locQuyetDinh` (`keKhaiKy.service.ts:397`):

| `chiTieuTangGiam` gửi lên | Kết quả |
|---|---|
| `""` | Lưu `NULL` |
| `"37"` / `"38"` | Lưu nguyên mã |
| `"tang"`, `"giam"`, giá trị lạ, sai kiểu | Bỏ field khỏi phần cập nhật, giá trị đã lưu giữ nguyên; field hợp lệ khác vẫn lưu; vẫn `200 { "ok": true }` |

Hệ quả của code hiện có (không đổi đợt này): payload CHỈ có giá trị không hợp lệ → `locQuyetDinh` trả
`{}` → `capNhatQuyetDinh` thoát sớm → `200 { "ok": true }`, không kiểm hóa đơn đã gán kỳ hay kỳ đã
chốt (`keKhaiKy.service.ts:423`).

### 3.3. Diễn giải dữ liệu cũ khi đọc

- Chỗ duy nhất: `layBangKeTheoKy` (`keKhaiKy.service.ts:542`), thông qua `dienGiaiChiTieuTangGiam`
  (`keKhaiKy.service.ts:368`, cạnh type `ChiTieuTangGiam` ở `:360`): `"tang"` → `"38"`, `"giam"` → `"37"`,
  `null`/`undefined` → `""`, giá trị khác giữ nguyên.
- Cả `GET /to-khai/hoa-don` lẫn `GET /to-khai/hoa-don/chi-tiet` đều đi qua chỗ này nên cùng kết quả.
- Không UPDATE DB, không migration: cột `chi_tieu_tang_giam VarChar(32)` không có CHECK
  (`be_maxv/prisma/tenant/schema.prisma:757`).
- Bản ghi cũ chỉ chuyển sang mã mới khi kế toán lưu một giá trị KHÁC giá trị đang hiển thị.

## 4. Vị trí triển khai

| # | File | Việc |
|---|---|---|
| B1 | `be_maxv/src/services/client/to_khai/application/keKhaiKy.service.ts:360,397` | Type + whitelist `"" \| "37" \| "38"` (đã làm) |
| B2 | cùng file `:368`, dùng ở `:542` | `dienGiaiChiTieuTangGiam`: `tang→38`, `giam→37` (đã làm) |
| B3 | cùng file `:556` (`locChiTietTheoId`), `:593` (`layBangKeChiTietTheoKy`) | Gọi `layBangKeTheoKy` rồi gắn `chiTiet` theo `id` (Mục 2.4) (đã làm) |
| B4 | `be_maxv/src/controllers/client/to_khai/keKhaiKy.controller.ts:113` | Handler `bangKeChiTietTheoKy`, cùng mẫu `bangKeTheoKy` (đã làm) |
| B5 | `be_maxv/src/routes/to_khai/toKhai.route.ts:47-51` | `fastify.get("/hoa-don/chi-tiet", { preHandler: guard(), ...gioiHanTheoNguoiDung(20, "1 minute"), handler: bangKeChiTietTheoKy })` (đã làm) |
| B6 | `be_maxv/src/__tests__/to_khai/quyetDinhKeKhai.test.ts:14-15` | Đổi literal sang `"37"`; thêm ca `"tang"`/`"giam"` bị loại; thêm test helper diễn giải |
| F1 | `hdđt_maxv/src/features/to_khai/ky.ts:7` | Type `"" \| "37" \| "38"` |
| F2 | `hdđt_maxv/src/features/to_khai/components/OQuyetDinh.tsx:22-26` | Options "—", "37 — Giảm", "38 — Tăng" |
| F3 | `hdđt_maxv/src/features/to_khai/templates/cotBangKe.ts:113-117` | Sửa comment `"tang"/"giam"` |
| F4 | `hdđt_maxv/src/features/to_khai/api/toKhai.ts` sau `:58` | Type response + hàm gọi endpoint mới |
| F5 | `hdđt_maxv/src/features/hddt/exportXlsx.ts:89` | Thêm `export` cho `addStyledSheet` (không đổi thân hàm) |
| F6 | `hdđt_maxv/src/features/to_khai/components/bang_ke/BangKeMotChieu.tsx:53-63` | Tách ánh xạ `datas → ToKhaiRow[]` thành hàm thuần dùng chung với Excel |
| F7 | `hdđt_maxv/src/features/to_khai/xuatToKhaiExcel.ts:104-173` | Tải 2 lượt, thêm 4 sheet theo Mục 2.6 |
| F8 | `hdđt_maxv/src/features/to_khai/components/ToKhaiGtgt01Editor.tsx:178-183,387-391` | State đang xuất, khóa nút, mở khóa trong `finally` |

`addStyledSheet` hiện chỉ có 2 lượt gọi trong chính file (`exportXlsx.ts:260,264`); thêm `export`
không đổi hành vi của `buildSummaryWorkbookBuffer`/`exportBundle`. File `.ts` nên không vướng luật
`react-refresh/only-export-components`.

## 5. Các điểm đã chốt

| ID | Câu hỏi | Kết quả |
|---|---|---|
| OQ-arch-001 | Hóa đơn có trong bảng kê nhưng `chiTiet === null` (chưa tải chi tiết) thể hiện thế nào ở sheet "Chi tiết..."? | **ĐÃ CHỐT** (user, 2026-09-16): vẫn có đúng 1 dòng, thông tin hóa đơn lấy từ dòng bảng kê, cột hàng hóa trống — FE gọi `toDetailRows(datas[i].chiTiet ?? datas[i], ...)`, không đổi contract. Spec: FR-to-khai-gtgt01-011 / AC-to-khai-gtgt01-014 |
| OQ-arch-002 | Luồng xuất 2 lượt thay vì 4; cách ghép STT; AC-to-khai-gtgt01-005 | **ĐÃ XỬ LÝ** (BA sign-off, 2026-09-16): `flows.md` sửa còn 2 lượt gọi; FR-to-khai-gtgt01-004 viết lại theo vị trí trong cùng response; AC-to-khai-gtgt01-005 / E-to-khai-gtgt01-002 đánh N/A |
| — | Bộ cột sheet "Chi tiết..." | **ĐÃ CHỐT** (đính chính theo RVW-T12): cột "STT" đặt đầu (STT hóa đơn cha, cùng số cho mọi dòng hàng của 1 hóa đơn — FR-to-khai-gtgt01-004 / AC-to-khai-gtgt01-007) + nguyên `detailColumns(direction)` của HĐĐT phía sau; không sửa `detailColumns`/module HĐĐT |
