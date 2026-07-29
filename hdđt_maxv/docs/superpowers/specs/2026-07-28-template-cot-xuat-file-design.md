# Thiết kế — Folder `templates/`: nguồn khai báo cột duy nhất cho bảng và file xuất

**Ngày:** 2026-07-28
**Phạm vi:** `hdđt_maxv` (frontend hóa đơn điện tử)
**Trạng thái:** đã duyệt thiết kế, chờ lập kế hoạch triển khai

## 1. Vấn đề

Cùng một khái niệm cột hóa đơn đang được khai báo lại ở bốn nơi độc lập:

| Nơi khai báo | Số cột | Dùng cho |
|---|---|---|
| `components/InvoiceListTabs.tsx` → `columnsFor(direction)` | 22 (kể cả "Chọn") | Bảng Tổng quát trên web |
| `components/InvoiceDetailPanel.tsx` → `DETAIL_COLUMNS` | 27 | Bảng Chi tiết trên web |
| `exportXlsx.ts` → `overviewColumns(direction)`, `detailColumns()` | 21 + 27 | Hai sheet Excel |
| `exportInvoices.ts` → `backupColumns()` | 14 | CSV sao lưu |

Không có ràng buộc nào giữ chúng khớp nhau. Tài liệu đã lường trước rủi ro này — chương 11 mục 11.5 ghi: *"Cột Excel và cột bảng trên màn hình là hai danh sách riêng biệt. Thêm cột vào bảng mà quên thêm vào Excel là lỗi thường gặp nhất khi mở rộng tính năng này."* Chương 13 mục 13.2 phải liệt kê một quy trình 5 bước thủ công để thêm một cột.

Rủi ro đó đã thành lỗi thật, mô tả ở mục 3.

## 2. Mục tiêu

1. Mỗi cột được khai báo **đúng một lần**, ở một folder `templates/` riêng.
2. Bảng trên web và file Excel/CSV render từ cùng danh sách đó, nên không thể lệch nhau nữa.
3. Sửa hai lỗi dữ liệu hiện có (mục 3) như một phần của việc gom — chúng chính là lý do phải gom.

### Ngoài phạm vi

- `invoiceHtml.ts`, `invoiceXml.ts`, luồng render PDF. Tờ hóa đơn là bố cục pháp lý cố định theo mẫu Tổng cục Thuế, không phải danh sách cột tùy biến; nó đã tự gom sẵn quanh `InvoiceView` và không chia sẻ abstraction nào với cột bảng. Gộp chung chỉ vì "đều là file xuất ra" là gom nhầm.
- Màn hình cho người dùng tự chọn/kéo thả cột. Có thể làm sau trên nền `templates/`, không làm bây giờ.
- Đọc file `.xlsx` mẫu lúc runtime. Đã cân nhắc và loại: nặng, git không diff được file nhị phân, và chưa có nhu cầu để kế toán tự sửa bố cục.

## 3. Hai lỗi dữ liệu phải sửa kèm

> **Cập nhật 2026-07-28 (sau khi đã triển khai):** quyết định ở mục 3.1/3.2 đã được đổi giữa chừng
> theo yêu cầu — chiều bán ra hiển thị **bên bán** (MST, Tên công ty, Địa chỉ) chứ không phải người
> mua. Xem mục 9 ở cuối tài liệu. Phần 3.1/3.2 dưới đây giữ nguyên vì nó mô tả đúng lỗi đã tìm ra.

### 3.1. Cột đối tác ở chiều bán ra — sheet Tổng quát

`invoiceRow.ts:25` map theo chiều:

```ts
sellerMst: isPurchase ? r.mstDoiTac : ownMst,   // bán ra -> MST công ty mình
buyerMst:  isPurchase ? ownMst : r.mstDoiTac,   // bán ra -> MST khách hàng
```

Quy tắc nghiệp vụ đã được ghi rõ trong JSDoc của `columnsFor` (`InvoiceListTabs.tsx:89`): *"mua vào hiện NGƯỜI BÁN; bán ra hiện NGƯỜI MUA — vì bên 'mình' đã là công ty đang chọn, đối tác mới là thông tin cần xem."*

Web tuân thủ quy tắc đó. Excel thì không:

| | Header | Lấy field | Kết quả ở chiều bán ra |
|---|---|---|---|
| Web (`columnsFor`, sold) | "MST người mua" | `r.buyerMst` | MST khách hàng — đúng |
| Excel (`overviewColumns`, sold) | "MST người xuất hàng" | `r.sellerMst` | MST công ty mình, lặp y hệt mọi dòng — sai |

Áp dụng cho cả cặp MST và Tên. File `Tong-hop-dau-ra-*.xlsx` hiện có hai cột vô dụng.

**Sửa:** chiều `sold` dùng header "MST người mua"/"Tên người mua", lấy `r.buyerMst`/`r.buyerTen`. Chiều `purchase` giữ nguyên (đang đúng).

### 3.2. Cột người bán ở chiều bán ra — sheet Chi tiết

`detailRow.ts:62` map cứng `sellerMst: s(detail.nbmst)`, và `toDetailRows` **không nhận tham số `direction`**. `DetailRow` không có field người mua nào. Nên sheet "Chi tiết đầu ra" cũng lặp MST công ty mình ở mọi dòng — cùng loại lỗi.

**Sửa:**
- `DetailRow` thêm `buyerMst`, `buyerTen`, map từ `detail.nmmst`, `detail.nmten` (hai tên field này đã có trong bản đồ ánh xạ ở JSDoc `toInvoiceView`, chương 11 mục 11.2).
- `toDetailRows(detail, direction)` nhận thêm `direction`.
- `detailColumns(direction)` chọn cặp cột đúng theo chiều, giống sheet Tổng quát.

Hai nơi gọi `toDetailRows` đều đã có `direction` trong tầm nhìn, sửa rẻ:
- `exportBundle.ts:143` — `details.flatMap(toDetailRows)` → `details.flatMap((d) => toDetailRows(d, direction))`
- `InvoiceListTabs.tsx:226` — tương tự, `direction` là prop của panel

### 3.3. Lệch nhỏ khác, sửa luôn khi gom

- `InvoiceDetailPanel.tsx:28` ghi comment "26 cột" nhưng khai 27 — dấu vết của việc sửa một bên quên bên kia.

## 4. Kiến trúc

### 4.1. Folder

```
src/features/hddt/templates/
├── types.ts             InvoiceColumn<T>, hằng số style, renderCell()
├── overviewColumns.ts   overviewColumns(direction)
├── detailColumns.ts     detailColumns(direction)
├── backupColumns.ts     backupColumns()
└── index.ts             re-export
```

### 4.2. Interface cột

Một interface phục vụ nhiều kênh: kênh nào cần thuộc tính gì thì đọc thuộc tính đó.

```ts
export interface InvoiceColumn<T> {
  /** Khóa ổn định — React key, tra cứu. KHÔNG đổi khi đổi tiêu đề. */
  key: string;
  header: string;
  /** Độ rộng cột Excel (đơn vị ký tự). Web bỏ qua. */
  width: number;
  align?: "right" | "center";
  /** numFmt Excel cho cột số (vd "#,##0"). Có numFmt nghĩa là cột số. */
  numFmt?: string;
  /** Giá trị THÔ — Excel và CSV dùng thẳng; web format lại theo numFmt. */
  value: (row: T, stt: number) => string | number | undefined;
  /** Ghi đè cách render trên web: checkbox "Chọn", ô màu trạng thái, dấu "—". */
  cell?: (row: T, stt: number) => ReactNode;
  /** Chỉ hiện trên web, không xuất ra file (cột "Chọn"). */
  webOnly?: boolean;
}
```

Đã cân nhắc phương án tách registry trường (`fields.ts` định nghĩa từng trường + file cột chỉ liệt kê thứ tự key). Loại vì với 21–27 cột nó thêm một tầng gián tiếp mà chưa có nhu cầu thật — muốn đọc một cột phải nhảy hai file.

### 4.3. Quy ước giữa các kênh

| Thuộc tính | Excel | CSV | Web |
|---|---|---|---|
| `header` | tiêu đề hàng 1 | tiêu đề | `<TableCell>` đầu bảng |
| `width` | `ws.columns[].width` | — | — |
| `numFmt` | `ws.getColumn().numFmt` | — | tín hiệu để `renderCell` gọi `formatMoney` |
| `align` | — | — | `<TableCell align>` |
| `value` | giá trị ô | giá trị ô | đầu vào cho `renderCell` |
| `cell` | — | — | ưu tiên hơn `renderCell` |
| `webOnly` | lọc bỏ | lọc bỏ | giữ |

`renderCell(col, row, stt)` ở `types.ts` là mặc định cho web: có `numFmt` thì `formatMoney(value)`, không thì `String(value ?? "")`.

**Quy ước ô rỗng:** `value` trả `undefined` cho ô không có dữ liệu. Excel/CSV ghi ô trống (không phải `0`); web hiện `NO_DATA_YET` (`—`). Giữ nguyên hành vi hiện tại của cả hai phía, chỉ khác là nay do một chỗ quyết định.

### 4.4. Bên tiêu thụ

| File | Thay đổi |
|---|---|
| `exportXlsx.ts` | Bỏ `XlsxColumn`, `overviewColumns`, `detailColumns`, hằng số style. Nhập từ `templates/`, lọc `!c.webOnly`. Còn lại đúng một việc: dựng workbook (`addStyledSheet`, `buildSummaryWorkbookBuffer`, tên file). |
| `exportInvoices.ts` | Bỏ `Column` và `backupColumns` cục bộ, nhập từ `templates/`. Giữ `csvCell`/`downloadCsv`. |
| `InvoiceListTabs.tsx` | Bỏ `InvoiceColumn` và `columnsFor` cục bộ. Render `col.cell?.(row, stt) ?? renderCell(col, row, stt)`. `ttTaiCell` chuyển vào `templates/` làm `cell` của cột "T. thái tải". |
| `InvoiceDetailPanel.tsx` | Bỏ `DetailColumn`/`DETAIL_COLUMNS`. Nhận thêm prop `direction` để gọi `detailColumns(direction)`. |
| `detailRow.ts` | `toDetailRows(detail, direction)`; `DetailRow` thêm `buyerMst`/`buyerTen`. |
| `types/` | Bổ sung field mới vào `DetailRow`. |

`invoiceRow.ts` (`toDisplayRow`) không đổi — `DisplayRow` đã có sẵn cả `sellerMst`/`buyerMst`.

### 4.5. Vì sao thiết kế này ngăn được lỗi tái diễn

Cột đối tác chiều bán ra sau khi gom chỉ còn tồn tại ở một biểu thức duy nhất trong `overviewColumns.ts`. Không còn hai danh sách để lệch. Quy trình 5 bước ở chương 13 mục 13.2 rút xuống còn: thêm field vào `DisplayRow`/`DetailRow`, thêm một dòng vào file template tương ứng.

## 5. Nghiệm thu

Thay đổi này chạm vào cả UI lẫn file xuất ra, nên nghiệm thu phải nhìn cả hai.

**Kiểm tra tự động** (TypeScript + lint là lưới an toàn chính, dự án chưa có test runner):
- `npm run build` sạch — TypeScript bắt mọi tên field sai trong `value`/`cell`.
- `npm run lint` sạch.

**Kiểm tra thủ công — bắt buộc trước khi coi là xong:**

1. Bảng Tổng quát, chiều mua vào: số cột và thứ tự cột không đổi so với trước.
2. Bảng Tổng quát, chiều bán ra: cột đối tác hiện "MST người mua"/"Tên người mua" với giá trị **khác nhau giữa các dòng**.
3. Bảng Chi tiết cả hai chiều: 27 cột, thứ tự không đổi.
4. Xuất file, mở `Tong-hop-dau-vao-*.xlsx`: sheet Tổng quát 21 cột, sheet Chi tiết 27 cột, tiêu đề in đậm nền xanh nhạt, freeze hàng 1, auto-filter, cột tiền là **số thật** (chọn nhiều ô thấy Excel hiện tổng ở thanh dưới).
5. Mở `Tong-hop-dau-ra-*.xlsx`: hai cột đối tác hiện **khách hàng**, giá trị khác nhau giữa các dòng — đây là lỗi 3.1 và 3.2, phải xác nhận đã hết ở **cả hai sheet**.
6. Cài đặt › Dữ liệu hệ thống › Xuất / Sao lưu: file CSV vẫn 15 cột (14 + cột "Chiều"), tiếng Việt hiện đúng trong Excel.

## 6. Tài liệu phải cập nhật theo

| Tài liệu | Sửa gì |
|---|---|
| `docs/11-pipeline-xuat-file.md` mục 11.5 | Bỏ cảnh báo "hai danh sách riêng biệt" — không còn đúng. Thay `XlsxColumn` bằng `InvoiceColumn`. |
| `docs/13-huong-dan-mo-rong.md` mục 13.2 | Viết lại quy trình thêm cột: 5 bước → 2 bước. Sửa bảng đối chiếu ở cuối mục. |
| `docs/13-huong-dan-mo-rong.md` dòng 551 | "Đổi cột Excel → `exportXlsx.ts`" thành `templates/`. |
| `docs/03-kien-truc-va-thu-muc.md` | Thêm `templates/` vào sơ đồ thư mục. |

## 7. Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Sót/lệch thứ tự cột khi chuyển sang folder mới | Cao | Chuyển nguyên văn từng cột, không sửa nội dung cùng lúc với đổi cấu trúc. Bước kiểm tra 1–3 đối chiếu số cột và thứ tự. |
| `InvoiceDetailPanel` nhận thêm prop `direction` — nơi gọi quên truyền | Thấp | TypeScript bắt ngay, prop bắt buộc. |
| Người dùng đã quen file đầu ra hiện cột "người xuất hàng" | Thấp | Cột đó đang lặp một giá trị nên không ai dùng được. Đổi là sửa lỗi, không phải đổi giao diện. |
| Đổi `value` trả `undefined` (thay vì `""` như hiện tại) làm ô Excel đổi kiểu | Trung bình | Bước kiểm tra 4 xác nhận cột tiền vẫn là số thật và ô rỗng vẫn trống. |

## 8. Quyết định đã chốt

| Câu hỏi | Chốt |
|---|---|
| "Template" là gì | File code khai báo cột (`.ts`), không phải file `.xlsx` mẫu, không phải cấu hình JSON + UI chọn cột |
| Phạm vi | Màn hình + Excel + CSV dùng chung một nguồn |
| Cột đối tác chiều bán ra | **Bên bán**: MST, Tên công ty, Địa chỉ (xem mục 9 — đổi so với chốt ban đầu) |
| PDF/HTML | Không đưa vào `templates/` |

## 9. Thay đổi sau khi triển khai — cột chiều bán ra

Yêu cầu mới: *"tại hóa đơn đầu ra, thay MST người xuất hàng thành MST, Tên công ty, địa chỉ của bên bán"*. Thay cho phương án ở mục 3.1/3.2.

### Đã làm

| Bảng/sheet | Chiều mua vào | Chiều bán ra |
|---|---|---|
| Tổng quát | MST người bán/MST người xuất hàng, Tên người bán/Tên người xuất hàng (2 cột, không đổi) | MST người bán, Tên công ty người bán, **Địa chỉ người bán** (3 cột) |
| Chi tiết | MST/người bán, Tên người bán (2 cột, không đổi) | MST người bán, Tên công ty người bán, **Địa chỉ người bán** (3 cột) |

### Nguồn dữ liệu địa chỉ

Không cần sửa backend: `SAVED_LIST_SELECT` (`be_maxv/src/services/client/hddt/gdt.service.ts`) đã trả `nbdchi`, và `mapInvoiceDatas` bên FE dùng `...d` nên trường đó vốn đã có trên object, chỉ chưa được map.

`invoiceRow.ts` đổi `sellerDiaChi` từ suy ra theo chiều (`diaChiDoiTac`, luôn rỗng ở chiều bán ra) sang lấy thẳng `nbdchi` — đúng cho cả hai chiều. `detailRow.ts` lấy `nbdchi` từ payload chi tiết.

### Hệ quả cần biết

- **Bảng trên màn hình chiều bán ra cũng đổi theo** — vì web và Excel nay dùng chung một nguồn. Trước đây màn hình hiện "MST người mua"; nay hiện khối bên bán như bảng trên. Nếu muốn màn hình vẫn xem được khách hàng, thêm 2 cột `webOnly: true` lấy `buyerMst`/`buyerTen` vào `templates/overviewColumns.tsx` — file xuất sẽ không bị ảnh hưởng.
- `DetailRow` **không** thêm `buyerMst`/`buyerTen` nữa (không nơi nào dùng); thay bằng `sellerDiaChi`.
- `toDetailRows` **giữ nguyên chữ ký** `(detail)` — không cần `direction` như spec ban đầu dự tính, vì việc chọn cột theo chiều nằm ở tầng template, không ở tầng biến đổi dữ liệu. Nhờ vậy hai nơi gọi (`exportBundle.ts`, `InvoiceListTabs.tsx`) không phải sửa.

## 10. Tách template theo chiều hóa đơn

Yêu cầu tiếp theo: mỗi chiều một file mã nguồn, không dùng chung.

```
templates/
├── types.ts          InvoiceColumn, renderCell, fileColumns, hằng số style
├── cells.tsx         ô render riêng cho web (ttTaiCell)
├── dauVao.ts         overviewDauVao() + detailDauVao()   — 22 + 27 cột
├── dauRa.ts          overviewDauRa()  + detailDauRa()    — 23 + 28 cột
├── backupColumns.ts  cột CSV sao lưu (chung hai chiều)
└── index.ts          overviewColumns(direction) / detailColumns(direction) — chỉ chọn bộ cột
```

`overviewColumns.tsx` và `detailColumns.ts` (bản gộp hai chiều bằng ternary `isPurchase`) đã xóa. Nơi gọi **không đổi**: vẫn `overviewColumns(direction)` / `detailColumns(direction)` từ `../templates`.

### Đánh đổi đã chấp nhận

Khoảng 19/22 cột Tổng quát và 25/27 cột Chi tiết nay tồn tại ở cả hai file. Sửa một cột dùng chung phải sửa hai chỗ. Chấp nhận vì:

- Yêu cầu kế toán cho đầu vào và đầu ra tách nhau dần theo thời gian (đầu ra đã có thêm cột Địa chỉ).
- Sửa một chiều không còn rủi ro làm hỏng chiều kia.
- Mỗi file đọc thẳng từ trên xuống, không phải giải mã ternary xen giữa danh sách cột.

Rủi ro drift **giữa hai chiều** thấp hơn hẳn drift **giữa web và Excel** trước đây, vì mỗi file vẫn là nguồn duy nhất cho cả web lẫn file xuất của chiều đó — tức là lỗi ở mục 3.1 không thể tái diễn.

## 11. Đổi lại cột chiều bán ra sang BÊN MUA (2026-07-29)

Yêu cầu mới, đảo ngược mục 9: *"hóa đơn đầu ra hiện đang để MST người bán / Tên công ty người bán / Địa chỉ người bán, đổi lại là bên người mua — cả tổng quát lẫn chi tiết"*.

Đây là lần đảo thứ hai của cùng một quyết định (mục 3.1/3.2 chọn bên mua → mục 9 đổi sang bên bán → mục này quay lại bên mua). Ghi rõ để lần sau không ai tưởng là lỗi rồi "sửa" ngược lại.

### Đã làm

| Bảng/sheet | Mua vào | Bán ra |
|---|---|---|
| Tổng quát | MST, Tên người bán (2 cột, không đổi) | **MST người mua, Tên công ty người mua, Địa chỉ người mua** |
| Chi tiết | MST/người bán, Tên người bán (2 cột, không đổi) | **MST người mua, Tên công ty người mua, Địa chỉ người mua** |

Vị trí và độ rộng cột giữ nguyên. Hai sheet của `Tong-hop-dau-ra.xlsx` đọc chung `dauRa.ts` nên đổi theo, không có code riêng.

### Nguồn dữ liệu

Không sửa backend: `SAVED_LIST_SELECT` đã trả `nmmst`/`nmten`/`nmdchi`, và `mapInvoiceDatas` dùng `...d` nên các trường đó vốn đã có trên object.

- `invoiceRow.ts`: thêm `buyerDiaChi` ← `nmdchi`, bỏ `sellerDiaChi`.
- `detailRow.ts`: thêm `buyerMst`/`buyerTen`/`buyerDiaChi` ← `nmmst`/`nmten`/`nmdchi`, bỏ `sellerDiaChi`.
- `types/index.ts`: `DisplayRow` và `DetailRow` bỏ `sellerDiaChi` (không còn nơi dùng — `dauVao.ts` chỉ dùng `sellerMst`/`sellerTen`), thêm các field `buyer*` tương ứng.

### Hóa đơn bán lẻ / cá nhân

GDT để trống tên đơn vị (`nmten`) với hóa đơn bán cho cá nhân; họ tên người mua nằm ở `nmtnmua`. Cả hai mapper fallback `nmten || nmtnmua` để cột không trống hàng loạt.

**Hạn chế đã biết:** fallback chỉ ăn ở bảng **Chi tiết** (payload `/detail` có `nmtnmua`). Bảng Tổng quát đọc từ `vct50view`, bảng này không có cột `nmtnmua` — hóa đơn bán lẻ vẫn trống tên người mua. Muốn có luôn ở Tổng quát phải thêm cột DB + `npm run sync:tenants` + đồng bộ lại; cố ý **không** gộp vào lần này.

Cột MST giữ nguyên hành vi: khách lẻ không có MST thật nên để trống.
