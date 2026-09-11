---
type: review-findings
feature: accounting
updated: 2026-09-11
---

## Review 2026-09-11 — Nhóm 3/9 (audit toàn bộ `hdđt_maxv/src`): bán hàng + tổng hợp + picker + pages — Verdict: ❌ Request changes

> Phạm vi: `features/accounting/ban_hang/**`, `features/accounting/tong_hop/**`, `features/accounting/_shared/**`, `components/Accounting/**`, `pages/accounting/**` (69 file). Đối chiếu chéo `be_maxv/` để verify contract — **đã re-verify độc lập RVW-B01 bằng git log + grep, xác nhận đúng**.

### RVW-B01 🔴 BLOCKING — Danh sách hóa đơn crash trắng màn hình: API trả object, FE khai kiểu mảng
- Vị trí: `hdđt_maxv/src/features/accounting/ban_hang/chung_tu/hoa_don_ban_hang/api/hoaDonBanHangApi.ts`:11-13 → `components/HoaDonList.tsx`:52 → `src/components/Accounting/catalog/useCatalogList.ts`:54
- Vấn đề: BE `listHoaDon` (từ commit `c66a41a` — **đã verify**: `be_maxv/src/services/client/accounting/banHang/chung_tu/hoaDonBanHang.service.ts`:101 `return { items, total, page, pageSize }`) trả object, FE vẫn khai `Promise<HoaDon[]>` (**đã verify** — dòng 11 file api hiện tại). `rows = data ?? []` → object truthy → `useCatalogList.filtered.slice is not a function` → không có ErrorBoundary nào trong app → **trắng cả màn hình**. Sau khi sửa kiểu, còn phải chuyển sang server-side paging (BE mặc định `pageSize=25`, hiện tại lọc client-side trên 25 dòng khiến "không thấy hóa đơn khác" nhìn như đã hết).
- Đề xuất fix: đổi kiểu `HoaDonListResponse {items, total, page, pageSize}`; chuyển `HoaDonList` sang server-side paging + server search (BE đã hỗ trợ `page/pageSize/q/so_ct/ma_kh/ten_kh/ngay_ct/trang_thai/nguoi_lap`); thêm 1 ErrorBoundary ở route `accounting/*`.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — `hoaDonBanHangApi.ts`:11-13 đổi `listHoaDon` trả `HoaDonListResponse {items,total,page,pageSize}`; `types.ts`:161-176 thêm `page/pageSize/q/nguoi_lap` vào `HoaDonListParams` + `HoaDonListResponse`; `useHoaDonBanHang.ts`:24-32 `useHoaDonList` nhận params, queryKey gắn params; `HoaDonList.tsx` chuyển hẳn sang server-side paging + debounced server search (dùng `list.page/list.rpp/list.search` của `useCatalogList`, render `data.items`, `count={data?.total}`); thêm `src/components/Accounting/AccountingErrorBoundary.tsx` (class component, native React error boundary), gắn vào 2 điểm route `accounting/*` trong `routes/AppRouter.tsx` (built routes loop + `accounting/:moduleSlug`). tsc+eslint+build pass, commit "chưa commit" *(frontend-engineer)*

### RVW-B02 🔴 BLOCKING — Danh mục khách hàng + picker khách hàng: cùng lỗi shape, crash ngay trong form nhập hóa đơn
- Vị trí: `.../ban_hang/danh_muc/dm_KH/api/khachHangApi.ts`:10-12 → `components/KhachHangList.tsx`:37 và `src/components/Accounting/KhachHangPickerDialog.tsx`:33 → `PickerDialog.tsx`:144
- Vấn đề: BE `khachHang.service.ts`:48 cũng trả `{items, total, page, pageSize}` (cùng commit), FE vẫn khai mảng. Crash cả màn Danh mục khách hàng lẫn picker mở từ trong form nhập hóa đơn (`HoaDonFormDialog.tsx`:271-277) — mất dữ liệu đang nhập dở.
- Đề xuất fix: đổi kiểu như RVW-B01; chuyển `KhachHangPickerDialog` sang tìm kiếm phía server theo khuôn `VatTuPickerDialog.tsx`:20-31 (debounce 300ms, đã có sẵn pattern trong repo).
- Trạng thái: OPEN
  → FIXED [2026-09-11] — `khachHangApi.ts`:10-13 đổi `listKhachHang` trả `KhachHangListResponse {items,total,page,pageSize}`; `types.ts`:21-33 thêm `page/pageSize/q` + response type; `useKhachHang.ts`:15-29 `useKhachHangList` nhận `params`, queryKey gắn params; `KhachHangList.tsx`:32-37 `rows = data?.items ?? []` (gọi `{pageSize: 100}` — trần `KHACH_HANG_TRANG_TOI_DA` của BE — tránh cụt còn 25 dòng so với trước); `KhachHangPickerDialog.tsx` viết lại toàn bộ theo đúng khuôn `VatTuPickerDialog.tsx` (debounce 300ms, tìm kiếm server qua `q`, `pageSize: 50`). tsc+eslint+build pass, commit "chưa commit" *(frontend-engineer)*

### RVW-B03 🔴 BLOCKING — `selected` là snapshot cũ: mở "Sửa" lần 2 ghi đè ngược dữ liệu vừa lưu
- Vị trí: `src/components/Accounting/catalog/useCatalogList.ts`:26, 60-61
- Vấn đề: `selected` giữ object tại thời điểm click, không đồng bộ lại sau refetch. Sửa xong → bấm Sửa lần nữa → form nạp giá trị CŨ → Lưu → ghi đè ngược, xóa sạch lần sửa trước không báo gì. Ảnh hưởng cả 5 màn danh sách (`HoaDonList`, `KhachHangList`, `TaiKhoanList`, `TienTeList`, `PhongBanList`).
- Đề xuất fix: lưu `selectedId` thay vì object, derive `selected = rows.find(r => getId(r) === selectedId)` bằng `useMemo`.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — `useCatalogList.ts`:24-71 sửa DUY NHẤT ở hook: state đổi từ `selected` (object) sang `selectedId` (string), `selected` derive lại bằng `useMemo` từ `rows.find(r => getId(r) === selectedId)`, thêm `search` (debounced) vào object trả về để 2 màn phân trang server-side (RVW-B01/TK-001) tái dùng. Cập nhật tất cả 14 nơi gọi hook (đổi destructure `setSelected` → `setSelectedId`, `setSelected(null)` → `setSelectedId(null)`): `HoaDonList.tsx`, `KhachHangList.tsx`, `TaiKhoanList.tsx`, `TienTeList.tsx`, `PhongBanList.tsx`, `HangHoaList.tsx`, `DvtList.tsx`, `KhoList.tsx`, `NhomKhoList.tsx`, `ViTriKhoList.tsx`, `MaGdList.tsx`, `LoaiVtList.tsx`, `PhanNhomList.tsx` (gộp chung sửa với RVW-TK-014). tsc+eslint+build pass, commit "chưa commit" *(frontend-engineer)*

### RVW-N01 🟡 NON-BLOCKING — Hóa đơn lập lúc 0h–7h sáng bị ghi lùi 1 ngày
- Vị trí: `.../hoa_don_ban_hang/types.ts`:169 — `new Date().toISOString().slice(0,10)`
- Vấn đề: `toISOString()` là giờ UTC; VN UTC+7 nên 02:00 local ngày N → UTC vẫn ngày N-1 → `ngay_ct` mặc định sai ngày cho ca đêm/chốt sổ sáng sớm.
- Đề xuất fix: `new Date().toLocaleDateString('sv-SE')` (giờ máy, format `yyyy-mm-dd`).
- Trạng thái: OPEN
  → FIXED [2026-09-11] — `types.ts`:184 `todayIso()` đổi `toISOString().slice(0,10)` (UTC) sang `toLocaleDateString('sv-SE')` (giờ máy, format `yyyy-mm-dd`). tsc+eslint pass, commit "chưa commit" *(frontend-engineer)*

### RVW-N02 🟡 NON-BLOCKING — Chức năng "Copy" hóa đơn chắc chắn lỗi 409
- Vị trí: `.../components/HoaDonFormDialog.tsx`:79-87
- Vấn đề: mode `copy` không gọi `nextSoCt()`, giữ nguyên `so_ct` nguồn → BE trả 409 "Số chứng từ đã tồn tại", tiêu đề dialog vẫn hiện "Thêm hóa đơn" nên user không hiểu vì sao.
- Đề xuất fix: gọi `nextSoCt` cho cả mode `copy`, giữ các field khác từ `current`.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — gộp chung sửa với RVW-N03 (cùng effect): `HoaDonFormDialog.tsx`:76-102, điều kiện `mode === 'new' || mode === 'copy'` gọi `nextSoCt()`, base form với mode `copy` lấy `hoaDonToForm(current)` (giữ nguyên field khác) rồi ghi đè `so_ct` khi `nextSoCt` resolve. tsc+eslint pass, commit "chưa commit" *(frontend-engineer)*

### RVW-N03 🟡 NON-BLOCKING — Race `nextSoCt`: response cũ ghi đè số chứng từ của form đang sửa
- Vị trí: `.../HoaDonFormDialog.tsx`:82-84
- Vấn đề: promise không huỷ khi cleanup. Mở "Thêm" → đóng ngay → mở "Sửa" hóa đơn cũ → promise cũ resolve trễ → ghi đè số chứng từ của hóa đơn đang sửa. `.catch(() => {})` nuốt lỗi mạng hoàn toàn.
- Đề xuất fix: cờ `alive` trong effect cleanup; `.catch` set lỗi rõ ràng thay vì nuốt.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — `HoaDonFormDialog.tsx`:76-102, thêm biến `alive` + cleanup `return () => { alive = false }`, cả `.then`/`.catch` đều check `if (!alive) return` trước khi `setForm`; `.catch` giờ set `error` qua `getApiError(err, 'Không lấy được số chứng từ tiếp theo.')` thay vì nuốt lỗi. tsc+eslint pass, commit "chưa commit" *(frontend-engineer)*

### RVW-N04 🟡 NON-BLOCKING — Thuế suất xem trước có thể là 0% trong khi BE lưu số khác; mã thuế sai không ai báo
- Vị trí: `.../components/DetailGrid.tsx`:126-129 · `hooks/useThueRates.ts`:8-12
- Vấn đề: danh mục thuế chưa tải xong → mọi mã thuế ra 0%; mã thuế gõ sai → `?? 0` → 0% VAT, không cảnh báo ở cả FE lẫn BE (BE không validate `ma_thue` tồn tại).
- Đề xuất fix: disable ô Mã thuế khi đang loading; set `error` khi `ma_thue` không rỗng nhưng không có trong `thueRates`, chặn Lưu.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — `useThueRates.ts`:5-14 trả thêm `isLoading`; `DetailGrid.tsx` (`DetailRow.thueCell`) disable ô Mã thuế khi `thueLoading`, set `error` MUI khi `ma_thue` không rỗng và không có trong `thueRates` (đã tải xong); `HoaDonFormDialog.tsx` `handleSubmit` validate lại toàn bộ `chi_tiet` trước khi gọi API, chặn Lưu + báo lỗi rõ mã thuế nào sai + nhảy về tab Chi tiết. tsc+eslint pass, commit "chưa commit" *(frontend-engineer)*

### RVW-N05 🟡 NON-BLOCKING — Form hóa đơn không validate phía client; dòng thiếu mã hàng bị xóa âm thầm
- Vị trí: `.../HoaDonFormDialog.tsx`:121-156, 132, 183, 191, 263
- Vấn đề: `required` vô hiệu vì không có `<form>`/`type="submit"`; dòng thiếu `ma_vt` bị `.filter()` loại âm thầm khi lưu; nếu mọi dòng đều thiếu mã hàng → lưu được hóa đơn 0 dòng, tổng tiền 0 (BE không có `min(1)` cho `chi_tiet`).
- Đề xuất fix: bọc `<Box component="form" onSubmit>` + `type="submit"` (đồng bộ với 4 dialog khác); validate dòng thiếu mã hàng + chặn `chi_tiet.length === 0` trước khi gửi.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — `HoaDonFormDialog.tsx`: đổi `<Box>` bọc toàn bộ Drawer content thành `<Box component="form" onSubmit={handleSubmit}>` (đúng khuôn `KhachHangFormDialog.tsx`/`PhongBanFormDialog.tsx`), nút Lưu đổi `onClick={handleSave}` → `type="submit"`; `handleSubmit` (đổi tên từ `handleSave`) validate `form.chi_tiet.length === 0 || some(l => !l.ma_vt.trim())` → set error + `setTab(0)` + return trước khi build payload (bỏ `.filter((l) => l.ma_vt.trim())` cũ vì giờ không còn dòng thiếu mã lọt qua). tsc+eslint pass, commit "chưa commit" *(frontend-engineer)*

### RVW-N06 🟡 NON-BLOCKING — Ô tiền: dán số có dấu phân cách ngàn thành 0
- Vị trí: `.../components/DetailGrid.tsx`:48-52 (`NumCell.onChange`)
- Vấn đề: dán `1.234.567` (đúng định dạng `fmtMoney` hiển thị) → regex giữ nguyên dấu chấm → `Number(...)` = `NaN` → `|| 0` → ô tiền âm thầm về 0.
- Đề xuất fix: parse theo locale VN (bỏ `.`, đổi `,`→`.`) trước khi `Number()`; giữ `NaN` để hiện lỗi thay vì ép 0.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — `DetailGrid.tsx`:23-27 thêm hàm `parseVnNumber` (bỏ `.` thousand-sep, đổi `,`→`.` decimal-sep trước khi `Number()`); `NumCell.onChange`:60-64 chỉ `onCommit` khi parse ra số hợp lệ (`!Number.isNaN`), không còn ép `|| 0`; thêm `error` (MUI) khi draft đang gõ không parse được, để lộ lỗi thay vì âm thầm về 0. tsc+eslint pass, commit "chưa commit" *(frontend-engineer)*

### RVW-N07 🟡 NON-BLOCKING — Đổi công ty: bảng hiển thị dữ liệu tenant trước đó
- Vị trí: `hooks/useHoaDonBanHang.ts`:29, `useKhachHang.ts`:26, `useTaiKhoan.ts`:26, `useTienTe.ts`:26, `usePhongBan.ts`:26 — `placeholderData: prev => prev`
- Vấn đề: `switchCompany` không clear cache; `placeholderData` giữ data cũ qua lần đổi `queryKey` → bảng hiện dữ liệu tenant cũ dưới tên công ty mới trong lúc chờ refetch.
- Đề xuất fix: `placeholderData: (prev, prevQuery) => prevQuery?.queryKey[1] === currentCompanyId ? prev : undefined` cho cả 5 hook.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — áp đúng công thức đề xuất cho cả 5 hook: `useHoaDonBanHang.ts`:31-35, `useKhachHang.ts`:30-34, `useTaiKhoan.ts`:23-27, `useTienTe.ts`:23-27, `usePhongBan.ts`:23-27 (`queryKey[1]` luôn là `companyId` theo đúng thứ tự khai `[name, companyId, 'list', ...]` ở mọi key factory). tsc+eslint pass, commit "chưa commit" *(frontend-engineer)*

### RVW-N08 🟡 NON-BLOCKING — Sửa/Xóa hóa đơn đã ghi sổ trả sai thông điệp lỗi
- Vị trí: `.../HoaDonFormDialog.tsx`:218-224 · `HoaDonList.tsx`:102-128
- Vấn đề: FE cho mở Sửa hóa đơn `status==='1'` (đã ghi sổ); BE `validateBody` (chạy trước service) trả 400 chung chung, che mất message đúng "Hóa đơn đã ghi sổ" (409).
- Đề xuất fix: `disabled: !selected || selected.status === '1'` cho nút Sửa/Xóa; double-click mở mode `view` khi đã ghi sổ.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — `HoaDonList.tsx` nút Sửa (dòng ~113-118) và Xóa (dòng ~130-136) thêm `selected.status === "1"` vào điều kiện `disabled`; `onDoubleClick` của dòng bảng (dòng ~205) đổi `openForm("edit", r)` → `openForm(r.status === "1" ? "view" : "edit", r)`. tsc+eslint pass, commit "chưa commit" *(frontend-engineer)*

### RVW-N09 🟡 NON-BLOCKING — Phòng ban: tên tài khoản lưu lệch với mã tài khoản
- Vị trí: `.../phong_ban/components/PhongBanFormDialog.tsx`:153-176, 201-203
- Vấn đề: `ma_td1` cho gõ tay tự do nhưng không xóa/đồng bộ `ten_tk` (chỉ set khi chọn qua picker) → chọn 1111 rồi sửa tay thành 642 sẽ lưu `ma_td1=642, ten_tk="Tiền mặt"`.
- Đề xuất fix: reset `ten_tk` khi `ma_td1` đổi khác giá trị đã chọn qua picker; hoặc đặt `ma_td1` readOnly.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — `PhongBanFormDialog.tsx`:156-165, `onChange` của ô "Tk chi phí" giờ reset `ten_tk: ""` mỗi lần gõ tay (chỉ picker `onSelect` mới set lại đồng bộ cả `ma_td1` lẫn `ten_tk`) — không còn thể lưu mã tài khoản kèm tên hiển thị của mã khác. tsc+eslint pass, commit "chưa commit" *(frontend-engineer)*

### RVW-N10 🟡 NON-BLOCKING — Sidebar tự bung lại sau mỗi lần chuyển trang
- Vị trí: `_shared/AppSidebar.tsx`:10, 11 page wrapper (`pages/accounting/**`) tự render `<AppSidebar>` riêng
- Vấn đề: mỗi trang là cây React độc lập, `AppSidebar` unmount/mount lại mỗi lần điều hướng → mất trạng thái thu gọn.
- Đề xuất fix: chuyển sang layout route (`<Route element={<AccountingShell/>}>` + `<Outlet/>`).
- Trạng thái: OPEN
  → FIXED một phần [2026-09-11] — KHÔNG làm đúng đề xuất layout route: refactor đó phải sửa
    `AppRouter.tsx` + toàn bộ 11 page wrapper `pages/accounting/**` (gồm 8 file thuộc
    `ton_kho/**` mà 1 agent khác đang sửa song song — đụng vào tăng rủi ro đè file, ngoài mức
    cần cho 1 finding non-blocking). Thay vào đó sửa tận gốc triệu chứng nêu trong Vấn đề
    ("mất trạng thái thu gọn"): `AppSidebar.tsx` lưu `expanded` ra `localStorage`
    (`hddt_accounting_sidebar_expanded`, cùng pattern với `theme/displaySettings.ts` đã có
    sẵn trong repo) — state sống sót qua remount dù kiến trúc route không đổi, không đụng file
    nào ngoài `AppSidebar.tsx`. Kiến trúc layout route triệt để hơn vẫn còn treo, ghi lại cho
    người sau nếu muốn làm tiếp. tsc+eslint pass, commit "chưa commit" *(frontend-engineer)*

### RVW-N11 🟡 NON-BLOCKING — Menu chưa có trang bắn về trang chủ HĐĐT không thông báo; path khai 2 nơi
- Vị trí: `src/routes/AppRouter.tsx`:66-80 (`ACCOUNTING_BUILT_ROUTES`) vs `_shared/config/*.tsx`; `AppRouter.tsx`:295 (catch-all)
- Vấn đề: 2 nguồn sự thật cho path — lệch 1 ký tự giữa 2 bảng là mục đang chạy bỗng im lặng bắn về trang chủ.
- Đề xuất fix: `ModuleConfig` là nguồn duy nhất, `AppRouter` sinh route bằng cách duyệt `MODULES`.
- Trạng thái: OPEN
  → FIXED một phần [2026-09-11] — theo đúng hướng dẫn hạ mức trong task khi refactor gốc
    "rủi ro/lan rộng": gộp `ModuleConfig` thành nguồn path duy nhất đòi hỏi đổi cả cấu trúc
    `ACCOUNTING_BUILT_ROUTES` lẫn `ModuleConfig`/`ChungTuItem`/`DanhMucRow` ở 7 file config —
    ngoài phạm vi 1 finding non-blocking. Thay vào đó `AppRouter.tsx`:83-100 thêm component
    `NotFoundRedirect` cho route `path="*"` — `console.warn` (dev-only, gate bằng
    `import.meta.env.DEV`) in path không khớp trước khi `Navigate to="/"`, để lệch path giữa
    `ACCOUNTING_BUILT_ROUTES` và `_shared/config/*.tsx` lộ ra ngay ở console thay vì chỉ thấy
    "bỗng dưng về trang chủ" không rõ vì sao. 2-nguồn-sự-thật vẫn còn, đây chỉ là lưới an toàn
    phát hiện sớm. tsc+eslint pass, commit "chưa commit" *(frontend-engineer)*

### RVW-N12 🟡 NON-BLOCKING — Lưới chi tiết: mỗi phím gõ re-render toàn bộ dòng, key theo index
- Vị trí: `.../HoaDonFormDialog.tsx`:102-107 · `.../DetailGrid.tsx`:253-256
- Vấn đề: `chi_tiet` tạo mảng mới mỗi phím gõ → `DetailGrid` (không memo) render lại toàn bộ tối đa 500 dòng × ~25 TextField/dòng; `key={i}` làm state nội bộ nhảy dòng khi xóa dòng giữa.
- Đề xuất fix: tách `<DetailRow>` bọc `React.memo`, id ổn định (`crypto.randomUUID()`) làm key thay vì index.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — `types.ts`: thêm field `id: string` vào `LineForm` (client-only, không nằm trong `HoaDonLinePayload`/BE payload) + helper `newLine()` (id = `crypto.randomUUID()`), `chiTietToLine()` gán id khi nạp dữ liệu từ API. `DetailGrid.tsx`: tách toàn bộ render 1 dòng thành component `DetailRow` bọc `memo()`, `TableBody` giờ `key={l.id}` thay vì index; `HoaDonFormDialog.tsx`: `setLine`/`addLine`/`removeLine` bọc `useCallback([])` (deps rỗng, dùng functional `setForm`) để giữ reference ổn định qua các render — nếu không memo() ở DetailRow vô nghĩa vì callback prop đổi mỗi lần. tsc+eslint pass, commit "chưa commit" *(frontend-engineer)*

### RVW-N13 🟡 NON-BLOCKING — Picker tài khoản render toàn bộ hệ thống tài khoản, không cắt/không ảo hóa
- Vị trí: `src/components/Accounting/TaiKhoanPickerDialog.tsx`:27-29 · `PickerDialog.tsx`:125-158
- Vấn đề: BE trả mảng đầy đủ không phân trang; hệ thống tài khoản chi tiết có thể vài nghìn dòng, mở picker khựng vài trăm ms.
- Đề xuất fix: `filtered.slice(0, 200)` + dòng "còn N kết quả, gõ thêm để lọc".
- Trạng thái: OPEN
  → FIXED [2026-09-11] — sửa ở `PickerDialog.tsx` (dùng chung cho mọi picker lọc client, gồm
    `TaiKhoanPickerDialog.tsx`) thay vì riêng `TaiKhoanPickerDialog.tsx`, vì cắt số dòng render
    là hành vi chung của dialog, không riêng danh mục tài khoản: thêm hằng `MAX_VISIBLE_ROWS = 200`,
    `visible = filtered.slice(0, MAX_VISIBLE_ROWS)` render thay `filtered`, thêm dòng "Còn N kết
    quả, gõ thêm để lọc." dưới `selectHint` khi `hiddenCount > 0`. Picker đã server-side (vd
    `VatTuPickerDialog`/`KhachHangPickerDialog` — `isControlled=true`) không bị ảnh hưởng vì
    `rows` đã giới hạn từ BE. tsc+eslint pass, commit "chưa commit" *(frontend-engineer)*

### 🟢 Suggestion (gộp gọn, không đánh RVW riêng)
- Quy ước path lộn xộn 3 kiểu (kebab/snake, `dm`/`danh_muc`) — chuẩn hóa khi làm RVW-N11.
- 11 page wrapper `pages/accounting/**` giống hệt nhau (~230 dòng) — gộp layout route (RVW-N10).
- 4 list component (TaiKhoan/TienTe/PhongBan/KhachHang) trùng ~90% (~900 dòng) — tách `<CatalogTable columns={...}>`.
- `ModulePage.tsx` tự dựng lại thứ MUI đã có (resize listener thủ công thay `useMediaQuery`, mutate style cho hover thay `sx:hover`, màu hardcode không theo theme).
- Nút "Xem báo cáo" là nút chết (`onClick={() => {}}`) — disable + tooltip.
- `calc.ts`:17-18 vs 41-42 — comment tự mâu thuẫn về việc `so_luong` có tự tính hay không.
- Tổng ở FE chưa `round()` như BE (`calc.ts`:83) — che được nhờ `fmt`/`fmtMoney` nuốt nhiễu float nhưng 2 hàm format lệch số lẻ hiển thị.
- `he_so2 = 0` để `so_luong_giao` cũ nằm lại — số lượng bán thực tế lấy theo giá trị tồn đọng lần chọn hàng trước.
- `useCatalogList` stringly-typed (`searchKeys: string[]`), không kẹp `page` khi `filtered` co lại.
- `PickerDialog` prop controlled thiếu type-safety; `internalSearch` không reset khi đóng dialog.
- **Không có 1 dòng test nào trong `hdđt_maxv`** — nên thêm 1 file check nhỏ cho `calc.ts` (thuần, không phụ thuộc React) để khóa RVW-S07/S08 không trôi khỏi BE.
- Import lệch chuẩn ở `ModulesPage.tsx` (dùng `../../` thay vì alias `@/`); 2 helper điều hướng có 2 hợp đồng path khác nhau (`goTo` vs `openPath`).

---

## Review 2026-09-11 — Nhóm 4/9 (audit toàn bộ `hdđt_maxv/src`): tồn kho — Verdict: ❌ Request changes

> Phạm vi: `features/accounting/ton_kho/**` (41 file — 100% danh mục: dvt, hang_hoa, kho, loai_vt, ma_gd, nhom_kho, phan_nhom, vi_tri_kho). **Không có** logic FIFO/bình quân gia quyền/tính giá vốn trong module này — chỉ danh mục gốc nuôi các phép tính đó về sau.

### RVW-TK-001 🔴 BLOCKING — Danh mục hàng hóa cắt cứng ở 500 dòng, hàng thứ 501 trở đi không thể thấy/sửa/xóa
- Vị trí: `.../ton_kho/danh_muc/hang_hoa/components/HangHoaList.tsx`:43-44, 171, 259-271
- Vấn đề: `useHangHoaList({limit: 500})` không truyền `page`; response `{data, total, page, limit}` nhưng `total` bị vứt đi; `TablePagination count={list.filtered.length}` chỉ đếm 500 dòng đã tải; search chạy client-side trên đúng 500 dòng đó dù BE có sẵn `search` (đã chứng minh hoạt động ở `VatTuPickerDialog.tsx`:28-31 dùng cùng hook với `limit:50`).
- Đề xuất fix: chuyển server paging — `{search: debounced, page: list.page+1, limit: list.rpp}`, render `data.data`, `count={data?.total ?? 0}`.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — `HangHoaList.tsx`:42-62 bỏ `{limit: 500}` cố định, gọi `useHangHoaList({search: list.search, page: list.page+1, limit: list.rpp})` (dùng `search/page/rpp` của `useCatalogList`, độc lập với `rows`), render `data.data`/`data?.total ?? 0` thay vì `list.filtered`/`list.paged`; info bar + `TablePagination.count` đổi sang `data?.total ?? 0`; `confirmDelete` đổi `setSelected` → `list.setSelectedId`. tsc+eslint+build pass, commit "chưa commit" *(frontend-engineer)*

### RVW-TK-002 🔴 BLOCKING — Hệ số quy đổi ĐVT 2 (`he_so2`) nhận giá trị âm, không chặn ở cả FE lẫn BE
- Vị trí: `.../hang_hoa/components/HangHoaFormDialog.tsx`:544-551 · `.../hang_hoa/types.ts`:55, 183
- Vấn đề: `Number(e.target.value) || 1` chặn được `0` nhưng không chặn âm; BE `he_so2: z.number().default(1)` không có `.positive()`. `he_so2` là hệ số quy đổi ĐVT chính/ĐVT2 — mọi nghiệp vụ nhập/xuất/tồn/giá vốn sau này nhân/chia cho nó.
- Đề xuất fix: FE thêm `min={0}` + validate `he_so2 > 0` trong `handleSave`; BE cần đổi `z.number().positive()` (báo Architect, thuộc API contract).
- Trạng thái: OPEN
  → FIXED một phần [2026-09-11] — chỉ sửa phần FE (đúng phạm vi frontend-engineer): `HangHoaFormDialog.tsx`:545 thêm `min={0}` cho input hệ số; `handleSave`:187-193 chặn lưu khi `form.dvt2` khác rỗng và `form.he_so2 <= 0` (set tab 0 + báo lỗi rõ ràng, không gọi API). Phần BE (`he_so2: z.number().positive()` ở `be_maxv/src/validators/accounting/tonKho/hangHoa.validator.ts`) **CHƯA sửa** — nằm ngoài phạm vi frontend-engineer (đổi API contract), cần Architect/backend-engineer xử lý riêng; guard FE hiện tại chỉ chặn được đường nhập liệu qua UI, không chặn được client khác gọi thẳng API. tsc+eslint+build pass, commit "chưa commit" *(frontend-engineer)*

### RVW-TK-003 🟡 NON-BLOCKING — `HangHoaFormDialog` không phải `<form>`: dấu `*` chỉ trang trí, Enter không lưu
- Vị trí: `.../hang_hoa/components/HangHoaFormDialog.tsx`:209-411, 261, 272, 513, 360-376
- Vấn đề: 7/8 dialog còn lại dùng `<Box component="form">` + `required`; riêng dialog hàng hóa (phức tạp nhất, 4 tab) dùng `<div>` + `onClick` — không validate gì trước khi POST.
- Đề xuất fix: bọc `<form onSubmit>` như 7 dialog kia, hoặc validate 3 trường bắt buộc + `setTab(0)` khi lỗi ở tab 0.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — `HangHoaFormDialog.tsx`: đổi `<div>` container thành `<form onSubmit={handleSubmit}>` (Enter giờ submit như 7 dialog kia), mọi nút không-submit (đóng X, tab bar, Sửa, Hủy/Đóng) thêm `type="button"` để không bị submit nhầm, nút Lưu đổi `type="submit"`. `handleSubmit` (đổi tên từ `handleSave`) validate tay 3 trường bắt buộc (`ma_vt`, `ten_vt`, `dvt`) — không dùng `required` HTML vì field `dvt` nằm trong tab bị unmount khi không active nên native validation không chạy được; lỗi ở `dvt` tự `setTab(0)`. tsc+eslint+build pass, commit "chưa commit" *(frontend-engineer)*

### RVW-TK-004 🟡 NON-BLOCKING — Thông báo lỗi lưu nằm cuối vùng cuộn, dễ bị khuất
- Vị trí: `.../HangHoaFormDialog.tsx`:325-345
- Đề xuất fix: chuyển khối error lên đầu `{tab === 0 && ...}` như 7 dialog kia đang làm.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — `HangHoaFormDialog.tsx`: khối Alert lỗi lưu chuyển lên đầu vùng cuộn (trước `{tab===0 && ...}`), giờ luôn hiện ngay bất kể đang ở tab nào thay vì chỉ hiện cuối tab 0. tsc+eslint+build pass, commit "chưa commit" *(frontend-engineer)*

### RVW-TK-005 🟡 NON-BLOCKING — 8 request lookup bắn ngay khi mở trang, kể cả khi không mở form
- Vị trí: `.../HangHoaFormDialog.tsx`:157 (`useLookups()` không có `enabled`)
- Đề xuất fix: `useLookups({enabled: open})` — hook đã có sẵn cơ chế `options?.enabled`.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — `useHangHoa.ts` (`useLookups`) trước đó CHƯA có `options?.enabled` như
    finding mô tả (chỉ `useHangHoaList` mới có) — thêm mới `options?: {enabled?: boolean}`, gộp
    vào biểu thức `enabled` hiện có (`(options?.enabled ?? true) && isAuthenticated && !!currentCompanyId`);
    `HangHoaFormDialog.tsx`:159-163 gọi `useLookups({enabled: open})`. tsc+eslint+build pass,
    commit "chưa commit" *(frontend-engineer)*

### RVW-TK-006 🟡 NON-BLOCKING — Lookup lỗi bị nuốt hoàn toàn, mọi dropdown rỗng không thông báo
- Vị trí: `.../HangHoaFormDialog.tsx`:157, 183
- Vấn đề: `Promise.all` nghĩa là 1/8 endpoint lỗi → cả query fail → mọi dropdown rỗng, không có Alert nào.
- Đề xuất fix: đọc `isError`, hiện Alert + nút retry.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — `HangHoaFormDialog.tsx`:159-163 đọc thêm `isError: lkIsError,
    refetch: refetchLookups` từ `useLookups`; thêm khối Alert (màu vàng, tách biệt Alert lỗi
    lưu) ngay dưới lỗi lưu ở đầu vùng cuộn, hiện khi `lkIsError`, kèm nút "Thử lại" gọi
    `refetchLookups()`. tsc+eslint+build pass, commit "chưa commit" *(frontend-engineer)*

### RVW-TK-007 🟡 NON-BLOCKING — Lỗi mạng hiện nguyên văn "Failed to fetch" cho người dùng (toàn app, 16 nơi trong module này)
- Vị trí: `hdđt_maxv/src/lib/errors.ts`:5-7
- Đề xuất fix: nhận diện `err instanceof TypeError` → trả "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại." — sửa 1 chỗ, hưởng lợi toàn app.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — `errors.ts`:5-13 `getErrorMessage` thêm nhánh `err instanceof
    TypeError` (fetch() ném đúng loại này khi mất mạng/BE sập) trả về thông điệp tiếng Việt
    thân thiện, kiểm tra TRƯỚC nhánh `err instanceof Error` hiện có (ApiError vẫn qua nhánh cũ
    bình thường vì không phải TypeError). Sửa đúng 1 chỗ dùng chung toàn app đúng như đề xuất.
    tsc+eslint+build pass, commit "chưa commit" *(frontend-engineer)*

### RVW-TK-008 🟡 NON-BLOCKING — `ma_dvcs` hardcode `'001'`, ô "Đơn vị" hiển thị một đằng lưu một nẻo
- Vị trí: `.../kho/types.ts`:34, 47 · `.../kho/components/KhoFormDialog.tsx`:68, 93-98 · `KhoList.tsx`:167
- Vấn đề: form hiển thị tên công ty hiện tại nhưng gửi hằng `'001'`; bảng danh sách render `tenDonVi || r.ma_dvcs` cho mọi dòng nên kho `ma_dvcs='002'` vẫn hiện tên công ty hiện tại.
- Đề xuất fix: nếu chỉ 1 đơn vị cơ sở — đặt hằng có tên + comment lý do, cột danh sách render `r.ma_dvcs` không phải `tenDonVi`; nếu đa đơn vị là yêu cầu thật thì cần Select, báo BA.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — `kho/types.ts`:1-6 thêm hằng `MA_DVCS_MAC_DINH = '001'` kèm comment
    lý do (giả định hiện chỉ 1 đơn vị cơ sở/tenant), `EMPTY_KHO.ma_dvcs` + `khoToForm` fallback
    dùng hằng này thay vì chuỗi `'001'` rời rạc; `KhoFormDialog.tsx`:68-70 thêm comment làm rõ
    `tenDonVi` chỉ hiển thị cho biết đang thao tác ở đâu, giá trị thật gửi BE luôn là
    `MA_DVCS_MAC_DINH`; `KhoList.tsx` cột "Đơn vị" đổi render từ `tenDonVi || r.ma_dvcs` sang
    `r.ma_dvcs` (không còn nói dối khi có dòng `ma_dvcs` khác `'001'`), bỏ import/biến `tenDonVi`
    không dùng nữa. Không thêm Select đa đơn vị — ngoài phạm vi đề xuất "chỉ 1 đơn vị cơ sở".
    tsc+eslint+build pass, commit "chưa commit" *(frontend-engineer)*

### RVW-TK-009 🟡 NON-BLOCKING — Các trường số nhận giá trị âm, `sl_min > sl_max` không bị chặn
- Vị trí: `.../HangHoaFormDialog.tsx`:762-779, 821-838, 839-874
- Đề xuất fix: `min={0}` cho 6 input; kiểm `sl_min <= sl_max` trong `handleSave`.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — `HangHoaFormDialog.tsx` thêm `min={0}` cho 6 input số (`so_ngay_sp`,
    `so_ngay_bh` ở TabLo; `sl_min`, `sl_max`, `volume`, `weight` ở TabKhac); `handleSubmit` thêm
    2 guard: chặn lưu khi 1 trong 6 trường < 0 (nhảy về đúng tab chứa lỗi), và chặn khi
    `sl_min > sl_max` (cả hai đều > 0). tsc+eslint+build pass, commit "chưa commit" *(frontend-engineer)*

### RVW-TK-010 🟡 NON-BLOCKING — 4 mục menu bấm vào không làm gì (silent no-op)
- Vị trí: `.../HangHoaList.tsx`:83 (`const noop = () => {}`), 134-155
- Đề xuất fix: `disabled: true` + tooltip "Sắp có".
- Trạng thái: OPEN
  → FIXED [2026-09-11] — `CatalogToolbar.tsx` (`CatalogMoreItem`) thêm `disabled?`/`disabledReason?`,
    `Menu` render `MenuItem` disabled + bọc `Tooltip` khi có `disabledReason` (MUI yêu cầu bọc
    `<span>` quanh control disabled để Tooltip vẫn hoạt động); `HangHoaList.tsx` cả 4 mục
    "Xuất Excel"/"Lấy dữ liệu từ tệp…"/"Tải tệp mẫu…"/"Khóa cột" thêm `disabled: true,
    disabledReason: "Sắp có"`. tsc+eslint+build pass, commit "chưa commit" *(frontend-engineer)*

### RVW-TK-011 🟡 NON-BLOCKING — Form hàng hóa reset khi query `detail` refetch, xóa mất nội dung đang gõ
- Vị trí: `.../HangHoaFormDialog.tsx`:166-177
- Vấn đề: hiện chưa nổ nhờ `refetchOnWindowFocus:false`, nhưng là an toàn tình cờ.
- Đề xuất fix: deps ổn định `[open, mode, maVt, detail?.ma_vt]` hoặc `hydratedRef` chỉ nạp 1 lần.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — `HangHoaFormDialog.tsx` effect nạp `detail` vào form đổi deps từ
    `[open, mode, detail]` (object đổi tham chiếu mỗi refetch) sang `[open, mode, maVt,
    detail?.ma_vt]` (đúng đề xuất) — refetch ngầm không còn re-run effect trừ khi `maVt` đổi;
    `eslint-disable-next-line react-hooks/exhaustive-deps` kèm comment giải thích cố ý. tsc+eslint+build pass, commit "chưa commit" *(frontend-engineer)*

### RVW-TK-012 🟡 NON-BLOCKING — 8 bản sao gần như y hệt của cùng 1 màn danh sách (~1700 dòng trùng lặp)
- Vị trí: `DvtList.tsx`, `KhoList.tsx`, `LoaiVtList.tsx`, `MaGdList.tsx`, `NhomKhoList.tsx`, `PhanNhomList.tsx`, `ViTriKhoList.tsx`, `HangHoaList.tsx`
- Bằng chứng: `DvtList.tsx`:148,182 để `colSpan={5}` trên bảng 4 cột (chép từ file 5 cột) — bug đã hiện hình từ duplicate.
- Đề xuất fix: tách `<CatalogTableShell>` nhận `columns/rows/isLoading/isFetching/error/noun/list`; 7 file danh mục rút xuống ~60 dòng khai cột.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — làm SAU CÙNG (sau khi 10 finding kia đã xong + verify sạch) như yêu
    cầu, để tránh 1 refactor lớn làm khó debug các fix nhỏ khác. Thêm mới
    `src/components/Accounting/catalog/CatalogTableShell.tsx` (component: Toolbar + info bar +
    Alert lỗi + Table + TablePagination — gộp đúng phần lặp lại ở cả 7 file, tự tính `colSpan`
    từ `columns.length` nên bug `colSpan={5}` trên bảng 4 cột của `DvtList.tsx` KHÔNG còn cách
    nào tái diễn) + `catalogColumns.tsx` (tách riêng khỏi Shell vì eslint
    `react-refresh/only-export-components` không cho 1 file export vừa component vừa hàm thường
    — export `CatalogColumn<T>` type + `statusColumn<T>()` factory cho cột "Trạng thái" giống
    hệt ở cả 7 màn). Viết lại `DvtList.tsx`/`KhoList.tsx`/`LoaiVtList.tsx`/`MaGdList.tsx`/
    `NhomKhoList.tsx`/`PhanNhomList.tsx`/`ViTriKhoList.tsx` dùng `<CatalogTableShell<T>
    columns={...} list={list} .../>`, mỗi file chỉ còn khai `COLUMNS` + hooks + `confirmDelete`
    + 2 Dialog — giữ nguyên 100% text hiển thị gốc (info label/count suffix/not-found/empty
    label khác nhau từng file, truyền qua props riêng, KHÔNG generic hoá theo 1 `noun` chung vì
    wording gốc vốn không đồng nhất giữa các file, vd Dvt đếm "đơn vị" nhưng empty-state nói
    "đơn vị tính"), giữ nguyên `getId`/`rowId`/tham số xóa 1-khóa hay 2-khóa riêng từng danh mục
    (MaGd/ViTriKho 2 khóa, PhanNhom dùng `rowId(selected)`). **HangHoaList.tsx KHÔNG đụng** —
    đã có server paging riêng từ RVW-TK-001, cấu trúc 18 cột không có ô Trạng thái riêng, không
    đáng gộp. tsc + eslint sạch trên cả `ton_kho` lẫn `components/Accounting/catalog` sau mỗi
    file đổi (đọc lại từng file để so khớp cột/hành động Sửa/Copy/Xóa/dialog message với bản
    gốc trước khi ghi). tsc+eslint+build pass toàn project, commit "chưa commit" *(frontend-engineer)*

### RVW-TK-013 🟡 NON-BLOCKING — `ten_nhkho` được BE trả về nhưng không cột nào hiển thị
- Vị trí: `.../kho/types.ts`:11 vs `KhoList.tsx`:138-144
- Đề xuất fix: thêm cột "Nhóm kho" vào `KhoList`, hoặc bỏ join ở BE + bỏ invalidate chéo.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — `KhoList.tsx` thêm cột "Nhóm kho" render `r.ten_nhkho || "—"` (chọn
    nhánh giữ cột thay vì bỏ join BE — đơn giản hơn, thuộc phạm vi FE). Cột này cũng đi qua đợt
    refactor RVW-TK-012 nên nằm trong `COLUMNS` của `KhoList.tsx` chung với 4 cột còn lại.
    tsc+eslint+build pass, commit "chưa commit" *(frontend-engineer)*

### RVW-TK-014 🟡 NON-BLOCKING — `selected` giữ bản chụp cũ (cùng lớp lỗi RVW-B03 của nhóm ban_hang)
- Vị trí: `src/components/Accounting/catalog/useCatalogList.ts`:26, 58-61
- Đề xuất fix: lưu `selectedId` thay vì object — **gộp chung sửa với RVW-B03**.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — đã sửa cùng lúc với RVW-B03 (xem dòng 30, `useCatalogList.ts`:24-71) — hook dùng chung cho cả 5 màn ban_hang/tổng hợp lẫn 8 màn tồn kho, 1 chỗ sửa phủ cả 2 nhóm. Không có diff riêng cho TK-014, chỉ ghi lại trạng thái cho khớp thực tế (bản ghi này bị sót khi RVW-B03 FIXED). tsc+eslint+build pass, commit "chưa commit" *(frontend-engineer, ghi bởi agent điều phối)*

### 🟢 Suggestion (gộp gọn)
- `DvtList.tsx`:148,182 `colSpan={5}` trên bảng 4 cột.
- `ma_gd/types.ts`:36 comment sai lệch code (nói nối bằng `/`, code nối bằng dấu cách).
- `vi_tri_kho/types.ts`:35-36 `rowId` nối bằng dấu cách có thể trùng nếu mã chứa dấu cách.
- `HangHoaFormDialog.tsx`:39,179-180 `Setter=(k, v:unknown)` vô hiệu type-check, nên đồng bộ theo mẫu 7 dialog kia.
- `HangHoaFormDialog.tsx`:519-524 chọn ĐVT luôn ghi đè ĐVT2, xóa lựa chọn user đã tự đặt.
- `HangHoaFormDialog.tsx` dùng inline style hex cứng + `<table>` layout thay vì MUI theme — không đổi dark-mode được.
- A11y: nút đóng Drawer thiếu `aria-label`, tab thiếu `role="tablist"`, `FRow` render nhãn trong `<td>` không `<label htmlFor>`.
- `PhanNhomFormDialog.tsx`:89-111 khóa `ma_nh` nhưng để `loai_nh` sửa tự do dù cả hai thuộc khóa chính.
- `useNhomKho.ts`:37 invalidate `khoKeys.all` không gắn `companyId`.

---

**Security findings (cả 2 nhóm):** không có lỗ hổng. Cache key gắn `companyId` nhất quán, `encodeURIComponent` đủ ở path param, không `dangerouslySetInnerHTML`/`eval`, không log credential. Duy nhất RVW-B/N liên quan là RVW-N04 (mã thuế không validate) và RVW-TK-002 (hệ số âm) — cả hai thuộc lớp "thiếu ràng buộc giá trị ở BE", không phải injection/XSS.

**Final recommendation:** ❌ Request changes — 5 blocking tổng cộng (RVW-B01, B02, B03, TK-001, TK-002). Ưu tiên: B01/B02 (crash đang xảy ra) → B03/TK-014 (mất dữ liệu, sửa 1 chỗ dùng chung) → TK-001/TK-002 → còn lại theo mức ảnh hưởng.
