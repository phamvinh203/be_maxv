# Commit `12bc60e` — `detailRowFill`: tô màu hàng "Chi tiết" kết hợp trạng thái + cảnh báo

- **Hash đầy đủ:** `12bc60ecaed704c625e9fde3672410f5e376d1f5`
- **Ngày:** Mon Aug 3 16:42:39 2026 +0700
- **Thông điệp:** `✨ Add detail row fill functionality for invoice status and warnings`
- **Files thay đổi:** 3 file, +22 / −3 dòng

## 1. Mục đích (tóm tắt)

Trước commit này, sheet **"Chi tiết"** trong file Excel tổng hợp chỉ tô màu hàng theo **trạng thái hóa đơn** (`tthai` = 2/3/4/5/6 → thay thế/điều chỉnh/đã bị thay thế/điều chỉnh/hủy). Các hóa đơn "bình thường" (`tthai = 1`, chiếm đa số) nhưng **thiếu địa chỉ người mua** — một lỗi nhập liệu kế toán cần rà — lại không được tô gì, trôi tuột giữa bảng vài nghìn dòng.

Commit thêm một lớp tô màu thứ hai **xám nhạt** cho các cảnh báo (warning), và một hàm gộp `detailRowFill` theo nguyên tắc **ưu tiên trạng thái**: nếu hóa đơn đang ở trạng thái đặc biệt (đã đổi/hủy) thì giữ màu trạng thái đó (đỏ/hồng/cam quan trọng hơn); chỉ khi bình thường mới xét cảnh báo thiếu địa chỉ.

## 2. Bối cảnh trước commit

Hàm tô hàng cũ trong [templates/types.ts](../../src/features/hddt/templates/types.ts) chỉ đúng một việc — trả màu theo mã trạng thái:

```ts
export function trangThaiHdRowFill(row: { trangThaiHd: string }): ExcelCellStyle | undefined {
  return TRANG_THAI_HD_FILL[row.trangThaiHd];
}
```

Bảng màu `TRANG_THAI_HD_FILL` (giữ nguyên ở commit này):

```ts
export const TRANG_THAI_HD_FILL: Record<string, ExcelCellStyle> = {
  "2": { bg: "FFDDEBF7" }, // thay thế — xanh nhạt
  "3": { bg: "FFFFF2CC" }, // điều chỉnh — vàng nhạt
  "4": { bg: "FFFCE4D6" }, // đã bị thay thế — cam nhạt
  "5": { bg: "FFF8CBAD" }, // bị điều chỉnh — cam
  "6": { bg: "FFFFC7CE", fg: "FF9C0006" }, // đã bị hủy — hồng, chữ đỏ sẫm
};
```

Lý do mã `1` (Hóa đơn mới) **cố ý không có màu**: đó là đa số tuyệt đối, tô hết thì màu mất tác dụng báo hiệu. Chỉ tô các trạng thái đã **biến đổi**.

Sheet "Chi tiết" được dựng trong [exportXlsx.ts](../../src/features/hddt/exportXlsx.ts) bằng `addStyledSheet`, nhận hàm `rowFill` để tô cả hàng:

```ts
addStyledSheet(wb, `Chi tiết ${text}`, detailColumns(direction), detailRows, {
  rowFill: trangThaiHdRowFill,   // ← trước commit này: chỉ trạng thái
});
```

**Vấn đề:** kế toán muốn thấy ngay hóa đơn nào **thiếu địa chỉ người mua** (một dấu hiệu nhập liệu sai/thiếu cần kiểm tra). Lớp cảnh báo này không có chỗ trong cơ chế tô màu cũ.

## 3. Thay đổi chi tiết

### 3.1. `templates/types.ts` — thêm `WARNING_FILL` + `detailRowFill`

File: [templates/types.ts](../../src/features/hddt/templates/types.ts)

**Thêm hai hằng số / hàm mới** (chèn ngay sau `trangThaiHdRowFill`):

```ts
/** Màu xám nhạt cho cảnh báo (thiếu địa chỉ người mua, v.v.) */
export const WARNING_FILL: ExcelCellStyle = { bg: "FFE0E0E0" }; // xám nhạt

/**
 * Tô cả hàng kết hợp: Ưu tiên trạng thái hóa đơn, nếu không có mới dùng warning.
 * Dùng cho sheet "Chi tiết" để tô cảnh báo mà không đè màu trạng thái quan trọng.
 */
export function detailRowFill(row: { trangThaiHd: string; buyerDiaChi?: string }): ExcelCellStyle | undefined {
  // Ưu tiên trạng thái hóa đơn (đỏ/hồng quan trọng hơn)
  const statusFill = TRANG_THAI_HD_FILL[row.trangThaiHd];
  if (statusFill) return statusFill;

  // Nếu không có trạng thái đặc biệt, kiểm tra warning
  if (!row.buyerDiaChi) return WARNING_FILL;

  return undefined; // Không tô màu
}
```

#### Phân tích logic

| `row.trangThaiHd` | `row.buyerDiaChi` | Kết quả | Ý nghĩa |
|---|---|---|---|
| `"2"`,`"3"`,`"4"`,`"5"`,`"6"` | bất kỳ | Màu trạng thái tương ứng | Hóa đơn đã biến đổi → quan trọng nhất |
| `"1"` (hoặc mã lạ) | rỗng / `undefined` | `WARNING_FILL` (xám) | Bình thường nhưng thiếu địa chỉ → cảnh báo |
| `"1"` (hoặc mã lạ) | có giá trị | `undefined` (không tô) | Hóa đơn lành, không có gì để nhắc |

**Điểm cốt lõi — thứ tự ưu tiên:** Trạng thái thắng cảnh báo. Một hóa đơn bị hủy (`6`) mà đồng thời thiếu địa chỉ sẽ tô **hồng**, không phải xám — vì "đã hủy" là thông tin mang tính quyết định hơn (kế toán không kê khai hóa đơn hủy), dấu hiệu thiếu địa chỉ lúc đó là thứ yếu.

**Kiểu tham số mở rộng:** signature nhận `{ trangThaiHd: string; buyerDiaChi?: string }` — gồm cả hai trường hợp để một hàm quyết định cả hai lớp màu. `buyerDiaChi` là `optional` vì `DetailRow` luôn có trường này (xem [detailRow.ts](../../src/features/hddt/detailRow.ts)), nhưng đánh dấu `?` cho phép dùng lại hàm với các kiểu dòng ít field hơn.

`trangThaiHdRowFill` cũ **được giữ lại** (không xóa) — nó vẫn là API công khai, dùng cho các sheet/bối cảnh chỉ quan tâm trạng thái thuần.

### 3.2. `templates/index.ts` — tái xuất khẩu `detailRowFill`

File: [templates/index.ts](../../src/features/hddt/templates/index.ts)

`detailRowFill` nằm trong `types.ts` nhưng phía ngoài import qua `index.ts` (barrel). Thêm một dòng:

```ts
export { detailRowFill } from "./types";
```

Giờ các nơi dùng (`exportXlsx.ts`) có thể import gọn:

```ts
import { detailColumns, detailRowFill, fileColumns, overviewColumns, type InvoiceColumn } from "./templates";
```

### 3.3. `exportXlsx.ts` — đổi `rowFill` của sheet "Chi tiết" sang `detailRowFill`

File: [exportXlsx.ts](../../src/features/hddt/exportXlsx.ts)

**Đổi import:** bớt `trangThaiHdRowFill` (không còn dùng trực tiếp ở đây), thêm `detailRowFill`:

```ts
// Trước:
import { detailColumns, fileColumns, overviewColumns, type InvoiceColumn } from "./templates";
import { trangThaiHdRowFill, type ExcelCellStyle } from "./templates/types";

// Sau:
import { detailColumns, detailRowFill, fileColumns, overviewColumns, type InvoiceColumn } from "./templates";
import type { ExcelCellStyle } from "./templates/types";
```

**Đổi dòng `rowFill`** trong `buildSummaryWorkbookBuffer`:

```ts
addStyledSheet(wb, `Chi tiết ${text}`, detailColumns(direction), detailRows, {
  rowFill: detailRowFill,   // ← đổi từ trangThaiHdRowFill
});
```

Lưu ý: chỉ sheet **Chi tiết** dùng `detailRowFill`. Sheet **Tổng quát** (`overviewColumns`) vẫn không có `rowFill` — nó vốn không tô màu hàng (sheet tổng quát mỗi dòng là một hóa đơn, tô màu trạng thái ở cấp độ đó đã có cách thể hiện khác).

#### Cơ chế tiêu thụ `rowFill` (trong `addStyledSheet`)

Để hiểu vì sao chỉ cần thay hàm là đủ, xem vòng lặp tô ô bên trong `addStyledSheet`:

```ts
rows.forEach((row, i) => {
  const r = ws.getRow(headerAt + 1 + i);
  r.height = ROW_HEIGHT;
  r.alignment = { vertical: "middle" };
  const fill = rowFill?.(row);           // ← gọi detailRowFill(row)
  cols.forEach((c, ci) => {
    const cell = r.getCell(ci + 1);
    cell.value = c.value(row, i + 1) ?? null;
    if (!fill) return;
    // Tô TỪNG Ô của vùng dữ liệu, không đặt `r.fill` cấp hàng
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill.bg } };
    if (fill.fg) cell.font = { color: { argb: fill.fg } };
  });
});
```

`rowFill?.(row)` trả về `ExcelCellStyle | undefined`. Khi trả `undefined` (hóa đơn lành) thì vòng `cols.forEach` `return` sớm → không tô ô nào, hàng giữ nguyên. Khi trả style (`{ bg }` hoặc `{ bg, fg }`) thì **mỗi ô** trong vùng dữ liệu được tô nền `bg`, và nếu có `fg` (chữ đỏ sẫm cho hóa đơn hủy) thì set cả `cell.font.color`.

> Tô từng ô chứ không set `r.fill` (cấp hàng) vì style cấp hàng trong xlsx phủ tới cột cuối bảng tính, kéo vệt màu chạy dài khỏi mép bảng.

## 4. Sau commit — kết quả người dùng nhìn thấy

Mở file Excel tổng hợp (`Tong-hop-dau-vao-*.xlsx` / `Tong-hop-dau-ra-*.xlsx`), tại sheet "Chi tiết":

- Hóa đơn **bình thường + đủ địa chỉ** → hàng trắng (như cũ).
- Hóa đơn **bình thường + THIẾU địa chỉ người mua** → hàng **xám nhạt** ← *mới*.
- Hóa đơn **thay thế/điều chỉnh/đã bị thay thế/bị điều chỉnh/hủy** → giữ màu trạng thái như cũ (xanh/vàng/cam/hồng), màu này thắng cả khi hóa đơn cũng thiếu địa chỉ.

Kế toán lướt file vài nghìn dòng sẽ thấy ngay: những vệt xám rải rác chính là các hóa đơn cần liên hệ bổ sung địa chỉ — công việc trước đây phải dò từng dòng bằng mắt thường.

## 5. Thiết kế & quy ước liên quan

- **Màu phải NHẠT:** nó phủ 46 cột ngang, nền đậm sẽ nuốt chữ đen (lý do `WARNING_FILL` cũng là `FFE0E0E0` rất nhẹ). Riêng mã `6` thêm `fg: "FF9C0006"` (chữ đỏ sẫm) vì hồng + chữ đen là tương phản thấp nhất trong bảng.
- **Mã `1` không có màu nền cố ý** — đa số tuyệt đối. Tô nền mọi dòng "bình thường" làm màu mất giá trị báo hiệu.
- **API chia lớp:** `trangThaiHdRowFill` (chỉ trạng thái) và `detailRowFill` (trạng thái + cảnh báo) cùng tồn tại; `detailRowFill` là bản siêu tập (superset) — gọi nó là đủ khi muốn cả hai hành vi.
- **Nguồn `buyerDiaChi`:** điền trong [detailRow.ts](../../src/features/hddt/detailRow.ts) từ field GDT `nmdchi` của payload chi tiết, ở khối `header` (lặp mỗi dòng hàng của cùng hóa đơn). Do đó mọi dòng hàng của một hóa đơn thiếu địa chỉ đều sẽ bị tô xám đồng loạt — đúng kỳ vọng.

## 6. Files & code tương ứng (tham chiếu nhanh)

| File (sau commit) | Vai trò |
|---|---|
| [templates/types.ts](../../src/features/hddt/templates/types.ts) | Định nghĩa `WARNING_FILL`, `detailRowFill` |
| [templates/index.ts](../../src/features/hddt/templates/index.ts) | Tái xuất khẩu `detailRowFill` |
| [exportXlsx.ts](../../src/features/hddt/exportXlsx.ts) | Dùng `detailRowFill` làm `rowFill` cho sheet "Chi tiết" |

> Commit tiếp theo `fc9c179` sẽ tiếp tục hoàn thiện lớp thông tin của sheet "Chi tiết": thêm bản đồ ngược "HĐ này bị thay thế bởi HĐ nào" và điền nội dung cụ thể cho cột cảnh báo "Các trường hợp đặc biệt". Xem [commit_fc9c179_replaced-by-map-ghi-chu.md](./commit_fc9c179_replaced-by-map-ghi-chu.md).
