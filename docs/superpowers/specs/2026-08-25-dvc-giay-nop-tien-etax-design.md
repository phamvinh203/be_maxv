# Tích hợp "Giấy nộp tiền" (eTax GNT) vào đồng bộ Dịch vụ công — thiết kế

> Trạng thái: **chờ duyệt**. Dựng từ các curl thật do người dùng bắt trên DevTools, tài khoản
> MST 0106200129, ngày 2026-08-25.

## 1. Mục tiêu

Tab "Giấy nộp tiền" trên `hdđt_maxv` đã có UI đầy đủ (17 cột, bộ lọc riêng — xem `config.ts`) nhưng
**chưa có tích hợp cổng nào phía sau**: nút "Đồng bộ" khóa cứng loại này (xem
`DialogDongBo.tsx:LOAI_DA_HO_TRO`). Spec trước (`2026-08-24-dvc-ghep-api-thue-dien-tu-design.md`,
mục 8) đã ghi rõ đây là ngoài phạm vi.

Mục tiêu của spec này: kéo dữ liệu Giấy nộp tiền (GNT) từ cổng **`thuedientu.gdt.gov.vn`** (hệ
eTax cũ, framework `dse_*`, KHÁC hẳn `dichvucong.gdt.gov.vn` HTMX đang dùng cho tab "Tờ khai") về
lưu tại DB tenant, theo đúng khuôn "Đồng bộ" đã có: chọn khoảng ngày → lưu → tìm kiếm sau đó đọc
thẳng DB, không cần đăng nhập lại cổng mỗi lần lọc.

Phạm vi: **chỉ chức năng "Tra cứu GNT"** (module `330410`, doanh nghiệp). Các module khác trong
cùng nhóm "Nộp thuế" (Lập GNT `330407`, Lập GNT nộp thay `330409`, Phê duyệt GNT `330406`) — ngoài
phạm vi, xem mục 6.

## 2. Những gì ĐÃ kiểm chứng trên cổng thật

Ghi lại vì đây là nền của mọi quyết định bên dưới; ai sửa sau này mà thấy khác thì cổng đã đổi.

### 2.1. Không cần đăng nhập riêng cho `thuedientu.gdt.gov.vn` — SSO từ phiên DVC

Trang `dichvucong.gdt.gov.vn/tthc/dich-vu-khac` (đã đăng nhập, `_ssTypeObject = "DN"`) chứa hàm JS:

```js
async function connectSSO(moduleId, tthc, matk, tmdt) {
    await $.ajax({
        type: 'POST',
        url: base_url + `sso/redirect-to-service?module=${moduleId}...`,
        headers: {'X-XSRF-TOKEN': "<csrf token của phiên DVC>"},
        success: function (response) { redirectSSO(response); },
    });
}
```

`redirectHandler('330410', ...)` gắn với nút "Tra cứu GNT" gọi đúng hàm này. Nghĩa là: **phiên DVC
đã đăng nhập (cookie + XSRF-TOKEN mà `gdt-dvc.service.ts` đang giữ) là đủ để xin vé SSO sang
`thuedientu`** — không cần tài khoản/mật khẩu/captcha riêng cho hệ eTax cũ.

### 2.2. Chuỗi vé SSO thật đã bắt được (4 bước)

```
A. POST https://dichvucong.gdt.gov.vn/tthc/sso/redirect-to-service?module=330410
   (cookie + X-XSRF-TOKEN của DvcSession) -> response chứa URL vé (hình dạng response CHƯA xác
   minh, xem mục 7).

B. GET  https://thuedientu.gdt.gov.vn/etaxnnt/?vnconnect=SSOTHUE&code=<vé mã hoá dài>&module=330410
   Referer: https://dichvucong.gdt.gov.vn/   Sec-Fetch-Dest: iframe (nạp qua iframe trên trang DVC)
   -> cấp JSESSIONID + cookie TS... MỚI cho domain thuedientu (WAF F5/BigIP).

C. GET  https://thuedientu.gdt.gov.vn/etaxnnt/Request?dse_operationName=corpJumpProc
        &dse_errorPage=error_page.jsp&dse_processorState=initial&dse_nextEventName=start
        &dse_sessionId=<sid>&dse_applicationId=-1&dse_pageId=4&toOpName=ssoTTHC
   (suy ra từ cookie _op_jsTiming của bước D — chính là URL bước D vừa rời đi).

D. GET  https://thuedientu.gdt.gov.vn/etaxnnt/EstablishSession?&fromOpName=corpJumpProc
        &fromStateName=initial&fromEventName=start&toOpName=ssoTTHC
   -> hoàn tất SSO, phiên thuedientu giờ gắn với danh tính công ty (MST 0106200129), sẵn sàng cho
   module 330410 (Tra cứu GNT).
```

Ba request B/C/D đi liên tiếp qua điều hướng trình duyệt thật (không phải AJAX) — `Sec-Fetch-Mode:
navigate` xuyên suốt. Bằng chứng gián tiếp nhưng chắc: cookie `_op_jsTiming` của request D chứa
NGUYÊN VĂN URL đã mã hoá của request C, và tham số `fromOpName/fromStateName/fromEventName` của D
khớp khít với `dse_operationName/dse_processorState/dse_nextEventName` của C.

### 2.3. Pipeline tra cứu/tải GNT — 4 bước `dse_*` (curl gốc người dùng cung cấp)

```
E. Khởi tạo tra cứu — POST /etaxnnt/Request
   dse_operationName=corpQueryTaxProc  dse_pageId=21  dse_processorState=initial
   dse_nextEventName=start            dse_sessionId=<sid của phiên đã SSO>

F. Tra cứu danh sách — POST /etaxnnt/Request
   dse_pageId=22  dse_processorState=viewQueryPage  dse_processorId=<P1>  dse_nextEventName=query
   + form lọc: pn, type_tax=01, ngay_lap_tu_ngay/den_ngay (dd/MM/yyyy), ma_giao_dich, so_gnt,
     hthuc_nop, trang_thai... (17 trường lọc, phần lớn để trống là "không lọc")

G. Xem chi tiết — POST /etaxnnt/Request
   dse_pageId=23  dse_processorState=viewQueryPage  dse_processorId=<P1>  (GIỐNG bước F)
   dse_nextEventName=detail  + ctuId=<id chứng từ>&isReport=N&type=pdf

H. Download PDF — POST /etaxnnt/Request
   dse_pageId=30  dse_processorState=viewQueryPage  dse_processorId=<P2>  (KHÁC P1 của F/G)
   dse_nextEventName=download  + ctuId=<id chứng từ, giống G>&isReport=N&type=pdf
```

Mỗi response HTML mang theo `dse_processorId` MỚI cho bước sau — đúng kiểu CSRF-token-đổi-liên-tục
của framework DSE (Struts-cũ), tương tự cách `dse_processorState` chuyển từ `initial` sang
`viewQueryPage` sau bước E. **`detail` (G) dùng lại processorId của `query` (F)**, nhưng
**`download` (H) lại mang một processorId KHÁC** — dấu hiệu cho thấy `download` không nhánh thẳng
từ `query`, mà cần đi qua `detail` trước (xem giả định ở mục 3.2 và việc cần xác minh ở mục 7).

Không request nào trong E–H có tham số captcha trong body — khác hẳn DVC/ETAX phải giải captcha
mỗi lượt tra cứu.

## 3. Kiến trúc

### 3.1. Phiên eTax GNT — lập MỚI mỗi lượt "Đồng bộ", không cache qua nhiều lượt

Khác `DvcSession` (có TTL, sống qua nhiều thao tác), phiên GNT chỉ tồn tại trong RAM **suốt một
lượt đồng bộ đang chạy**, dựng lại từ đầu (chuỗi A→D ở mục 2.2) mỗi lần người dùng bấm "Đồng bộ".

Lý do: đơn giản hơn hẳn so với thêm một tầng TTL/tự-làm-mới riêng cho một phiên chỉ sống vài giây
tới vài phút; chi phí thêm (1 POST + 3 GET điều hướng) không đáng kể so với cả lượt tra cứu +
tải file. Phiên DVC gốc (`DvcSession`) đã có cơ chế tự đăng nhập lại khi chết — bước SSO A thừa
hưởng luôn, không cần code thêm.

```ts
interface EtaxGntSession {
  cookies: Map<string, string>; // cookie-jar RIÊNG của domain thuedientu, tách khỏi DvcSession
  dseSessionId: string;
  dseProcessorId: string; // cập nhật lại sau MỖI bước E/F/G/H
  dseProcessorState: string;
}

/** Chuỗi A->D, dùng phiên DVC đã đăng nhập để xin vé rồi dựng phiên GNT mới. */
function ganPhienGnt(dvcPhien: DvcPhien): Promise<EtaxGntSession>;
```

### 3.2. Pipeline — hàm-theo-bước, mỗi hàm trả `EtaxGntSession` đã cập nhật

```ts
function khoiTaoTraCuuGnt(s: EtaxGntSession): Promise<EtaxGntSession>;              // bước E
function traCuuGnt(s: EtaxGntSession, boLoc: GntBoLoc): Promise<{ session: EtaxGntSession; bang: BangHoSoDaBoc }>; // F
function xemChiTietGnt(s: EtaxGntSession, ctuId: string): Promise<{ session: EtaxGntSession; html: string }>;      // G
function taiPdfGnt(s: EtaxGntSession, ctuId: string): Promise<DvcTepTaiVe>;         // H
```

**Giả định làm việc** (dựa trên bằng chứng mục 2.3, đánh dấu cần xác minh ở mục 7): lượt "Đồng bộ"
gọi `query` MỘT lần lấy danh sách, rồi với mỗi dòng cần tải file: gọi `detail` trước (lấy
processorId mới) rồi mới gọi `download` — KHÔNG nhảy thẳng `query` → `download`, để tránh đúng lỗi
"gọi sai thứ tự trong phiên → HTTP 500" mà spec ETAX trước đã gặp (mục 2.3 spec đó).

### 3.3. Schema — bảng mới, KHÔNG dùng chung `dvc_ho_so`

Dữ liệu GNT (17 cột: số tham chiếu, số tiền, ngân hàng, tài khoản...) khác hẳn hồ sơ tờ khai về ý
nghĩa lẫn khoá định danh, nên tách bảng riêng thay vì cố nhét vào `dvc_ho_so`:

```prisma
model dvc_giay_nop_tien {
  ctu_id String @id @db.VarChar(64) // "id chứng từ" dùng ở detail/download — xem mục 7 (cần xác
                                     // minh lấy từ đâu trong bảng kết quả)

  so_tham_chieu String? @db.VarChar(128)
  so_giay_nop_tien String? @db.VarChar(128)
  so_tien Decimal? @db.Decimal(18, 2)
  loai_tien String? @db.VarChar(8)
  trang_thai String? @db.VarChar(254)
  so_chung_tu String? @db.VarChar(128)
  ngay_lap_gnt String? @db.VarChar(32)
  ngay_nop_date DateTime? @db.Date // suy từ ngày phù hợp để lọc/sắp — CHỌN CỘT NÀO cần xác minh
  ngan_hang String? @db.VarChar(254)
  tai_khoan_ngan_hang String? @db.VarChar(64)

  file_pdf_bin Bytes?        // PDF cache — mẫu giống dvc_ho_so.xml_to_khai_bin
  content_type String? @db.VarChar(128)
  ten_file     String? @db.VarChar(254)

  raw Json      // nguyên dòng cổng trả, giống dvc_ho_so.raw — chống lệch cột không cần migration
  da_dong_bo Boolean @default(false)

  datetime0 DateTime @default(now())
  datetime2 DateTime @updatedAt

  @@index([ngay_nop_date])
}
```

`dvc_dong_bo_log.loai` đã sẵn giá trị `"giay-nop-tien"` trong comment schema hiện tại — không cần
migrate thêm cột đó, chỉ thêm model mới ở trên.

### 3.4. Wiring FE

- [DialogDongBo.tsx:47](../../../hdđt_maxv/src/features/dich_vu_cong/components/DialogDongBo.tsx) —
  `LOAI_DA_HO_TRO` (hằng số string đơn) đổi thành tập hợp 2 giá trị (`to-khai-dvc`,
  `giay-nop-tien`), bỏ khoá `disabled` cho mục "Giấy nộp tiền" trong dropdown "Loại giấy tờ".
- Backend: hàm tìm kiếm mới đọc `dvc_giay_nop_tien`, ánh xạ ra `{headers, rows}` theo đúng khuôn
  `timHoSoDaDongBo` để `BangHoSo`/`COT_GIAY_NOP_TIEN` (config.ts) không phải đổi gì.
- Route/controller: thêm nhánh `loai === "giay-nop-tien"` song song nhánh hiện có trong
  `gdt-dvc.controller.ts`, gọi vào service mới (`gdt-etax-gnt.service.ts`) thay vì
  `gdt-dvc.service.ts`.

## 4. Xử lý lỗi

- **Không có captcha** (mục 2.3) — không cần vòng thử-lại-captcha như DVC/ETAX. Nếu xác minh lúc
  triển khai phát hiện captcha ẩn ở một bước nào đó, quay lại dùng `docDvcCaptcha` OCR sẵn có.
- **Vé SSO hết hạn/sai** (bước B) — vé `code` gần như chắc chắn có thời hạn ngắn + dùng một lần
  (mẫu chuẩn ticket SSO); lượt "Đồng bộ" xin vé MỚI mỗi lần chạy (mục 3.1) nên không có khái niệm
  "vé cũ hết hạn giữa chừng" — chỉ cần retry nguyên chuỗi A→D nếu một bước lỗi, KHÔNG retry từng
  bước lẻ.
- **Sai thứ tự `dse_processorId` giữa các bước** — nếu `download` (H) chạy khi chưa qua `detail`
  (G) đúng như giả định mục 3.2 mà vẫn lỗi, thử bơm thêm bước "xem chi tiết" trước mỗi lần tải,
  đúng bài học "cổng giữ state phía server" đã ghi trong spec ETAX trước.
- **Một dòng lỗi, dòng khác vẫn tiếp tục** — theo đúng tinh thần `dongBoMotDoan`: lỗi tải PDF của
  một GNT chỉ tính `loi++`, không huỷ cả lượt; `da_dong_bo=false` để lượt sau tự bù.
- **Pacer/nhịp gọi cổng** — dùng LANE RIÊNG cho domain `thuedientu` (tách khỏi lane `dvc` hiện có):
  khác server vật lý, không có lý do phải chia sẻ giới hạn tốc độ với `dichvucong.gdt.gov.vn`.

## 5. Kiểm thử

**Thuần logic (không đụng cổng):**
- Bóc `dse_processorId`/`dse_processorState` từ HTML response giả lập cho từng bước E/F/G/H
- Ánh xạ 17 cột `COT_GIAY_NOP_TIEN` — viết test SAU khi xác minh header thật (mục 7)
- `ganPhienGnt`: dựng chuỗi A→D từ response giả lập, bắt đúng cookie mới của domain thuedientu

**Thử thật:** MST 0106200129 đã xác nhận có dữ liệu GNT thật (ảnh chụp trang `dich-vu-khac` cho
thấy tài khoản này đã đăng nhập với tư cách "Công Ty Cổ Phần Phần Mềm Maxv Việt Nam"). Kịch bản:
đồng bộ một khoảng ngày có GNT thật, xác nhận số dòng khớp, tải được ít nhất 1 PDF.

## 6. Ngoài phạm vi

- Các module SSO khác trong nhóm "Nộp thuế": Lập GNT (`330407`), Lập GNT nộp thay (`330409`), Phê
  duyệt GNT (`330406`) — chỉ "Tra cứu GNT" (`330410`) nằm trong phạm vi spec này.
- "Xem chi tiết" như một action riêng cho người dùng bấm — `COT_GIAY_NOP_TIEN` hiện chỉ có cột
  "Tải file", không có cột hành động "Xem chi tiết"; bước `detail` (G) trong pipeline chỉ dùng làm
  BƯỚC TRUNG GIAN nội bộ trước `download`, không phải tính năng lộ ra FE.
- Đối tượng "Cá nhân" (CN) — chỉ làm nhánh Doanh nghiệp (module `330410`) như tài khoản thử hiện
  có; module tương ứng bên CN (nếu có) để sau.
- Phân đoạn theo mốc ngày kiểu `chiaDoanTheoNguon` (ETAX/DVC) — GNT chỉ có MỘT nguồn, không cần
  logic cắt khoảng.

## 7. Việc CHƯA kiểm chứng — làm đầu tiên khi triển khai

Đây là danh sách các giả định trong spec này chỉ dựa trên REQUEST (curl), CHƯA thấy response thật.
Phải xác nhận từng mục bằng cách bắt response thật (DevTools → tab Response, hoặc log ngay trong
lúc code) trước khi tin vào phần kiến trúc phụ thuộc nó:

1. **Hình dạng response của bước A** (`POST /tthc/sso/redirect-to-service`) — là JSON chứa URL hay
   HTML/text thô? `redirectSSO(response)` xử lý ra sao?
2. **Bảng kết quả `query` (F)** — hình dạng HTML (bảng như DVC, hay dạng khác), tên cột thật trên
   cổng để đối chiếu với `header`/`srcHeader` của `COT_GIAY_NOP_TIEN` (hiện KHÔNG có `srcHeader`
   nào khai — có thể là chưa từng đối chiếu với cổng thật).
3. **`ctuId` lấy từ đâu** trong một dòng kết quả — không phải cột hiển thị rõ ràng nào trong 17 cột
   khai ở `config.ts` (có thể nằm trong `onclick`/`href` ẩn của cột "Tải file").
4. **Quy tắc chuyền `dse_processorId`**: `download` có BẮT BUỘC phải đi qua `detail` trước không,
   hay có nhánh khác (vd một bước ẩn giữa `pageId 23` và `pageId 30` mà 4 curl gốc không chụp lại)?
5. **Markup phân trang** của bảng kết quả GNT — DVC dùng `id="totalPage"` + dấu `-`, ETAX dùng
   `Trang N/M` + em-dash; GNT có thể là dạng thứ ba, cần `bocPhanTrang` thêm pattern nếu vậy.
6. **Cột nào là "ngày nộp" chuẩn để lọc/sắp** (`ngay_nop_date` trong schema mục 3.3) — GNT có 4 cột
   ngày khác nhau (lập/gửi/nộp thuế/nộp DS chi tiết), cần chọn đúng cột khớp ý nghĩa bộ lọc "Ngày
   nộp từ/Đến ngày" ở `nhanBoLoc` của tab này.
7. **Vé SSO có thật sự dùng một lần / hết hạn nhanh không** — chỉ là suy luận từ mẫu ticket SSO phổ
   biến, chưa test trực tiếp (vd gọi lại đúng URL vé cũ lần 2 xem có còn dùng được không).
