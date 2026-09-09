# Review Findings — Phân hệ HRM (`be_maxv`)

> File lưu vết của Quality Gate (code-reviewer). Backend Engineer sửa xong cập nhật `Trạng thái: OPEN → FIXED` ngay dưới từng finding, KHÔNG xóa finding cũ.
> Severity: 🔴 Blocking (phải sửa trước khi merge) · 🟡 Non-blocking (nên sửa) · 🟢 Suggestion.

---

## Review 2026-09-09 — Verdict: ❌ Request changes

**Phạm vi review**: toàn bộ diff sub-feature `du_lieu_tinh_luong` — `prisma/tenant/schema.prisma` (+419 dòng), 4 route + 4 controller + 4 service + 3 validator mới, `constants/payrollErrors.ts`, `helpers/payrollErrors.ts`, `helpers/payrollPeriodLockGuard.ts`, diff `routes/hrm/hrm.route.ts` + `plugins/errorHandler.plugin.ts`, `__tests__/hrmPayrollInputData.test.ts`. Đây là lần code-review chính thức đầu tiên của cả phân hệ HRM.

**Góc nhìn của phiên này** (bổ sung, KHÔNG lặp lại 3 báo cáo độc lập đã có): chất lượng mã, bảo mật tầng route/controller, xử lý lỗi & tính nhất quán, kiểu dữ liệu tài chính, trùng lặp logic. Các phát hiện nghiệp vụ/thiết kế/độ phủ test đã có ở `srs-du-lieu-tinh-luong.md` (BA), `data-model-*.md` + `api-contract-*.md` (Architect, A-01..A-09), `qa-report-*.md` (QA, BUG-dltl-001..013) — xem bảng "Blocking kế thừa" ở cuối, KHÔNG đánh số lại.

**Kết quả kiểm chứng tự chạy**: `npx eslint` trên 13 file mới → **0 error / 16 warning** (toàn bộ là `no-explicit-any`, xem RVW-013). Không có `console.*`/`req.log` nào ghi dữ liệu lương hay CCCD ra log — mục "log dữ liệu nhạy cảm" **đạt**. Prisma parameterized query toàn bộ, không có raw SQL — mục injection **đạt**. Mọi endpoint đều thừa hưởng `authenticate` + `requireModule('hrm')` từ hook cha `hrm.route.ts:35-39` — mục "thiếu guard xác thực" **đạt** (riêng guard *quyền lương* và guard *role* thì thiếu — xem bảng kế thừa).

---

### RVW-001 🔴 BLOCKING — Mô hình chấm công "delta" bị hiện thực sai: chỉ cần chấm 1 ngày nghỉ là lương cơ bản sập về gần 0

- Vị trí: `be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollCalculation.service.ts`:152-158
- Vấn đề:

  ```ts
  if (empAtt.length > 0) {
    actualWorkDays = empAtt.reduce((sum, r) => sum + Number(r.workDayValue), 0);
  } else {
    actualWorkDays = standardWorkDays;
  }
  ```

  Engine coi tập `AttendanceRecord` của nhân viên là **lịch công đầy đủ của cả tháng**. Nhưng toàn bộ phần còn lại của hệ thống lại theo **mô hình delta — chỉ ghi ngày khác chuẩn**: đường ghi duy nhất là `PUT /payroll-data/attendance/cell` (1 ô/lượt, `payrollInputs.service.ts`:115 là **nơi duy nhất trong cả repo** ghi `AttendanceRecord` — đã grep xác nhận), `createPayrollPeriod` cố ý không sinh lịch (ADR-dltl-02), SRS `US-dltl-03` ghi rõ "chỉ ghi ngày khác chuẩn", `getAttendanceMatrix` trả `records` rỗng nếu chưa sửa gì.

  Hệ quả số học với nhân viên lương 15.000.000đ, kế toán đánh dấu **đúng 1 ngày** nghỉ không lương:
  | Trạng thái | Số bản ghi | `actualWorkDays` | `proratedWorkSalary` |
  |---|---|---|---|
  | Chưa chấm gì | 0 | 26 | 15.000.000 |
  | Chấm 1 ngày `khong_luong` (0h) | 1 | **0,00** | **0** ← đúng phải là 14.423.077 (25/26) |
  | Chấm 1 ngày `nghi_phep` (8h) | 1 | **1,00** | **576.923** ← đúng phải là 15.000.000 |

  Đây là **thao tác thường gặp nhất** của tính năng, và sai theo hướng trả thiếu tới ~96% lương. Nghiêm trọng hơn: `lockPayrollPeriod` đóng băng đúng con số sai này vào `PayrollSheetLine` (`payrollPeriods.service.ts`:163-176) — sau khi khóa sổ thì bản ghi sai trở thành chứng từ.

  Ba báo cáo trước đều **không phát hiện**: cả ba chỉ soi 2 ca (0 bản ghi → 26 ngày ✅, và `actualHours=24` → trả thừa), Architect còn đánh giá mô hình delta là "lựa chọn đúng" (`data-model-*.md`:164) mà không đối chiếu nhánh `if` này. Ca "có vài bản ghi delta" — ca thực tế nhất — chưa ai chạm tới.
- Đề xuất fix: đổi sang cộng dồn **chênh lệch** thay vì thay thế, ví dụ:

  ```ts
  const standard = resolveStandardWorkDays(period, setting, holidays); // gộp cùng ADR-dltl-04
  const delta = empAtt.reduce((sum, r) => sum + (Number(r.workDayValue) - 1), 0);
  actualWorkDays = Math.max(0, Math.min(standard + delta, standard));
  ```

  (mỗi bản ghi delta thay thế đúng 1 ngày chuẩn của chính nó). Nếu BA muốn giữ ngữ nghĩa "bản ghi = lịch đầy đủ" thì phải bổ sung endpoint sinh/ghi cả tháng và sửa SRS + ADR-dltl-02 — nhưng KHÔNG được để hai ngữ nghĩa cùng tồn tại như hiện nay. Bắt buộc kèm 1 test: 1 bản ghi delta → `actualWorkDays === standard - 1`.
- Trạng thái: OPEN
  → FIXED [2026-09-09] — đổi công thức tổng hợp sang đúng mô hình delta tại `be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollCalculation.service.ts`:231-243 (`actualWorkDays = standardWorkDays + Σ(workDayValue - 1)`, clamp `[0, standardWorkDays]`). `standardWorkDays` không còn hằng 26 — đọc qua hàm mới `resolveStandardWorkDays()` (`:41-77`, đọc `GeneralSetting.standardWorkingDaysMethod` + `Holiday`, gộp cùng ADR-dltl-04 như đề xuất). Kèm đúng 1 test theo yêu cầu (và thêm 2 test liên quan): `be_maxv/src/__tests__/hrmPayrollInputData.test.ts` — test "RVW-001: mô hình chấm công delta…" (1 bản ghi `khong_luong` → `actualWorkDays === 25` khi `standardWorkDays=26`, không còn sập về ~0) + test "BUG-dltl-002: resolveStandardWorkDays…" (thuần, không hardcode 26) + test "A-02" (dùng chung đoạn sửa `include.hop_dong`). *(backend-engineer)*
  Kiểm chứng: `npm run typecheck` exit 0 · `npm run lint` 0 error · `npx tsx --experimental-test-module-mocks --test src/__tests__/hrmPayrollInputData.test.ts` 11/11 pass · full suite `npm test` 642/646 pass (4 fail còn lại là `TC-hrm-301`/`TC-hrm-316` — 2 ca đỏ cố ý không nới lỏng của cụm `cau_hinh_mac_dinh`, không liên quan `du_lieu_tinh_luong`, có từ trước phiên này). Commit: chưa commit.

---

### RVW-002 🔴 BLOCKING — `req.user.sub` không tồn tại: `lockedByUserId`/`approvedByUserId` LUÔN được ghi `null`, mất dấu vết người khóa sổ

- Vị trí: `be_maxv/src/controllers/client/hrm/du_lieu_tinh_luong/payrollPeriods.controller.ts`:62, 70, 77 → hệ quả tại `payrollPeriods.service.ts`:171 và :214
- Vấn đề: cả 3 chỗ đọc `const userId = (req.user as any)?.sub`. Payload JWT của dự án là `{ userId, donViId, role, tokenVersion }` (`src/types/fastify.d.ts`:4-10), ký bằng `reply.jwtSign(payload)` (`helpers/authTokens.ts`:70) — **không có claim `sub` ở bất kỳ đâu** (đã grep toàn repo: 3 lần dùng `.sub` đều nằm trong đúng file này). Vậy `userId` luôn `undefined`, và service ghi `lockedByUserId: userId ?? null` → **cột audit của thao tác tài chính quan trọng nhất (khóa sổ / phê duyệt kỳ lương) vĩnh viễn rỗng**.

  Ép kiểu `as any` là nguyên nhân trực tiếp: nó vô hiệu hóa đúng cái type-check lẽ ra đã báo lỗi biên dịch. Codebase đã có sẵn helper chuẩn `currentUserId(req)` (`helpers/resolveTenantDb.ts`:130) mà module này không dùng.

  Lưu ý phân biệt với QA `BUG-dltl-004` (reopen không ghi audit — thiếu *cột* trong schema): đây là ca khác — cột **đã có** trong `schema.prisma`:1384-1387, code **có vẻ như** đang ghi, và `api-contract-*.md`:143 đã ghi nhận nhầm là "lấy từ `req.user.sub`, ctrl `:62`" tức Architect cũng tưởng nó chạy. Bug im lặng, không test nào bắt được (xem RVW-010).
- Đề xuất fix: `const userId = currentUserId(req);` (import từ `helpers/resolveTenantDb`), bỏ toàn bộ `as any`. Đổi chữ ký service thành `userId: string` (bắt buộc, bỏ `?`) để lần sau quên là lỗi biên dịch. Thêm assert trong test: sau `lock`, `periods[0].lockedByUserId` phải khác `null`.
- Trạng thái: OPEN
  → FIXED [2026-09-09] — đúng như đề xuất: `payrollPeriods.controller.ts` cả 3 hàm `lock`/`reopen`/`approve` nay dùng `currentUserId(req)` (import từ `helpers/resolveTenantDb`), bỏ hết `(req.user as any)?.sub`. `payrollPeriods.service.ts` đổi chữ ký `lockPayrollPeriod`/`approvePayrollPeriod` sang `userId: string` bắt buộc (không còn `?`). Assert đúng như yêu cầu có trong test "Vòng đời Kỳ lương…" (`lockedPeriod.lockedByUserId === 'u-owner-1'`) và test "Bug#8" (`data.lockedByUserId === 'u-owner-2'`) — `be_maxv/src/__tests__/hrmPayrollInputData.test.ts`. *(backend-engineer)*
  Kiểm chứng: `npm run typecheck` exit 0 · `npm run lint` 0 error (3 warning `no-explicit-any` trước đây ở `payrollPeriods.controller.ts:62,70,77` nay biến mất hẳn) · test 11/11 pass (file) · 642/646 pass (full suite, 4 fail không liên quan — xem RVW-001). Commit: chưa commit.

---

### RVW-003 🟡 Non-blocking — Cùng một "đơn giá chuyên cần" được tính bằng 2 công thức khác nhau ở màn hình và ở engine trả lương

- Vị trí: `be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollInputs.service.ts`:657-664 so với `payrollCalculation.service.ts`:199-206
- Vấn đề: `getDiligenceData` dùng `allowanceMap.set(es.ma_nv, Number(it.amount))` trong vòng lặp — **ghi đè**, chỉ giữ khoản `ATTENDANCE_ALLOWANCE` **cuối cùng**. `calculatePayrollPreview` dùng `diligenceAllowance += Number(it.amount)` — **cộng dồn tất cả**. Schema cho phép 1 nhân viên có nhiều khoản cùng category (`EmployeeSalaryItem @@unique([employeeSalaryId, salaryItemId])`, `schema.prisma`:1308 — unique theo *khoản*, không theo *category*). Khi đó màn "Chuyên cần" hiển thị `donGia`/`tongTru`/`thanhTien` khác hẳn số thực trả trong bảng lương, mà không có cảnh báo nào.

  Cùng chỗ này còn là **2 bản sao của một bất biến tài chính** (BR-dltl-016 chặn sàn `min(tongPhat, donGia)`) viết 2 kiểu khác nhau (`break` vs cờ `isMấtToànBộ`). Hôm nay ra cùng kết quả, nhưng sửa 1 bản quên bản kia là lệch tiền — đúng loại nợ mà QA `BUG-dltl-006` (test giả) khiến không ai phát hiện được.
- Đề xuất fix: rút 1 hàm thuần `tinhLuongChuyenCan(donGia, records) → { tongPhat, tongTru, thanhTien }` dùng chung cho cả 2 nơi, và chốt với BA quy tắc gộp nhiều khoản `ATTENDANCE_ALLOWANCE` (cộng dồn hay lấy 1). Hàm thuần này cũng chính là thứ để viết lại test giả `hrmPayrollInputData.test.ts`:417-425 thành test thật.
- Trạng thái: OPEN

---

### RVW-004 🟡 Non-blocking — 7/8 endpoint đọc dữ liệu không kiểm kỳ lương tồn tại: `periodId` rác trả 200 + dữ liệu rỗng thay vì 404 `E-dltl-025`

- Vị trí: `be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollInputs.service.ts`:153, 259, 360, 441, 534, 626, 759 (7 hàm `get*Data`) — đối chiếu `getAttendanceMatrix` :72-75 làm đúng
- Vấn đề: chỉ `getAttendanceMatrix` kiểm `payrollPeriod.findUnique` rồi ném `E-dltl-025`. Bảy hàm còn lại nhận thẳng `query.periodId` vào `findMany({ where: { periodId } })` → id sai/kỳ đã bị xóa vẫn trả `200` kèm danh sách **toàn bộ nhân viên với `records: []`**. Người dùng thấy một bảng trắng hợp lệ và tưởng "kỳ này chưa ai nhập gì", trong khi thực tế đang xem nhầm/kỳ không tồn tại. Cùng một mã lỗi `E-dltl-025` được xử lý nhất quán ở nhánh ghi (`assertPayrollPeriodWritable`) nhưng bỏ trống ở nhánh đọc.
- Đề xuất fix: rút helper `assertPayrollPeriodExists(db, periodId)` (tách phần đầu của `assertPayrollPeriodWritable`) và gọi ở đầu cả 8 hàm `get*Data`.
- Trạng thái: OPEN

---

### RVW-005 🟡 Non-blocking — Ghi chấm công / vi phạm chuyên cần không kiểm ngày có thuộc kỳ không, cũng không kiểm nhân viên có tồn tại không

- Vị trí: `be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollInputs.service.ts`:108-138 (`overrideAttendanceCell`) và :714-745 (`recordDiligenceViolation`)
- Vấn đề: validator chỉ kiểm định dạng `YYYY-MM-DD` (`inputs.validator.ts`:17, :116); service không đối chiếu `workDate`/`violationDate` với `[period.startDate, period.endDate]` — dù `assertPayrollPeriodWritable` vừa đọc kỳ ra và **có sẵn** thông tin đó (nhưng chỉ `select: { id, status }`, `payrollPeriodLockGuard.ts`:19). Hệ quả: ghi được ngày công của tháng 7 vào kỳ tháng 9; dữ liệu đó vẫn được `calculatePayrollPreview` cộng vào `actualWorkDays` của kỳ 9 (kết hợp RVW-001 thì càng lệch).

  Cùng lúc, `input.ma_nv` không được kiểm tồn tại: nhân viên sai/đã nghỉ → vỡ ở FK `P2003` → `errorHandler.plugin.ts`:113-118 trả **409 "còn được tham chiếu"** (thông điệp của thao tác XÓA) thay vì `E-dltl-002` (400). Cùng lớp lỗi với `A-08` của Architect nhưng khác đối tượng (`A-08` nói về FK *danh mục*, đây là FK *nhân viên* + thiếu kiểm khoảng ngày) → nên sửa chung một đợt.
- Đề xuất fix: cho `assertPayrollPeriodWritable` trả thêm `startDate`/`endDate`, kiểm khoảng ngày, ném `E-dltl-018`/`E-dltl-005` (400). Kiểm `ma_nv` bằng 1 `findUnique({ where: { ma_nv }, select: { ma_nv: true } })` → `E-dltl-002` (400).
- Trạng thái: OPEN

---

### RVW-006 🟡 Non-blocking — `apply*` trả `200 { appliedCount: 0 }` khi phạm vi không khớp nhân viên nào — thao tác không làm gì mà báo thành công

- Vị trí: `be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollInputs.service.ts`:23-66 (`resolveTargetEmployees`) → điểm trả về :245, 353, 434, 527, 619, 847
- Vấn đề: `resolveTargetEmployees` chỉ ném lỗi khi **thiếu** `ma_pb` (`E-dltl-003`) hoặc **rỗng** `employeeIds` (`E-dltl-004`); nếu `ma_pb` sai/không tồn tại, hoặc mọi `employeeIds` đều đã nghỉ việc (`status !== '1'`), hàm trả mảng rỗng và 6 hàm `apply*` trả `200 { appliedCount: 0 }`. Kế toán bấm "Áp dụng", thấy thành công, thực tế 0 dòng được ghi và cũng không có dòng nào bị xóa. Đây chính là mặt backend của QA `BUG-dltl-010` (FE dùng `ma_pb` từ mock) — hai tầng cộng lại thì lỗi hoàn toàn im lặng.
- Đề xuất fix: `targetEmployees.length === 0` → ném `E-dltl-002` (400) kèm thông điệp nêu rõ phạm vi đã chọn. Ngoài ra với `scope: 'nhan_vien'`, đối chiếu `employeeIds` gửi lên vs `ma_nv` tìm được, báo danh sách mã không hợp lệ.
- Trạng thái: OPEN

---

### RVW-007 🟡 Non-blocking — Trùng lặp mã diện rộng: cùng một khối lọc/gom nhóm được chép ~20 lần, 8 phân hệ nhập liệu gần như copy-paste

- Vị trí: `be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollInputs.service.ts` và `catalogs.service.ts`
- Vấn đề: đo cụ thể trên diff:
  | Khối lặp | Số bản sao | Dòng |
  |---|---|---|
  | Dựng `whereNv` (`status:'1'` + `da_xoa` + `ma_pb` + OR tìm kiếm `q`) | **8** | `payrollInputs.service.ts`:77-84, 154-161, 260-267, 361-368, 442-449, 535-542, 627-634, 760-767 |
  | Gom `recordMap` theo `ma_nv` | **7** | :174-179, 281-286, 382-387, 463-468, 556-561, 666-671, 781-786 |
  | Gom map theo `ma_nv` (bản thứ hai, engine) | **8** | `payrollCalculation.service.ts`:78-132 |
  | Vòng kiểm trùng `Set` trong `apply*` | **6** | :201-207, 313-321, 406-412, 487-493, 580-586, 819-825 |
  | `$transaction { for(emp) { deleteMany; createMany } }` | **6** | :221-246, 329-354, 416-435, 503-528, 595-620, 829-848 |
  | `generateNextXxxCode` (chỉ khác tiền tố KPI/SP/CC/BT) | **4** | `catalogs.service.ts`:18-32, 93-107, 166-180, 239-253 |
  | CRUD danh mục `list/create/update/delete` | **4 bộ ×4 hàm** | `catalogs.service.ts` toàn file (306 dòng) |

  Chi phí thật đã hiện hình ngay trong chính đợt này: `A-05` (N+1 trong transaction) phải sửa ở 6 chỗ, `A-08` (kiểm FK danh mục) phải sửa ở 5 chỗ, RVW-004 ở 7 chỗ. Xác suất sửa sót là rất cao, và RVW-003 là ví dụ đã xảy ra thật của việc 2 bản sao lệch nhau.
- Đề xuất fix: rút 4 helper trong cùng thư mục `du_lieu_tinh_luong/`: `buildEmployeeFilter(query)`, `groupByMaNv(records)`, `assertNoDuplicate(items, keyFn, errorCode)`, `replaceRecordsForEmployees(tx, model, periodId, maNvs, rows)` (helper cuối gộp luôn cách sửa `A-05`: 2 lệnh thay vì 2N). Với `catalogs.service.ts`: một factory `makeCatalogService({ model, prefix, usageModel, usageField, labels })` thay 4 bộ CRUD. Ước tính giảm ~40% số dòng của cả 2 file.
- Trạng thái: OPEN

---

### RVW-008 🟡 Non-blocking — Sửa danh mục không chuẩn hóa `code` như lúc tạo → lọt 2 mã trùng nhau chỉ khác hoa/thường

- Vị trí: `be_maxv/src/services/client/hrm/du_lieu_tinh_luong/catalogs.service.ts`:49 vs :68-79 (KPI); lặp lại y hệt tại :122 vs :141-152 (sản phẩm), :195 vs :214-225 (chuyên cần), :268 vs :286-297 (bù trừ)
- Vấn đề: `create` chuẩn hóa `input.code.trim().toUpperCase()`; `update` thì `data: { ...input }` — giữ nguyên chuỗi người dùng gửi, và kiểm trùng bằng `findUnique({ where: { code: input.code } })` (Postgres so sánh **phân biệt hoa/thường**). Kết quả: đã có `KPI01`, sửa item khác thành `kpi01` → qua được kiểm trùng, qua được unique index, tồn tại 2 mã "giống nhau" dưới mắt người dùng. `generateNextKpiCode` lại dò bằng regex `/^KPI(\d{2,})$/i` (không phân biệt hoa/thường) nên sẽ coi `kpi01` là đã dùng — hai nơi hiểu khác nhau về cùng một mã.
- Đề xuất fix: chuẩn hóa `code` một lần duy nhất ở tầng validator (`.transform(v => v.trim().toUpperCase())` trong `catalogs.validator.ts`) để cả `create` lẫn `update` cùng dùng.
- Trạng thái: OPEN

---

### RVW-009 🟡 Non-blocking — Response lỗi của `PayrollError` lặp 2 khóa cùng giá trị và tạo ra shape thứ 3 trong hệ thống

- Vị trí: `be_maxv/src/plugins/errorHandler.plugin.ts`:26-33
- Vấn đề: nhánh mới trả `{ success:false, code, errorCode, message }` — `code` và `errorCode` **luôn bằng nhau** (cùng `err.code`), rõ ràng là dư thừa ngoài ý muốn. Toàn bộ lỗi còn lại của dự án trả `{ success:false, message }`, riêng `ValidationError` trả `{ success:false, errors }`. Giờ có 3 shape khác nhau; FE (23 component sắp đấu dây) sẽ phải đoán đọc khóa nào, và bên nào đọc `errorCode` bên nào đọc `code` sẽ trôi dạt theo thời gian.
- Đề xuất fix: chốt 1 khóa duy nhất (đề xuất `errorCode`, vì `code` dễ nhầm với `PrismaClientKnownRequestError.code`), xóa khóa còn lại, ghi vào `api-contract-du-lieu-tinh-luong.md` Mục Error Matrix **trước khi** FE đấu dây. Cân nhắc bổ sung `errorCode` cho cả các lỗi cũ để về 1 shape duy nhất — việc này cần Architect chốt vì đụng nhiều module.
- Trạng thái: OPEN

---

### RVW-010 🟡 Non-blocking — Test dựng app bỏ qua toàn bộ tầng bảo mật, và mock quá dễ dãi khiến nhiều bất biến không thể fail

- Vị trí: `be_maxv/src/__tests__/hrmPayrollInputData.test.ts`:328-336 (`buildTestApp`), :251-254, :258, :266, :273, :281, :288, :295, :311
- Vấn đề: hai lớp che lỗi độc lập nhau —
  1. `buildTestApp` đăng ký thẳng 4 route con, **không đi qua `hrmRoutes`** nên không có `authenticate` + `requireModule('hrm')`. Mọi test chạy như người dùng ẩn danh: không test nào chạm phân quyền, và `req.user` luôn `undefined` — chính điều này khiến RVW-002 lọt qua 3/3 test xanh.
  2. Mock Prisma bỏ qua ngữ nghĩa: `deleteMany: async () => {}` (6 model) nên bất biến "áp dụng ghi đè dữ liệu cũ" không bao giờ được kiểm; `attendanceRecord.upsert` bỏ qua `where` và luôn `push(create)` nên khóa duy nhất `[periodId, ma_nv, workDate]` không được mô phỏng; `diligenceRecord.findUnique: async () => null` nên `E-dltl-019` (trùng vi phạm cùng ngày) **không thể fail dù có xóa hẳn đoạn kiểm trùng**.

  Cùng bản chất với QA `BUG-dltl-006`/`ISSUE-dltl-001` (test giả, độ phủ 16%) nhưng chỉ ra nguyên nhân cấu trúc: bộ khung test hiện tại không đủ trung thực để bảo vệ bất kỳ bất biến nào.
- Đề xuất fix: (a) `buildTestApp` đăng ký qua `hrmRoutes` với `app.authenticate`/`requireModule` được mock tường minh, thêm ít nhất 1 test 401 và 1 test 403 thiếu quyền; (b) mock `deleteMany` lọc mảng thật, `upsert` tra `where` thật, `findUnique` của `diligenceRecord` tra theo khóa tổ hợp thật; (c) tách logic thuần (xem RVW-003, RVW-012) để phần lớn bất biến tài chính test được không cần mock DB.
- Trạng thái: OPEN

---

### RVW-011 🟡 Non-blocking — Không endpoint đọc nào có phân trang; payload tăng tuyến tính theo số nhân viên

- Vị trí: `be_maxv/src/validators/hrm/du_lieu_tinh_luong/catalogs.validator.ts`:54-57 · `inputs.validator.ts`:134-138 · `payrollPeriods.validator.ts`:17-22 · 8 hàm `get*Data` trong `payrollInputs.service.ts` · `payrollCalculation.service.ts`:41-51
- Vấn đề: không schema query nào có `page`/`limit`. 8 màn nhập liệu đều trả **toàn bộ nhân viên đang làm việc kèm toàn bộ bản ghi của kỳ** trong 1 response; `GET /payroll/calculate` trả 30 trường × N nhân viên; `listPayrollPeriods` trả mọi kỳ của mọi năm kèm 9 `_count`. Với tenant 300-500 nhân viên, mỗi lần mở tab là vài MB JSON và một lượt `findMany` không giới hạn. Cùng gốc với `A-05` (không chặn trên `employeeIds`) nhưng ở nhánh ĐỌC, chưa được nêu ở báo cáo nào.
- Đề xuất fix: thêm `page`/`limit` (mặc định 50, trần 200) cho `list*` danh mục và `listPayrollPeriods` — làm được ngay, không đụng nghiệp vụ. Với 8 màn ma trận thì phân trang **theo nhân viên** và trả `total`; cần chốt với FE vì đổi shape response, nên gộp cùng quyết định `A-06` (kiểu tiền trong response) để FE chỉ phải sửa 1 lần.
- Trạng thái: OPEN

---

### RVW-012 🟢 Suggestion — `calculatePayrollPreview` là một hàm 276 dòng làm 4 việc, không thể test nếu không có DB

- Vị trí: `be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollCalculation.service.ts`:33-308
- Vấn đề: một hàm gộp (1) 12 truy vấn tải dữ liệu, (2) 8 khối gom nhóm, (3) toàn bộ công thức lương 18 cột, (4) dựng shape response. Vì phần tính tiền dính chặt với `db`, mọi bất biến tài chính chỉ test được qua HTTP + mock Prisma — đó là lý do gốc khiến `TC-dltl-053` bị viết thành test giả và `TC-dltl-061` (0 test cho engine) chưa ai viết nổi.
- Đề xuất fix: tách 3 tầng — `loadPayrollContext(db, periodId)` (chỉ I/O) → `computeEmployeeLine(ctx, emp)` (**hàm thuần**, không `db`) → `calculatePayrollPreview` chỉ còn ghép nối. `computeEmployeeLine` test được bằng bảng dữ liệu, và là nơi đặt fix của RVW-001, `A-02`, `A-03`, `A-07` cùng chỗ.
- Trạng thái: OPEN

---

### RVW-013 🟢 Suggestion — 16 cảnh báo lint đều là `any` ở đúng chỗ cần chặt chẽ nhất

- Vị trí: `payrollInputs.service.ts`:77, 154, 260, 361, 442, 535, 627, 760 · `catalogs.service.ts`:35, 110, 183, 256 · `payrollPeriods.service.ts`:15 · `payrollPeriods.controller.ts`:62, 70, 77
- Vấn đề: `npx eslint` trên 13 file mới → 0 error, **16 warning, 100% là `@typescript-eslint/no-explicit-any`**: 13 khai báo `const where: any` và 3 lần `(req.user as any)`. Ba lần cuối đã gây ra RVW-002 (lỗi thật, chạy im lặng); 13 lần đầu làm mất kiểm tra tên trường trong `where` — gõ sai `ma_pb` thành `mapb` sẽ không lỗi biên dịch mà chỉ lặng lẽ trả sai tập dữ liệu.
- Đề xuất fix: thay bằng `Prisma.hrm_nhan_vienWhereInput` / `Prisma.KpiItemWhereInput` / `Prisma.PayrollPeriodWhereInput`; bỏ `as any` theo RVW-002. Nếu gộp với RVW-007 thì chỉ còn 1-2 chỗ cần khai kiểu.
- Trạng thái: OPEN

---

### RVW-014 🟢 Suggestion — Định danh tiếng Việt có dấu trong mã nguồn

- Vị trí: `be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollInputs.service.ts`:678, 684, 693 (`isMấtToànBộ`)
- Vấn đề: biến đặt tên `isMấtToànBộ` — trái quy ước ASCII của dự án (`.claude/rules/naming-conventions.md`) và không giống bất kỳ chỗ nào khác trong `be_maxv` (mọi nơi khác dùng tiếng Việt **không dấu**: `tongPhat`, `donGia`, `thanhTien`, `dbCoQuyenLuong`). Rủi ro thật: khó grep, dễ vỡ khi đổi encoding hoặc khi công cụ CLI/diff không xử lý tốt UTF-8.
- Đề xuất fix: đổi thành `isMatToanBo` (hoặc `losesFullAllowance`).
- Trạng thái: OPEN

---

### RVW-015 🟢 Suggestion — Ép kiểu 2 tầng `tx as unknown as PrismaClient` ngay tại đường khóa sổ

- Vị trí: `be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollPeriods.service.ts`:165
- Vấn đề: `snapshotPayrollSheet(tx as unknown as PrismaClient, id)` — `as unknown as` là cách nói với TypeScript "đừng kiểm gì cả", đặt đúng vào hàm ghi chứng từ lương. Nếu sau này `snapshotPayrollSheet` dùng thêm API chỉ có ở `PrismaClient` mà không có trên transaction client (`$transaction`, `$connect`...), lỗi sẽ chỉ nổ lúc chạy, giữa một transaction đang mở.
- Đề xuất fix: đổi tham số của `snapshotPayrollSheet`/`calculatePayrollPreview` thành `Prisma.TransactionClient` (hoặc union `PrismaClient | Prisma.TransactionClient`) rồi bỏ hẳn ép kiểu.
- Trạng thái: OPEN

---

### RVW-016 🟢 Suggestion — Ba nguồn thông điệp lỗi song song trong cùng một module

- Vị trí: `be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollPeriods.service.ts`:79, 117, 131, 144, 160, 190, 207, 224, 237 · `catalogs.service.ts`:51, 66, 85, 124, 139, 158, 197, 212, 231, 270, 284, 303
- Vấn đề: module này dùng đồng thời (1) `PAYROLL_ERROR_MESSAGES` tập trung (`constants/payrollErrors.ts`), (2) chuỗi tiếng Việt hardcode inline trong service, (3) `MESSAGES.HRM.*` — nguồn chuẩn mà phần còn lại của HRM đang dùng (vd `salaryItems.service.ts`:242 `MESSAGES.HRM.SALARY_ITEM_IN_USE`). Hệ quả: không thể rà soát toàn bộ thông điệp người dùng thấy ở một chỗ, khó đồng bộ wording với SRS.
- Đề xuất fix: chuyển chuỗi inline vào `MESSAGES.HRM.*` (giữ nguyên `PAYROLL_ERROR_MESSAGES` cho nhóm có mã `E-dltl-*` — cách làm đó đúng và nên giữ).
- Trạng thái: OPEN

---

### RVW-017 🟢 Suggestion — Danh sách trạng thái chỉ-đọc khai bằng mảng chuỗi thường, không dùng enum Prisma

- Vị trí: `be_maxv/src/helpers/payrollPeriodLockGuard.ts`:30
- Vấn đề: `const readOnlyStatuses = ['LOCKED', 'APPROVED', 'PAID', 'ARCHIVED'];` là `string[]`, không phải `PayrollPeriodStatus[]`. Thêm một trạng thái mới vào enum (vd `CANCELLED`) sẽ **không** có lỗi biên dịch nào nhắc cập nhật guard khóa sổ — trạng thái mới mặc nhiên cho phép ghi. Đây là guard bảo vệ bất biến quan trọng nhất của module (BR-dltl-001), nên đáng để trình biên dịch canh giúp.
- Đề xuất fix: `const readOnlyStatuses: PayrollPeriodStatus[] = [...]`, hoặc lật ngược thành danh sách cho-phép-ghi `['DRAFT','PENDING_REVIEW']` với `satisfies` để buộc liệt kê đủ.
- Trạng thái: OPEN

---

## Blocking kế thừa từ 3 báo cáo độc lập (KHÔNG đánh số lại — tính vào verdict)

Đã đọc lại mã nguồn và **xác nhận đúng**, nhưng không diễn giải lại; sửa theo tài liệu gốc:

> **Cột "Trạng thái (2026-09-09)" do backend-engineer bổ sung sau phiên sửa 8/9 lỗi 🔴** — chỉ
> thêm cột, KHÔNG sửa nội dung 4 cột gốc bên trái (đúng nguyên tắc "không xóa finding cũ").

| Phát hiện gốc | Mức | Xác nhận khi đọc code | Nguồn | Trạng thái (2026-09-09) |
|---|---|---|---|---|
| `A-01` — 4 controller thiếu `resolveTenantCtx` + `assertXemLuong` | 🔴 | Đúng. Cả 4 file đều gọi `resolveTenantDb(req)` trơn, trong khi `hopDong.controller.ts`:34-38 đã có sẵn khuôn `dbCoQuyenLuong(req)` để dùng lại | `api-contract-*.md` | **FIXED** — helper dùng chung `dbCoQuyenLuongPayroll()` mới (`be_maxv/src/helpers/payrollAccessGuard.ts`), áp dụng cho toàn bộ handler của cả 4 controller. Test "A-01" trong `hrmPayrollInputData.test.ts` xác nhận 403 khi `xemLuong=false`. |
| `A-02` — chọn hợp đồng không lọc theo kỳ | 🔴 | Đúng, `payrollCalculation.service.ts`:44-47 | `data-model-*.md` | **FIXED** — thêm `where` lọc `ngay_bat_dau/ngay_ket_thuc` theo `period.startDate/endDate` vào `include.hop_dong` (`payrollCalculation.service.ts`:93-107). Test "A-02" xác nhận hợp đồng ký trước cho tháng sau KHÔNG còn được chọn. |
| `A-03` — `attendanceType` không bao giờ được đọc | 🔴 | Đúng, engine chỉ cộng `workDayValue` (`:153`). **Phải sửa cùng lúc với RVW-001** vì cùng một đoạn mã | `data-model-*.md` | **FIXED** — sửa tại nguồn ghi (`overrideAttendanceCell`, `payrollInputs.service.ts`), không phải tại engine đọc: `workDayValue` nay được tính đúng theo `attendanceType` (bảng `ATTENDANCE_FIXED_VALUE`) NGAY KHI GHI, nên engine đọc `workDayValue` là đã đúng — không cần sửa `payrollCalculation.service.ts` đọc thêm `attendanceType`. Test "A-03" xác nhận `actualHours` client gửi sai bị bỏ qua với loại nghỉ cố định. |
| `A-04` — TOCTOU mọi chuyển trạng thái | 🟡 | Đúng, 9 chỗ đọc `status` ngoài lệnh ghi. Bổ sung: `createPayrollPeriod` :74-85 cũng check-then-create → P2002 → 409 sai nghĩa | `data-model-*.md` | OPEN — ngoài phạm vi 8 lỗi 🔴 của phiên 2026-09-09, chưa đụng. |
| `A-05` — N+1 trong transaction, không `{ timeout }` | 🟡 | Đúng, 6 chỗ. Sửa gọn nếu làm cùng RVW-007 | `data-model-*.md` | OPEN — ngoài phạm vi phiên này. |
| `A-06` — cùng endpoint đổi kiểu tiền sau khóa sổ | 🟡 | Đúng, `payrollCalculation.service.ts`:340-348. Nên chốt cùng RVW-009 + RVW-011 để FE sửa 1 lần | `api-contract-*.md` | OPEN — ngoài phạm vi phiên này (cần Architect + FE chốt trước). |
| `A-07` — thiếu `Math.round` ở 4 giá trị | 🟡 | Đúng (`:219-220`, `:231`, `:259-264`, `:266`). **Xác nhận độc lập về kiểu tài chính**: schema dùng `Decimal(18,2)` toàn bộ, không có `Float`/`Double` nào — đúng chuẩn; rủi ro chỉ nằm ở tầng JS `Number()`, và 12/16 phép tính đã có `Math.round`, 4 phép còn thiếu | `data-model-*.md` | OPEN — ngoài phạm vi phiên này (🟡 non-blocking, không nằm trong 8 lỗi 🔴 được giao). |
| `A-08` — không kiểm tồn tại/đúng category FK danh mục | 🟡 | Đúng. Xem thêm RVW-005 (FK `ma_nv` + khoảng ngày) | `data-model-*.md` | OPEN — ngoài phạm vi phiên này. |
| `A-09` — bất nhất chiến lược snapshot đơn giá | 🟡 | Đúng, `penaltyRate` + `direction` đọc động | `data-model-*.md` | OPEN — ngoài phạm vi phiên này. |
| `BUG-dltl-002` — hardcode tham số cấu hình | 🔴 | Đúng. Bổ sung 2 điểm hardcode chưa liệt kê: `isWarningMonth: totalHours > 40` (`payrollInputs.service.ts`:192) và trần phí công đoàn `234_000` (`payrollCalculation.service.ts`:249) | `qa-report-*.md` | **FIXED một phần** — đọc từ `GeneralSetting`: `standardWorkDays` (qua `resolveStandardWorkDays`), `standardHoursPerDay`, BHXH/BHYT/BHTN NLĐ+DN, đoàn phí (tỷ lệ+trần), `maxOtHoursPerMonth`. **CHƯA ĐỤNG** biểu thuế TNCN (`tinhThueLuyTien()` giữ hardcode theo chỉ định tường minh của task — đúng luật 7 bậc, nhưng chưa nối `GeneralSetting.taxBrackets`; OQ-dltl-002 vẫn mở, cần ADR riêng theo ADR-dltl-04). Test "BUG-dltl-002" ×2 trong `hrmPayrollInputData.test.ts`. |
| `BUG-dltl-003` + `011` — reopen không có role-guard (2 tầng) | 🔴 | Đúng, `payrollPeriods.route.ts`:15 không có `preHandler` riêng. Dự án đã có sẵn `app.requireRole(...)` (`jwt.plugin.ts`:47) để dùng | `qa-report-*.md` | **FIXED** — dùng `assertAdminOrOwner` (tái sử dụng từ `generalSettings.route.ts`, đúng đề xuất ADR-dltl-05) thay vì `app.requireRole`, áp dụng cho CẢ 3 action `reopen`/`lock`/`approve` (không chỉ reopen — theo phạm vi mở rộng mà chính Architect đã xác nhận ở `data-model-*.md` Mục 6.1 dòng #3: "Mở rộng phạm vi: `lock` và `approve` cũng không có role-guard — đây là 2 hành vi thẩm quyền tài chính, phải gộp chung"). Test "Bug#8" xác nhận 403 cho `OWNER_EMPLOYEE`, 200 cho `OWNER`. |
| `BUG-dltl-004` — reopen không ghi audit | 🔴 | Đúng, `payrollPeriods.service.ts`:181-201 (`_input`, `_userId`). Xem RVW-002: cả `lock`/`approve` cũng đang mất dấu vết dù có cột | `qa-report-*.md` | **FIXED** — audit log qua `writeLog` (`services/shared/syslog.service.ts`, bảng `sys_log` control-plane) cho cả 3 action, gọi từ `ghiNhatKyLuong()` mới trong `payrollPeriods.controller.ts`. KHÔNG tạo bảng audit tenant mới (đã tìm thấy `writeLog` sẵn có, đúng tiền lệ "Cấu hình mặc định"). Test "Bug#8" xác nhận `ghiNhatKyLuongCalls` có đúng `hanhDong`/`reason`. |
| `BUG-dltl-006` — test giả | 🟡 | Đúng, `hrmPayrollInputData.test.ts`:417-425. Nguyên nhân cấu trúc ở RVW-010 + RVW-012 | `qa-report-*.md` | **FIXED** — test "Bất biến Tài chính…" nay gọi thật `getDiligenceData()` (`payrollInputs.service.ts`) thay vì tự tính lại công thức bằng biến cục bộ. Nguyên nhân cấu trúc gốc (RVW-010 mock quá dễ dãi, RVW-012 hàm 276 dòng khó test) vẫn **OPEN** — ngoài phạm vi phiên này, chỉ sửa đúng 1 test giả được chỉ định. |
| `BUG-dltl-007` — `workDayValue` không chặn trần 1.0/ngày | 🟡 | Đúng, `payrollInputs.service.ts`:112-113 | `qa-report-*.md` | **FIXED** — chặn tường minh bằng `PayrollError(E_DLTL_005)` khi `actualHours > standardHoursPerDay` (validate, không âm thầm cắt — theo đúng chỉ định của task). Test "BUG-dltl-007" xác nhận 400 `E-dltl-005`. |
| `BUG-dltl-001` — 8 Panel FE chưa nối API thật | 🔴 | Ngoài phạm vi review backend phiên này | `qa-report-*.md` | Vẫn ngoài phạm vi backend — để dành `frontend-engineer`, KHÔNG đụng `hdđt_maxv` trong phiên này (đúng ràng buộc được giao). |

---

## Tổng hợp phiên review 2026-09-09

| Mức | Số phát hiện mới (RVW) | ID |
|---|---|---|
| 🔴 Blocking | **2** | RVW-001, RVW-002 |
| 🟡 Non-blocking | **9** | RVW-003 → RVW-011 |
| 🟢 Suggestion | **6** | RVW-012 → RVW-017 |
| **Tổng mới** | **17** | không tính 15 mục kế thừa ở bảng trên |

**Verdict: ❌ Request changes.**

Không thể Approve: 2 blocking mới (RVW-001 sai số tiền lương ở thao tác thường gặp nhất và đóng băng số sai vào chứng từ khi khóa sổ; RVW-002 mất dấu vết người khóa sổ/phê duyệt kỳ lương) cộng với 6 blocking kế thừa chưa xử lý (`A-01`, `A-02`, `A-03`, `BUG-dltl-002/003/004`).

**Thứ tự đề xuất cho Backend Engineer** (gộp theo vùng mã để sửa 1 lần, tránh 3 lượt chạm cùng file):

1. **Một đợt trên `payrollCalculation.service.ts`**: RVW-001 + `A-02` + `A-03` + `A-07` + `BUG-dltl-002`, làm cùng RVW-012 (tách hàm thuần) để có chỗ đặt test thật.
2. **Một đợt trên controller/route kỳ lương**: RVW-002 + `A-01` + `BUG-dltl-003` + `BUG-dltl-004` (đều là guard/audit ở tầng biên, cần OQ-dltl-003/004 chốt trước).
3. **Một đợt trên `payrollInputs.service.ts` + `catalogs.service.ts`**: RVW-007 (rút helper) kéo theo `A-05`, `A-08`, RVW-004, RVW-005, RVW-006, RVW-013.
4. **Chốt hợp đồng với FE trước khi đấu dây 23 component**: RVW-009 + `A-06` + RVW-011 — cả ba đều đổi shape response, phải quyết một lượt.
5. RVW-003, RVW-008, RVW-010, và nhóm 🟢 còn lại.

Sau khi sửa, Backend Engineer cập nhật `OPEN → FIXED` kèm commit + kết quả test ngay dưới từng finding, rồi chuyển lại code-reviewer để review vòng 2 (ưu tiên soát lại RVW-001 bằng test số học và RVW-002 bằng assert `lockedByUserId`).

---

## Cập nhật 2026-09-09 (backend-engineer) — kết quả phiên sửa 8/9 lỗi 🔴

Đã sửa: RVW-001, RVW-002 (2 finding mới của phiên review này) + `A-01`, `A-02`, `A-03`,
`BUG-dltl-002` (một phần — trừ biểu thuế TNCN), `BUG-dltl-003`, `BUG-dltl-004`, `BUG-dltl-006`,
`BUG-dltl-007` (8 finding kế thừa) — đúng 8/9 lỗi 🔴 gốc mà `CONTEXT_SUMMARY.md` Mục 19.9 liệt kê
(lỗi thứ 9 — 22 file FE `hdđt_maxv` còn dùng mock — để dành `frontend-engineer`, KHÔNG thuộc
phạm vi phiên này). Chi tiết từng finding: xem dòng "→ FIXED [2026-09-09]" ngay dưới RVW-001/
RVW-002 ở trên, và cột "Trạng thái (2026-09-09)" trong bảng "Blocking kế thừa".

**Chưa sửa (cố ý, ngoài phạm vi 8 lỗi được giao trong phiên này):** `A-04`, `A-05`, `A-06`, `A-07`,
`A-08`, `A-09` và toàn bộ `RVW-003` → `RVW-017` (đã có sẵn Trạng thái `OPEN` ở từng mục, không
đụng tới). `BUG-dltl-001` (FE mock) vẫn `OPEN`, ngoài phạm vi backend.

**Kiểm chứng thật đã tự chạy:** `npm run typecheck` exit 0 (0 error) · `npm run lint` 0 error /
340 warning (không tăng so với trước — 3 warning `no-explicit-any` ở
`payrollPeriods.controller.ts` biến mất nhờ bỏ `as any`) · `npx tsx --experimental-test-module-mocks --test src/__tests__/hrmPayrollInputData.test.ts` → **11/11 pass** (3 test cũ được sửa/giữ + 8 test mới, mỗi lỗi ≥1 test) · `npm test` (toàn bộ suite) → **642/646 pass**, 4 fail còn lại là `TC-hrm-301`/`TC-hrm-316` (×2, tính cả parent block) — 2 ca đỏ cố ý không nới lỏng của cụm "Cấu hình mặc định/Ca làm việc/Lịch ngày lễ", đã có từ TRƯỚC phiên này (xem `CONTEXT_SUMMARY.md` dòng 13-14), không liên quan `du_lieu_tinh_luong`.

Chi tiết đầy đủ: `docs/hrm/work-log.md` (entry `[2026-09-09] backend-engineer`).
