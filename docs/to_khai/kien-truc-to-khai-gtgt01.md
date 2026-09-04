# Hướng dẫn đọc và sửa code mô-đun Tờ khai 01/GTGT

> Đối tượng: lập trình viên cần lần đầu đọc, sửa hoặc mở rộng phần “lấy hóa đơn điện tử để lập tờ khai GTGT”.
>
> Mục tiêu: biết chính xác dữ liệu nằm ở đâu, một nút bấm đi qua hàm nào, công thức nằm ở đâu và chỗ nào tuyệt đối không được nhân đôi logic.

## 1. Mô hình nghiệp vụ trước khi đọc code

Mô-đun không coi “mọi hóa đơn có ngày lập trong tháng/quý” là dữ liệu của tờ khai. Kế toán phải bấm **Kê khai** để gán hóa đơn vào kỳ, sau đó được quyền đánh dấu một hóa đơn là **Không kê khai**. Tờ khai chỉ tính từ tập hóa đơn đã qua hai điều kiện này.

```text
Hóa đơn GDT đã đồng bộ
       │
       │  POST /to-khai/ke-khai
       ▼
tokhai_ky_hoa_don
  - kỳ nào?
  - mua vào hay bán ra?
  - có kê khai không?
  - chỉ tiêu tăng/giảm và ghi chú của kế toán
       │
       │  POST /to-khai/gtgt01/tinh
       ▼
tokhai_gtgt01
  - các chỉ tiêu cuối (ct)
  - số máy tính (ct_may)
  - ghi đè của kế toán (ghi_de)
  - phụ lục, cảnh báo, trạng thái nháp/chốt
       │
       ├── Giao diện tờ khai / Excel
       └── XML HTKK
```

### Hai bảng tenant quan trọng

```prisma
model tokhai_ky_hoa_don {
  hoa_don_id String
  chieu      String  // purchase | sold
  nam        Int
  ky_loai    String  // thang | quy
  ky_so      Int
  ke_khai    Boolean @default(true)
  chi_tieu_tang_giam String?
  ghi_chu    String?

  @@id([hoa_don_id, chieu])
}
```

`@@id([hoa_don_id, chieu])` là bất biến rất quan trọng: cùng một hóa đơn trong cùng một chiều không thể xuất hiện ở hai kỳ. Khi gán lại kỳ, bản ghi cũ được cập nhật sang kỳ mới thay vì tạo bản ghi thứ hai.

```prisma
model tokhai_gtgt01 {
  nam, ky_loai, ky_so  // định danh một bản tờ khai
  trang_thai           // nhap | chot
  ct                   // số cuối để nộp
  ct_may               // số máy chưa áp ghi đè
  ghi_de               // ô kế toán sửa tay
  phu_luc              // phụ lục giảm thuế 8%
  canh_bao             // cảnh báo của lượt tính gần nhất
}
```

`ct` và `ct_may` phải cùng tồn tại. Nếu chỉ lưu `ct`, hệ thống không còn biết số nào do kế toán sửa và số nào máy tính từ hóa đơn.

## 2. Cấu trúc thư mục và quy tắc phụ thuộc

```text
be_maxv/src/services/client/to_khai/
├─ domain/
│  ├─ kySoThue.ts
│  ├─ chieuHoaDon.ts
│  ├─ chiaLo.ts
│  ├─ kyThayThe.ts
│  ├─ tienVnd.ts
│  ├─ gomHoaDonGtgt.ts
│  ├─ tinhGtgt01.ts
│  ├─ phuLuc204.ts
│  └─ soatToKhai.ts
├─ application/
│  ├─ keKhaiKy.service.ts
│  └─ toKhaiGtgt01.service.ts
├─ infrastructure/
│  ├─ toKhaiGtgt01.reader.ts
│  ├─ phuKy.ts
│  └─ soatToKhai.repository.ts
└─ serialization/
   └─ xuatXmlGtgt01.ts
```

| Tầng | Được làm | Không được làm |
| --- | --- | --- |
| `domain` | Công thức, chuẩn hóa, quy tắc kỳ, cảnh báo thuần | Prisma, SQL, Fastify, gọi HTTP |
| `infrastructure` | Đọc Prisma/SQL, trả dữ liệu đã có cấu trúc | Tự quyết định chỉ tiêu hoặc tự sinh UI text |
| `application` | Ghép reader + domain, thực hiện use-case, lưu kết quả | Chép lại công thức, parse XML/React |
| `serialization` | Biến kết quả đã tính thành XML | Tính lại chỉ tiêu từ hóa đơn |

Quy tắc đọc import: `application` có thể import `domain` và `infrastructure`; `infrastructure` có thể import type/hàm `domain`; `domain` không import ngược ra ngoài. Nếu một thay đổi đòi `domain` import Prisma, thay đổi đó đang đặt sai chỗ.

## 3. Luồng 1 — người dùng bấm “Kê khai” hóa đơn vào kỳ

### Request và controller

`POST /to-khai/ke-khai` đi vào `controllers/client/to_khai/keKhaiKy.controller.ts`, sau đó gọi:

```ts
const ketQua = await KeKhai.danhDauKy(db, ky);
```

Controller chỉ làm ba việc: xác thực tenant, đọc `ky` từ request, trả response. Toàn bộ luật chọn hóa đơn nằm trong application/domain.

### `application/keKhaiKy.service.ts` — `danhDauKy`

```ts
export async function danhDauKy(db: PrismaClient, ky: Ky): Promise<KetQuaDanhDau> {
  const { tuNgay, denNgay } = khoangCuaKy(ky);
  const ketQua = { purchase: 0, sold: 0, khongRoKyGoc: 0, daGo: 0 };

  for (const chieu of CA_HAI_CHIEU) {
    const { ids, khongRoKyGoc } = await layIdTrongKhoang(db, chieu, tuNgay, denNgay);
    ketQua.daGo += await goKhoiKy(db, ky, chieu, ids);

    for (const lo of chiaLo(ids, CO_LO_UPSERT)) {
      await db.$transaction(lo.map((hoaDonId) => db.tokhai_ky_hoa_don.upsert(/* ... */)));
    }
    ketQua[chieu] = ids.length;
  }
  return ketQua;
}
```

Giải thích theo thứ tự:

1. `khoangCuaKy` từ `domain/kySoThue.ts` biến `T7/2026` hoặc `Q3/2026` thành ngày bắt đầu/kết thúc.
2. `layIdTrongKhoang` lấy tập id thực sự thuộc kỳ. Nó không chỉ query theo `tdlap`; còn xét hóa đơn thay thế/điều chỉnh.
3. `goKhoiKy` xóa các hóa đơn hiện đang gán ở kỳ nhưng lượt quét mới kết luận không còn thuộc kỳ. Bước này phải chạy **trước** upsert để dữ liệu không giữ lại hóa đơn rác.
4. Upsert theo lô giữ lại `ke_khai`, `chi_tieu_tang_giam`, `ghi_chu` của bản ghi đã tồn tại. Không đổi quyết định của kế toán khi chỉ quét lại dữ liệu GDT.

### `domain/kyThayThe.ts` — vì sao cần kỳ gốc

```ts
export function chonTheoKyGoc(
  lapTrongKy: readonly string[],
  coGoc: readonly ToCoGoc[],
  tuNgay: string,
  denNgay: string,
): KetQuaChon
```

Ví dụ:

```text
Hóa đơn thay thế lập ngày 07/01/2026
Hóa đơn gốc lập ngày 26/12/2025
→ thuộc kỳ có 26/12/2025, không thuộc kỳ có 07/01/2026.
```

`chonTheoKyGoc` nhận hai nguồn:

- `lapTrongKy`: hóa đơn có ngày lập nằm trong khoảng kỳ.
- `coGoc`: hóa đơn thay thế/điều chỉnh kèm ngày hóa đơn gốc nếu suy được.

Hàm vừa loại tờ lập trong kỳ nhưng gốc ở kỳ khác, vừa kéo tờ lập ở kỳ sau về kỳ gốc. Nếu không suy được ngày gốc, nó không đoán; giữ hóa đơn theo ngày lập và tăng `khongRoKyGoc` để UI cảnh báo.

### `domain/chieuHoaDon.ts` và `domain/chiaLo.ts`

```ts
export type Chieu = "purchase" | "sold";
export const CA_HAI_CHIEU: readonly Chieu[] = ["purchase", "sold"];

export function tenViewHoaDon(chieu: Chieu): "vct50view" | "vct60view" {
  return chieu === "purchase" ? "vct60view" : "vct50view";
}
```

Không viết lại chuỗi `vct50view`/`vct60view` ở một file khác. Mapping này được dùng bởi cả luồng gán kỳ và luồng đối soát, nên một lỗi đảo chiều sẽ làm số mua/bán sai nhưng khó thấy ngay.

```ts
export function chiaLo<T>(ds: readonly T[], moiLo: number): T[][] {
  const ra: T[][] = [];
  for (let i = 0; i < ds.length; i += moiLo) ra.push(ds.slice(i, i + moiLo));
  return ra;
}
```

`chiaLo` được dùng ở hai nơi với kích thước khác nhau: 200 cho transaction upsert và 5.000 cho điều kiện `IN`. Không chuyển hai số này thành một hằng số chung: chúng giải quyết hai giới hạn khác nhau.

## 4. Luồng 2 — người dùng bấm “Lập tờ khai” hoặc “Tính lại”

### Điểm điều phối: `application/toKhaiGtgt01.service.ts`

```ts
export async function tinhVaLuu(db: PrismaClient, ky: Ky): Promise<BanToKhai> {
  const hienCo = await db.tokhai_gtgt01.findUnique(/* ... */);
  if (hienCo?.trang_thai === "chot") throw new BanDaChotError();

  const [ban, mua, ct22KyTruoc] = await Promise.all([
    docHoaDonCuaKy(db, ky, "sold"),
    docHoaDonCuaKy(db, ky, "purchase"),
    layCt22KyTruoc(db, ky),
  ]);
  // ... gộp → tính → phụ lục → soát → upsert
}
```

Đây là hàm quan trọng nhất của module. Đọc nó theo bảy pha dưới đây, không đọc theo từng dòng một cách rời rạc.

### Pha A — chặn trạng thái và lấy ghi đè

```ts
if (hienCo?.trang_thai === "chot") throw new BanDaChotError();
const ghiDe = locGhiDeHopLe(hienCo?.ghi_de);
```

`chot` nghĩa là số đã được kế toán chốt để nộp. Tính lại bản đã chốt sẽ làm mất tính “đóng băng”, nên phải mở khóa trước.

```ts
export function locGhiDeHopLe(raw: unknown): Record<string, GhiDeItem> {
  for (const [khoa, giaTri] of Object.entries(raw as Record<string, unknown>)) {
    if (!CT_HOP_LE.has(khoa)) continue;
    const gia = Number(o.gia);
    if (!Number.isFinite(gia)) continue;
    out[khoa] = { gia, lyDo };
  }
  return out;
}
```

Điểm cần nhớ:

- Payload JSON/DB không được tin hoàn toàn.
- Chỉ các khóa thuộc `CT_NHAP_TAY` mới được đi tiếp.
- Số `0` và số âm là hợp lệ; không dùng `if (!gia)` để kiểm tra.
- Ô công thức như `[27]`, `[34]`, `[43]` không có trong whitelist vì ghi đè chúng sẽ làm tờ khai tự mâu thuẫn.

### Pha B — reader lấy snapshot hóa đơn

`infrastructure/toKhaiGtgt01.reader.ts` cô lập Prisma khỏi calculator:

```ts
export async function docHoaDonCuaKy(db: PrismaClient, ky: Ky, chieu: Chieu) {
  const daGan = await db.tokhai_ky_hoa_don.findMany({
    where: { chieu, nam: ky.nam, ky_loai: ky.kyLoai, ky_so: ky.kySo },
    select: { hoa_don_id: true, ke_khai: true },
  });
  const idKeKhai = daGan.filter((d) => d.ke_khai).map((d) => d.hoa_don_id);
  // vct60view cho purchase, vct50view cho sold; đọc theo lô 5.000
  return { rows, soLoai, soThieuDetail };
}
```

Kết quả có ba phần:

| Field | Ý nghĩa | Ai dùng |
| --- | --- | --- |
| `rows` | hóa đơn đã được chọn để tính | `gomBanRa` / `gomMuaVao` |
| `soLoai` | hóa đơn đã gán nhưng kế toán tắt `ke_khai` | UI thông báo “Không kê khai” |
| `soThieuDetail` | hóa đơn bán ra chưa tải chi tiết | UI cảnh báo chỉ tiêu theo thuế suất có thể thiếu |

Không chuyển `docHoaDonCuaKy` vào `domain`: hàm này biết tên bảng và thực hiện I/O.

### Pha C — số chuyển kỳ `[22]`

```ts
export async function layCt22KyTruoc(db: PrismaClient, ky: Ky): Promise<Ct22KyTruoc | null> {
  const truoc = kyLienTruoc(ky);
  const ban = await db.tokhai_gtgt01.findUnique(/* kỳ liền trước cùng loại */);
  if (ban) return { gia: Number(ban.ct43), daChot: ban.trang_thai === "chot", ky: truoc };

  // nếu đổi tháng/quý: chọn bản có mốc kết thúc gần nhất trước kỳ hiện tại
}
```

Quy tắc:

1. Bình thường `[22] kỳ này = [43] kỳ trước`.
2. Bản kỳ trước còn nháp vẫn được lấy vì tránh bắt người dùng gõ lại số máy đã có.
3. Khi nguồn còn nháp, response trả `nguonCt22 = "ky_truoc_nhap"`; UI phải nói rõ số có thể đổi.
4. Không tìm thấy kỳ trước thì `nguonCt22 = "nhap_tay"`; người dùng tự nhập `[22]`.

### Pha D — gộp hóa đơn

```ts
const banRa = gomBanRa(ban.rows);
const muaVao = gomMuaVao(mua.rows);
```

#### `domain/gomHoaDonGtgt.ts` — dữ liệu đầu vào

```ts
export interface HoaDonGom {
  id: string;
  tthai: string | null;
  dvtte: string | null;
  tgia: unknown;
  tgtcthue: unknown;
  tgtthue: unknown;
  detail: unknown;
}
```

`unknown` ở tiền và `detail` là chủ ý. Prisma Decimal và JSON từ GDT không được đẩy thẳng vào công thức. File này tự chuyển đổi bằng helper `so`, kiểm tra số hữu hạn, quy đổi ngoại tệ và đưa về số VND nguyên.

```ts
export function gomBanRa(rows: HoaDonGom[]): KetQuaBanRa
export function gomMuaVao(rows: HoaDonGom[]): KetQuaMuaVao
```

`gomBanRa` trả:

- `tong`: số nguồn cho `[26]`, `[29]`, `[30]`, `[31]`, `[32]`, `[32a]`, `[33]`.
- `theoNhan`: nhóm theo từng nhãn `8%`, `10%`, `5%`, `KCT` để phụ lục còn phân biệt 8% với 10%.
- `treo`: hóa đơn không thể xếp thuế suất một cách tin cậy; không cộng bừa.
- `biLoai`: hóa đơn đã thay thế/hủy, bị luật loại khỏi tờ khai.
- `dieuChinh`: hóa đơn điều chỉnh vẫn cộng vào số nhưng được tách để UI nhắc kiểm tra dấu.

`gomMuaVao` chỉ cần `[23]`/`[24]`; hóa đơn mua vào không có `detail` vẫn được cộng tổng. Đây là lý do không được tái dùng nhánh bán ra cho mua vào.

#### Các helper dễ gây lỗi trong file gộp

```ts
function chuanHoaNhan(raw: unknown): string
function suyMucThueSuat(nhom: NhomTien[], tgtcthue: number): { suat; tien }[] | null
export function vaNhomNhanBan(nhom: NhomTien[], tgtcthue: number): NhomTien[]
```

- `chuanHoaNhan` biến `10`, `10%`, `KHAC:08.00%` thành một dạng để mapping.
- `suyMucThueSuat` chỉ suy khi lời giải là duy nhất. Hai lời giải hoặc không có lời giải đều là dữ liệu không đủ tin cậy.
- `vaNhomNhanBan` xử lý trường hợp GDT lặp `thtien` tổng hóa đơn ở mọi nhóm. Nếu bỏ hàm này, doanh thu nhiều thuế suất có thể bị cộng hai lần.

### Pha E — công thức chỉ tiêu

```ts
const ctMay = tinhGtgt01({ banRa: banRa.tong, muaVao, nhapTay: {} });
const ct = tinhGtgt01({ banRa: banRa.tong, muaVao, nhapTay });
```

#### `domain/tinhGtgt01.ts`

```ts
const ct25 = dv.nhapTay.ct25 == null ? ct24 : Number(dv.nhapTay.ct25);
const ct27 = ct29 + ct30 + ct32 + ct32a;
const ct28 = ct31 + ct33;
const ct34 = ct26 + ct27;
const ct35 = ct28;
const ct36 = ct35 - ct25;

const hieu = ct36 - ct22 + ct37 - ct38 - ct39a;
const ct40a = hieu >= 0 ? hieu : 0;
const ct41 = hieu < 0 ? -hieu : 0;
const ct40 = ct40a - ct40b;
const ct43 = ct41 - ct42;
```

Tại sao `ct25 == null` thay vì `!ct25`? Giá trị `0` nghĩa là kế toán cố ý nói “không được khấu trừ đồng nào”. Dùng `||` sẽ nuốt ý định này và trả lại `[24]`.

Tại sao tính hai bản?

| Bản | Mục đích |
| --- | --- |
| `ctMay` | số mà máy thuần tính từ hóa đơn; dùng để giải thích/đối soát |
| `ct` | số cuối sau quyết định kế toán; dùng để hiển thị, lưu và xuất XML |

Không viết lại công thức này ở frontend, Excel hoặc XML. Mọi chỗ đó chỉ đọc `ct` server trả về.

### Pha F — phụ lục 204/2025 và cảnh báo

```ts
const phuLucMoi = dungPhuLuc204(banRa, muaVao);
const canhBao = soatToKhai({
  ct,
  ctMay,
  soHdBan: banRa.soHd,
  giamThue10: phuLucMoi.banRa.thueDuocGiam,
  // bằng chứng hóa đơn thay thế và độ phủ đồng bộ
});
```

#### `domain/phuLuc204.ts`

```ts
export function dungPhuLuc204(banRa: KetQuaBanRa, muaVao: KetQuaMuaVao): PhuLuc204 {
  const nhomBan = banRa.theoNhan["8%"];
  const mua = gopMuaVao8(muaVao.theoNhan);
  const thueDuocGiam = lamTronDong((giaTriBan * (10 - 8)) / 100);
  return { muaVao, banRa, chenhLech, rong: !nhomBan };
}
```

- Phụ lục chỉ phải nộp khi có bán ra 8%, nên `rong: !nhomBan`.
- Mô tả hàng hóa là dữ liệu kế toán được phép sửa; số tiền phụ lục không được sửa trực tiếp.
- `catMoTa` cắt mô tả về 75 ký tự để XML/HTKK không sai mẫu.

#### `domain/soatToKhai.ts`

```ts
export function soatToKhai(dv: DauVaoSoat): string[] {
  // [31]/[33] so với công thức kiểm HTKK
  // [22] lấy từ kỳ khác loại hoặc kỳ chưa phủ dữ liệu
  // hóa đơn hủy/thay thế và tờ thay thế bị hụt tiền
  return canhBao;
}
```

File này không sửa số. Nó chỉ nói ra các trường hợp hệ thống không thể chắc chắn rằng số đúng:

1. `[31]`/`[33]` lệch công thức HTKK quá sai số làm tròn theo số hóa đơn.
2. `[22]` lấy từ bản nháp hoặc từ một kỳ đồng bộ thiếu hóa đơn.
3. Hóa đơn bị hủy/thay thế bị loại khỏi số kê khai.
4. Hóa đơn thay thế có tổng nhỏ hơn hóa đơn gốc, có thể sót hàng.
5. Kỳ hiện tại chưa được đồng bộ đủ.

`infrastructure/soatToKhai.repository.ts` chỉ cung cấp bằng chứng SQL:

```ts
export async function layThayTheHut(
  db: PrismaClient,
  ky: Ky,
  chieu: Chieu,
): Promise<ThayTheHut[]>
```

Nó không tự tạo câu cảnh báo. Chia như vậy giúp test lời cảnh báo mà không cần PostgreSQL.

#### `infrastructure/phuKy.ts`

```ts
export async function docLogDongBo(db: PrismaClient): Promise<DongBoRef[]>
export function phuKyTuLog(logs: DongBoRef[], ky: Ky): KetQuaPhuKy
export async function kiemTraPhuKy(db: PrismaClient, ky: Ky): Promise<KetQuaPhuKy>
```

`docLogDongBo` là I/O. `phuKyTuLog` là logic thuần kiểm tra một lượt đồng bộ có phủ trọn một kỳ hay không. `tinhVaLuu` đọc log một lần rồi dùng lại cho kỳ đang tính và kỳ nguồn `[22]`; không query log hai lần không cần thiết.

### Pha G — lưu và trả response

```ts
const luu = await db.tokhai_gtgt01.upsert({
  where: { nam_ky_loai_ky_so: { nam: ky.nam, ky_loai: ky.kyLoai, ky_so: ky.kySo } },
  create: { /* khóa kỳ, trạng thái nháp, ghi_de và toàn bộ dữ liệu kết quả */ },
  update: duLieu,
});
```

`duLieu` chỉ gồm output của lượt tính: `ct`, `ct_may`, chỉ tiêu bóc cột, phụ lục, cảnh báo và thời điểm tính. Nó cố tình không ghi đè `ghi_de` hay `trang_thai` trong nhánh update:

- Không xóa ghi đè do kế toán vừa lưu song song.
- Không biến bản vừa được chốt thành nháp chỉ vì một lượt tính khác đang chạy.

Các use-case còn lại trong cùng file:

| Hàm | Vai trò | Gọi lại calculator? |
| --- | --- | --- |
| `docBan` | đọc bản đã lưu, làm sạch JSON cũ | Không |
| `luuGhiDe` | lưu ghi đè hợp lệ | Có, gọi `tinhVaLuu` |
| `luuTenHangPhuLuc` | chỉ đổi mô tả hàng hóa phụ lục | Không |
| `doiTrangThai` | chốt hoặc mở khóa | Không |
| `danhSachKy` | trả danh sách kỳ đã lập | Không |

## 5. Luồng 3 — đọc bảng kê trên frontend

```text
ToKhaiInvoiceTabs
  ├─ đọc ky từ query string
  ├─ render tab purchase/sold/to-khai
  └─ mỗi tab bảng kê → BangKeMotChieu
        ├─ useBangKeQuery
        ├─ toDisplayRow
        ├─ buildReplacedByMap
        ├─ tongCotSo
        └─ InvoicePagination
```

### `components/ToKhaiInvoiceTabs.tsx`

```tsx
const ky = useMemo(() => kyTuQuery(searchParams), [searchParams]);
const laToKhai = tab === "to-khai";
const banToKhai = useBanToKhaiQuery(ky, laToKhai);

<BangKeMotChieu ky={ky} direction="purchase" active={tab === "purchase"} />
<BangKeMotChieu ky={ky} direction="sold" active={tab === "sold"} />
```

Trách nhiệm của file này chỉ là:

- Giữ kỳ trong URL, nên F5, bookmark và điều hướng từ màn hóa đơn điện tử không mất kỳ.
- Chuyển tab và chọn tab nào được phép gọi API.
- Tải `BanToKhai` khi tab tờ khai mở.

Nó không có logic chuyển hóa đơn thành dòng bảng, không có pagination và không tự đoán câu lỗi theo text; API error code `chua_co_ban` được nhận diện rõ ràng.

### `components/bang_ke/BangKeMotChieu.tsx`

```tsx
const bangKe = useBangKeQuery(ky, direction, active);
const replacedBy = useMemo(
  () => buildReplacedByMap(bangKe.data?.thayThe ?? []),
  [bangKe.data],
);

const rows = useMemo(() => {
  return (bangKe.data?.datas ?? []).map((row) => ({
    ...toDisplayRow(row, direction, replacedBy),
    chieu: direction,
    keKhai: row.keKhai,
    chiTieuTangGiam: row.chiTieuTangGiam,
  }));
}, [bangKe.data, direction, replacedBy, ky]);
```

- `replacedBy` làm rõ “hóa đơn này bị tờ nào thay thế/điều chỉnh”, vì bản thân hóa đơn gốc không luôn mang liên kết ngược.
- Tổng được tính trên **toàn bộ** `rows`, không chỉ trang hiện tại.
- `clampPage` tránh kẹt ở trang trống sau khi người dùng đổi kỳ và số hóa đơn giảm.
- `active = false` giữ component mounted để giữ state phân trang, nhưng không fetch tab đang ẩn.

## 6. Luồng 4 — nhập tay, chốt, Excel và XML

### `components/ToKhaiGtgt01Editor.tsx`

```tsx
const tinh = useTinhToKhai();
const luu = useLuuGhiDe();
const doiTrangThai = useDoiTrangThai();

luu.mutate({ ky, ghiDe: gom.ghiDe });
```

Component được phép giữ `nhap: Record<string, string>` để trải nghiệm gõ số không bị nhảy con trỏ. Nhưng component không có công thức `[22]`–`[43]`.

Khi người dùng rời một ô hoặc bấm lưu:

1. `docSoTien` đọc chuỗi theo định dạng Việt Nam.
2. Chuỗi trống xóa ghi đè, khác với số `0`.
3. Giá trị lỗi không gửi partial payload để tránh mất dữ liệu ô khác.
4. `useLuuGhiDe` gửi toàn bộ `ghiDe` tới server.
5. Server gọi `luuGhiDe` → `tinhVaLuu` và trả bản chỉ tiêu mới.

### `serialization/xuatXmlGtgt01.ts`

```ts
export function dungXmlGtgt01(dv: DauVaoXmlGtgt01): string {
  const phuLuc = khoiPhuLuc(dv.phuLuc);
  return `<?xml version="1.0" encoding="UTF-8"?> ... ${phuLuc}`;
}
```

Các helper phải hiểu rõ trước khi sửa:

| Hàm | Việc làm | Lý do |
| --- | --- | --- |
| `thoat` | escape XML và bỏ ký tự điều khiển không hợp lệ | tránh XML không parse được |
| `tien` | lấy chỉ tiêu, mặc định 0, làm tròn đồng | HTKK cần thẻ số đầy đủ |
| `kieuKy` | tháng `M` hoặc quý `Q` | đúng schema HTKK |
| `khoiPhuLuc` | chỉ thêm phụ lục khi có dữ liệu 8% | không tạo phụ lục rỗng |
| `tenFileXml` | tên file theo kỳ và MST | thuận tiện khi nạp HTKK |

Exporter nhận `ct` đã tính. Nếu cần một chỉ tiêu mới trong XML, thêm tag đọc từ `ct`; không query hóa đơn và không gọi `tinhGtgt01` tại đây.

## 7. Checklist trước khi sửa tính năng

### Thêm một chỉ tiêu hoặc đổi công thức

1. Viết/đổi test ở `tinhGtgt01.test.ts`.
2. Sửa `domain/tinhGtgt01.ts`.
3. Nếu dữ liệu đến từ hóa đơn, sửa mapping/gộp tại `domain/gomHoaDonGtgt.ts` và test dữ liệu GDT.
4. Cập nhật layout/API/XML nếu chỉ tiêu hiển thị hoặc xuất file.
5. Không thêm công thức vào React.

### Thêm một loại cảnh báo

1. Định nghĩa input có cấu trúc trong `DauVaoSoat`.
2. Nếu cần DB, đọc ở `infrastructure/`.
3. Viết quy tắc ở `domain/soatToKhai.ts`.
4. Ghép evidence vào `tinhVaLuu`.
5. Để UI render `ban.canhBao`, không tự tạo lại cảnh báo ở client.

### Sửa luật chọn hóa đơn vào kỳ

1. Bắt đầu bằng test `kyThayThe.test.ts`.
2. Sửa logic thuần tại `domain/kyThayThe.ts`.
3. Chỉ sửa truy vấn tại `application/keKhaiKy.service.ts` khi nguồn dữ liệu cần đổi.
4. Kiểm tra lại cả trường hợp hóa đơn lập trong kỳ/gốc ngoài kỳ và ngược lại.

## 8. Lệnh kiểm tra bắt buộc

Từ `be_maxv/`:

```powershell
npm run typecheck
npx tsx --test src/__tests__/gomHoaDonGtgt.test.ts src/__tests__/kySoThue.test.ts src/__tests__/kyThayThe.test.ts src/__tests__/tinhGtgt01.test.ts src/__tests__/phuLuc204.test.ts src/__tests__/soatToKhai.test.ts src/__tests__/xuatXmlGtgt01.test.ts
```

Từ `hdđt_maxv/`:

```powershell
npm run lint
npm run build
```

Nếu thay đổi đụng `tokhai_ky_hoa_don`, luôn chạy thêm `quyetDinhKeKhai.test.ts` và kiểm tra thủ công: gán kỳ lại có giữ đúng lựa chọn Kê khai/Không kê khai hay không.
