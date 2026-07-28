# 12 — Quy ước lập trình & lint

## 12.1. Cấu hình ESLint

```js
// eslint.config.js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,   // v7 — có luật mới, xem 12.2
      reactRefresh.configs.vite,             // ảnh hưởng cách tách file, xem 12.3
    ],
    languageOptions: { globals: globals.browser },
  },
])
```

Chạy `npm run lint` trước khi tạo pull request. Dự án hiện **không có cảnh báo nào** — hãy giữ nguyên tình trạng đó.

## 12.2. Luật mới của `eslint-plugin-react-hooks` v7

Phiên bản 7 (đi cùng React 19) thêm các luật mà React 18 không có. Đây là nguồn gốc của mọi dòng `eslint-disable` trong dự án.

### `react-hooks/set-state-in-effect`

Luật này cấm gọi `setState` trong `useEffect` khi có thể tính giá trị lúc render. Dự án có **bốn** chỗ vi phạm hợp lệ, tất cả đều thuộc mẫu "**đặt lại form khi mở dialog**":

```tsx
// CompanyFormDialog
useEffect(() => {
  if (!open) return;
  // Nạp lại form mỗi lần mở dialog (tạo mới hoặc sửa) — cố ý reset theo state ngoài.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  setTenCongTy(company?.tenDonVi ?? "");
  setMaSoThue(company?.maSoThue ?? "");
  /* … */
  // Xóa luôn MST của lần mở trước, nếu không query cũ còn cache sẽ điền đè lên form vừa reset.
  setDebouncedMst("");
}, [open, company]);
```

Vì sao đây là ngoại lệ hợp lệ: form là **state không được kiểm soát** — người dùng gõ vào và giá trị phải giữ nguyên. Không thể tính nó lúc render từ props. Nhưng khi dialog mở lại cho một công ty khác, nó **phải** được nạp lại. Đây đúng là tình huống mà luật không bao phủ.

**Quy ước:** mỗi `eslint-disable` phải có comment tiếng Việt ngay phía trên giải thích **vì sao**. Không có `eslint-disable` trần.

### Điều chỉnh state ngay trong render

Với những trường hợp *có thể* tính lúc render, dự án dùng mẫu chính thức của React thay vì effect:

```tsx
// Đổi công ty -> bỏ hóa đơn đang chọn (id thuộc tenant cũ) và đóng dialog. Điều chỉnh state NGAY
// trong render theo mẫu "lưu giá trị trước" của React (tránh setState trong effect gây render dây
// chuyền — cùng lý do effect ở trên chỉ bump ref chứ không setState).
const prevCompanyRef = useRef(currentCompanyId);
if (prevCompanyRef.current !== currentCompanyId) {
  prevCompanyRef.current = currentCompanyId;
  if (selectedId !== null) setSelectedId(null);
  if (viewOpen) setViewOpen(false);
}
```

React thấy `setState` trong lúc render sẽ render lại ngay **trước khi vẽ ra màn hình** — không có lượt vẽ trung gian với dữ liệu sai như khi dùng effect.

Điều kiện `if (selectedId !== null)` không thừa: gọi `setState` với giá trị đang có vẫn tạo một lượt render.

### `react-hooks/purity`

Luật này cấm gọi hàm không thuần khiết trong thân component. `Date.now()` là một ví dụ — nó bị chặn ngay cả khi bạn gọi nó trong một hàm sẽ chạy lúc xử lý sự kiện:

```tsx
/**
 * [DEBUG-SYNC] Đồng hồ đo từ lúc bấm nút. Đặt ở module scope vì `Date.now()` gọi trong thân
 * component bị rule `react-hooks/purity` chặn (nó không phân biệt được render với event handler).
 */
function startTimer(): () => string {
  const t0 = Date.now();
  return () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
}
```

Cách xử lý: đưa hàm ra **phạm vi module** (ngoài component). Luật chỉ soi thân component.

### `react-hooks/exhaustive-deps`

Có hai chỗ tắt luật này, cả hai đều thuộc nhóm "effect chỉ nên chạy khi một số điều kiện đổi":

```tsx
useEffect(() => {
  if (!active || !currentCompanyId) return;
  /* … nối lại lượt cập nhật đang chạy … */
  // Chỉ chạy khi mở tab / đổi công ty; `watchUpdateRun` tự chặn trùng bằng ref.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [active, currentCompanyId, direction]);
```

Ở đây `watchUpdateRun` bị bỏ khỏi mảng phụ thuộc — nó đổi định danh mỗi lần render, đưa vào sẽ khiến effect chạy lại liên tục. An toàn vì bản thân `watchUpdateRun` đã tự chặn chạy trùng bằng `updatePollingRef`.

**Trước khi tắt `exhaustive-deps`, hãy thử ba cách này:**

1. Bọc hàm bằng `useCallback` với mảng phụ thuộc ổn định.
2. Đưa hàm vào một `useRef` (xem mẫu `onCloseRef` ở [chương 10](10-luong-nghiep-vu.md#102-đăng-nhập-thuế-điện-tử-gdt-với-captcha)).
3. Chuyển logic ra ngoài component.

Chỉ tắt luật khi cả ba đều không phù hợp, và ghi rõ vì sao.

## 12.3. `react-refresh/only-export-components`

Luật này khiến file chứa component **chỉ nên export component**. Đó là lý do cấu trúc ba file của mỗi context:

```
features/auth/
├── context.ts          createContext (không phải component)
├── AuthContext.tsx     AuthProvider (component)
└── useAuth.ts          hook (không phải component)
```

Gộp lại thì Fast Refresh không thay nóng được — mỗi lần sửa `AuthContext.tsx` sẽ tải lại toàn bộ ứng dụng và bạn phải đăng nhập lại.

Ngoại lệ: `theme/displaySettings.ts` chứa cả `createContext`, `useDisplaySettings`, `buildTheme` — nhưng **không** chứa component nào, nên luật không áp dụng. Component `DisplaySettingsProvider` nằm ở file riêng.

## 12.4. Quy ước đặt tên

### Tên theo miền nghiệp vụ, giữ nguyên tiếng Việt không dấu

Dự án dùng thuật ngữ thuế Việt Nam làm tên biến:

```ts
export interface InvoiceQuery {
  /** yyyy-MM-dd — bắt buộc */
  tuNgay: string;
  /** yyyy-MM-dd — bắt buộc */
  denNgay: string;
  trangThaiHd?: string;
  ketQuaHd?: string;
  /** MST đối tác — người bán (purchase) hoặc người mua (sold) tùy `direction` */
  mstDoiTac?: string;
  mauHd?: string;
  soSeri?: string;
  soHd?: string;
}
```

Đây là chủ ý, không phải cẩu thả. Kế toán nói "từ ngày", "ký hiệu mẫu số", "mã số thuế" — dịch sang `fromDate`, `templateCode`, `taxCode` tạo thêm một lớp phải dịch ngược mỗi khi đối chiếu với yêu cầu nghiệp vụ hoặc tài liệu của Tổng cục Thuế.

**Quy tắc:** thuật ngữ nghiệp vụ giữ tiếng Việt không dấu; thuật ngữ kỹ thuật dùng tiếng Anh.

```ts
// Nghiệp vụ -> tiếng Việt
tuNgay, denNgay, maSoThue, tenDonVi, hoaDon, dienGiai

// Kỹ thuật -> tiếng Anh
loading, error, enabled, direction, status, handler
```

Một số tên là **trường thô từ GDT**, giữ nguyên như GDT trả về:

```ts
export interface InvoiceRaw {
  khmshdon: string;   // ký hiệu mẫu số hóa đơn
  khhdon: string;     // ký hiệu hóa đơn
  shdon: string;      // số hóa đơn
  tdlap: string;      // thời điểm lập
  tthai: string;      // trạng thái
  ttxly: string;      // trạng thái xử lý
  tgtttbso: number;   // tổng giá trị thanh toán bằng số
  /* … */
}
```

Không đổi tên chúng. Giữ nguyên để đối chiếu được với tài liệu GDT và log của backend.

Ranh giới đổi tên nằm ở các hàm biến đổi: `toDisplayRow` chuyển `InvoiceRaw` (tên GDT) sang `DisplayRow` (tên dễ đọc). Từ đó trở đi, giao diện chỉ làm việc với tên dễ đọc.

### Tên biến trạng thái

| Mẫu | Nghĩa |
|---|---|
| `xxxOpen` | Dialog/menu đang mở |
| `xxxRunning` | Tác vụ nền đang chạy |
| `xxxLoading` | Đang chờ một request |
| `xxxRef` | `useRef` |
| `handleXxx` | Trình xử lý sự kiện |
| `useXxxQuery` / `useXxxMutation` | Hook TanStack Query |

## 12.5. Quy ước comment

Đây là điểm phân biệt rõ nhất của codebase này: **comment giải thích quyết định, không mô tả code**.

### Mẫu JSDoc cho hàm gọi API

```ts
/**
 * GET /api/v1/gdt/captcha → { key, content (SVG) }.
 * Dùng: `DialogLoginHddt` (queryFn của captchaQuery — lấy ảnh captcha mỗi lần mở dialog).
 */
export async function getCaptcha(): Promise<CaptchaInfo> {
  return apiFetch<CaptchaInfo>("/gdt/captcha");
}
```

Ba phần bắt buộc: **method + path**, **hình dạng dữ liệu trả về**, và **ai gọi hàm này**.

Phần "Dùng:" đặc biệt có giá trị — nó cho bạn biết ngay ảnh hưởng khi sửa hàm, không cần tìm kiếm toàn dự án.

### Mẫu JSDoc cho component

```tsx
/**
 * Dialog "Xem hóa đơn" — dựng tờ hóa đơn GTGT theo bố cục bản in Tổng cục Thuế từ chi tiết ĐÃ LƯU
 * (đọc DB, không gọi GDT), có nút In (in qua iframe ẩn). HTML tờ hóa đơn do `renderInvoiceHtml`
 * dựng (dùng chung với luồng xuất file .html/.pdf) nên bản xem/in/xuất giống hệt nhau. Dùng:
 * `InvoiceTablePanel` (chọn 1 dòng ở bảng "Tổng quát" rồi bấm "Xem hóa đơn").
 */
```

### Comment nội dòng: viết cái "vì sao"

```ts
// ❌ mô tả cái đã hiển nhiên
// Tăng biến đếm lên 1
runIdRef.current += 1;

// ✔ giải thích quyết định
// Đổi công ty giữa chừng -> hủy tiến trình đang chạy (id hóa đơn thuộc tenant cũ, sai ở tenant mới).
// Chỉ bump ref ở đây (không setState trong effect); nhánh hủy trong vòng lặp sẽ reset state.
runIdRef.current += 1;
```

Khi một quyết định đến từ **một lỗi đã gặp**, hãy ghi lại lỗi đó:

```ts
// Gắn MST người bán để KHÔNG trùng tên: chiều mua vào gộp HĐ của nhiều người bán, `kyHieu-soHd`
// chỉ unique theo từng người bán -> thiếu MST sẽ ghi đè lẫn nhau (mất file).
```

Người đọc sau này sẽ không "dọn dẹp" đoạn code đó nữa.

### Viết hoa để nhấn mạnh

Codebase dùng chữ IN HOA cho từ khóa quan trọng: `KHÔNG`, `PHẢI`, `ĐÚNG 1 lần`, `TOÀN BỘ`, `CHẠY NỀN`, `DUY NHẤT`. Dùng tiết kiệm, chỉ ở chỗ hiểu sai sẽ gây lỗi.

## 12.6. Quy ước thông báo cho người dùng

**Hai kênh, hai mục đích. Không trộn lẫn.**

| Kênh | Dùng cho | Ví dụ |
|---|---|---|
| **Toast** (`react-toastify`) | Sự kiện xảy ra một lần rồi thôi | "Đã tải chi tiết 40/40 hóa đơn." |
| **`Alert` inline** | Trạng thái kéo dài, còn đó tới khi khắc phục | "Không đọc được hóa đơn đã lưu." |

Quy ước này được ghi ngay trong code:

```tsx
{/* Lỗi đọc DB là trạng thái kéo dài -> để inline; các thông báo sự kiện (lưu/tải/lỗi thao
    tác) dùng toast (react-toastify) trong các handler. */}
{savedQuery.isError && (
  <Alert severity="error" sx={{ mb: 2 }}>
    {getErrorMessage(savedQuery.error, "Không đọc được hóa đơn đã lưu.")}
  </Alert>
)}
```

Lý do: lỗi đọc dữ liệu là **trạng thái của màn hình** — bảng đang trống vì lỗi này. Toast biến mất sau 3 giây, để lại bảng trống không giải thích được. Ngược lại, "đã tải xong 40 hóa đơn" là **một sự kiện** — hiển thị nó vĩnh viễn trên màn hình là vô nghĩa.

### Một toast cập nhật dần cho tác vụ dài

```ts
const toastId = toast.loading("Đang tải chi tiết hóa đơn…");
/* … trong vòng poll … */
toast.update(toastId, { render: `Đang tải chi tiết hóa đơn ${status.done}/${status.total}…` });
/* … khi xong … */
toast.update(toastId, {
  render: `Đã tải chi tiết ${status.ok}/${status.total} hóa đơn.`,
  type: "success",
  isLoading: false,
  autoClose: 4000,
});
```

**Không** tạo toast mới mỗi nhịp poll — người dùng sẽ thấy hàng chục thông báo chồng lên nhau.

### Mức độ thông báo

| Mức | Khi nào |
|---|---|
| `success` | Hoàn tất trọn vẹn |
| `warning` | Hoàn tất **một phần** — có lỗi lẻ, token hết hạn, dữ liệu chưa đủ |
| `error` | Thất bại hẳn |
| `info` | Thông tin trung tính, không phải kết quả |

Mức `warning` được dùng nhiều hơn thường lệ, vì đặc thù nghiệp vụ: một lượt đồng bộ "xong nhưng thiếu 3 hóa đơn" **không phải** thành công.

```ts
if (st.partial) return { render: `${base}. CHƯA lấy hết: ${st.message}`, type: "warning" };
if (st.detail.err > 0) return { render: `${base} (${st.detail.err} lỗi).`, type: "warning" };
return { render: `${base}.`, type: "success" };
```

### Thông báo phải nói người dùng cần làm gì

```
❌ "Token hết hạn."
✔ "Token Thuế điện tử hết hạn — đã tải 12/40. Đăng nhập lại rồi bấm tải tiếp."

❌ "Lỗi."
✔ "Mất kết nối khi theo dõi tiến độ — lượt vẫn chạy ở máy chủ, mở lại tab để xem tiếp."

❌ "Không xuất được."
✔ "Còn hóa đơn chưa tải chi tiết — Mua vào: 3/40, Bán ra: 0/12. Hãy đồng bộ hoàn thành cả 2 chiều trước khi xuất."
```

Công thức: **chuyện gì xảy ra + đã làm được bao nhiêu + bước tiếp theo là gì**.

## 12.7. Quy ước TypeScript

### Không dùng `any`

Với dữ liệu chưa biết hình dạng, dùng `unknown` rồi thu hẹp dần:

```ts
function toItem(raw: unknown): InvoiceViewItem {
  const it = (raw ?? {}) as Record<string, unknown>;
  return {
    tenHang: s(pick(it, "ten", "thang")),
    /* … */
  };
}
```

### `as const` cho bảng tra cứu

```ts
export const TRANG_THAI_HD_OPTIONS = [
  { value: "", label: "Tất cả" },
  { value: "1", label: "Hóa đơn mới" },
  /* … */
] as const;
```

Giữ được kiểu literal của từng giá trị thay vì bị mở rộng thành `string`.

### Type predicate khi lọc

```ts
const views = details
  .map((d) => toInvoiceView(d))
  .filter((v): v is InvoiceView => v !== null);
```

Không có `: v is InvoiceView`, TypeScript vẫn coi mảng kết quả là `(InvoiceView | null)[]`.

### Kiểu chung khai báo ở `types/index.ts` của feature

Kiểu chỉ dùng trong một file thì để tại chỗ. Kiểu dùng ở nhiều file thì đưa vào `types/index.ts` của feature đó.

## 12.8. Log để chẩn đoán

Dự án có một số `console.log` **cố ý giữ lại**, đánh dấu bằng tiền tố có thể tìm kiếm:

```ts
console.log(
  `[DEBUG-CAPNHAT][FE] Bấm CẬP NHẬT TỪ THUẾ ĐIỆN TỬ ${direction} ${filters.tuNgay}..${filters.denNgay}`,
);
```

```ts
console.log(`[DEBUG-SYNC][FE] Lượt nền đã khởi động sau ${since()}:`, started);
```

Chúng phục vụ việc đối chiếu mốc thời gian giữa frontend và backend khi một lượt đồng bộ dài gặp sự cố. Quy ước tiền tố:

- `[DEBUG-<TÊN LUỒNG>][FE]` — log chẩn đoán chủ ý giữ lại.
- Không có tiền tố — log tạm, **phải xóa trước khi commit**.

`console.error` và `console.warn` cho lỗi thật thì không cần tiền tố:

```ts
console.error(
  `[exportBundle] Lỗi xuất hóa đơn ${t.direction}/${base} | message: ${msg}\n`,
  e instanceof Error ? e.stack : e,
);
```

## 12.9. Danh sách kiểm tra trước khi tạo pull request

1. `npm run lint` — không cảnh báo.
2. `npm run build` — không lỗi kiểu.
3. Mỗi `eslint-disable` mới có comment giải thích.
4. Hàm/component mới có JSDoc kèm phần "Dùng:".
5. Query mới gắn `currentCompanyId` vào key (nếu đọc dữ liệu tenant).
6. Luồng mới cần token GDT có chốt chặn lệch MST.
7. Không còn `console.log` tạm.
8. Thông báo lỗi bằng tiếng Việt và nói được bước tiếp theo.

---

**Trước:** [11 — Pipeline xuất file](11-pipeline-xuat-file.md) · **Tiếp theo:** [13 — Hướng dẫn mở rộng](13-huong-dan-mo-rong.md)
