# Dev notes — to-khai-gtgt01

> File dùng chung Backend + Frontend Engineer (mỗi bên 1 section, chỉ sửa phần của mình). Đọc file
> này TRƯỚC khi đọc code — mục đích rút ngắn thời gian định vị logic.

## Backend (be_maxv)

### Mô hình nghiệp vụ trước khi đọc code

```
                                 ┌─────────────────────────┐
GET /to-khai/hoa-don ──────────►│                          │
                                 │   layBangKeTheoKy(db,    │──► { total, datas, thayThe }
GET /to-khai/hoa-don/chi-tiet ─►│   ky, chieu)  (KHÔNG đổi)│      (datas[i].chiTieuTangGiam
  (MỚI, đợt 2026-09-16)         │                          │       đã diễn giải 37/38)
                                 └────────────┬─────────────┘
                                              │ gọi NGUYÊN, không lọc lại
                                              ▼
                                 tokhai_ky_hoa_don (đã gán kỳ)
                                     ∩ GDTService.getSavedInvoices (duocTinh loại tthai=4/6)
                                              │
                             layBangKeChiTietTheoKy bọc thêm:
                             đọc cột `detail` theo `id` của ĐÚNG các dòng trên (batch <=1000)
                                              │
                                              ▼
                              { total, datas: [...datas cũ, chiTiet], thayThe }
```

Hai endpoint GET `/hoa-don` và `/hoa-don/chi-tiet` CÙNG một tập hóa đơn (cùng gọi
`layBangKeTheoKy`) — `/chi-tiet` chỉ đọc thêm cột `detail` rồi gắn vào, không tự lọc theo khoảng
ngày/trạng thái riêng. Đây là lý do 2 sheet Excel "HĐ..." và "Chi tiết..." luôn khớp tập hóa đơn.

### Thao tác → route/controller/service

| Thao tác | Route | Controller | Service |
|---|---|---|---|
| Bảng kê kỳ (không chi tiết) | `GET /to-khai/hoa-don` | `bangKeTheoKy` | `KeKhai.layBangKeTheoKy` |
| Bảng kê kỳ KÈM `chiTiet` từng hóa đơn (MỚI) | `GET /to-khai/hoa-don/chi-tiet` | `bangKeChiTietTheoKy` | `KeKhai.layBangKeChiTietTheoKy` (bọc `layBangKeTheoKy` + `locChiTietTheoId` nội bộ) |
| Sửa "Kê khai"/"Chỉ tiêu tăng giảm" 1 hóa đơn | `PATCH /to-khai/hoa-don/:chieu/:id` | `suaQuyetDinh` | `KeKhai.locQuyetDinh` (whitelist ghi) + `KeKhai.capNhatQuyetDinh` |

Tất cả trong `be_maxv/src/routes/to_khai/toKhai.route.ts` →
`be_maxv/src/controllers/client/to_khai/keKhaiKy.controller.ts` →
`be_maxv/src/services/client/to_khai/application/keKhaiKy.service.ts`.

### Logic/công thức nghiệp vụ nằm ở đâu

- **Tập hóa đơn thuộc kỳ** (đã gán + chưa bị thay thế/hủy): DUY NHẤT trong `layBangKeTheoKy`
  (`keKhaiKy.service.ts:~502`). Không nơi nào khác được tự lọc lại tập này.
- **Diễn giải mã "Chỉ tiêu tăng giảm" cũ→mới khi ĐỌC**: hàm thuần `dienGiaiChiTieuTangGiam`
  (`keKhaiKy.service.ts`, cạnh `type ChiTieuTangGiam`) — `"tang"→"38"`, `"giam"→"37"`, còn lại giữ
  nguyên/rỗng. Dùng DUY NHẤT trong `layBangKeTheoKy`, nên cả `/hoa-don` lẫn `/hoa-don/chi-tiet` cùng
  kết quả (vì `/chi-tiet` gọi nguyên `layBangKeTheoKy`).
- **Whitelist ghi "Chỉ tiêu tăng giảm"**: `locQuyetDinh` chỉ nhận `""`/`"37"`/`"38"` — mã cũ
  `"tang"`/`"giam"` gửi lên bị BỎ khỏi payload cập nhật (không lỗi, chỉ field đó không đổi).
- **Đọc `detail` theo lô**: `locChiTietTheoId` (private, cạnh `layBangKeChiTietTheoKy`) — batch
  ≤1.000 id qua `chiaLo`, dùng `normalizeDetailDates` (từ `hddt/gdt.service.ts`) để chuẩn hóa ngày —
  KHÔNG viết lại hàm chuẩn hóa ngày ở đây.
- **Chuẩn hóa ngày trong payload chi tiết GDT**: `normalizeDetailDates`
  (`services/client/hddt/gdt.service.ts`) — single source, cả `getSavedInvoiceDetails` (tab "Chi tiết
  hóa đơn" của HĐĐT) lẫn `layBangKeChiTietTheoKy` (mới) đều gọi hàm này, KHÔNG viết bản riêng.
- **Công thức tờ khai GTGT (ct23/24/26/29-33...)**: `domain/gomHoaDonGtgt.ts`
  (`gomBanRa`/`gomMuaVao`) + `domain/tinhGtgt01.ts` — HOÀN TOÀN KHÔNG đọc `chiTieuTangGiam`. Cột này
  chỉ là nhãn ghi chú per-hóa đơn, không cộng dồn vào tờ khai (BR-to-khai-gtgt01-002).

### Chỗ TUYỆT ĐỐI không được nhân đôi logic (single source of truth)

1. **Tập hóa đơn của kỳ** — chỉ `layBangKeTheoKy` được định nghĩa "hóa đơn nào thuộc bảng kê". Bất
   kỳ endpoint/service mới nào cần "hóa đơn của kỳ" phải GỌI hàm này, không tự viết `WHERE` mới —
   nếu không, tập hóa đơn của tính năng mới sẽ trôi khỏi tập hóa đơn hiển thị trên màn hình/Excel.
2. **`duocTinh(tthai)`** (`domain/gomHoaDonGtgt.ts`) — điều kiện loại hóa đơn đã bị thay thế/hủy
   (tthai 4/6). Chỉ sửa ở đây; không chép điều kiện `tthai !== "4" && tthai !== "6"` ở chỗ khác.
3. **`dienGiaiChiTieuTangGiam`** — diễn giải mã cũ khi đọc. Không viết map `tang→38`/`giam→37` lần
   thứ hai ở bất kỳ đâu (kể cả FE) — FE phải nhận giá trị đã diễn giải sẵn từ response.
4. **`normalizeDetailDates`** — chuẩn hóa ngày payload GDT. Cả module HĐĐT lẫn module Tờ khai dùng
   chung hàm này.
5. **`chiaLo`** (`domain/chiaLo.ts`) — chia lô đọc/ghi theo id, tránh trần 65.535 tham số Postgres.
   Dùng lại, không viết vòng lặp chia mảng thủ công.

### Ghi chú triển khai đợt 2026-09-16

- Endpoint mới KHÔNG có trần khoảng ngày (khác `/gdt/invoices/:direction/saved-details`) vì tập đã
  giới hạn tự nhiên bởi kỳ (tối đa 1 quý).
- Rate limit `20 lượt/phút/người dùng` (`gioiHanTheoNguoiDung`), cùng mức `/gtgt01/tinh` — cả hai
  đều đọc toàn bộ hóa đơn của kỳ vào RAM.
- `chi_tieu_tang_giam` KHÔNG có CHECK constraint trong Prisma schema nên đổi tập giá trị hợp lệ
  KHÔNG cần migration. Bản ghi cũ `"tang"`/`"giam"` vẫn nằm nguyên trong DB, chỉ được diễn giải khi
  đọc; chuyển hẳn sang mã mới khi kế toán lưu một giá trị khác lần nữa.

## Frontend (hdđt_maxv)

### Luồng dữ liệu — nút "Xuất Excel" ở tab Tờ khai

```
ToKhaiGtgt01Editor.bamXuatExcel()
  -> setDangXuatExcel(true)                          // khóa nút NGAY (TC-015/016)
  -> xuatToKhaiGtgt01(ky, ban, donVi)                // xuatToKhaiExcel.ts
       -> Promise.all([
            taiChiTietTheoChieu(ky, "purchase"),      // getBangKeChiTiet -> GET /to-khai/hoa-don/chi-tiet?...&chieu=purchase
            taiChiTietTheoChieu(ky, "sold"),          //                     ...&chieu=sold
            getDanhMucTraCuuGoc().catch(() => undefined), // KHÔNG chặn export nếu lỗi — chỉ ảnh hưởng cột "URL tra cứu"
          ])
       -> 1 trong 2 lượt /chi-tiet lỗi -> taiChiTietTheoChieu ném Error("Không tải được dữ liệu
          hóa đơn {mua vào|bán ra}: <message BE>", {cause}) NGAY LẬP TỨC — KHÔNG import("exceljs"),
          KHÔNG dựng workbook, KHÔNG tải file (E-to-khai-gtgt01-001)
       -> cả hai OK -> import("exceljs") lazy -> dựng sheet "01-GTGT" (+ "PL 204-2025" nếu có,
          logic CŨ không đổi) -> themSheetHd(purchase) -> themSheetHd(sold) -> themSheetChiTiet(purchase)
          -> themSheetChiTiet(sold)   // CẢ HAI sheet "HĐ..." trước, CẢ HAI sheet "Chi tiết..." sau
          (thứ tự file thật: 01-GTGT | PL 204-2025 | HĐ mua vào | HĐ bán ra | Chi tiết mua vào |
          Chi tiết bán ra — RVW-T09, KHÔNG xen kẽ theo chiều)
             -> themSheetHd: addStyledSheet(wb, "HĐ mua vào"/"HĐ bán ra", overviewToKhai(chieu), toKhaiRowsFromBangKe(...))
             -> themSheetChiTiet: addStyledSheet(wb, "Chi tiết mua vào"/"Chi tiết bán ra",
                [COT_STT_CHI_TIET, ...detailColumns(chieu)], detailRows)   // cột STT chèn ĐẦU (RVW-T12)
       -> luuVeMay(blob, tenFile(ky))
  -> finally: setDangXuatExcel(false)                // mở khóa dù thành công hay lỗi
```

### Quy ước Query Key / cache

Không có query key mới cho đợt này — `getBangKeChiTiet` là lời gọi **one-shot bên trong hàm xuất
Excel** (không qua TanStack Query, không cache), giống hệt cách `getXml`/`xuatToKhaiGtgt01` cũ gọi
API trực tiếp lúc bấm nút thay vì `useQuery`. Bảng kê hiển thị trên màn hình (`useBangKeQuery`,
`toKhaiKeys.bangKe`) KHÔNG đổi — vẫn gọi `GET /to-khai/hoa-don` như cũ, độc lập với endpoint mới.

### Chỗ TUYỆT ĐỐI không được nhân đôi logic (single source of truth, phần FE)

1. **`toKhaiRowsFromBangKe`** (`ky.ts`) — DUY NHẤT nơi ánh xạ `datas` (BE) sang `ToKhaiRow[]`. Dùng
   CHUNG cho bảng web (`BangKeMotChieu.tsx`) và sheet Excel "HĐ..." (`xuatToKhaiExcel.ts`). Sửa cách
   map ở một trong hai nơi mà không sửa hàm này = web và Excel lệch nhau.
2. **`toDetailRows`** (`hddt/detailRow.ts`) — DUY NHẤT nơi bung 1 hóa đơn (raw GDT) thành các dòng
   hàng hóa. Sheet "Chi tiết..." của `to_khai` TÁI DÙNG NGUYÊN hàm này (giống tab "Chi tiết hoá đơn"
   của `hddt`), không viết bản riêng. Hóa đơn `chiTiet === null` truyền THẲNG `datas[i]` (chính dòng
   bảng kê) làm tham số `detail` — `InvoiceRaw` đã cùng tên field GDT (`khmshdon`/`khhdon`/`shdon`/
   `tdlap`/`nbmst`/`nbten`/`nmmst`/`nmten`/`msttcgp`...) nên `toDetailRows` đọc đúng, chỉ không có
   `hdhhdvu` nên trả về 1 dòng `EMPTY_LINE` (cột hàng hóa trống) — KHÔNG viết nhánh `if (chiTiet ===
   null)` riêng ở `to_khai`.
3. **`overviewToKhai(direction)`** (`templates/cotBangKe.ts`) — DUY NHẤT bộ cột 26 cột của sheet
   "HĐ..." VÀ bảng web `BangKeMotChieu`. **`detailColumns(direction)`** (`hddt/templates`) — DUY
   NHẤT bộ cột sheet "Chi tiết..." VÀ bảng web "Chi tiết hoá đơn" bên `hddt`. `to_khai` KHÔNG sửa
   `detailColumns` — chỉ CHÈN THÊM `COT_STT_CHI_TIET` (`xuatToKhaiExcel.ts`) ở đầu mảng khi gọi
   `addStyledSheet`, vì `detailColumns` không có cột STT (bảng web "Chi tiết hoá đơn" bên `hddt`
   không cần, vì đã có tab "Tổng quát" cạnh nó) còn AC-to-khai-gtgt01-007 của `to_khai` thì đòi
   (RVW-T12) — KHÔNG khai lại toàn bộ bộ cột riêng cho Excel.
4. **`addStyledSheet`** (`hddt/exportXlsx.ts`, nay đã `export`) — DUY NHẤT hàm dựng 1 sheet có
   tiêu đề/nền/freeze/auto-filter/hàng tổng. `to_khai` TÁI DÙNG hàm này cho 4 sheet mới thay vì viết
   lại (sheet "01-GTGT"/"PL 204-2025" vẫn dựng tay bằng `ws.addRow` — đó là bố cục mẫu in đặc thù,
   KHÔNG đi qua `addStyledSheet`, cố tình khác).
5. **`dienGiaiChiTieuTangGiam`** (BE) — FE KHÔNG tự map lại "tang"/"giam" sang "37"/"38" ở bất kỳ
   đâu. FE luôn nhận giá trị BE đã diễn giải sẵn qua `GET /to-khai/hoa-don` và `GET /to-khai/hoa-don/
   chi-tiet` (cùng field `chiTieuTangGiam` trên mỗi dòng).

### Chỗ dễ nhầm

- **`GET /to-khai/hoa-don/chi-tiet` gọi 2 lần (purchase/sold), KHÔNG gọi thêm `GET /to-khai/hoa-don`**
  — sheet "HĐ..." (`themSheetHd`) và sheet "Chi tiết..." (`themSheetChiTiet`) của MỘT chiều CÙNG
  nhận 1 `ketQua`/`replacedBy` (tách hàm để giữ đúng thứ tự sheet — RVW-T09 — nhưng vẫn 1 nguồn dữ
  liệu/chiều), nên không thể lệch tập hóa đơn dù BE có đổi gì sau này. Nếu sau này cần thêm cột gì
  cho sheet "HĐ...", đọc từ `ketQua.datas`, đừng gọi thêm `getBangKe`.
- **STT sheet "Chi tiết..." lấy theo VỊ TRÍ (`i + 1`), KHÔNG tra `invoiceSttMap`** — khác hẳn cách
  `InvoiceListTabs.tsx` (module `hddt`) làm (`sttOf.get(key)`, tra theo khóa vì 2 truy vấn riêng có
  thể lệch thứ tự). Ở đây "HĐ..." và "Chi tiết..." CÙNG lấy từ 1 mảng `datas` nên vị trí luôn khớp —
  dùng `invoiceSttMap` ở đây là thừa và sai nếu lỡ import nhầm.
- **`xuatToKhaiExcel.ts` không phải React component** — không gọi được `useDanhMucTraCuuGocQuery()`
  (hook). Phải gọi thẳng hàm async `getDanhMucTraCuuGoc()` (cùng module `hddt/api/traCuuGoc.ts`),
  không có cache/staleTime như bản hook; chấp nhận được vì đây là thao tác one-shot lúc xuất file.
- **Lỗi tải dữ liệu phải ném TRƯỚC `import("exceljs")`** — nếu sau này thêm bước tải dữ liệu nào
  khác vào `xuatToKhaiGtgt01`, phải đặt trước dòng `await import("exceljs")` và trước
  `wb.addWorksheet("01-GTGT")`, nếu không sẽ vi phạm "chỉ dựng workbook khi mọi lượt tải đều thành
  công" (không tải file dở dang) và phá luôn RVW-T02 (giữ exceljs lazy, không kéo vào chunk route).
- **Đổi mã "Chỉ tiêu tăng giảm" là breaking change theo cặp** (RVW-T05) — BE (đã đổi) và FE (đợt
  này) BẮT BUỘC deploy CÙNG LƯỢT. FE cũ (`"tang"/"giam"`) gọi BE mới → `locQuyetDinh` âm thầm bỏ
  field, PATCH vẫn `200 {ok:true}` nhưng KHÔNG lưu gì.
