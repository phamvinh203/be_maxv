---
type: srs
feature: phan-quyen-nhan-vien
status: draft
updated: 2026-09-17
links:
  - docs/phan-quyen-nhan-vien/srs/phan-quyen-nhan-vien-spec.md
  - docs/phan-quyen-nhan-vien/srs/phan-quyen-nhan-vien-flows.md
  - docs/phan-quyen-nhan-vien/srs/phan-quyen-nhan-vien-states.md
  - docs/phan-quyen-nhan-vien/srs/phan-quyen-nhan-vien-erd.md
  - docs/hrm/architecture/adr/ADR-007-pham-vi-quyen-xem-du-lieu-luong.md
---

# CONTEXT_SUMMARY — Phân quyền nhân viên (mời qua email + đúng công ty được cấp)

> **Status: Draft — chờ anh @phamvinh203 duyệt.** Đây là tài liệu phân tích vòng 2 (đổi phạm vi), CHƯA đủ điều kiện cho Backend/Frontend Engineer code. **Cập nhật 2026-09-17 (lần 2):** anh @phamvinh203 đã trả lời OQ-1..4 (xem Mục 0.1) — spec/flows/states/erd đã cập nhật theo quyết định; vẫn còn OQ-5..9 mở (xem `srs/phan-quyen-nhan-vien-spec.md` Mục 11).

## 0. Đổi phạm vi ngày 2026-09-17 (anh @phamvinh203 chốt trực tiếp)

Anh @phamvinh203 đổi hẳn phạm vi feature so với vòng 1. Yêu cầu nguyên văn: xây "thêm nhân viên" trong Cài đặt của `hdđt_maxv`, mời qua email — email gửi thẳng tài khoản + mật khẩu ngẫu nhiên; nhân viên chỉ thấy công ty owner đã mời vào; **module giữ nguyên cho nhân viên như hiện tại (dùng chung theo gói owner)**.

**Quyết định:**
- **BỎ HẲN** toàn bộ nội dung "quyền module theo từng nhân viên" của vòng 1: `User.modules`, `modulesHieuLuc`, mã lỗi `MODULE_NOT_GRANTED`, mọi US/AC/BR/FR liên quan trong `srs/*` đã bị xoá và viết lại từ đầu (ID đánh số lại từ 001).
- `docs/phan-quyen-nhan-vien/architecture/` (ADR-001, `api-contract.md`, `data-model.md`) là sản phẩm của Architect cho phạm vi VÒNG 1 — **KHÔNG còn khớp phạm vi mới**, BA không sửa (không phải việc của BA). Architect cần đọc lại phần khảo sát code thật vẫn dùng được (route/service company/invite/mailer chưa đổi) và viết lại `api-contract.md`/`data-model.md`/ADR mới cho phạm vi này; có thể "rút lại"/gạch bỏ ADR-001 hoặc thay bằng ADR mới.
- `docs/phan-quyen-nhan-vien/qa/` là bản dở dang của QA cho vòng 1, đã dừng — bỏ qua, không sửa. Tester-QA viết lại `test-matrix.md`/`test-cases.md` mới khi vào Phase A.

## 0.1. Quyết định đã chốt 2026-09-17 (lần 2) — anh @phamvinh203 trả lời OQ-1..4

| OQ | Câu hỏi | Quyết định |
|---|---|---|
| OQ-1 🔴 | Đảo ngược quyết định bảo mật "không gửi mật khẩu qua email" (2026-09-10)? | **Đồng ý, xác nhận tường minh.** Phương án A: gửi mật khẩu ngẫu nhiên THẬT ≥ 12 ký tự đủ hoa/thường/số qua email, bắt đổi mật khẩu ở lần đăng nhập đầu, không log, không trả qua API. |
| OQ-2 🔴 | Giữ hay bỏ bước ADMIN duyệt lời mời? | **Giữ nguyên** — duyệt xong mới tạo tài khoản và gửi email, không đổi luồng `InviteRequest`. |
| OQ-3 | Dialog mời 1 hay nhiều công ty? | **Chọn nhiều công ty** của owner; công ty đang chọn ở header tick sẵn mặc định. Owner 1 công ty vẫn gọn (chỉ 1 dòng, đã tick). |
| OQ-4 | Có xây UI sửa quyền công ty đã duyệt trong đợt này không? | **Làm cả hai**: (1) mời + xem danh sách, và (2) panel Sửa quyền (cấp thêm/thu hồi công ty) dùng `PUT /companies/employees/:userId/access` sẵn có, kèm ô bật/tắt xem lương theo từng công ty (⚠️ đánh dấu giả định BR-014, chờ anh duyệt cuối). |

Chi tiết đầy đủ (BR/FR/AC/Error/Edge Case tương ứng) đã cập nhật trong `srs/phan-quyen-nhan-vien-spec.md` Mục 4-11, `srs/phan-quyen-nhan-vien-flows.md`, `srs/phan-quyen-nhan-vien-states.md`, `srs/phan-quyen-nhan-vien-erd.md`. Còn OQ-5..9 mở, xem `srs/phan-quyen-nhan-vien-spec.md` Mục 11 phần "Còn mở" — riêng OQ-7 đã đổi đề xuất mặc định (xem ghi chú tại đó): nay đề xuất **siết `GET /companies/employees` chỉ OWNER gọi được**, vì màn "Cài đặt → Nhân viên" giờ là màn quản trị thật (có thao tác sửa quyền công ty + xem lương), dữ liệu trả về nhạy cảm hơn hẳn so với chỉ đọc roster đồng nghiệp như vòng trước.

## 1. Phạm vi mới

1. Màn **"Cài đặt → Nhân viên"** trong `hdđt_maxv` (hiện chỉ có ở `fe_maxv`): owner mời nhân viên qua email (chọn nhiều công ty), xem danh sách nhân viên + lời mời đang chờ.
2. **Gửi mật khẩu ngẫu nhiên qua email** khi nhân viên được duyệt (ADMIN vẫn duyệt như hiện tại) — thay cho cơ chế "mật khẩu không ai biết + tự đặt qua Quên mật khẩu" đang có. Bắt đổi mật khẩu ở lần đăng nhập đầu.
3. **Nhân viên chỉ thấy/thao tác được công ty đã được cấp** — đã được BE thực thi đúng ở hiện trạng (Mục 3), chỉ cần verify + đưa lên UI mới, không cần sửa logic chặn.
4. **Module KHÔNG đổi**: nhân viên tiếp tục dùng chung toàn bộ module theo gói thuê bao của owner, không có cơ chế giới hạn riêng (`moduleCuaUser()` giữ nguyên 100%).
5. **Panel "Sửa quyền" cho nhân viên đã duyệt** (mới chốt 2026-09-17, OQ-4): cấp thêm/thu hồi công ty + bật/tắt quyền xem lương theo từng công ty, dùng `PUT /companies/employees/:userId/access` đã có sẵn.

Ngoài phạm vi (giữ nguyên, không đổi): luồng ADMIN duyệt/từ chối lời mời (giữ nguyên bước duyệt — đã chốt OQ-2); cơ chế trần nhân viên/MST theo gói; luồng "Quên mật khẩu" (OTP) và luồng ADMIN đặt lại mật khẩu (`adminResetPassword`) — cả hai giữ nguyên 100%, chỉ luồng **duyệt lời mời tạo tài khoản mới** đổi cách sinh/gửi mật khẩu; rule quyền xem lương ADR-007 (chỉ thêm UI thao tác, không đổi rule); xoá hẳn nhân viên khỏi tài khoản, owner tự huỷ lời mời PENDING.

## 2. Phát hiện quan trọng nhất: mâu thuẫn với 1 quyết định bảo mật vừa chốt cách đây 1 tuần

Code hiện tại (`be_maxv/src/utils/password.ts:10-17`, `helpers/mailTemplates.ts:70-73`, `services/shared/mailer.service.ts:11-13`) có comment ghi rõ **quyết định bảo mật ngày 2026-09-10 ("vbsec")**: *"Thay cho việc sinh mật khẩu rồi gửi dạng rõ qua email / hiện cho admin"* — hệ thống cố tình đổi sang tạo mật khẩu ngẫu nhiên **không ai biết** (kể cả hệ thống), bắt nhân viên mới duyệt tự đặt mật khẩu qua "Quên mật khẩu" (OTP). Template `inviteApprovedEmail` viết thẳng: *"MaxV không bao giờ gửi mật khẩu qua email."*

Yêu cầu mới của anh @phamvinh203 ("gửi thông tin tk, mk ngẫu nhiên tới cho nhân viên") **đảo ngược đúng quyết định này**. Đây là mâu thuẫn nghiệp vụ/bảo mật nghiêm trọng — BA đã đưa thành **OQ-1 🔴** trong spec kèm 3 phương án + khuyến nghị. **✅ Đã chốt 2026-09-17: anh xác nhận tường minh đồng ý đảo ngược**, áp dụng Phương án A (xem Mục 0.1).

## 3. Hiện trạng đã kiểm chứng (đọc code thật, `file:line`)

### 3.1. Luồng mời + duyệt hiện tại

| Bước | Route/Service | Hiện trạng |
|---|---|---|
| Owner mời | `POST /companies/invite` → `inviteUserToCompany()` | `company.service.ts:244-329`. Validate MST thuộc owner, chặn email đã có `User` (`EMAIL_ALREADY_MEMBER`) hoặc đã có lời mời PENDING cùng email, kiểm trần nhân viên+lời mời đang chờ, tạo `InviteRequest` PENDING, **gửi mail báo TẤT CẢ ADMIN** (`notifyAdminsOfNewInvite`) — mail lỗi thì huỷ luôn lời mời vừa tạo. |
| ADMIN duyệt | `POST /admin/companies/invites/:id/approve` → `adminApproveInvite()` | `adminInvite.service.ts:55-145`. Băm mật khẩu bằng `bamMatKhauKhongAiBiet()` (random 32 byte, **không ai biết bản rõ**), tạo `User` + `DonViAccess` cho từng MST được mời trong 1 giao dịch, rồi gửi `inviteApprovedEmail` — **KHÔNG chứa mật khẩu**, chỉ hướng dẫn dùng "Quên mật khẩu". **Gửi mail lỗi → rollback**: xoá `User` vừa tạo (cascade `DonViAccess`), đưa lời mời về lại PENDING (`adminInvite.service.ts:115-130`) — cơ chế này đã tốt, giữ nguyên. |
| Quên mật khẩu | `requestPasswordReset()` / `resetPasswordWithOtp()` | `auth.service.ts:154-211, 220-...`. OTP 1 lần, hết hạn theo `OTP_TTL_MINUTES`, rate limit theo email. Đây là cơ chế nhân viên hiện đang dùng để "kích hoạt" mật khẩu lần đầu — **không đổi trong feature này** (FR-007). |
| Chưa có | — | **Chưa có cờ "bắt buộc đổi mật khẩu ở lần đăng nhập đầu"** trong schema `User` — cần Architect thiết kế mới nếu chọn Phương án A/B (OQ-1). |

### 3.2. Hạ tầng email — ĐÃ CÓ, hoạt động

`services/shared/mailer.service.ts` dùng `nodemailer` + SMTP (`env.smtpHost/Port/User/Password`), `requireTLS` bắt buộc khi không phải cổng 465. `helpers/mailTemplates.ts` có sẵn 5 template (`welcomeEmail`, `inviteApprovedEmail`, `adminResetPasswordEmail`, `resetPasswordOtpEmail`, `newInviteNoticeEmail`) — thuần dữ liệu, tách khỏi service gửi. **Không cần dựng hạ tầng mới**, chỉ cần 1 template mới (chứa mật khẩu) thay `inviteApprovedEmail` cho đúng luồng duyệt lời mời.

### 3.3. BE có CHẶN THẬT công ty không được cấp — không chỉ ẩn UI

Đã verify bằng cách đọc `helpers/access.ts` + `helpers/resolveTenantDb.ts` + nhiều controller (`hddt/gdt.controller.ts:36-43`, `dich_vu_cong/gdt-dvc.controller.ts:72-91,156-163`):

- **Nguồn quyền DUY NHẤT**: `accessibleDonViWhere(userId, role)` (`helpers/access.ts:22-29`) — OWNER: `ownerId = self`; OWNER_EMPLOYEE: `access.some({ userId })` (qua `DonViAccess`). ADMIN → `null` (không có phạm vi tenant).
- **`GET /companies`** (`listAccessibleCompaniesDetailed`, `companyAccess.service.ts:47-49`) lọc đúng theo scope này — nhân viên **chỉ thấy đúng công ty được cấp**, không phải giấu ở FE, mà BE trả về đúng tập con.
- **`POST /companies/:id/switch`** (`company.controller.ts:74-83`) gọi `canAccessDonVi()` trước khi cấp lại token nhúng `donViId` mới — đổi sang công ty không được cấp bị 403 `COMPANY.NO_ACCESS` ngay tại API.
- **Mọi route đọc/ghi dữ liệu tenant** (HDDT, DVC, Tờ khai, HRM, Kế toán) đều đi qua `resolveTenantDb()`/`resolveTenantInfo()`/`resolveTenantCtx()` (`helpers/resolveTenantDb.ts:19-101`) — hàm này tự query `sysPrisma.donVi.findFirst({ ...accessibleDonViWhere(...), id: donViId })` **mỗi request**, không cache, không đọc thẳng từ JWT. Không có công ty hợp lệ → 403 `COMPANY.NO_ACCESS` trước khi chạm dữ liệu tenant. Đã đọc chéo các controller đứng ngoài `resolveTenantDb` (đọc `req.user.donViId` trực tiếp, vd `hddt/gdt.controller.ts`, `dich_vu_cong/gdt-dvc.controller.ts`) — tất cả đều tự áp `accessibleDonViWhere` trước khi dùng, không có đường tắt bỏ qua kiểm tra.

**Kết luận:** yêu cầu #2 của anh ("nhân viên chỉ được hiển thị công ty được cấp") **đã đúng ở BE từ trước**, không cần sửa logic backend. Việc cần làm chỉ là dựng UI mời + xem danh sách trong `hdđt_maxv` (Mục 3.4) — công ty hiển thị tự động đúng vì `GET /companies` đã lọc sẵn.

### 3.4. UI hiện có

| App | Hiện trạng |
|---|---|
| `fe_maxv` | `EmployeesTable.tsx` (đọc-only: Nhân viên/Chức vụ/Vai trò/Trạng thái) + `InviteEmployeeDialog.tsx` (mời, gán cứng `donViIds: [current.id]` = công ty đang chọn ở header). Không có UI sửa/thu hồi quyền. |
| `hdđt_maxv` | Cài đặt (`SettingsPage.tsx:19-26`) hiện có 4 tab, chưa có tab "Nhân viên". `CompanyManagementTab.tsx` cho thấy pattern chuẩn của app này: `isOwner = user?.role === "OWNER"` gate nút thao tác, dùng `useCompaniesQuery()` (gọi `GET /companies`) hiển thị danh sách công ty — **nhân viên mở tab này hôm nay đã chỉ thấy đúng công ty được cấp** (do BE lọc, Mục 3.3), không cần sửa gì ở đây. |
| `maxv/` | `OwnerDetail.tsx` chỉ hiển thị đếm `donViAccess.length`, không liên quan phạm vi mới (module không đổi). |

## 4. Đối chiếu mô tả của anh @phamvinh203 với code thật

| Mô tả của anh | Kết quả kiểm chứng |
|---|---|
| "Thêm nhân viên tại setting = cách mời nhân viên tham gia" | Đúng hướng — cần dựng UI mới trong `hdđt_maxv` (Mục 3.4), backend mời/duyệt đã có sẵn, không đổi core. |
| "Gửi email sẽ gửi thông tin tk, mk ngẫu nhiên" | **Ngược lại hoàn toàn với hành vi hiện tại** (Mục 2) — hiện KHÔNG gửi mật khẩu, bắt tự đặt qua OTP. **✅ Đã chốt (OQ-1)**: đổi cách sinh/gửi mật khẩu ở bước duyệt theo đúng yêu cầu. |
| "Nhân viên được phân cho thì chỉ được hiển thị với cty mà owner mời nhân viên tham gia" | **Đã đúng ở BE từ trước** (Mục 3.3) — không cần sửa logic, chỉ cần UI mới hiển thị đúng dữ liệu `GET /companies` đã lọc sẵn. |
| "Module vẫn giữ nguyên cho nhân viên" | Đúng — `moduleCuaUser()` không đổi, bỏ hẳn nội dung vòng 1. |

## 4.1. Bổ sung theo trả lời OQ-3/OQ-4 (mở rộng nhẹ so với mô tả gốc)

Mô tả gốc của anh không nói rõ dialog mời chọn 1 hay nhiều công ty, cũng không nói có sửa quyền sau duyệt hay không — BA hỏi làm rõ (OQ-3, OQ-4) và anh chốt: cho chọn nhiều công ty khi mời (Mục 0.1), và làm luôn UI sửa quyền công ty + xem lương cho nhân viên đã duyệt trong đợt này (US-04 trong spec). Đây là mở rộng phạm vi nhỏ so với mô tả ban đầu, không phải suy diễn của BA.

## 5. Tiến độ

| Ngày | Người | Việc |
|---|---|---|
| 2026-09-17 | @phamvinh203 (qua business-analyst) | Vòng 1: khảo sát quyền module theo nhân viên, viết `srs/*` + bàn giao Architect/QA. |
| 2026-09-17 | @phamvinh203 (qua architect) | Vòng 1: viết `architecture/api-contract.md`, `data-model.md`, ADR-001 cho phạm vi module theo nhân viên. |
| 2026-09-17 | @phamvinh203 (qua tester-qa, Phase A) | Vòng 1: `qa/test-matrix.md`, `qa/test-cases.md` cho phạm vi module theo nhân viên — dừng dở dang. |
| 2026-09-17 | @phamvinh203 (đổi yêu cầu trực tiếp) | **Đổi phạm vi**: bỏ quyền module theo nhân viên, chuyển sang mời qua email + gửi mật khẩu + xác nhận đúng công ty được cấp. |
| 2026-09-17 | @phamvinh203 (qua business-analyst, vòng 2) | Khảo sát lại code thật (invite/approve/mailer/password/access control), viết lại `srs/phan-quyen-nhan-vien-{spec,flows,states,erd}.md` theo phạm vi mới, đánh số lại ID từ đầu. Phát hiện mâu thuẫn với quyết định bảo mật 2026-09-10 (Mục 2) — đưa thành OQ-1 🔴. `architecture/` và `qa/` của vòng 1 KHÔNG còn khớp phạm vi, chưa được viết lại. |
| 2026-09-17 | @phamvinh203 (qua business-analyst, vòng 2 lần 2) | Anh trả lời OQ-1..4 (Mục 0.1). Cập nhật `srs/phan-quyen-nhan-vien-spec.md` (Mục 3/4/5/6/8/9/10/11: BR-012..014, FR-009..011, E-008..010, US-04/AC-04.1..6, EC-04a..d, cân nhắc lại OQ-7), `flows.md` (dialog multi-select + flow mới "Sửa quyền công ty + xem lương"), `states.md` (thêm state "Quyền của 1 nhân viên đối với 1 công ty"), `erd.md` (làm rõ `DonViAccess.xemLuong` được thao tác qua panel mới, BR-014 giả định). Còn OQ-5..9 mở. |
| 2026-09-17 | @phamvinh203 (qua tester-qa, Phase A vòng 2) | Ghi đè hoàn toàn `qa/test-matrix.md` + `qa/test-cases.md` theo phạm vi mới (bỏ hết TC về `User.modules`/`MODULE_NOT_GRANTED` của vòng 1). Soát đặc tả ra 10 `SPEC-QA-NNN` (4 High: SPEC-QA-001 architecture chưa cập nhật theo phạm vi mới; SPEC-QA-002 thiếu whitelist API khi `PhaiDoiMatKhau`; SPEC-QA-003 chưa rõ luồng OTP có gỡ cờ `PhaiDoiMatKhau` không; SPEC-QA-004 chưa rõ nguồn dữ liệu danh sách công ty cho dialog/panel, lệch với việc BE không lọc `status` khi validate MST thuộc owner; SPEC-QA-008 OQ-7 chưa chốt nhưng route thật đang mở cho nhân viên). Phát hiện thêm 1 bug tiềm ẩn ở validator (`donViIds` trùng lặp gây 403 sai bản chất, SPEC-QA-005) và 1 lỗ hổng đồng thời có thật trong code hiện tại (`setEmployeeAccess()` thiếu khoá advisory, SPEC-QA-010). Viết 60 test case (TC-001..060) phủ đủ mật khẩu/mời/sửa quyền/cách ly tenant/tương thích ngược/UI/security; đánh dấu rõ TC phụ thuộc SPEC-QA-002/003/007/010 và OQ-7/OQ-8 là "chưa Ready". Không sửa `qa/` gì khác, chưa động vào `architecture/` hay `srs/`. |
| 2026-09-17 | @phamvinh203 (qua architect, vòng 2) | ADR-001 → Rejected. Viết mới ADR-002 (gửi mật khẩu tạm + bắt đổi lần đầu), viết lại `architecture/api-contract.md` + `data-model.md` theo phạm vi vòng 2: cột `users.phaiDoiMatKhau`, claim JWT + chặn trong `authenticate` (403 `PASSWORD_CHANGE_REQUIRED`), `POST /auth/change-password` mới, khoá `khoaHanMuc` cho `PUT .../access`, siết `GET /companies/employees` theo giả định OQ-7; 13 mâu thuẫn/điểm cần chốt ở api-contract Mục 9. Vẫn Draft. |
| 2026-09-17 | @phamvinh203 (qua business-analyst, đối soát vòng 3) | Xử lý toàn bộ 13 mục Mục 9 `api-contract.md` (MT-01..13) và 10 `SPEC-QA-001..010` của QA. Sửa `srs/phan-quyen-nhan-vien-spec.md`: amend BR-011 (ngoại lệ OTP gỡ cờ), FR-004 (whitelist tường minh `GET /auth/me` + `POST /auth/change-password`), FR-010 (làm rõ ngưỡng `access.length===0`); thêm BR-015, FR-012, E-011/E-012/E-013, AC-02.6/02.7/03.4, EC-13/14/15; amend AC-02.4 (caveat MT-11), EC-06 (FE đồng bộ ngay ở 403 đầu tiên, MT-06), EC-10 (ghi nhận SPEC-QA-010: lỗ hổng có sẵn, không phải do feature); mở rộng + nâng OQ-7 lên 🔴 (thêm `GET /companies/invites`, SPEC-QA-008); thêm OQ-10 🔴 (mật khẩu tạm hết hạn?) và OQ-11 (nhân viên mới kẹt ở `fe_maxv`). Không đánh số lại ID cũ. Sửa `flows.md` (thứ tự băm-trước-giao dịch đúng MT-09, thêm nhánh lỗi đổi mật khẩu E-011/E-012, thêm sequence FE tự đồng bộ công ty ở 403 đầu tiên) và `states.md` (thêm transition OTP gỡ cờ `PhaiDoiMatKhau`, BR-011 ngoại lệ). `erd.md` không cần đổi (không phát sinh entity/thuộc tính mới ngoài đã có). Vẫn Draft — chờ anh duyệt. |
| 2026-09-17 | @phamvinh203 (qua tester-qa, đối chiếu contract) | Đọc lại 4 file `architecture/` (đã viết lại: ADR-001 Rejected, ADR-002 mới, `api-contract.md`+`data-model.md` phạm vi vòng 2) và khớp lại toàn bộ `qa/test-matrix.md`+`qa/test-cases.md`. SPEC-QA-001 hết hiệu lực (đã giải quyết); SPEC-QA-002/003/004/005/009/010 đánh dấu "Đã giải quyết" (kỹ thuật khớp contract, một số còn cần BA đồng bộ câu chữ spec — MT-01/02/03/07); SPEC-QA-006 còn mở (Low/Medium); SPEC-QA-007 còn mở dạng business sign-off (kỹ thuật đã Ready); SPEC-QA-008/OQ-7 còn mở, ghi nhận thêm MT-08 (`GET /companies/invites` cũng cần siết nếu OQ-7 chốt). Điền endpoint/HTTP status/`code` cụ thể cho toàn bộ TC-001..060 theo contract. Thêm TC-061..074 (14 TC mới, KHÔNG đánh số lại): đổi mật khẩu sai/trùng mật khẩu cũ, vô hiệu phiên cũ, OTP gỡ cờ ở mức DB, refresh/switch giữa phiên giữ đúng cờ theo DB, rollback-duyệt lại sinh mật khẩu mới, phân biệt `code COMPANY_NO_ACCESS` (chỉ route tenant, không ở invite/switch/access), khoá song song hết deadlock, `access`/`donViIds` trùng công ty trả 400, 2 ADMIN duyệt song song, vé cũ không claim vẫn an toàn, 2 TC UI đồng bộ theo contract (F-1/F-2/F-4), `GET /companies/invites` theo MT-08. Tổng 74 TC. **Lưu ý bàn giao**: dòng tiến độ ngay phía trên (BA vòng 3) cho thấy `spec.md` đã có thêm `BR-015`, `E-011/E-012/E-013` chính thức — 3 mã lỗi mới QA đang ghi tạm là "(mới, chưa có ID chính thức)" (Mục 5b `test-matrix.md`: `AUTH.CURRENT_PASSWORD_WRONG`, `VALIDATION.PASSWORD_SAME`, `VALIDATION.DON_VI_TRUNG`) nhiều khả năng trùng đúng `E-011/E-012/E-013` này — **cần 1 vòng đối chiếu nhanh tiếp theo** để remap ID chính xác, chưa làm trong lượt này vì ngoài phạm vi yêu cầu (chỉ đối chiếu 4 file `architecture/`). |

## 6. Bước tiếp theo

1. Anh @phamvinh203 đọc mục "7. Gói duyệt cho anh chủ dự án" dưới đây, xác nhận các giả định (BR-014) và trả lời nốt các câu hỏi mở còn lại (OQ-5, OQ-6, OQ-7 🔴, OQ-8, OQ-10 🔴, OQ-11) trong `srs/phan-quyen-nhan-vien-spec.md` Mục 11.
2. Architect cập nhật `architecture/api-contract.md`/`data-model.md`/ADR-002 theo các điểm BA vừa chốt ở Mục 9 (đặc biệt: whitelist `auth/me`, ngoại lệ OTP gỡ cờ, mã lỗi E-011/E-012/E-013, BR-015 bỏ qua công ty đã xoá khi duyệt) — hầu hết đã khớp sẵn với đề xuất Architect đưa ra, chỉ cần xác nhận lại không còn lệch.
3. Tester-QA đối chiếu lại `qa/test-matrix.md`/`qa/test-cases.md` với `spec.md` bản mới nhất (nhiều SPEC-QA đã được trả lời — SPEC-QA-002/003/004/005/007/009/010 xem xử lý trong spec; SPEC-QA-001 đã hết hiệu lực vì `architecture/` đã viết lại; SPEC-QA-008/OQ-7 vẫn chờ anh chốt).
4. BA chốt `Status: Ready for Implementation` — **CHƯA làm ở bước này**, chờ anh duyệt.

## 7. Gói duyệt cho anh chủ dự án

> Mục này tóm tắt toàn bộ để anh duyệt nhanh mà không cần đọc hết `spec.md`/`api-contract.md`. Status hiện tại: **Draft — chờ anh chủ dự án duyệt.**

**Phạm vi đã chốt:** Cài đặt → Nhân viên trong `hdđt_maxv` (mời qua email, chọn nhiều công ty, xem danh sách + lời mời); ADMIN vẫn duyệt trước khi tạo tài khoản; duyệt xong gửi mật khẩu tạm ngẫu nhiên thật qua email (≥12 ký tự, đủ hoa/thường/số), bắt đổi mật khẩu ở lần đăng nhập đầu; panel Sửa quyền cho nhân viên đã duyệt (cấp thêm/thu hồi công ty + bật/tắt xem lương theo từng công ty); module vẫn dùng chung theo gói owner, không đổi gì.

**Quyết định đã chốt:** xem bảng Mục 0.1 (OQ-1..4). Cộng thêm sau đối soát Architect/QA: sinh mật khẩu tạm 16 ký tự bằng `node:crypto randomInt` (không dùng `Math.random`); đổi mật khẩu bắt buộc phải kiểm đúng mật khẩu hiện tại và không cho trùng mật khẩu cũ; dùng "Quên mật khẩu" (OTP) cũng gỡ được cờ bắt đổi mật khẩu (không bắt đổi 2 lần); FE tự đồng bộ lại công ty ngay khi bị thu hồi quyền (không đợi F5); duyệt lời mời bỏ qua công ty đã bị xoá thay vì báo lỗi khó hiểu.

**Giả định cần anh xác nhận (chưa phải quyết định cuối):**
- **BR-014** (panel Sửa quyền): quyền "xem lương" chỉ bật được cho công ty đã được cấp quyền truy cập, theo từng cặp (nhân viên, công ty) — khớp đúng cơ chế `xemLuong` đã có (ADR-007), chỉ thêm chỗ bấm.
- **OQ-7 🔴 (đã nâng mức ưu tiên):** đề xuất siết cả `GET /companies/employees` **và** `GET /companies/invites` chỉ OWNER gọi được — QA đánh dấu đây là điều kiện an toàn dữ liệu bắt buộc phải chốt trước khi code panel Sửa quyền, không phải tuỳ chọn UX.

**Câu hỏi mở còn lại + đề xuất mặc định** (chi tiết ở `spec.md` Mục 11 "Còn mở"): OQ-5 tách wording lỗi khi mời lại nhân viên của chính mình (mặc định: có) · OQ-6 nút "Gửi lại mật khẩu" cho owner (mặc định: không) · OQ-7 🔴 siết 2 endpoint (mặc định: có, siết) · OQ-8 empty-state khi chưa được cấp công ty (mặc định: có) · OQ-10 🔴 mật khẩu tạm có hết hạn không (mặc định: có, 7 ngày) · OQ-11 nhân viên mới kẹt ở `fe_maxv` vì app đó chưa có màn đổi mật khẩu (mặc định: chấp nhận, ghi chú trong email).

**Rủi ro chính:**
1. **Đảo ngược quyết định bảo mật "không gửi mật khẩu qua email"** (chốt 2026-09-10, nay đảo lại theo yêu cầu tường minh của anh) — đã có mitigation (mật khẩu mạnh, bắt đổi ngay, không log/không trả API, kênh SMTP TLS) nhưng bản chất vẫn là secret nằm trong hộp thư một thời gian.
2. **Thứ tự deploy phải đúng: migrate DB → `hdđt_maxv` → `be_maxv`.** Lý do: `be_maxv` là nơi THỰC SỰ bật chặn `PASSWORD_CHANGE_REQUIRED`; nếu deploy `be_maxv` trước khi `hdđt_maxv` có route `/doi-mat-khau`, nhân viên mới được duyệt trong khoảng thời gian đó sẽ đăng nhập được nhưng không có màn nào để đổi mật khẩu bắt buộc — kẹt hoàn toàn. Deploy `hdđt_maxv` trước là vô hại (chưa có nhân viên nào mang cờ `phaiDoiMatKhau=true`).
3. **`fe_maxv` (app cũ) không có màn đổi mật khẩu bắt buộc** — nhân viên mới nếu lỡ đăng nhập ở đó trước sẽ kẹt hoàn toàn ở mọi thao tác (xem OQ-11); cần dặn rõ trong email mật khẩu tạm "đăng nhập lần đầu ở `hdđt_maxv`".
