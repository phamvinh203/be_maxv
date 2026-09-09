# Work Log — HRM

## [2026-09-09 10:51] backend-engineer — code mới
- Nhiệm vụ: Nối API thật cho Cài đặt lương (Danh mục khoản lương, Cấu trúc lương khung, Set lương nhân viên) vào FE `hdđt_maxv`, thay `mock/hooks/khoanLuong.ts` + `mock/hooks/setLuong.ts` (giữ nguyên file mock theo yêu cầu).
- Đã sửa:
  - `be_maxv/prisma/tenant/schema.prisma`:1189 (enum `CalculationMethod` thêm `REVENUE_PERCENTAGE`, `KPI_BASED`, `MANUAL_ENTRY` — khớp đủ 7 tiêu thức tính của FE thay vì chỉ 4)
  - `be_maxv/src/validators/hrm/cai_dat_luong/salaryStructures.validator.ts`:5 (`CALCULATION_METHODS` +3 giá trị)
  - `be_maxv/src/services/client/hrm/cai_dat_luong/salaryStructures.service.ts`:104 (kiểu `resolvedItems` suy từ hằng validator thay vì liệt kê literal union cứng, tránh lệch khi enum đổi)
  - `hdđt_maxv/src/features/hrm/api/salaryItemsApi.ts` (mới), `salaryItemsQueries.ts` (mới) — Danh mục khoản lương
  - `hdđt_maxv/src/features/hrm/api/salaryStructuresApi.ts` (mới), `salaryStructuresQueries.ts` (mới) — Cấu trúc lương khung
  - `hdđt_maxv/src/features/hrm/api/employeeSalariesApi.ts` (mới), `employeeSalariesQueries.ts` (mới) — Set lương nhân viên
  - `hdđt_maxv/src/features/hrm/api/hrmKeys.ts`:57 (thêm `hrmSalaryItemKeys`, `hrmSalaryStructureKeys`, `hrmEmployeeSalaryKeys`)
  - `hdđt_maxv/src/features/hrm/components/cai_dat_luong/CaiDatLuongPanel.tsx`:7, `TaoDanhMucPanel.tsx`:9, `KhoanLuongTable.tsx`:21, `KhoanLuongFormDialog.tsx`:18 (đổi import từ mock sang API thật)
  - `hdđt_maxv/src/features/hrm/components/cai_dat_luong/set_luong/SetLuongPanel.tsx`:14-15, `CauTrucLuongCard.tsx`:24, `DanhSachSetLuongCard.tsx`:31-35 (đổi import từ mock sang API thật)
  - `hdđt_maxv/src/features/hrm/components/cai_dat_luong/set_luong/SetLuongNhanVienDialog.tsx`:22-25 (đổi import từ mock sang API thật; đồng thời sửa `useNhanVienDetail` đang trỏ `mock/hooks/nhanVien` — không map được nhân viên thật nên dialog không mở được — sang bản thật `api/nhanVienQueries.ts`, phát hiện khi test tay)
- Liên kết: docs/hrm/cai_dat_luong/srs-cai-dat-luong.md · docs/hrm/cai_dat_luong/api-contract-cai-dat-luong.md (lưu ý: doc này lệch so với route/response thật ở vài chỗ — xem ghi chú trong code, chưa cập nhật lại doc)
- Kiểm chứng: `tsc --noEmit` be_maxv sạch · `tsc -b` hdđt_maxv sạch · `eslint` các file mới/sửa sạch · 23/23 test be_maxv (`hrmSalarySettings.test.ts` + `hrmSalarySettingsApi.test.ts`) pass · test tay trên browser thật (tài khoản vinhh@1trick.net, công ty CÔNG TY TNHH ĐẦU TƯ SẢN XUẤT VÀ XNK THÀNH CÔNG): tạo đủ 7 khoản lương (1 khoản/loại), sửa 1 khoản, xóa khoản đang dùng bị chặn đúng (E-sal-003), lưu + đọc lại cấu trúc lương đủ 7 tiêu thức tính (tổng 15.700.000đ khớp), set lương + duyệt lương nhân viên NV0001 (tổng 17.700.000đ khớp) — giữ lại làm dữ liệu demo theo yêu cầu.
- Commit: chưa commit

## [2026-09-09 11:37] backend-engineer — /simplify (dọn code, không sửa nghiệp vụ)
- Nhiệm vụ: Chạy `/simplify` (4 agent song song: reuse/simplification/efficiency/altitude) trên toàn bộ diff `be_maxv` của phiên làm việc trên, áp các fix an toàn (không đổi hành vi).
- Đã sửa:
  - `be_maxv/src/helpers/resolveTenantDb.ts`:22 — **bỏ backdoor test** `if ((req as any).mockDb) return ...` khỏi helper dùng chung cho hơn chục controller (phát hiện độc lập bởi 2/4 agent — mức nghiêm trọng nhất). Test chuyển sang `node:test` `mock.module()` (đã verify thực nghiệm: namespace-mutation KHÔNG hoạt động dưới ESM thật của tsx, phải patch qua loader hook trước khi route import).
  - `be_maxv/src/__tests__/hrmSalarySettingsApi.test.ts` — viết lại `buildTestApp()` dùng `before()` + `mock.module('../helpers/resolveTenantDb')` + `import()` động 3 route module (route/controller thật, chỉ mock đúng 1 hàm).
  - `be_maxv/package.json`:26 — thêm cờ `--experimental-test-module-mocks` vào script `test` (bắt buộc để `mock.module` hoạt động).
  - `salaryStructures.service.ts` — export `toIsoDate` dùng chung (xóa bản trùng ở `employeeSalaries.service.ts`); xóa biến chết `activeSet`; đổi vòng lặp `create` → `createMany` khi lưu dòng cấu trúc lương.
  - `employeeSalaries.service.ts` — `Promise.all` hóa 3 chỗ query độc lập chạy nối tiếp (`listEmployeeSalaries`, `getEmployeeSalary`, `setEmployeeSalary`); bỏ `findMany` thừa trong `approveEmployeeSalaries` (dùng thẳng `updateMany` + `result.count`); đổi vòng lặp `create` → `createMany`; bỏ nhánh xử lý `khoan` chết trong `setEmployeeSalary` (dead code từ khi `SetEmployeeSalaryInput` đổi sang `z.infer`); đơn giản Set→Array thừa trong `countEmployeeSalaries`; type `where: any` → `Prisma.EmployeeSalaryWhereInput`.
  - `salaryItems.service.ts` — gộp check trùng tên (create/update) vào `assertSalaryItemNameAvailable()`; `Promise.all` hóa 2 count() trong `deleteSalaryItem`.
  - `salaryItems.validator.ts` — hoist `description`/`defaultRate` thành field dùng chung create+update.
  - `employeeSalaries.validator.ts` — gộp schema `hasSalary`/`daSet` trùng lặp thành `optionalBooleanFlag`; dùng `??` thay ternary lồng; đổi `SetEmployeeSalaryInput` từ `z.input` sang `z.infer` (khớp với việc bỏ dead code ở service).
  - `hrmSalarySettings.test.ts` — cập nhật theo các thay đổi trên: mock `tx` thêm `createMany`, thêm `salaryStructure.findFirst` stub cho ca test BR-sal-008 (giờ tải song song), đổi 1 lời gọi trực tiếp `setEmployeeSalary` từ payload `{khoan}` thô sang `{items}`.
- Đã CHỦ Ý bỏ qua (ghi rõ lý do, không phải quên):
  - Gộp `generateNextSalaryItemCode` với `sinhMaCa()` (workShifts) thành 1 helper dùng chung — đụng file ngoài diff phiên này.
  - Đổi "current active contract" sang dùng `hopDongHienHanhTheoNv` có sẵn — khác tie-break logic, đổi hành vi biên, thuộc phạm vi /code-review chứ không phải /simplify.
  - Đổi validator ngày `effectiveFrom`/`effectiveTo` sang `ngayISO`/`ngayTuyChon` dùng chung — sẽ CHẶN các ngày lịch không tồn tại hiện đang lọt qua (đổi hành vi validation), để dành /code-review.
  - Áp dụng `helpers/crudGuards.ts` (`findOrThrow`/`assertNotExists`) — refactor cơ học nhưng diện rộng (~10 chỗ/3 file), để dành phiên riêng.
  - Tightening kiểu `any` của `formatEmployeeSalary`/`formatSalaryStructure` — rủi ro/công sức không tương xứng lợi ích thuần type-safety.
- Liên kết: session /simplify trên diff của mục "code mới" phía trên cùng file.
- Kiểm chứng: `tsc --noEmit` sạch · `eslint` 0 lỗi (74 warning, toàn bộ đã có từ trước — `any` trong test file theo quy ước sẵn có, không warning mới) · `npm test` 631/635 pass — 4 fail còn lại đều ở `hrmSettingsShiftsHolidaysApi.test.ts` (TC-hrm-301 tìm kiếm bỏ dấu, TC-hrm-316 thiếu trường "thứ trong tuần"), xác nhận qua `git status` là file/feature hoàn toàn không đụng tới trong cả 2 phiên (không phải regression).
- Commit: chưa commit

## [2026-09-09 11:55] backend-engineer — /simplify (hdđt_maxv, dọn code, không sửa nghiệp vụ)
- Nhiệm vụ: Chạy `/simplify` (4 agent song song) trên diff frontend (`hdđt_maxv`) của tính năng Cài đặt lương — 3 file API/Queries mới + `hrmKeys.ts` + 8 component đổi import.
- Đã sửa:
  - `hdđt_maxv/src/features/hrm/api/employeeSalariesQueries.ts` — **thêm debounce 300ms cho ô tìm kiếm** trong `useSetLuongRows` (phát hiện bởi agent Efficiency: mỗi ký tự gõ đang bắn 1 request riêng, so với bản mock cũ lọc client-side không tốn mạng — verify bằng browser thật: gõ liền "Vinh" 4 ký tự cách nhau ~50ms chỉ tạo ĐÚNG 1 request `?q=Vinh`, khớp cùng ngưỡng 300ms của `CompanyFormDialog`); đổi query key sang gọi qua `hrmEmployeeSalaryKeys.list(companyId, params)` thay vì spread thủ công tại nơi gọi; sửa `mutationFn` point-free; sửa lại comment giải thích `REJECTED → cho_duyet` cho chính xác hơn (không có endpoint nào ghi trạng thái này, không chỉ vì thiếu nút UI).
  - `hdđt_maxv/src/features/hrm/api/hrmKeys.ts` — mở rộng `hrmEmployeeSalaryKeys.list` nhận thêm `params` làm tham số thứ 2 (builder tự gói key), khớp quy ước `hrmHopDongKeys.list`/`hrmHolidayKeys.list` đã có (2/4 agent độc lập cùng phát hiện điểm này).
  - `hdđt_maxv/src/features/hrm/api/salaryItemsQueries.ts` — suy `CATEGORY_TO_LOAI` từ `LOAI_TO_CATEGORY` bằng `Object.fromEntries` đảo chiều thay vì viết tay 2 bảng dữ liệu giống hệt nhau; 2 `mutationFn` đổi sang dạng point-free (`mutationFn: createSalaryItem` thay vì bọc closure thừa).
  - `hdđt_maxv/src/features/hrm/api/salaryStructuresQueries.ts` — suy `CALC_METHOD_TO_TIEU_THUC` từ chiều ngược lại tương tự; thêm `useLamMoi()` cho khớp quy ước 4 file còn lại trong cùng tính năng (trước đó tự inline invalidate khác kiểu).
- Đã CHỦ Ý bỏ qua: đổi tên quy ước `MAP_X`/`MAP_X_NGUOC` (đã có ở `holidaysQueries.ts`/`cauHinhQueries.ts`, ngoài diff) sang `X_TO_Y` cho đồng nhất toàn bộ — chỉ là nit đặt tên, không sửa vì đụng file ngoài phạm vi phiên này.
- Liên kết: session /simplify tiếp theo cho phần backend cùng feature (mục ngay phía trên).
- Kiểm chứng: `tsc -b --force` sạch · `eslint` 0 lỗi 0 warning trên 4 file sửa · test tay trên browser thật: debounce xác nhận đúng 1 request/lần gõ dừng, dữ liệu cấu trúc lương + set lương hiển thị lại đúng y nguyên sau khi sửa (không mất dữ liệu, không đổi hành vi).
- Commit: chưa commit
