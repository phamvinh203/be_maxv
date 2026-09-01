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
| 3 | Kỳ thiếu dữ liệu thì **chặn**, kèm nút sang màn Hóa đơn điện tử | Không sinh ra con số nửa vời mà người đọc tưởng là đủ |
| 4 | Lưu **1 dòng/kỳ**, vòng đời `nhap` → `chot` | Đủ cho nhu cầu thật; nhiều bản/kỳ (khai bổ sung) để sau |
| 5 | [22] lấy [43] của kỳ trước **đã chốt trong phần mềm**, thiếu thì nhập tay | Không buộc công ty phải bật thêm module `dvc` |
| 6 | Hàng **8%** kê vào [32]/[33] như hàng 10%, số thuế ghi theo thực tế 8% | Mẫu 01/GTGT không có dòng 8% riêng; [33] không bị ràng buộc bằng [32]×10% |
| 7 | Module thứ 5 trong gói đăng ký, khóa `tokhai`, route `/to-khai` | Bán kèm gói như `dvc`/`hrm` |

## 4. Module `tokhai` trong gói đăng ký

Quyền module nằm trong `SubscriptionPlan.features` (kiểu `Json`) nên **thêm module không cần
migration DB sys**. Sáu chỗ phải sửa:

| Chỗ | Việc | Tình trạng |
|---|---|---|
| `be_maxv/src/constants/modules.ts` | Thêm `'tokhai'` vào `MODULE_KEYS` — validator gói + kiểu dữ liệu BE tự suy theo | chưa làm |
| `maxv/src/features/owners/modules.ts` | Thêm `'tokhai'` + `MODULE_META` (nhãn "Tờ khai") — bảng tài khoản và form gói bên admin tự hiện ô tick | chưa làm |
| `hdđt_maxv/src/features/auth/types/index.ts` | Thêm `"tokhai"` vào `MODULE_KEYS` (ba app không dùng chung package — đây là chỗ phải nhớ đồng bộ) | chưa làm |
| `hdđt_maxv/src/components/AppHeader.tsx` | Nút "Tờ khai" trước nút "Dịch vụ công", bọc `{modules.tokhai && …}` | **đã làm** |
| `hdđt_maxv/src/routes/AppRouter.tsx` | Route `/to-khai` bọc `ProtectedRoute` + `ModuleRoute module="tokhai"` | chưa làm |
| `be_maxv/src/routes/index.route.ts` | `app.register(toKhaiRoutes, { prefix: '/api/v1/to-khai' })` | chưa làm |

Nút trong `AppHeader` đã có nhưng `MODULE_KEYS` phía FE **chưa có khóa `tokhai`**, nên `modules.tokhai`
hiện là lỗi biên dịch. Thêm khóa vào ba file `MODULE_KEYS` là việc đầu tiên của lát triển khai.

Khóa `tokhai` sẽ được ghi vào `features` của các gói đã bán; đổi tên sau này phải sửa dữ liệu, nên
chốt tên ngay từ đầu.

## 5. Kiến trúc và cấu trúc file

Module chỉ đọc `vct50view` / `vct60view` / `sync_log` / `tokhai_gtgt01`. **Không** endpoint nào chạm
cổng thuế — đây là ràng buộc kiểm chứng được: không file nào trong module được import `gdt-client`
hay đọc header `X-Gdt-Token`.

Đặt folder **ngang hàng `dich_vu_cong`**, không nằm trong `hddt`: đây là module bán theo gói riêng,
có route riêng và prefix API riêng, giống hệt cách `dich_vu_cong` tách khỏi `hddt`.

```
be_maxv/src/
  services/client/to_khai/
    kySoThue.ts               — quy đổi kỳ (T7/2026, Q3/2026) <-> khoảng ngày
    sanSangKy.ts              — kỳ đã đồng bộ chưa, còn bao nhiêu HĐ thiếu detail
    gomHoaDonGtgt.ts          — lọc theo trạng thái + gộp theo thuế suất
    tinhGtgt01.ts             — hàm THUẦN: vào là số đã gộp + ô nhập tay, ra là bộ chỉ tiêu
    toKhaiGtgt01.service.ts   — đọc/ghi nháp, chốt, mở khóa, bảng kê
  controllers/client/to_khai/toKhaiGtgt01.controller.ts
  routes/to_khai/toKhaiGtgt01.route.ts

hdđt_maxv/src/
  pages/to_khai/ToKhai.tsx                      — đã tạo (hiện là khung rỗng)
  features/to_khai/
    api/toKhai.ts + api/toKhaiQueries.ts        — TanStack Query, theo lối invoiceQueries.ts
    components/ChonKyPanel.tsx
    components/TrangThaiKyBanner.tsx
    components/ToKhaiGtgt01Editor.tsx
    components/BangKeHoaDonDialog.tsx
    xuatToKhaiExcel.ts
```

Năm folder `lap_to_khai/` rỗng đang nằm trong `be_maxv/src/{controllers/client/hddt,routes/hddt,
services/client/hddt}/` và `hdđt_maxv/src/{features/hddt,components}/` là dấu vết của lần chuẩn bị
trước — xóa khi bắt đầu triển khai để khỏi có hai chỗ cùng mang tên một chức năng.

`tinhGtgt01.ts` không đụng DB, không đụng HTTP: mọi con số đem đi nộp thuế đều đi qua một hàm thuần
test được. Đó là lý do tách `gomHoaDonGtgt` (đọc DB, gộp) khỏi `tinhGtgt01` (thuần, tính).

### 5.1. Layout mẫu in dùng chung cho hai màn

`ToKhaiGtgt01Form.tsx` bên `dich_vu_cong` đang giữ mảng `HANG` — 30 dòng chỉ tiêu kèm nhãn, công
thức in trên mẫu, mức thụt lề. Tách mảng đó cùng `OHangTien` sang
`hdđt_maxv/src/features/_shared/to_khai/gtgt01Layout.tsx`, rồi hai màn dùng chung:

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
| `nguon_ct22` | `VarChar(16)` | `ky_truoc` \| `nhap_tay` — hiện rõ số này ở đâu ra |
| `so_hd_ban`, `so_hd_mua` | `Int` | Ảnh chụp độ phủ dữ liệu lúc tính |
| `hd_thieu_detail` | `Int` | Số hóa đơn thiếu chi tiết lúc tính (bản hợp lệ phải là 0) |
| `tinh_luc` | `DateTime?` | Tính lần cuối lúc nào |
| `datetime0`, `datetime2` | `DateTime` | Theo quy ước các bảng khác trong schema |

Khóa chính ghép `@@id([nam, ky_loai, ky_so])` — một công ty là một DB tenant nên không cần cột MST.

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
- 8% vào [32]/[33] với số thuế thực tế (kiểm [33] ≠ [32]×10%).
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

## 12. Ngoài phạm vi — lát sau

1. **Sinh XML nộp qua eTax** — cấu trúc file phải khớp từng thẻ, sai một thẻ là cổng từ chối. Có sẵn
   hàng chục XML thật trong `dvc_ho_so` để đối chiếu ngược, làm được nhưng là một lát riêng.
2. **Hóa đơn mua vào lập ở kỳ trước, kê ở kỳ này** — cần theo dõi hóa đơn nào đã kê ở kỳ nào để không
   kê hai lần.
3. **Nhiều bản cho một kỳ** (chính thức + các lần khai bổ sung, kèm số chênh so với bản trước).
4. **Các mẫu tờ khai khác** — 05/KK-TNCN (nguồn là bảng lương HRM), 03/TNDN (nguồn là sổ kế toán).
