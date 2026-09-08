---
type: adr
feature: hrm
status: accepted
updated: 2026-09-07
---

# ADR-003: Lưu file scan hồ sơ trên Google Drive cấp doanh nghiệp

> **Bản sửa 2026-09-07.** Bản trước đúng về hướng nhưng thiếu và sai vài chi tiết bảo mật quan
> trọng: chỉ nhắc `driveRefreshTokenCipher` (thiếu `Iv`/`Tag`, mà AES-GCM cần đủ ba); chưa nêu cơ
> chế **khóa `state` vào cookie** (đây mới là thứ chặn được vé bị nhặt lại); chưa nêu quy tắc
> **chỉ xóa token khi `invalid_grant`**; chưa nêu **CSP + escape HTML** ở callback; và chưa nêu
> ba lỗ hổng vòng đời còn tồn tại (file mồ côi, buffer 10 MB trong RAM, khóa thư mục chỉ trong
> tiến trình). Bản này bổ sung đủ, có `file:line`.

## Context

Doanh nghiệp cần số hóa hồ sơ nhân sự: CCCD scan, bằng cấp, chứng chỉ, hợp đồng đã ký.

**Vì sao không lưu file trong Postgres:** cột `bytea` làm DB phình rất nhanh, mà MAXV là
**DB-per-tenant** — mỗi công ty một database, backup/restore phải quét động toàn bộ. Nhồi ảnh scan
vào đó là nhân chi phí sao lưu lên nhiều lần trên **mọi** tenant.

**Vì sao không dùng object storage của MAXV (S3/MinIO):** ảnh CCCD, bằng cấp của nhân viên khách
hàng là dữ liệu cá nhân nhạy cảm. Giữ hộ nghĩa là MAXV nhận trách nhiệm pháp lý bảo vệ, trách nhiệm
xóa theo yêu cầu, và chi phí dung lượng tăng tuyến tính theo số khách. Để trên Drive **của chính
khách** thì dữ liệu thuộc về họ, MAXV chỉ là công cụ ghi vào.

**Vì sao KHÔNG theo bản tham khảo** (`docs/nestjs/hr` ADR-004 dùng
`GoogleDriveConnection.userId` — kết nối theo **người dùng cá nhân**): nhân sự HR nghỉ việc hoặc
xóa tài khoản Google cá nhân là công ty **mất toàn bộ** hồ sơ. Với mô hình SaaS nhiều công ty của
MAXV, đây là lỗi thiết kế không chấp nhận được.

**Rủi ro phải xử lý khi để token ngoài Postgres:**

1. Refresh token mở được **mọi** file app đã tạo trong tài khoản đó — rò rỉ DB là rò rỉ hồ sơ.
2. Luồng OAuth có callback **không đăng nhập được** (điều hướng top-level từ `accounts.google.com`,
   cookie `SameSite=Strict` không gửi kèm) ⇒ phải có cơ chế xác thực thay thế.
3. Một OAuth client dùng chung cho **mọi** tenant ⇒ một sai lầm xử lý lỗi có thể ảnh hưởng tất cả.
4. File nằm trên Drive của khách ⇒ họ đổi/xóa/thay file bất cứ lúc nào, backend phải chịu được.

## Decision

### 1. Kết nối ở cấp CÔNG TY, lưu trong `don_vi` của DB `maxv2_sys`

5 cột trên `DonVi` (`sys/schema.prisma:95-100`): `driveEmail`, `driveRootFolderId`,
`driveRefreshTokenCipher`, `driveRefreshTokenIv`, `driveRefreshTokenTag`.

Refresh token mã hóa **AES-256-GCM** bằng khóa `GDT_CRED_ENC_KEY` (32 byte, base64) — dùng lại
`services/client/hddt/gdtCredential.ts` (module thuần crypto, đã phục vụ mật khẩu cổng thuế và DVC).
**Ba cột luôn cùng null hoặc cùng có giá trị**; thiếu bất kỳ cột nào ⇒ coi như chưa kết nối
(`taiLieuDrive.service.ts:193-199`). Không có khóa mã hóa ⇒ **từ chối lưu** (`:87-93`), thà không
kết nối được còn hơn để token nằm trần trong DB.

### 2. Scope tối thiểu `drive.file`

`https://www.googleapis.com/auth/drive.file email` (`driveClient.ts:32`) — app chỉ thấy file **do
chính nó tạo**, không đọc được dữ liệu Drive sẵn có của khách. Đây là scope "non-sensitive", không
phải qua kiểm định CASA của Google. `email` chỉ để hiển thị "đang dùng Drive của tài khoản nào".

`access_type=offline` + `prompt=consent` là **bắt buộc** (`:132-147`): Google chỉ trả refresh token
ở lần đồng ý đầu tiên; thiếu `prompt=consent` thì lần kết nối lại sau khi khách thu hồi quyền sẽ
không có token mới và tính năng **chết âm thầm**.

### 3. Bảo vệ luồng OAuth bằng ba lớp (không chỉ HMAC)

Callback cố ý **miễn đăng nhập** (`taiLieu.route.ts:29-33`). Thay vào đó:

| Lớp | Cơ chế | Chặn được gì | Bằng chứng |
|:---:|:---|:---|:---|
| 1 | `state` = `base64url(donViId.hạn.nonce9byte)` + **HMAC-SHA256**, hạn 10 phút, so bằng `timingSafeEqual` | Giả mạo state để nối Drive cho công ty khác | `driveClient.ts:453-489` |
| 2 | **`state` phải khớp cookie `driveOauthState`** (httpOnly, `SameSite=Lax`, `path` = đúng path callback, `maxAge` 600s), và cookie bị **xóa ngay** trước mọi nhánh trả về | **Vé đã phát bị nhặt lại**: state đi qua URL nên nằm trong thanh địa chỉ popup, lịch sử trình duyệt, log Google và log truy cập của mình. Ai nhặt được có thể chạy hết luồng đồng ý bằng **tài khoản Google của họ** rồi nộp vào callback ⇒ mọi file scan của công ty nạn nhân đổ vào Drive của họ. Lớp 1 **không** chặn được điều này | `taiLieu.controller.ts:99-118, 224-245` |
| 3 | Trang HTML trả về: escape 5 ký tự cho **mọi** chuỗi (`thoatHtml`) + **CSP nonce** (`default-src 'none'; script-src 'nonce-…'`) + `nosniff` | XSS phản chiếu trên origin API. `httpOnly` **không** cứu được: nó chặn script *đọc* cookie, chứ script cùng origin vẫn gọi API kèm cookie bình thường | `:169-181, 205-222` |

Thêm: **`state` dùng tiền tố tách miền `drive-state|`** khi ký (`driveClient.ts:455-467`) — cùng
một khóa bí mật đang phục vụ hai giao thức (JWT truy cập và state OAuth); thiếu tiền tố thì chỉ cần
ai đó đổi cấu trúc `than` là chữ ký state biến thành cỗ máy ký JWT hộ.

Thêm: **log cắt query string cho MỌI route** (serializer trong `app.ts`) — `code` (đổi được ra
refresh token) và `state` nằm trên query, không được ghi vào file log.

### 4. Phân quyền: nối lần đầu ai cũng được, ĐỔI/NGẮT chỉ OWNER

| Thao tác | Ai | Lý do |
|:---|:---|:---|
| Nối **lần đầu** | Mọi user có quyền MST | Luồng "bấm thêm file → đăng nhập Google" phải chạy trọn ngay tại chỗ; chặn ở đây là kế toán không đính được file nào cho tới khi gọi được chủ tài khoản |

> ⚠️ **Mâu thuẫn đã được Tester-QA chỉ ra (`BUG-HRM-11`, 🟠 High) — chưa chốt.** Cho mọi user nối
> lần đầu nghĩa là một nhân viên thường có thể nối kho tài liệu của **cả công ty** vào **Drive cá
> nhân của chính họ**. Điều đó đi ngược đúng cái `BR-05.1` muốn bảo vệ ("tài liệu thuộc doanh
> nghiệp, không phụ thuộc cá nhân") — chính là lý do MAXV **không** theo mô hình kết nối cấp người
> dùng của bản tham khảo.
>
> Lập luận UX ở trên là thật và có giá trị, nhưng nó **đổi chủ sở hữu kho tài liệu**, nên không
> phải quyết định kỹ thuật. Đưa lên BA: **OQ-ARCH-09**. Ba hướng:
> (a) giữ nguyên + hiện cảnh báo rõ trên màn hình trước khi mở popup ("file sẽ nằm trên Drive của
> tài khoản Google bạn sắp đăng nhập — hãy dùng tài khoản chung của công ty");
> (b) chỉ OWNER được nối lần đầu, người khác thấy hướng dẫn "liên hệ chủ tài khoản";
> (c) ai cũng nối được nhưng OWNER phải **duyệt** trước khi kho được dùng chính thức.
> Kiến trúc nghiêng về **(a)** — rẻ nhất và giữ được luồng nghiệp vụ — nhưng đây là lựa chọn của BA.
| **Đổi** sang tài khoản Google khác | **Chỉ OWNER** | Chuyển kho tài liệu của cả công ty sang Drive người vừa đăng nhập |
| **Ngắt** kết nối | **Chỉ OWNER** | Cắt đường xem/tải file scan của **mọi** người dùng |

Kiểm ở controller chứ không dùng `app.requireRole` ở route, để nói được **đúng lý do** —
`requireRole` chỉ trả câu chung "không có quyền", người dùng không biết phải nhờ ai
(`taiLieu.controller.ts:141-156, 276-286`).

Ba endpoint `/drive/*` không đi qua `resolveTenantDb` nên **tự kiểm lại quyền** bằng
`donViDangChon()` → `canAccessDonVi()` (`:84-91`). Cần thiết vì access token sống 15 phút và cố ý
không đối chiếu DB mỗi request: người vừa bị gỡ quyền vào MST vẫn cầm token hợp lệ tới khi hết hạn,
mà đây đúng là chỗ đọc/ngắt/đổi kho tài liệu của cả công ty. `requireModule('hrm')` **không** lấp
được chỗ này (nó xét gói dịch vụ của chủ tài khoản, không xét quyền vào MST cụ thể).

### 5. Chỉ xóa token đã lưu khi Google trả ĐÚNG mã `invalid_grant`

`accessTokenCuaDonVi` (`taiLieuDrive.service.ts:231-244`) bắt **mã lỗi máy-đọc-được**, **không**
bắt theo dải 4xx.

Lý do là ràng buộc sống còn của mô hình một-OAuth-client-cho-mọi-tenant: cùng endpoint đó còn trả
4xx cho `invalid_client` (người vận hành đổi `GOOGLE_CLIENT_SECRET` mà cập nhật env sai) và 429
(nhiều tenant tải file cùng lúc). **Bắt theo dải thì một lần gõ nhầm env sẽ xóa refresh token của
TOÀN BỘ tenant**, và sửa lại env cũng không cứu được vì token đã mất khỏi DB — mọi công ty phải
đăng nhập Google lại.

Cùng tinh thần: `DriveApiError.status = 0` là quy ước riêng cho "**không nhận được phản hồi nào**"
(mất mạng, DNS, tường lửa, hết thời gian chờ) — chọn số 0 để nằm ngoài mọi khoảng đang xét
(`>= 400 && < 500`, `=== 404`), đảm bảo sự cố mạng tạm thời **không bao giờ** bị hiểu nhầm thành
"khách đã thu hồi quyền" rồi tự ngắt kết nối Drive của họ (`helpers/errors.ts:61-65`).

### 6. Cây thư mục nhớ theo ID, không tra theo tên

`maxv / <MST> - <tên công ty> / <ma_nv> - <họ tên> / <file scan>`, tạo **lười**.
ID lưu ở `don_vi.driveRootFolderId` (cấp công ty) và `hrm_nhan_vien.drive_folder_id` (cấp nhân
viên). Drive **cho phép trùng tên** và khách đổi tên/kéo thả lúc nào cũng được ⇒ bám theo tên là
đứt liên kết lúc nào không hay.

**Đổi tài khoản Google ⇒ phải quên mọi `drive_folder_id`** (`quenThuMucNhanVien`, `:150-161`).
Với scope `drive.file`, tài khoản mới **không nhìn thấy** thư mục của tài khoản cũ ⇒ Drive trả 404
⇒ mọi lần tải file cho nhân viên ấy hỏng **vĩnh viễn**, bấm ngắt rồi nối lại cũng không cứu vì vẫn
đi đúng đường đó. Xóa an toàn, không mất gì: `taoThuMucNeuChua` tìm theo tên trước khi tạo.

**Cố ý KHÔNG đụng `hrm_tai_lieu.drive_file_id`** khi đổi tài khoản: file không tìm lại được theo
tên như thư mục; xóa con trỏ là xóa luôn dấu vết khách từng đính giấy tờ gì. File cũ vẫn nằm nguyên
ở tài khoản trước đó — việc của mình là **báo đúng chuyện đó**, và thông điệp `DRIVE_FILE_KHONG_MO_DUOC`
(`messages.ts:130-131`) cố ý **không khẳng định "đã bị xóa"**, vì Drive trả 404 cho cả trường hợp
file vẫn còn nguyên nhưng ở tài khoản cũ. Nói chắc là xóa mất sẽ làm khách tưởng mất giấy tờ thật.

### 7. Giới hạn tệp: chặn hai lớp, cả đường lên lẫn đường về

| | Đường lên | Đường về |
|:---|:---|:---|
| Trần | 10 MB — `@fastify/multipart` `limits.fileSize` (`app.ts`) **và** `GIOI_HAN_FILE_BYTE` ở service (`taiLieuDrive.service.ts:43,322-326`) | 10 MB — kiểm `content-length` **và** đếm dồn từng khối, dừng ngay khi vượt (`driveClient.ts:400-422`) |
| Số file | `limits.files = 1` | — |
| MIME | Danh sách trắng: `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `application/pdf` (`:46-52,327-331`) | Trả đúng mime đã lưu + `nosniff` |

**Chặn cả đường về là bắt buộc, không thừa:** file nằm trên Drive **của khách** — sau khi app tải
lên 2 MB, chính họ mở Drive thay bằng file 2 GB lúc nào cũng được; không chặn thì đường về thành
lỗ hổng nuốt RAM máy chủ.

### 8. Proxy file qua backend, không đưa link Drive

`GET /tai-lieu/:id/file` trả nội dung file kèm `Cache-Control: no-store, private`,
`X-Content-Type-Options: nosniff`, `Content-Disposition: inline`.

**Không** đưa `webViewLink` cho người dùng bấm: link đó mở giao diện Drive và đòi người xem đăng
nhập bằng **tài khoản Google có quyền trên file**. Kế toán đang đăng nhập app bằng tài khoản MAXV,
không liên quan gì tới tài khoản Google của công ty ⇒ họ sẽ gặp màn "cần yêu cầu quyền truy cập".
Proxy qua backend thì quyền do **app** quyết định.

`no-store` vì đây là ảnh CCCD/hợp đồng của nhân viên — không được nằm lại trong cache đĩa của trình
duyệt hay proxy trung gian sau khi người dùng đăng xuất.

## Alternatives

| # | Phương án | Ưu | Nhược | Kết luận |
|:---:|:---|:---|:---|:---|
| **A** | **Drive của khách, kết nối cấp công ty** | Dữ liệu thuộc về khách; MAXV không gánh dung lượng lẫn trách nhiệm pháp lý; DB tenant nhẹ; không phụ thuộc cá nhân HR nào | Khách phải nối 1 tài khoản Google (nên là email chung `ketoan@congty.vn`); mất tài khoản Google = mất file, MAXV **không khôi phục được**; phụ thuộc uptime Google | **Chọn** |
| B | Drive kết nối cấp **người dùng** (bản tham khảo) | Không cần vai trò OWNER; mỗi người tự quản | HR nghỉ việc / xóa tài khoản ⇒ công ty mất hồ sơ; N người = N kết nối phải quản; file rải rác nhiều Drive | Không chọn — lỗi thiết kế với mô hình SaaS nhiều công ty |
| C | Object storage của MAXV (S3/MinIO) | Kiểm soát hoàn toàn, streaming/CDN/quét virus dễ; không phụ thuộc bên thứ ba | MAXV giữ dữ liệu cá nhân nhạy cảm của khách ⇒ trách nhiệm pháp lý + nghĩa vụ xóa; chi phí dung lượng tăng theo số khách; thêm hạ tầng mới phải vận hành | Không chọn **ở giai đoạn này**. Nếu sau này khách yêu cầu SLA lưu trữ hoặc quét virus thì đây là hướng nâng cấp |
| D | `bytea` trong Postgres tenant | Đơn giản nhất, nguyên tử với dữ liệu | Phình DB trên **mọi** tenant, backup/restore nặng lên nhiều lần | Không chọn |
| E | Dùng thư viện `googleapis` thay `fetch` thuần | Ít code hơn, có sẵn retry/refresh | Khối rất lớn kéo theo hàng chục gói con; dự án đang giữ số phụ thuộc tối thiểu và theo dõi `npm audit` (xem memory *maxv Fastify conventions*). Chỉ cần 6 thao tác HTTP | Không chọn (`driveClient.ts:6-14`) |

## Trade-offs

- **Nhận:** phụ thuộc dịch vụ ngoài ⇒ mọi thao tác file có thể trả **502**, và ngoài tầm kiểm soát
  của MAXV. Đã bù bằng thông điệp phân biệt rõ "Google hỏng" (`status != 0`) với "máy chủ mình
  không ra được internet" (`status = 0`) để người dùng biết đi hỏi ai.
- **Nhận:** mất tài khoản Google = mất file, MAXV **không** khôi phục được. Đã ghi rõ trong schema
  (`sys/schema.prisma:92-94`), nhưng **phải nói với khách lúc onboarding** — không được để họ biết
  vào ngày mất.
- **Nhận:** một OAuth client dùng chung cho mọi tenant ⇒ hạn mức (quota) và uy tín ứng dụng dùng
  chung; một tenant lạm dụng làm 429 cho cả nhà. Chấp nhận ở quy mô hiện tại; nếu chạm hạn mức thì
  hướng xử lý là xin nâng quota, **không** phải bắt theo dải 4xx (xem Decision 5).
- **Đổi lấy:** hồ sơ nhân sự thuộc quyền sở hữu vĩnh viễn của doanh nghiệp, DB tenant giữ nguyên
  kích thước nhẹ, và MAXV không nắm giữ ảnh CCCD của người lao động thuộc khách hàng.

## Consequences

### Đã có, đang chạy đúng

Kết nối/ngắt/đổi tài khoản; cây thư mục lười theo ID; upload có trần + danh sách trắng MIME; proxy
file có `no-store`; xử lý token thu hồi theo `invalid_grant`; hàng đợi tạo thư mục chống trùng.

### Ba lỗ hổng vòng đời CÒN LẠI (phải xử lý)

| # | Vấn đề | Bằng chứng | Hướng xử lý |
|:---:|:---|:---|:---|
| **1** | `DELETE /tai-lieu/:id` **không** xóa file trên Drive ⇒ file mồ côi vĩnh viễn, không còn con trỏ nào để dọn. Tài liệu cũ ghi "best-effort xóa file" là **sai sự thật** | `taiLieu.service.ts:124-135` — không có lời gọi Drive nào | `ADR-004` |
| **2** | `taiFileVe` nạp **trọn** file vào RAM (`Buffer.concat`) rồi `reply.send`. 20 người xem đồng thời file 10 MB = 200 MB RSS. Tài liệu cũ gọi là "streaming" — không đúng | `driveClient.ts:411-423`; `taiLieu.controller.ts:338-357` | `ADR-005` |
| **3** | Hàng đợi chống tạo trùng thư mục là `Map` **trong tiến trình** (`hangDoiThuMuc`). Đủ cho topology hiện tại (IIS → **một** tiến trình Node), nhưng chạy nhiều tiến trình PM2 là khóa mất tác dụng ⇒ hai thư mục trùng tên, file rải hai nơi | `driveClient.ts:224-256` (chính comment đã cảnh báo) | Ghi vào `dev-notes.md` như **điều kiện triển khai bắt buộc**: HRM Drive chỉ chạy đúng với 1 instance. Muốn scale phải chuyển sang khóa ở DB |

### Việc cho các vai

- **Backend:** xử lý mục 1 (`ADR-004`) và 2 (`ADR-005`). Không đụng mục 3 nếu chưa scale, nhưng
  **phải** ghi ràng buộc 1-instance vào tài liệu vận hành.
- **DevOps:** `GDT_CRED_ENC_KEY` phải giống hệt nhau giữa các lần triển khai — **đổi khóa là mất
  toàn bộ kết nối Drive của mọi tenant** (giải mã hỏng ⇒ `DRIVE_CAN_KET_NOI_LAI`, khách phải nối
  lại). Đưa vào checklist bảo trì. Ba biến `GOOGLE_*` thiếu thì tính năng **tự tắt**, không làm sập
  app (`driveDaCauHinh()`), nhưng `may_chu_san_sang = false` phải được giám sát.
- **QA:** ca bắt buộc — callback với `state` hợp lệ nhưng **thiếu/sai cookie** ⇒ từ chối; callback
  gọi **lần hai** với cùng state ⇒ từ chối; upload file `.exe` đổi đuôi `.jpg` (mime khai
  `image/jpeg`) ⇒ hiện **lọt** vì chỉ kiểm mime do client khai, **không** kiểm magic bytes — ghi
  thành issue mức thấp (scope `drive.file` + `nosniff` + `no-store` đã hạn chế thiệt hại, nhưng
  file độc vẫn nằm trên Drive khách).
- **BA:** chốt **OQ-ARCH-06** (xóa mềm nhân viên có phải dọn file scan không) và **OQ-ARCH-07**
  (thời hạn lưu trữ hồ sơ sau khi nghỉ việc).
