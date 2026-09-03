# Lập tờ khai thuế GTGT mẫu 01/GTGT từ hóa đơn điện tử — thiết kế

> Trạng thái: **chờ duyệt**. Chốt qua phiên brainstorm ngày 2026-08-28. Mọi mã trạng thái, tên cột
> và công thức trong spec này đều dẫn nguồn từ code đang chạy hoặc từ XML tờ khai thật đã đồng bộ —
> chỗ nào chưa kiểm chứng được thì ghi rõ ở mục 11.

## 1. Mục tiêu và phạm vi

Dựng module **"Tờ khai"** — module thứ 5 bán kèm gói đăng ký (sau `hrm`, `accounting`, `dvc`) — lấy
hóa đơn điện tử mua vào/bán ra đã đồng bộ trong DB tenant, tổng hợp thành tờ khai thuế GTGT **mẫu
01/GTGT** (khấu trừ, TT80/2021/TT-BTC), cho kế toán sửa tay, lưu lại và xuất Excel.

**Trong phạm vi lát này:**

- Kỳ kê khai theo **tháng** hoặc **quý**.
- Tính chỉ tiêu từ hóa đơn, hiện trên form dựng đúng mẫu in, sửa tay được, lưu bản nháp, chốt bản.
- Bảng kê hóa đơn cấu thành từng chỉ tiêu (bấm số ra hóa đơn).
- Xuất Excel.

**Ngoài phạm vi lát này** (xem mục 12): sinh XML nộp qua eTax, ký số, nộp lên cổng, hóa đơn mua vào
sót kỳ trước, các mẫu tờ khai khác (05/KK-TNCN, 03/TNDN…).

## 2. Hiện trạng làm nền

### 2.1. Cái đã có, dùng lại được

| Thứ | Ở đâu | Dùng để |
|---|---|---|
| Cache hóa đơn bán ra / mua vào | `vct50view` / `vct60view` (tenant schema) | Nguồn số liệu duy nhất |
| Lịch sử đồng bộ | `sync_log` + `isMonthCoveredByDoneLog` (`gdt.service.ts`) | Biết kỳ đã đồng bộ trọn chưa |
| Layout mẫu in 01/GTGT | `hdđt_maxv/src/features/dich_vu_cong/components/ToKhaiGtgt01Form.tsx` | Tái dùng cho form nhập |
| XML tờ khai thật đã nộp | `dvc_ho_so.xml_to_khai_bin` + `toKhaiXml.ts` | Đối chiếu số máy tính với số đã nộp |
| Khuôn module bán theo gói | `constants/modules.ts`, `requireModule()`, `ModuleRoute` | Bật/tắt `tokhai` theo gói |

### 2.2. Cái CHƯA có — mấu chốt của cả thiết kế

**Lượt "Đồng bộ" KHÔNG lưu chi tiết hóa đơn.** `saveInvoices()` (`gdt.service.ts:742`) chỉ ghi các
cột lấy từ *danh sách* GDT trả về: `tgtcthue`, `tgtthue`, `tgtttbso`… tức **tổng của cả hóa đơn**.
Cột `detail` chỉ được ghi bởi `runDetailFetch()` (`gdt.service.ts:3001`) — tức nút **"Tải chi tiết"**
hoặc nút **"Cập nhật từ Thuế điện tử"** (lượt 2 pha: lấy danh sách rồi tải chi tiết).

Hai thứ chỉ nằm trong `detail`, không có trong danh sách, mà tờ khai bắt buộc phải có:

1. **`thttltsuat`** — mảng gộp tiền theo từng mức thuế suất. Không có nó thì không tách được [29]
   (0%), [30]/[31] (5%), [32]/[33] (10%), [32a] (không tính thuế). Chỉ biết tổng cả hóa đơn.
2. **`khhdgoc` / `shdgoc`** — hóa đơn này thay thế/điều chỉnh cho hóa đơn nào. Thiếu nó thì hóa đơn
   đã bị thay thế vẫn bị cộng vào doanh thu, tức **kê khống số bán ra**.

Vì vậy điều kiện để lập tờ khai không phải "kỳ đã đồng bộ" mà là "kỳ đã đồng bộ **và** không còn
hóa đơn nào `detail IS NULL`". Cả hai đều kiểm được bằng cách đọc DB, không cần gọi cổng thuế.

## 3. Quyết định đã chốt

| # | Quyết định | Lý do |
|---|---|---|
| 1 | Đầu ra lát này là **form + bảng kê + Excel**; XML nộp thuế để lát 2 | Ra thứ dùng được ngay, chưa ôm rủi ro XML sai chuẩn bị cổng từ chối |
| 2 | Module tờ khai **chỉ đọc DB**, không gọi cổng thuế, không nhận `X-Gdt-Token` | Giữ ranh giới sạch giữa hai module; test được mà không cần token |
| 3 | Kỳ chưa đồng bộ trọn thì **cảnh báo** ở dialog Kê khai, nút đổi thành "Vẫn kê khai" | Không sinh ra con số nửa vời mà người đọc tưởng là đủ. Sửa 2026-09-02: cảnh báo thay vì chặn cứng — có lúc kế toán cố ý kê phần đang có (xem `phuKy.ts`) |
| 4 | Lưu **1 dòng/kỳ**, vòng đời `nhap` → `chot` | Đủ cho nhu cầu thật; nhiều bản/kỳ (khai bổ sung) để sau |
| 5 | [22] lấy [43] của kỳ trước (chốt HOẶC nháp), thiếu thì nhập tay | Không buộc bật module `dvc`. Sửa 2026-09-02: nhận cả bản nháp, nguồn ghi ở `nguon_ct22` để màn hình cảnh báo khi kỳ trước còn nháp |
| 6 | Hàng **8%** kê vào [32]/[33] như hàng 10%, số thuế ghi theo thực tế 8% | Mẫu 01/GTGT không có dòng 8% riêng; [33] không bị ràng buộc bằng [32]×10% |
| 7 | Module thứ 5 trong gói đăng ký, khóa `tokhai`, route `/to-khai` | Bán kèm gói như `dvc`/`hrm` |

## 4. Module `tokhai` trong gói đăng ký

Quyền module nằm trong `SubscriptionPlan.features` (kiểu `Json`) nên **thêm module không cần
migration DB sys**. Sáu chỗ phải sửa:

| Chỗ | Việc | Tình trạng |
|---|---|---|
| `be_maxv/src/constants/modules.ts` | Thêm `'tokhai'` vào `MODULE_KEYS` — validator gói + kiểu dữ liệu BE tự suy theo | đã làm |
| `maxv/src/features/owners/modules.ts` | Thêm `'tokhai'` + `MODULE_META` (nhãn "Tờ khai") — bảng tài khoản và form gói bên admin tự hiện ô tick | đã làm |
| `hdđt_maxv/src/features/auth/types/index.ts` | Thêm `"tokhai"` vào `MODULE_KEYS` (ba app không dùng chung package — đây là chỗ phải nhớ đồng bộ) | đã làm |
| `hdđt_maxv/src/components/AppHeader.tsx` | Nút "Tờ khai" trước nút "Dịch vụ công", bọc `{modules.tokhai && …}` | **đã làm** |
| `hdđt_maxv/src/routes/AppRouter.tsx` | Route `/to-khai` bọc `ProtectedRoute` + `ModuleRoute module="tokhai"` | đã làm |
| `be_maxv/src/routes/index.route.ts` | `app.register(toKhaiRoutes, { prefix: '/api/v1/to-khai' })` | đã làm |

Cả sáu chỗ đã làm xong (2026-08-31).

Khóa `tokhai` sẽ được ghi vào `features` của các gói đã bán; đổi tên sau này phải sửa dữ liệu, nên
chốt tên ngay từ đầu.

## 5. Kiến trúc và cấu trúc file

Module chỉ đọc `vct50view` / `vct60view` / `sync_log` / `tokhai_gtgt01`. **Không** endpoint nào chạm
cổng thuế — đây là ràng buộc kiểm chứng được: không file nào trong module được import `gdt-client`
hay đọc header `X-Gdt-Token`.

Đặt folder **ngang hàng `dich_vu_cong`**, không nằm trong `hddt`: đây là module bán theo gói riêng,
có route riêng và prefix API riêng, giống hệt cách `dich_vu_cong` tách khỏi `hddt`.

Cấu trúc thật sau khi triển khai xong (cập nhật 2026-09-02):

```
be_maxv/src/
  services/client/to_khai/
    kySoThue.ts               — quy đổi kỳ (T7/2026, Q3/2026) <-> khoảng ngày
    phuKy.ts                  — kỳ đã đồng bộ trọn chưa (đọc sync_log), THUẦN
    gomHoaDonGtgt.ts          — lọc theo trạng thái + gộp theo thuế suất + gộp theo nhãn, THUẦN
    tinhGtgt01.ts             — vào là số đã gộp + ô nhập tay, ra là bộ chỉ tiêu, THUẦN
    phuLuc204.ts              — dựng phụ lục giảm thuế 204/2025 từ kết quả gộp, THUẦN
    keKhaiKy.service.ts       — đánh dấu hóa đơn vào kỳ, bảng kê, ô Quyết định
    toKhaiGtgt01.service.ts   — đọc/ghi nháp, chốt, mở khóa, bắc cầu [22] kỳ trước
  controllers/client/to_khai/
    docThamSo.ts              — đọc + kiểm tra tham số kỳ dùng chung hai controller
    keKhaiKy.controller.ts
    toKhaiGtgt01.controller.ts
  routes/to_khai/toKhai.route.ts   — một file route cho cả hai controller
  __tests__/  kySoThue · gomHoaDonGtgt · tinhGtgt01 · phuKy · phuLuc204 ·
              quyetDinhKeKhai · toKhaiGtgt01Ghide · moduleTokhai   (chạy bằng `npx tsx --test`)

hdđt_maxv/src/
  pages/to_khai/ToKhai.tsx
  features/to_khai/
    ky.ts                     — kiểu Ky/ToKhaiRow + quy đổi kỳ <-> query string
    layout.ts                 — KHO_GIAY_TO_KHAI (bề rộng "tờ giấy" của mẫu in)
    api/toKhai.ts + toKhaiQueries.ts        — bảng kê, đánh dấu kỳ, ô Quyết định
    api/gtgt01.ts + gtgt01Queries.ts        — tính, lưu nháp, chốt, mở khóa, phụ lục
    components/ChonKyPanel.tsx              — dòng chọn kỳ thu gọn
    components/DialogKeKhai.tsx             — chọn kỳ khi bấm "Kê khai" bên Hóa đơn điện tử
    components/ToKhaiInvoiceTabs.tsx        — ba tab: mua vào / bán ra / tờ khai
    components/ToKhaiGtgt01Editor.tsx       — mẫu in nhập được
    components/PhuLuc204Panel.tsx           — phụ lục giảm thuế
    components/OQuyetDinh.tsx               — ô "Kê khai / Không kê khai" trong bảng kê
    components/DanhSachKyDaLap.tsx
    templates/dauVao.ts · dauRa.ts · index.ts · quyetDinhCell.tsx   — 26 cột bảng kê
    xuatToKhaiExcel.ts
  features/_shared/to_khai/
    gtgt01Layout.ts           — mảng HANG_GTGT01, dùng chung với màn Dịch vụ công
    soTien.ts                 — fmtSoTien (in dấu chấm) + docSoTien (đọc ngược khi nhập)
```

Năm folder `lap_to_khai/` rỗng vẫn còn trong `be_maxv/src/{controllers/client/hddt,routes/hddt,
services/client/hddt}/` và `hdđt_maxv/src/{features/hddt,components}/` — dấu vết của lần chuẩn bị
trước, chưa xóa. Git không theo dõi thư mục rỗng nên chúng chỉ nằm trên đĩa; xóa lúc nào cũng được.

`tinhGtgt01.ts` không đụng DB, không đụng HTTP: mọi con số đem đi nộp thuế đều đi qua một hàm thuần
test được. Đó là lý do tách `gomHoaDonGtgt` (đọc DB, gộp) khỏi `tinhGtgt01` (thuần, tính).

### 5.1. Layout mẫu in dùng chung cho hai màn

`ToKhaiGtgt01Form.tsx` bên `dich_vu_cong` đang giữ mảng `HANG` — 30 dòng chỉ tiêu kèm nhãn, công
thức in trên mẫu, mức thụt lề. Đã tách mảng đó sang
`hdđt_maxv/src/features/_shared/to_khai/gtgt01Layout.ts`, rồi hai màn dùng chung:

- màn Dịch vụ công render **chỉ đọc** (số bóc từ XML đã nộp) — hành vi giữ nguyên như hiện nay;
- màn Tờ khai render **nhập được** (số máy tính + ô sửa tay).

Chép mảng `HANG` sang file thứ hai là cầm chắc hai bản trôi lệch nhau khi mẫu tờ khai đổi.

## 6. Bảng dữ liệu `tokhai_gtgt01`

Thêm vào `be_maxv/prisma/tenant/schema.prisma`. Tên **không** dùng tiền tố `tk_` vì trong kế toán
`tk` là *tài khoản* (`dmtk`, `tk_thue_no`, `tk_thue_co`).

| Cột | Kiểu | Việc |
|---|---|---|
| `nam` | `Int` | Năm kỳ tính thuế |
| `ky_loai` | `VarChar(8)` | `thang` \| `quy` |
| `ky_so` | `Int` | 1..12 (tháng) hoặc 1..4 (quý) |
| `trang_thai` | `VarChar(16)` | `nhap` \| `chot` |
| `ct` | `Json` | Bộ chỉ tiêu CUỐI — số đem đi nộp: `{ct22, ct23, …, ct43}` |
| `ct_may` | `Json` | Số máy tự tính, giữ nguyên để đối chiếu với ô đã sửa tay |
| `ghi_de` | `Json` | Ô nào kế toán sửa + lý do: `{ct25: {gia: …, lyDo: "…"}}` |
| `ct22`, `ct40`, `ct43` | `Decimal(18,2)` | Bản sao của ba khóa cùng tên trong `ct`, bóc ra cột để truy vấn: `ct43` cho kỳ sau nối [22]; `ct40`/`ct22` cho bảng danh sách kỳ. Ghi cùng lượt với `ct`, không có đường nào sửa riêng |
| `phu_luc` | `Json?` | Phụ lục giảm thuế 204/2025 của kỳ (xem mục 11bis). `null` = chưa tính hoặc kỳ không có hàng 8% |
| `nguon_ct22` | `VarChar(16)` | `ky_truoc` \| `ky_truoc_nhap` \| `nhap_tay` — hiện rõ số này ở đâu ra. `ky_truoc_nhap` là kỳ trước còn nháp nên [43] còn đổi được, màn hình cảnh báo |
| `so_hd_ban`, `so_hd_mua` | `Int` | Ảnh chụp độ phủ dữ liệu lúc tính |
| `so_hd_khong_ke_khai` | `Int` | Số tờ kế toán đã đánh "Không kê khai" — nhìn tờ khai là biết đã loại bao nhiêu, khỏi mở lại bảng kê đếm |
| `hd_thieu_detail` | `Int` | Số hóa đơn thiếu chi tiết lúc tính (bản hợp lệ phải là 0) |
| `tinh_luc` | `DateTime?` | Tính lần cuối lúc nào |
| `datetime0`, `datetime2` | `DateTime` | Theo quy ước các bảng khác trong schema |

Khóa chính ghép `@@id([nam, ky_loai, ky_so])` — một công ty là một DB tenant nên không cần cột MST.

`phu_luc` tính lại mỗi lượt "Tính lại", riêng hai ô mô tả hàng hóa giữ nguyên nếu kế toán đã
sửa — mô tả là chữ người viết, không phải số máy tính.

Tách `ct` / `ct_may` / `ghi_de` để trả lời được câu kiểm toán hay hỏi nhất: *số này máy tính ra hay
người sửa, sửa vì sao*. Trạng thái `nhap` thì mở lại là tính lại từ hóa đơn (đồng bộ thêm hóa đơn là
số tự cập nhật, ô đã ghi đè giữ nguyên); `chot` thì đóng băng, muốn sửa phải mở khóa.

Bảng mới hoàn toàn nên `prisma db push` (xem `scripts/sync-tenants.ts`) không có rủi ro DROP cột như
các ghi chú `noi_dung_bin` / `xml_to_khai_bin` trong schema đang cảnh báo.

## 7. Engine tính

### 7.1. Kỳ tính thuế

`kySoThue.ts` quy đổi hai chiều: `{nam, kyLoai, kySo}` <-> `{tuNgay, denNgay}`. T7/2026 =
01/07/2026→31/07/2026; Q3/2026 = 01/07/2026→30/09/2026. Hóa đơn thuộc kỳ khi `tdlap` nằm trong
khoảng đó.

### 7.2. Điều kiện sẵn sàng của kỳ

`sanSangKy.ts` trả ba trạng thái, tất cả bằng truy vấn DB:

| Trạng thái | Điều kiện | Hành vi UI |
|---|---|---|
| `chua_dong_bo` | Khoảng kỳ không được phủ bởi dòng `sync_log` nào có `trang_thai="done"` và `dien_giai` bắt đầu bằng `"Đồng bộ"` | Banner vàng, nút "Lập tờ khai" / "Tính lại" mờ |
| `thieu_chi_tiet` | Đã đồng bộ nhưng còn `count(detail IS NULL) > 0` trong kỳ | Banner đỏ kèm số lượng, nút mờ |
| `san_sang` | Đã đồng bộ và không còn hóa đơn thiếu chi tiết | Banner xanh kèm số HĐ mua/bán, nút bật |

Cả hai trạng thái chưa sẵn sàng đều kèm nút **"Sang màn Hóa đơn điện tử để cập nhật"**, mang sẵn
khoảng ngày của kỳ. Module tờ khai không tự gọi cổng thuế.

### 7.3. Lọc hóa đơn theo trạng thái

Mã lấy từ `TRANG_THAI_HD_OPTIONS` (`hdđt_maxv/src/features/hddt/api/gdt.ts:50`):

| `tthai` | Nhãn cổng thuế | Xử lý | Vì sao |
|---|---|---|---|
| 1 | Hóa đơn mới | Tính | |
| 2 | Hóa đơn thay thế | Tính | Đây mới là số đúng |
| 3 | Hóa đơn điều chỉnh | **Cộng vào tổng**, đồng thời gom thành nhóm hiển thị riêng | Xem mục 11.1 — chưa xác nhận được dấu |
| 4 | Đã bị thay thế | **Loại** | Tính vào là kê trùng với tờ thay thế |
| 5 | Bị điều chỉnh | Tính | Tờ gốc vẫn hiệu lực, tờ điều chỉnh cộng phần chênh |
| 6 | Đã bị hủy | **Loại** | |

`ttxly` (5 = đã cấp mã, 6 = đã nhận không mã, 8 = máy tính tiền) **không loại trừ gì** — cả ba đều là
hóa đơn cơ quan thuế đã tiếp nhận. Mã 8 chỉ khác đường gọi API lúc đồng bộ, tới bước này như nhau.

### 7.4. Gộp theo thuế suất (bán ra) rồi rót vào chỉ tiêu

Đọc `detail.thttltsuat` — mảng GDT gộp sẵn tiền theo từng mức, dạng
`{ltsuat|tsuat: "10%", thtien: 5000000, tthue: 500000}` (cách đọc đã có ở
`hdđt_maxv/src/features/hddt/detailRow.ts:60`). Cộng dồn cả kỳ theo nhãn rồi rót vào chỉ tiêu qua
**một hằng số ánh xạ duy nhất** — thuế suất là thứ Nhà nước đổi theo nghị quyết, phải sửa được ở một
chỗ:

| Nhãn GDT | Giá trị vào | Thuế vào |
|---|---|---|
| `KCT` (không chịu thuế) | [26] | — |
| `0%` | [29] | — |
| `5%` | [30] | [31] |
| `8%` | [32] | [33] — số thuế THỰC TẾ, không tính lại bằng [32]×10% |
| `10%` | [32] | [33] |
| `KKKNT` (không kê khai, không nộp thuế) | [32a] | — |
| Nhãn lạ / rỗng | không cộng vào đâu | — |

Nhãn lạ không được đoán: dồn vào nhóm treo, hiện cảnh báo "N hóa đơn có mức thuế suất chưa nhận
diện" kèm bảng kê để kế toán xử lý tay.

Hóa đơn ngoại tệ (`dvtte` khác VND): nhân `tgia` trước khi cộng. Hóa đơn `dvtte` khác VND mà thiếu
`tgia` thì không quy đổi — xếp vào nhóm treo như trên.

### 7.5. Mua vào

[23] = tổng `tgtcthue`, [24] = tổng `tgtthue` của hóa đơn mua vào trong kỳ (sau khi lọc theo 7.3).
[25] (được khấu trừ kỳ này) **mặc định = [24]**.

Máy không biết hóa đơn nào không đủ điều kiện khấu trừ, cũng không biết tỷ lệ phân bổ cho hoạt động
không chịu thuế — kế toán sửa [25] và ghi lý do vào `ghi_de`. [23a]/[24a] (hàng nhập khẩu) luôn nhập
tay: số đó nằm ở tờ khai hải quan, không có trong hóa đơn GDT.

### 7.6. Công thức

Lấy đúng công thức in trên mẫu, đã có sẵn trong nhãn của `ToKhaiGtgt01Form.tsx`:

```
[27] = [29] + [30] + [32] + [32a]
[28] = [31] + [33]
[34] = [26] + [27]
[35] = [28]
[36] = [35] - [25]

X = [36] - [22] + [37] - [38] - [39a]
X >= 0  ->  [40a] = X,   [41] = 0
X <  0  ->  [40a] = 0,   [41] = |X|

[40] = [40a] - [40b]
[43] = [41] - [42]
```

Nhánh `X < 0 -> [41] = |X|` đã được **đối chiếu bằng dữ liệu thật**: comment trong `toKhaiXml.ts` ghi
nhận `ct41 = ct22 + ct25` đúng trên cả 5 hồ sơ 01/GTGT của MST 0106200129. Đó chính là hệ quả của
công thức trên khi kỳ không phát sinh thuế đầu ra ([35] = 0): X = −[25] − [22], nên |X| = [22] + [25].
Hai ô [40a] và [41] loại trừ nhau — hỏng chỗ này là sai hẳn nghĩa vụ thuế.

### 7.7. Ô máy tính và ô người nhập

- **Máy tính:** [23] [24] [25] [26] [27] [28] [29] [30] [31] [32] [32a] [33] [34] [35] [36] [40a]
  [40] [41] [43].
- **Người nhập:** [22] (tự nối từ kỳ trước, sửa được), [23a] [24a] (hàng nhập khẩu), [37] [38]
  (điều chỉnh kỳ trước), [39a] (nhận bàn giao), [40b] (bù trừ dự án đầu tư), [42] (đề nghị hoàn).

Mọi ô máy tính đều sửa tay được; sửa xong thì giá trị vào `ghi_de`, số gốc vẫn nằm ở `ct_may`, và
lượt "Tính lại" sau đó **không xóa** ô đã ghi đè.

### 7.8. Nguồn của [22]

Thứ tự: đọc `ct43` của bản `trang_thai="chot"` kỳ liền trước trong `tokhai_gtgt01`; không có thì để
trống cho kế toán nhập tay. `nguon_ct22` ghi lại đã lấy đường nào. Kỳ liền trước của T1 là T12 năm
trước; của Q1 là Q4 năm trước.

## 8. API

Prefix `/api/v1/to-khai`, guard `[fastify.authenticate, requireModule("tokhai")]` — cùng khuôn
`guard` của `gdt-dvc.route.ts`.

| Method | Path | Việc |
|---|---|---|
| GET | `/gtgt01/san-sang?nam&kyLoai&kySo` | Trạng thái kỳ theo mục 7.2 + đếm HĐ mua/bán/thiếu chi tiết |
| POST | `/gtgt01/tinh` | Tính từ hóa đơn, ghi bản nháp (giữ ô `ghi_de` sẵn có), trả bộ chỉ tiêu |
| GET | `/gtgt01/:nam/:kyLoai/:kySo` | Đọc bản đã lưu |
| PUT | `/gtgt01/:nam/:kyLoai/:kySo` | Lưu ô sửa tay + tính lại công thức phụ thuộc |
| POST | `/gtgt01/:nam/:kyLoai/:kySo/chot` | Đóng băng bản |
| POST | `/gtgt01/:nam/:kyLoai/:kySo/mo-khoa` | Mở lại để sửa |
| GET | `/gtgt01/:nam/:kyLoai/:kySo/bang-ke?chiTieu=ct32` | Hóa đơn cấu thành một chỉ tiêu |
| GET | `/gtgt01/danh-sach` | Các kỳ đã lập: kỳ, trạng thái, [40], [43] |

Không endpoint nào nhận `X-Gdt-Token`. `POST /gtgt01/tinh` từ chối (409) khi kỳ chưa `san_sang`, kèm
lý do máy đọc được để FE hiện đúng banner.

## 9. Màn hình `/to-khai`

1. **Chọn kỳ** — Tháng/Quý · số kỳ · năm. Đổi kỳ gọi `san-sang` ngay.
2. **Banner tình trạng kỳ** — ba trạng thái mục 7.2, kèm nút sang màn Hóa đơn điện tử mang sẵn khoảng
   ngày của kỳ.
3. **Form 01/GTGT** — layout dùng chung (mục 5.1). Ba kiểu ô phân biệt bằng thị giác: máy tính (nền
   xám, sửa được), người nhập (viền nổi), đã sửa tay (dấu chấm cam, hover hiện "Máy tính:
   12.345.678").
4. **Bảng kê** — bấm số ở một chỉ tiêu mở dialog liệt kê hóa đơn cấu thành, xuất Excel được. Đây là
   thứ khiến kế toán tin số: bấm vào là ra hóa đơn.
5. **Thanh hành động** — kỳ chưa có bản nào thì nút đầu là **"Lập tờ khai"**, đã có bản nháp thì đổi
   thành **"Tính lại"**; kèm Lưu nháp · Chốt · Xuất Excel. Bản `chot` khóa mọi ô, chỉ còn "Mở khóa".
6. **Danh sách kỳ đã lập** — mỗi dòng một kỳ với [40] phải nộp và [43] chuyển kỳ sau.

Thông báo dùng `react-toastify` theo quy ước sẵn có của `hdđt_maxv`.

## 10. Kiểm thử

Trọng tâm dồn vào `tinhGtgt01.ts` và `gomHoaDonGtgt.ts` — chỗ ra con số đem nộp thuế. Cả hai là hàm
thuần, test bằng `npx tsx --test` đúng lối `src/__tests__/toKhaiXml.test.ts`, **không cần Postgres**
nên không nhập hội với 5 test integration đang đỏ sẵn trong repo (`adminOwner.test.ts`).

Ca bắt buộc có:

- Gộp đúng theo từng nhãn thuế suất, gồm cả nhãn lạ rơi vào nhóm treo.
- 8% vào [32], còn [33] theo công thức HTKK `làm tròn([32]×10%) − phần được giảm` (Mục 11.5).
- Loại `tthai` 4 và 6; giữ 1, 2, 3, 5.
- `X >= 0` thì [41] = 0; `X < 0` thì [40a] = 0 và [41] = |X| — hai ô loại trừ nhau.
- `[27] = [29]+[30]+[32]+[32a]`, `[34] = [26]+[27]`, `[36] = [35]-[25]`, `[43] = [41]-[42]`.
- Quy đổi ngoại tệ theo `tgia`; thiếu `tgia` thì vào nhóm treo, không quy đổi bừa.
- `kySoThue`: T12/2026 và Q4/2026 ra đúng khoảng ngày; kỳ liền trước của T1 là T12 năm trước.
- Lượt "Tính lại" không xóa ô đã `ghi_de`.
- [22] lấy từ `ct43` kỳ trước đã chốt; kỳ trước chưa chốt thì để trống + `nguon_ct22="nhap_tay"`.

**Kiểm bằng tay trước khi giao:** chọn một kỳ mà công ty đã nộp tờ khai thật và tờ khai đó đã đồng bộ
trong `dvc_ho_so`, so từng chỉ tiêu máy tính ra với số trong XML đã nộp (bóc bằng
`layChiTieuToKhaiGtgt`). Đây là phép thử tốt nhất có được, và dữ liệu đã nằm sẵn trong máy.

## 11. Việc CHƯA kiểm chứng — làm đầu tiên khi triển khai

### 11.1. Dấu của hóa đơn điều chỉnh (`tthai=3`)

Chưa có hóa đơn điều chỉnh giảm thật để xác nhận GDT trả `thtien`/`tthue` là số dương hay số âm.
Đoán sai dấu làm số sai theo hai chiều mà nhìn bảng không ra.

Cách làm cho tới khi xác nhận được: hóa đơn `tthai=3` **vẫn cộng vào tổng** (bỏ ra ngoài thì tờ khai
thiếu số một cách âm thầm — kiểu hỏng khó thấy hơn hẳn), nhưng gom thành **nhóm hiển thị riêng**:
form hiện cảnh báo "Kỳ này có N hóa đơn điều chỉnh, tổng X — kiểm tra dấu trước khi chốt", và bảng
kê tách nhóm đó ra đầu danh sách. Khi có hóa đơn điều chỉnh giảm thật để đối chiếu, sửa đúng một chỗ
trong `gomHoaDonGtgt.ts` và ghi kết luận vào chính mục này.

### 11.2. [23]/[24] có gồm hóa đơn mua vào không chịu thuế hay không — ĐÃ TRẢ LỜI: CÓ

**Đã xác nhận 2026-08-31**, đối chiếu tờ khai thật Q2/2026 của MST 0106861880 (Phát Thịnh) kèm phụ
lục "Giảm thuế GTGT theo NQ 204/2025/QH15":

| | Tờ khai chính | Phụ lục (riêng nhóm 8%) |
|---|---|---|
| Giá trị mua vào | [23] = 323.070.463 | 63.748.043 |
| Thuế mua vào | [24] = 5.102.437 | 5.102.437 |

[24] khớp đúng phần thuế của nhóm 8%, còn [23] gấp 5 lần giá trị nhóm đó — phần chênh
259.322.420 là hàng mua vào KHÔNG phát sinh thuế đầu vào. Vậy [23] gồm cả hóa đơn không chịu thuế,
đúng như `gomMuaVao` đang làm (cộng mọi hóa đơn trong kỳ). **Không phải sửa gì.**

Cùng lượt đối chiếu cũng xác nhận ánh xạ 8%: phụ lục ghi hàng "Cước vận chuyển" thuế suất theo quy
định **10%**, sau giảm **8%**; tờ khai chính kê vào [32] (dòng "chịu thuế suất 10%") với [33] là số
thuế THỰC TẾ 8% — đúng bảng `O_THEO_NHAN` trong `gomHoaDonGtgt.ts`.

### 11.3. Nhãn thuế suất GDT còn mức nào ngoài bảng 7.4

`detailRow.ts` đã gặp `KCT`, `KKKNT`, `\` và các mức số. Bảng ánh xạ xử lý được nhãn lạ (vào nhóm
treo) nên không vỡ, nhưng gặp nhãn mới thì bổ sung vào bảng thay vì để kế toán gõ tay mãi.

### 11.4. Kết quả đối chiếu tờ khai thật — ĐÃ CHẠY 2026-08-31

Đối chiếu bản tự lập với tờ khai 01/GTGT **đã nộp** của MST 0106861880 (Phát Thịnh), kỳ Q2/2026
(file `01_GTGT_TT80_2026.xls` người dùng cung cấp): **20/27 chỉ tiêu khớp tuyệt đối**.

Bảy chỉ tiêu lệch đến từ đúng hai nguyên nhân, không cái nào là lỗi tính toán:

**a) Làm tròn 1 đồng ở [33], lan xuống 5 ô — ĐÃ SỬA 2026-09-02, xem Mục 11.5.** Ta cộng tiền thuế
THỰC ghi trên ba hóa đơn (10.163.287 + 10.913.962 + 10.222.744 = 31.299.993), trong khi bản đã nộp
ghi 31.299.994. Sai số chảy theo công thức sang [28] → [35] → [36] → [40a] → [40].

Kết luận ban đầu ("giữ nguyên cách cộng thuế thực, muốn khớp thì sửa tay") **đã bị bác bỏ** khi
tìm ra công thức thật của HTKK — xem Mục 11.5. Sau khi sửa, kỳ này khớp **21/22** ô có số.

**b) [23] thiếu 20.000.** Kế toán khai [23] nhiều hơn tổng hóa đơn 20.000 đồng mà KHÔNG kèm thuế
(nên [24] vẫn khớp). Khoản này không có trong dữ liệu hóa đơn điện tử — máy không suy được, và
không nên đoán. Sửa tay khi cần.

**Những chỗ khó nhất đều đúng:** loại hóa đơn `tthai=4` bị thay thế (117.751.551 — tính vào là kê
khống), gộp 8% vào dòng [32]/[33], `[27]=[29]+[30]+[32]+[32a]`, `[40a]` sau khi trừ [22].

**Cột "Kê khai/không kê khai" đã được kiểm chứng bằng ca thật:** hóa đơn phí ngân hàng MB
(K26TMM 781145, thuế 72.000) mà kế toán không kê — đánh dấu "Không kê khai" rồi tính lại thì [24]
từ 5.174.437 về đúng 5.102.437.

**Về 11.1 (dấu hóa đơn điều chỉnh): VẪN CHƯA trả lời được.** Kỳ đối chiếu này không có hóa đơn điều
chỉnh giảm nào (chỉ một hóa đơn `tthai=3` giá trị 0 bên mua vào). Giữ nguyên cách làm ở 11.1 cho
tới khi gặp ca thật.

### 11.5. Công thức [31]/[33] của HTKK — ĐÃ SỬA 2026-09-02

Chênh lệch 1 đồng ở Mục 11.4(a) **không phải chuyện làm tròn vặt**: nó chảy qua [43] sang [22] của
kỳ sau, nên mỗi kỳ lại lệch thêm. Truy ra được nguyên nhân thật, và nó sửa được.

File tờ khai tải từ cơ quan thuế mang sẵn bộ kiểm tra của HTKK ở sheet `Header`, trong đó có dòng:

> Chỉ tiêu [33] = [32] × 10% − (Tổng cột 6 trên phụ lục với các dòng thuế suất 10%)

và dòng tương ứng cho [31] với 5%. Sheet `Tờ khai` còn lưu luôn số trung gian **39.124.992** cạnh
dòng [32] — chính là `làm tròn(391.249.917 × 10%)`. Trừ đi 7.824.998 của phụ lục ra đúng 31.299.994.

Nên **[33] KHÔNG phải tổng thuế trên hóa đơn**, mà là:

```
[31] = làm tròn([30] × 5%)  − thuế được giảm của nhóm thuế suất quy định 5%
[33] = làm tròn([32] × 10%) − thuế được giảm của nhóm thuế suất quy định 10%
```

Lưu ý `[32]` gộp cả hàng 10% thật lẫn hàng 8% được giảm, nên phép trừ mới ra đúng: phần 10% đóng
đủ 10%, phần 8% được trừ lại 2%.

**Cột (6) của phụ lục làm tròn THƯỜNG.** Chỗ này từng bị kết luận sai, đáng ghi lại vì sai lầm
có ích: ban đầu chọn *cắt phần lẻ* dựa trên suy luận NGƯỢC ở Phát Thịnh — không có tờ khai Q1 của
họ, nên `[33]` Q1 được suy từ `[22] = 3.366.060` mà bản Q2 đã nộp khai.

Hai phụ lục THẬT của MST 0111142786 (XNK Thành Công) bác điều đó bằng chứng cứ trực tiếp:

| Kỳ | Giá trị hàng 8% | × 2% | Tròn thường | Cắt phần lẻ | Phụ lục ĐÃ NỘP khai |
|---|---|---|---|---|---|
| Q1/2026 | 4.631.817.848 | 92.636.356,**96** | 92.636.3**57** | 92.636.3**56** | **92.636.357** |
| Q2/2026 | 7.093.463.577 | 141.869.271,**54** | 141.869.2**72** | 141.869.2**71** | **141.869.272** |

Cả hai kỳ đều phân định được, và cả hai đều khớp tròn thường. Nên `phuLuc204.ts` dùng
`lamTronDong` (tròn thường, nửa ra xa 0) — cùng một hàm với bộ chỉ tiêu, không còn quy tắc thứ hai.

**Hệ quả cần biết:** kỳ Q1/2026 của Phát Thịnh, engine ra `[33] = 20.151.730` và `[43] = 3.366.061`,
trong khi bản Q2 đã nộp khai `[22] = 3.366.060`. Lệch một đồng đó KHÔNG phải lỗi công thức — xem
mục dưới.

### 11.5b. `[33]` trên tờ khai thật KHÔNG phải lúc nào cũng theo công thức

Đối chiếu ba tờ khai đã nộp cho thấy kế toán khai `[33]` theo số của họ, và HTKK **chỉ cảnh báo**
chứ không chặn (bộ kiểm ghi mức `N` cho quy tắc này):

| Tờ khai | [33] khai | Công thức HTKK | Lệch |
|---|---|---|---|
| XNK Thành Công Q1/2026 | 408.646.091 | 408.646.089 | +2 |
| XNK Thành Công Q2/2026 | 641.712.199 | 641.712.213 | −14 |
| Phát Thịnh Q1/2026 (suy từ [22] kỳ sau) | 20.151.731 | 20.151.730 | +1 |
| Phát Thịnh Q2/2026 | 31.299.994 | 31.299.994 | 0 |

Chính file Excel của XNK Thành Công còn giữ ô phụ ghi số HTKK tự tính (408.646.089 / 641.712.213)
NGAY CẠNH ô khai — bằng chứng là HTKK có tính, có so, và vẫn cho nộp số khác.

Phần mềm giữ công thức HTKK làm số máy: đó là chuẩn của cơ quan thuế, và là số duy nhất suy được
từ hóa đơn. Kế toán muốn khai khác thì ghi đè `[33]` (ô này nằm trong danh sách sửa được — Mục
11.6), lượt soát sẽ không kêu vì nó so `ctMay` chứ không so `ct` (Mục 11.8).

**Kết quả sau khi sửa:** Q2/2026 khớp **21/22** ô (chỉ còn [23] lệch 20.000 — xem Mục 11.4b);
phụ lục mục II và III khớp tuyệt đối; Q1/2026 giữ nguyên `[43] = 3.366.060` nên mắt xích sang [22]
của Q2 không bị động.

Chốt bằng test trong `tinhGtgt01.test.ts` và `phuLuc204.test.ts` mang đúng số của hai kỳ thật —
đổi cách làm tròn là test đỏ ngay.

### 11.6. Ghi đè phải CHẢY qua công thức — ĐÃ SỬA 2026-09-02

Cách cũ gán ô ghi đè lên kết quả **sau khi** công thức đã chạy (`ct[khoa] = item.gia`). Hậu quả:
kế toán sửa [26] thì [34] = [26] + [27] vẫn giữ số cũ — tờ khai tự mâu thuẫn với chính nó, mà
không có gì báo.

Nay ô ghi đè là ĐẦU VÀO của công thức, nên giá trị đã sửa chảy tiếp xuống mọi ô phụ thuộc. Kèm
theo đó, tập ô cho phép ghi đè bị thu hẹp còn đúng những ô có nghĩa:

| Loại | Ô | Ghi đè |
|---|---|---|
| Máy không suy được | [22] [23a] [24a] [25] [37] [38] [39a] [40b] [42] | có, mặc định 0 |
| Máy suy từ hóa đơn | [23] [24] [26] [29] [30] [31] [32] [32a] [33] | có, ghi đè thắng |
| Công thức thuần | [27] [28] [34] [35] [36] [40] [40a] [41] [43] | **không** |

Ô công thức thuần chỉ là tổng của các ô trên; cho sửa tay chúng là mở đường cho tờ khai mâu thuẫn.
Muốn đổi thì sửa ô nguồn. `CT_HOP_LE` của `locGhiDeHopLe` nay suy thẳng từ `CT_NHAP_TAY` để không
có bản sao thứ hai trôi lệch.

[33] vẫn cho ghi đè vì HTKK chỉ **cảnh báo** khi [33] khác [32] × 10% chứ không chặn — kế toán có
quyền chốt tay.

### 11.7. [22] phải nối được khi công ty đổi kỳ khai — ĐÃ SỬA 2026-09-02

Công ty được đổi kỳ khai giữa chừng: khai quý, doanh thu vượt ngưỡng thì chuyển sang khai tháng
(và ngược lại). Đổi luôn rơi vào đầu năm.

`kyLienTruoc` giữ nguyên loại kỳ, nên công ty khai quý hết Q4/2025 rồi sang T1/2026 sẽ tra
`{2025, thang, 12}` — không có row — và **[22] về 0**. Toàn bộ số thuế còn được khấu trừ chuyển
sang biến mất, công ty nộp phần thuế mình không nợ. Câu cảnh báo cũ còn nói sai hẳn tình huống
("kỳ trước chưa lập tờ khai trong phần mềm", trong khi Q4/2025 có trong phần mềm).

Nay `layCt22KyTruoc` đi hai bước: tìm kỳ liền trước **cùng loại** trước (giữ nguyên hành vi cũ, một
truy vấn khóa chính); không có thì tra bản gần nhất **kết thúc trước khi kỳ này bắt đầu**, bất kể
loại kỳ.

So sánh qua hai mốc quy về "số thứ tự tháng" (`kySoThue.ts`):

```
thangBatDau(Q1/2026)  = 2026×12 + 1  = 24313
thangKetThuc(T1/2026) = 2026×12 + 1  = 24313
thangKetThuc(Q4/2025) = 2025×12 + 12 = 24312
```

Điều kiện nối là `thangKetThuc(trước) < thangBatDau(nay)` — dấu `<` chứ không `<=`, và đó là chỗ
duy nhất dễ sai: T1/2026 kết thúc đúng tháng Q1/2026 bắt đầu, nhưng nó nằm **trong** Q1 chứ không
đứng trước, nên không được chọn làm kỳ nguồn.

Kỳ nguồn trả về ở `BanToKhai.kyNguonCt22` để màn hình gọi đúng tên ("[22] lấy từ [43] của Q4/2025"
thay vì "kỳ trước"), và khi kỳ nguồn khác loại kỳ hiện tại thì sinh thêm một câu cảnh báo — đổi kỳ
khai là lúc số chuyển sang đáng được người nhìn lại.

### 11.8. Soát công thức với bảng kê — THÊM 2026-09-02

Đổi [33] sang công thức HTKK (Mục 11.5) có một cái giá: tổng thuế cộng thực từ hóa đơn không còn
được ai nhìn. Mà đó lại là con số tốt nhất để bắt lỗi bảng kê — hóa đơn ghi nhầm mức thuế suất,
nhãn thuế suất lệch, tờ thiếu chi tiết. Trước khi sửa thì hai số đối chiếu ngầm với nhau (chúng
phải bằng nhau); sau khi sửa thì không.

Nên `gomBanRa` vẫn cộng thuế thực vào `TongBanRa.ct31`/`ct33`, và lượt tính so hai bên:

```
lechBangKe.ct33 = ctMay.ct33 (công thức) − tongBanRa.ct33 (bảng kê)
```

**Ngưỡng nới theo số hóa đơn**, không phải hằng số. Thuế của TỪNG hóa đơn được làm tròn riêng còn
công thức làm tròn một lần trên tổng, nên mỗi tờ góp tối đa khoảng 1 đồng sai số:

```
ngưỡng = số hóa đơn bán ra + 1
```

Q2/2026 thật: lệch 1 đồng với 3 hóa đơn, ngưỡng 4 — im lặng, đúng. Cùng số lệch đó mà kỳ chỉ có 2
hóa đơn thì đã đáng ngờ. Ngược lại kỳ 100 hóa đơn lệch 100 đồng vẫn là làm tròn bình thường.

So `ctMay` (số máy thuần) chứ không `ct`: ô kế toán ghi đè lệch khỏi hóa đơn là **cố ý**, báo lên
chỉ tổ nhiễu.

Toàn bộ phần soát nằm ở `soatToKhai.ts` — hàm THUẦN, không DB. Ngưỡng là chỗ dễ sai nhất trong cả
module nên nó phải test được không cần Postgres; `soatToKhai.test.ts` có 11 ca, gồm ca số thật của
Q2/2026 để chốt rằng kỳ bình thường KHÔNG sinh cảnh báo giả.

Ba nhóm cảnh báo cùng sống ở đó: lệch bảng kê (mục này), phụ lục không ăn khớp [32] đã sửa tay
(Mục 11.6), và đổi kỳ khai tháng ↔ quý (Mục 11.7).

### 11.9. Ngoại tệ làm tròn về đồng, và chia lô truy vấn — THÊM 2026-09-02

**Ngoại tệ.** `gomBanRa`/`gomMuaVao` nhân tiền với tỷ giá rồi cộng thẳng, nên hóa đơn ngoại tệ để
lại phần lẻ trong [32], [23], [24]. Hai hệ quả:

- mọi ô trên tờ khai phải là số nguyên đồng;
- quy tắc kiểm của HTKK là `[33] = [32] × 10% − phụ lục`, nên [32] lẻ đồng làm phép kiểm đó không
  bao giờ khớp. Phần lẻ còn khiến `catPhanLe` bên phụ lục chặt oan: `999.999,99 × 2% = 19.999,9998`
  bị cắt thành 19.999 thay vì 20.000.

Nay quy đổi đi qua `veDong(tien, heSo)` — làm tròn về đồng ngay tại **từng hóa đơn**, không phải
trên tổng: mỗi hóa đơn là một chứng từ, số VND của nó phải tự đứng được khi đối chiếu. Hóa đơn VND
(hệ số 1) không đổi gì vì số đã nguyên sẵn, nên hai kỳ đối chứng giữ nguyên kết quả.

**Chia lô.** `docHoaDonCuaKy` tra hóa đơn bằng `id: { in: [...] }`. Postgres extended protocol chỉ
nhận 65.535 tham số một lượt và mỗi id là một tham số, nên kỳ quý của công ty lớn sẽ ném lỗi driver
khó lần ra. Nay cắt lô 5.000 (`chiaLo`), đọc tuần tự — tuần tự là chủ ý: `detail` là JSON nặng, chạy
song song nhiều lô chỉ đổi lỗi tham số lấy áp lực bộ nhớ.

Cỡ thật hiện tại: 174 hóa đơn/quý, còn rất xa ngưỡng — đây là vá trước khi đau.

## 11bis. Phụ lục "Giảm thuế GTGT theo Nghị quyết 204/2025/QH15"

Phát sinh sau khi đọc file tờ khai thật người dùng gửi (2026-08-31) — không có trong thiết kế ban
đầu, nhưng **bắt buộc nộp kèm** tờ khai 01/GTGT khi kỳ có hàng được giảm thuế từ 10% xuống 8%.

Lý do phải có: tờ khai chính gộp hàng 8% chung dòng [32]/[33] với hàng 10% (xem mục 7.4), nên phần
được giảm KHÔNG nhìn thấy ở đâu trong tờ khai chính. Phụ lục là chỗ khai chi tiết phần đó.

### 11bis.1. Ba mục và cách lấy số

| Mục | Nội dung | Nguồn |
|---|---|---|
| I | Hàng mua vào có thuế đầu vào được khấu trừ | **MỌI nhóm có thuế** (xem 11bis.2) |
| II | Hàng bán ra được giảm | **CHỈ nhóm 8%**, kèm thuế suất 10% → 8% |
| III | Chênh lệch [09] = [08] − [06] | thuế được giảm ở II trừ thuế ở I |

Hai chỗ dễ lẫn, mỗi chỗ có một ca test canh:

- **Thuế được giảm tính theo CÔNG THỨC của mẫu** (`làm tròn xuống(giá trị × 2%)` — xem Mục 11.5
  về việc vì sao tròn xuống), không lấy hiệu của thuế thực tế
  trên hóa đơn. Mẫu in ghi rõ `(6)=(3)×[(4)-(5)]` và cơ quan thuế đối chiếu đúng công thức đó.
  Số này còn đi tiếp vào [33] của tờ khai chính (Mục 11.5), nên sai ở đây là sai cả hai nơi.
- **Mục II chỉ lấy 8%.** Hàng 10% không được giảm nên không được lọt vào, dù mục I có gộp nó.

### 11bis.2. Vì sao mục I gộp cả nhóm 10%, dù tiêu đề mẫu chỉ nói 8%

Tiêu đề mục I trên mẫu là "hàng hóa, dịch vụ mua vào **được áp dụng thuế suất 8%**", nhưng bản kế
toán đã nộp ghi thuế `5.102.437` = `5.081.437` (nhóm 8%) + `21.000` (nhóm 10%). Tức thực tế mục này
được khai là *toàn bộ thuế đầu vào được khấu trừ trong kỳ*.

Lấy đúng nhóm 8% thì cột thuế lệch `21.000`, mà cột thuế chính là số đi vào mục III — số cơ quan
thuế đối chiếu. Nên `gopMuaVaoCoThue` gộp mọi nhóm CÓ thuế; nhóm không thuế (KCT/KKKNT) bị loại vì
không có gì để khấu trừ.

### 11bis.3. Kết quả đối chiếu (Q2/2026, MST 0106861880)

| | Máy | Bản đã nộp |
|---|---|---|
| I. giá trị mua vào | 63.728.043 | 63.748.043 (lệch 20.000) |
| I. thuế mua vào | 5.102.437 | **khớp** |
| II. giá trị bán ra | 391.249.917 | **khớp** |
| II. thuế được giảm | 7.824.998 | **khớp** |
| III. chênh lệch | 2.722.561 | **khớp** |

20.000 còn lại là khoản kế toán cộng tay ngoài hóa đơn điện tử — cùng khoản làm [23] lệch 20.000
(mục 11.4b). Không hóa đơn nào trong kỳ mang giá trị đó nên máy không suy được.

### 11bis.4. Mô tả hàng hóa

Máy gom tên hàng từ `detail.hdhhdvu` của các dòng đúng nhãn, khử trùng, giữ tối đa 12 tên rồi thêm
"...". Tên thật thường rất dài (`"Cước đường bộ xe 29C50134V đi qua trạm Bắc Thăng Long-Nội Bài…"`)
nên **hai ô mô tả sửa tay được**, và lượt "Tính lại" KHÔNG xóa phần đã sửa — kế toán biết gọi gọn
thế nào cho cơ quan thuế dễ đọc. Số thì không sửa được: muốn đổi thì sửa bảng kê rồi tính lại.

### 11bis.5. Lưu trữ và điều kiện nộp

Lưu ở cột `tokhai_gtgt01.phu_luc` (Json), tính lại mỗi lượt "Tính lại". `phuLuc = null` khi kỳ
**không có hàng 8% BÁN RA** — không có gì được giảm thì không phải nộp, kể cả khi mua vào vẫn có
thuế đầu vào.

Xuất Excel: sheet thứ hai tên `PL 204-2025`, tách khỏi sheet tờ khai chính vì đây là hai biểu mẫu
khác nhau, cơ quan thuế nhận hai tờ.

## 12. Ngoài phạm vi — lát sau

1. **Sinh XML nộp qua eTax** — cấu trúc file phải khớp từng thẻ, sai một thẻ là cổng từ chối. Có sẵn
   hàng chục XML thật trong `dvc_ho_so` để đối chiếu ngược, làm được nhưng là một lát riêng.
2. **Hóa đơn mua vào lập ở kỳ trước, kê ở kỳ này** — cần theo dõi hóa đơn nào đã kê ở kỳ nào để không
   kê hai lần.
3. **Nhiều bản cho một kỳ** (chính thức + các lần khai bổ sung, kèm số chênh so với bản trước).
4. **Các mẫu tờ khai khác** — 05/KK-TNCN (nguồn là bảng lương HRM), 03/TNDN (nguồn là sổ kế toán).
