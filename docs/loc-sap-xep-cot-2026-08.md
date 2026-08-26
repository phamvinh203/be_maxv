# Lọc/sắp xếp cột theo dòng cố định + phân trang — 08/2026

> Tài liệu mô tả các thay đổi thực hiện **trong phiên làm việc này** trên nhánh `dev_fe` (chưa
> commit), phạm vi module **Hóa đơn điện tử** (`features/hddt`) và **Dịch vụ công**
> (`features/dich_vu_cong`). Viết để người review hiểu **vì sao** từng quyết định tồn tại, không chỉ
> *nó làm gì*.
>
> **Không thuộc phạm vi tài liệu này** (là các thay đổi uncommitted khác, có sẵn từ trước khi phiên
> này bắt đầu, không đụng tới): `be_maxv/src/services/client/hddt/gdt.service.ts`,
> `hdđt_maxv/src/features/hddt/components/InvoiceFilterPanel.tsx`,
> `be_maxv/src/__tests__/gdtSavedWhere.test.ts`, thư mục `docs/` khác.

**Phạm vi:** 4 file sửa, 7 file mới, 2 file xóa (đã dời sang chỗ khác) — chia 6 nhóm. Nhóm 1–2 là
tính năng, nhóm 3–5 là hạ tầng/hoàn thiện, nhóm 6 là kết quả hai lượt `/code-review` + `/simplify`.

---

## 0. Bối cảnh: trạng thái trước khi có thay đổi

Mỗi cột của 2 bảng hóa đơn ("Tổng quát", "Chi tiết") có **một icon duy nhất** gộp cả sắp xếp lẫn lọc:
bấm mở popover, phần trên là 2 mục sắp xếp, phần dưới đổi hình dạng theo `mode` (`text`/`select`/
`range`) — gõ/chọn xong phải tự đóng popover hoặc chờ debounce mới thấy kết quả. Bảng "Dịch vụ công"
(`BangHoSo`) **không có** icon nào — tiêu đề cột là chữ tĩnh, không sort, không lọc, không phân trang
(cuộn dọc 520px, tối đa 500 dòng/lượt "Tìm kiếm").

---

## 1. Đổi cơ chế lọc cột: popover → dòng input cố định (bảng Hóa đơn điện tử)

### Yêu cầu

Bỏ phần lọc trong popover, thay bằng **một dòng ô input luôn hiển thị** ngay dưới hàng tiêu đề — gõ
là lọc sống, có icon kính lúp. Icon cạnh tên cột chỉ còn **sắp xếp**.

### Cách làm

- `ColumnFilterButton` (nay ở `src/components/`) rút gọn: bỏ hẳn `mode`/`value`/`onApply`/`options`/
  `rangeValue`, chỉ còn `label`/`sortDir`/`onSort`/`sortKind` — popover chỉ còn 2 `MenuItem` tăng/
  giảm.
- `ColumnFilterInput` (mới) — `TextField` nhỏ + icon `SearchRounded`, debounce 200ms (`LIVE_APPLY_MS`,
  export từ chính `ColumnFilterButton` để 2 nơi không tự khai 2 hằng số phải tay giữ đồng bộ), Enter/
  blur chốt ngay. Đồng bộ lại khi `value` đổi từ nơi khác (vd nút "Bỏ tìm kiếm") bằng mẫu "lưu giá
  trị trước" của React — **không** dùng `useEffect` gọi `setState` (phạm luật
  `react-hooks/set-state-in-effect` của React Compiler), và **không** dùng `useRef` đọc/ghi lúc render
  (phạm `react-hooks/refs`) — chỉ `useState` mới hợp lệ cho việc "điều chỉnh state khi 1 prop đổi".
- Cột số dạng khoảng (tiền, tỷ giá, số lượng, đơn giá...) — 1 ô, cú pháp:

  ```
  100-500   khoảng
  100- / >=100 / >100   từ 100 (inNumRange vốn LUÔN inclusive, > và >= không phân biệt được)
  -500 / <=500 / <500    đến 500
  100                    đúng bằng 100
  ```

  `parseRangeInput`/`inNumRange` (nay ở `src/utils/columnFilterText.ts`) diễn giải cú pháp này rồi tái
  dùng NGUYÊN state/lọc `{tu, den}` đã có — không đổi cách lọc, chỉ đổi cách nhập. Dấu `-` LUÔN là dấu
  nối khoảng vì tiền hóa đơn không âm.
- Cột "Trạng thái hóa đơn"/"Kết quả kiểm tra"/"Trạng thái tải"/"Tính chất dòng hàng" — gõ tự do khớp
  theo **nhãn hiển thị** (vd gõ "hủy" khớp "Hóa đơn đã bị hủy") thay vì phải nhớ mã thô, tái dùng đúng
  hàm label đã dùng để hiển thị ô (`trangThaiHdLabel`/`ketQuaKiemTraLabel`/`tinhChatLabel`) — đảm bảo
  "gõ được đúng chữ đang nhìn thấy" chứ không phải suy đoán.

### Điểm cần cẩn thận: 2 cột vừa lọc client vừa quyết định phạm vi job nền GDT

"Trạng thái hóa đơn"/"Kết quả kiểm tra" khác 2 cột kia ở chỗ chúng **còn được gửi lên BE** để giới
hạn phạm vi 2 lượt chạy nền thật ("Tải chi tiết"/"Cập nhật từ Thuế điện tử", qua `buildGdtRunQuery`)
— không thể đổi thẳng sang "gõ tự do" vì BE cần đúng 1 mã, không nhận được chuỗi nhãn tự do. Giải
pháp: **2 tiêu chí độc lập, cộng AND**:

| Tiêu chí | State | Vai trò |
|---|---|---|
| Mã chính xác | `appliedFilters.trangThaiHd`/`ketQuaHd` | Dropdown panel "Bộ lọc" ghi; VẪN gửi BE cho job nền |
| Nhãn tự do | `columnFilters.trangThaiHdText`/`ketQuaHdText` | Ô input dòng cố định ghi; CHỈ lọc hiển thị client |

Gõ vào ô cố định gọi `applyStatusLabelFilter`: ghi nhãn vào tiêu chí thứ 2 (luôn), **và** nếu nhãn
khớp **duy nhất 1** lựa chọn (`resolveUniqueOptionCode`) thì cũng cập nhật tiêu chí thứ 1 — job nền
tự thu hẹp đúng khi gõ đủ rõ; gõ mơ hồ/dở dang thì job nền tạm bỏ qua tiêu chí đó (không lọc sai) còn
bảng hiển thị vẫn lọc theo nhãn ngay. Ngược lại, chọn dropdown ở panel sẽ **xóa** nhãn tự do đang gõ
dở của field đó (`handlePanelFieldChange`) — 2 tiêu chí AND với nhau nên còn sót nhãn cũ không khớp
mã mới chọn sẽ khiến bảng ra 0 kết quả mà không rõ vì sao; panel là lựa chọn chủ động hơn nên panel
thắng.

### Hai lỗi tìm thấy và vá ở lượt `/code-review` đầu tiên

1. **`buildQuery()` làm mất phạm vi lọc của job nền GDT.** Hàm này vốn phục vụ cả đọc DB (bảng) lẫn
   khởi động job nền — sau khi đổi bảng sang lọc phía client, `buildQuery()` chỉ còn trả `{tuNgay,
   denNgay}`, và job nền vô tình cũng nhận query đã cắt trụi đó → "Tải chi tiết" quét CẢ khoảng ngày
   thay vì đúng phần đang lọc. Vá: tách hẳn `buildGdtRunQuery()` (giữ nguyên `InvoiceFilterValues`)
   cho 2 lượt chạy nền, `buildQuery()` chỉ dùng cho đọc DB.
2. **Debounce dùng 1 ref chung cho cả panel "Bộ lọc".** Gõ field A rồi đổi sang field B trong lúc A
   còn chờ debounce sẽ HỦY LUÔN commit của A — ô vẫn hiện đúng chữ vừa gõ nhưng không bao giờ vào bộ
   lọc thật. Vá: `panelLiveTimersRef` đổi thành map 1 timer/field.

**File:** `hdđt_maxv/src/components/ColumnFilterButton.tsx` *(mới, dời từ `features/hddt/components`)*,
`ColumnFilterInput.tsx` *(mới)*, `hdđt_maxv/src/utils/columnFilterText.ts` *(mới)*,
`hdđt_maxv/src/features/hddt/components/InvoiceListTabs.tsx`, `InvoiceDetailPanel.tsx`,
`hdđt_maxv/src/features/hddt/types/index.ts`

---

## 2. Port sang bảng Dịch vụ công (`BangHoSo`)

### Khác biệt kiến trúc buộc phải tách `rawCellSort.ts` riêng

`BangHoSo` không nhận row đã gõ kiểu (`DisplayRow`/`DetailRow` như hddt) — nó nhận `headers: string[]`
+ `rows: string[][]` thô từ cổng, khớp cột theo **vị trí tìm được qua tên tiêu đề** (`layO`/`layOTho`,
hàm `viTriNguon` đã có sẵn). Không có field đặt tên để đọc như `columnSort.ts`'s `fieldOf`, nên
`rawCellSort.ts` (`compareCellText`) phải **tự nhận dạng hình dạng chuỗi** (ngày `dd/MM/yyyy` — đúng
định dạng cổng DVC trả, xem `parseNgayNop` bên BE — số, hay chuỗi thường) thay vì biết trước field nào
kiểu gì.

```ts
// layOTho: giá trị THÔ dùng lọc/sắp xếp — khác layO (đã format tiền "1.234.567", phá mất phép so số)
const layOTho = (row, cotIdx, dongThu) => {
  if (cot[cotIdx]?.key === "stt") return String(dongThu + 1); // tự đánh số, không đọc từ cổng
  const nguon = viTriNguon[cotIdx];
  return nguon >= 0 ? (row[nguon] ?? "") : "";
};
```

### Bẫy CSS: `stickyHeader` không biết có 2 dòng header

`BangHoSo` dùng `<Table stickyHeader>` (dính khi cuộn dọc — bảng nhiều cột, cuộn tới dòng 30 mà mất
tiêu đề thì không biết cột nào là cột nào). MUI áp `position: sticky; top: 0` cho **MỌI** ô trong
`TableHead`, không phân biệt dòng — thêm dòng input thứ 2 mà để nguyên sẽ khiến CẢ HAI dòng cùng dính
ở `top: 0`, đè chữ lên nhau. Vá: dòng input đặt `sx={{ position: "static" }}` để BỎ hiệu ứng dính —
chỉ dòng tiêu đề (sort icon) dính, dòng lọc cuộn theo thân bảng.

> **Chưa xem trên trình duyệt thật** — đây là suy luận CSS dựa trên cơ chế `stickyHeader` của MUI,
> không phải lỗi đã tái hiện. Cần cuộn dọc bảng thật để xác nhận không còn overlap.

### Reset lọc/sắp xếp/trang khi đổi tab

`BangHoSo` dùng chung cho 2 tab ("Tờ khai"/"Giấy nộp tiền", cột khác hẳn nhau, chỉ trùng vài `key`:
`stt`/`lanNop`/`trangThai`/`taiFile`). Đổi tab mà giữ nguyên lọc/sort cũ có thể lọc nhầm sang ý nghĩa
khác của tab mới (cùng key `trangThai` nhưng khác tập giá trị) hoặc bảng trống oan. Xử lý bằng mẫu
"lưu giá trị trước" của React trên `cot` (tham số đổi THAM CHIẾU đúng lúc đổi tab, vì mỗi tab giữ 1
mảng cột cố định trong `TAB_DVC`).

**File:** `hdđt_maxv/src/utils/rawCellSort.ts` *(mới)*,
`hdđt_maxv/src/features/dich_vu_cong/components/BangHoSo.tsx`

---

## 3. Tách hạ tầng dùng chung

Nhóm 1 xây cho hddt trước; nhóm 2 cần LẠI Y HỆT phần không phụ thuộc kiểu dữ liệu — tách ra thay vì
copy-paste sang `dich_vu_cong`:

| File mới | Nội dung | Vì sao chung |
|---|---|---|
| `src/components/ColumnFilterButton.tsx` | Icon sort-only + popover | Không còn gì riêng hddt sau khi bỏ mode lọc |
| `src/components/ColumnFilterInput.tsx` | Ô input dòng cố định | Cùng lý do |
| `src/utils/columnFilterText.ts` | `containsText`/`inNumRange`/`parseRangeInput`/`formatRangeInput` | Cú pháp khoảng số dùng cho cả cột tiền HĐĐT lẫn DVC |
| `src/utils/rawCellSort.ts` | `compareCellText` | Riêng cho dữ liệu `string[][]` thô (xem nhóm 2) |

Quy tắc đặt: component/hàm nào không còn phụ thuộc gì riêng của 1 feature thì lên `src/components`/
`src/utils` (khớp cấu trúc feature-based sẵn có — `src/components/dialogLoginHddt.tsx` là ví dụ tương
tự đã có từ trước).

**File:** cả 4 file mới ở bảng trên, cộng `hdđt_maxv/src/features/hddt/components/InvoiceListTabs.tsx`
(đổi import)

---

## 4. Dòng kẻ cột cho 3 bảng chính

Yêu cầu: thêm `border-right` phân cách cột (viền dưới giữa các hàng đã có sẵn từ mặc định MUI, chỉ
thiếu viền dọc). Tách `columnDividerSx(theme, extraCellSx?)` dùng chung — cột cuối không kẻ (tránh
trùng viền khung ngoài `TableContainer variant="outlined"`).

```ts
export function columnDividerSx(theme: Theme, extraCellSx: Record<string, unknown> = {}) {
  return {
    "& td, & th": { ...extraCellSx, borderRight: `1px solid ${theme.palette.divider}` },
    "& td:last-child, & th:last-child": { borderRight: "none" },
  };
}
```

`extraCellSx` nhận tham số thay vì để nơi gọi tự ghép qua `sx` dạng mảng: MUI gộp mảng `sx` KHÔNG sâu
tới từng selector lồng nhau (`"& td, & th"`), ghép kiểu đó dễ vô tình đè mất `borderRight` thay vì
cộng thêm `whiteSpace: "nowrap"` (2 bảng HĐĐT cần thêm, `BangHoSo` thì không).

**File:** `hdđt_maxv/src/utils/tableStyles.ts` *(mới)*, `InvoiceListTabs.tsx`, `InvoiceDetailPanel.tsx`,
`BangHoSo.tsx`

---

## 5. Phân trang cho bảng Dịch vụ công

`BangHoSo` trước đây không phân trang — cuộn dọc trong khung 520px, tối đa 500 dòng/lượt tìm kiếm
(`MAX_KET_QUA_TIM_KIEM` bên BE). Lấy nguyên `InvoicePagination` (20/50/100 dòng/trang, nhãn tiếng
Việt) + `clampPage` (kẹp trang khi lọc làm số dòng co lại, khỏi kẹt trang trống) — **cùng 2 file** vừa
port pagination cho hddt sang `src/components`/`src/utils` ở nhóm 3, để `dich_vu_cong` dùng lại đúng
nguyên bản thay vì cấy lại.

STT tính theo vị trí **toàn cục** (`safePage * rowsPerPage + i`), không phải vị trí trong trang — qua
trang 2 phải đếm tiếp 21, 22... chứ không quay lại 1.

**File:** `hdđt_maxv/src/components/InvoicePagination.tsx` *(mới, dời từ `features/hddt/components`)*,
`hdđt_maxv/src/utils/pagination.ts` *(mới, dời từ `features/hddt/pagination.ts`)*, `BangHoSo.tsx`,
`InvoiceListTabs.tsx`, `InvoiceDetailPanel.tsx` (đổi import)

---

## 6. Kết quả hai lượt `/code-review` + `/simplify`

Lượt `/code-review` đầu (nhóm 1) đã nêu ở trên. Sau đó hai lượt `/simplify` (4 agent reuse/
simplification/efficiency/altitude chạy song song, lượt 2 quét lại TOÀN BỘ diff kể cả phần DVC) —
đã áp:

| Sửa | Tác dụng |
|---|---|
| Tách `filteredRows`/`rows = applySort(...)` (bảng Tổng quát) | Trước: bấm đổi CHIỀU sắp xếp cũng chạy lại `toDisplayRow` + lọc qua hàng nghìn hóa đơn, dù dữ liệu/lọc không đổi. Khớp đúng pattern bảng Chi tiết đã tách sẵn. |
| `filteredDetailRows`: chuẩn hóa needle 1 lần, gọi `inNumRange` thay vì tự viết lại | Tránh `.trim().toLowerCase()` lặp lại mỗi dòng (hàng chục nghìn dòng hàng), và tránh 2 bản y hệt của cùng 1 phép so khoảng |
| `BangHoSo`: `parseRangeInput` tính 1 lần/bộ lọc, không phải mỗi dòng | Compile regex là việc tốn — trước đây có thể chạy hàng nghìn lần thừa mỗi lượt gõ nếu đang lọc nhiều cột tiền cùng lúc |
| Gộp ~26 case gần giống hệt trong `detailColumnFilterSpec` bằng 2 `Set` | 13 case cột-khoảng + 13 case cột-text theo ĐÚNG 1 khuôn → còn ~20 dòng thay vì ~74, hết rủi ro gõ nhầm key khi thêm cột |
| Gộp `maNt` (trùng lặp y hệt 2 bảng) vào `renderSharedColumnFilterSpec` | Bảng Chi tiết giờ cũng có gợi ý "VND" như bảng Tổng quát |
| Bỏ `useCallback`/`useMemo` thừa trong `BangHoSo` | Đang bảo vệ 1 chi phí không tồn tại ở quy mô ≤500 dòng, đổi lại phải giữ đúng tay 2 dependency-array |
| Regex của `parseRangeInput` lên module-level | Không dựng lại `new RegExp(...)` mỗi lần gọi hàm |

### Đã hoãn có lý do (nợ thiết kế đã ghi nhận, không phải bỏ sót)

- **`columnSort.ts` (hddt, có sẵn từ trước) và `rawCellSort.ts` (mới, nhóm 2) cùng làm một việc**
  (so sánh rỗng-cuối/số/chuỗi kiểu 'vi') qua 2 cơ chế tách biệt — tách phần ĐỌC GIÁ TRỊ (đúng, 1 bên
  đọc field theo tên, 1 bên đọc vị trí thô) là hợp lý, nhưng phần SO SÁNH lõi giống hệt nhau lại
  không dùng chung. Đã phát hiện regex số thập phân giữa 2 file **đã lệch nhau**: `columnSort.ts` chỉ
  nhận dấu `.` (`/^-?\d+(\.\d+)?$/`), `rawCellSort.ts` nhận cả `.` lẫn `,` (`/^-?\d+(?:[.,]\d+)?$/`) —
  viết độc lập nên không có gì ép 2 quy tắc này khớp nhau. Sửa an toàn cần đổi chữ ký
  `applySort`/`compareRows` dùng ở nhiều nơi gọi — vượt phạm vi lượt dọn dẹp này.
- **`columnSort.ts`'s `FIELD_ALIAS`/`fieldOf`** tự khai một bảng ánh xạ tên cột thay vì gọi lại
  `InvoiceColumn.value` (đã có, dùng chung cho web/Excel/CSV, đã bắt đúng trường hợp `ghiChu1` đọc từ
  `ghiChu`). Hai nơi cùng khai 1 sự thật, không có gì ép chúng khớp nhau nếu 1 bên đổi sau này.
- **`key={tab}` thay cho reset thủ công `prevCot`** (nhóm 2) — cân nhắc nhưng bỏ: `key={tab}` sẽ remount
  toàn bộ `BangHoSo`, VÔ TÌNH reset luôn `rowsPerPage` (hiện không nằm trong khối reset thủ công) — đổi
  hành vi ngoài yêu cầu, chưa được duyệt.

---

## 7. Bảng file

| File | Trạng thái | Nhóm |
|---|---|---|
| `src/components/ColumnFilterButton.tsx` | mới (dời từ `features/hddt/components`) | 1, 3 |
| `src/components/ColumnFilterInput.tsx` | mới | 1, 3 |
| `src/components/InvoicePagination.tsx` | mới (dời từ `features/hddt/components`) | 5 |
| `src/utils/columnFilterText.ts` | mới | 1, 3, 6 |
| `src/utils/rawCellSort.ts` | mới | 2, 6 |
| `src/utils/tableStyles.ts` | mới | 4 |
| `src/utils/pagination.ts` | mới (dời từ `features/hddt/pagination.ts`) | 5 |
| `features/hddt/components/InvoicePagination.tsx` | **xóa** (dời đi) | 5 |
| `features/hddt/pagination.ts` | **xóa** (dời đi) | 5 |
| `features/hddt/components/InvoiceListTabs.tsx` | sửa | 1, 3, 4, 5, 6 |
| `features/hddt/components/InvoiceDetailPanel.tsx` | sửa | 1, 3, 4, 5 |
| `features/hddt/types/index.ts` | sửa | 1 |
| `features/dich_vu_cong/components/BangHoSo.tsx` | sửa | 2, 4, 5, 6 |

---

## 8. Trạng thái kiểm chứng

| Lệnh | Kết quả |
|---|---|
| `hdđt_maxv` — `npx tsc --noEmit` | sạch (chạy lại sau MỌI thay đổi trong phiên) |
| `hdđt_maxv` — `npx eslint .` | 0 lỗi, 0 warning |
| `hdđt_maxv` — `npm run build` | sạch (chunk >500kB là cảnh báo pre-existing, không liên quan) |
| Giao diện — nhóm 1 (bảng Tổng quát/Chi tiết) | **Người dùng đã tự test, xác nhận "thành công"** |
| Giao diện — nhóm 2/4/5 (BangHoSo: lọc/sort/dòng kẻ/phân trang, sticky header 2 dòng) | **chưa nhìn mắt** — chỉ dựa trên typecheck/lint/build sạch + suy luận CSS |

---

## 9. Việc CHƯA làm — đọc trước khi merge

1. **Sticky header 2 dòng của `BangHoSo`** (nhóm 2) chưa xác nhận trên trình duyệt thật — xem cảnh
   báo ở nhóm 2.
2. **Hai khoản nợ thiết kế đã hoãn** (nhóm 6): thống nhất `columnSort.ts`/`rawCellSort.ts`, và nối
   `fieldOf`/`FIELD_ALIAS` về `InvoiceColumn.value`. Không chặn merge — là cải thiện kiến trúc, chưa
   phải lỗi hiện tại.
3. Chưa có unit test cho `parseRangeInput`/`compareCellText`/`applyStatusLabelFilter` — `hdđt_maxv`
   hiện không có hạ tầng test frontend (không `vitest`/test script trong `package.json`), khác
   `be_maxv` đã có `__tests__/`. Xác minh hiện dựa vào typecheck + lint + test tay trên trình duyệt.
