---
type: adr
feature: phan-quyen-nhan-vien
status: proposed
updated: 2026-09-17
links:
  - docs/phan-quyen-nhan-vien/CONTEXT_SUMMARY.md
  - docs/phan-quyen-nhan-vien/srs/phan-quyen-nhan-vien-spec.md
  - docs/phan-quyen-nhan-vien/architecture/api-contract.md
  - docs/phan-quyen-nhan-vien/architecture/data-model.md
---

# ADR-002: Gửi mật khẩu tạm qua email khi duyệt lời mời nhân viên, bắt đổi ở lần đăng nhập đầu

> Trạng thái `proposed` — nghiệp vụ đã được anh @phamvinh203 xác nhận tường minh ngày 2026-09-17 (OQ-1); phần kỹ thuật dưới đây chờ anh duyệt cùng `api-contract.md`.

## Context

### Quyết định cũ (vbsec 2026-09-10) đang nằm trong code

- `be_maxv/src/utils/password.ts:10-17` — `bamMatKhauKhongAiBiet()`: "Băm một mật khẩu NGẪU NHIÊN không ai biết (kể cả hệ thống) ... Thay cho việc sinh mật khẩu rồi gửi dạng rõ qua email / hiện cho admin (vbsec 2026-09-10)."
- `be_maxv/src/helpers/mailTemplates.ts:62-89` — `HUONG_DAN_DAT_MAT_KHAU` kết thúc bằng câu "MaxV không bao giờ gửi mật khẩu qua email."; docstring `inviteApprovedEmail`: "mật khẩu gửi dạng rõ nằm vĩnh viễn trong hộp thư, bị chuyển tiếp/đọc trộm là mất tài khoản."
- `be_maxv/src/services/admin/adminInvite.service.ts:50-113` — duyệt lời mời tạo `User` bằng mật khẩu không ai biết; nhân viên phải tự đặt qua "Quên mật khẩu" (OTP).

Rủi ro mà quyết định cũ chặn: (1) mật khẩu rõ nằm lâu trong hộp thư; (2) người trung gian (admin, kênh chuyển) biết mật khẩu.

### Yêu cầu mới

Owner muốn nhân viên "nhận tài khoản dùng ngay" — email chứa email đăng nhập + mật khẩu ngẫu nhiên (spec Mục 1, BR-005..007). Anh @phamvinh203 đã xác nhận tường minh đảo ngược vbsec cho **đúng luồng duyệt lời mời** (OQ-1, Phương án A).

## Decision

**Đảo ngược vbsec 2026-09-10 CHỈ cho luồng ADMIN duyệt lời mời.** "Quên mật khẩu" (OTP) và "ADMIN đặt lại mật khẩu" (`adminResetPassword`) giữ nguyên cơ chế mật khẩu không ai biết (BR-011).

Các biện pháp bắt buộc đi kèm — thiếu một cái thì không được bật tính năng:

| # | Biện pháp | Hiện thực |
|---|---|---|
| 1 | **Mật khẩu mạnh, ngẫu nhiên mật mã học** | `node:crypto` `randomInt` (không `Math.random`). 16 ký tự từ bảng 56 ký tự bỏ ký tự dễ nhầm (`I O l o 0 1`), bảo đảm ≥1 hoa, ≥1 thường, ≥1 số, trộn Fisher–Yates bằng `randomInt`. ≈ 92 bit entropy, vượt BR-005 (≥12). Chi tiết `api-contract.md` Mục 4.7. |
| 2 | **Bản rõ chỉ sống trong một request** | Sinh trong `adminApproveInvite`, băm bcrypt, đưa vào nội dung email rồi bỏ. Không lưu DB, không `SysLog`, không trả response, không nằm trong message lỗi, không `req.log` nội dung mail (BR-007). |
| 3 | **Bắt đổi ở lần đăng nhập đầu** | Cột `users.phaiDoiMatKhau` (DB là nguồn khi phát vé) + claim cùng tên trong access token; `app.authenticate` chặn 403 `PASSWORD_CHANGE_REQUIRED` cho mọi route trừ danh sách được phép (`GET /auth/me`, `POST /auth/change-password`; refresh/logout vốn không qua `authenticate`). Chi tiết `api-contract.md` Mục 3. |
| 4 | **Đổi mật khẩu là thu hồi mọi phiên khác** | `POST /auth/change-password` bắt nhập mật khẩu hiện tại, ghi mật khẩu mới + `phaiDoiMatKhau=false` + `tokenVersion+1`, cấp phiên mới cho chính trình duyệt đang đổi. Ai đã đăng nhập bằng mật khẩu trong email ở máy khác: vé của họ mang claim `true` nên không làm được gì, và refresh token bị vô hiệu ngay. |
| 5 | **Mật khẩu email chết ở lần dùng đầu** | Sau khi đổi, mật khẩu trong hộp thư vô dụng. Email dặn không chuyển tiếp, xoá sau khi đổi, email mới nhất mới có hiệu lực. |
| 6 | **Kênh gửi bắt buộc TLS** | `cauHinhSmtp` (`mailer.service.ts:15-26`, `requireTLS`) — giữ nguyên, không hạ chuẩn (NFR-002). |
| 7 | **Gửi mail hỏng thì huỷ tài khoản** | Giữ cơ chế bù trừ hiện có (`adminInvite.service.ts:115-130`): xoá `User`, lời mời về PENDING, 502. Admin bấm duyệt lại sẽ sinh **mật khẩu mới** (BR-010). |
| 8 | **Quên mật khẩu cũng gỡ cờ** | `resetPasswordWithOtp` ghi thêm `phaiDoiMatKhau=false` — nhân viên mất email vẫn tự vào được bằng OTP, không kẹt ở màn đổi mật khẩu. |

### Vì sao chấp nhận đảo ngược

- Rủi ro (1) "nằm vĩnh viễn trong hộp thư" được cắt ngắn còn **khoảng từ lúc gửi tới lần đăng nhập đầu**: biện pháp 3+5 làm mật khẩu email hết giá trị ngay khi dùng.
- Rủi ro (2) "admin biết mật khẩu" **không tái xuất hiện**: admin không bao giờ thấy mật khẩu, response duyệt không chứa nó (khác hẳn cách làm trước vbsec là hiện mật khẩu cho admin).
- Được: đúng yêu cầu nghiệp vụ "dùng ngay", bỏ một bước OTP mà nhân viên mới hay vướng.

### Rủi ro còn lại (chấp nhận có ý thức)

- **Hộp thư bị lộ TRƯỚC lần đăng nhập đầu**: kẻ đọc được email đăng nhập trước, đổi mật khẩu, chiếm tài khoản. Dấu hiệu: nhân viên thật không đăng nhập được → báo owner → ADMIN đặt lại mật khẩu (luồng sẵn có). Không có biện pháp kỹ thuật nào trong phạm vi hiện tại chặn được trường hợp này; biện pháp giảm là **cho mật khẩu tạm hết hạn** (Alternatives) — cần BA/anh quyết.
- Nhân viên không bao giờ đăng nhập: mật khẩu tạm còn hiệu lực vô thời hạn trong hộp thư (cùng lý do trên).

## Alternatives

| Phương án | Lý do không chọn |
|---|---|
| Giữ vbsec, chỉ cải thiện email hướng dẫn OTP (Phương án C của BA) | Không đúng yêu cầu "gửi tk, mk" đã được xác nhận. |
| Link đăng nhập một lần có hạn (magic link) | Đúng tinh thần bảo mật hơn nhưng cần token lưu DB + route mới + trang đích FE; không phải "mật khẩu" như owner yêu cầu. Cân nhắc lại nếu sự cố chiếm tài khoản xảy ra thật. |
| Cờ nằm **chỉ** trong DB, `authenticate` tra DB mỗi request | Phá chủ ý hiện có của `authenticate` (`jwt.plugin.ts:31-37`: không đụng DB để tiết kiệm 1 truy vấn/request trên mọi route). Cờ chỉ đổi `true → false` bởi chính người dùng (kèm cấp vé mới) và chỉ bật `true` lúc tạo tài khoản (chưa có vé nào) — claim không bao giờ cũ theo chiều nguy hiểm, nên không cần tra DB. |
| Guard riêng gắn từng route | Hàng trăm route, sót một route là lỗ hổng. Chặn trong `authenticate` phủ mọi route đã yêu cầu đăng nhập, whitelist tường minh bằng `config`. |
| **Mật khẩu tạm có hạn** (vd cột `DateTime?` thay boolean, quá hạn thì login trả lỗi hướng dẫn dùng "Quên mật khẩu") | Không có trong spec — là quy tắc nghiệp vụ mới (thời hạn bao lâu). **Khuyến nghị** BA đưa thành câu hỏi mở; nếu chốt có, đổi `phaiDoiMatKhau Boolean` thành `matKhauTamHetHan DateTime?` trước khi code (xem `api-contract.md` MT-10). |

## Trade-offs

**Được:** nhân viên dùng được ngay; admin vẫn không biết mật khẩu; chặn tập trung một chỗ, 0 truy vấn thêm mỗi request; tái dùng mail/bù trừ/tokenVersion sẵn có.

**Mất:** có một secret dạng rõ trong hộp thư cho tới lần đăng nhập đầu; thêm một claim vào vé nên **mọi chỗ phát vé** (login, refresh, cấp lại giữa phiên, đổi mật khẩu) phải mang đúng giá trị DB — sót một chỗ là mở khoá sớm; `fe_maxv` không có màn đổi mật khẩu nên nhân viên mới đăng nhập ở đó sẽ kẹt (xem `api-contract.md` Mục 8).

## Consequences

- Migration sys: `users.phaiDoiMatKhau BOOLEAN NOT NULL DEFAULT false` — user cũ `false` (`data-model.md` M-01).
- `TokenPayload.phaiDoiMatKhau` khai **bắt buộc** (không `?`) để TypeScript báo lỗi ở mọi chỗ dựng payload mà quên field.
- Rollback code là **mở khoá**: nhân viên mới dùng tiếp mật khẩu tạm mà không bị bắt đổi. Mức rủi ro thấp hơn rollback quyền, nhưng người rollback phải biết.
- Nhật ký: `APPROVE_INVITE` giữ nguyên `chiTiet` (không thêm gì liên quan mật khẩu); thêm `CHANGE_PASSWORD` với `chiTiet: { batBuoc: boolean }`.

### Docstring/comment/nội dung phải sửa CÙNG commit khi code

| File:dòng | Hiện nói | Phải sửa thành |
|---|---|---|
| `be_maxv/src/utils/password.ts:10-14` | `bamMatKhauKhongAiBiet` dùng "cho tài khoản vừa duyệt lời mời, hoặc vừa bị admin vô hiệu mật khẩu" | Bỏ vế "vừa duyệt lời mời"; ghi rõ luồng duyệt dùng `sinhMatKhauTam` theo ADR-002 phan-quyen-nhan-vien, vbsec 2026-09-10 còn áp cho đặt lại mật khẩu. Thêm docstring cho `sinhMatKhauTam`. |
| `be_maxv/src/helpers/mailTemplates.ts:62-66` (`HUONG_DAN_DAT_MAT_KHAU`) | "MaxV không bao giờ gửi mật khẩu qua email." | Câu này thành **sai sự thật** (vẫn đang in trong `adminResetPasswordEmail`). Xoá, hoặc thay bằng "MaxV không bao giờ hỏi mật khẩu của bạn qua email hay điện thoại." |
| `be_maxv/src/helpers/mailTemplates.ts:68-89` (`inviteApprovedEmail`) | Docstring vbsec + nội dung hướng dẫn OTP | Nhận thêm `matKhauTam`; nội dung theo `api-contract.md` Mục 5; docstring dẫn ADR-002. |
| `be_maxv/src/helpers/mailTemplates.ts:92-95` (`adminResetPasswordEmail`) | "KHÔNG chứa mật khẩu, xem `inviteApprovedEmail`" | Trỏ về vbsec 2026-09-10 trực tiếp (không còn dẫn tới template đã đổi nghĩa). |
| `be_maxv/src/services/admin/adminInvite.service.ts:50-54` | "tạo User thật cho nhân viên (mật khẩu không ai biết) ... tự đặt mật khẩu bằng Quên mật khẩu" | Mật khẩu tạm gửi qua email, cờ phải đổi, bù trừ khi mail lỗi sinh mật khẩu mới ở lần duyệt lại. |
| `be_maxv/src/plugins/jwt.plugin.ts:31-37` | Chỉ nói về `tokenVersion` | Thêm: `authenticate` chặn claim `phaiDoiMatKhau` trừ route `config.choPhepKhiPhaiDoiMatKhau`, và lý do tin claim không cần tra DB. |
| `be_maxv/src/helpers/authTokens.ts:7-23` (`TokenPayload`) | — | Mô tả field `phaiDoiMatKhau` + "mọi chỗ phát vé phải đọc từ DB". |
| `be_maxv/src/types/fastify.d.ts:4-14, 17-25` | — | `JwtPayload.phaiDoiMatKhau?`; `FastifyContextConfig.choPhepKhiPhaiDoiMatKhau?` kèm mô tả. |
| `be_maxv/src/services/client/auth.service.ts:220` (`resetPasswordWithOtp`) | — | Ghi chú vì sao gỡ cờ ở đây. |
| `maxv/src/features/invites/components/ApproveInviteDialog.tsx:37-40` | "gửi mật khẩu đăng nhập qua email" | **Không sửa** — câu này sai với vbsec nhưng nay đúng lại. |
