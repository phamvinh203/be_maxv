---
type: srs
feature: phan-quyen-nhan-vien
status: draft
updated: 2026-09-17
links:
  - docs/phan-quyen-nhan-vien/CONTEXT_SUMMARY.md
  - docs/hrm/architecture/adr/ADR-007-pham-vi-quyen-xem-du-lieu-luong.md
---

# SRS — Phân quyền nhân viên (mời qua email + đúng công ty được cấp)

> Vòng 2 — thay thế toàn bộ nội dung vòng 1 (quyền module theo nhân viên đã bị loại khỏi phạm vi, xem `CONTEXT_SUMMARY.md` Mục 0). ID đánh số lại từ đầu. **Cập nhật 2026-09-17 (lần 2):** anh @phamvinh203 đã trả lời OQ-1..4 — nội dung dưới đã áp dụng đúng quyết định, xem Mục 11 phần "Đã chốt".

## 1. Mục tiêu nghiệp vụ

Owner muốn mời và cấp tài khoản cho nhân viên ngay trong `hdđt_maxv` (app chính đang dùng) thay vì phải mở app cũ `fe_maxv`, mời xong nhân viên nhận được tài khoản dùng ngay (email + mật khẩu) qua email thay vì phải tự đặt mật khẩu, và nhân viên chỉ thấy đúng công ty được cấp — không thấy công ty khác của owner mà mình chưa được mời vào. Owner cũng cần sửa lại quyền công ty (và quyền xem lương theo từng công ty) cho nhân viên đã duyệt, ngay tại màn này. Module (HRM/Kế toán/Dịch vụ công/Tờ khai) tiếp tục dùng chung theo gói của owner như hiện tại, không có yêu cầu giới hạn riêng theo nhân viên.

## 2. Stakeholders

| Vai trò | Quan tâm |
|---|---|
| Owner (chủ tài khoản) | Mời nhân viên nhanh ngay trong `hdđt_maxv`, nhân viên nhận được tài khoản dùng ngay, sửa quyền công ty/xem lương khi cần |
| Nhân viên (`OWNER_EMPLOYEE`) | Nhận được tài khoản dễ dùng, chỉ thấy đúng công ty việc của mình |
| ADMIN hệ thống | Vẫn duyệt/từ chối lời mời như hiện tại (đã chốt, xem Mục 11) |

## 3. Phạm vi (Scope)

**Trong phạm vi:**
- Màn "Cài đặt → Nhân viên" mới trong `hdđt_maxv`: bảng nhân viên (kèm công ty được cấp), bảng lời mời đang chờ, dialog "Thêm nhân viên" (chọn nhiều công ty).
- Đổi cách sinh và gửi mật khẩu khi ADMIN duyệt lời mời: sinh mật khẩu ngẫu nhiên thật, gửi qua email, bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên.
- Xác nhận (không sửa code) cơ chế nhân viên chỉ thấy/thao tác được công ty đã được cấp — đã đúng ở BE hiện tại.
- **Panel "Sửa quyền" cho nhân viên đã duyệt**: cấp thêm/thu hồi công ty, bật/tắt quyền xem lương theo từng công ty — dùng `PUT /companies/employees/:userId/access` đã có sẵn, chỉ xây UI mới.

**Ngoài phạm vi (giữ nguyên, không đổi):**
- Quyền module theo nhân viên — KHÔNG làm. Nhân viên tiếp tục dùng chung toàn bộ module theo gói của owner (`moduleCuaUser()` không đổi).
- Luồng ADMIN duyệt/từ chối lời mời — giữ nguyên bước duyệt (đã chốt, xem Mục 11).
- Cơ chế trần số nhân viên/MST theo gói (`limits.service.ts`).
- Luồng "Quên mật khẩu" (OTP) và luồng ADMIN đặt lại mật khẩu (`adminResetPassword`) — giữ nguyên 100%, không đụng.
- Rule quyền xem lương (`xemLuong`, ADR-007) — chỉ thêm UI thao tác, KHÔNG đổi rule/luồng xử lý phía sau (ai xem lương khi nào vẫn theo ADR-007).
- Xoá hẳn nhân viên khỏi tài khoản (khác thu hồi hết quyền công ty), owner tự huỷ lời mời PENDING.

## 4. Phương án & Trade-off — luồng mời + gửi mật khẩu

> ✅ **Đã chốt 2026-09-17: Phương án A.** Anh @phamvinh203 xác nhận tường minh đảo ngược quyết định bảo mật "không gửi mật khẩu qua email" (đã chốt 2026-09-10) để dùng Phương án A dưới đây, kèm đủ mitigation đã đề xuất. Giữ nguyên 3 phương án + bảng trade-off để lưu lại căn cứ quyết định.

> Bối cảnh quan trọng: code hiện tại có một quyết định bảo mật đã chốt ngày 2026-09-10 ("MaxV không bao giờ gửi mật khẩu qua email" — `helpers/mailTemplates.ts:70-73`), cố tình sinh mật khẩu không ai biết và bắt nhân viên tự đặt qua "Quên mật khẩu". Yêu cầu mới đảo ngược quyết định này. Cả 3 phương án dưới đều đổi lại thành gửi mật khẩu thật hoặc gần tương đương, ở các mức độ khác nhau.

### Phương án A — Giữ nguyên bước ADMIN duyệt; duyệt xong sinh mật khẩu ngẫu nhiên THẬT, gửi email, bắt đổi mật khẩu lần đầu — ĐÃ CHỐT

ADMIN vẫn duyệt/từ chối như hiện tại. Khi duyệt: thay `bamMatKhauKhongAiBiet()` bằng hàm sinh mật khẩu ngẫu nhiên thật (≥ 12 ký tự, đủ chữ hoa/chữ thường/số), gửi email mới chứa email đăng nhập + mật khẩu đó, đánh dấu tài khoản "phải đổi mật khẩu ở lần đăng nhập đầu".

### Phương án B — Bỏ bước ADMIN duyệt: owner mời là tạo tài khoản + gửi email ngay (không chọn)

Owner gửi `POST /companies/invite` tạo thẳng `User` + `DonViAccess` (không qua `InviteRequest` PENDING/ADMIN duyệt nữa), gửi email mật khẩu ngay lập tức. Vẫn kiểm trần nhân viên tại lúc mời.

### Phương án C — Giữ bước ADMIN duyệt (như A) nhưng KHÔNG gửi mật khẩu dạng chữ rõ — gửi email mời đặt mật khẩu lần đầu qua link/OTP (không chọn)

Duyệt xong, hệ thống gửi email hướng dẫn bấm vào "Quên mật khẩu" (hoặc 1 link đặt mật khẩu riêng, hạn 24-48h) để nhân viên tự đặt mật khẩu đầu tiên — về bản chất là cải tiến UX của cơ chế `inviteApprovedEmail` đang có, KHÔNG gửi mật khẩu.

| Tiêu chí | A — Giữ duyệt, gửi mật khẩu thật (ĐÃ CHỐT) | B — Bỏ duyệt, gửi ngay | C — Giữ duyệt, gửi link đặt mật khẩu |
|---|---|---|---|
| Đúng yêu cầu tường minh của anh ("gửi tk, mk ngẫu nhiên") | Đúng | Đúng | Không đúng — không gửi mật khẩu |
| Mức thay đổi so với kiến trúc hiện có | Thấp — chỉ đổi cách sinh/gửi mật khẩu ở 1 hàm, giữ nguyên state machine `InviteRequest`, giữ nguyên vai trò ADMIN | Cao — bỏ hẳn 1 giai đoạn nghiệp vụ (`InviteRequest` PENDING/APPROVED mất ý nghĩa), ảnh hưởng cả UI duyệt lời mời ở `maxv/` (đang dùng) | Thấp — gần như chỉ đổi nội dung email, tái dùng nguyên luồng OTP đã có |
| Rủi ro bảo mật | Trung bình — mật khẩu rõ nằm trong hộp thư một thời gian ngắn (tới lần đăng nhập đầu); giảm bằng: mật khẩu mạnh, bắt đổi ngay, không log/không trả API, kênh SMTP bắt buộc TLS (đã có) | Trung bình — cùng rủi ro như A, cộng thêm mất lớp kiểm soát của ADMIN (rủi ro lạm dụng/spam tạo tài khoản) | Thấp nhất — không có secret nằm trong email, đúng tinh thần quyết định 2026-09-10 |
| Trải nghiệm nhân viên | Đăng nhập được ngay bằng thông tin trong email, phải đổi mật khẩu 1 lần | Đăng nhập được ngay, không chờ ADMIN | Phải tự thao tác thêm 1 bước (đặt mật khẩu) trước khi dùng được — không "dùng ngay" như owner mô tả |
| Ảnh hưởng phạm vi khác | Không | Có — đụng tới UI duyệt lời mời ở `maxv/`, ngoài phạm vi "trong `hdđt_maxv`" mà anh mô tả | Không |
| Độ phức tạp triển khai | Thấp | Cao | Thấp |

## 5. Business Rules

- **BR-phan-quyen-nhan-vien-001**: Nhân viên (`OWNER_EMPLOYEE`) dùng chung toàn bộ module đã bật trong gói thuê bao hiện có của owner; không có cơ chế giới hạn/bật-tắt module riêng theo từng nhân viên (giữ nguyên `moduleCuaUser()`, không đổi trong feature này).
- **BR-phan-quyen-nhan-vien-002**: Nhân viên chỉ được xem và thao tác trên các công ty (MST) mà `DonViAccess` đã cấp; việc lọc này áp dụng ở tầng API cho mọi route đọc/ghi dữ liệu tenant (Hoá đơn điện tử, Tờ khai, Dịch vụ công, HRM, Kế toán), không chỉ ẩn trên giao diện.
- **BR-phan-quyen-nhan-vien-003**: Owner mời nhân viên bằng cách gửi lời mời đích danh 1 hoặc nhiều công ty do chính owner sở hữu (owner chọn trong dialog mời, xem FR-002); nhân viên chỉ nhận được quyền vào đúng (những) công ty đó khi lời mời được duyệt.
- **BR-phan-quyen-nhan-vien-004**: ✅ **Đã chốt** — Lời mời nhân viên vẫn phải qua ADMIN hệ thống duyệt trước khi tài khoản được tạo, giữ nguyên luồng hiện có (Phương án A, Mục 4).
- **BR-phan-quyen-nhan-vien-005**: ✅ **Đã chốt** — Khi ADMIN duyệt một lời mời, hệ thống sinh một mật khẩu ngẫu nhiên **≥ 12 ký tự, đủ chữ hoa, chữ thường và số** (mạnh hơn chính sách tối thiểu hiện hành ≥ 8 ký tự có chữ và số) cho tài khoản nhân viên mới, và gửi qua email đúng địa chỉ đã mời kèm email đăng nhập.
- **BR-phan-quyen-nhan-vien-006**: Tài khoản nhân viên vừa tạo theo BR-005 phải được đánh dấu "bắt buộc đổi mật khẩu ở lần đăng nhập kế tiếp"; hệ thống chặn mọi thao tác khác của tài khoản đó cho tới khi đổi mật khẩu xong.
- **BR-phan-quyen-nhan-vien-007**: Mật khẩu ngẫu nhiên sinh theo BR-005 không được ghi vào nhật ký hệ thống (`SysLog`), không xuất hiện trong bất kỳ response API nào (kể cả response duyệt lời mời), chỉ tồn tại trong nội dung email gửi đi và bản băm (hash) lưu ở CSDL.
- **BR-phan-quyen-nhan-vien-008**: Một email chỉ gắn với đúng một tài khoản người dùng trong toàn hệ thống (giữ nguyên); mời một email đã có tài khoản — dù là nhân viên hiện có của chính owner hay của owner khác — không tạo tài khoản mới.
- **BR-phan-quyen-nhan-vien-009**: Chỉ OWNER của tài khoản được mời nhân viên và xem danh sách nhân viên/lời mời của chính tài khoản mình trong màn "Cài đặt → Nhân viên" ở `hdđt_maxv`.
- **BR-phan-quyen-nhan-vien-010**: Gửi email báo mật khẩu thất bại (lỗi SMTP) ngay sau khi tài khoản vừa tạo thì hệ thống phải huỷ tài khoản đó và đưa lời mời về lại trạng thái PENDING (giữ nguyên cơ chế rollback hiện có) — không để lại tài khoản "mồ côi" mà không ai (kể cả hệ thống) biết mật khẩu.
- **BR-phan-quyen-nhan-vien-011**: Cơ chế "Quên mật khẩu" (OTP — sinh mã, hạn dùng, số lần thử, rate limit) và luồng ADMIN đặt lại mật khẩu (`adminResetPassword`) giữ nguyên hoàn toàn — BR-005..007 chỉ áp dụng cho thời điểm TẠO tài khoản mới qua duyệt lời mời, không áp dụng cho 2 luồng này. **Ngoại lệ (cập nhật sau đối soát với Architect, MT-01):** khi `resetPasswordWithOtp` đặt lại mật khẩu thành công cho một tài khoản đang ở trạng thái "phải đổi mật khẩu", hệ thống phải gỡ luôn trạng thái đó — nhân viên đã tự chọn mật khẩu mới qua đường OTP coi như đã hoàn tất yêu cầu BR-006 bằng đường khác, không bắt đổi thêm lần nữa. `adminResetPassword` không đụng tới trạng thái này (đặt mật khẩu về "không ai biết", buộc nhân viên tự dùng OTP — khi đó áp dụng đúng ngoại lệ trên).
- **BR-phan-quyen-nhan-vien-012** (MỚI): Chỉ OWNER sửa được quyền công ty và quyền xem lương của nhân viên thuộc chính tài khoản mình (đã đúng ở BE — `setEmployeeAccess()` kiểm `ownerId` trùng khớp — nay formalize vì có UI thao tác trực tiếp).
- **BR-phan-quyen-nhan-vien-013** (MỚI): Thu hồi toàn bộ quyền công ty của 1 nhân viên (owner bỏ tick hết trong panel Sửa quyền) KHÔNG xoá tài khoản nhân viên — tài khoản vẫn tồn tại, vẫn tính vào trần số nhân viên của gói, chỉ không đăng nhập vào được công ty nào cho tới khi được cấp lại.
- **BR-phan-quyen-nhan-vien-014** (MỚI — ⚠️ GIẢ ĐỊNH, chờ anh xác nhận ở lần duyệt cuối): Quyền "xem lương" (`xemLuong`, ADR-007) là thuộc tính theo CẶP (nhân viên, công ty) — panel Sửa quyền chỉ cho bật ô "Xem lương" của 1 công ty khi công ty đó đã được tick cấp quyền truy cập; bỏ tick 1 công ty thì mất luôn quyền xem lương của công ty đó (nhất quán với cách `PUT .../access` hiện lưu `xemLuong` gắn theo từng cặp `DonViAccess`, không rule mới nào khác ADR-007).
- **BR-phan-quyen-nhan-vien-015** (MỚI — theo `api-contract.md` MT-13): Khi ADMIN duyệt một lời mời, hệ thống chỉ tạo quyền (`DonViAccess`) cho các công ty trong `donViIds` còn tồn tại và vẫn thuộc owner tại thời điểm duyệt; công ty đã bị owner xoá cứng giữa lúc mời và lúc duyệt bị bỏ qua một cách âm thầm (không chặn cả việc duyệt bằng lỗi 409 khó hiểu như hiện tại).

## 6. Functional Requirements

- **FR-phan-quyen-nhan-vien-001**: `hdđt_maxv` có màn "Cài đặt → Nhân viên" (chỉ owner thấy mục này), gồm: bảng nhân viên (Nhân viên/Email, Chức vụ, Vai trò, Trạng thái, Công ty được cấp, nút "Sửa quyền"), bảng lời mời đang chờ duyệt (Email, Họ tên, Chức vụ, Công ty, Ngày gửi, Trạng thái), nút "Thêm nhân viên".
- **FR-phan-quyen-nhan-vien-002**: ✅ **Đã chốt (OQ-3)** — Dialog "Thêm nhân viên" ở `hdđt_maxv` thu thập họ tên, email, chức vụ, và **danh sách công ty của owner dạng checkbox** (không gắn cứng 1 công ty); công ty đang chọn ở header được **tick sẵn mặc định**, owner có thể tick thêm/bớt trước khi gửi. Gửi `POST /companies/invite` với `donViIds` = danh sách công ty đã tick.
- **FR-phan-quyen-nhan-vien-003**: Khi ADMIN duyệt lời mời (`POST /admin/companies/invites/:id/approve`), hệ thống thay cơ chế sinh mật khẩu hiện tại (`bamMatKhauKhongAiBiet`) bằng sinh mật khẩu ngẫu nhiên thật (BR-005), gửi email mới chứa email đăng nhập + mật khẩu đó (thay nội dung `inviteApprovedEmail` hiện tại), và đánh dấu tài khoản phải đổi mật khẩu ở lần đăng nhập kế tiếp (BR-006).
- **FR-phan-quyen-nhan-vien-004**: Hệ thống chặn mọi request nghiệp vụ của tài khoản đang ở trạng thái "phải đổi mật khẩu", **trừ đúng 2 API** (đã đối soát với Architect, MT-02/SPEC-QA-002): `GET /auth/me` (để FE lấy lại thông tin cơ bản dựng màn đổi mật khẩu bắt buộc sau khi tải lại trang) và `POST /auth/change-password` (API đổi mật khẩu). Đăng nhập, làm mới phiên, đăng xuất và "Quên mật khẩu" vốn không đi qua guard đăng nhập nên không cần liệt kê riêng. Request bị chặn trả lỗi rõ để FE điều hướng sang màn đổi mật khẩu bắt buộc.
- **FR-phan-quyen-nhan-vien-005**: Nhân viên hoàn tất đổi mật khẩu bắt buộc thì được vào hệ thống bình thường như một tài khoản đã kích hoạt, không phải lặp lại bước này ở các lần đăng nhập sau.
- **FR-phan-quyen-nhan-vien-006**: Giữ nguyên hành vi hiện có (không sửa code): `GET /companies` chỉ trả các công ty owner sở hữu (vai trò OWNER) hoặc được cấp qua `DonViAccess` (vai trò OWNER_EMPLOYEE); mọi route dữ liệu tenant tiếp tục đi qua `resolveTenantDb`/`resolveTenantInfo` để chặn công ty không được cấp ngay ở tầng API.
- **FR-phan-quyen-nhan-vien-007**: Bảng nhân viên ở FR-001 hiển thị đúng danh sách công ty đang được cấp cho từng nhân viên (đọc từ `DonViAccess`, không cần API mới — dùng lại `GET /companies/employees` đã có `donViAccess`).
- **FR-phan-quyen-nhan-vien-008**: Mục "Nhân viên" trong Cài đặt của `hdđt_maxv` chỉ hiển thị khi `user.role === 'OWNER'` (BR-009).
- **FR-phan-quyen-nhan-vien-009** (MỚI — OQ-4): Nút "Sửa quyền" trên mỗi dòng nhân viên đã duyệt mở panel liệt kê **toàn bộ công ty của owner**, mỗi dòng có: checkbox "Cấp quyền" (đã tick sẵn theo `DonViAccess` hiện có của nhân viên đó) và checkbox "Xem lương" (chỉ bật/tick được khi "Cấp quyền" của đúng dòng đó đang tick — BR-014). Bấm Lưu gọi `PUT /companies/employees/:userId/access` với `access` gồm các công ty đã tick, kèm `xemLuong` theo ô tương ứng.
- **FR-phan-quyen-nhan-vien-010** (MỚI — OQ-4): Nếu owner bỏ tick TẤT CẢ công ty trong panel Sửa quyền (tức mảng gửi lên có độ dài 0 — điều kiện là **số lượng công ty đã tick tại thời điểm Lưu bằng 0**, không liên quan số lượng công ty đã giảm bao nhiêu so với trước đó, làm rõ theo SPEC-QA-009) rồi bấm Lưu, hệ thống hiển thị hộp thoại xác nhận cảnh báo rõ "nhân viên này sẽ mất quyền vào mọi công ty" trước khi thực sự gửi API — tránh thu hồi nhầm do bấm nhanh.
- **FR-phan-quyen-nhan-vien-011** (MỚI — OQ-4): Panel Sửa quyền và dialog Thêm nhân viên chỉ liệt kê công ty do chính owner sở hữu (không có công ty nào khác để chọn nhầm) — khớp với việc BE luôn validate `donViId` thuộc owner (403 `COMPANY.NO_ACCESS` nếu vi phạm, coi như hàng phòng thủ thứ hai).
- **FR-phan-quyen-nhan-vien-012** (MỚI — theo `api-contract.md` SPEC-QA-004): Nguồn danh sách công ty cho dialog Thêm nhân viên và panel Sửa quyền PHẢI là `GET /companies` (đã lọc bỏ công ty `SUSPENDED`/`ARCHIVED` theo `accessibleDonViWhere`), không tự truy vấn nguồn khác. Nếu owner cần thấy công ty đang `SUSPENDED` để biết lý do, hiển thị dòng riêng ở trạng thái vô hiệu hoá (disabled) kèm nhãn "Đang bị tạm khoá", không cho tick — tránh owner tưởng đã cấp quyền trong khi nhân viên vẫn bị chặn ở tầng API.

## 7. Non-Functional Requirements

- **NFR-phan-quyen-nhan-vien-001**: Mật khẩu ngẫu nhiên sinh theo BR-005 phải đủ entropy chống đoán trong thời gian ngắn (≥ 12 ký tự sinh ngẫu nhiên thật, không dùng từ điển/mẫu dễ đoán) — cách sinh cụ thể do Architect quyết định.
- **NFR-phan-quyen-nhan-vien-002**: Email chứa mật khẩu tiếp tục đi qua kênh SMTP bắt buộc TLS đã có (`cauHinhSmtp`, `requireTLS`), không hạ chuẩn.
- **NFR-phan-quyen-nhan-vien-003**: Màn "Cài đặt → Nhân viên" chỉ owner thao tác được; API mời giữ nguyên rate limit hiện có (20 lượt/giờ theo owner).
- **NFR-phan-quyen-nhan-vien-004** (MỚI): Hai lượt lưu panel Sửa quyền song song cho cùng 1 nhân viên (owner mở 2 tab, hoặc bấm Lưu 2 lần) không được gây lỗi 500 — Architect áp dụng cùng cơ chế khoá advisory theo owner (`khoaHanMuc`) đã dùng cho lời mời/duyệt (xem rủi ro deadlock đã ghi nhận ở vòng 1, Mục 10 Edge Case EC-10).

## 8. Error Matrix

| Mã lỗi | Khi nào | HTTP | Nguồn |
|---|---|---|---|
| E-phan-quyen-nhan-vien-001 | Không phải OWNER gọi mời nhân viên / sửa quyền / xem màn Nhân viên | 403 | Tái dùng `requireRole('OWNER')` (đã có, không đổi) |
| E-phan-quyen-nhan-vien-002 | Mời email đã có tài khoản (owner khác hoặc nhân viên tài khoản khác) | 409 `EMAIL_ALREADY_MEMBER` | Đã có, không đổi (xem EC-02 về wording khi cùng owner) |
| E-phan-quyen-nhan-vien-003 | Mời lại email đang có lời mời PENDING trong cùng tài khoản | 409 `INVITE_ALREADY_PENDING` | Đã có, không đổi |
| E-phan-quyen-nhan-vien-004 | Gửi email chứa mật khẩu thất bại (lỗi SMTP) ngay sau khi tạo tài khoản | 502 | Huỷ tài khoản vừa tạo + đưa lời mời về PENDING (rollback hiện có, BR-010), đổi thông điệp lỗi cho khớp nội dung email mới |
| E-phan-quyen-nhan-vien-005 | Tài khoản đang ở trạng thái "phải đổi mật khẩu" gọi API nghiệp vụ khác | 403 `PASSWORD_CHANGE_REQUIRED` | Mã lỗi mới — Architect thiết kế guard cụ thể (FR-004) |
| E-phan-quyen-nhan-vien-006 | Đổi mật khẩu bắt buộc lần đầu nhưng mật khẩu mới không đạt chính sách hiện hành | 400 | Tái dùng `passwordRule` (≥ 8 ký tự, có chữ và số) đã có |
| E-phan-quyen-nhan-vien-007 | Nhân viên/tài khoản không có quyền công ty gọi API dữ liệu tenant của công ty đó | 403 `COMPANY.NO_ACCESS` | Đã có, không đổi (FR-006) |
| E-phan-quyen-nhan-vien-008 (MỚI) | Dialog Thêm nhân viên: owner không tick công ty nào rồi gửi | 400 | Validate tối thiểu 1 công ty ở FE, tái dùng validator BE hiện có (`donViIds` tối thiểu 1) |
| E-phan-quyen-nhan-vien-009 (MỚI) | Panel Sửa quyền: owner thao tác nhân viên không thuộc tài khoản mình / không phải `OWNER_EMPLOYEE` | 404 `USER.NOT_FOUND` | Đã có ở `setEmployeeAccess()`, không đổi |
| E-phan-quyen-nhan-vien-010 (MỚI) | Panel Sửa quyền: gửi công ty không thuộc owner (chỉ xảy ra khi gọi thẳng API, UI không cho chọn — FR-011) | 403 `COMPANY.NO_ACCESS` | Đã có, không đổi |
| E-phan-quyen-nhan-vien-011 (MỚI — MT-03) | Đổi mật khẩu (bắt buộc hoặc tự nguyện) nhưng nhập sai mật khẩu hiện tại | 400 `AUTH.CURRENT_PASSWORD_WRONG` | Mã lỗi mới — cố ý trả 400 chứ không phải 401 (tránh FE tự gọi refresh rồi gửi lại request) |
| E-phan-quyen-nhan-vien-012 (MỚI — MT-03) | Đổi mật khẩu nhưng mật khẩu mới trùng mật khẩu hiện tại | 400 `VALIDATION.PASSWORD_SAME` | Mã lỗi mới |
| E-phan-quyen-nhan-vien-013 (MỚI — MT-07/SPEC-QA-005) | Dialog Thêm nhân viên hoặc panel Sửa quyền gửi danh sách công ty có phần tử trùng lặp | 400 `VALIDATION.DON_VI_TRUNG` | Mã lỗi mới — thay cho 403 `COMPANY.NO_ACCESS` sai nghĩa hiện tại (Prisma trả distinct nên số lượng lệch, rơi nhầm vào nhánh "không thuộc owner") |

## 9. User Stories & Acceptance Criteria

### US-01 — Owner mời nhân viên trong `hdđt_maxv`

> Là một owner đang làm việc trong `hdđt_maxv`, tôi muốn mời nhân viên ngay tại đây, chọn được nhiều công ty cùng lúc, không phải mở `fe_maxv`.

- **AC-01.1** (FR-001, FR-002): Given owner đang chọn công ty X ở header và sở hữu thêm công ty Y, When owner mở Cài đặt → Nhân viên → Thêm nhân viên, Then dialog hiển thị danh sách công ty X và Y dạng checkbox với X đã tick sẵn; owner điền họ tên/email/chức vụ, tick thêm Y, và gửi, Then hệ thống gọi `POST /companies/invite` với `donViIds: [X.id, Y.id]`, lời mời xuất hiện ở bảng "Đang chờ duyệt" với trạng thái PENDING.
- **AC-01.2** (E-003): Given email đó đã có 1 lời mời PENDING trong cùng tài khoản, When owner gửi lại lời mời trùng email, Then hệ thống báo lỗi rõ ràng trên form (409 `INVITE_ALREADY_PENDING`), không tạo thêm bản ghi.
- **AC-01.3** (E-002): Given email đó đã là tài khoản của owner khác, When owner gửi lời mời, Then hệ thống báo lỗi rõ ràng (409 `EMAIL_ALREADY_MEMBER`), không tạo tài khoản mới.
- **AC-01.4** (FR-008): Given user đăng nhập là `OWNER_EMPLOYEE`, When họ mở trang Cài đặt, Then mục "Nhân viên" không xuất hiện trong danh sách mục Cài đặt bên trái.
- **AC-01.5** (E-008, FR-011): Given owner chỉ có 1 công ty, When owner mở dialog Thêm nhân viên, Then dialog chỉ hiển thị 1 dòng công ty đó, đã tick sẵn, owner không cần thao tác chọn thêm gì (trải nghiệm gọn — EC-07).
- **AC-01.6** (E-008): Given owner bỏ tick hết mọi công ty trong dialog Thêm nhân viên, When bấm Gửi, Then hệ thống chặn submit ngay ở FE kèm thông báo "Chọn ít nhất 1 công ty", không gọi API.

### US-02 — Nhân viên nhận tài khoản kèm mật khẩu qua email sau khi được duyệt

> Là một nhân viên vừa được mời, tôi muốn nhận được thông tin đăng nhập qua email và vào dùng được ngay.

- **AC-02.1** (FR-003, BR-005, BR-006): Given ADMIN duyệt một lời mời đang PENDING, When duyệt thành công, Then hệ thống tạo `User` mới với mật khẩu ngẫu nhiên ≥ 12 ký tự đủ chữ hoa/chữ thường/số, gửi email tới đúng địa chỉ được mời chứa email đăng nhập + mật khẩu đó, và đánh dấu tài khoản "phải đổi mật khẩu ở lần đăng nhập đầu".
- **AC-02.2** (FR-004): Given nhân viên đăng nhập lần đầu bằng mật khẩu nhận được trong email, When đăng nhập thành công, Then hệ thống bắt buộc đổi mật khẩu mới trước khi cho vào bất kỳ trang/chức năng nào khác.
- **AC-02.3** (FR-005): Given nhân viên vừa đổi mật khẩu bắt buộc thành công, When họ đăng nhập lại ở lần sau, Then hệ thống KHÔNG bắt đổi mật khẩu lại, vào thẳng hệ thống như tài khoản bình thường.
- **AC-02.4** (E-004, BR-010): Given tài khoản nhân viên vừa được tạo trong giao dịch duyệt, When gửi email chứa mật khẩu thất bại (lỗi SMTP), Then hệ thống huỷ tài khoản vừa tạo, đưa lời mời về lại PENDING, không để lại tài khoản không ai biết mật khẩu. *(Lưu ý MT-11: đảm bảo này đúng khi bước huỷ/rollback tự nó chạy thành công; trường hợp hiếm rollback cũng lỗi — vd CSDL rớt đúng lúc đó — tài khoản có thể còn lại với mật khẩu không ai biết, khôi phục bằng "Quên mật khẩu" OTP hoặc ADMIN đặt lại mật khẩu.)*
- **AC-02.5** (E-006): Given nhân viên đang ở màn đổi mật khẩu bắt buộc, When họ nhập mật khẩu mới không đạt chính sách tối thiểu (dưới 8 ký tự, hoặc thiếu chữ/số), Then hệ thống báo lỗi rõ ràng, không cho qua bước này.
- **AC-02.6** (E-011, MT-03): Given nhân viên đang đổi mật khẩu (bắt buộc lần đầu hoặc tự nguyện sau này), When nhập sai mật khẩu hiện tại, Then hệ thống báo lỗi rõ ràng ngay trên ô mật khẩu hiện tại, không thực hiện đổi.
- **AC-02.7** (E-012, MT-03): Given nhân viên đang đổi mật khẩu, When mật khẩu mới nhập vào trùng với mật khẩu hiện tại, Then hệ thống báo lỗi rõ ràng, không thực hiện đổi.

### US-03 — Nhân viên chỉ thấy công ty được cấp quyền

> Là một nhân viên, tôi chỉ muốn thấy và làm việc được với công ty mà chủ tài khoản đã mời tôi vào, không thấy các công ty khác của họ.

- **AC-03.1** (FR-006): Given nhân viên A chỉ được cấp quyền vào công ty X (không phải Y, dù Y cũng thuộc owner của A), When A đăng nhập và mở bộ chọn công ty ở header hoặc màn Cài đặt → Công ty, Then A chỉ thấy công ty X, không thấy Y.
- **AC-03.2** (FR-006, E-007): Given nhân viên A không có quyền vào công ty Y, When A cố gọi thẳng API đổi công ty (`POST /companies/{Y}/switch`) hoặc gọi thẳng API dữ liệu (Hoá đơn điện tử/Tờ khai/Dịch vụ công/HRM/Kế toán) của công ty Y bằng cách sửa request (bỏ qua UI), Then hệ thống trả 403 `COMPANY.NO_ACCESS` ngay tại tầng API — hành vi đã đúng, không cần sửa code, chỉ cần QA xác nhận lại (regression).
- **AC-03.3**: Given owner thu hồi toàn bộ quyền công ty X khỏi nhân viên A trong lúc A đang mở công ty X, When A gọi API tiếp theo của công ty X (ví dụ tải danh sách hoá đơn), Then request đó bị chặn 403 ngay lập tức, không chờ A tải lại trang (do `resolveTenantInfo` tra CSDL mỗi request, không cache).
- **AC-03.4** (MT-06, cập nhật sau đối soát Architect): Given nhân viên A đang mở công ty X, When A nhận response 403 `COMPANY_NO_ACCESS` ở request ĐẦU TIÊN sau khi bị thu hồi (đúng AC-03.3), Then FE của A **ngay lập tức** đồng bộ lại danh sách công ty (`GET /companies`) và tự chuyển sang công ty còn quyền gần nhất nếu có — không đợi A tự mở lại bộ chọn công ty hay tải lại trang (mạnh hơn mức "chấp nhận trễ tới lần gọi lại/F5" mà spec vòng trước nêu).

### US-04 — Owner sửa quyền công ty (và quyền xem lương) của nhân viên đã duyệt (MỚI — OQ-4)

> Là một owner, tôi muốn cấp thêm hoặc thu hồi công ty của 1 nhân viên đã duyệt, và bật/tắt quyền xem lương theo từng công ty, ngay trong màn Nhân viên.

- **AC-04.1** (FR-009): Given nhân viên C đã duyệt, hiện chỉ có quyền công ty X, When owner mở panel Sửa quyền của C, tick thêm công ty Y, bấm Lưu, Then hệ thống gọi `PUT /companies/employees/C/access` với `access` gồm cả X và Y; C thấy thêm công ty Y ở lần gọi `GET /companies` tiếp theo (bộ chọn công ty mở lại, hoặc tải lại trang) — quyền có hiệu lực ngay ở tầng API, không cần đăng nhập lại vì `DonViAccess` được tra mới mỗi request, không nằm trong JWT.
- **AC-04.2** (FR-009, AC-03.3): Given nhân viên C đang có quyền công ty X và Y, When owner bỏ tick Y trong panel Sửa quyền và bấm Lưu, Then C mất quyền vào Y ngay ở API tiếp theo (nếu C đang mở Y thì request kế tiếp bị 403 ngay — đúng AC-03.3), bảng nhân viên của owner cập nhật lại cột "Công ty được cấp" ngay sau khi lưu.
- **AC-04.3** (FR-010): Given owner bỏ tick TẤT CẢ công ty của nhân viên C trong panel Sửa quyền, When bấm Lưu, Then hệ thống hiện hộp thoại xác nhận cảnh báo rõ "C sẽ mất quyền vào mọi công ty"; owner xác nhận thì mới gọi API với `access: []` (BR-013 — tài khoản C vẫn tồn tại, không bị xoá).
- **AC-04.4** (FR-009, BR-014 — ⚠️ giả định chờ duyệt cuối): Given công ty X đã được tick "Cấp quyền" cho C, When owner tick thêm "Xem lương" của X và bấm Lưu, Then hệ thống gửi `access: [{ donViId: X, xemLuong: true }, ...]`; C xem được dữ liệu lương của công ty X theo đúng rule đã có ở ADR-007 (không đổi rule, chỉ thêm chỗ bấm).
- **AC-04.5** (E-010): Given (giả lập gọi thẳng API, không qua UI vì FR-011 đã chặn ở FE) `access` chứa `donViId` không thuộc owner, When gọi `PUT .../access`, Then hệ thống trả 403 `COMPANY.NO_ACCESS`, không ghi nhận thay đổi nào.
- **AC-04.6** (E-009): Given `userId` trong panel Sửa quyền không thuộc tài khoản của owner đang thao tác (ví dụ dò URL/API), When gọi `PUT .../access`, Then hệ thống trả 404 `USER.NOT_FOUND` (không phân biệt "không tồn tại" và "thuộc owner khác", chống dò).

## 10. Edge Cases

| # | Tình huống | Xử lý đề xuất |
|---|---|---|
| EC-01 | Gửi email chứa mật khẩu thất bại sau khi tài khoản đã tạo | Rollback toàn bộ (xoá `User`, lời mời về PENDING) — cơ chế đã có, giữ nguyên. Xem BR-010, AC-02.4. |
| EC-02 | Owner mời lại 1 email đã là nhân viên của CHÍNH mình (ví dụ muốn cấp thêm công ty khác) | Hiện bị chặn cứng `EMAIL_ALREADY_MEMBER` giống hệt trường hợp email thuộc owner khác — không phân biệt 2 tình huống trong thông điệp lỗi. Từ nay owner có panel Sửa quyền (US-04) để cấp thêm công ty cho nhân viên hiện có, nên hướng xử lý đúng là dùng panel đó thay vì mời lại. **Xem OQ-5** về việc có tách riêng wording lỗi để gợi ý điều này không. |
| EC-03 | Dialog mời chọn công ty nào | ✅ **Đã chốt (OQ-3)**: cho tick nhiều công ty, mặc định tick sẵn công ty đang chọn ở header (FR-002, AC-01.1). |
| EC-04 | Thu hồi quyền 1 công ty / vô hiệu hoá nhân viên sau khi đã duyệt | ✅ **Đã chốt (OQ-4)**: làm trong đợt này qua panel Sửa quyền (US-04, FR-009..011). Xem thêm EC-04a/b/c dưới. |
| EC-04a | Nhân viên đang mở công ty X bị owner thu hồi X ngay trong panel Sửa quyền | Giống EC-06/AC-03.3 — BE chặn API tiếp theo ngay lập tức, không chờ nhân viên tải lại trang. |
| EC-04b | Owner thu hồi HẾT mọi công ty của 1 nhân viên | Tài khoản nhân viên vẫn tồn tại (không bị xoá), vẫn tính vào trần số nhân viên của gói, chỉ không đăng nhập vào được công ty nào (BR-013) — giống EC-08 áp dụng cho chính nhân viên đó. |
| EC-04c | Owner bỏ tick hết rồi bấm Lưu (dễ bấm nhầm) | Bắt buộc hộp thoại xác nhận trước khi gửi API (FR-010, AC-04.3) — tránh thu hồi nhầm toàn bộ chỉ vì thao tác nhanh tay. |
| EC-04d | Owner (hoặc request giả mạo) chọn/gửi công ty không thuộc mình | UI chỉ liệt kê công ty của owner (FR-011); BE vẫn chặn ở tầng API nếu bị lách qua (403 `COMPANY.NO_ACCESS`, E-010) — 2 lớp phòng thủ. |
| EC-05 | Quyền xem lương (`xemLuong`, ADR-007) trong màn nhân viên mới | ✅ **Đã chốt (OQ-4), ⚠️ giả định BR-014 chờ duyệt cuối**: đưa vào panel Sửa quyền, theo cặp (nhân viên, công ty) — không đổi rule ADR-007. |
| EC-06 | Nhân viên đang mở công ty A bị owner thu hồi quyền ngay lúc đó | BE chặn API ngay lập tức (đã đúng, `resolveTenantInfo` tra CSDL mỗi request — AC-03.3). ✅ **Cập nhật (MT-06, sau đối soát Architect):** FE KHÔNG chờ tới lần gọi `GET /companies` kế tiếp hay tải lại trang như đề xuất ban đầu — ngay khi nhận 403 `COMPANY_NO_ACCESS` đầu tiên, FE tự đồng bộ lại danh sách công ty và chuyển sang công ty còn quyền gần nhất (AC-03.4). Không polling nền, chỉ phản ứng theo response lỗi thật. |
| EC-07 | Owner chỉ có 1 công ty | Dialog mời chỉ hiện 1 dòng, đã tick sẵn — không cần thao tác thêm (AC-01.5). Panel Sửa quyền tương tự, chỉ hiện đúng 1 công ty để tick/bỏ tick. |
| EC-08 | Nhân viên chưa được cấp công ty nào đăng nhập | `GET /companies` trả mảng rỗng, header ẩn hẳn bộ chọn công ty (hành vi hiện có, không phải lỗi mới của feature này). Chưa có thông báo rõ ràng kiểu "chưa được cấp công ty nào, liên hệ chủ tài khoản". **Xem OQ-8.** |
| EC-09 | `GET /companies/employees` hiện mở cho cả OWNER_EMPLOYEE gọi được, không chỉ OWNER | Nhân viên đọc được thông tin đồng nghiệp (email, chức vụ, `xemLuong`, và nay cả danh sách công ty được cấp của từng người) qua API này dù UI đã ẩn màn Nhân viên với nhân viên. Từ khi màn này thêm thao tác sửa quyền (US-04), mức độ nhạy cảm của dữ liệu trả về tăng lên đáng kể so với vòng trước. **Xem OQ-7 (đã cân nhắc lại đề xuất).** |
| EC-10 | Hai `PUT /companies/employees/:userId/access` song song cho cùng nhân viên | Nay **áp dụng thật** vì panel Sửa quyền được xây trong đợt này (owner mở 2 tab, hoặc bấm Lưu 2 lần liên tiếp) — rủi ro deadlock đã ghi nhận ở vòng 1 (`data-model.md` vòng 1 Mục 5.2). Kèm mitigation đề xuất: dùng khoá advisory theo owner (`khoaHanMuc`) như lời mời/duyệt đang dùng (NFR-004). **Xác nhận từ Architect (SPEC-QA-010):** khoá này **chưa tồn tại** trong `setEmployeeAccess()` hiện tại — đây là lỗ hổng có sẵn trong code TRƯỚC cả feature này, không phải rủi ro mới sinh ra, nhưng đáng sửa cùng đợt vì đang mở rộng đúng hàm này cho panel Sửa quyền. |
| EC-11 | 1 nhân viên thuộc nhiều owner | Không thể xảy ra — `User.ownerId` là FK đơn, và `EMAIL_ALREADY_MEMBER` chặn mời email đã có `User` bất kể thuộc owner nào (đã xác nhận bằng code, không đổi). |
| EC-12 | Đổi mật khẩu: nhập sai mật khẩu hiện tại / nhập mật khẩu mới trùng mật khẩu hiện tại | Xem E-011, E-012, AC-02.6, AC-02.7 (bổ sung sau đối soát Architect, MT-03). |
| EC-13 (MỚI — MT-13) | ADMIN duyệt lời mời khi 1 công ty trong `donViIds` đã bị owner xoá cứng giữa lúc mời và lúc duyệt | Trước đây: `donViAccess.createMany` vi phạm khoá ngoại → 409 `COMMON.STILL_REFERENCED` khó hiểu cho ADMIN (lời mời vẫn PENDING, đúng, nhưng thông điệp không rõ nguyên nhân). Nay: bỏ qua công ty đã mất khi tạo `DonViAccess`, duyệt vẫn thành công cho các công ty còn lại (BR-015). |
| EC-14 (MỚI — SPEC-QA-004) | Công ty đang bị ADMIN tạm khoá (`SUSPENDED`) nằm trong danh sách công ty của owner | Dialog Thêm nhân viên / panel Sửa quyền hiển thị dòng riêng, vô hiệu hoá, nhãn "Đang bị tạm khoá" (FR-012) — owner không tick nhầm tưởng đã cấp quyền trong khi nhân viên vẫn bị `accessibleDonViWhere` chặn. |
| EC-15 (MỚI — SPEC-QA-006, 🟡 không chặn thiết kế) | Trần số nhân viên hiển thị khi có nhân viên đã bị thu hồi hết công ty (BR-013) | Đề xuất UI (không bắt buộc đợt này): hiển thị rõ tổng số nhân viên kể cả người 0-công-ty, hoặc thêm dòng phụ "trong đó N người chưa được cấp công ty nào" — tránh owner hiểu lầm còn ghế trống trong gói. |

## 11. Câu hỏi mở cần anh chủ dự án quyết

### Đã chốt (2026-09-17)

1. ✅ **OQ-1 — Đảo ngược quyết định bảo mật "không gửi mật khẩu qua email"**: **Đồng ý, xác nhận tường minh.** Áp dụng Phương án A (Mục 4): gửi mật khẩu ngẫu nhiên thật ≥ 12 ký tự đủ hoa/thường/số qua email, kèm mitigation (bắt đổi mật khẩu ngay lần đăng nhập đầu, không log, không trả qua API). Đã cập nhật BR-005..007, AC-02.*.
2. ✅ **OQ-2 — Giữ hay bỏ bước ADMIN duyệt**: **Giữ nguyên** bước ADMIN duyệt như hiện tại — duyệt xong mới tạo tài khoản và gửi email (BR-004).
3. ✅ **OQ-3 — Dialog mời chọn 1 hay nhiều công ty**: **Cho chọn nhiều công ty** của owner, công ty đang chọn ở header được tick sẵn mặc định (FR-002, AC-01.1, AC-01.5).
4. ✅ **OQ-4 — Có xây UI sửa quyền công ty đã duyệt không**: **Làm cả hai** trong đợt này — (1) mời + xem danh sách, và (2) panel Sửa quyền (cấp thêm/thu hồi công ty), kèm ô bật/tắt xem lương theo từng công ty (US-04, FR-009..011). Cờ xem lương theo công ty là **giả định BR-014**, đánh dấu rõ để anh xem lại ở lần duyệt cuối.

### Còn mở

5. Mời lại 1 email đã là nhân viên của CHÍNH owner (muốn thêm công ty khác) hiện bị chặn cứng giống hệt trường hợp thuộc owner khác — có cần tách riêng thông điệp lỗi (gợi ý "dùng panel Sửa quyền" cho trường hợp cùng owner, xem EC-02) không? Đề xuất mặc định: **có**, chỉ đổi wording thông báo, không đổi logic chặn (vẫn không tạo tài khoản mới).
6. Có cần nút "Gửi lại mật khẩu" cho OWNER (không chỉ ADMIN) khi nhân viên báo mất/quên thông tin đăng nhập không? Đề xuất mặc định: **không** trong đợt này — nhân viên tự dùng "Quên mật khẩu" (OTP) sẵn có.
7. 🔴 `GET /companies/employees` **và `GET /companies/invites`** (mở rộng theo `api-contract.md` MT-08) hiện mở cho cả `OWNER_EMPLOYEE` (đọc được thông tin đồng nghiệp: email, chức vụ, công ty được cấp, `xemLuong`, và cả thông tin người đang được mời) — có cần siết cả hai chỉ OWNER gọi được không? **Nâng lên 🔴 chặn thiết kế** theo yêu cầu của QA (SPEC-QA-008): nếu Backend code panel Sửa quyền (US-04) trước khi OQ-7 chốt, mặc định vẫn "mở cho cả nhân viên" — rủi ro rò rỉ lên production ngay khi feature deploy, không phải chuyện có thể sửa sau. Đề xuất mặc định (giữ nguyên từ vòng trước, nay áp cho cả 2 endpoint): **có, nên siết** — chỉ OWNER gọi được (403 với `OWNER_EMPLOYEE`/ADMIN), vì (a) không có nhu cầu nghiệp vụ nào của nhân viên cần đọc 2 API này, (b) rủi ro rò rỉ tăng theo đúng mức tăng của dữ liệu trả về khi màn Nhân viên nay có thêm thao tác sửa quyền, (c) chỉ sửa 1 dòng guard mỗi endpoint, không ảnh hưởng FE đang chạy đúng (chỉ owner mở màn Nhân viên) — riêng `fe_maxv` có 1 trang cho nhân viên xem read-only 2 API này, xem Mục "Đánh đổi tương thích ngược" trong `api-contract.md` Mục 8 (chấp nhận nhân viên `fe_maxv` không mở được trang đó nữa, hoặc ẩn trang với nhân viên).
8. Có cần thông báo rõ ràng khi nhân viên đăng nhập nhưng chưa được cấp công ty nào (hiện chỉ ẩn bộ chọn công ty, không có thông điệp)? Đề xuất mặc định: **có**, thêm 1 dòng thông báo ngắn khi `companies.length === 0` cho nhân viên.
9. Độ mạnh chính xác của mật khẩu ngẫu nhiên: **đã chốt cùng OQ-1** ở mức ≥ 12 ký tự đủ hoa/thường/số (không cần hỏi lại — giữ mục này để lưu vết đã trả lời trong cùng lần chốt OQ-1).
10. 🔴 (MỚI — theo `api-contract.md` MT-10) Mật khẩu tạm gửi qua email có nên có thời hạn không? Hiện tại **không hết hạn** — nếu nhân viên chưa đăng nhập lần nào, mật khẩu đó dùng được vô thời hạn trong hộp thư; ai đọc được email trước (hộp thư bị lộ, chuyển tiếp nhầm) có thể chiếm tài khoản trước cả chủ nhân thật. Đánh 🔴 vì chọn "có thời hạn" phải đổi kiểu dữ liệu lưu trữ (thêm mốc hết hạn cạnh cờ "phải đổi mật khẩu") **trước khi Backend code**, đổi sau sẽ phải migration lại. Đề xuất mặc định: **có, hạn 7 ngày** — hết hạn thì mật khẩu tạm không dùng được nữa, nhân viên tự khôi phục qua "Quên mật khẩu" (OTP, không cần liên hệ ai); nếu anh muốn đơn giản hơn (không thời hạn, chấp nhận rủi ro vì owner mời ai thì báo người đó đăng nhập ngay) thì giữ nguyên hiện trạng.
11. (MỚI — theo `api-contract.md` MT-12) Nhân viên mới (được duyệt sau khi triển khai) nếu đăng nhập ở `fe_maxv` (app cũ) sẽ bị kẹt hoàn toàn — app đó không có màn đổi mật khẩu bắt buộc và không đọc mã lỗi `PASSWORD_CHANGE_REQUIRED`, mọi request đều 403 chỉ hiện thông điệp chung chung, không có lối thoát trong app. Chấp nhận tình trạng này (chỉ ghi hướng dẫn "đổi mật khẩu ở `hdđt_maxv` trước" trong email/tài liệu nội bộ) hay cần chặn/hướng dẫn chuyển hướng ngay trong `fe_maxv`? Đề xuất mặc định: **chấp nhận** — thêm 1 câu trong nội dung email mật khẩu tạm (Mục 5 `api-contract.md`) dặn nhân viên đăng nhập lần đầu ở `hdđt_maxv`; không sửa `fe_maxv` (app đang được thay thế dần bởi `hdđt_maxv`, đầu tư thêm route đổi mật khẩu ở đó là lãng phí).
