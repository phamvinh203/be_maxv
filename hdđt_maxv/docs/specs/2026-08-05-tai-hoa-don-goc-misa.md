# Tải hóa đơn gốc theo NCC phát hành — MISA (meinvoice.vn)

_Ngày: 2026-08-05 · Trạng thái: thiết kế đã chốt, đang triển khai_

## Mục tiêu

Dialog **"Tải hóa đơn gốc"** (`DownloadOriginalDialog`) tải file **PDF gốc** của các hóa đơn trong
khoảng đang lọc, gom theo NCC phát hành (`msttcgp`), lưu vào thư mục người dùng chọn. Bản này làm
**MISA trước** (MST `0101243150`); các NCC khác (Viettel, VETC, FPT…) thêm sau theo cùng khung.

> Chỉ tải **PDF** (đã bỏ tải XML). Endpoint NCC vẫn hỗ trợ XML (xem phần kiểm chứng) nếu sau này cần.

## Cơ chế MISA đã reverse-engineer (ĐÃ KIỂM CHỨNG bằng curl)

meinvoice.vn để sau Cloudflare. Luồng tải gồm 2 request, **không cần cookie / cf_clearance / puppeteer**:

1. **Mint token `ext`** — token mã hóa-thời-gian, hết hạn nhanh, KHÔNG gắn theo mã hóa đơn:
   ```
   POST https://www.meinvoice.vn/tra-cuu/GetRequestTimeEnCode
   Headers: user-agent (Chrome), referer: https://www.meinvoice.vn/tra-cuu/,
            origin, x-requested-with: XMLHttpRequest,
            content-type: application/x-www-form-urlencoded; charset=UTF-8
   Body (tùy chọn): code=<maTraCuu>
   → { "success": true, "data": "<ext>", "customData": null }
   ```

2. **Tải file** với token vừa mint:
   ```
   GET https://www.meinvoice.vn/tra-cuu/tra-cuu/DownloadHandler.ashx
       ?Type=pdf|xml&Viewer=1&ext=<ext>&Code=<maTraCuu>
   ```
   > ⚠️ **MẤU CHỐT — bắt buộc gửi header "điều hướng iframe"**, thiếu là handler trả **200 nhưng rỗng**:
   > ```
   > accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
   > referer: https://www.meinvoice.vn/tra-cuu/
   > sec-fetch-dest: iframe
   > sec-fetch-mode: navigate
   > sec-fetch-site: same-origin
   > sec-fetch-user: ?1
   > upgrade-insecure-requests: 1
   > user-agent: <Chrome>
   > ```
   > (Trang thật nhúng file vào `<iframe id="frmResult">`, nên request là navigation chứ không phải XHR.
   > Đường dẫn có **`/tra-cuu/tra-cuu/`** đôi là do URL tương đối dựng từ trang ở thư mục `/tra-cuu/`.)

**Kết quả kiểm chứng** (mã mẫu `N6F9IWKMLZB1`):
- `Type=pdf` → `200 application/pdf`, ~486 KB, `content-disposition: inline; filename=1C26TYY_00002899_0108914961.pdf`
- `Type=xml` → `200`, ~14 KB, nội dung `<HDon><DLHDon Id="N6F9IWKMLZB1">…</HDon>` (XML gốc ký số TT78)

**Phát hiện lỗi:** `Code` sai → `200` nhưng **body 0 byte**. Dùng "body rỗng" làm dấu hiệu
"mã sai / không tìm thấy" → BE ném lỗi 422.

## Kiến trúc

Vì meinvoice.vn không có CORS và cần header điều hướng, **phải proxy qua backend** (giống GDT).
FE gọi endpoint nội bộ → BE gọi meinvoice → trả bytes.

| Lớp | File | Vai trò |
|-----|------|---------|
| BE types | `be_maxv/src/services/client/hddt/traCuuGoc/types.ts` | `LoaiFileGoc`, `FileHoaDonGoc`, `ProviderDownloader`, `TraCuuGocError` (chỉ mang `code` ngữ nghĩa) |
| BE shared ⭐ | `be_maxv/src/services/client/hddt/traCuuGoc/shared.ts` | Boilerplate DÙNG CHUNG: `fetchFileGoc` (headers+timeout, body rỗng→INVALID_CODE, parse filename, content-type), `mintTokenForm`, `BROWSER_UA`. Dùng lại `describeErrorChain` của gdt-client |
| BE provider ⭐ | `be_maxv/src/services/client/hddt/traCuuGoc/misa.ts` | `export const misa: ProviderDownloader` — chỉ phần đặc thù MISA (URL + header iframe + cách mint token) |
| BE dispatcher | `be_maxv/src/services/client/hddt/traCuuGoc/index.ts` | `REGISTRY: ProviderDownloader[]` + `taiHoaDonGoc(msttcgp, code, type)`; NCC chưa đăng ký → `UNSUPPORTED` |
| BE controller | `be_maxv/src/controllers/client/hddt/traCuuGoc.controller.ts` | `downloadOriginalInvoice`: đọc `?msttcgp&type&code`, gọi dispatcher, `reply.header(...).send(buffer)`; map `code → HTTP status` |
| BE route | `gdt.route.ts` (+1 dòng) | `GET /gdt/tra-cuu-goc`, preHandler `authenticate` (KHÔNG cần X-Gdt-Token) |
| FE api ⭐ | `hdđt_maxv/src/features/hddt/api/traCuuGoc.ts` | `taiHoaDonGoc({ msttcgp, code, type })` → `Blob` qua `apiFetchBlob` |
| FE registry | `hdđt_maxv/src/features/hddt/traCuuNcc.ts` | Cờ `taiTuDong` đánh dấu NCC nào tải tự động được — nguồn DUY NHẤT (khỏi list MST song song) |
| FE dialog | `DownloadOriginalDialog.tsx` (`handleDownload`) | Lấy mã tra cứu từng HĐ (NCC có `taiTuDong`) → tải PDF → `writeFile` vào thư mục, cập nhật tiến trình |

### Thêm NCC mới (không captcha) — chi phí tối thiểu

1. **BE**: tạo `traCuuGoc/<ncc>.ts` export một `ProviderDownloader` (thường chỉ vài dòng: URL + header + `fetchFileGoc`); thêm 1 phần tử vào `REGISTRY` trong `index.ts`.
2. **FE**: bật `taiTuDong: true` trên entry NCC đó trong `TRA_CUU_NCC` (entry vốn phải thêm để có cột link/mã tra cứu).

→ Không đụng controller/route/dialog. NCC cần captcha (Viettel) tự chứa trong file của nó, không ảnh hưởng NCC khác.

## Luồng FE khi bấm "Tải xuống"

`DisplayRow` (list) **không có** mã tra cứu — mã nằm ở **chi tiết** (`detail.cttkhac`). Nên:

1. `getSavedDetails(direction, { tuNgay, denNgay })` → mảng payload chi tiết đã lưu.
2. Index detail theo `invoiceKey(mauSo, kyHieu, soHd, sellerMst)`. Dựng `invoiceSttMap(rows)`.
3. Duyệt `rows` thuộc NCC **đã tick** (hiện chỉ MISA có downloader):
   - `traCuuNcc(detail).maTraCuu` → mã tra cứu; rỗng → bỏ qua (đếm vào "thiếu mã").
   - Tên file: `invoiceFileBase(stt, ngayLap, soHd, sellerMst)` + `.pdf` (dùng chung quy ước export).
4. Với mỗi HĐ: tải `pdf` → `writeFile(dir, name, blob)`. Lỗi 1 HĐ → đếm lỗi, chạy tiếp.
5. Tiến trình xác định `{done}/{total}` + số lỗi; nút khóa khi đang tải.

## Phạm vi bản này

- ✅ End-to-end MISA (nút chạy thật), tải **PDF** (XML đã bỏ; endpoint vẫn hỗ trợ nếu cần lại).
- ⛔ NCC khác: dispatcher ném "chưa hỗ trợ" — thêm file `viettel.ts`/`vetc.ts`… sau.
- Token `ext` hết hạn nhanh → mint MỚI cho mỗi request tải (không cache).

## Rủi ro / lưu ý

- meinvoice.vn có thể đổi cơ chế (đổi tên param/handler, siết anti-bot) → downloader MISA sẽ hỏng
  riêng; các NCC khác không ảnh hưởng nhờ tách file.
- Token ext toàn cục, hết hạn nhanh: mint ngay trước khi tải, không tái dùng.
- File gốc PDF hàng trăm KB × nhiều HĐ: ghi thẳng ra đĩa qua File System Access (không ôm hết vào RAM).

---

## Phụ lục: Viettel (vinvoice.viettel.vn) — TẠM HOÃN (2026-08-05)

Đã khảo sát nhưng CHƯA triển khai (quyết định tạm hoãn). Ghi lại để nối tiếp sau.

**Endpoint (đã thử bằng curl):**
- `GET  /api/services/einvoiceuaa/api/captcha/generate` → `{ backgroundUrl, puzzleUrl, token, offsetX, offsetY, slideCaptchaOffsetMargin }` — **captcha kéo mảnh ghép (slider)**.
- `POST /api/services/einvoiceuaa/api/captcha/verify` — (CHƯA có contract; cần curl khi người dùng giải captcha).
- `POST /api/services/einvoicequery/sync/utility/downloadPDF?taxCode=<mst>` body `{ supplierTaxCode, reservationCode, recaptcha }` → **PDF thật** (~197 KB, Apache FOP). `reservationCode` = "Mã số bí mật" (registry Viettel: `ttkhac ttruong="Mã số bí mật"`).

**Ràng buộc / lưu ý:**
- CORS chỉ cho `https://vinvoice.viettel.vn` → **phải proxy qua BE** (như MISA).
- `downloadPDF` phục vụ tươi từ origin (`cf-cache-status: DYNAMIC`); mã sai → `400 INVOICE_NOT_FOUND`.
- **Captcha chỉ là cổng chặn ở giao diện web của Viettel** (backend không xác thực chặt trong test).
- **NGUYÊN TẮC khi làm sau:** KHÔNG tự giải/bỏ qua captcha. Con người phải giải slider (trong app hoặc trên trang Viettel) rồi mình chuyển tiếp token — chỉ giải 1 lần mỗi lượt (token dùng lại được).
- Khung mở rộng đã sẵn: thêm `traCuuGoc/viettel.ts` + 1 nhánh `case` trong `traCuuGoc/index.ts` (key MST Viettel = `0100109106`).
