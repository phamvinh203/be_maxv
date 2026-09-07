---
type: adr
feature: hrm
status: accepted
updated: 2026-09-07
---

# ADR-005: Envelope lỗi, phân trang danh sách và cách truyền file scan

## Context

Ba chuyện tưởng riêng nhưng cùng một gốc: **hợp đồng giữa backend và client chưa đủ chặt để dùng
lâu dài**, và cả ba đều sẽ đau khi dữ liệu lớn lên hoặc khi Payroll cần đọc HRM.

### A. Lỗi chỉ có `message`, không có mã máy-đọc-được

Envelope lỗi hiện tại (`errorHandler.plugin.ts:23-109`):

```jsonc
{ "success": false, "message": "Phòng ban \"PB01\" đang có 3 nhân viên (2 đang làm, 1 đã nghỉ), không thể xóa." }
```

Client **không có cách nào** phân biệt các loại 409 khác nhau ngoài việc so khớp chuỗi tiếng Việt.
Hệ quả đã thấy: `qa/test-cases.md` TC-PB-02 so khớp message và **đang sai** — thiếu cụm
`" trong cây tổ chức"`. Mỗi lần sửa chữ là hỏng test và có thể hỏng cả nhánh xử lý ở FE.

Riêng **400** lại có hình dạng **khác hẳn** (`errors` thay vì `message`, `validate.ts:10`) — FE phải
xử lý hai nhánh, và đây là chỗ hay bị bỏ sót khi hiển thị toast.

### B. Không có phân trang ở bất kỳ endpoint list nào

| Endpoint | Trả về | Rủi ro |
|:---|:---|:---|
| `GET /phong-ban` | Mọi phòng ban | Thấp (danh mục nhỏ) |
| `GET /nhan-vien` | **Mọi** nhân viên + hợp đồng hiện hành từng người | 2.000 nhân viên = 1 phản hồi vài MB |
| `GET /hop-dong` | **`ma_nv` KHÔNG bắt buộc** ⇒ gọi trần trả **toàn bộ lịch sử lương của cả công ty** | 🚨 Vừa nặng vừa là vấn đề bảo mật |
| `GET /nguoi-phu-thuoc` | Mọi NPT | Trung bình |
| `GET /tai-lieu` | Mọi tài liệu; `?loai=` so khớp **chính xác, phân biệt hoa thường** trên một cột chữ tự do ⇒ `?loai=CCCD` không ra dòng lưu `cccd` | Trung bình |

Thứ tự sắp xếp cố định phía server, client không đổi được. Param lạ bị Zod **bỏ qua im lặng**
(schema không `.strict()`) ⇒ FE gõ sai tên param không hề biết.

### C. `GET /tai-lieu/:id/file` nạp trọn file vào RAM

`layNoiDungFile` đọc từng khối rồi `Buffer.concat` (`driveClient.ts:411-423`), `taiFileVe` trả
`Buffer`, controller `reply.send(buffer)` (`taiLieu.controller.ts:338-357`).

Với trần 10 MB: 20 người cùng mở hồ sơ = **200 MB RSS** cộng thêm bản sao trong quá trình
`Buffer.concat`. Máy chủ là Windows Server chạy PM2 một tiến trình cho toàn bộ tenant ⇒ đây là tài
nguyên **dùng chung giữa mọi công ty**. Tài liệu cũ gọi việc này là "streaming" — không đúng.

Điểm quan trọng: **việc chặn 10 MB ở đường về là đúng và phải giữ** (file nằm trên Drive của khách,
họ thay bằng file 2 GB lúc nào cũng được). Vấn đề chỉ là **gom hết vào RAM rồi mới gửi**.

## Decision

### 1. Envelope lỗi: thêm `code`, GIỮ NGUYÊN `message` và mọi HTTP status

```jsonc
// Lỗi nghiệp vụ
{ "success": false, "code": "E-hrm-014", "message": "Phòng ban \"PB01\" đang có 3 nhân viên…" }

// Lỗi validate — THÊM message, giữ errors
{ "success": false, "code": "E-hrm-006", "message": "Dữ liệu không hợp lệ",
  "errors": { "formErrors": [], "fieldErrors": { "ngay_ket_thuc": ["Ngày kết thúc phải sau ngày bắt đầu"] } } }
```

- `code` là **thêm mới**, không bỏ trường nào ⇒ **không breaking**. Client cũ chạy nguyên.
- Bảng mã đã liệt kê sẵn ở `api-contract.md` Mục 8 (`E-HRM-{NHÓM}-{NN}`), hiện đang là định danh
  **cấp tài liệu**; ADR này biến chúng thành **định danh thật trong phản hồi**.
- **Bổ sung `message` cho nhánh 400** để client có một đường xử lý duy nhất; `errors` giữ nguyên
  cho form hiển thị lỗi từng ô.
- Cách cài: `AppError` (`helpers/errors.ts:4-11`) nhận thêm `code` tùy chọn; các lớp con truyền
  vào; `errorHandler` đọc ra. Lỗi chưa gắn `code` ⇒ dùng mã mặc định theo nhóm HTTP
  (`E-hrm-054` cho 500…). **Không** ép gắn mã cho toàn bộ dự án cùng lúc — HRM làm mẫu trước.

**Không** đổi HTTP status của bất kỳ endpoint nào. Cụ thể **giữ 201 cho mọi POST** — QA phải sửa
kỳ vọng chứ không phải backend hạ xuống 200.

### 2. Phân trang: chọn lọc, KHÔNG áp đại trà

| Endpoint | Quyết định | Lý do |
|:---|:---|:---|
| `GET /nhan-vien` | **Thêm** `limit` (1..500, mặc định **200**) + `offset` (≥0, mặc định 0), trả `X-Total-Count` | Bảng lớn nhất, và mỗi dòng còn kéo theo hợp đồng hiện hành |
| `GET /hop-dong` | **`ma_nv` thành BẮT BUỘC** | Không phải chuyện phân trang mà là **phạm vi truy cập**: không ai có nhu cầu nghiệp vụ đọc lương cả công ty trong một lượt. Lịch sử hợp đồng của 1 nhân viên tối đa vài chục dòng ⇒ không cần phân trang. **Có phá FE hiện tại** — xem Trade-offs |
| `GET /nguoi-phu-thuoc`, `GET /tai-lieu` | Thêm `limit`/`offset` cùng quy ước, mặc định 200 | Đồng nhất; thực tế hiếm khi chạm trần |
| `GET /phong-ban` | **Không** phân trang | Danh mục nhỏ, và FE cần **toàn bộ** cây để dựng cấu trúc phân cấp. Phân trang một cái cây là làm hỏng nó |

Quy ước chung (áp cho endpoint có phân trang):

```
?limit=200&offset=0        limit: int 1..500, mặc định 200
                           offset: int >= 0, mặc định 0
Header trả về: X-Total-Count: <tổng số dòng khớp bộ lọc, KHÔNG tính limit>
```

Chọn `limit`/`offset` chứ không phải cursor: mọi endpoint đều sắp xếp theo khóa chính hoặc khóa
ổn định, và người dùng cần nhảy tới trang bất kỳ. Cursor giải bài toán "danh sách thay đổi liên
tục" mà HRM không có.

`X-Total-Count` chứ không bọc `{ data, total }`: **không đổi hình dạng `data`** ⇒ client cũ chạy
nguyên, đây vẫn là thay đổi không-breaking.

**Sửa kèm:** `?loai=` của `GET /tai-lieu` đổi sang `contains` + `mode: 'insensitive'` (đang là so
khớp chính xác phân biệt hoa thường trên cột chữ tự do — sai từ đầu, `taiLieu.service.ts:59`).

**Không** thêm `sort`/`order` do client chọn: thứ tự hợp đồng là **luật nghiệp vụ**
(`sapXepHopDong` quyết định "hợp đồng hiện hành" là cái nào, `ADR-002`), cho client đổi là mở đường
cho kết quả không xác định.

### 3. Truyền file: chuyển sang pipe stream, giữ nguyên trần 10 MB

`driveClient` thêm hàm **trả `Response` của Drive** thay vì `Buffer`; controller `reply.send()`
thẳng thân stream đó. Fastify nhận Readable stream và truyền tiếp, không gom vào RAM.

Vẫn **giữ đủ hai lớp chặn 10 MB**:

1. `content-length` do Drive khai > trần ⇒ **từ chối ngay**, chưa đọc byte nào (rẻ, chặn được 99% ca).
2. Không có/`content-length` gian dối ⇒ đếm dồn trong lúc pipe, vượt trần thì **hủy stream**
   (`res.body.cancel()`) và ngắt kết nối.

Lưu ý cài đặt (phải làm đúng, không thì đổi nửa vời còn tệ hơn):

- Lỗi Drive (404, 502) xảy ra **trước** khi gửi byte đầu tiên ⇒ vẫn ánh xạ được sang JSON lỗi bình
  thường. Sau khi đã gửi header thì **không** đổi status được nữa — đây là lý do phải kiểm
  `res.ok` và `content-length` **trước** khi bắt đầu pipe.
- Thân stream của `fetch` là Web `ReadableStream`; Node 22 có `Readable.fromWeb()` để chuyển sang
  Node stream cho Fastify.
- Header giữ nguyên: `Content-Type` theo mime đã lưu, `Content-Disposition: inline; filename*=UTF-8''…`,
  `Cache-Control: no-store, private`, `X-Content-Type-Options: nosniff`. **Thêm** `Content-Length`
  khi Drive có khai — để trình duyệt hiện được thanh tiến trình.

## Alternatives

| # | Chủ đề | Phương án | Kết luận |
|:---:|:---|:---|:---|
| A1 | Mã lỗi | Đổi hẳn sang RFC 7807 `application/problem+json` | Không chọn — breaking toàn bộ client, và envelope `{success,data}` đã dùng thống nhất trong cả dự án |
| A2 | Mã lỗi | Giữ nguyên chỉ `message` | Không chọn — QA đang phải so khớp chuỗi tiếng Việt và **đã sai một ca** |
| A3 | Mã lỗi | **Thêm `code`, giữ mọi thứ khác** | **Chọn** — không breaking, giải đúng vấn đề |
| B1 | Phân trang | Cursor-based cho mọi list | Không chọn — phức tạp hơn nhu cầu; người dùng cần nhảy trang bất kỳ |
| B2 | Phân trang | Bọc `{ data: [], total, page }` | Không chọn — **breaking** với mọi client hiện có |
| B3 | Phân trang | `limit`/`offset` + `X-Total-Count`, áp chọn lọc | **Chọn** |
| B4 | Phân trang | Không làm gì, chờ khách kêu chậm | Không chọn cho `GET /hop-dong` — đó là vấn đề **bảo mật**, không phải hiệu năng |
| C1 | File | Giữ buffer, hạ trần xuống 5 MB | Không chọn — ảnh CCCD chụp điện thoại thường 3–8 MB, hạ trần là chặn nghiệp vụ thật |
| C2 | File | Redirect 302 sang link Drive tạm | Không chọn — `drive.file` không cấp link công khai; và người xem sẽ bị đòi đăng nhập tài khoản Google (xem `ADR-003` mục 8) |
| C3 | File | **Pipe stream, giữ trần 10 MB** | **Chọn** |
| C4 | File | Cache file ở đĩa máy chủ | Không chọn — MAXV cố ý **không** giữ bản sao dữ liệu cá nhân của khách (`ADR-003`) |

## Trade-offs

- **Nhận (mã lỗi):** phải gắn `code` cho ~30 chỗ `throw` trong HRM. Cơ học nhưng nhiều điểm chạm;
  gắn sót thì rơi về mã mặc định — chấp nhận được, không vỡ gì.
- **Nhận (phân trang):** `GET /hop-dong` bắt buộc `ma_nv` là **breaking change THẬT** với FE hiện
  tại. Đã kiểm và phải nói thẳng: `hdđt_maxv/src/features/hrm/api/hopDongQueries.ts:67-75`
  (`useDanhSachHopDong`) gọi **`listHopDong()` KHÔNG tham số** — tức tải **toàn bộ lịch sử hợp đồng
  của cả công ty** về trình duyệt, rồi `useHopDongList(maNv)` (`:78-91`) mới `filter` phía client
  theo `ma_nv`.

  Nghĩa là: **lương của mọi nhân viên đang được gửi xuống máy của bất kỳ ai mở màn hồ sơ**, kể cả
  khi họ chỉ xem một người. Đây không còn là chuyện hiệu năng — nó là **rò rỉ dữ liệu qua thiết kế
  tầng client**, và không guard nào ở backend che được vì backend đang cho phép gọi trần.

  ⇒ Việc này **phải làm đồng thời cả hai đầu**, không tách sprint: FE đổi `useDanhSachHopDong`
  thành query theo `ma_nv` (`queryKey: hrmHopDongKeys.byNv(maNv)`, `queryFn: () => listHopDong({ ma_nv })`,
  `enabled: !!maNv`) **trước hoặc cùng lúc** với việc BE bắt buộc `ma_nv`. Đổi FE trước là an toàn:
  BE cũ vẫn nhận `ma_nv` bình thường.
- **Nhận (file):** xử lý lỗi khi stream đã bắt đầu phức tạp hơn; phải test kỹ ca "Drive đứt giữa
  chừng" (client nhận file cụt, không có thông báo lỗi). Bù lại RAM không còn tỉ lệ với số người
  xem đồng thời.
- **Đổi lấy:** client phân biệt được lỗi mà không so chuỗi; lương cả công ty không còn lấy được
  bằng một lượt gọi; RAM máy chủ không phụ thuộc số người xem file.

## Consequences

- **Thứ tự triển khai đề xuất** (bước 1 phải làm FE trước/cùng lúc; các bước còn lại độc lập):
  1. **FE** đổi `useDanhSachHopDong` sang query theo `ma_nv` → **BE** bắt buộc `ma_nv`.
     **Ưu tiên cao nhất** — là vấn đề rò rỉ dữ liệu lương, không phải hiệu năng.
  2. Sửa `?loai=` sang `insensitive`.
  3. Thêm `code` vào envelope lỗi.
  4. `limit`/`offset` + `X-Total-Count`.
  5. Pipe stream file.
- **Backend Engineer:** sửa `helpers/errors.ts`, `plugins/errorHandler.plugin.ts`,
  `validators/hrm/*.validator.ts` (thêm `limit`/`offset`, đổi `ma_nv` của `hopDongListQuerySchema`
  thành bắt buộc), `services/client/hrm/*.service.ts` (`take`/`skip` + `count`),
  `services/client/hrm/driveClient.ts` + `taiLieu.controller.ts` (stream).
  **Đặt `limit`/`offset` vào một schema Zod dùng chung** trong `validators/shared/primitives.ts` —
  đừng chép 4 lần.
- **Frontend (`hdđt_maxv`):**
  - **Bắt buộc, làm trước:** `hopDongQueries.ts` — bỏ kiểu "tải hết rồi lọc client", chuyển sang
    query theo `ma_nv`. Đây là điều kiện để BE khóa được endpoint.
  - Dùng `code` thay vì so khớp `message`; đọc `X-Total-Count` nếu làm phân trang trên UI.
  - Các thay đổi còn lại tương thích ngược, không bắt buộc sửa ngay.
- **API contract:** cập nhật `api-contract.md` Mục 1.2 (thêm `code`), 1.6 (phân trang), 4.1
  (`ma_nv` bắt buộc), 6.1 (`loai` insensitive), 7.7 (stream) khi code xong. Bảng mã Mục 8 giữ
  nguyên — nó đã được viết sẵn cho đích đến này.
- **Tester-QA:** kỳ vọng `code` ổn định thay vì chuỗi tiếng Việt (sửa được ca TC-PB-02 đang sai);
  thêm ca `GET /hop-dong` **không** `ma_nv` ⇒ **400**; ca `limit` vượt 500 ⇒ 400; ca tải file
  8 MB kiểm RSS máy chủ không tăng theo số người xem đồng thời.
