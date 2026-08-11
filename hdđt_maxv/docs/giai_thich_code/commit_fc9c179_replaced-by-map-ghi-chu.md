# Commit `fc9c179` — Bản đồ ngược "bị thay thế bởi" + cột cảnh báo đặc biệt

- **Hash đầy đủ:** `fc9c179f48cca9d06c0d69b39c4a51eaad1533b1`
- **Ngày:** Mon Aug 3 20:41:21 2026 +0700
- **Thông điệp:** `update row`
- **Files thay đổi:** 5 file, +91 / −63 dòng

## 1. Mục đích (tóm tắt)

Commit giải quyết **hai vấn đề nghiệp vụ** trên sheet "Chi tiết" của bộ xuất hóa đơn:

1. **Hóa đơn bị thay thế/điều chỉnh (tthai 4/5) không biết HĐ nào đã thay thế nó.** Liên kết trong dữ liệu GDT là **một chiều** — chỉ hóa đơn *thay thế* (2) / *điều chỉnh* (3) mang field `khhdgoc`/`shdgoc` trỏ về hóa đơn gốc; hóa đơn gốc không có field ngược. Cột "Ghi chú: thay thế/điều chỉnh/…" trước đây chỉ viết được **một nửa** câu chuyện ("Thay thế cho…"), còn "Bị thay thế bởi…" bỏ trống.
2. **Cột "Các trường hợp đặc biệt kế toán xem xét kỹ hơn"** (`ghiChuDacBiet`) trước đây luôn rỗng — cờ cảnh báo tự sinh chưa được xây. Kế toán muốn cột này tự phát hiện các hóa đơn rủi ro (thiếu địa chỉ người mua, hóa đơn đã bị thay thế → không được kê khai thuế).

Ngoài ra commit cũng **dọn dừa**: bỏ block doc dài giờ đã lỗi thời trong [dauRa.ts](../../src/features/hddt/templates/dauRa.ts) và bỏ field dư thừa `gchdgoc` trong chuỗi ghi chú.

## 2. Vấn đề 1 — Liên kết "bị thay thế bởi" là một chiều

### Bản chất dữ liệu GDT

| `tthai` | Ý nghĩa | Có nhóm field `…goc`? |
|---|---|---|
| `1` | Hóa đơn mới | Không (null) |
| `2` | Hóa đơn THAY THẾ | **Có** (`khhdgoc`, `shdgoc`, `tdlhdgoc`… trỏ về HĐ gốc) |
| `3` | Hóa đơn ĐIỀU CHỈNH | **Có** |
| `4` | Hóa đơn BỊ THAY THẾ (bị vô hiệu) | **Không** (cả nhóm `…goc` null) |
| `5` | Hóa đơn BỊ ĐIỀU CHỈNH | **Không** |
| `6` | Hóa đơn bị HỦY | Không |

**Hệ quả:** Một hóa đơn `tthai=4` đứng riêng không thể tự biết nó đã bị HĐ nào thay thế. Để ghi "Bị thay thế bởi HĐ 1772 ngày …", phải có mặt **HĐ thay thế (`tthai=2`) trong cùng lô** và tự **xây chỉ mục ngược**.

### Giải pháp: `buildReplacedByMap` — chỉ mục ngược cấp lô

File: [detailRow.ts](../../src/features/hddt/detailRow.ts)

Quét **toàn bộ** mảng details của một khoảng xuất, lấy riêng các HĐ `tthai ∈ {2,3}` (vì chúng là bên biết HĐ gốc), dựng `Map`:

```ts
export type ReplacedByMap = Map<string, { soHd: string; ngay: string; tthai: string }>;

export function buildReplacedByMap(
  details: (Record<string, unknown> | null | undefined)[],
): ReplacedByMap {
  const m: ReplacedByMap = new Map();
  for (const d of details) {
    if (!d) continue;
    const tthai = s(d.tthai);
    if (tthai !== "2" && tthai !== "3") continue;          // chỉ HĐ thay thế/điều chỉnh
    const kyHieuGoc = s(d.khhdgoc);
    const soHdGoc = s(d.shdgoc);
    if (!kyHieuGoc || !soHdGoc) continue;                  // thiếu định danh gốc -> bỏ qua
    m.set(`${s(d.nbmst)}|${kyHieuGoc}|${soHdGoc}`, {
      soHd: s(d.shdon),
      ngay: s(d.tdlap),
      tthai,
    });
  }
  return m;
}
```

#### Phân tích khóa

```
Key   = `${nbmst}|${khhdon}|${shdon}`   ← của HĐ GỐC
Value = { soHd, ngay, tthai }           ← của HĐ THAY THẾ/ĐIỀU CHỈNH
```

- **Ba thành phần định danh** (`nbmst` mã số thuế người bán + `khhdon` ký hiệu HĐ + `shdon` số HĐ) là bộ khóa tự nhiên của một hóa đơn.
- **Tại sao thêm `nbmst`?** Một lô **MUA VÀO** gom hóa đơn của **nhiều người bán** khác nhau. Hai người bán có thể phát hành HĐ cùng ký hiệu và số (vd `C26TLT` số `1796`) — nếu khóa không có MST sẽ nhầm HĐ gốc của NB này thành bị thay thế bởi HĐ của NB kia.
- **Tại sao không có `khmshdon` (mẫu số)?** Một người bán chỉ tự thay thế HĐ của chính mình, và mẫu số HĐ thay thế trùng mẫu số HĐ gốc; MST + ký hiệu + số đã đủ định danh trong phạm vi một người bán.
- **Value chỉ cần số + ngày + loại** (`soHd`, `ngay`, `tthai`) — đủ để viết câu "Bị thay thế bởi hóa đơn 1772 ngày 19-05-2026" và phân biệt thay thế/điều chỉnh.

#### Tại sao phải dựng ở "cấp lô" rồi truyền vào?

`toDetailRows` xử lý **một hóa đơn** tại một thời điểm. Nó không nhìn thấy HĐ thay thế (có thể nằm xa trong danh sách). Nên bản đồ ngược **bắt buộc** dựng trước, ở nơi đã cầm toàn bộ details của khoảng, rồi **truyền tham số** vào từng lời gọi `toDetailRows`. Đó là lý do signature của `toDetailRows` được mở rộng (xem §4).

## 3. Vấn đề 1 (tiếp) — `tinhGhiChuLienQuan` viết câu cho cả hai chiều

Cũ: `ghiChuHoaDonGoc` chỉ nối field `…goc` của chính hóa đơn → chỉ ra kết quả cho `tthai 2/3`. Mới: `tinhGhiChuLienQuan` xử lý **cả 4 trạng thái** 2/3/4/5:

```ts
function tinhGhiChuLienQuan(
  detail: Record<string, unknown>,
  replacedBy?: ReplacedByMap,
): string {
  const tthai = s(detail.tthai);

  // (A) HĐ NÀY thay thế/điều chỉnh HĐ khác — đọc nhóm …goc của chính nó
  if (tthai === "2" || tthai === "3") {
    const soHd = s(detail.shdgoc);
    const ngay = s(detail.tdlhdgoc);
    if (!soHd && !ngay) return "";
    const dongTu = tthai === "3" ? "Điều chỉnh" : "Thay thế";
    const ngayFmt = ngay ? formatDateVN(ngay).replace(/\//g, "-") : "";
    return [`${dongTu} cho hóa đơn`, soHd, ngayFmt ? `ngày ${ngayFmt}` : ""]
      .filter(Boolean)
      .join(" ");
  }

  // (B) HĐ NÀY bị thay thế/điều chỉnh — tra bản đồ ngược
  if (tthai === "4" || tthai === "5") {
    const key = `${s(detail.nbmst)}|${s(detail.khhdon)}|${s(detail.shdon)}`;
    const r = replacedBy?.get(key);
    if (!r) return "";                                       // HĐ thay thế không có trong lô -> không biết
    const dongTu = tthai === "5" ? "Bị điều chỉnh" : "Bị thay thế";
    const ngayFmt = r.ngay ? formatDateVN(r.ngay).replace(/\//g, "-") : "";
    return [`${dongTu} bởi hóa đơn`, r.soHd, ngayFmt ? `ngày ${ngayFmt}` : ""]
      .filter(Boolean)
      .join(" ");
  }

  return "";   // tthai = 1 (mới) hoặc 6 (hủy) -> không có liên kết
}
```

#### Ví dụ kết quả

| `tthai` của HĐ đang xét | Nguồn dữ liệu | Câu ghi chú |
|---|---|---|
| `2` | `shdgoc=1796`, `tdlhdgoc=2026-05-20` | `Thay thế cho hóa đơn 1796 ngày 20-05-2026` |
| `3` | `shdgoc=1796`, `tdlhdgoc=2026-05-20` | `Điều chỉnh cho hóa đơn 1796 ngày 20-05-2026` |
| `4` | tra map → `soHd=1772`, `ngay=2026-05-19` | `Bị thay thế bởi hóa đơn 1772 ngày 19-05-2026` |
| `5` | tra map → `soHd=1772`, `ngay=2026-05-19` | `Bị điều chỉnh bởi hóa đơn 1772 ngày 19-05-2026` |
| `4` nhưng HĐ thay thế **không có trong lô** | tra map → `undefined` | *(rỗng)* |
| `1` | — | *(rỗng)* |

#### Quyết định thiết kế đáng chú ý

- **Bỏ field `gchdgoc`** (ghi chú dài của người bán, vd *"Hóa đơn thay thế cho hóa đơn điện tử mẫu 1 ký hiệu C26TLT số 1796 lập ngày…"*). Lý do: **thừa** — số + ngày gốc đã đủ cho kế toán định danh, text dài chỉ làm cột bị phình và trùng lặp thông tin.
- **Ngày gốc đổi sang `dd-MM-yyyy`** (dấu `-`) thay vì `dd/MM/yyyy` mặc định của `formatDateVN`. Lý do: dấu `-` phân biệt với các mặt phân tách khác trong câu, tránh nhầm khi copy-paste.
- **Khi HĐ thay thế vắng mặt trong lô → trả rỗng**, không đoán. Đây là **dữ liệu thật thiếu**, không phải lỗi — có thể người dùng xuất một khoảng hẹp không bao gồm HĐ thay thế. An toàn hơn việc hiện thông tin sai.
- `dongTu` tách ra biến riêng cho dễ đổinih ngữ và đảm bảo song song `2↔4` ("Thay thế"/"Bị thay thế") và `3↔5` ("Điều chỉnh"/"Bị điều chỉnh").

## 4. `toDetailRows` — nhận thêm tham số `replacedBy`

Cùng file [detailRow.ts](../../src/features/hddt/detailRow.ts). Signature mở rộng tham số thứ ba (optional, giữ tương thích ngược):

```ts
export function toDetailRows(
  detail: Record<string, unknown> | null | undefined,
  stt = 0,
  replacedBy?: ReplacedByMap,   // ← mới
): DetailRow[] {
  // ...
  const header = {
    // ... (các field khác giữ nguyên)
    ghiChuLienQuan: tinhGhiChuLienQuan(detail, replacedBy),   // ← truyền vào
    // ...
  };
  // ...
}
```

`replacedBy` chỉ được đọc tại **một chỗ duy nhất** — bên trong `tinhGhiChuLienQuan` (cho nhánh B). Phần dòng hàng hóa (`hdhhdvu`) không dùng tới, vì thông tin "bị thay thế" là thuộc tính cấp **hóa đơn** (header), lặp y nguyên ở mỗi dòng hàng — cùng cơ chế như các cột tổng tiền.

## 5. Nơi gọi #1 — `InvoiceListTabs.tsx` (bảng chi tiết trên web)

File: [components/InvoiceListTabs.tsx](../../src/features/hddt/components/InvoiceListTabs.tsx)

Đây là hook `useMemo` dựng `detailRows` cho bảng "Chi tiết" hiển thị trên giao diện. Trước commit, `toDetailRows(d, stt)` chỉ hai tham số. Sau:

```ts
const detailRows = useMemo(() => {
  const sttOf = invoiceSttMap(rows);
  const details = savedDetailsQuery.data ?? [];
  // Bản đồ ngược "HĐ này bị HĐ nào thay thế/điều chỉnh" — dựng cùng khoảng (xem detailRow.ts).
  const replacedBy = buildReplacedByMap(details);
  return details.flatMap((d) => {
    const str = (v: unknown): string => (v == null ? "" : String(v));
    const key = invoiceKey(str(d.khmshdon), str(d.khhdon), str(d.shdon), str(d.nbmst));
    return toDetailRows(d, sttOf.get(key) ?? 0, replacedBy);   // ← truyền replacedBy
  });
}, [savedDetailsQuery.data, rows]);
```

**Điểm tinh tế:** `buildReplacedByMap(details)` lấy `details` từ **cùng truy vấn** `savedDetailsQuery` đang dựng detailRows — tức cùng khoảng thời gian, cùng bộ lọc. Đây là điều kiện cần để HĐ thay thế (`2/3`) và HĐ bị thay thế (`4/5`) cùng xuất hiện trong lô; nếu không, bản đồ ngược sẽ thiếu. `useMemo` tái dựng mỗi khi `savedDetailsQuery.data` đổi (poll ngầm điền dần → cột ghi chú cũng điền dần).

## 6. Nơi gọi #2 — `exportBundle.ts` (xuất file Excel + PDF hàng loạt)

File: [exportBundle.ts](../../src/features/hddt/exportBundle.ts)

Luồng xuất file tổng hợp cũng cần cùng cơ chế — nếu không, Excel xuất ra sẽ thiếu cột "bị thay thế bởi" mà web lại có. Sửa cùng một cách:

```ts
import { buildReplacedByMap, toDetailRows } from "./detailRow";
// ...
if (formats.excel) {
  // Bản đồ ngược "HĐ này bị HĐ nào thay thế/điều chỉnh" — dựng cùng khoảng (xem detailRow.ts).
  const replacedBy = buildReplacedByMap(details);
  const detailRows = details.flatMap((d) =>
    toDetailRows(d, sttOf.get(detailInvoiceKey(d)) ?? 0, replacedBy),   // ← truyền replacedBy
  );
  const buffer = await buildSummaryWorkbookBuffer(overviewRows, detailRows, direction, range);
  await writeFile(rangeDir, summaryWorkbookFilename(direction, range), buffer);
}
```

`sttOf` ở đây là `invoiceSttMap(overviewRows)` — ánh xạ số thứ tự từ bảng Tổng quát (đã có từ trước commit). `detailInvoiceKey(d)` là helper trích khóa định danh từ detail thô (tương đương `invoiceKey(...)` bên web).

> **Quan trọng về tính nhất quán:** cả hai nơi gọi (web + xuất file) dựng `replacedBy` từ **cùng biến `details`** mà chúng đangflatMap. Đảm bảo "đường lưỡi dao" — không có HĐ nào được mô tả là "bị thay thế" trên web nhưng trắng trên Excel hoặc ngược lại.

## 7. Vấn đề 2 — Cột "Các trường hợp đặc biệt" tự sinh cảnh báo

Trước commit, cột `ghiChuDacBiet` ở cả hai chiều đều là `value: () => undefined` (luôn rỗng) — tài liệu cũ thẳng thắn ghi: *"CÒN ĐÚNG MỘT CỘT CHƯA CÓ NGUỒN DỮ LIỆU… phải chốt bộ quy tắc nghiệp vụ trước."* Commit này chốt **hai quy tắc đầu tiên**.

### 7.1. `templates/dauVao.ts` (đầu vào — mua)

File: [templates/dauVao.ts](../../src/features/hddt/templates/dauVao.ts)

```ts
{
  // Cột nghiệp vụ do kế toán tự đánh dấu — chưa có chỗ nhập.
  key: "ghiChuDacBiet",
  header: "Ghi Chú: Các trường hợp đặc biệt kế toán xem xét kỹ hơn",
  width: 30,
  value: (r) => {
    const warnings: string[] = [];
    if (!r.buyerDiaChi) warnings.push("Thiếu địa chỉ người mua");
    if (r.trangThaiHd === "4") warnings.push("Hóa đơn này không được kê khai (do hóa đơn đã bị thay thế)");
    return warnings.length > 0 ? warnings.join(". ") : undefined;
  },
},
```

### 7.2. `templates/dauRa.ts` (đầu ra — bán)

File: [templates/dauRa.ts](../../src/features/hddt/templates/dauRa.ts)

```ts
{
  key: "ghiChuDacBiet",
  header: "Ghi Chú: Các trường hợp đặc biệt kế toán xem xét kỹ hơn",
  width: 30,
  value: (r) => {
    const warnings: string[] = [];
    if (!r.buyerDiaChi) warnings.push("Thiếu địa chỉ người mua");
    if (r.trangThaiHd === "4") warnings.push("Hóa đơn này không được kê khai ");
    return warnings.length > 0 ? warnings.join(". ") : undefined;
  },
},
```

#### Hai quy tắc cảnh báo

1. **`!r.buyerDiaChi`** — thiếu địa chỉ người mua. Đồng bộ với lớp tô màu `WARNING_FILL` ở commit trước ([commit 12bc60e](./commit_12bc60e_detail-row-fill.md)): cùng một điều kiện, một bên tô hàng xám, một bên ghi chữ vào ô cảnh báo — hai kênh cùng nhắc.
2. **`r.trangThaiHd === "4"`** — hóa đơn **đã bị thay thế**. Theo quy định, hóa đơn bị thay thế **không được kê khai** thuế (chỉ HĐ thay thế mới kê khai). Đây là cảnh báo nghiệp vụ quan trọng: kế toán phải loại HĐ này khỏi tờ khai.

#### Gom nhiều cảnh báo trong một ô

Dùng pattern "push vào mảng rồi `join('. ')`" thay vì if-else lồng:
- Một hóa đơn có thể **vừa** thiếu địa chỉ **vừa** bị thay thế → ghi `"Thiếu địa chỉ người mua. Hóa đơn này không được kê khai (…)"`.
- Không có cảnh báo nào → trả `undefined` → ô Excel TRỐNG (không phải chuỗi rỗng), web hiện `—` (theo quy ước `renderCell`).

#### Khác biệt nhỏ giữa hai chiều

Câu cảnh báo "không được kê khai" ở `dauVao.ts` đầy đủ hơn (`(do hóa đơn đã bị thay thế)`), còn `dauRa.ts` để ngắn (`"Hóa đơn này không được kê khai "` — có khoảng trắng thừa ở cuối). Đây là **điều chưa được dọn** trong commit — nếu cần gọt chữ sau, sửa ở cả hai file (kiến trúc "mỗi chiều một file" bắt buộc đồng bộ thủ công, đã được doc cũ cảnh báo).

> Điểm mở rộng sau này: chỉ cần `warnings.push(...)` thêm điều kiện. Các ứng cử viên kế toán từng nhắc: HĐ thiếu mã số thuế người mua nhưng có tên đơn vị, HĐ tiền = 0, HĐ ngày ký > ngày lập… Mỗi quy tắc là một dòng `push`.

## 8. Dọn dẹp kèm theo

### 8.1. Xóa block doc lỗi thời trong `dauRa.ts`

Block JSDoc dài ngay trên `detailDauRa()` mô tả "46 cột" và chép lại cảnh báo về cột `ghiChuDacBiet` *"chưa có nguồn dữ liệu"*. Sau khi cột đó đã được triển khai (§7.2), block này trở thành **sai** — xóa đi. Phần doc đó nói chung đã được che phủ bởi comment tại chỗ ở [detailRow.ts](../../src/features/hddt/detailRow.ts).

### 8.2. Bỏ comment thừa `// || undefined`

Một comment `// \`|| undefined\` để ô rỗng đi theo quy ước chung…` bị xóa — quy ước đó giờ được hiểu từ chính signature `value` (trả `undefined` = ô trống), không cần nhắc lại mỗi cột.

## 9. Tương tác với commit trước (`12bc60e`)

Hai commit tạo nên một hệ thống cảnh báo **đa kênh, nhất quán** cho cùng dấu hiệu:

| Dấu hiệu | Tô màu hàng (commit `12bc60e`) | Cột cảnh báo (commit `fc9c179`) | Cột ghi chú liên quan |
|---|---|---|---|
| Thiếu địa chỉ người mua | xám nhạt (`WARNING_FILL`) | "Thiếu địa chỉ người mua" | — |
| Đã bị thay thế (`tthai=4`) | cam nhạt (`TRANG_THAI_HD_FILL["4"]`) | "Hóa đơn này không được kê khai" | "Bị thay thế bởi hóa đơn …" |
| Đã bị điều chỉnh (`tthai=5`) | cam | — *(chưa thêm quy tắc)* | "Bị điều chỉnh bởi hóa đơn …" |
| Thay thế (`tthai=2`) | xanh nhạt | — | "Thay thế cho hóa đơn …" |
| Điều chỉnh (`tthai=3`) | vàng nhạt | — | "Điều chỉnh cho hóa đơn …" |
| Bị hủy (`tthai=6`) | hồng + chữ đỏ | — | — |

**Quy tắc chung đã thành hình:** màu trạng thái thắng màu cảnh báo; chữ cảnh báo độc lập và chỉ thêm thông tin mà màu không nói được được (lí do cụ thể "tại sao cần xem xét kỹ"). Kế toán lướt nhìn màu để định vị, đọc chữ để biết lý do.

## 10. Files & code tương ứng (tham chiếu nhanh)

| File (sau commit) | Vai trò trong commit |
|---|---|
| [detailRow.ts](../../src/features/hddt/detailRow.ts) | `ReplacedByMap`, `buildReplacedByMap`, `tinhGhiChuLienQuan`, `toDetailRows` + `replacedBy` |
| [components/InvoiceListTabs.tsx](../../src/features/hddt/components/InvoiceListTabs.tsx) | Nơi gọi (web): dựng map, truyền vào `toDetailRows` |
| [exportBundle.ts](../../src/features/hddt/exportBundle.ts) | Nơi gọi (xuất file): dựng map, truyền vào `toDetailRows` |
| [templates/dauVao.ts](../../src/features/hddt/templates/dauVao.ts) | Cột `ghiChuDacBiet` (mua) — 2 quy tắc cảnh báo |
| [templates/dauRa.ts](../../src/features/hddt/templates/dauRa.ts) | Cột `ghiChuDacBiet` (bán) — 2 quy tắc cảnh báo + xóa doc cũ |

> Trước đó, commit [12bc60e](./commit_12bc60e_detail-row-fill.md) đã đặt nền móng `detailRowFill` tô màu cảnh báo. Commit này hoàn thiện nốt phần chữ giải thích đi kèm màu.
