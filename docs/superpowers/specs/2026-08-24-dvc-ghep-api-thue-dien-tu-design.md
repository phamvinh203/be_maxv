# Ghép API "Thuế điện tử" (ETAX) vào đồng bộ Dịch vụ công — thiết kế

> Trạng thái: **chờ duyệt**. Viết sau một lượt dò API thật trên cổng
> `dichvucong.gdt.gov.vn` bằng tài khoản của MST 0106200129.

## 1. Mục tiêu

Tab "Tờ khai (Dịch vụ công - thuế điện tử)" hiện chỉ lấy được hồ sơ qua API Dịch vụ công (DVC).
Cổng còn một nguồn thứ hai — tab "Thuế điện tử" (ETAX) — chứa tờ khai **nộp trước 01/07/2025**.
Mục tiêu: một lượt "Đồng bộ" lấy được cả hai nguồn, người dùng không phải biết có hai hệ thống.

### Luật định tuyến (đã chốt)

| Khoảng ngày nộp | Nguồn |
|---|---|
| `< 01/07/2025` | ETAX (TDT) |
| `>= 01/07/2025` | DVC (như hiện tại) |
| Vắt qua mốc | **Cắt đôi tại 01/07/2025, gọi cả hai, gộp kết quả** |

Cắt đôi chứ không định tuyến theo ngày bắt đầu: mất trọn nửa khoảng mà không báo gì là đúng kiểu
hỏng âm thầm mà nhóm 7 vừa bỏ công dẹp.

## 2. Những gì ĐÃ kiểm chứng trên cổng thật

Ghi lại vì đây là nền của mọi quyết định bên dưới; ai sửa sau này mà thấy khác thì cổng đã đổi.

### 2.1. Tra cứu ETAX chạy được, dùng CHUNG phiên với DVC

`POST /tthc/tchs/thuedientu` — không phải đăng nhập riêng, không phải captcha riêng: cùng
`JSESSIONID`, cùng endpoint `getCaptcha` mà `getTchsCaptcha` đang dùng.

```
Content-Type: application/x-www-form-urlencoded
Accept: text/html-partial
Referer: /tthc/tchs          Origin: https://dichvucong.gdt.gov.vn
HX-Request: true             HX-Current-URL: /tthc/tchs
HX-Target: bangKetQuaTraCuu_tdt   HX-Trigger: form_search_tdt
x-xsrf-token: <csrfToken>

_csrf=<csrfToken>&page=&size=&maToKhai_tdt=&maGiaoDichTthc_tdt=
&tuNgay_tdt=01/01/2025&denNgay_tdt=30/06/2025
&scope_tdt2=SELF&mstUyQuyen_tdt2=&captcha=<answer>&btnSearch_tdt=
```

Ngày dạng `dd/MM/yyyy` — `toDvcDate` sẵn có làm đúng việc này.

Kết quả thật: 10 hồ sơ cho Q1–Q2/2025. **`parseBangHoSo` bóc được nguyên bảng**, không cần parser
mới cho phần dòng.

### 2.2. Toàn bộ pipeline chi tiết DÙNG LẠI ĐƯỢC

| Việc | DVC | ETAX |
|---|---|---|
| Trang chi tiết | `GET /tchs/files/detail/{ma}?loai=` | `GET /tchs/files/detail/{ma}?loai=ETAX` |
| Tải tờ khai | `POST /tchs/downloadhoso` | `POST /tchs/downloadhoso-tdt?loaiTraCuu=ETAX` |
| Tải thông báo | `POST /tchs/downloadthongbao` | `POST /tchs/downloadthongbao-tdt?loaiTraCuu=ETAX` |
| Thân request | `{maHoSo}` / `{idTbao, loaiTBao}` | **giống hệt** |
| Referer khi tải | trang chi tiết | trang chi tiết **kèm `?loai=ETAX`** |

Đã chạy thật: `downloadhoso-tdt` trả **3032 byte, `application/zip`,
`files_11320250320068493.zip`**, bên trong là `files_11320250320068493_0.xml` — đúng hình dạng
`taiXmlHoSoThuc` đang bóc. Nghĩa là thân hàm giữ nguyên, chỉ đổi URL.

### 2.3. Ràng buộc THỨ TỰ trong phiên

Gọi thẳng trang chi tiết ETAX khi chưa tra cứu ETAX trong cùng phiên → **HTTP 500**. Tra cứu trước
rồi gọi lại → 200. Cổng giữ state phía server.

Có cửa kiểm: `GET /tchs/validateIdTkhai?idTKhai={ma}` trả chuỗi `"200"` khi mã hợp lệ trong phiên.

## 3. Bốn điểm KHÁC buộc phải xử lý riêng

### 3.1. `idTbao` phải giữ dạng CHUỖI

Trình duyệt gửi `{"idTbao":11320250313037580,...}` — số trần. Id 17 chữ số vượt
`Number.MAX_SAFE_INTEGER`:

```
11320250313037580 -> 11320250313037580   (chẵn, tình cờ sống sót)
11320250320068493 -> 11320250320068492   <-- SAI  (mã hồ sơ thật lấy từ tra cứu)
```

Chép nguyên dạng số từ curl là hỏng với mọi id lẻ. `taiThongBaoThuc` bên DVC đã có comment về đúng
lỗi này (`...687 -> ...688`); bản ETAX giữ nguyên cách gửi chuỗi.

### 3.2. Captcha sai báo bằng HTTP 400, không phải HTML

DVC trả mảnh HTML chứa câu lỗi và `laLoiCaptcha` dò chữ trong đó. ETAX trả
`400 "Mã captcha không chính xác, vui lòng thử lại!"` → ném `DvcHttpError`. Vòng thử lại captcha
của ETAX phải bắt `DvcHttpError.status === 400` + `laLoiCaptcha(err.detail)`, không thể dùng lại
nhánh cũ nguyên vẹn.

### 3.3. Pager khác markup

```
DVC : <span id="totalPage">2</span> - Tổng số bản ghi: <span>16</span>
ETAX: Trang <span>1</span>/ <span>1</span> — Tổng số bản ghi: <span>10</span>
```

`TONG_BAN_GHI_RE` khớp cả hai (may mắn). `TONG_TRANG_RE` (`id="totalPage"`) **không** khớp ETAX →
`tongSoTrang` ra `null`. `bocPhanTrang` cần pattern thứ hai cho dạng `Trang <span>N</span>/ <span>M</span>`.
Lưu ý dấu gạch: DVC dùng `-`, ETAX dùng em-dash `—`.

### 3.4. Bộ cột khác

```
ETAX (11): STT | Mã giao dịch | Tờ khai/Phụ lục | Kỳ tính thuế | Loại tờ khai | Lần nộp
           | Lần bổ sung | Ngày nộp | Nơi nộp | Tiến trình giải quyết hồ sơ (Trạng thái) | Thao tác
```

`dongBoHoSo` đọc ô theo **tên cột** (`oTheoTieuDe`), nên cần ánh xạ về tên chuẩn của DVC:

| Cột ETAX | Tên chuẩn |
|---|---|
| Mã giao dịch | Mã hồ sơ |
| Tờ khai/Phụ lục | Tờ khai |
| Lần bổ sung | Lần nộp bổ sung |
| Nơi nộp | Cơ quan thuế tiếp nhận |
| Tiến trình giải quyết hồ sơ (Trạng thái) | Trạng thái |
| *(không có)* | Tên TTHC → để trống |

Các cột còn lại trùng tên, giữ nguyên.

## 4. Kiến trúc

### 4.1. "Nguồn" thành khái niệm xuyên suốt

Kiểu mới `NguonHoSo = "dvc" | "tdt"`, đi kèm hồ sơ từ lúc tra cứu tới lúc lưu.

Schema: `dvc_ho_so` thêm `nguon String @default("dvc") @db.VarChar(8)`.

Cần vì mở lại một hồ sơ đã lưu để tải file thì phải biết gọi endpoint nào. Mã hai nguồn khác
namespace (`G12.18-…` vs `11320250320068493`) nên khoá chính `ma_ho_so` giữ nguyên, không sợ đụng.

Thêm cột nullable-có-default → `prisma db push` không xoá gì, nhưng **vẫn phải chạy
`npm run sync:tenants` trước khi deploy** (xem mục 11 của `dvc-thay-doi-2026-08.md`).

### 4.2. Tham số hoá endpoint theo nguồn

Ba hàm hiện có (`layChiTietHoSoHtml`, `taiXmlHoSoThuc`, `taiThongBaoThuc`) chỉ khác URL và Referer.
Gom thành một bảng:

```ts
const DUONG_DAN: Record<NguonHoSo, {
  chiTiet: (ma: string) => string;
  taiHoSo: string;
  taiThongBao: string;
}> = {
  dvc: { chiTiet: (ma) => `/tchs/files/detail/${enc(ma)}?loai=`,      taiHoSo: "/tchs/downloadhoso",                        taiThongBao: "/tchs/downloadthongbao" },
  tdt: { chiTiet: (ma) => `/tchs/files/detail/${enc(ma)}?loai=ETAX`,  taiHoSo: "/tchs/downloadhoso-tdt?loaiTraCuu=ETAX",     taiThongBao: "/tchs/downloadthongbao-tdt?loaiTraCuu=ETAX" },
};
```

`chiTietHoSoUrl(ma, nguon)` (dùng làm Referer) đọc từ chính bảng này, nên Referer của ETAX tự mang
`?loai=ETAX` — không thể quên.

### 4.3. Tra cứu ETAX: hàm riêng, gộp trang dùng chung

`traCuuHoSoTdt` là hàm mới (POST form, header HX riêng, nhận diện lỗi captcha riêng). Nhưng nó
**dùng lại `gopCacTrangHoSo`** như DVC: chỉ cần cấp một `layTrang` khác. Mọi điều kiện dừng, chống
trùng theo "Mã hồ sơ", cảnh báo lệch cột đều dùng chung và đã có 10 test.

### 4.4. Định tuyến và cắt khoảng

Hàm thuần, test được, không đụng cổng:

```ts
/** Cắt [tuNgay, denNgay] tại mốc 01/07/2025 -> các đoạn kèm nguồn. */
function chiaDoanTheoNguon(tuNgay: string, denNgay: string): { nguon: NguonHoSo; tuNgay: string; denNgay: string }[]
```

- Trọn vẹn trước mốc → 1 đoạn `tdt`
- Trọn vẹn từ mốc → 1 đoạn `dvc`
- Vắt qua → 2 đoạn: `tdt` [tuNgay, 30/06/2025] và `dvc` [01/07/2025, denNgay]

`dongBoHoSo` lặp qua các đoạn, gộp `rows` (kèm `nguon` từng dòng) rồi mới vào vòng xử lý hồ sơ như
hiện tại. `tienDo.tongHoSo` là tổng sau khi gộp, nên thanh tiến độ vẫn đúng một mẫu số.

`thieuHoSo` cộng dồn từ cả hai đoạn — vẫn giữ nguyên tinh thần "thiếu là phải báo".

## 5. Xử lý lỗi

- **Một đoạn lỗi, đoạn kia xong**: không huỷ cả lượt. Ghi `partial` và nói rõ đoạn nào hỏng — mất
  nửa dữ liệu mà báo "done" là đúng thứ mục 7ter vừa dẹp.
- **Captcha ETAX**: thử lại theo `SO_LAN_THU_CAPTCHA` như DVC, nhận diện qua `DvcHttpError 400`.
- **Phiên chết giữa chừng**: `voiPhucHoi` hiện chỉ bọc pha tra cứu — vẫn đúng, nay bọc từng đoạn.
- **`validateIdTkhai` không trả "200"**: coi như hồ sơ đó lỗi (`loi++`), giữ `da_dong_bo=false` để
  lượt sau bù. Không huỷ cả lượt.
- **Thứ tự trong phiên** (mục 2.3): lượt đồng bộ luôn tra cứu trước rồi mới tải chi tiết, nên thoả
  tự nhiên. Phải ghi comment ở chỗ tải để người sau không tách ra gọi lẻ rồi dính 500.

## 6. Kiểm thử

**Thuần logic (test tự động, không đụng cổng):**
- `chiaDoanTheoNguon`: trọn trước / trọn sau / vắt mốc / đúng ngày mốc / khoảng một ngày
- Ánh xạ cột ETAX → tên chuẩn, gồm cả "Tên TTHC" vắng mặt
- `bocPhanTrang` với markup ETAX (em-dash, `Trang N/ M`) — thêm vào `dvcPhanTrang.test.ts`
- Nhận diện lỗi captcha ETAX từ `DvcHttpError 400`
- `gopCacTrangHoSo` đã có 10 test, dùng lại nguyên

**Thử thật:** MST 0106200129 là bộ dữ liệu tốt cho cả hai nhánh — 10 hồ sơ ETAX ở Q1–Q2/2025 và 16
hồ sơ DVC ở 2026. Kịch bản: đồng bộ 01/01/2025–31/12/2026 phải ra **26 hồ sơ**, không trùng, log
`done`.

## 7. Việc CHƯA kiểm chứng — làm đầu tiên khi triển khai

`parseDanhSachThongBao` có bóc được `#modalThongBao` của trang chi tiết ETAX không. Bằng chứng gián
tiếp mạnh (HTML đó có `modalThongBao`×1, `idTbao`×2, `downloadthongbao`×2) nhưng chưa parse thử.
Nếu markup lệch thì thêm pattern — không đổi kiến trúc.

## 8. Ngoài phạm vi

- Tab "Giấy nộp tiền" — vẫn chưa có tích hợp cổng.
- Nút "Nộp hồ sơ bổ sung" trên trang chi tiết ETAX (Thymeleaf đang bị comment ở cổng).
- "Tệp đính kèm" cho hồ sơ ETAX — trang chi tiết ETAX không có khối này.
