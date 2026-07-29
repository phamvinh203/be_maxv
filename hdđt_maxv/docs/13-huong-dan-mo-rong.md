# 13 — Hướng dẫn mở rộng

Chương công thức. Mỗi mục là một việc thường gặp, liệt kê **đúng những file phải sửa**.

---

## 13.1. Thêm một endpoint mới

**Ví dụ:** thêm `GET /gdt/invoices/:direction/summary` trả tổng tiền theo khoảng.

### Bước 1 — Khai báo kiểu

`src/features/hddt/types/index.ts`:

```ts
/** Tổng hợp số tiền hóa đơn trong khoảng — GET /gdt/invoices/:direction/summary. */
export interface InvoiceSummary {
  total: number;
  tongChuaThue: number;
  tongThue: number;
  tongThanhToan: number;
}
```

### Bước 2 — Hàm gọi API

`src/features/hddt/api/gdt.ts` (hoặc file mới trong `api/`):

```ts
/**
 * GET /gdt/invoices/:direction/summary → tổng tiền hóa đơn đã lưu trong khoảng (đọc DB,
 * KHÔNG cần token GDT).
 * Dùng: `useInvoiceSummaryQuery` — khối tổng hợp dưới bảng hóa đơn.
 */
export function getInvoiceSummary(
  direction: InvoiceDirection,
  query: InvoiceQuery,
): Promise<InvoiceSummary> {
  const params = buildInvoiceParams(direction, query);
  return apiFetch<InvoiceSummary>(
    `/gdt/invoices/${direction}/summary?${params.toString()}`,
  );
}
```

Dùng lại `buildInvoiceParams` — nó xử lý việc đổi tên tham số MST đối tác theo chiều:

```ts
/** Query param bên BE giữ tên MST đối tác khác nhau theo chiều hóa đơn. */
const PARTNER_PARAM: Record<InvoiceDirection, string> = {
  purchase: "mstNguoiBan",
  sold: "mstNguoiMua",
};
```

Tự dựng query string bằng tay sẽ quên chi tiết này và bộ lọc MST đối tác im lặng không hoạt động.

### Bước 3 — Hook query

`src/features/hddt/api/invoiceQueries.ts`:

```ts
export const invoiceKeys = {
  byCompany: (companyId: string | null) => ["savedInvoices", companyId] as const,
  savedByDirection: (companyId, direction) => [...] as const,
  saved: (companyId, direction, query) => [...] as const,
  /** THÊM: key tổng hợp số tiền theo khoảng. */
  summary: (companyId: string | null, direction: InvoiceDirection, query: InvoiceQuery) =>
    ["savedInvoices", companyId, direction, "summary", query] as const,
};

export function useInvoiceSummaryQuery(
  direction: InvoiceDirection,
  query: InvoiceQuery,
  enabled: boolean,
) {
  const { isAuthenticated, currentCompanyId } = useAuth();
  return useQuery({
    queryKey: invoiceKeys.summary(currentCompanyId, direction, query),
    queryFn: () => getInvoiceSummary(direction, query),
    enabled:
      enabled && isAuthenticated && !!currentCompanyId && !!query.tuNgay && !!query.denNgay,
  });
}
```

Đặt key dưới tiền tố `["savedInvoices", companyId, direction]` để `invalidateSavedList()` sẵn có tự động làm mới nó — không phải sửa thêm chỗ nào.

### Bước 4 — Dùng ở component

```tsx
const summaryQuery = useInvoiceSummaryQuery(direction, buildQuery(appliedFilters), active);
```

### Bước 5 — Cập nhật tài liệu

Thêm dòng vào [chương 14 — Hợp đồng API](14-hop-dong-api.md).

### Danh sách kiểm tra

- [ ] Kiểu đặt ở `types/index.ts`
- [ ] Hàm API có JSDoc: method + path + "Dùng:"
- [ ] Chọn đúng `apiFetch` / `apiFetchData` theo envelope
- [ ] Key gắn `currentCompanyId`
- [ ] Key nằm dưới tiền tố phù hợp để invalidate sẵn có phủ được
- [ ] `enabled` đủ bốn điều kiện
- [ ] Cần token GDT thì truyền qua header `X-Gdt-Token`

---

## 13.2. Thêm một cột vào bảng hóa đơn

**Ví dụ:** thêm cột "Ghi chú" vào bảng Tổng quát.

### (1) Kiểu dòng hiển thị — `types/index.ts`

```ts
export interface DisplayRow {
  /* … */
  /** Ghi chú trên hóa đơn (trường `ghichu` của GDT). */
  ghiChu: string;
}
```

### (2) Hàm biến đổi — `invoiceRow.ts`

```ts
export function toDisplayRow(r: InvoiceRaw, direction: InvoiceDirection): DisplayRow {
  return {
    /* … */
    ghiChu: rowStr(r.ghichu),
  };
}
```

### (3) Cột — `templates/dauVao.ts` và/hoặc `templates/dauRa.ts`

Mỗi chiều một file. Thêm vào hàm `overviewDauVao()` (đầu vào) hay `overviewDauRa()` (đầu ra):

```ts
{ key: "ghiChu", header: "Ghi chú", width: 30, value: (r) => r.ghiChu },
```

**Một dòng là xong cho chiều đó.** Bảng trên màn hình và sheet Excel đều render từ mảng này, nên cột xuất hiện ở cả hai nơi cùng lúc — không thể thêm vào bảng mà quên Excel như trước.

> Cột cần có ở **cả hai** chiều thì phải thêm vào cả hai file. Đây là cái giá của việc tách chiều; đổi lại sửa một chiều không đụng chiều kia.

Muốn cột hiển thị khác trên web (ô có màu, dấu "—" khi rỗng) thì thêm `cell`; muốn cột chỉ có trên web thì thêm `webOnly: true`:

```ts
{
  key: "ghiChu",
  header: "Ghi chú",
  width: 30,
  value: (r) => r.ghiChu,          // Excel + CSV
  cell: (r) => r.ghiChu || NO_DATA_YET,  // web
},
```

### (4) Tùy chọn — cột sao lưu CSV, `templates/backupColumns.ts`

Chỉ thêm nếu cột thuộc nhóm thông tin cần sao lưu. Danh sách này cố ý hẹp hơn.

### Bảng đối chiếu

| Nơi | File | Bắt buộc? |
|---|---|:--:|
| Kiểu dòng | `types/index.ts` | ✔ |
| Biến đổi dữ liệu | `invoiceRow.ts` | ✔ |
| Cột (web + Excel) — đầu vào | `templates/dauVao.ts` → `overviewDauVao` | ✔ nếu cột thuộc chiều này |
| Cột (web + Excel) — đầu ra | `templates/dauRa.ts` → `overviewDauRa` | ✔ nếu cột thuộc chiều này |
| Cột CSV sao lưu | `templates/backupColumns.ts` | tùy |

Với bảng **Chi tiết hóa đơn**, thay `DisplayRow`/`invoiceRow.ts` bằng `DetailRow`/`detailRow.ts`, và `overviewDauVao`/`overviewDauRa` bằng `detailDauVao`/`detailDauRa` (cùng file).

---

## 13.3. Thêm một ô lọc

**Ví dụ:** lọc theo "Mã cơ quan thuế".

### (1) Kiểu giá trị bộ lọc

```ts
// types/index.ts
export interface InvoiceFilterValues {
  /* … */
  maCqt: string;
}

export interface InvoiceQuery {
  /* … */
  maCqt?: string;
}
```

### (2) Giá trị mặc định — hai chỗ

```ts
// InvoiceFilterPanel.tsx
const EMPTY_FILTERS: InvoiceFilterValues = {
  /* … */
  maCqt: "",
};
```

```ts
// InvoiceListTabs.tsx
function defaultMonthFilters(): InvoiceFilterValues {
  return {
    ...currentMonthRange(),
    /* … */
    maCqt: "",
  };
}
```

Sót chỗ thứ hai thì nút "Bỏ tìm kiếm" không xóa được ô mới.

### (3) Ô nhập trên giao diện

```tsx
<TextField
  label="Mã cơ quan thuế"
  value={values.maCqt}
  onChange={setField("maCqt")}
  size="small"
  fullWidth
/>
```

`setField` là hàm dựng sẵn, không cần viết handler riêng:

```tsx
const setField =
  (key: keyof InvoiceFilterValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [key]: e.target.value }));
  };
```

### (4) Đưa vào query

```ts
// InvoiceListTabs.tsx
function buildQuery(filters: InvoiceFilterValues): InvoiceQuery {
  return {
    tuNgay: filters.tuNgay,
    denNgay: filters.denNgay,
    /* … */
    maCqt: filters.maCqt || undefined,
  };
}
```

Mẫu `|| undefined` quan trọng: `buildInvoiceParams` bỏ qua giá trị falsy, nên chuỗi rỗng không lọt vào query string. Nhưng đưa `undefined` vào `queryKey` **vẫn tạo key khác** với việc không có trường đó — nên giữ nhất quán mẫu này ở mọi trường.

### (5) Backend phải hỗ trợ tham số mới

Không có phía backend thì ô lọc không có tác dụng. Nếu chưa làm được, hãy khóa ô và ghi lý do — như hai ô đang khóa hiện tại:

```tsx
<Tooltip title="Chưa hỗ trợ lọc theo CCCD">
  <TextField label={cccdLabel} size="small" fullWidth disabled />
</Tooltip>
```

---

## 13.4. Thêm một màn hình mới

**Ví dụ:** trang Báo cáo tại `/bao-cao`.

### (1) Component trang

`src/pages/BaoCaoPage.tsx`:

```tsx
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import AppHeader from "../components/AppHeader";

export default function BaoCaoPage() {
  return (
    <>
      <AppHeader />
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Báo cáo
        </Typography>
        {/* nội dung */}
      </Box>
    </>
  );
}
```

`AppHeader` render trong page chứ không ở `App.tsx`, vì các trang đăng nhập không có header.

### (2) Khai báo route

`src/routes/AppRouter.tsx`:

```tsx
<Route
  path="bao-cao"
  element={
    <ProtectedRoute>
      <BaoCaoPage />
    </ProtectedRoute>
  }
/>
```

Đặt **trước** `<Route path="*">`.

### (3) Đường dẫn tới màn hình

```tsx
// AppHeader.tsx — thêm nút
<Button color="inherit" onClick={() => navigate("/bao-cao")} sx={{ textTransform: "none" }}>
  Báo cáo
</Button>
```

### (4) Nếu màn hình có nhiều tab

Theo mẫu của `SettingsPage`: state cục bộ + ẩn bằng CSS, không tạo route con. Xem [chương 9, mục 9.7](09-dinh-tuyen.md#97-điều-hướng-bên-trong-trang--không-dùng-route).

---

## 13.5. Thêm một tác vụ nền

Xem đầy đủ ở [chương 8, mục 8.9](08-tac-vu-nen-va-poll.md#89-danh-sách-kiểm-tra-khi-thêm-một-tác-vụ-nền-mới). Tóm tắt các file:

| Việc | File |
|---|---|
| Kiểu trạng thái + hàm start/status + hàm poll | `features/hddt/api/<tên>Run.ts` |
| Cờ chống chạy trùng + bộ đếm lượt | component điều phối |
| Effect nối lại lượt khi mount | component điều phối |
| Khóa nút khi đang chạy | component điều phối |

Sao chép `api/updateRun.ts` làm khung — nó là bản đầy đủ nhất.

---

## 13.6. Thêm một định dạng xuất file

**Ví dụ:** thêm JSON bên cạnh HTML/XML/PDF.

### (1) Hàm sinh nội dung

`src/features/hddt/invoiceJson.ts`:

```ts
import type { InvoiceView } from "./invoiceView";

/**
 * Dựng JSON của 1 hóa đơn từ `InvoiceView`. Dùng: `exportBundle` (nút "Xuất file tổng hợp + hóa đơn").
 */
export function buildInvoiceJson(view: InvoiceView): string {
  return JSON.stringify(view, null, 2);
}
```

Nhận `InvoiceView`, **không** nhận payload GDT thô. Mọi định dạng xuất đều đi qua lớp chuẩn hóa này — xem [chương 11](11-pipeline-xuat-file.md#111-chuỗi-biến-đổi-dữ-liệu).

### (2) Mở rộng kiểu định dạng

```ts
// exportBundle.ts
export interface ExportFormats {
  html: boolean;
  xml: boolean;
  pdf: boolean;
  json: boolean;
}

interface InvoiceFileTask {
  direction: InvoiceDirection;
  view: InvoiceView;
  htmlDir: FsDirHandle | null;
  xmlDir: FsDirHandle | null;
  pdfDir: FsDirHandle | null;
  jsonDir: FsDirHandle | null;
}
```

### (3) Tạo thư mục con + ghi file

```ts
const jsonDir = formats.json ? await dirDir.getDirectoryHandle("json", { create: true }) : null;
```

```ts
if (t.jsonDir) await writeFile(t.jsonDir, `${base}.json`, buildInvoiceJson(t.view));
```

### (4) Ô tick trên giao diện

```tsx
// ExportFileDialog.tsx
const [formats, setFormats] = useState<ExportFormats>({
  html: true, xml: true, pdf: true, json: false,
});
```

```tsx
<FormControlLabel
  control={<Checkbox checked={formats.json} onChange={() => toggle("json")} />}
  label="Hóa đơn JSON"
/>
```

Điều kiện `anyFormat` cũng phải cập nhật:

```ts
const anyFormat = formats.html || formats.xml || formats.pdf || formats.json;
```

Có ở **hai** nơi — `ExportFileDialog.tsx` và `exportBundle.ts`.

---

## 13.7. Thêm một cài đặt hiển thị

**Ví dụ:** bật/tắt kẻ sọc xen kẽ cho bảng.

### (1) Kiểu + mặc định

```ts
// theme/displaySettings.ts
export interface DisplaySettings {
  mode: ThemeMode;
  accent: string;
  density: TableDensity;
  fontSize: FontSize;
  /** Kẻ sọc xen kẽ cho bảng nhiều dòng. */
  stripedRows: boolean;
}

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  /* … */
  stripedRows: false,
};
```

Không cần lo cho người dùng cũ — `loadDisplaySettings` trải mặc định lên trên dữ liệu đã lưu:

```ts
return { ...DEFAULT_DISPLAY_SETTINGS, ...(JSON.parse(raw) as Partial<DisplaySettings>) };
```

### (2) Áp vào theme

```ts
// buildTheme
components: {
  MuiTableCell: { styleOverrides: { root: { padding: cellPad }, sizeSmall: { padding: cellPad } } },
  ...(settings.stripedRows && {
    MuiTableRow: {
      styleOverrides: {
        root: { "&:nth-of-type(odd)": { backgroundColor: "rgba(0,0,0,0.02)" } },
      },
    },
  }),
},
```

### (3) Điều khiển trên giao diện

```tsx
// pages/settings/DisplayModeTab.tsx
<Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
    Kẻ sọc bảng
  </Typography>
  <Switch
    checked={settings.stripedRows}
    onChange={(e) => update({ stripedRows: e.target.checked })}
  />
</Paper>
```

`update()` nhận một phần cài đặt và tự lưu `localStorage` qua effect trong provider — không cần làm gì thêm.

---

## 13.8. Thêm một quy tắc kiểm tra form

Toàn bộ luật nằm ở `features/auth/validators/rules.ts`, mỗi hàm trả thông báo lỗi hoặc `undefined`:

```ts
/** Khớp `passwordRule` (zod): tối thiểu 8 ký tự, có ít nhất 1 chữ và 1 số. */
export function checkPassword(v: string): string | undefined {
  if (v.length < 8) return "Mật khẩu tối thiểu 8 ký tự.";
  if (!/[A-Za-z]/.test(v)) return "Mật khẩu phải có ít nhất 1 chữ cái.";
  if (!/[0-9]/.test(v)) return "Mật khẩu phải có ít nhất 1 chữ số.";
  return undefined;
}
```

Ghép lại trong validator của từng form:

```ts
export function validateRegisterForm(v: RegisterFormValues): RegisterFieldErrors {
  return pruneEmpty<RegisterFieldErrors>({
    hoTen: checkHoTen(v.hoTen),
    email: checkEmail(v.email),
    sdt: checkPhone(v.sdt),
    password: checkPassword(v.password),
    xacNhanMatKhau: checkPasswordConfirm(v.password, v.xacNhanMatKhau),
  });
}
```

`pruneEmpty` xóa các khóa không có lỗi, để `Object.keys(errors).length` phản ánh đúng số lỗi thật:

```ts
/**
 * Lọc cả `undefined` LẪN chuỗi rỗng: nếu sau này có hàm check trả `""` cho trường hợp hợp
 * lệ thì khóa đó vẫn tính là lỗi, chặn submit mà không hiện chữ nào — lỗi rất khó lần ra.
 */
```

> ⚠️ **Luật ở frontend phải khớp với zod ở backend.** Comment đầu file `rules.ts` nói rõ:
>
> Đặt riêng để đăng ký và đặt lại mật khẩu KHÔNG lệch nhau — backend cũng gom `passwordRule` vì cùng lý do: nếu luật đặt lại lỏng hơn luật đăng ký thì đó là một đường vòng để hạ cấp mật khẩu.
>
> Lệch nhau gây ra thông báo lỗi vô nghĩa cho người dùng, vì backend trả 400 kèm chi tiết nhưng **không có `message`**.

---

## 13.9. Bảng tra nhanh: "tôi muốn… thì sửa file nào"

| Muốn | File |
|---|---|
| Đổi nhãn/nút trên bảng hóa đơn | `InvoiceListTabs.tsx` |
| Đổi ô lọc | `InvoiceFilterPanel.tsx` + `InvoiceListTabs.tsx` (mặc định) |
| Đổi bố cục tờ hóa đơn | `invoiceHtml.ts` (`INVOICE_CSS` + `renderInvoiceHtml`) |
| Đổi ánh xạ trường GDT | `invoiceView.ts` (`toInvoiceView`) |
| Đổi cột bảng hóa đơn (web + Excel + CSV) | `templates/` |
| Đổi style/tên file Excel | `exportXlsx.ts` |
| Đổi cấu trúc thư mục xuất | `exportBundle.ts` |
| Đổi nhãn mã trạng thái | `api/gdt.ts` (`TRANG_THAI_HD_OPTIONS`, `KET_QUA_KIEM_TRA_OPTIONS`) |
| Đổi định dạng ngày / tiền | `dateUtils.ts` / `format.ts` |
| Đổi bảng màu, mật độ, cỡ chữ | `theme/displaySettings.ts` |
| Đổi cách xử lý lỗi 401 | `lib/http.ts` |
| Đổi số dòng mỗi trang | `InvoicePagination.tsx` |
| Đổi nhịp poll | `api/updateRun.ts`, `api/invoiceDetail.ts`, `SyncInvoiceDialog.tsx` |

---

**Trước:** [12 — Quy ước lập trình](12-quy-uoc-lap-trinh.md) · **Tiếp theo:** [14 — Hợp đồng API với be_maxv](14-hop-dong-api.md)
