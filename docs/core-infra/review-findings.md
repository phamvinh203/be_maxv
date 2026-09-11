---
type: review-findings
feature: core-infra
updated: 2026-09-11
---

## Review 2026-09-11 — Nhóm 1/9 (audit toàn bộ `hdđt_maxv/src`): core/auth/infra — Verdict: ⚠️ Approve with comments

> Phạm vi: `lib/**`, `routes/**`, `config/**`, `theme/**`, `utils/**`, `components/*.tsx` (top-level), `features/auth/**`, `features/company/**`, `features/_shared/**`, `App.tsx`, `main.tsx`, `pages/{Auth,Register,ForgotPassword,Home}Page.tsx`, `pages/settings/**` (62 file). Đây là "feature" hạ tầng dùng chung, không có folder `docs/` sẵn trước audit này — tạo mới. Không có 🔴 Blocking; tầng auth/session làm đúng phần khó (token httpOnly, third-party isolation, không log credential).

### RVW-C01 🟡 NON-BLOCKING — Đổi công ty không dọn cache TanStack, chỉ trông cậy quy ước "mọi queryKey phải có companyId"
- Vị trí: `hdđt_maxv/src/features/auth/AuthContext.tsx`:105-108 (`switchCompany`)
- Vấn đề: quy ước "mọi query theo tenant gắn `currentCompanyId`" đã bị vi phạm ở `features/dich_vu_cong/api/dvc.ts`:123 (`QUERY_KEY_LICH_SU_DVC` không có companyId) — đổi công ty xong bảng lịch sử đồng bộ DVC vẫn hiện log công ty cũ tới khi refetch. Cùng lớp lỗi với RVW-N07 (accounting) và RVW-907 (dich-vu-cong).
- Đề xuất fix: `queryClient.clear()` trong `switchCompany` sau khi `switchCompanyApi(id)` resolve — giống `login`/`resetSession` đã làm.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — thêm `queryClient.clear()` vào `switchCompany` ngay sau khi `switchCompanyApi(id)` resolve, đúng vị trí đề xuất (`hdđt_maxv/src/features/auth/AuthContext.tsx`:115-122). `tsc -b --noEmit` + `eslint` sạch. *(frontend-engineer)*

### RVW-C02 🟡 NON-BLOCKING — Hết phiên bị động không dọn token GDT / khóa DVC; chỉ nút Đăng xuất mới dọn
- Vị trí: `AuthContext.tsx`:70-76 (`resetSession`) — đối chiếu `AppHeader.tsx`:247-255
- Vấn đề: `clearGdtSession()`/`clearDvcKeys()` chỉ gọi trong onClick "Đăng xuất". Hết phiên bị động (`setSessionExpiredHandler`) không dọn — máy dùng chung ở phòng kế toán để lại token GDT/khóa DVC của người trước.
- Đề xuất fix: chuyển 2 lời gọi dọn vào trong `resetSession` (cả logout chủ động lẫn hết-phiên bị động cùng đi qua).
- Trạng thái: OPEN
  → FIXED [2026-09-11] — chuyển `clearGdtSession()`/`clearDvcKeys()` vào `resetSession()` (`AuthContext.tsx`:74-86), bỏ 2 lời gọi tay ở `AppHeader.tsx` onClick "Đăng xuất" (`logout()` đã đi qua `resetSession`). Vì `resetSession` cần hook `useGdtSession()`, đổi thứ tự provider ở `main.tsx`: `GdtSessionProvider` nay bọc NGOÀI `AuthProvider` (trước đây ngược lại) — không ảnh hưởng hành vi vì `GdtSessionProvider` không phụ thuộc `AuthContext`. `tsc -b --noEmit` + `eslint` sạch. *(frontend-engineer)*

### RVW-C03 🟡 NON-BLOCKING — Không code-split route nào: bundle chính 2.68 MB một chunk
- Vị trí: `routes/AppRouter.tsx`:1-59 (55 import tĩnh, 0 `React.lazy` trong toàn `src`)
- Bằng chứng đo được: `hdđt_maxv/dist/assets/index-BLh5qane.js` = 2.680.871 bytes. `features/to_khai/xuatToKhaiExcel.ts`:1 import tĩnh `exceljs` (xem RVW-T02 ở `docs/to-khai-gtgt01/`) kéo theo cả exceljs vào bundle khởi động.
- Đề xuất fix: (1) sửa import tĩnh exceljs (RVW-T02, 1 dòng, thu hồi phần lớn dung lượng); (2) bọc route bằng `React.lazy` + `<Suspense fallback={<FullScreenLoader/>}>` quanh `<Routes>`.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — toàn bộ ~52 page cấp route trong `routes/AppRouter.tsx` (không chỉ HRM, gộp chung 1 lượt với NB-2 ở `docs/hrm/review-findings.md`) chuyển sang `React.lazy(() => import(...))`, bọc `<Suspense fallback={<FullScreenLoader/>}>` quanh `<Routes>`. RVW-T02 (import tĩnh `exceljs`) do agent khác sửa riêng, không đụng trong phiên này. Bằng chứng đo lại sau build: `dist/assets/index-*.js` từ 2.680.871 bytes còn **425,78 kB** (giảm ~84%); `exceljs.min-*.js` (929,90 kB) đã tách chunk riêng, chỉ tải khi thật sự xuất Excel. `npm run build` pass, `tsc -b --noEmit` + `eslint` sạch. *(frontend-engineer)*

### RVW-C04 🟡 NON-BLOCKING — Trang Cài đặt mount cả 4 tab, bắn query của tab người dùng không mở
- Vị trí: `pages/settings/SettingsPage.tsx`:74-86
- Vấn đề: 4 tab luôn mount (ẩn bằng `display:none`), bắn `GET /companies` + lịch sử đồng bộ + thống kê hệ thống ngay khi vào `/settings`, dù chỉ 1 tab đang xem. `staleTime:30_000` đã đủ tránh remount gọi lại — lý do trong comment không còn đúng.
- Đề xuất fix: render đúng tab đang chọn (`{tab==="company" && <CompanyManagementTab/>}`).
- Trạng thái: OPEN
  → FIXED [2026-09-11] — thay khối mount-cả-4-tab ẩn bằng `display:none` bằng render có điều kiện `{tab === "..." && <Tab/>}` đúng đề xuất (`pages/settings/SettingsPage.tsx`). `tsc -b --noEmit` + `eslint` sạch. *(frontend-engineer)*

### RVW-C05 🟡 NON-BLOCKING — Comment ở bước xin OTP mâu thuẫn với hành vi thật của server
- Vị trí: `features/auth/components/ForgotPasswordForm.tsx`:52
- Vấn đề: comment nói "server luôn trả 200 giống nhau" — sai, BE trả 404/401/409 tùy trường hợp (code xử lý đúng, chỉ comment sai). Người sửa sau dễ tưởng nhánh catch thừa rồi xóa đi.
- Đề xuất fix: sửa comment cho khớp thực tế, trỏ sang ghi chú BE.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — sửa comment tại `ForgotPasswordForm.tsx`:52-57, nêu rõ BE trả 404 (email chưa đăng ký)/401 (tài khoản khoá)/409 (quá nhiều lần xin OTP) tùy trường hợp, trỏ sang `requestPasswordReset` (`be_maxv/src/services/client/auth.service.ts`:154-171) để đối chiếu. `tsc -b --noEmit` + `eslint` sạch. *(frontend-engineer)*

### RVW-C06 🟡 NON-BLOCKING — `apiFetchData` loại nhầm payload `0`/`false`/`""`
- Vị trí: `lib/http.ts`:210 — `if (!body.data) throw new Error(...)`
- Vấn đề: endpoint trả `{success:true, data:0}` hoặc `data:false` sẽ bị ném lỗi dù thành công. Chưa endpoint nào trúng ca này, nhưng hàm dùng chung cho mọi API client.
- Đề xuất fix: `if (body.data === undefined || body.data === null) throw ...`.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — đổi đúng thành `if (body.data === undefined || body.data === null)` tại `lib/http.ts`:210-212. `tsc -b --noEmit` + `eslint` sạch. *(frontend-engineer)*

### RVW-C07 🟡 NON-BLOCKING — `/auth/me` có thể trả `activeDonViId` không khớp cookie, FE tin thẳng
- Vị trí: `AuthContext.tsx`:46 — nguồn `be_maxv/src/services/client/auth.service.ts`:386-389
- Vấn đề: khi `donViId` trong token không còn truy cập được, BE tính lại `activeDonViId` nhưng không cấp cookie access mới → header hiện công ty A trong khi mọi endpoint vẫn đọc `donViId` cũ từ token → 403 hàng loạt, người dùng kẹt không có chỉ dẫn.
- Đề xuất fix: gốc ở BE — cấp lại cookie khi rơi vào nhánh fallback (dùng lại helper của `/companies/:id/switch`). Vá tạm FE: gọi `switchCompany(data.activeDonViId)` sau `getMe()` nếu cần chắc.
- Trạng thái: OPEN
  → FIXED một phần [2026-09-11] — đã làm phần vá tạm FE (đánh giá rủi ro thấp: `switchCompany`/`reissueSession` chỉ ghi cookie mới + 1 UPDATE `expiresAt` cho phiên hiện có qua `giaHanPhien`, KHÔNG xoay `jti`/không rate-limit trên `/companies/:id/switch`). Trong bootstrap `getMe()` (`AuthContext.tsx`:46-60), sau khi set state, gọi `switchCompanyApi(data.activeDonViId)` chạy nền (không `await`, lỗi nuốt im lặng) để đồng bộ lại cookie access — không chặn `hydrating`. **Root cause vẫn ở BE** (`loadUserSession` không cấp lại cookie khi rơi vào nhánh fallback) — CHƯA ĐỤNG `be_maxv` theo đúng phạm vi phiên này; đây chỉ là lớp vá giảm thiểu, không phải fix triệt để. `tsc -b --noEmit` + `eslint` sạch. *(frontend-engineer)*

### 🟢 Suggestion (gộp gọn)
- `AppRouter.tsx`:193-196 khối `/* ... */` viết trần trong JSX children (thiếu `{}`) — text node vô hại hiện tại, bọc lại `{/* ... */}`.
- `theme/displaySettings.ts`:46-48 `saveDisplaySettings` không try/catch (khác `loadDisplaySettings`) — QuotaExceeded ở Safari private mode có thể làm app trắng màn.
- `theme/displaySettings.ts`:36-44 merge JSON từ localStorage không kiểm giá trị lạ.
- `lib/fileSystemAccess.ts`:52-61 `writeFile` không tự gọi `safeName` — nên gọi 1 lần trong hàm dùng chung thay vì rải rác ở caller.
- `lib/downloadFile.ts`:17 `revokeObjectURL` đồng bộ ngay sau `click()` — Firefox từng hủy lượt tải, bọc `setTimeout(...,0)`.
- `LoginForm.tsx` thiếu `autoComplete="username"` (RegisterForm/ForgotPasswordForm đã có).
- `ProtectedRoute.tsx`:17-19 không mang theo URL đang muốn vào, đăng nhập xong luôn về `/`.
- `dialogLoginHddt.tsx`:336-342 "Quên mật khẩu" tô màu primary + cursor pointer nhưng không có onClick.
- `CompanyManagementTab.tsx`:94-96 thẻ công ty là `<Box onClick>` không `role="button"`/`tabIndex` — không thao tác được bằng bàn phím.
- `.env` đang được git track, `.gitignore` chỉ chặn `*.local` — hiện rỗng nên chưa lộ gì nhưng là bẫy cho sau này (biến `VITE_*` nhúng thẳng vào bundle công khai).
- `index.html` `lang="en"` cho app hoàn toàn tiếng Việt.
- **Chuyển tiếp cho `docs/dich-vu-cong`:** `DialogLoginDVC.tsx`:234 `console.info` in nguyên response đăng nhập DVC — đã ghi nhận trùng ở RVW-D02.

---

**Security findings:** đã kiểm và đạt — token trong cookie httpOnly (`sameSite: strict` access / `lax` refresh), không token trong web storage; third-party (`api.xinvoice.vn`) gọi bằng `fetch` trần không cookie; mật khẩu GDT chỉ sống trong React state, không log/không lưu; `ModuleRoute` không bypass được (BE cưỡng chế thật ở scope cha); không path traversal ở File System Access API. Rủi ro còn lại: RVW-C01 (rò dữ liệu giữa công ty qua cache), RVW-C02 (khóa phiên cổng còn lại sau hết-phiên), thiếu CSP (đáng làm ở reverse proxy vì token GDT sống trong sessionStorage).

**Performance findings:** RVW-C03 (bundle 2.68MB) là hạng mục đáng giá nhất. `queryClient` config hợp lý, `runPool` giới hạn đồng thời gọn, không N+1, không memory leak (timer/effect đều có cleanup).

**Final recommendation:** ⚠️ Approve with comments — không blocking. Ưu tiên: RVW-C01 (1 dòng `queryClient.clear()`) → RVW-C02 → RVW-C03 (sửa import tĩnh trước, lazy route sau) → còn lại.
