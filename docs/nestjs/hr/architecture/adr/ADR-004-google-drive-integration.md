---
type: adr
feature: hr
status: accepted
updated: 2026-09-05
---

# ADR-004 — Tích hợp Google Drive thật cho Tài liệu (OQ-hr-25 Cách hiểu 2)

## Context

`hr-spec.md` Mục 6.5 (Tài liệu) đặt ra OQ-hr-25 — trường "Đường dẫn tài liệu" nên hiểu theo **Cách hiểu 1** (chỉ lưu 1 link do người dùng tự dán vào, hệ thống không gọi API nào) hay **Cách hiểu 2** (hệ thống chủ động upload file lên Google Drive của người dùng qua Google Drive API thật, cần OAuth + lưu credential + tích hợp bên thứ 3 hoàn toàn mới)? BA khuyến nghị Cách hiểu 1 (đơn giản hơn, dự án chưa có nền tảng OAuth nào) nhưng KHÔNG tự chốt thay user.

**Quyết định user (2026-09-05, qua AskUserQuestion trực tiếp, ngoài quy trình BA chuẩn):** chọn **Cách hiểu 2** — "hệ thống tự động upload file lên Google Drive của người dùng đang thao tác (nhân viên HR/Admin đăng nhập) qua OAuth, lưu tham chiếu (không lưu file vào DB)". Đây là quyết định nghiệp vụ đã chốt, KHÔNG thuộc phạm vi Architect thay đổi — nhiệm vụ của tài liệu này là thiết kế kỹ thuật cho quyết định đó.

Đây là tích hợp bên thứ 3 **ĐẦU TIÊN của toàn dự án** — kể cả feature auth (đã chạy production) cũng chỉ có email/password nội bộ, KHÔNG có OAuth/tích hợp ngoài nào. Vì vậy ADR này phải quyết định TỪ ĐẦU: luồng OAuth, scope, cơ chế lưu trữ token an toàn, thư viện, và ranh giới module — không có tiền lệ nào trong dự án để tái dùng (khác ADR-001/002/003, vốn tái dùng/mở rộng pattern `$transaction` đã có ở `token.service.ts`).

## Decision

### 1. Kiến trúc: module `Integrations` mới, tách khỏi `HrModule`

Tạo bounded context thứ 3 "**Integrations**" (sau "Identity & Access" và "HR Master Data"), sở hữu `GoogleDriveConnection` + toàn bộ luồng OAuth + wrapper gọi Drive API. `Document` (entity nghiệp vụ) VẪN thuộc "HR Master Data", nhưng `DocumentsService` gọi SANG `GoogleDriveService` (1 chiều: HR → Integrations, không có chiều ngược) khi cần upload/xoá file. Lý do KHÔNG nhét thẳng OAuth/token logic vào `HrModule`: đây là năng lực kỹ thuật (OAuth2 + gọi API ngoài + mã hoá secret) hoàn toàn khác bản chất với "CRUD dữ liệu nhân sự" — gộp chung sẽ làm `HrModule` phình to với trách nhiệm không liên quan, và một module `Integrations` độc lập dễ tái sử dụng nếu sau này có nhu cầu tích hợp khác (kế toán đính kèm hoá đơn, v.v. — không xây trước, chỉ đặt tên module số nhiều `integrations/` để không phải đổi tên khi mở rộng).

`docs/hr/architecture/hr-architecture.md` Mục 2 cập nhật bounded context table + ghi nhận 2 quan hệ cross-context MỚI (một chiều, không phá vỡ tính acyclic đã có):
- `Integrations` → `Identity & Access` (đọc/tham chiếu `User` qua `GoogleDriveConnection.userId`).
- `HR Master Data` → `Identity & Access` (tham chiếu `User` qua `Document.uploadedByUserId`, traceability).
- `HR Master Data` → `Integrations` (gọi `GoogleDriveService` khi upload/xoá file Document).

### 2. Luồng OAuth: Authorization Code, `state` JWT tự chứa + cookie nonce chống CSRF/injection

Dùng chuẩn OAuth 2.0 Authorization Code Flow (không phải Implicit/PKCE-thuần — server-side confidential client, có `CLIENT_SECRET`, đúng mô hình backend-to-backend token exchange):

1. `GET /integrations/google-drive/authorize` (Bearer JWT, `@Roles(ADMIN, HR)`): sinh `state` = JWT ngắn hạn (10 phút) ký bằng `JWT_ACCESS_SECRET` **tái dùng** (không thêm secret mới) với `aud: 'google-drive-connect'` để phân biệt mục đích với access token thường, `sub = userId`, `nonce` ngẫu nhiên. Set cookie `gdrive_oauth_nonce` (httpOnly/secure/sameSite=lax) chứa cùng `nonce`. Trả `{ authorizeUrl }` chứa `state`, `scope=drive.file`, `access_type=offline`, `prompt=consent`.
2. Browser điều hướng thẳng tới Google (KHÔNG qua backend) — người dùng đăng nhập/đồng ý quyền trên UI của chính Google.
3. Google redirect browser (top-level navigation, KHÔNG có header `Authorization`) tới `GET /integrations/google-drive/callback?code=...&state=...`.
4. Callback verify `state` (chữ ký + hạn + `aud`) VÀ đối chiếu `nonce` trong `state` với cookie gửi kèm request này — CẢ HAI phải khớp mới tiếp tục.
5. Đổi `code` lấy `access_token`+`refresh_token`, gọi `drive.about.get` lấy email hiển thị, mã hoá token, `upsert` `GoogleDriveConnection`, redirect browser về `GOOGLE_DRIVE_CONNECT_REDIRECT_URL`.

**Vì sao cần cookie nonce, không chỉ tin `state` JWT tự chứa:** nếu chỉ ký `userId` vào `state` mà không đối chiếu thêm gì, một kẻ tấn công có được (bằng cách nào đó — XSS, log rò rỉ, network capture) một `state` HỢP LỆ đã phát cho nạn nhân có thể dùng CHÍNH `state` đó kèm `code` CỦA TÀI KHOẢN GOOGLE RIÊNG của kẻ tấn công, lừa nạn nhân bấm vào link đó → hệ thống sẽ liên kết NHẦM tài khoản Google của kẻ tấn công vào `userId` của nạn nhân (OAuth login/account-linking CSRF, hay còn gọi "authorization code injection"). Cookie `gdrive_oauth_nonce` chỉ được set trên CHÍNH trình duyệt đã gọi `/authorize` — kẻ tấn công không set được cookie đó trên trình duyệt nạn nhân từ xa, nên dù có `state` hợp lệ, thiếu cookie khớp thì callback vẫn từ chối. Dự án ĐÃ CÓ `cookie-parser` + pattern cookie httpOnly (refresh token đăng nhập, `auth.controller.ts`) — tái dùng CÙNG cơ chế, không phải khái niệm mới.

**Vì sao tái dùng `JWT_ACCESS_SECRET` thay vì thêm secret riêng:** cả state token và access token đều do CHÍNH server này ký VÀ verify (không có bên thứ 3 nào verify) — không có rủi ro nhầm lẫn bên xác thực. Claim `aud` khác nhau đã đủ để `jwtVerify` từ chối chéo (state token không dùng được như access token và ngược lại). Thêm 1 secret env riêng cho một token sống 10 phút, không mang quyền truy cập dữ liệu (chỉ mang `userId` để nối tiếp 1 flow đã được RolesGuard chấp thuận trước đó) là chi phí vận hành (thêm 1 secret cần generate/set/rotate) không tương xứng lợi ích bảo mật tăng thêm.

**Vì sao LUÔN `prompt=consent`:** Google chỉ trả `refresh_token` ở lần cấp quyền ĐẦU TIÊN trừ khi ép `prompt=consent`. Vì hệ thống BẮT BUỘC có `refresh_token` (không có nó, kết nối vô dụng sau ~1 giờ), ép hiển thị màn hình đồng ý ở MỌI lần gọi `/authorize` (kể cả reconnect) để LUÔN nhận được `refresh_token` mới, tránh nhánh code phức tạp "giữ refresh_token cũ nếu Google không gửi lại". Đánh đổi: user phải bấm "Cho phép" mỗi lần kết nối lại (dù đã từng đồng ý trước đó) — chấp nhận được vì đây là hành động hiếm (1 lần/người, hoạ hoằn mới reconnect).

### 3. Scope: `drive.file` — least privilege, KHÔNG xin `email`/`profile` riêng

Chỉ xin đúng 1 scope `https://www.googleapis.com/auth/drive.file` — theo đúng yêu cầu: "CHỈ cho phép app truy cập file do chính app tạo ra". Đặc tính quan trọng của scope này (xác nhận qua tài liệu Google Drive API): mọi lệnh gọi `files.list`/`files.create`/`files.get` dưới token phạm vi `drive.file` chỉ "nhìn thấy" file DO APP NÀY tạo ra — không bao giờ liệt kê/đọc được các file khác trong Drive cá nhân của người dùng, kể cả khi code KHÔNG tự thêm điều kiện lọc nào. Đây chính là cơ chế THỰC THI least-privilege ở phía Google, không phải quy ước tự nguyện của code.

**KHÔNG xin thêm scope `email`/`profile`/`openid`** để lấy email hiển thị "đang kết nối với xxx@gmail.com" — thay vào đó gọi `drive.about.get({ fields: 'user(emailAddress,displayName)' })`, một endpoint THUỘC Drive API mà `drive.file` scope ĐÃ ĐỦ quyền gọi (xác nhận qua tài liệu Drive API — `about.get` chấp nhận `drive.file` trong danh sách scope hợp lệ). Nhờ vậy vẫn có được label hiển thị hữu ích cho UI/khắc phục sự cố mà KHÔNG mở rộng phạm vi OAuth xin quyền — giữ đúng tinh thần "scope tối thiểu" tuyệt đối, không phải "tối thiểu nhưng thêm 1-2 scope tiện lợi".

### 4. Mã hoá token tại chỗ: AES-256-GCM, khoá từ `TOKEN_ENCRYPTION_KEY`

`accessTokenEncrypted`/`refreshTokenEncrypted` (cột `text`) lưu **ciphertext**, KHÔNG BAO GIỜ plaintext:

- Thuật toán: `aes-256-gcm` qua module `node:crypto` có sẵn (KHÔNG cần thêm thư viện — dự án đã dùng `node:crypto` cho `createHash`/`randomBytes` ở `token.service.ts`, đây là phần mở rộng tự nhiên, không phải công nghệ mới).
- Khoá: `TOKEN_ENCRYPTION_KEY` (env var MỚI, bắt buộc, base64 của đúng 32 byte — `openssl rand -base64 32`), validate ở `env.schema.ts` (fail-fast, cùng convention `JWT_ACCESS_SECRET`: decode base64 → kiểm tra đúng 32 byte → sai thì throw lúc boot, không chờ tới lần dùng đầu tiên mới phát hiện).
- IV: `randomBytes(12)` SINH MỚI cho MỖI lần mã hoá (bắt buộc với GCM — không bao giờ tái dùng IV với cùng 1 khoá).
- Format lưu: `base64(iv[12 byte] + authTag[16 byte] + ciphertext)` — 1 chuỗi duy nhất/cột, tự chứa mọi thứ cần để giải mã.
- Giải mã: tách lại theo offset cố định, `createDecipheriv` + `setAuthTag` trước khi `update`/`final` — sai `authTag` (dữ liệu bị sửa) ném lỗi ngay, không âm thầm trả dữ liệu rác.

**Rotation key:** KHÔNG xây cơ chế rotate tự động (over-engineering cho quy mô vài chục user ADMIN/HR). Nếu `TOKEN_ENCRYPTION_KEY` cần đổi (lộ khoá, luân chuyển định kỳ theo policy công ty), giải pháp chấp nhận: mọi `GoogleDriveConnection` hiện có trở nên KHÔNG giải mã được với khoá mới → xoá toàn bộ bảng, mọi user phải kết nối lại (thao tác nhẹ, self-service, KHÔNG ảnh hưởng dữ liệu `Document` đã có — `driveFileId`/`webViewLink` không phụ thuộc kết nối OAuth để tồn tại).

## Alternatives

### A. Kiến trúc module

| Phương án | Ưu | Nhược | Kết luận |
|---|---|---|---|
| **`Integrations` module riêng, HR gọi sang** ✓ | Ranh giới trách nhiệm rõ; dễ tái dùng nếu có tích hợp khác sau này; không phình `HrModule` với năng lực không liên quan (OAuth/mã hoá/gọi API ngoài) | Thêm 1 module top-level, 1 chiều phụ thuộc mới cần theo dõi | **Chọn** |
| Nhét thẳng vào `hr/documents/` | Đơn giản, ít file hơn | Trộn "CRUD dữ liệu nhân sự" với "hạ tầng OAuth/mã hoá" — vi phạm single-responsibility ở mức module, khó tái dùng nếu về sau module khác (vd Accounting) cũng cần đính kèm Drive | Không chọn |

### B. Mô hình lưu trữ file

| Phương án | Mô tả | Ưu | Nhược | Kết luận |
|---|---|---|---|---|
| **Drive CÁ NHÂN của user đang thao tác (đã chốt bởi user)** ✓ | Mỗi ADMIN/HR tự kết nối Drive riêng, file nằm rải rác nhiều Drive cá nhân | Không cần hạ tầng Google Workspace admin; đúng yêu cầu user đã nêu; mỗi người tự chịu trách nhiệm/quota Drive của mình | **Rủi ro vận hành thật:** file "phân tán" theo người upload — nếu người đó rời công ty/xoá tài khoản Google/disconnect, file có thể mất quyền truy cập vĩnh viễn mà KHÔNG CÓ CÁCH nào từ hệ thống khôi phục (không có bản sao ở đâu khác). Xoá/thay file của 1 Document đòi hỏi ĐÚNG token của người đã upload nó (Mục 12.6 hr-api-contract.md) — phức tạp hơn 1 kho chung | **Chọn theo quyết định user** — đã phân tích trade-off, không tự đổi |
| Service Account + Domain-wide delegation (1 Drive/kho chung công ty) | 1 Service Account Google, cấp quyền domain-wide qua Google Workspace Admin, file tập trung 1 nơi, không phụ thuộc tài khoản cá nhân nào | Tránh HOÀN TOÀN rủi ro "phân tán theo người dùng" ở trên; không cần OAuth interactive (server tự authenticate) | Cần quyền Google Workspace ADMIN CONSOLE (domain-wide delegation) — vượt quyền hạn 1 dev/HR thông thường, cần công ty có Google Workspace (không phải Gmail cá nhân), phát sinh quy trình xin cấp phép IT ngoài phạm vi 1 feature; KHÔNG khớp mô tả yêu cầu gốc ("Drive của người dùng đang thao tác") | Không chọn — trái với quyết định user đã chốt tường minh; ghi nhận ở đây làm phương án tương lai nếu công ty muốn tập trung hoá sau này |

### C. Thư viện Node.js cho OAuth2 + Drive API

| Phương án | Ưu | Nhược | Kết luận |
|---|---|---|---|
| **`google-auth-library` (OAuth2Client) + `@googleapis/drive` (Drive v3 client)** ✓ | Cả 2 đều CHÍNH THỨC (dưới GitHub org `googleapis`), có type định nghĩa đầy đủ; `@googleapis/drive` chỉ chứa API Drive (nhẹ hơn NHIỀU so với gói `googleapis` ôm toàn bộ ~200+ API của Google); `OAuth2Client` tự xử lý refresh access token, tự bắt sự kiện `tokens` khi refresh | 2 package thay vì 1, cần biết ghép `auth` option giữa 2 gói | **Chọn** — cân bằng đúng "không tự triển khai OAuth2/Drive protocol tay" (yêu cầu bắt buộc) với "không kéo phụ thuộc thừa" |
| Gói `googleapis` (umbrella, toàn bộ API Google) | 1 package duy nhất, ít quyết định hơn, tài liệu/ví dụ phổ biến nhất trên mạng | Kéo theo type definitions + surface API của ~200 dịch vụ Google không dùng tới — cài đặt nặng hơn đáng kể so với chỉ cần Drive; tăng bề mặt cần Dependabot/audit theo dõi | Không chọn — vi phạm nhẹ nguyên tắc tối giản dependency, dù vẫn là lựa chọn HỢP LỆ nếu team ưu tiên đơn giản hoá quyết định hơn kích thước cài đặt |
| Tự viết OAuth2 flow bằng `fetch` thuần + tự dựng multipart request cho Drive upload | Không thêm dependency nào | **Vi phạm trực tiếp** yêu cầu "không tự triển khai OAuth2/Drive protocol tay"; multipart upload của Drive API có định dạng riêng (`related` MIME boundary, JSON metadata part + media part) dễ làm sai; tự bảo trì toàn bộ logic refresh/retry | **Loại bỏ tường minh** |

### D. Vị trí buffer file khi upload

| Phương án | Ưu | Nhược | Kết luận |
|---|---|---|---|
| **Multer `memoryStorage` (buffer RAM, không chạm disk)** ✓ | Không có file tạm trên đĩa cần dọn; khớp tinh thần "không lưu file vào DB/storage của hệ thống" mở rộng sang cả disk tạm; phù hợp Render (ephemeral filesystem, container có thể bị recreate bất kỳ lúc nào) | Giới hạn kích thước file bị ràng buộc bởi RAM khả dụng của instance — chấp nhận được với ngưỡng 15MB/file và tần suất upload thấp (thao tác admin, không phải hot path) | **Chọn** |
| Multer `diskStorage` (ghi file tạm ra đĩa trước khi forward lên Drive) | Không giới hạn bởi RAM | Cần cơ chế dọn file tạm (cron/finally-block) — thêm state cần quản lý; rủi ro rò rỉ file tạm nếu process crash giữa chừng; không cần thiết ở quy mô file nhỏ (ảnh/PDF hồ sơ, không phải video) | Không chọn — over-engineering cho ngưỡng kích thước đã chọn |

## Trade-offs

- **Nhận:** thêm 5 env var mới (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `TOKEN_ENCRYPTION_KEY`, `GOOGLE_DRIVE_CONNECT_REDIRECT_URL`) + 1 optional (`GOOGLE_DRIVE_UPLOAD_MAX_MB`) — tăng bề mặt cấu hình cần set đúng ở mọi môi trường (dev/staging/production), khác biệt với 19 endpoint JSON thuần trước đó vốn không cần cấu hình gì thêm ngoài DB.
- **Nhận:** 2 package mới (`google-auth-library`, `@googleapis/drive`) + `multer`/`@types/multer` — lần đầu dự án phụ thuộc SDK của bên thứ 3 cho một tích hợp thật (khác `jose`/`@node-rs/argon2` vốn là thư viện thuật toán thuần, không gọi mạng ra ngoài).
- **Nhận:** độ phức tạp vận hành THẬT SỰ cao hơn 26 endpoint CRUD JSON còn lại — lỗi có thể đến từ 3 nguồn khác nhau (validate nội bộ, trạng thái kết nối, chính Google API tạm ngưng/đổi hành vi) thay vì chỉ 1 nguồn (DB) như trước.
- **Nhận (rủi ro vận hành dài hạn, không thể loại bỏ hoàn toàn bằng thiết kế — đã chọn có ý thức theo Alternative B):** file "phân tán" theo Drive cá nhân từng người upload. Hệ quả cụ thể: (1) người upload rời công ty/khoá tài khoản Google → các Document họ từng upload KHÔNG THỂ xoá/thay file được nữa từ hệ thống (dù metadata Document vẫn còn); (2) không có cách "sao lưu tập trung" các file này — nếu 1 người tự xoá file khỏi Drive cá nhân của họ, dữ liệu file THỰC SỰ mất, hệ thống chỉ còn `driveWebViewLink` chết. Đây là chi phí trực tiếp của quyết định "Drive cá nhân" mà user đã chọn tường minh — Architect không tự đổi, chỉ nêu rõ để BA/PO cân nhắc nếu muốn chuyển sang Alternative B (Service Account) trong tương lai.
- **Đổi lấy:** triển khai NHANH (không cần xin quyền Google Workspace Admin, không cần hạ tầng domain-wide delegation), đúng 100% mô tả yêu cầu gốc, và scope tối thiểu (`drive.file`) giữ rủi ro bảo mật ở mức thấp nhất có thể cho MÔ HÌNH đã chọn (dù mô hình đó tự thân có rủi ro vận hành dài hạn nêu trên).

## Consequences

- `docs/hr/architecture/hr-architecture.md` cập nhật: bounded context thứ 3 "Integrations" (Mục 2), diagram (Mục 3), module boundaries (Mục 4 — thêm `Backend/src/integrations/google-drive/` + `Backend/src/hr/documents/`), transaction boundary (Mục 5 — nguyên tắc "không `$transaction` khi xen API ngoài"), authorization model (Mục 7 — 4 endpoint chỉ ADMIN+HR, không ACCOUNTANT), tích hợp/observability (Mục 9 — lần đầu có "Tích hợp dịch vụ ngoài" khác "Không có"), technical constraints (Mục 10 — env var mới, package mới, multer memoryStorage, cross-user delete authority).
- Backend Engineer cần: (1) đăng ký OAuth Client trên Google Cloud Console (loại "Web application", redirect URI khớp CHÍNH XÁC `GOOGLE_REDIRECT_URI`), cấu hình OAuth consent screen ở chế độ phù hợp quy mô nội bộ (Testing với danh sách test user, hoặc Internal nếu tổ chức dùng Google Workspace) — đây là thao tác NGOÀI CODE, cần thực hiện trước khi test được luồng thật; (2) cài `google-auth-library`, `@googleapis/drive`, `multer`, `@types/multer`; (3) set đủ 5 env var bắt buộc (+ 1 optional) ở mọi môi trường (dev/.env, CI nếu có test tích hợp thật gọi Google, Render dashboard cho production); (4) thêm nhánh `GoogleDriveError` thứ 3 vào `HttpExceptionFilter` (sau nhánh `HrError`, trước `ThrottlerException`).
- Migration Prisma: thuần DSL, KHÔNG cần thao tác tay như ADR-001 (sequence)/ADR-002 (EXCLUDE) — xem `hr-data-model.md` Mục 14.
- `hr-spec.md` Mục 4 (Out of Scope, item 12) và Mục 6.5 (OQ-hr-25) hiện vẫn còn nguyên văn bản cũ ("ngoài phạm vi... trừ khi OQ-hr-25 chọn Cách hiểu 2", "chưa xác nhận") tại thời điểm ADR này được viết — ĐÃ LỖI THỜI so với quyết định user. Đây là tài liệu do BA sở hữu, Architect KHÔNG tự sửa (đúng ranh giới trách nhiệm CLAUDE.md) — khuyến nghị BA cập nhật `hr-spec.md` ở đợt kế tiếp để đóng OQ-hr-25 chính thức, đối chiếu ADR này làm nguồn quyết định.
- Nếu tương lai chuyển sang Alternative B (Service Account/domain-wide delegation) để giải quyết rủi ro "Drive phân tán": cần ADR mới riêng (thay đổi kiến trúc đáng kể — bỏ hẳn luồng OAuth interactive, đổi toàn bộ `GoogleDriveConnection` thành cấu hình cấp hệ thống thay vì cấp user), không phải sửa nhỏ ADR này.
- **Rủi ro chấp nhận có ý thức (code review 2026-09-05):** kiểm tra MIME type file upload (`ALLOWED_MIME_TYPES`) dựa vào `Content-Type` do client tự khai báo (`multer` `file.mimetype`), KHÔNG sniff magic-byte nội dung thật — về lý thuyết ADMIN/HR (vai trò tin cậy, không phải người dùng ẩn danh) có thể khai sai MIME để vượt allow-list. Chấp nhận được ở giai đoạn này vì: (1) chỉ vai trò đã tin cậy mới gọi được endpoint; (2) file host trên domain `drive.google.com`, không serve từ origin app → không có surface stored-XSS trên chính hệ thống. Nếu sau này endpoint mở rộng cho vai trò kém tin cậy hơn, cần bổ sung sniff magic-byte (vd package `file-type`) trước `ALLOWED_MIME_TYPES` check.

## References

- [[docs/hr/srs/hr-spec.md|HR SRS]] Mục 6.5, OQ-hr-25 — nguồn quyết định nghiệp vụ
- [[docs/hr/architecture/hr-architecture.md|HR Architecture]] — bounded context, module boundaries
- [[docs/hr/architecture/hr-data-model.md|HR Data Model]] Mục 12/13/14 — schema `Document`/`GoogleDriveConnection`
- [[docs/hr/architecture/hr-api-contract.md|HR API Contract]] Mục 11/12 — endpoint đầy đủ
- [[docs/auth/architecture/auth-architecture.md|Auth Architecture]] — pattern cookie httpOnly, `JwtAuthGuard`/`@Public()` tái dùng
