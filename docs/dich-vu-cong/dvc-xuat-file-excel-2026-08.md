# Xuất file Excel đối soát + tải XML hàng loạt (Dịch vụ công) — 08/2026

> Tài liệu mô tả tính năng "Xuất file" của `XuatFileDvcDialog` (module **Dịch vụ công**, proxy tới
> cổng `dichvucong.gdt.gov.vn`) — đang nằm trên nhánh `dev_fe` (chưa commit). Viết để người review
> hiểu **vì sao** từng phần tồn tại, không chỉ *nó làm gì*. Xem thêm `docs/dvc-thay-doi-2026-08.md`
> cho các thay đổi khác của cùng module trong tháng.

**Phạm vi:** 8 file sửa + 6 file mới.

---

## 1. Yêu cầu

Nút "Xuất file" trong `XuatFileDvcDialog` trước đây chỉ là stub:

```ts
const xuatFile = () => {
  toast.info("Xuất file đối soát Dịch vụ công đang được phát triển.");
};
```

Chọn thư mục chạy thật nhưng bấm "Xuất file" không ra gì. Yêu cầu: bấm một lần ra **5 file Excel đối
soát** (một mẫu tờ khai một file) **và** toàn bộ **XML gốc** của mọi hồ sơ trong khoảng ngày, tất cả
ghi thẳng vào thư mục người dùng đã chọn — không phải bấm "Tải file" từng dòng.

---

## 2. Nguồn dữ liệu: 6 endpoint mới, đọc DB đã đồng bộ

Sáu endpoint BE mới (`GET /dvc/ho-so/xuat-{gtgt01,qtt05,tncn05,tndn03,khac,xml}`) đều theo đúng quy
ước của `traCuuHoSo` đã có: đọc thẳng `dvc_ho_so` trong DB tenant, **không cần `key` phiên cổng** —
khác `taiFileHoSo`/`chiTietToKhai` vốn gọi cổng thật khi cache thiếu. Hồ sơ chưa từng lưu XML thì các
cột nguồn-XML để TRỐNG thay vì chặn cả dòng; các cột đã có sẵn trên bảng tra cứu (kỳ/lần nộp/trạng
thái) vẫn xuất được dù chưa có XML.

Bốn trong sáu endpoint (`gtgt01`/`qtt05`/`tncn05`/`tndn03`) nhận diện mẫu qua cột `to_khai` (cùng
cách `layChiTietToKhai` dò `maMauHoSo`) rồi bóc chỉ tiêu qua `toKhaiXml.ts`. `xuat-khac` là hồ sơ
**không khớp mẫu nào** trong bốn cái trên (loại trừ qua danh sách chuỗi `CHUOI_DA_CO_FILE_RIENG`) —
không đọc/bóc XML, chỉ liệt kê đúng cột sẵn có trên bảng tra cứu. `xuat-xml` phủ **mọi** hồ sơ không
lọc mẫu, phục vụ tải nguyên văn XML hàng loạt.

Bốn hàm `layDsToKhaiXXXDaLuu` (gtgt01/qtt05/tncn05/tndn03) dùng chung một hàm
`layHoSoTheoMauTrongKhoang()` cho phần "tra khoảng ngày + `select` 9 cột" — chỉ khác `where` lọc mẫu
và cách map dòng kết quả. Vẫn **mỗi mẫu một lượt gọi DB riêng**, không gộp thành một `findMany` phục
vụ cả 4 mẫu: `take` là `MAX_KET_QUA_TIM_KIEM` MỚI-NHẤT-CỦA-TỪNG-MẪU, gộp chung sẽ để mẫu ít hồ sơ hơn
bị mẫu nhiều hồ sơ hơn chiếm chỗ.

---

## 3. Mở rộng nhận diện mẫu tờ khai: 05/QTT-TNCN + 03/TNDN

Trước lượt này `toKhaiXml.ts` mới nhận diện được `gtgt01`/`tncn05`; nhánh `ChiTietToKhai` thêm hai
mẫu `qtt05`/`tndn03`. Mã mẫu `<maTKhai>` xác nhận được cho 03/TNDN (`"892"`, xem `MAU_THEO_MA_TKHAI`)
nhờ có XML thật đối chiếu (hồ sơ Quyết toán năm 2025, MST 0106200129) — cùng mức tin cậy với 01/GTGT
(`"842"`); 05/QTT-TNCN chỉ nhận diện qua chuỗi `to_khai`/`tenTKhai`, chưa có XML thật để xác nhận
`<maTKhai>`.

### Hai quy ước đánh mã chỉ tiêu

03/TNDN buộc phải tách quy ước tag: 01/GTGT, 05/KK-TNCN, 05/QTT-TNCN đều đánh chỉ tiêu SỐ thuần
(`ctNN`, quét bằng regex `RE_CT_SO`), còn 03/TNDN đánh theo **nhóm chữ cái** (`ctA1`, `ctB13`,
`ctC3a`…, quét bằng `RE_CT_CHU`). `layMoiCt()` nhận thêm tham số `regex` (mặc định `RE_CT_SO`) để
dùng lại được cho cả hai quy ước thay vì viết hàm quét thứ hai.

Riêng chỉ tiêu **C7** là ngoại lệ: XML không có thẻ `<ctC7>` trần, số nằm ở `<ctC7_thuNhap>` —
`layChiTietTndn03()` đọc riêng rồi ghi vào key `"ctC7"` cho khớp mã in trên mẫu.

### Field dùng chung mở rộng

`ThongTinChungToKhai` (khối dùng chung mọi tờ khai TCT) có thêm hai field `ngayLap`/`loaiTKhai` —
`loaiTKhai` giữ NGUYÊN mã gốc thẻ `<loaiTKhai>` (vd `"C"`), KHÔNG dịch sang "Chính thức"/"Bổ sung"
như cột `dvc_ho_so.loai_to_khai` cổng hiển thị, vì người xuất file muốn thấy đúng mã gốc trong XML.

### Hồ sơ "Bộ báo cáo tài chính" nộp kèm quyết toán

Hồ sơ này (cùng lượt nộp, khác mã hồ sơ) không có layout riêng (rơi vào nhánh `raw`) nên không đọc
được `tenTKhai` qua `chiTiet.duLieu` như dòng 03/TNDN thật — hàm mới `layTenTKhaiTho()` đọc thẳng thẻ
`<tenTKhai>`, độc lập với việc mẫu có nhận diện được hay không, để cột "Tên tờ khai" của các dòng BCTC
trong `mst_ToKhai03TNDN.xlsx` không bị bỏ trống oan. `layDsToKhaiTndn03DaLuu()` ưu tiên dùng lại giá
trị `tenTKhai` mà `layChiTietToKhai` đã bóc sẵn cho các dòng 03/TNDN thật, chỉ gọi `layTenTKhaiTho()`
thêm cho các dòng BCTC — tránh quét lại cùng một XML hai lần.

---

## 4. 5 file Excel + 1 thư mục XML thô, cùng một lượt bấm

`XuatFileDvcDialog.xuatFile()` chạy hai việc SONG SONG qua `Promise.all`:

1. Dựng 5 workbook (`mst_ToKhai01GTGT.xlsx`, `mst_ToKhai05QTTTNCN.xlsx`, `mst_ToKhai05KKTNCN.xlsx`,
   `mst_ToKhai03TNDN.xlsx`, `mst_ToKhaiKhac.xlsx`) rồi ghi vào thư mục con **"Thống kê tờ khai"**.
2. Tải nguyên văn XML của mọi hồ sơ, ghi mỗi hồ sơ 1 file `.xml` vào thư mục con **"Tờ khai XML"**
   (sibling với thư mục trên) — đi KÈM 5 file thống kê, không thay thế cột "Tải file" từng dòng.

Loại/phần nào không có hồ sơ trong khoảng ngày thì bỏ qua (không ghi file rỗng, không coi là lỗi) —
chỉ báo lỗi thật khi cả lượt ném exception (mất mạng, thư mục bị thu hồi quyền ghi…).

### Factory `khaiLoaiXuat` — giấu kiểu `Row` khác nhau của 5 mẫu vào một mảng đồng nhất

5 workbook khai qua `khaiLoaiXuat<Row>(nhan, layDs, build, filename)`, gộp lại thành mảng
`CAC_LOAI_XUAT: KhaiLoaiXuat[]` — thêm mẫu tờ khai mới sau này chỉ cần nối thêm 1 phần tử, không phải
sửa vòng lặp `xuatFile`. `Row` (kiểu dòng dữ liệu, khác nhau cho mỗi mẫu) bị giấu kín trong closure
của từng phần tử vì `KhaiLoaiXuat` (kiểu phần tử mảng) không mang tham số kiểu — để lộ ra sẽ buộc
TypeScript hợp nhất `Row` thành một kiểu chung cho cả 5 mẫu vốn không hề chung kiểu dòng.

### Ghi XML theo lô, không thả hết một lượt

Khoảng ngày rộng có thể ra tới `MAX_KET_QUA_TIM_KIEM` (500) hồ sơ — thả hết 500 `writeFile` cùng lúc
là mở ngần ấy handle đĩa một lượt. `xuatXmlHangLoat()` ghi theo lô `CO_LO_GHI_XML = 25` file song
song một lúc (tuần tự giữa các lô), cùng tinh thần ghi theo lô đã có ở `exportBundle.ts` bên module
hóa đơn.

---

## 5. Khung dựng workbook dùng chung, tách sau lần chép thứ 3

`xuatChiTieuExcel.ts` (`buildDvcChiTieuWorkbookBuffer`) tách ra sau khi phần dựng sheet (tiêu đề, độ
rộng cột, viền, autoFilter, đóng băng dòng đầu) đã bị chép nguyên bản 2 lần giữa
`xuatGtgt01Excel.ts`/`xuatQtt05Excel.ts` — mỗi mẫu tờ khai giờ chỉ còn khai DANH SÁCH CỘT
(`COT_DAU`/`COT_CHI_TIEU`), không phải dựng lại workbook từ đầu. Bố cục cố định cho cả họ file: cột
đầu (Tên tờ khai/Kỳ kê khai…) trước, khối chỉ tiêu ở giữa (numFmt `"#,##0"`), "Trạng thái" luôn ở
cuối (đọc thẳng `row.trangThai` theo mặc định — cả 5 mẫu đều đặt tên field giống nhau nên không mẫu
nào cần truyền `layTrangThai` riêng). `mst_ToKhaiKhac.xlsx` tái dùng cùng khung với khối chỉ tiêu
RỖNG (`Tag = never`) vì mẫu rơi vào đây chưa có layout XML nào để bóc. Màu tiêu đề/viền ô/chiều cao
dòng tiêu đề dùng lại đúng ba hằng đã có ở `exportXlsx.ts` (module hóa đơn), không khai bản riêng.

Một chi tiết dễ bỏ sót: cột "Lần nộp"/"Tiểu mục hạch toán" lưu **dạng chữ** (giữ số 0 đầu nếu mã có)
nhưng là dữ liệu SỐ về bản chất — Excel mặc định canh trái theo kiểu chữ, lệch mắt với khối chỉ tiêu
số bên cạnh đang canh phải. `CotDau.align` cho phép ép `"right"` riêng cho các cột này mà không phải
đổi kiểu dữ liệu sang số chỉ để canh cho đẹp.

`tachKyKeKhai()` tách "Quý"/"Năm" từ chuỗi kỳ kê khai thô (`"Q2/2026"` → quý 2, năm 2026) cho hai mẫu
còn khai theo quý (01/GTGT, 05/KK-TNCN). CHỈ nhận "quý" khi tiền tố đúng là `"Q"` — hai mẫu đó còn
khai được theo THÁNG (doanh nghiệp doanh thu >50 tỷ, tiền tố `"T"`), gán nhầm số tháng vào cột "Quý"
sẽ ra giá trị vô lý (`"T7/2026"` thành "Quý 7"). Tiền tố lạ để trống cả hai, không đoán liều.

---

## 6. /code-review + /simplify

Một lượt `/code-review` (agent Code Reviewer) rồi bốn agent `/simplify` chạy song song (reuse,
simplification, efficiency, altitude) trên toàn bộ diff của tính năng này.

### 6.1. /code-review: 1 blocker + 2 suggestion

| Mức | Vấn đề | Vá |
|---|---|---|
| **Blocker** | Thêm `"tndn03"` làm nhánh `loai` mới của `ChiTietToKhai` nhưng quên lặp lại đúng cái vá đã làm cho `"qtt05"` ở FE — `ToKhaiXmlDialog.tsx` crash (`data.chiTieu.length` trên `undefined`) khi mở "Xem tờ khai" cho hồ sơ 03/TNDN đã có XML | Mirror y hệt fix `"qtt05"`: thêm `DvcChiTietTndn03`, nhánh union, `CAN_KHO_RONG`/`rong` loại trừ |
| Suggestion | `tachKyKeKhai()` (bản đầu) gán bất kỳ tiền tố nào trước `/YYYY` thành "quý", đọc nhầm `"T7/2026"` thành "Quý 7" | Chỉ nhận tiền tố `"Q"` (xem mục 5) |
| Suggestion | `layDsXmlToKhaiDaLuu` chung trần `MAX_KET_QUA_TIM_KIEM=500` với các endpoint khác nhưng trả nguyên văn XML (payload lớn hơn hẳn) | Ghi nhận, **không vá** — nhất quán với quy ước hiện có, chưa phải sự cố cụ thể |

### 6.2. /simplify: 12 mục vá, 6 mục cố ý bỏ qua

Bốn agent quy tụ vào cùng một phát hiện mạnh nhất từ 3 góc độ khác nhau: `hangQtt05`/`hangTndn03`
trong `ToKhaiXmlDialog.tsx` là hai hàm **giống hệt nhau từng byte**, chỉ khác kiểu tham số — gộp
thành `hangChiTieuTho()` dùng chung, kèm gộp interface `DvcChiTietQtt05`/`DvcChiTietTndn03` về một
base `DvcChiTietToKhaiChung`. Bốn `layDsToKhaiXXXDaLuu` bên BE cũng bị 3 agent (efficiency/altitude/
simplification) cùng chỉ ra là lặp gần như nguyên khối "tra khoảng ngày + `select` 9 cột" — tách
thành `layHoSoTheoMauTrongKhoang()` dùng chung (xem mục 2).

| # | Vá | Ghi chú |
|---|---|---|
| 1 | `hangQtt05`+`hangTndn03` → `hangChiTieuTho()` chung | 3/4 agent cùng phát hiện độc lập |
| 2 | `DvcChiTietQtt05`/`DvcChiTietTndn03` → extends `DvcChiTietToKhaiChung` | Mirror `ThongTinChungToKhai` bên BE |
| 3 | 4 `layDsToKhaiXXXDaLuu` → dùng chung `layHoSoTheoMauTrongKhoang()` | 3/4 agent, nhưng **chỉ** gộp phần fetch — KHÔNG gộp 6 endpoint thành 1 query (xem "cố ý bỏ qua") |
| 4 | 6 handler + 6 type query trùng ở `gdt-dvc.controller.ts` → factory `xuatHandler<Row>()` | Mirror `khaiLoaiXuat()` bên FE cùng diff |
| 5 | `layChiTietQtt05` chép nguyên `giuLai` closure của `layChiTietTncn05` | Tách `giuLaiCtSoTrongDai(tu, den)` dùng chung |
| 6 | `layDsToKhaiKhacDaLuu`: `AND` của `NOT` từng phần tử | Rút gọn thành `NOT: [...]` (Prisma nhận mảng trực tiếp) |
| 7 | `tndn03?.tenTKhai` bị bỏ qua, luôn gọi lại `layTenTKhaiTho()` dù `layChiTietToKhai` vừa bóc xong | Ưu tiên giá trị đã bóc, chỉ quét lại XML cho dòng BCTC thật sự cần |
| 8 | `xuatXmlHangLoat` thả `Promise.all` không trần (tới 500 file cùng lúc) | Ghi theo lô `CO_LO_GHI_XML=25` (xem mục 4) |
| 9 | `HEADER_FILL`/`CELL_BORDER`/chiều cao tiêu đề khai lại trong `xuatChiTieuExcel.ts` dù đã có ở `exportXlsx.ts` | Export 3 hằng đó, import lại thay vì khai bản riêng |
| 10 | `layTrangThai` giống hệt ở cả 5 call site (`(r) => r.trangThai`) | Thành tham số **tùy chọn**, mặc định đọc `row.trangThai` |
| 11 | `khai.layBuffer({tuNgay: p.tuNgay, denNgay: p.denNgay})` dựng lại object từ `p` sẵn có | `khai.layBuffer(p)` |
| 12 | Dòng trắng thừa khoảng trắng cuối `XuatFileDvcDialog.tsx` | Xóa |

**Cố ý bỏ qua** (ghi lại lý do, không phải quên):

- **Gộp 6 endpoint thành 1 query duy nhất** (đề xuất mạnh nhất của agent hiệu năng) — từ chối vì sẽ
  đổi ngữ nghĩa "mỗi mẫu lấy 500 MỚI NHẤT CỦA RIÊNG MẪU ĐÓ" thành một trần dùng chung (mẫu ít hồ sơ bị
  mẫu nhiều hồ sơ chiếm chỗ), và đổi luôn hợp đồng 6 endpoint hiện có. Đổi lại chỉ tiết kiệm được vài
  round-trip DB trong CÙNG một lượt bấm — không đáng đánh đổi ngữ nghĩa.
- **Gộp 3 nơi đang tự phân loại mẫu** (`CHUOI_DA_CO_FILE_RIENG` ở BE, 4 filter `to_khai contains` của
  từng endpoint, `MAU_THEO_CHUOI` bên `toKhaiXml.ts`) thành một hàm `phanLoaiToKhai()` duy nhất — thật
  nhưng là refactor lớn chạm vào logic phân loại công khai; `CHUOI_DA_CO_FILE_RIENG` đã có cảnh báo
  bảo trì ngay trong comment của nó, đủ giảm rủi ro trôi.
- **Cho nhánh `"raw"` của `ChiTietToKhai` mang sẵn field chung** (`ThongTinChungToKhai`) để khỏi cần
  `layTenTKhaiTho()` — sẽ lan ra mọi nơi tiêu thụ nhánh `"raw"`; vá cục bộ ở mục #7 (bảng vá) đã giảm
  phần lãng phí chính (đọc trùng) mà không phải đổi hình dạng union.
- **`CAN_KHO_RONG` giờ chỉ còn map về `true`** (từ khi loại thêm `"qtt05"`/`"tndn03"`) — agent tự nhận
  đây không phải thắng lợi rõ ràng: cơ chế `Record<Exclude<...>, true>` đổi lại một lưới an toàn biên
  dịch (quên khai mẫu mới → lỗi build, không phải render khổ hẹp âm thầm) đáng giá hơn vài dòng gọn.
- **Trần đọc 5-lần-substring không đánh index của `layDsToKhaiKhacDaLuu`** — không index nào giúp được
  vì cả 6 endpoint đều lọc bằng `contains` (dịch ra `LIKE '%...%'`); chỉ đáng sửa nếu gộp query (mục
  đã từ chối ở trên).
- **9 bản `HEADER_FILL` trùng lặp khác trong module HRM** (`bangLuongExcel.ts` và 7 file
  `du_lieu_luong/*`) — ngoài phạm vi diff này, không đụng tới.

---

## 7. Dọn rồi khôi phục comment theo yêu cầu — CHƯA XONG HẾT

Sau lượt review, toàn bộ comment MỚI THÊM trong phiên này đã bị xóa khỏi 14 file (giữ nguyên comment
có sẵn từ trước phiên, chỉ xóa phần mình vừa viết) theo yêu cầu dọn diff. Sau đó có yêu cầu khôi phục
lại — dạng "giải thích hàm hoạt động ra sao + dùng tại file nào" — cho từng hàm/kiểu.

**Đã xong:** `be_maxv/src/services/client/dich_vu_cong/toKhaiXml.ts` — mọi hàm/type/const mới thêm
trong tính năng này (`RE_CT_CHU`, `layMoiCt`, `giuLaiCtSoTrongDai`, `CtTagQtt05`/`ChiTietQtt05`/
`layChiTietQtt05`, `CtTagTndn03`/`CT_TNDN03_HOP_LE`/`ChiTietTndn03`/`layChiTietTndn03`, hai nhánh mới
của `ChiTietToKhai`, `MauDaBietLayout`, `layTenTKhaiTho`) đã có comment nêu cơ chế + nơi dùng.

**CHƯA làm** (còn ở trạng thái không comment, từ lượt dọn trước): `dvc-dong-bo.service.ts`,
`gdt-dvc.controller.ts`, `gdt-dvc.route.ts`, `api/dvc.ts`, `ToKhaiXmlDialog.tsx`,
`XuatFileDvcDialog.tsx`, `exportXlsx.ts`, và cả 6 file `xuatXXXExcel.ts` mới. Cần chạy tiếp cùng cách
đã làm cho `toKhaiXml.ts` nếu muốn đủ bộ.

---

## 8. Bảng file

### 8.1. Backend (sửa)

| File | Việc |
|---|---|
| `services/client/dich_vu_cong/toKhaiXml.ts` | Thêm nhận diện + bóc chỉ tiêu 05/QTT-TNCN, 03/TNDN (mục 3) |
| `services/client/dich_vu_cong/dvc-dong-bo.service.ts` | 6 hàm nguồn dữ liệu cho "Xuất file" (mục 2) |
| `controllers/client/dich_vu_cong/gdt-dvc.controller.ts` | 6 handler `GET /dvc/ho-so/xuat-*` |
| `routes/dich_vu_cong/gdt-dvc.route.ts` | Đăng ký 6 route trên |

### 8.2. Frontend (sửa)

| File | Việc |
|---|---|
| `features/dich_vu_cong/api/dvc.ts` | Kiểu + hàm gọi 6 API xuất, mirror kiểu bên BE |
| `features/dich_vu_cong/components/ToKhaiXmlDialog.tsx` | Dialog "Xem tờ khai" hiện thêm 2 mẫu qtt05/tndn03 |
| `features/dich_vu_cong/components/XuatFileDvcDialog.tsx` | Từ stub thành thật — dựng + ghi 5 Excel + XML hàng loạt (mục 4) |
| `features/hddt/exportXlsx.ts` | Export thêm `HEADER_FILL`/`HEADER_HEIGHT`/`CELL_BORDER` để dùng chung |

### 8.3. Frontend (mới)

| File | Việc |
|---|---|
| `features/dich_vu_cong/xuatChiTieuExcel.ts` | Khung dựng workbook dùng chung (mục 5) |
| `features/dich_vu_cong/xuatGtgt01Excel.ts` | Cột cho `mst_ToKhai01GTGT.xlsx` |
| `features/dich_vu_cong/xuatQtt05Excel.ts` | Cột cho `mst_ToKhai05QTTTNCN.xlsx` |
| `features/dich_vu_cong/xuatTncn05Excel.ts` | Cột cho `mst_ToKhai05KKTNCN.xlsx` |
| `features/dich_vu_cong/xuatTndn03Excel.ts` | Cột cho `mst_ToKhai03TNDN.xlsx` |
| `features/dich_vu_cong/xuatKhacExcel.ts` | Cột cho `mst_ToKhaiKhac.xlsx` |

---

## 9. Trạng thái kiểm chứng

| Lệnh | Kết quả |
|---|---|
| `be_maxv` — `npm run typecheck` | sạch |
| `be_maxv` — `npm run lint` | 0 errors, 108 warning `no-console` toàn repo — **5 trong số đó** nằm ở `dvc-dong-bo.service.ts` và đã có TỪ TRƯỚC tính năng này (không phải do diff này thêm); phần chênh so với con số 102 ghi trong `dvc-thay-doi-2026-08.md` đến từ các file khác ngoài phạm vi diff này |
| `hdđt_maxv` — `npx tsc -b` | sạch |
| `hdđt_maxv` — `npm run build` | thành công (`vite build`), chỉ có cảnh báo thường lệ về kích thước chunk |
| `hdđt_maxv` — `npx eslint src/features/dich_vu_cong src/features/hddt/exportXlsx.ts` | 0 errors, 0 warning |
| `be_maxv` — `npx tsx --test src/__tests__/*.test.ts` | 189/194 pass — **5 lỗi còn lại đều thuộc `adminOwner.test.ts`**, integration test cần Postgres đã seed (lỗi có sẵn, không liên quan tính năng này, xem `dvc-thay-doi-2026-08.md` mục 9) |

> **Chưa có test tự động riêng cho tính năng này.** `toKhaiXml.test.ts` có sẵn phủ 01/GTGT nhưng
> chưa thêm case cho `layChiTietQtt05`/`layChiTietTndn03`/`giuLaiCtSoTrongDai`, và chưa có test cho
> `tachKyKeKhai()`/`buildDvcChiTieuWorkbookBuffer`. Đã kiểm bằng typecheck + lint + đọc code kỹ, CHƯA
> chạy thử bằng dữ liệu thật trên trình duyệt (chưa bấm "Xuất file" thật để mở file `.xlsx` ra xem).

---

## 10. Việc CHƯA làm

1. **Khôi phục comment cho 7 file sửa còn lại + 6 file mới** — xem mục 7.
2. **Chưa test tay trên trình duyệt** — chưa xác nhận file `.xlsx` mở lên đúng cột/đúng số, chưa xác
   nhận 2 thư mục con ghi đúng chỗ qua File System Access API thật.
3. **Chưa có XML 05/QTT-TNCN thật để đối chiếu** — cùng tình trạng đã ghi ở `dvc-thay-doi-2026-08.md`
   mục 4.2 cho 05/KK-TNCN: chỉ tiêu `ct16`..`ct41` đang SUY từ quy ước, chưa kiểm chéo bằng số học.
