# Giải thích code — Tải hóa đơn gốc: mở rộng từ MISA sang Viettel

> Tài liệu này giải thích **thay đổi của tính năng "Tải hóa đơn gốc"** (2 commit Viettel): vì sao làm như
> vậy và mỗi thay đổi có tác dụng gì. Ngày: 2026-08-05.
>
> **Cập nhật (đợt `/simplify`):** đã dọn code chết — bỏ toàn bộ input `recaptcha` (không caller nào dùng,
> BE tự giải captcha), cho `solveCaptcha` dùng lại helper `fetchUpstream`, và dọn tên sót sau khi đổi tên
> file `vttel.ts → vinvoice_viettel.ts`. Doc này mô tả trạng thái **sau khi dọn**.

---

## 1. Bối cảnh & mục tiêu

Tính năng **"Tải hóa đơn gốc"** cho phép tải file PDF gốc của hóa đơn trực tiếp từ **trang tra cứu của
NCC phát hành HĐĐT** (MISA, Viettel…). Trình duyệt không gọi thẳng cổng NCC được (không có CORS + có NCC
cần header/token đặc biệt), nên đi **qua BE proxy**.

Trước diff này, hệ thống **chỉ tải được MISA**. Diff này làm 3 việc:

1. **Tổng quát hóa kiến trúc "provider"** ở BE: đổi hợp đồng dữ liệu từ "chỉ có `code`" sang một object
   `DownloadRequest` để NCC nào cần thêm dữ liệu (MST người bán) thì có chỗ chứa — mà **không phá vỡ** các
   NCC cũ. (Captcha của Viettel do **BE tự giải bên trong provider**, không phải một input của hợp đồng.)
2. **Thêm bộ tải Viettel** — NCC này chặn tải bằng **captcha "kéo mảnh ghép"**. Vì captcha do chính hệ
   thống Viettel phát hành và `generate` trả sẵn vị trí đúng (`offsetX`), nên **BE tự giải được** không
   cần người dùng thao tác.
3. **Bật FE** để dialog tải Viettel **giống hệt MISA**: bật cờ `taiTuDong`, truyền thêm `sellerMst`, và
   mở lại nút "Tải hóa đơn gốc".

Kết quả: người dùng thao tác **y như MISA** — mở dialog → tick NCC → chọn thư mục → *Tải xuống*. Không có
bước captcha nào lộ ra ngoài.

---

## 2. Luồng dữ liệu tổng thể

```
[DownloadOriginalDialog.tsx]   ← người dùng bấm "Tải xuống"
        │  gọi từng hóa đơn
        ▼
[api/traCuuGoc.ts] taiHoaDonGoc({ msttcgp, code, sellerMst? })
        │  GET /gdt/tra-cuu-goc?msttcgp=&code=&sellerMst=
        ▼
[traCuuGoc.controller.ts] downloadOriginalInvoice()   ← đọc query
        │  taiHoaDonGoc(msttcgp, { code, sellerMst })
        ▼
[traCuuGoc/index.ts] dispatcher   ← chọn provider theo msttcgp (MST NCC phát hành)
        │
        ├── msttcgp = "0101243150" → [misa.ts]              (GET, không captcha)
        └── msttcgp = "0100109106" → [vinvoice_viettel.ts]  (POST, BE tự giải captcha)
                                        │
                                        ▼
                              [shared.ts] fetchUpstream / pdfFromResponse
                                        │
                                        ▼
                                   Cổng NCC (PDF bytes)
```

Điểm mấu chốt của kiến trúc: **thêm 1 NCC = viết 1 file provider + đăng ký 1 dòng ở `index.ts`**. Không
đụng controller, không đụng FE (trừ bật cờ hiển thị).

---

## 3. Thay đổi BACKEND (`be_maxv`)

### 3.1 `traCuuGoc/types.ts` — hợp đồng dữ liệu mới `DownloadRequest`

**Trước:** provider tải theo mã tra cứu đơn thuần:
```ts
download(code: string): Promise<FileHoaDonGoc>;
```

**Sau:** thêm interface `DownloadRequest` và đổi chữ ký:
```ts
export interface DownloadRequest {
  code: string;         // mã tra cứu (MISA = TransactionID; Viettel = reservationCode)
  sellerMst?: string;   // MST người bán (nbmst) — Viettel cần cho supplierTaxCode/taxCode
}
download(req: DownloadRequest): Promise<FileHoaDonGoc>;
```

**Vì sao:** MISA chỉ cần `code`, nhưng Viettel cần thêm **MST người bán**. Nếu cứ nhồi thêm tham số kiểu
`download(code, sellerMst)` thì mỗi lần thêm NCC mới lại phải sửa chữ ký ở mọi nơi. Gói vào **một object có
field optional** cho phép mở rộng mà **không ảnh hưởng** NCC cũ (chúng chỉ đọc field chúng cần). Captcha
của Viettel **không nằm trong hợp đồng này** vì BE tự giải bên trong provider.

**Tác dụng:** mọi provider dùng chung 1 interface ổn định; thêm dữ liệu cho NCC mới = thêm 1 field
optional, không phá vỡ cái đang chạy.

---

### 3.2 `traCuuGoc/shared.ts` — tách `fetchUpstream` + `pdfFromResponse` (refactor DRY)

Đây là thay đổi lớn nhất về dòng code, nhưng **thuần refactor** (gom code lặp), mở đường cho Viettel.

**Vấn đề trước đó:** hai hàm `mintTokenForm` (lấy token) và `fetchFileGoc` (tải file) mỗi hàm **tự viết
lại** cùng một khối: `try { fetch(..., { user-agent, timeout }) } catch { → UPSTREAM }`. Và `fetchFileGoc`
**chỉ hỗ trợ GET** — trong khi Viettel tải bằng **POST**.

**Đã tách thành 2 helper dùng chung:**

- **`fetchUpstream(url, init, ten)`** — gói *fetch + timeout 30s + gắn User-Agent trình duyệt + bọc lỗi
  mạng/timeout thành `UPSTREAM`* vào một chỗ. `describeErrorChain` được dùng vì undici (fetch của Node)
  hay giấu lý do thật ở `err.cause`.
  ```ts
  export async function fetchUpstream(url, init, ten): Promise<Response> {
    try {
      return await fetch(url, {
        ...init,
        headers: { "user-agent": BROWSER_UA, ...init.headers }, // ghi đè được
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new TraCuuGocError("UPSTREAM", `Không gọi được ${ten}: ${describeErrorChain(err)}`);
    }
  }
  ```

- **`pdfFromResponse(res, code, ten)`** — tách riêng phần *đọc body PDF*: nếu body **rỗng (0 byte)** thì
  coi là `INVALID_CODE` (nhiều cổng NCC vẫn trả HTTP 200 khi mã sai), lấy tên file từ
  `Content-Disposition`, thiếu thì dùng `<code>.pdf`.

**Vì sao tách `pdfFromResponse` khỏi `fetchFileGoc`:** MISA tự lo phần fetch bằng **GET**, Viettel tự lo
bằng **POST** — nhưng **phần đọc/kiểm tra PDF sau khi có `Response` thì giống nhau**. Tách ra để cả hai
tái dùng: `fetchFileGoc` (GET, cho MISA) giờ chỉ còn gọi `fetchUpstream` rồi `pdfFromResponse`; Viettel
tự POST bằng `fetchUpstream` rồi cũng gọi `pdfFromResponse`. Cả `solveCaptcha` (generate/verify) cũng đi
qua `fetchUpstream` — nên toàn bộ request tới cổng NCC dùng chung 1 timeout + UA + cách bọc lỗi.

**Tác dụng:** provider Viettel rất ngắn, không lặp lại boilerplate; xử lý timeout/lỗi/body-rỗng **nhất
quán** cho mọi NCC. `filenameFromDisposition` cũng đổi ví dụ comment từ `inline;` → `attachment;` cho sát
thực tế (không đổi logic).

---

### 3.3 `traCuuGoc/misa.ts` — cập nhật chữ ký cho khớp interface mới

Chỉ đổi **1 dòng**: `async download(code)` → `async download({ code })`. MISA giờ nhận object
`DownloadRequest` và chỉ **hủy cấu trúc lấy `code`** (bỏ qua `sellerMst`). Logic tải MISA **không đổi**.

**Tác dụng:** MISA tiếp tục chạy như cũ trong khi vẫn khớp interface chung.

---

### 3.4 `traCuuGoc/vinvoice_viettel.ts` — **FILE MỚI**: bộ tải Viettel + tự giải captcha

Đây là phần cốt lõi. File chia 2 nửa:

#### (a) `solveCaptcha()` — tự giải captcha "kéo mảnh ghép"

Captcha Viettel là **tự-phát-hành** (backend jhipster, `/api/captcha/*`). Điểm quan trọng: API
`generate` **trả sẵn `offsetX`** = vị trí đúng của mảnh ghép. Nên **không cần xử lý ảnh** — chỉ đọc
`offsetX` rồi POST lên `verify` để lấy token đã-xác-thực.

```
1) GET  .../api/captcha/generate → { token, offsetX }
2) POST .../api/captcha/verify   body { token, offsetX } → { success, token: <recaptcha mới> }
```

- Cả 2 request đi qua **`fetchUpstream`** (dùng chung timeout + UA + bọc lỗi `UPSTREAM`) — không tự viết
  `fetch`/timeout/try-catch nữa.
- **Jitter ±1px**: `offsetX + (random(-1..1))` cho giống thao tác tay người (server chấp nhận sai số).
- **Lưu ý token**: token trả về từ `verify` là **token MỚI** (đã xác thực), *khác* token của `generate` —
  đây mới là cái gửi làm field `recaptcha` trong body tới Viettel để tải file.

#### (b) `viettel.download()` — provider tải PDF

```ts
async download({ code, sellerMst }) {
  if (!sellerMst) throw new TraCuuGocError("INVALID_CODE", "Thiếu MST người bán…");

  // BE TỰ GIẢI CAPTCHA — người dùng không thao tác.
  const token = await solveCaptcha();

  const res = await fetchUpstream(
    `${DOWNLOAD_PDF}?taxCode=${sellerMst}`,
    { method: "POST", headers: { origin, referer, ... },
      body: JSON.stringify({ supplierTaxCode: sellerMst, reservationCode: code, recaptcha: token }) },
    "Viettel",
  );

  // Lỗi nghiệp vụ trả JSON (vd 400 INVOICE_NOT_FOUND); PDF trả octet-stream.
  if (contentType.includes("application/json")) throw INVALID_CODE(body.message);
  if (!res.ok) throw UPSTREAM;
  return pdfFromResponse(res, code, "Viettel");
}
```

**Chi tiết & lý do:**

- **`const token = await solveCaptcha()`** — provider **luôn tự giải** captcha rồi tải; dialog kiểu-MISA
  chỉ việc gọi mà không cần biết đến captcha. (`recaptcha` ở đây chỉ còn là **field trong body gửi tới
  Viettel**, mang token vừa giải — không phải input từ FE.)
  > *Lịch sử: bản đầu tiên `throw` khi thiếu `recaptcha` truyền vào, rồi đổi thành `recaptcha || solveCaptcha()`.
  > Đợt `/simplify` gỡ hẳn input `recaptcha` (không nơi nào truyền) → còn lại `await solveCaptcha()`.*
- **Vẫn bắt buộc `sellerMst`** — Viettel cần nó cho cả `taxCode` (query) lẫn `supplierTaxCode` (body).
- **Phân biệt lỗi bằng `content-type`** — cổng Viettel trả **JSON** khi lỗi nghiệp vụ (mã sai) nhưng trả
  **octet-stream** khi thành công. Nên phải soi `content-type` trước, JSON → `INVALID_CODE` kèm message
  gốc; còn lại giao cho `pdfFromResponse`.

**Tác dụng:** một hóa đơn Viettel = **3 request upstream** (generate → verify → downloadPDF), tất cả ẩn
sau BE. FE chỉ việc gọi như MISA.

---

### 3.5 `traCuuGoc/index.ts` — đăng ký Viettel + đổi `taiHoaDonGoc` nhận object

```ts
import { viettel } from "./vinvoice_viettel";
const REGISTRY: ProviderDownloader[] = [misa, viettel];   // ← thêm viettel

export async function taiHoaDonGoc(msttcgp: string, req: DownloadRequest) {  // ← nhận req thay vì code
  const provider = BY_MST.get(msttcgp);
  if (!provider) throw new TraCuuGocError("UNSUPPORTED", …);
  return provider.download(req);
}
```

**Vì sao:** dispatcher là **điểm vào duy nhất**; nó chọn provider theo `msttcgp`. Thêm Viettel vào
`REGISTRY` là đủ để tự động có trong `BY_MST` và `SUPPORTED_MST`. Đổi tham số sang `req: DownloadRequest`
để chuyển nguyên gói dữ liệu xuống provider.

**Tác dụng:** MST chưa đăng ký → `UNSUPPORTED` (501); MST đã có → gọi đúng provider.

---

### 3.6 `traCuuGoc.controller.ts` — nhận thêm `sellerMst` từ query

```ts
interface DownloadOriginalQuery { msttcgp?; code?; sellerMst?; }   // ← thêm sellerMst
...
const { msttcgp, code, sellerMst } = request.query;
const file = await taiHoaDonGoc(msttcgp, { code, sellerMst });     // ← truyền object
```

**Vì sao:** layer HTTP chỉ đọc query rồi chuyển thẳng cho service. Việc map mã lỗi ngữ nghĩa
(`INVALID_CODE`→422, `UPSTREAM`→502, `UNSUPPORTED`→501) vẫn nằm ở `STATUS_BY_CODE` — không đổi.

**Tác dụng:** endpoint `GET /gdt/tra-cuu-goc` giờ chấp nhận thêm `sellerMst` (optional), vẫn chỉ cần JWT
app, không cần token GDT.

---

## 4. Thay đổi FRONTEND (`hdđt_maxv`)

### 4.1 `features/hddt/api/traCuuGoc.ts` — thêm `sellerMst` vào query (optional)

```ts
export interface TaiHoaDonGocParams { msttcgp; code; sellerMst?; }   // ← thêm sellerMst
...
const params = new URLSearchParams({ msttcgp, code });
if (sellerMst) params.set("sellerMst", sellerMst);   // ← chỉ set khi có
```

**Vì sao:** chỉ đính `sellerMst` vào URL **khi có giá trị** → MISA (không truyền gì thêm) giữ nguyên URL
cũ, Viettel thì có `sellerMst`. FE **không gửi captcha** — Viettel do BE tự giải.

**Tác dụng:** một hàm `taiHoaDonGoc` phục vụ mọi NCC; giữ timeout 60s để 1 request treo không kẹt cả lượt.

---

### 4.2 `features/hddt/traCuuNcc.ts` — bật `taiTuDong: true` cho Viettel

```ts
"0100109106": {
  ten: "Tập đoàn Công nghiệp - Viễn thông quân đội",
  url: "https://vinvoice.viettel.vn/utilities/invoice-search",
  maTraCuu: { src: "ttkhac", ttruong: "Mã số bí mật" },
  taiTuDong: true,          // ← BẬT
},
```

**Vì sao:** cờ `taiTuDong` trong registry `TRA_CUU_NCC` là **nguồn DUY NHẤT** để dialog biết NCC nào tải
tự động được (hàm `nccHoTroTai()` đọc đúng cờ này). Trước đó chỉ MISA bật cờ → Viettel bị đánh dấu *"chưa
hỗ trợ tải"* và **bị loại khỏi hàng đợi**. Bật cờ = mở khóa Viettel.

**Tác dụng:** Viettel hết bị gắn nhãn "chưa hỗ trợ" và được đưa vào hàng đợi tải.

---

### 4.3 `features/hddt/components/DownloadOriginalDialog.tsx` — mang & truyền `sellerMst`

```ts
// queue thêm field sellerMst
const queue: { msttcgp: string; code: string; sellerMst: string; base: string }[] = [];
...
queue.push({ msttcgp: row.msttcgp, code, sellerMst: row.sellerMst, base: … });
...
// truyền xuống khi tải
const blob = await taiHoaDonGoc({ msttcgp: item.msttcgp, code: item.code, sellerMst: item.sellerMst });
```

**Vì sao:** Viettel cần MST người bán (`nbmst`) làm `supplierTaxCode`. Dữ liệu này đã có sẵn trên mỗi
`row` (`row.sellerMst`), chỉ là trước đây không truyền xuống. MISA nhận `sellerMst` nhưng **bỏ qua**, nên
thêm field này **không ảnh hưởng** MISA.

**Tác dụng:** mỗi hóa đơn Viettel trong hàng đợi mang theo đủ dữ liệu để BE tải; MISA không đổi hành vi.

---

### 4.4 `features/hddt/components/InvoiceListTabs.tsx` — mở lại nút "Tải hóa đơn gốc"

Nút mở dialog trước đây **bị comment** (`{/* <Button>…</Button> */}`), nay **bỏ comment** để hiện lại.

**Vì sao:** khi mới làm MISA, nút có thể bị tắt tạm; giờ tính năng đã sẵn sàng (2 NCC) nên bật lại để
người dùng mở được dialog.

**Tác dụng:** nút "Tải hóa đơn gốc" hiển thị trên tab danh sách, `onClick` mở `DownloadOriginalDialog`.

---

## 5. Vì sao gọi là "giống MISA" — đối chiếu 2 luồng

| Bước | MISA | Viettel |
|------|------|---------|
| Thao tác người dùng | mở dialog → tick → chọn thư mục → **Tải xuống** | **y hệt** |
| FE gửi gì | `msttcgp`, `code` | `msttcgp`, `code`, **`sellerMst`** |
| BE lấy file | GET + header iframe | POST + **tự giải captcha** (generate→verify→downloadPDF) |
| Captcha lộ ra người dùng? | Không có captcha | **Không** (BE giải ngầm) |

Khác biệt **hoàn toàn nằm ở BE**; trải nghiệm người dùng như nhau.

---

## 6. Điểm cần lưu ý / TODO

1. ⚠️ **Mã tra cứu Viettel** — dialog rút `code` từ `ttkhac["Mã số bí mật"]` (trong chi tiết đã lưu). Cần
   1 hóa đơn Viettel thật để chắc: (a) `getSavedDetails` có trả `ttkhac`, và (b) "Mã số bí mật" đúng là
   `reservationCode` mà `downloadPDF` cần. Thiếu mã → HĐ rơi vào *"chưa có mã tra cứu (tải chi tiết
   trước)"*; mã sai → `400 INVOICE_NOT_FOUND`.
2. ⚠️ **URL cổng Viettel hardcode** — `VINVOICE_VIETTEL_ORIGIN` đặt cứng trong `vinvoice_viettel.ts`,
   **chưa đọc từ env**. Khi cần đổi giữa mock (dev) và prod thì nên wire `process.env` thay vì sửa code.
3. ✅ **Đã dọn** (đợt `/simplify`): input `recaptcha` chết đã gỡ khỏi FE/controller/types/provider;
   `solveCaptcha` dùng lại `fetchUpstream` (bỏ `TIMEOUT_MS`/`describeErrorChain`/try-catch trùng); field
   `offsetY` không dùng đã xóa; tên sót `vttel`/`{vttelUrl}`/`TODO(vttel)` và hằng `VINVOICE_VIETTEL_Url`
   đã chuẩn hóa.
4. ⏱️ **Hiệu năng** — mỗi HĐ Viettel = 3 request upstream, chạy tuần tự trong vòng lặp FE. Tải cả tháng
   nhiều HĐ sẽ chậm hơn MISA. Tối ưu "giải captcha 1 lần rồi tái dùng token cho cả lượt" **không an toàn**
   (token captcha thường dùng-một-lần / hết hạn nhanh) nên giữ nguyên 3 request/HĐ.

---

## 7. Tóm tắt file thay đổi

| File | Loại | Nội dung |
|------|------|----------|
| `be_maxv/…/traCuuGoc/types.ts` | sửa | Thêm interface `DownloadRequest` (`code` + `sellerMst?`); `download()` nhận object |
| `be_maxv/…/traCuuGoc/shared.ts` | sửa | Tách `fetchUpstream` + `pdfFromResponse` (DRY, mở đường cho POST) |
| `be_maxv/…/traCuuGoc/misa.ts` | sửa | `download(code)` → `download({ code })` |
| `be_maxv/…/traCuuGoc/vinvoice_viettel.ts` | **mới** | Bộ tải Viettel + `solveCaptcha()` (BE tự giải, dùng `fetchUpstream`) |
| `be_maxv/…/traCuuGoc/index.ts` | sửa | Đăng ký `viettel`; `taiHoaDonGoc(msttcgp, req)` |
| `be_maxv/…/traCuuGoc.controller.ts` | sửa | Đọc thêm `sellerMst` từ query |
| `hdđt_maxv/…/api/traCuuGoc.ts` | sửa | Thêm `sellerMst` (optional) vào query |
| `hdđt_maxv/…/traCuuNcc.ts` | sửa | Bật `taiTuDong: true` cho Viettel |
| `hdđt_maxv/…/DownloadOriginalDialog.tsx` | sửa | Mang & truyền `sellerMst` |
| `hdđt_maxv/…/InvoiceListTabs.tsx` | sửa | Mở lại nút "Tải hóa đơn gốc" |
