# Giải thích code — Bộ tải VININVOICE + gom chung nền tảng với My Software

> Phạm vi: **diff đang chưa commit** tại thời điểm viết (sau commit `bcbdc0c`). Tài liệu giải thích
> từng đoạn code mới, vì sao lại làm vậy, và đặc biệt là **hằng `SECTIGO_CA_DV_R36` sinh ra từ đâu**
> cùng **lý do phải cài `undici`**.
>
> Ngày: 2026-08-10.

---

## 0. Tóm tắt thay đổi

| File | Loại | Nội dung |
|---|---|---|
| [`iam_entry.ts`](../../../be_maxv/src/services/client/hddt/traCuuGoc/iam_entry.ts) | **mới** | Hàm tạo bộ tải cho nền tảng `iam-entry` — dùng chung VININVOICE + My Software |
| [`vin_invoice.ts`](../../../be_maxv/src/services/client/hddt/traCuuGoc/vin_invoice.ts) | **mới** | Khai báo NCC VININVOICE + chứng chỉ CA phải tự vá |
| [`ms_invoice.ts`](../../../be_maxv/src/services/client/hddt/traCuuGoc/ms_invoice.ts) | sửa | Viết lại theo hàm tạo chung: **81 dòng → 17 dòng** |
| [`shared.ts`](../../../be_maxv/src/services/client/hddt/traCuuGoc/shared.ts) | sửa | Thêm `dispatcherThemCa` + kiểu `UpstreamInit` |
| [`index.ts`](../../../be_maxv/src/services/client/hddt/traCuuGoc/index.ts) | sửa | Đăng ký `vinInvoice` vào `REGISTRY` |
| [`traCuuNcc.ts`](../../src/features/hddt/traCuuNcc.ts) | sửa | Cập nhật chú thích: VININVOICE không còn là "chỉ tra cứu tay" |
| `package.json` | sửa | Thêm dependency `undici` |

---

## 1. Phát hiện nền tảng: VININVOICE = My Software

Điểm khởi đầu là URL trong curl:

```
https://tracuu.vininvoice.vn/erp/rest/s1/iam-entry/invoices/<mã>/pdf?v=0
```

Đường dẫn `/erp/rest/s1/iam-entry/invoices/...` **trùng khít** với thứ `ms_invoice.ts` (My Software)
đang gọi ở `https://tracuu.myinvoice.vn`. Đây là cùng một phần mềm tra cứu (Moqui ERP), hai công ty
triển khai hai tên miền.

Đã đối chiếu thực tế trên **cả hai cổng**:

| | VININVOICE | My Software |
|---|---|---|
| `GET .../<mã>/pdf` mã đúng | `200 application/pdf` | (không có mã thật để thử) |
| `GET .../<mã>/pdf` mã sai | `400` + JSON | `400` + JSON |
| `GET .../<mã>/header-info` mã sai | `400` + JSON | `400` + JSON |

Thân JSON lỗi giống hệt nhau về hình dạng:

```json
{ "errorCode": 400, "errors": "Không tìm thấy hóa đơn hoặc hóa đơn đã bị xóa\n" }
```

Vì giống nhau tới mức đó nên **không chép file thứ hai**, mà tách phần chung ra một hàm tạo. Nếu chép,
mọi lần cổng đổi API sẽ phải sửa hai nơi — đúng loại lặp mà đợt `/simplify` trước đã dọn trong chính
thư mục này.

---

## 2. `iam_entry.ts` — hàm tạo bộ tải dùng chung

### 2.1. Ý tưởng

Mỗi NCC chỉ còn khai **3 giá trị**; toàn bộ luồng nằm trong hàm tạo:

```ts
export function taoBoTaiIamEntry(opts: {
  mst: string;        // MST NCC phát hành — khóa dispatcher
  ten: string;        // tên hiển thị trong thông báo lỗi
  origin: string;     // https://tracuu.vininvoice.vn
  caBoSung?: string;  // PEM của CA phải tự vá (xem mục 4)
}): ProviderDownloader
```

Đường dẫn REST là hằng dùng chung, phần khác nhau chỉ là origin đứng trước:

```ts
const REST_PATH = "/erp/rest/s1/iam-entry/invoices";
```

### 2.2. Luồng: đúng MỘT request

```
GET <origin>/erp/rest/s1/iam-entry/invoices/<mã tra cứu>/pdf   ->   bytes PDF
```

Không captcha, không cookie, không token. Mã tra cứu đi thẳng vào path.

### 2.3. Hai thứ trong curl bị bỏ — đều đã đo

**Bỏ `?v=0`.** Gọi có và không có tham số này cho ra file **byte-for-byte giống nhau** (329.787 byte).
Nó là tham số chống cache của trang web, không mang nghĩa nghiệp vụ.

**Bỏ bước kiểm `/header-info`.** Bản `ms_invoice.ts` cũ gọi `/header-info` trước để kiểm tra hóa đơn có
tồn tại không, rồi mới gọi `/pdf`:

```ts
// ms_invoice.ts — BẢN CŨ
async download({ code }) {
  await assertInvoiceExists(code);   // request #1: /header-info
  const res = await fetchUpstream(`${MS_INVOICE_BASE}//iam-entry/invoices/${code}/pdf`, …);  // #2
  …
}
```

Nhưng `/pdf` **tự** báo mã sai bằng `400` + JSON (đã kiểm trên cả hai cổng), nên bước kiểm kia chỉ nhân
đôi số request lên cổng NCC mà không thêm thông tin gì. Một lượt "Tải hóa đơn gốc" là hàng chục hóa đơn,
nên bỏ đi cũng làm My Software **nhanh gấp đôi**.

> Ghi chú: bản cũ còn có `//iam-entry` (hai dấu gạch chéo) — server bỏ qua nên vẫn chạy, bản mới sửa lại
> thành một dấu.

### 2.4. Phân loại lỗi

```ts
if (!res.ok) {
  const loi = rutLoi(await res.text().catch(() => ""));
  if (res.status < 500) {
    // 4xx = cổng đã xét mã và từ chối -> DỨT KHOÁT, thử lại vô ích
    throw new TraCuuGocError("INVALID_CODE", loi ? `${ten}: ${loi}` : `Không tìm thấy hóa đơn gốc …`);
  }
  // 5xx = sự cố cổng -> đáng để FE quét lại
  throw new TraCuuGocError("UPSTREAM", `… (HTTP ${res.status})`, true);
}
```

`rutLoi` bóc trường `errors` trong JSON. Câu đó **đã là tiếng Việt sẵn sàng cho kế toán đọc**, nên ném
kèm nguyên văn thay vì tự chế câu khác:

```
VININVOICE: Không tìm thấy hóa đơn hoặc hóa đơn đã bị xóa
```

(Bản `ms_invoice.ts` cũ vứt câu này đi và thay bằng chuỗi không dấu tự viết: `"My Software khong tim
thay hoa don cho ma ..."`.)

Cuối cùng, kiểm **magic bytes** thay vì tin `content-type`:

```ts
const file = await pdfFromResponse(res, code, ten);
if (!laPdf(file.buffer)) {
  throw new TraCuuGocError("UPSTREAM", `${ten} không trả file PDF cho mã "${code}" — thử lại`, true);
}
```

Mã sai đã bị `400` chặn ở trên, nên `200` mà không phải PDF nghĩa là cổng đang trục trặc → đáng thử lại,
và tuyệt đối không giao file rác cho kế toán dưới đuôi `.pdf`.

---

## 3. `vin_invoice.ts` và `ms_invoice.ts` — chỉ còn phần khai báo

```ts
// vin_invoice.ts
export const vinInvoice = taoBoTaiIamEntry({
  mst: "0109282176",
  ten: "VININVOICE",
  origin: "https://tracuu.vininvoice.vn",
  caBoSung: SECTIGO_CA_DV_R36,
});
```

```ts
// ms_invoice.ts
export const msInvoice = taoBoTaiIamEntry({
  mst: "0108971656",
  ten: "My Software",
  origin: "https://tracuu.myinvoice.vn",
});
```

`mst` khớp khóa trong registry FE [`TRA_CUU_NCC`](../../src/features/hddt/traCuuNcc.ts). Với VININVOICE,
FE rút mã tra cứu từ trường `mhdon` của payload chi tiết (`maTraCuu: { src: "field", field: "mhdon" }`) —
chuỗi hex 34 ký tự, ví dụ `00D802CFF350814D93BF0780C63C3A490A`.

Đăng ký vào dispatcher ở `index.ts` là xong; FE tự bật nút "Tải tự động" cho VININVOICE nhờ danh mục NCC
mà BE phục vụ qua `GET /gdt/tra-cuu-goc/nha-cung-cap`.

---

## 4. `SECTIGO_CA_DV_R36` — vá chuỗi chứng chỉ TLS

Đây là phần quan trọng nhất, vì **nếu thiếu nó thì 100% hóa đơn VININVOICE hỏng**, mà triệu chứng lại
không liên quan gì tới nguyên nhân.

### 4.1. Triệu chứng

Lần chạy thử đầu tiên bằng Node:

```
Không gọi được VININVOICE: TypeError: fetch failed
  <- Error: unable to verify the first certificate (UNABLE_TO_VERIFY_LEAF_SIGNATURE)
```

Trong khi **curl thì chạy được**. Đây chính là cái bẫy: curl chạy được **không chứng minh** Node chạy được.

### 4.2. Chẩn đoán — chuỗi chứng chỉ bị đứt

```bash
echo | openssl s_client -connect tracuu.vininvoice.vn:443 -servername tracuu.vininvoice.vn -showcerts
```

Bóc từng chứng chỉ trong chuỗi ra xem `subject` / `issuer`:

| # | Subject | Issuer |
|---|---|---|
| 0 (leaf) | `CN=*.vininvoice.vn` | **`Sectigo Public Server Authentication CA DV R36`** |
| 1 | `Sectigo RSA Domain Validation Secure Server CA` | `USERTrust RSA Certification Authority` |
| 2 | `USERTrust RSA Certification Authority` | (tự ký) |

Nhìn cột `Issuer` của dòng 0 rồi tìm nó ở cột `Subject` bên dưới: **không có**. Server gửi kèm một CA
Sectigo **khác** với CA đã ký cho chứng chỉ của chính nó. Chuỗi đứt ngay mắt xích đầu tiên.

Đây là **lỗi cấu hình phía VININVOICE**, không phải lỗi của mình.

### 4.3. Vì sao trình duyệt và curl không lộ lỗi này

```
curl 8.21.0 (x86_64-w64-mingw32) libcurl/8.21.0 Schannel …
```

curl trên Windows dùng **Schannel** — kho TLS của hệ điều hành. Schannel (và Chrome) tự đi tải CA còn
thiếu theo phần mở rộng **AIA** (Authority Information Access) ghi trong chứng chỉ leaf. Chúng vá lỗi
của VININVOICE giúp mình mà không nói gì.

**Node dùng OpenSSL và KHÔNG làm việc đó.** Nó chỉ xác minh bằng đúng những gì server gửi xuống cộng với
kho gốc bundled sẵn.

### 4.4. Nội dung hằng `SECTIGO_CA_DV_R36` sinh ra như thế nào

Không phải tự nghĩ ra hay chép từ đâu — nó tải từ **đúng URL mà chính chứng chỉ leaf khai báo**. Bốn bước:

**Bước 1 — đọc AIA của leaf để biết phải tải CA nào, ở đâu:**

```bash
openssl x509 -in cert-0.pem -noout -text | grep -A 3 "Authority Information Access"
```

```
Authority Information Access:
    CA Issuers - URI:http://crt.sectigo.com/SectigoPublicServerAuthenticationCADVR36.crt
    OCSP - URI:http://ocsp.sectigo.com
```

Dòng `CA Issuers` là địa chỉ chứng chỉ của **người đã ký leaf** — đúng mắt xích còn thiếu.

**Bước 2 — tải về và đổi từ DER sang PEM** (Sectigo phát hành dạng nhị phân DER; Node cần PEM base64):

```bash
curl -sS -o inter.crt 'http://crt.sectigo.com/SectigoPublicServerAuthenticationCADVR36.crt'
openssl x509 -inform DER -in inter.crt -out inter.pem
```

Nội dung `inter.pem` chính là chuỗi được dán vào hằng `SECTIGO_CA_DV_R36`.

**Bước 3 — kiểm chứng nó thật sự vá được chuỗi:**

```bash
openssl verify -untrusted inter.pem -untrusted cert-2.pem cert-0.pem
# cert-0.pem: OK
```

**Bước 4 — ghi lại danh tính để sau này đối chiếu:**

```bash
openssl x509 -in inter.pem -noout -subject -issuer -dates -fingerprint -sha256
```

```
subject : C=GB, O=Sectigo Limited, CN=Sectigo Public Server Authentication CA DV R36
issuer  : C=GB, O=Sectigo Limited, CN=Sectigo Public Server Authentication Root R46
hạn     : 2021-03-22 .. 2036-03-21
SHA-256 : 8C:54:C3:34:B6:6B:A4:E4:26:77:2A:F4:A3:F9:13:6C:19:A1:AE:C7:29:FD:B2:8C:53:5C:07:A5:A4:EF:22:E0
```

Cả bốn dòng này được chép vào docblock của hằng trong mã nguồn, để người sau kiểm lại được mà không phải
dò từ đầu.

> **Tải một chứng chỉ CA qua HTTP thường có an toàn không?** Có. Chứng chỉ **tự xác thực bằng chữ ký**:
> nó chỉ có tác dụng khi chuỗi được về một root đã tin sẵn. Ai đó tráo file trên đường truyền thì chứng
> chỉ giả sẽ không chuỗi về root nào và OpenSSL loại ngay — đúng điều bước 3 kiểm.

### 4.5. Vì sao nhúng thẳng vào `.ts` chứ không để file `.pem` rời

Vì lệnh build:

```json
"build": "tsc && npm run copy:generated",
"copy:generated": "node -e \"require('fs').cpSync('src/generated','dist/generated',{recursive:true})\""
```

`tsc` chỉ dịch `.ts`; bước copy chỉ chép `src/generated`. Một file `.pem` đặt trong `src` sẽ **không có
mặt trong `dist`** → chạy dev thì được, lên prod mới hỏng. Hằng chuỗi thì `tsc` mang theo, không thể quên.

### 4.6. Vẫn xác minh đầy đủ, không phải tắt kiểm tra

```ts
export function dispatcherThemCa(pem: string): Dispatcher {
  return new Agent({ connect: { ca: [...rootCertificates, pem] } });
}
```

- `rootCertificates` là **toàn bộ kho gốc mặc định của Node** — giữ nguyên, không thay thế.
- Chỉ **thêm** đúng một CA trung gian công khai, vốn đã chuỗi được về `Sectigo … Root R46` là root có
  sẵn trong kho đó. Nên đây không phải mở rộng vùng tin cậy một cách có ý nghĩa.

**Tuyệt đối không dùng `rejectUnauthorized: false`.** BE trả thẳng bytes hóa đơn về cho client, nên tắt
xác minh là mở đường cho người đứng giữa tráo nội dung hóa đơn.

### 4.7. Các phương án khác đã cân nhắc và loại

| Phương án | Kết quả đo | Vì sao loại |
|---|---|---|
| `node` mặc định, không vá | `FAIL UNABLE_TO_VERIFY_LEAF_SIGNATURE` | — |
| `node --use-openssl-ca` | `FAIL` | Không giúp gì |
| `node --use-system-ca` | `OK 200` | **Không đáng tin** — xem dưới |
| `NODE_EXTRA_CA_CERTS=<file.pem>` | `OK 200` | Vẫn cần đúng chứng chỉ đó, chỉ đổi chỗ ở; quên set lúc deploy là hỏng im lặng |
| Nhúng hằng + undici Agent | `OK 200` | **Đã chọn** — đi theo mã nguồn, không cần thao tác deploy |

Về `--use-system-ca`: nó chạy được trên máy dev, nhưng tra kho chứng chỉ Windows cho thấy lý do:

```
CA trung gian "Sectigo … CA DV R36" nằm ở:  -user CA   ✅  (kho của RIÊNG user đang đăng nhập)
                                             CA         ❌  (kho toàn máy)
```

Tức Windows đã **cache** CA đó vào kho riêng của tài khoản đang dùng, gần như chắc chắn do Chrome/curl
tải về qua AIA. Ở prod, BE chạy sau IIS dưới **tài khoản dịch vụ** — user khác, kho khác, máy chưa ai mở
trình duyệt vào `vininvoice.vn` bao giờ. Dựa vào nó là biến việc tải hóa đơn thành phụ thuộc lịch sử
duyệt web của tài khoản chạy service.

### 4.8. Khi nào xóa được hằng này

Khi VININVOICE sửa cấu hình server. Kiểm bằng:

```bash
echo | openssl s_client -connect tracuu.vininvoice.vn:443 -servername tracuu.vininvoice.vn 2>&1 | grep "Verify return code"
```

- `21 (unable to verify the first certificate)` → vẫn hỏng, **phải giữ** hằng.
- `0 (ok)` → xóa `SECTIGO_CA_DV_R36` và dòng `caBoSung` được ngay.

Giữ lại kể cả sau khi họ sửa cũng vô hại (chỉ là một CA công khai thừa).

---

## 5. Vì sao phải cài `undici`

### 5.1. Vấn đề

Node có sẵn `fetch` toàn cục, nhưng **`fetch` không có tham số nào để chỉ định CA**. Các cách khác đều
không dùng được:

- `https.Agent({ ca })` — chỉ áp cho module `https`, `fetch` không đọc.
- `tls.createSecureContext` — không có API gắn toàn cục.
- Biến môi trường — không đặt được từ trong code (Node đọc lúc khởi động tiến trình).

`fetch` của Node **chạy trên undici**, và nó nhận một tùy chọn không chuẩn tên `dispatcher`. Muốn tạo
được `dispatcher` thì cần class `Agent` — nằm trong gói `undici`.

### 5.2. Cách dùng

```ts
import { rootCertificates } from "node:tls";
import { Agent, type Dispatcher } from "undici";

export type UpstreamInit = RequestInit & { dispatcher?: Dispatcher };

export function dispatcherThemCa(pem: string): Dispatcher {
  return new Agent({ connect: { ca: [...rootCertificates, pem] } });
}
```

`UpstreamInit` cần thiết vì `dispatcher` **không có trong kiểu `RequestInit` chuẩn** — TypeScript sẽ báo
lỗi nếu không nới kiểu. `fetchUpstream` chỉ đổi kiểu tham số, phần thân giữ nguyên (nó vốn đã
`...init` xuống `fetch`).

`Agent` được dựng **một lần** lúc tạo bộ tải, không phải mỗi hóa đơn:

```ts
const dispatcher = caBoSung ? dispatcherThemCa(caBoSung) : undefined;
```

Vì `Agent` là **pool kết nối** — tạo lại theo từng request là vứt hết TLS session và bắt tay lại từ đầu
cho mỗi hóa đơn trong lô.

### 5.3. Vốn đã có sẵn, chỉ là chưa khai báo

`undici` đã nằm trong `node_modules` từ trước (là dependency gián tiếp). Dùng mà không khai trong
`package.json` gọi là **phantom dependency** — chạy được cho tới ngày gói kéo nó vào bị gỡ. Nên đã khai
tường minh:

```diff
   "tesseract.js": "^7.0.0",
+  "undici": "^7.29.0",
   "zod": "^3.24.1"
```

`npm ls undici` cho thấy chỉ một bản duy nhất, không trùng lặp.

> **Lưu ý về `npm audit`:** hiện báo 9 lỗ hổng (5 moderate, 4 high), **toàn bộ có sẵn từ trước** — đến từ
> `@hono/node-server` (qua `@prisma/dev`), `brace-expansion` (qua eslint), `fast-uri` và `find-my-way`
> (qua fastify). `undici` xuất hiện **0 lần** trong kết quả audit. Việc nâng các gói kia là quyết định
> riêng vì nó đụng tới fastify/prisma.

---

## 6. Kết quả kiểm chứng

### 6.1. Gọi thẳng `taiHoaDonGoc(...)` với cổng thật

Cả hai NCC đều đã thử **đường thành công bằng mã tra cứu thật**, và cả hai đều đi qua đúng một hàm
`taoBoTaiIamEntry`:

```
VIN mã đúng : OK    1C26TTP_00000044_2026-03-31.pdf, 329.787 byte, %PDF-1.4
MYS mã đúng : OK    1C26TLT_00000242_2026-05-26.pdf, 209.751 byte, %PDF-1.4
VIN mã sai  : THROW INVALID_CODE  "VININVOICE: Không tìm thấy hóa đơn hoặc hóa đơn đã bị xóa"
MYS mã sai  : THROW INVALID_CODE  "My Software: Không tìm thấy hóa đơn hoặc hóa đơn đã bị xóa"
```

Nhờ mã My Software thật, việc rút gọn `ms_invoice.ts` (81 dòng → 17 dòng, bỏ bước `/header-info`) đã
được xác nhận **không làm hỏng gì** — trước đó đây là lỗ hổng kiểm thử duy nhất của diff.

### 6.2. Vì sao chỉ VININVOICE cần `caBoSung`, My Software thì không

Chạy **cùng một request** bằng hai công cụ, với y hệt cookie/header lấy từ trình duyệt:

| | curl (Schannel của Windows) | Node `fetch` (không bổ sung CA) |
|---|---|---|
| **My Software** | 200 · 209.751 byte | **200 · 209.751 byte** ✅ |
| **VININVOICE** | 200 · 329.787 byte | **FAIL** `UNABLE_TO_VERIFY_LEAF_SIGNATURE` ❌ |

Hai curl trông giống hệt nhau, nhưng hai **server** thì không:

```
tracuu.myinvoice.vn   : leaf → Let's Encrypt YR1 → ISRG Root YR   → Verify return code: 0 (ok)
tracuu.vininvoice.vn  : leaf → (CA sai)          → USERTrust      → Verify return code: 21
```

My Software cấu hình chuỗi chứng chỉ **đúng** nên Node đi thẳng, không cần vá gì — và đúng như vậy,
`ms_invoice.ts` **không truyền `caBoSung`**. Chỉ `vin_invoice.ts` truyền. Đây là lý do `caBoSung` được
thiết kế thành tham số **tùy chọn** của `taoBoTaiIamEntry` thay vì bật cứng cho cả nền tảng.

> Bài học rút ra: **curl chạy được không chứng minh Node chạy được.** Sự tồn tại của hai curl giống
> nhau cũng không chứng minh hai cổng giống nhau về TLS.

### 6.3. Danh mục NCC

Danh mục NCC mà BE phục vụ cho FE, sau khi đăng ký, có **8 NCC**:

```
0101243150 | MISA        | https://www.meinvoice.vn/tra-cuu/
0100109106 | Viettel     | https://vinvoice.viettel.vn/utilities/invoice-search
0100684378 | VNPT        | https://{mst}-tt78.vnpt-invoice.com.vn/
0108971656 | My Software | https://tracuu.myinvoice.vn/#/
0105232093 | CyberLotus  | https://tracuuhoadon1.xcyber.vn/#/tracuuhoadon/tracuu
0105987432 | EasyInvoice | https://{mst}hd.easyinvoice.com.vn/Search/Index
0107500414 | VETC        | https://tracuuhoadon.vetc.com.vn/
0109282176 | VININVOICE  | https://tracuu.vininvoice.vn/#/
```

### 6.4. Kiểm tra tĩnh

`tsc` và `eslint` sạch ở cả BE lẫn FE.

### 6.5. Đối chiếu nguồn gốc chứng chỉ

Tải lại chứng chỉ từ Sectigo rồi so với hằng đang nằm trong mã nguồn:

```
A. PEM nhúng trong vin_invoice.ts   SHA-256 = 8C:54:C3:34:…:22:E0
B. Tải mới từ crt.sectigo.com       SHA-256 = 8C:54:C3:34:…:22:E0
So sánh nhị phân (DER)              ✅ giống nhau từng byte (1.616 byte)
openssl verify sectigo.pem          OK  (chuỗi được về root công khai R46)
```

Bất kỳ ai nghi ngờ nguồn gốc hằng này đều dựng lại được phép so trên bằng 4 lệnh ở §4.4.

---

## 7. Trạng thái hiện tại của mã nguồn

[`vin_invoice.ts`](../../../be_maxv/src/services/client/hddt/traCuuGoc/vin_invoice.ts) đang **bật**
`caBoSung`, tức VININVOICE hoạt động bình thường:

```ts
export const vinInvoice = taoBoTaiIamEntry({
  mst: "0109282176",
  ten: "VININVOICE",
  origin: "https://tracuu.vininvoice.vn",
  caBoSung: SECTIGO_CA_DV_R36,
});
```

### ⚠️ Nếu tắt dòng `caBoSung` đi thì sao

Đã đo trạng thái đó: **mọi hóa đơn VININVOICE đều hỏng**, tất định, trên mọi máy.

```
THROW UPSTREAM "Không gọi được VININVOICE: … UNABLE_TO_VERIFY_LEAF_SIGNATURE"
```

Hệ quả lan tới giao diện: lỗi map thành HTTP 502 → `laLoiTamThoi` bên FE coi 5xx là lỗi tạm thời →
dialog quét lại thêm 2 lượt → mỗi hóa đơn bị gọi **3 lần**, tất cả rơi vào nhóm "Lỗi" với một dòng
tiếng Anh không gợi ý gì về nguyên nhân thật. `eslint` cũng cảnh báo `'SECTIGO_CA_DV_R36' is assigned
a value but never used`.

Comment dòng đó lại **không làm vấn đề biến mất** — chứng chỉ vẫn phải tồn tại ở đâu đó (xem bảng
phương án §4.7). Chỉ có một cách xóa hẳn: VININVOICE sửa cấu hình server, kiểm bằng lệnh ở §4.8.
