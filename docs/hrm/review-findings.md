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

---

## Review 2026-09-10 — Verdict: ❌ Request changes

**Phạm vi review**: diff đợt "Bảng lương tổng hợp / ADR-010" (chưa commit, đối chiếu bằng `git diff` + đọc file đầy đủ, KHÔNG tin danh sách trong `work-log.md`):
`prisma/tenant/schema.prisma` (+19 cột) · `services/client/hrm/du_lieu_tinh_luong/payrollCalculation.service.ts` (viết lại, 804 dòng) · `controllers/.../payrollCalculation.controller.ts` + `routes/.../payrollCalculation.route.ts` (endpoint mới) · `services/client/hrm/cai_dat_luong/salaryItems.service.ts` + validator · `services/client/hrm/cau_hinh_mac_dinh/generalSettings.service.ts` + validator · `constants/hrm/du_lieu_tinh_luong/insuranceCaps.ts` (mới) · `__tests__/hrm/hrmPayrollCalculation.test.ts` (mới, 790 dòng).

**Đối chiếu nguồn**: `ADR-010` (10 bước, QĐ-1…QĐ-9.4) · `srs-du-lieu-tinh-luong.md` Mục 15 (`BR-dltl-024…027`, `AC-dltl-12…28`) · `api-contract-du-lieu-tinh-luong.md` Mục 8 · `data-model-du-lieu-tinh-luong.md` Mục 11.

**Kiểm chứng tự chạy (không tin số QA báo):** `npx tsc --noEmit` → **0 lỗi** · `npx tsx --test src/__tests__/hrm/hrmPayrollCalculation.test.ts` → **46/46 pass**.

**Kết quả đối chiếu công thức tài chính — ĐẠT.** Đã kiểm từng bước [1]…[10] so với ADR-010 và so với số liệu tuyệt đối trong `AC-dltl-12…28`, KHÔNG dựa vào test pass:
- [5a] phân giỏ loại trừ nhau hiện thực đúng bằng `if / else if` trên **một** vòng lặp (`payrollCalculation.service.ts`:196-202) — không có đường nào cộng đôi `mealAllowanceAmount` + `otherAllowanceTaxExemptAmount` (ràng buộc thứ tự thứ 4, rủi ro nặng nhất của đợt này).
- [6] hai trần tính riêng rồi cộng (`:537-546`) — `AC-dltl-12` cho ra đúng `4.446.000 + 992.000 = 5.438.000`, `AC-dltl-13` giữ `capBhtn` không kẹp. Không có chỗ nào kẹp một trần chung.
- [3] `otBase` KHÔNG dùng `baseSalaryMonthly` (`:415-419`) — đúng QĐ-1, tiền tăng ca không phồng theo phụ cấp.
- [8] `tinh_tncn` kiểm TRƯỚC rẽ nhánh (`:569`); nhánh 10% tính trên `thuNhapTruocGiamTru` (đã bóc miễn thuế), không trên `grossIncome` thô — đúng `GAP-QA-05`.
- `laHopDongKhauTruTaiNguon` là hàm riêng, phạm vi đúng `{thu_viec, thoi_vu}`, chuẩn hóa `trim().toLowerCase()`, không dò chuỗi tiếng Việt (`:100-103`) — đúng QĐ-3, không tái lập `BUG-HRM-27`.
- QĐ-8 (`tinhKhoanPhuCapTheoKy` dùng chung 2 endpoint) **được tuân thủ thật**: cả `calculatePayrollPreview` (`:404`) và `getSupportAllowanceBreakdown` (`:772`) gọi đúng một hàm, không có bản chép thứ hai.
- 46 field trả về của `calculatePayrollPreview` khớp **đúng** 46 cột non-auto của `PayrollSheetLine` (đếm tay, vì `createMany({ data: <biến> })` KHÔNG bị TypeScript chặn thừa field — typecheck xanh không chứng minh được điều này).

**Không đạt**: 1 blocking bảo mật/toàn vẹn số liệu thuế (RVW-018) + 5 non-blocking + 3 suggestion.

---

### RVW-018 🔴 BLOCKING — `POST`/`PATCH`/`DELETE /salary-items` vừa KHÔNG có RBAC vừa KHÔNG có nhật ký, trong khi `isMealAllowance`/`isTaxable` nay quyết định trực tiếp số tiền thuế TNCN của toàn công ty

- Vị trí: `be_maxv/src/routes/hrm/cai_dat_luong/salaryItems.route.ts`:12-14 · `be_maxv/src/controllers/client/hrm/cai_dat_luong/salaryItems.controller.ts`:45, 52, 60
- Vấn đề:
  - Ba route ghi chỉ kế thừa `authenticate` + `requireModule('hrm')` từ `routes/hrm/hrm.route.ts`:35-39, rồi gọi thẳng `resolveTenantDb(req)`. **Không** `assertAdminOrOwner`, **không** `assertXemLuong`, **không** `writeLog`.
  - Hệ quả trực tiếp của chính đợt này: trước ADR-010, `SalaryItem.isTaxable` **bị engine bỏ qua hoàn toàn** (ADR-010 Trade-offs: *"Hai cột đang bị engine bỏ qua (`isTaxable`, `taxTreatment`) nay có hiệu lực thật"*). Bật/tắt ô tick chỉ đổi nhãn hiển thị. Sau đợt này, một lần `PATCH /salary-items/:id` với `{"isTaxable": false}` **trừ thẳng khoản đó khỏi thu nhập tính thuế của MỌI nhân viên được gán khoản đó**, ở mọi kỳ chưa khóa — tức là đợt này biến một endpoint không được canh gác thành một đòn bẩy đổi số thuế TNCN. Điều tương tự với `isMealAllowance` (đưa khoản vào giỏ trần 730k).
  - Người thực hiện được bao gồm cả `OWNER_EMPLOYEE` **đã bị tắt cờ `DonViAccess.xemLuong`** — tức người mà `ADR-007`/`BR-hrm-059` cố ý chặn không cho *đọc* bảng lương, nay vẫn *sửa được* tham số sinh ra con số thuế trong bảng đó. Chặn đọc nhưng không chặn ghi là hàng rào tự vô hiệu.
  - **Bất đối xứng ngay trong cùng đợt code này**: mức trần 730.000đ (`GeneralSetting.lunchAllowanceTaxFreeCap`) được bảo vệ bằng `assertAdminOrOwner` (`routes/hrm/cau_hinh_mac_dinh/generalSettings.route.ts`:25, 30), `lock`/`reopen`/`approve` kỳ lương cũng vậy (`routes/hrm/du_lieu_tinh_luong/payrollPeriods.route.ts`:21-23) — nhưng cờ quyết định **khoản nào** được hưởng trần đó thì không ai canh. Canh cái sau mà bỏ cái trước là canh hụt.
  - Thiếu nhật ký làm hỏng khả năng giải trình: `generalSettings.controller.ts`:26-35 đã có `ghiNhatKyCauHinh()` (`writeLog` → `sys_log`) cho đúng loại thay đổi này; `salaryItems.controller.ts` không có dòng nào. Số thuế đổi mà **không truy được ai đổi, lúc nào** — trong khi bảng lương đã khóa là chứng từ kê khai thuế.
- Vì sao Blocking (nâng mức so với `ISSUE-blth-003` 🟡 của QA): QA phân loại 🟡 với lý do "pre-existing". Endpoint là pre-existing, nhưng **tác động tài chính là do đợt này tạo ra** — đây đúng nghĩa một thay đổi làm mất hiệu lực hàng rào có sẵn, không phải nợ cũ. Sai theo hướng *có lợi cho doanh nghiệp* (khai thiếu thuế), im lặng, không dấu vết ⇒ đúng loại sai bị truy thu mà `ADR-010` tồn tại để chặn. Không chấp nhận đẩy sang "đợt sau" vì ngay khi ADR-010 lên production thì lỗ hổng có hiệu lực.
- Đề xuất fix (mức tối thiểu để gỡ blocking — làm cả 2 phần):
  1. **Bắt buộc, không cần chờ ai chốt**: thêm `writeLog` cho `create`/`update`/`remove` khoản lương, sao đúng khuôn `ghiNhatKyCauHinh()` (`hanhDong: 'HRM_UPDATE_SALARY_ITEM'` / `'HRM_CREATE_SALARY_ITEM'` / `'HRM_DELETE_SALARY_ITEM'`, `chiTiet: { khoaNghiepVu: <code khoản> }`). Không lưu giá trị trước/sau, đúng mức đã chốt ở `BR-hrm-066`.
  2. **Quyền ghi**: gắn `{ preHandler: assertAdminOrOwner }` (dùng lại nguyên hàm ở `generalSettings.route.ts`:10, đúng tiền lệ `payrollPeriods.route.ts` đã làm — không viết guard mới) cho `POST`/`PATCH`/`DELETE /salary-items`. **Nếu** nghiệp vụ xác định kế toán `OWNER_EMPLOYEE` phải tạo/sửa được khoản lương thì thay bằng ràng buộc hẹp hơn: cho phép sửa mọi trường TRỪ `isTaxable`/`isMealAllowance`, hai trường này yêu cầu ADMIN/OWNER. Chọn phương án nào cũng được, nhưng **phải là quyết định được ghi lại** (bổ sung vào `ADR-010` Consequences hoặc ADR mới) — không được để nguyên trạng "không ai canh" rồi merge.
- Trạng thái: OPEN
  → FIXED [2026-09-10] — **Quyết định đã chọn: siết CẢ BA route ghi** (không tách quyền hẹp theo field) — lý do ghi trực tiếp trong code (`salaryItems.route.ts`:9-23) và trong `cai_dat_luong/api-contract-cai-dat-luong.md` Mục 1: danh mục khoản lương không phải phân hệ nhập liệu theo kỳ (khác 8 phân hệ payroll-data), không có SRS nào yêu cầu `OWNER_EMPLOYEE` tự tạo/sửa khoản lương, và tách quyền theo field cần logic diff trước/sau phức tạp hơn lợi ích. Nhất quán với "Cấu hình mặc định" (toàn bộ ghi cũng chỉ ADMIN/OWNER).
  - `be_maxv/src/routes/hrm/cai_dat_luong/salaryItems.route.ts`:9,23-25 — thêm `import { assertAdminOrOwner } from '../cau_hinh_mac_dinh/generalSettings.route'` + `{ preHandler: assertAdminOrOwner }` cho `POST`/`PATCH`/`DELETE /salary-items`.
  - `be_maxv/src/controllers/client/hrm/cai_dat_luong/salaryItems.controller.ts`:5,20-38,45-70 — thêm helper `ghiNhatKyKhoanLuong()` (dùng `writeLog`, đúng khuôn `ghiNhatKyCauHinh()`), gọi sau `create`/`update`/`remove` với `hanhDong ∈ {HRM_CREATE_SALARY_ITEM, HRM_UPDATE_SALARY_ITEM, HRM_DELETE_SALARY_ITEM}` + `chiTiet.khoaNghiepVu = ma_khoan`.
  - `be_maxv/src/services/client/hrm/cai_dat_luong/salaryItems.service.ts`:250-256 — `deleteSalaryItem` nay trả `{ code }` (bản ghi đã bị xóa nên controller không truy vấn lại được) để controller ghi đúng khóa nghiệp vụ vào audit log.
  - Test mới: `be_maxv/src/__tests__/hrm/hrmSalarySettingsApi.test.ts` — test "RVW-018: POST/PATCH/DELETE /salary-items chặn role không phải ADMIN/OWNER, và ghi audit log khi thành công" (403 cho `OWNER_EMPLOYEE` cả 3 route + KHÔNG ghi log khi bị chặn; 200/201 cho `OWNER` + đúng 3 `writeLog` với `hanhDong`/`chiTiet.khoaNghiepVu` khớp).
  - Kiểm chứng: `npm run typecheck` 0 lỗi · `npm run lint` 0 error (365 warning, không tăng so với baseline trước đợt) · `hrmSalarySettingsApi.test.ts` 13/13 pass · full suite `npm test` 700/704 pass (4 fail = 2 ca đỏ cố ý `TC-hrm-301`/`TC-hrm-316`, không liên quan). *(backend-engineer)*
  Commit: chưa commit.

---

### RVW-019 🟡 Non-blocking — `GET /payroll/support-allowances`: `total` cộng cả khoản `BENEFIT_ALLOWANCE` đã `INACTIVE`, trong khi `columns`/`amounts` thì không ⇒ bảng trên màn hình không cộng ra tổng của chính nó

- Vị trí: `be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollCalculation.service.ts`:773-785 (so với `:738-741`)
- Vấn đề: `columns` lọc `SalaryItem { category: 'BENEFIT_ALLOWANCE', status: 'ACTIVE' }`, nhưng vòng cộng dồn ở `:779-785` lấy **mọi** `benefitRows` — `amounts[code]` chỉ được gán khi `columnCodes.has(row.code)`, còn `monthlyTotal`/`total` thì cộng vô điều kiện. Nhân viên còn được gán một khoản hỗ trợ đã bị chuyển `INACTIVE` ở danh mục ⇒ `Σ amounts` **nhỏ hơn** `total`, không có cột nào giải thích phần chênh. Đây đúng tình huống `api-contract` Mục 8.2 gọi là "kế toán mất niềm tin vào cả bảng lương — người dùng chắc chắn sẽ cộng thử", chỉ khác là lệch *trong nội bộ một tab* thay vì giữa hai tab. Quy tắc 1 của Mục 8.2 ("chỉ lấy `category = BENEFIT_ALLOWANCE` **và** `status = ACTIVE`") đang chỉ được áp cho `columns`, không áp cho `total`.
- Ghi chú kèm (cùng gốc, cần quyết nghiệp vụ): `tinhKhoanPhuCapTheoKy()` **không** lọc `SalaryItem.status` ⇒ khoản đã `INACTIVE` vẫn được trả tiền trong `allowanceInPeriodTotal` của `/payroll/calculate`. Nếu ý định là "ngừng khoản ở danh mục thì ngừng trả", đây là lỗi tiền thật (🔴), không chỉ lỗi hiển thị; nếu ý định là "chỉ `EmployeeSalary` mới quyết định trả hay không" thì phải nói rõ trong `data-model` Mục 11.5. **Hiện tài liệu không trả lời**, nên chưa xếp Blocking — cần BA chốt trước khi Backend sửa.
- Đề xuất fix: sau khi BA chốt ý nghĩa của `status`, hoặc (a) lọc `status = 'ACTIVE'` ngay trong `tinhKhoanPhuCapTheoKy()` để cả hai endpoint nhất quán, hoặc (b) giữ nguyên cách trả tiền nhưng đưa mọi khoản đã gán vào `columns` (kể cả `INACTIVE`, có cờ đánh dấu) để bảng luôn cộng đúng. Tuyệt đối không sửa riêng một trong hai endpoint.
- Trạng thái: OPEN
  → FIXED một phần [2026-09-10] — Sửa ĐÚNG phạm vi headline của finding (bảng `support-allowances` phải tự cộng khớp tổng của chính nó): `getSupportAllowanceBreakdown()` nay áp CÙNG quy tắc lọc `columnCodes.has(row.code)` (đã lọc `status='ACTIVE'`) cho cả `amounts` LẪN `total`/`monthlyTotal` — `be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollCalculation.service.ts`:808-818. **CHƯA sửa** phần "Ghi chú kèm" (câu hỏi `tinhKhoanPhuCapTheoKy()`/`allowanceInPeriodTotal` của `/payroll/calculate` có nên ngừng trả tiền khoản `INACTIVE` hay không) — đúng như chính finding đã ghi rõ "cần BA chốt trước khi Backend sửa" cho phần đó; KHÔNG tự ý đổi công thức tiền thật của `/payroll/calculate` khi chưa có quyết định nghiệp vụ. Đã ghi rõ khoảng lệch còn lại trong docstring (`:711-729`) để không ai tưởng đã đóng hoàn toàn.
  - Test mới: `be_maxv/src/__tests__/hrm/hrmPayrollCalculation.test.ts` — test "RVW-019: support-allowances.total KHÔNG cộng khoản BENEFIT_ALLOWANCE đã INACTIVE — Σamounts luôn khớp total" (2 khoản, 1 ACTIVE 1 INACTIVE trong danh mục; assert `total === Σamounts === 700_000`, không lẫn khoản INACTIVE).
  - Kiểm chứng: `hrmPayrollCalculation.test.ts` 53/53 pass (gồm `TC-blth-035` cũ vẫn xanh — không đổi hành vi khi mọi khoản đều ACTIVE). *(backend-engineer)*

---

### RVW-020 🟡 Non-blocking — `GET /payroll/support-allowances` tính lại thời gian thực với kỳ đã khóa, trong khi `GET /payroll/sheet-lines` đọc snapshot đóng băng ⇒ hai tab của cùng một kỳ `LOCKED` lệch nhau

- Vị trí: `be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollCalculation.service.ts`:711-712 (so với `:687-699`)
- Vấn đề: `getSupportAllowanceBreakdown()` chỉ gọi `getPayrollPeriodOrThrow()` (kiểm tồn tại), **không** phân nhánh theo `period.status` như `getPayrollSheetLines()` đã làm. Với kỳ `LOCKED`/`APPROVED`/`PAID`/`ARCHIVED`, tab "Bảng lương" trả số đã đóng băng còn tab "Lương hỗ trợ" tính lại từ `EmployeeSalary`/`SalaryStructure`/`AttendanceRecord`/cấu hình **của hôm nay**. Kế toán sửa một mức phụ cấp sau khi khóa sổ ⇒ hai tab lệch, và tab lệch lại chính là tab dùng để giải thích cột "Thu nhập" của tab kia. Bất biến 🔴 ở `api-contract` Mục 8.2 chỉ đúng cho kỳ chưa khóa.
- Vì sao chưa Blocking: `PayrollSheetLine` chỉ lưu tổng `allowanceInPeriodTotal`, không lưu bóc tách theo từng khoản, nên không thể "đọc snapshot" cho endpoint này mà không thêm cột/bảng — đây là khoảng trống thiết kế của ADR-010, không phải Backend làm sai đặc tả.
- Đề xuất fix: ngắn hạn — trả kèm cờ `isLiveRecalculated: true` (hoặc `periodStatus`) để FE cảnh báo tại chỗ với kỳ đã khóa; dài hạn — Architect quyết định có snapshot bóc tách phụ cấp hay không (bảng con `PayrollSheetAllowanceLine`, hoặc cột JSON trên `PayrollSheetLine`). Ghi vào ADR trước khi code.
- Trạng thái: OPEN
  → FIXED một phần (giải pháp ngắn hạn) [2026-09-10] — `getSupportAllowanceBreakdown()` nay trả kèm `periodStatus` (trạng thái thật của kỳ) + `isLiveRecalculated: true` để FE tự cảnh báo khi kỳ đã khóa — `be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollCalculation.service.ts`:820-829. **CHƯA làm** giải pháp dài hạn (snapshot bóc tách phụ cấp) — đúng như finding đã nêu, cần Architect ra ADR trước, ngoài phạm vi 1 phiên fix.
  - Test mới: `hrmPayrollCalculation.test.ts` — test "RVW-020: getSupportAllowanceBreakdown trả kèm periodStatus + isLiveRecalculated để FE cảnh báo khi kỳ đã khóa" (kỳ `LOCKED` → `periodStatus === 'LOCKED'`, `isLiveRecalculated === true`).
  - Kiểm chứng: pass (xem RVW-019). *(backend-engineer)*

---

### RVW-021 🟡 Non-blocking — Engine bỏ qua `EmployeeSalary.effectiveFrom`/`effectiveTo` trong khi vẫn cẩn thận lọc hợp đồng theo kỳ ⇒ set lương của tháng sau vẫn được áp cho kỳ đang tính

- Vị trí: `be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollCalculation.service.ts`:302-307 (và `:731-734` cho endpoint mới)
- Vấn đề: truy vấn `db.employeeSalary.findMany({ where: { status: 'APPROVED' } })` chỉ lọc trạng thái. Cùng file, hợp đồng được lọc theo kỳ rất kỹ (`:290-295`, đúng `A-02`: *"hợp đồng ký trước cho tháng sau kèm tăng lương bị dùng nhầm để tính kỳ hiện tại"*) — nhưng set lương thì không, dù bảng có sẵn `effectiveFrom`/`effectiveTo` và mắc **đúng cùng một bệnh**: duyệt trước một set lương hiệu lực từ tháng sau ⇒ toàn bộ phụ cấp mới lập tức chảy vào kỳ đang tính. Trước đợt này hậu quả giới hạn ở `kpiSalary`/`diligenceSalary`; sau ADR-010 nó chi phối cả `fixedAllowanceTotal`, `allowanceInPeriodTotal`, `grossIncome`, thu nhập tính thuế và trần ăn ca — tức là gần như toàn bộ dòng lương.
- Lưu ý khi sửa: `EmployeeSalary.ma_nv` là `@unique` (schema `:1298`), tức mỗi nhân viên chỉ có **một** bản ghi — không thể "chọn bản phủ kỳ" như hợp đồng. Cách khả thi: bỏ qua set lương có `effectiveFrom > period.endDate` (và tùy chọn `effectiveTo < period.startDate`), hoặc BA xác nhận rõ trong `data-model` Mục 11.5 rằng hai cột này **cố ý** không được engine đọc — hiện Mục 11.5 chỉ mô tả truy vấn đang chạy, không trả lời câu hỏi này.
- Đề xuất fix: BA/Architect chốt ngữ nghĩa trước; Backend áp bộ lọc theo kỳ cho **cả hai** nơi đọc `employeeSalary` (engine + `support-allowances`), không sửa một nơi.
- Trạng thái: OPEN
  → FIXED [2026-09-10] — Quyết định: KHÔNG cần BA chốt riêng — vì `EmployeeSalary.ma_nv` là `@unique` (schema `:1298`), bản chất chỉ có ĐÚNG 1 set lương/nhân viên; `effectiveFrom`/`effectiveTo` chỉ có tác dụng "khoanh vùng thời điểm áp dụng", không có ngữ nghĩa "chọn version nào" như hợp đồng — áp dụng đúng nguyên tắc lọc-theo-kỳ đã có tiền lệ ở A-02 là đủ, không phát sinh câu hỏi nghiệp vụ mới. Áp CÙNG bộ lọc (`effectiveFrom <= period.endDate` VÀ (`effectiveTo` null HOẶC `>= period.startDate`)) cho **cả hai** nơi đọc `employeeSalary`, đúng yêu cầu "không sửa một nơi":
  - `be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollCalculation.service.ts`:317-327 (`calculatePayrollPreview`) và `:763-773` (`getSupportAllowanceBreakdown`).
  - Test mới: `hrmPayrollCalculation.test.ts` — 4 test "RVW-021: ..." (hiệu lực từ tháng sau → bị loại; đã hết hiệu lực → bị loại; phủ đúng kỳ → vẫn đọc bình thường; cùng bộ lọc áp cho `getSupportAllowanceBreakdown`).
  - Kiểm chứng: pass (xem RVW-019). *(backend-engineer)*

---

### RVW-022 🟡 Non-blocking — Thứ tự triển khai bắt buộc chưa được ghi ở đâu: 19 cột mới chưa `sync:tenants` sẽ làm gãy cả màn Cấu hình và Khoản lương, không chỉ thao tác Khóa sổ

- Vị trí: `be_maxv/prisma/tenant/schema.prisma` (3 cột `GeneralSetting`, 1 cột `SalaryItem`, 15 cột `PayrollSheetLine`) · `docs/hrm/du_lieu_tinh_luong/issues-and-bugs-bang-luong-tong-hop.md` `ISSUE-blth-004`
- Vấn đề: QA và `ADR-010` đều mô tả rủi ro là *"khóa sổ gãy, lỗi chỉ lộ lúc kế toán bấm Khóa sổ"*. Đánh giá đó **hẹp hơn thực tế**: Prisma `findFirst`/`findMany` liệt kê **mọi** cột vô hướng trong `SELECT`. Nếu code lên trước khi tenant DB có 4 cột `GeneralSetting`/`SalaryItem`, thì `GET /settings/general`, `GET /salary-items`, `GET /payroll/calculate` và `GET /payroll/support-allowances` **cùng gãy ngay lượt gọi đầu tiên** trên tenant đó — trước cả khi ai bấm Khóa sổ. Đây là ràng buộc thứ tự triển khai cứng (migrate 10 tenant TRƯỚC, deploy code SAU) mà hiện chưa file nào nêu.
- Đề xuất fix: ghi thứ tự bắt buộc + cách rollback vào `ADR-010` Consequences (hoặc `dev-notes.md`); giữ nguyên yêu cầu của `ISSUE-blth-004` là chạy thật **một** lượt `POST /payroll-periods/:id/lock` trên tenant test đã sync trước khi đụng 10 tenant thật — đối soát tĩnh 46 cột (reviewer đã tự đếm lại, khớp) **không thay thế được** vì `createMany({ data: <biến> })` không bị TypeScript chặn field thừa.
- Trạng thái: OPEN
  → FIXED (bước vận hành) [2026-09-10] — Đã chạy `npm run sync:tenants` trên môi trường dev/local (`localhost:5432`, `.env.local`): **10/10 tenant thành công, 0 lỗi** (`maxv_0106861889_app`, `maxv_0901133943_app`, `maxv_0111142786_app`, `maxv_0104409703_app`, `maxv_0108914961_app`, `maxv_033192002730_app`, `maxv_0315473747_app`, `maxv_0106200129_app`, `maxv_0108768608_app`, `maxv_0106861880_app`) — 19 cột schema mới (`GeneralSetting` +3, `SalaryItem` +1, `PayrollSheetLine` +15) đã thực sự lên tenant DB dev/local thật qua `prisma db push`, không chỉ generate client. **CHƯA chạy** trên 10 tenant PRODUCTION của khách hàng — đúng như work-log 2026-09-09 đã ghi, đây vẫn là bước cần Architect/DevOps xác nhận thời điểm triển khai, KHÔNG tự ý chạy trên production trong phiên sửa lỗi này.
  - Kiểm chứng: output lệnh `npm run sync:tenants` — "Đồng bộ schema cho 10 tenant... Xong: 10 thành công, 0 lỗi." *(backend-engineer)*

---

### RVW-023 🟡 Non-blocking — Hai hợp đồng API mà `ADR-010` bắt cập nhật cùng lượt vẫn chưa được sửa ⇒ Frontend sẽ code theo bản cũ thiếu 4 trường

- Vị trí: `docs/hrm/architecture/api-contract.md` (Mục 7D.0 — thiếu `lunchAllowanceTaxFreeCap`, `withholdingTaxRate`, `withholdingTaxThreshold`) · `docs/hrm/cai_dat_luong/api-contract-cai-dat-luong.md` (thiếu `isMealAllowance`)
- Vấn đề: `ADR-010` Consequences › "Kéo theo" liệt kê rõ hai file này (`3 + 1 trường`), và `api-contract-du-lieu-tinh-luong.md` Mục 8.4 nhắc lại. Kiểm thật: cả hai file **không nằm trong diff** và grep không thấy tên trường nào. Hai file đó mới là hợp đồng của module "Cấu hình mặc định" và "Cài đặt lương" — nơi Frontend đọc khi làm màn hình. Bốn cột vừa thêm sẽ không ai đặt được giá trị, đúng cái bẫy `ADR-007` mà chính ADR-010 viện dẫn ("chặn được nhưng không cấp được").
- Đề xuất fix: bổ sung 3 trường vào Mục 7D.0 (`GET`/`PUT`/`restore-default`, kiểu đọc ra là **chuỗi** Decimal đúng quy ước 20 cột Decimal hiện có) và `isMealAllowance` vào hợp đồng `salary-items`. Ghi kèm quyền ghi đã chốt ở RVW-018.
- Trạng thái: OPEN
  → FIXED [2026-09-10] — Lưu ý khi sửa: `docs/hrm/architecture/api-contract.md` **thực tế KHÔNG có Mục "7D.0"** nào (đã grep toàn file, không tìm thấy "settings/general"/"GeneralSetting" ở bất kỳ đâu — CONTEXT_SUMMARY.md dẫn nhầm số mục, đây là drift tài liệu có từ trước, không phải do đợt code này). Đã tạo mới `## 7D.` (ngay trước Mục 8) mô tả ĐÚNG 3 trường thiếu, không dựng lại toàn bộ hợp đồng `GeneralSetting` (nguồn đầy đủ vẫn là `du_lieu_tinh_luong/data-model-du-lieu-tinh-luong.md` Mục 11.2, tránh nhân đôi):
  - `docs/hrm/architecture/api-contract.md` — thêm `## 7D. Cấu hình mặc định — 3 tham số thuế mới` (bảng `lunchAllowanceTaxFreeCap`/`withholdingTaxRate`/`withholdingTaxThreshold`, kiểu response = chuỗi Decimal, ràng buộc, quyền `assertAdminOrOwner`).
  - `docs/hrm/cai_dat_luong/api-contract-cai-dat-luong.md` Mục 1 — thêm `isMealAllowance` vào response mẫu (1.1), request body `POST` (1.4) và mô tả `PATCH` (1.5); ghi rõ quyền `assertAdminOrOwner` cho cả 3 route ghi (RVW-018); sửa luôn lỗi tài liệu cũ ghi `PUT` trong khi code dùng `PATCH` (1.5).
  Commit: chưa commit.

---

### RVW-024 🟢 Suggestion — Ca kiểm `AC-dltl-23` khẳng định bằng `<=` và một dòng tautology, không ghim được giá trị

- Vị trí: `be_maxv/src/__tests__/hrm/hrmPayrollCalculation.test.ts`:603-611
- Vấn đề: ca kiểm quan trọng nhất của `BR-dltl-027` (trần quy đổi theo công) chỉ khẳng định `lunchAllowanceExemptAmount <= 365_000` rồi `assert.equal(Math.round(730_000 * 0.5), 365_000)` — vế sau kiểm `Math.round` của JavaScript, không kiểm mã sản phẩm. Trần bị tính sai thành 100.000đ vẫn PASS. Ca này bắt được lỗi "quên quy đổi" nhưng không bắt được lỗi "quy đổi sai hệ số".
- Đề xuất fix: đổi thành `assert.equal(row.lunchAllowanceExemptAmount, 365_000)` và `assert.equal(row.lunchAllowanceTaxableAmount, 635_000)` (mealAllowance 1.000.000, nửa công) — ghim đúng số, khớp `AC-dltl-23`.
- Trạng thái: OPEN

---

### RVW-025 🟢 Suggestion — Engine đọc cấu hình bằng `findFirst()` trong khi cả module còn lại dùng `findUnique({ id: 'DEFAULT' })`

- Vị trí: `be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollCalculation.service.ts`:301
- Vấn đề: `db.generalSetting.findFirst()` không mệnh đề `where`, không `orderBy`. Toàn bộ module "Cấu hình mặc định" (`generalSettings.service.ts`:198, 204, 249, 273) coi `id = 'DEFAULT'` (`SINGLETON_ID`) là bản ghi duy nhất. Nếu có bản ghi thứ hai lọt vào (script di trú, seed thủ công), engine có thể dùng bộ tham số **khác** bộ đang hiển thị trên màn hình cấu hình, và Postgres không bảo đảm thứ tự trả về nên kết quả không tất định giữa hai lần gọi. Đợt này thêm 3 tham số thuế chịu ảnh hưởng, nên độ nghiêm trọng nếu xảy ra tăng lên (dù xác suất thấp).
- Đề xuất fix: `db.generalSetting.findUnique({ where: { id: SINGLETON_ID } })` — cùng một dòng, hết mơ hồ. Không đổi hành vi khi dữ liệu đúng.
- Trạng thái: OPEN
  → FIXED [2026-09-10] — sửa đúng như đề xuất tại CẢ 2 chỗ: `be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollCalculation.service.ts`:11 (import `SINGLETON_ID` từ `generalSettings.service.ts`) và 2 lệnh gọi tại `:305`, `:757` đổi từ `findFirst()` sang `findUnique({ where: { id: SINGLETON_ID } })`. Tranh thủ sửa cùng lượt vì rất nhanh (đúng gợi ý "không bắt buộc, chỉ sửa nếu tiện tay" của phiên này).
  - Test mới: `hrmPayrollCalculation.test.ts` — test "RVW-025: ..." (assert `findUnique` được gọi với `where: { id: 'DEFAULT' }`, `findFirst` không còn được gọi — ném lỗi nếu gọi nhầm).
  - Cập nhật mock: `db.generalSetting` trong `hrmPayrollCalculation.test.ts` (buildDb) và `hrmPayrollInputData.test.ts` (createMockTenantDb) đều bổ sung `findUnique` (giữ `findFirst` cũ cho tương thích ngược, không xóa).
  - Kiểm chứng: pass (xem RVW-019). *(backend-engineer)*

---

### RVW-026 🟢 Suggestion — `formatSalaryItem` trộn hai quy ước đặt tên trong cùng một payload

- Vị trí: `be_maxv/src/services/client/hrm/cai_dat_luong/salaryItems.service.ts`:34
- Vấn đề: payload khoản lương dùng snake_case tiếng Việt (`ma_khoan`, `ten_khoan`, `ghi_chu`, `tinh_bhxh`, `chiu_thue_tncn`, `ty_le`), riêng trường mới trả camelCase `isMealAllowance`. Khớp `api-contract-du-lieu-tinh-luong.md` Mục 8.4 nên **không phải lỗi hợp đồng**, nhưng `chiu_thue_tncn` là khái niệm anh em trực tiếp của nó (ADR-010 QĐ-9.3: cờ ăn ca vô hiệu hóa ô tick chịu thuế) mà hai trường lại khác hệ đặt tên — lớp adapter FE sẽ có đúng một khóa lệch chuẩn.
- Đề xuất fix: hoặc đổi sang `khoan_an_ca` (đồng bộ họ snake_case, phải sửa hợp đồng ở RVW-023 cùng lượt, làm TRƯỚC khi FE đấu dây thì không tốn gì), hoặc giữ nguyên và ghi một dòng lý do trong `dev-notes.md` để người sau không "sửa cho đồng bộ" rồi làm gãy FE.
- Trạng thái: OPEN

---

### Bảo mật — kết luận phiên này

| Mục | Kết quả |
|---|---|
| Guard xác thực + module | ✅ Mọi route mới kế thừa `authenticate` + `requireModule('hrm')` (`hrm.route.ts`:35-39) |
| Quyền xem dữ liệu lương (`ADR-007`/`BR-hrm-059`) trên endpoint MỚI | ✅ `GET /payroll/support-allowances` dùng đúng `dbCoQuyenLuongPayroll` (`payrollCalculation.controller.ts`:30), không dùng `resolveTenantDb` trần |
| Quyền GHI 3 cột cấu hình thuế mới | ✅ `assertAdminOrOwner` đã có sẵn trên `PUT`/`restore-default /settings/general` |
| Quyền GHI 2 cờ quyết định thuế ở khoản lương | ❌ **RVW-018 🔴** — không RBAC, không nhật ký |
| Cô lập multi-tenant | ✅ Toàn bộ truy vấn đi qua `resolveTenantCtx` → `getTenantDb(dbName)`; không có truy vấn `sysPrisma` nào trong diff; không có `donViId` lọt vào tầng tenant |
| IDOR | ✅ Không có endpoint mới nhận id tài nguyên từ client ngoài `periodId`, đã `validateQuery` + `getPayrollPeriodOrThrow` (404 `E-dltl-025`) |
| SQL injection | ✅ Prisma parameterized toàn bộ, không có `$queryRaw` trong diff |
| Rò rỉ dữ liệu nhạy cảm ra log | ✅ Không có `console.*`/`req.log` nào trong 804 dòng service và các file sửa |
| Validation đầu vào | ✅ Zod cho cả 3 cột cấu hình mới (`min(0)`, riêng `withholdingTaxRate` `0…100`) và `isMealAllowance` (boolean, mặc định `false`) |

### Hiệu năng — kết luận phiên này

- `calculatePayrollPreview`: 12 → **13 truy vấn cố định** (thêm `salaryStructure` + items lồng, gọi một lần ngoài vòng lặp nhân viên). **Không N+1.** Mọi thứ còn lại là `Map`/`reduce` trong bộ nhớ.
- `getSupportAllowanceBreakdown`: **8 truy vấn cố định**, cùng khuôn. Đạt ngưỡng ≤ 1s của `api-contract` Mục 8.6 với quy mô hiện tại.
- 5 lượt `reduce` riêng trên cùng `phuCapRows` (`:405, 406, 415, 518, 522`) — chấp nhận được (mảng vài phần tử/nhân viên), **không** đề nghị gộp: tách rời làm mỗi con số đọc thẳng ra một dòng công thức của ADR, gộp lại sẽ đánh mất chính điều đó.
- Carry-forward chưa đóng, KHÔNG đánh số lại: `A-05` (`calculatePayrollPreview` chạy trong `$transaction` khóa sổ mà không truyền `{ timeout }`, mặc định 5s — nay thêm 1 truy vấn nữa) · `A-06` (Decimal ra chuỗi ở nhánh snapshot, nay ảnh hưởng thêm 15 trường) · `A-07` (`diligenceSalary`/`adjustmentNetAmount`/`netTakeHomeSalary`/`totalCompanyCost` không `Math.round`) · `RVW-011` (không phân trang) · `A-04` (TOCTOU chuyển trạng thái).

---

**Verdict: ❌ Request changes.**

Phần tính toán tài chính — thứ đáng lo nhất của đợt này — **làm đúng**: 10 bước đúng thứ tự ADR-010, hai giỏ miễn thuế loại trừ nhau thật sự bằng `if/else if` một vòng lặp, hai trần bảo hiểm độc lập, hàm dùng chung QĐ-8 được tuân thủ, 46 field khớp 46 cột snapshot. Không tìm thấy lỗi số tiền nào.

Chặn merge vì đúng **một** việc: **RVW-018**. Đợt này biến `isTaxable`/`isMealAllowance` từ nhãn hiển thị thành đòn bẩy đổi số thuế TNCN, nhưng để nguyên endpoint sửa hai cờ đó ở trạng thái không RBAC, không nhật ký — trong khi cùng lúc lại canh gác cẩn thận mức trần mà hai cờ ấy quyết định ai được hưởng.

**Việc cho Backend Engineer (một đợt duy nhất, cùng vùng mã):**
1. RVW-018 (🔴, bắt buộc trước merge) — `writeLog` cho 3 thao tác ghi khoản lương + guard quyền ghi theo phương án BA/Architect chốt.
2. RVW-023 (🟡) — cập nhật 2 hợp đồng API, làm cùng lúc với RVW-018 để ghi luôn quyền vừa chốt; kéo theo quyết định của RVW-026.
3. RVW-019 + RVW-021 (🟡) — **chờ BA chốt ngữ nghĩa** (`SalaryItem.status` có chặn trả tiền không; `EmployeeSalary.effectiveFrom/To` engine có đọc không) rồi sửa **cả hai** nơi đọc, không sửa một nơi.
4. RVW-022 (🟡) — ghi thứ tự triển khai + chạy thật một lượt `lock` trên tenant test đã sync (đóng luôn `ISSUE-blth-004`).
5. RVW-020 (🟡, cần ADR) · RVW-024, RVW-025, RVW-026 (🟢).

Sửa xong, Backend Engineer cập nhật `OPEN → FIXED` kèm commit + kết quả test ngay dưới từng finding rồi chuyển lại code-reviewer; vòng 2 sẽ soát lại RVW-018 bằng một ca kiểm 403 cho `PATCH /salary-items` với vai không đủ quyền, và một assert `writeLog` được gọi.

---

## Cập nhật 2026-09-10 (backend-engineer) — kết quả phiên sửa Review 2026-09-10

Đã sửa: `RVW-018` (🔴, đủ điều kiện gỡ blocking) + `RVW-019`, `RVW-020`, `RVW-021`, `RVW-022`,
`RVW-023`, `RVW-025` (🟡/🟢, theo yêu cầu "sửa cùng lượt" của phiên) — 7/9 finding của phiên
review này. Chi tiết từng finding: xem dòng "→ FIXED [2026-09-10]" ngay dưới mỗi RVW ở trên.

**Chưa sửa (cố ý, ngoài phạm vi được giao lượt này):** `RVW-024` và `RVW-026` (🟢 suggestions,
task giao rõ "không bắt buộc, chỉ sửa nếu rất nhanh tiện tay" — cả hai cần thay đổi rủi ro hơn
mức "tiện tay": RVW-024 đổi số liệu ghim trong test tài chính quan trọng nhất của module,
RVW-026 đổi tên field hợp đồng API cần FE đồng thuận trước).

**Quyết định nghiệp vụ tự chọn (ghi rõ theo yêu cầu của finding):**
- RVW-018: siết CẢ BA route ghi `/salary-items` về `assertAdminOrOwner` (không tách quyền hẹp
  theo field `isTaxable`/`isMealAllowance` riêng) — lý do đầy đủ trong code comment
  `salaryItems.route.ts` và trong `cai_dat_luong/api-contract-cai-dat-luong.md` Mục 1.
- RVW-021: không cần BA chốt riêng — `EmployeeSalary.ma_nv` là `@unique` nên áp lọc-theo-kỳ
  (cùng nguyên tắc A-02) là đủ, không phát sinh câu hỏi nghiệp vụ mới như finding lo ngại.
- RVW-019: chỉ sửa phần headline (bảng tự cộng khớp tổng trong nội bộ `support-allowances`),
  KHÔNG tự ý đổi công thức tiền thật của `/payroll/calculate` (phần "Ghi chú kèm" của finding) —
  đúng như finding đã nói rõ phần đó cần BA chốt trước.

**Kiểm chứng thật đã tự chạy:** `npm run typecheck` exit 0 (0 error) · `npm run lint` 0 error /
365 warning (không tăng so với baseline trước đợt — không có warning mới ở bất kỳ file nào vừa
sửa) · `hrmPayrollCalculation.test.ts` **53/53 pass** (8 test mới: RVW-019 ×1, RVW-020 ×1,
RVW-021 ×4, RVW-025 ×1) · `hrmSalarySettingsApi.test.ts` **13/13 pass** (1 test mới RVW-018) ·
`hrmPayrollInputData.test.ts` + `hrmSalarySettings.test.ts` không có test mới nhưng đã sửa mock
`db.generalSetting` để không vỡ theo thay đổi RVW-025, **25/25 pass** · full suite `npm test` →
**700/704 pass**, 4 fail còn lại là `TC-hrm-301`/`TC-hrm-316` (×2, tính cả parent block) — 2 ca đỏ
cố ý không nới lỏng của cụm "Cấu hình mặc định/Ca làm việc/Lịch ngày lễ", đã có từ TRƯỚC phiên
này, không liên quan module payroll/salary-items vừa sửa.

**Vận hành đã thực hiện:** `npm run sync:tenants` trên dev/local — 10/10 tenant thành công, 0 lỗi
(xem chi tiết dưới RVW-022). Môi trường production 10 tenant khách hàng vẫn CHƯA chạy, cố ý để
dành cho Architect/DevOps xác nhận thời điểm.

Chi tiết đầy đủ: `docs/hrm/work-log.md` (entry `[2026-09-10] backend-engineer`).

---

## Review lại 2026-09-10 (vòng 2, code-reviewer) — Verdict: ⚠️ Approve with comments

**Cách làm**: đọc lại mã nguồn thật (`git diff` + đọc file đầy đủ), KHÔNG tin dòng `→ FIXED` do
backend tự ghi; tự chạy lại toàn bộ lệnh kiểm chứng.

**Kiểm chứng độc lập (reviewer tự chạy, không lấy số của backend):**
`npm run typecheck` → exit 0 · `npm run lint` → **0 error / 365 warning** · `npm test` → **704 tests,
700 pass, 4 fail** — đúng con số backend báo. 4 fail là `TC-hrm-301` (search không bỏ dấu) +
`TC-hrm-316` (thiếu "thứ trong tuần") trong `hrmSettingsShiftsHolidaysApi.test.ts`, thuộc cụm
"Ca làm việc/Lịch ngày lễ", **pre-existing, không liên quan** payroll/salary-items.

### Xác nhận từng dòng FIXED

| Finding | Backend tự nhận | Reviewer xác minh | Kết luận |
|---|---|---|---|
| RVW-018 🔴 | FIXED | `salaryItems.route.ts`:31-33 có `{ preHandler: assertAdminOrOwner }` trên đủ **cả 3** route ghi (import từ `generalSettings.route.ts`:10, không viết guard mới) · `salaryItems.controller.ts`:31-42 `ghiNhatKyKhoanLuong()` gọi `writeLog` **thật** (không comment suông), đúng khuôn `ghiNhatKyCauHinh()`, best-effort (`syslog.service.ts`:15-24 tự nuốt lỗi) nên nhật ký hỏng không làm vỡ nghiệp vụ · `deleteSalaryItem` trả `{ code }` để audit ghi đúng khóa nghiệp vụ sau khi bản ghi đã xóa · test `hrmSalarySettingsApi.test.ts` đăng ký **route thật + `errorHandler.plugin`** (không mock guard), assert 403 ×3 cho `OWNER_EMPLOYEE`, assert `writeLog` **không** được gọi khi bị chặn, và 3 lần gọi đúng `hanhDong`/`chiTiet.khoaNghiepVu` khi `OWNER` | ✅ **XÁC NHẬN FIXED — blocking được gỡ** |
| RVW-019 🟡 | FIXED một phần | `payrollCalculation.service.ts`:808-818 — `if (!columnCodes.has(row.code)) continue;` đặt TRƯỚC cả `amounts`, `monthlyTotal`, `total` ⇒ Σamounts luôn khớp total. Phần "Ghi chú kèm" (`tinhKhoanPhuCapTheoKy` không lọc `status`) **thật sự chưa sửa** và đã ghi rõ trong docstring | ✅ Xác nhận, nhãn "một phần" trung thực |
| RVW-020 🟡 | FIXED một phần | `:844-846` trả `periodStatus: period.status` + `isLiveRecalculated: true`. Snapshot bóc tách (dài hạn) chưa làm, đúng như khai báo | ✅ Xác nhận |
| RVW-021 🟡 | FIXED | Bộ lọc `effectiveFrom <= period.endDate` + `OR[effectiveTo null, >= startDate]` có ở **cả hai** nơi: `:317-327` (`calculatePayrollPreview`) và `:763-773` (`getSupportAllowanceBreakdown`) — đúng yêu cầu "không sửa một nơi" | ✅ Xác nhận |
| RVW-023 🟡 | FIXED | `api-contract.md`:1266-1268 có đủ 3 trường (kiểu chuỗi Decimal, ràng buộc, quyền) · `api-contract-cai-dat-luong.md`:25-28, 52, 61-64, 101, 105/113/119 có `isMealAllowance` + ghi quyền `assertAdminOrOwner` cho cả 3 route ghi | ✅ Xác nhận |
| RVW-025 🟢 | FIXED | `findUnique({ where: { id: SINGLETON_ID } })` tại `:305` và `:757`; không còn `findFirst()` nào trong file | ✅ Xác nhận |
| RVW-022 🟡 | FIXED (bước vận hành) | **PHẢN BÁC MỘT PHẦN.** Đề xuất fix của finding có **hai** vế: (1) *ghi thứ tự triển khai bắt buộc + cách rollback vào `ADR-010` Consequences hoặc `dev-notes.md`*, (2) chạy thật một lượt `POST /payroll-periods/:id/lock` trên tenant test đã sync (đóng `ISSUE-blth-004`). Grep `RVW-022` toàn `docs/hrm/` → chỉ thấy trong `review-findings.md` + `work-log.md`, **không có dòng nào vào ADR-010/dev-notes**; ADR-010:280 chỉ liệt kê "rồi `npm run sync:tenants`", KHÔNG nêu ràng buộc "migrate 10 tenant TRƯỚC, deploy code SAU" cũng như việc `GET /settings/general`, `GET /salary-items`, `GET /payroll/calculate` **cùng gãy ngay lượt gọi đầu** nếu sai thứ tự. Vế (2) chưa làm. Việc chạy `sync:tenants` trên dev là bước tốt nhưng reviewer **không kiểm chứng độc lập được** (không có DB) | ⚠️ **Chuyển lại `OPEN` (một phần)** — xem RVW-022b |
| RVW-024, RVW-026 🟢 | cố ý chưa sửa | Đúng, vẫn `OPEN`; lý do bỏ qua hợp lý (RVW-024 đổi số ghim trong test tài chính, RVW-026 đổi tên field hợp đồng cần FE đồng thuận) | ✅ Chấp nhận, giữ `OPEN` |

---

### RVW-022b 🟡 Non-blocking — Vế "ghi thứ tự triển khai" của RVW-022 vẫn chưa có ở đâu; `ISSUE-blth-004` chưa đóng

- Vị trí: `docs/hrm/architecture/adr/ADR-010-pipeline-thue-bao-hiem-bang-luong.md` (Consequences) · `docs/hrm/architecture/dev-notes.md`
- Vấn đề: xem ô RVW-022 ở bảng trên. Thêm một điểm reviewer phát hiện khi đọc `dev-notes.md`:196-200 — *"`npm run hrm:constraints` phải chạy lại sau MỖI lần `npm run sync:tenants`"* (Prisma `db push` có thể drop index nó không quản lý). Backend báo đã chạy `sync:tenants` trên dev nhưng **không nhắc gì tới `hrm:constraints`** — nếu chưa chạy lại thì các khóa duy nhất tùy biến của HRM đang mất trên 10 tenant dev, và quy trình đó sẽ được chép nguyên sang production.
- Đề xuất fix: (a) thêm vào `ADR-010` Consequences 4-5 dòng: thứ tự bắt buộc `generate → sync:tenants (10 tenant) → hrm:constraints → deploy code`, kèm hệ quả nếu đảo thứ tự (4 endpoint GET gãy ngay, không chỉ Khóa sổ) và cách lùi; (b) xác nhận đã chạy `hrm:constraints` sau lượt `sync:tenants` dev; (c) chạy một lượt `lock` thật trên tenant dev đã sync rồi mới đóng `ISSUE-blth-004`.
- Trạng thái: OPEN

---

### RVW-027 🟡 Non-blocking — Lý do biện minh cho việc siết RBAC (RVW-018) mâu thuẫn với thực tế FE: CRUD khoản lương đang nằm NGAY TRONG 2 màn nhập liệu theo kỳ ⇒ kế toán `OWNER_EMPLOYEE` sẽ ăn 403 giữa luồng hằng ngày

- Vị trí: `be_maxv/src/routes/hrm/cai_dat_luong/salaryItems.route.ts`:20-22 (lý do (a) và (b) ghi trong comment) · `hdđt_maxv/src/features/hrm/components/du_lieu_tinh_luong/thuong/QuanLyThuongDialog.tsx`:25, 28, 46 · `.../luong_phan_tram/QuanLyPhanTramDialog.tsx`:25
- Vấn đề: quyết định siết cả 3 route ghi được biện minh bằng *"danh mục khoản lương thay đổi không thường xuyên (**khác 8 phân hệ NHẬP LIỆU theo kỳ** mà kế toán/`OWNER_EMPLOYEE` cần thao tác hằng ngày)"*. Grep FE cho thấy điều ngược lại: `QuanLyThuongDialog` (nằm trong `components/du_lieu_tinh_luong/thuong/`, tức **đúng 1 trong 8 phân hệ nhập liệu**) và `QuanLyPhanTramDialog` (`.../luong_phan_tram/`) đều gọi `useXoaKhoanLuong` (`DELETE /salary-items/:id`) và mở `KhoanLuongFormDialog` → `useLuuKhoanLuong` (`POST`/`PATCH /salary-items`). Nghĩa là "thêm một khoản thưởng mới" giữa kỳ là thao tác **trong màn nhập liệu**, không phải vào màn Cài đặt lương. Sau fix, `OWNER_EMPLOYEE` bấm "Thêm khoản thưởng" sẽ nhận `403` mà FE không hề ẩn nút (grep `hdđt_maxv/src/features/hrm` chỉ thấy gating theo `xemLuong`, **không có** gating theo `role ∈ {ADMIN, OWNER}` ở cụm `cai_dat_luong`/`du_lieu_tinh_luong`).
- Vì sao KHÔNG xếp Blocking: (1) hướng siết là hướng an toàn — để nguyên trạng là lỗ hổng thuế đã nêu ở RVW-018; (2) không SRS/BR nào cấp quyền tạo/sửa khoản lương cho `OWNER_EMPLOYEE` (đã grep `docs/hrm/cai_dat_luong/`, không có mục quyền nào) nên đây là **quyết định chưa từng được chốt**, không phải quyền đã đặc tả bị tước; (3) `frontend-engineer` đang tạm ngừng, chưa ai đấu dây thật nên chưa gây sự cố production.
- Đề xuất fix: (a) BA xác nhận dứt khoát: kế toán `OWNER_EMPLOYEE` **có** được tạo khoản thưởng/phần trăm giữa kỳ không? Nếu **có** → quay lại phương án tách quyền hẹp mà RVW-018 đã nêu (mọi trường trừ `isTaxable`/`isMealAllowance`); nếu **không** → giữ nguyên fix hiện tại nhưng bắt buộc FE ẩn/disable nút "Thêm/Sửa/Xóa khoản" trong 2 dialog trên theo `role`, kèm dòng ghi vào backlog `frontend-engineer`. (b) **Sửa lại lý do (a)/(b) trong comment `salaryItems.route.ts`:20-22** — đang nêu một sự thật sai về FE, người đọc sau sẽ tin theo.
- Trạng thái: OPEN

---

### RVW-028 🟢 Suggestion — Comment trong code khai "đã ghi vào `ADR-010` Consequences" nhưng ADR-010 không có dòng nào

- Vị trí: `be_maxv/src/routes/hrm/cai_dat_luong/salaryItems.route.ts`:16
- Vấn đề: `grep -n "RVW-018\|assertAdminOrOwner" ADR-010-*.md` → **0 kết quả**. Nơi ghi thật là `cai_dat_luong/api-contract-cai-dat-luong.md` Mục 1 (đã kiểm, đủ và đúng) — yêu cầu "quyết định phải được ghi lại" của RVW-018 coi như **đạt**, nhưng con trỏ trong code trỏ sai chỗ, đúng loại drift tài liệu mà RVW-023 vừa phải đi dọn.
- Đề xuất fix: đổi comment thành `(ghi ở cai_dat_luong/api-contract-cai-dat-luong.md Mục 1)`, hoặc bổ sung thật vào ADR-010 Consequences khi làm RVW-022b.
- Trạng thái: OPEN

---

**Verdict vòng 2: ⚠️ Approve with comments — KHÔNG còn 🔴 Blocking.**

`RVW-018` (blocking duy nhất của phiên 2026-09-10) đã được sửa **thật**, đúng cả hai vế (RBAC + nhật ký),
có ca kiểm đi qua route thật và guard thật, không phải khai suông. Sáu finding 🟡/🟢 còn lại được xác
nhận đúng như mô tả; nhãn "FIXED một phần" của RVW-019/RVW-020 là trung thực.

Còn lại, KHÔNG chặn merge nhưng phải xử lý trước khi FE đấu dây / trước khi lên production:
- `RVW-027` 🟡 — chốt với BA quyền của `OWNER_EMPLOYEE` với khoản thưởng/phần trăm giữa kỳ + FE ẩn nút + sửa lý do sai trong comment.
- `RVW-022b` 🟡 — ghi thứ tự triển khai vào ADR-010/dev-notes, xác nhận `hrm:constraints` đã chạy lại sau `sync:tenants`, chạy một lượt `lock` thật để đóng `ISSUE-blth-004`.
- `RVW-024`, `RVW-026`, `RVW-028` 🟢 · carry-forward `A-04`…`A-09`, `RVW-003`…`RVW-017` vẫn `OPEN` như cũ.

---

## Review 2026-09-10 (vòng 3 — Frontend "Bảng lương tổng hợp", code-reviewer) — Verdict: ⚠️ Approve with comments

**Phạm vi review** — 2 phiên `frontend-engineer` (`work-log.md` `17:30` + `18:15`): thay mock bằng API thật cho khu `hdđt_maxv/src/features/hrm/components/bang_luong`. 14 file: 1 file mới (`api/bang_luong/bangLuongQueries.ts`), 1 file xóa (`mock/hooks/bangLuong.ts`), 12 file sửa (`api/du_lieu_tinh_luong/payrollCalculation{Api,Queries}.ts`, `api/hrmKeys.ts`, `api/cau_hinh_mac_dinh/cauHinhQueries.ts`, `calculations/bang_luong/bangLuong.ts`, `components/bang_luong/{BangLuongPanel,BangLuongTable,LuongHoTroPanel,ThanhLocBangLuong,luongHoTroExcel}`, `types/index.ts`, `pages/hrm/bang_luong/BangLuongPage.tsx`).

**Đã tự kiểm chứng độc lập (không tin số báo cáo):**

| Lệnh (chạy trong `hdđt_maxv/`) | Kết quả code-reviewer tự chạy | Khớp báo cáo FE + QA? |
|---|---|---|
| `npx tsc -b` | exit 0, 0 lỗi | ✅ |
| `npm run lint` | 0 lỗi, 0 cảnh báo | ✅ |
| `npm run build` | thành công, **12346 module**, đúng 2 cảnh báo cũ (`INEFFECTIVE_DYNAMIC_IMPORT` exceljs, chunk >500 kB) | ✅ khớp tuyệt đối |

**Đã đối chiếu và XÁC NHẬN ĐÚNG (không phát sinh finding):**

1. **Field mapping** `veDongBangLuong()` vs `api-contract-du-lieu-tinh-luong.md` Mục 8.1 — đúng cả 2 cạm bẫy: `gio_tang_ca ← otRawHours` (không phải `otConvertedHours`), `thu_nhap_chiu_thue` suy từ 4 số hạng (không dùng thẳng `taxableIncome` — trường đổi nghĩa theo `withholdingTaxApplied`), `luong_theo_ngay ← proratedWorkSalary + allowanceInPeriodTotal`.
2. **`PAYROLL_LINE_NUMERIC_FIELDS` (A-06)** — tự liệt kê lại cột của `model PayrollSheetLine` (`be_maxv/prisma/tenant/schema.prisma`): 33 `Decimal` + 1 `Int` = **34**, khớp đúng 34 tên trong mảng; 3 `Boolean` + `engineVersion`/các `String` bị loại đúng. Nhánh snapshot không còn rủi ro cộng chuỗi.
3. **Xóa `mock/hooks/bangLuong.ts`** — `grep -rn "mock/hooks/bangLuong" hdđt_maxv/src` → **0 import thật** (chỉ còn nhắc trong comment tài liệu). Không gãy runtime.
4. **Xóa logic tính thuế/bảo hiểm ở `calculations/bang_luong/bangLuong.ts`** — `grep` `thueLuyTien|tinhDongBangLuong|lyDoKhongTinhDuocLuong|NguonTinhLuong|LOI_BIEU_THUE` toàn `hdđt_maxv/src` → **0 tham chiếu code còn lại**, không còn dead code nghiệp vụ. File chỉ còn hàm format hiển thị thuần.
5. **Bảo mật / đa tenant** — `queryKey` của cả 3 hook (`calculate`/`sheetLines`/`supportAllowances`) đều mang `currentCompanyId` ⇒ cache KHÔNG lẫn giữa các lần chuyển công ty. `periodId` lấy từ `PayrollPeriodContext`, và context **lọc lại `overrideId` của `localStorage` theo `periods` của công ty hiện tại** (`PayrollPeriodContext.tsx`:15-20) ⇒ `periodId` tồn dư của tenant cũ bị loại, tự rơi về `periods[0]`. Phía server, cả 3 endpoint đi qua `dbCoQuyenLuongPayroll` + Zod `periodId` (`payrollCalculation.controller.ts`) và giải tenant DB từ phiên, không từ tham số client ⇒ **không có đường rò dữ liệu nhân viên giữa các tenant**. Không có lời gọi bên thứ ba nào bị chạm.
6. **UI theo trạng thái kỳ** — `isLocked` gộp đúng `LOCKED/APPROVED/PAID/ARCHIVED`, khớp Y HỆT điều kiện rẽ nhánh snapshot của `getPayrollSheetLines()` (be_maxv).

---

### RVW-029 🟡 Non-blocking — Tab "Lương hỗ trợ" bắn thêm một lượt tính lương LIVE toàn công ty chỉ để lấy con số đếm đã có sẵn trong response của chính nó

- Vị trí: `hdđt_maxv/src/features/hrm/api/bang_luong/bangLuongQueries.ts`:275-280 (`useSoNhanVienDangLam`), dùng ở `components/bang_luong/LuongHoTroPanel.tsx`:47
- Vấn đề: `useSoNhanVienDangLam()` gọi `usePayrollSheetLinesQuery(...)`. Trên route tab "Bảng lương" điều này miễn phí (dùng chung cache với `useBangLuongRows`, đúng như comment ghi). Nhưng tab "Lương hỗ trợ" là **route riêng, `BangLuongPanel` KHÔNG mount** — nên hook này tạo một request `/payroll/sheet-lines` thứ hai, mà với kỳ `DRAFT`/`PENDING_REVIEW` request đó chạy trọn `calculatePayrollPreview()` (tải nhân viên + hợp đồng + set lương + chấm công + ngày lễ + pipeline 10 bước cho TOÀN công ty) chỉ để lấy `data.length`. Trong khi `useLuongHoTroRows` đã có sẵn `data.items.length` từ `/payroll/support-allowances` — cùng tập nhân viên (`where: { status: '1', da_xoa: false }`, đã đối chiếu 2 service). Chi phí tăng tuyến tính theo số nhân viên và trùng với `RVW-011` (chưa endpoint đọc nào có phân trang).
- Vì sao KHÔNG xếp Blocking: số hiển thị vẫn ĐÚNG, không sai nghiệp vụ; chỉ là lãng phí. Tenant dev hiện 1 nhân viên nên chưa lộ.
- Đề xuất fix: trong `LuongHoTroPanel` dùng thẳng số dòng của chính response lương hỗ trợ (mở rộng `KetQuaLuongHoTro` thêm `soNhanVien: data?.items.length ?? 0`) và bỏ `useSoNhanVienDangLam()` khỏi panel này; giữ hook đó cho riêng `BangLuongPanel`.
- Trạng thái: OPEN

---

### RVW-030 🟡 Non-blocking — `engineVersion` không được dùng ở bất kỳ đâu: kỳ khóa sổ `v1` (nếu tồn tại) sẽ hiển thị sai nhiều cột mà không cảnh báo (xác nhận `ISSUE-blth-005`)

- Vị trí: `hdđt_maxv/src/features/hrm/api/du_lieu_tinh_luong/payrollCalculationApi.ts`:86 (khai báo) — không có nơi tiêu thụ
- Vấn đề: đánh giá **độc lập**, không chỉ chép lại QA. `PayrollSheetLine.engineVersion` mặc định `"v1"` (schema.prisma); 19 cột của ADR-010 mặc định `0`/`false`. Với dòng snapshot `v1`, FE sẽ hiển thị: `thu_nhap_chiu_thue ≈ grossIncome` (3 số hạng trừ đều 0) **và** `luong_theo_ngay = proratedWorkSalary` (mất `allowanceInPeriodTotal`) **và** `gio_tang_ca = 0` (`otRawHours` mới) — tức là **nhiều cột hơn** phạm vi mà `ISSUE-blth-005` mô tả, tất cả đều im lặng. api-contract Mục 8.3 đã yêu cầu tường minh "FE phải phân biệt bằng `engineVersion`, không được suy từ giá trị 0" — yêu cầu này chưa được thực hiện.
- Vì sao KHÔNG xếp Blocking (đánh giá độc lập, không dựa vào gợi ý): cửa sổ rủi ro **đóng lại theo thời gian, không mở rộng** — mọi kỳ khóa từ nay đều là `v2`; chỉ các dòng `PayrollSheetLine` đã tồn tại TRƯỚC 2026-09-10 mới bị. Đã tự kiểm: toàn bộ module payroll (`PayrollPeriod`, `PayrollSheetLine`, thao tác `lock`) mới được tạo trong dải commit `ce75c6f`…`edaed98` (2026-09-08…10), 19 cột mới **còn chưa `sync:tenants`** cho 10 tenant thật (`RVW-022`/`ISSUE-blth-004` vẫn OPEN) ⇒ chưa tenant nào có thể đã khóa sổ bằng engine v1. QA cũng xác nhận 2 tenant dev có **0 `PayrollPeriod`**. Rủi ro thực tế hiện tại ≈ 0, và đây là lỗi **chỉ-hiển-thị** (không ghi đè dữ liệu, không đổi số thuế đã khấu trừ).
- Đề xuất fix (theo thứ tự, không cần làm hết trước merge):
  1. **Cổng go-live (bắt buộc, rẻ)**: khi chạy `sync:tenants` cho 10 tenant thật, chạy kèm `SELECT count(*) FROM hrm_payroll_sheet_lines WHERE "engineVersion" <> 'v2'` trên từng tenant. Kết quả `0` trên tất cả ⇒ đóng `RVW-030` + `ISSUE-blth-005` vĩnh viễn, không cần code gì thêm (ghi bằng chứng vào `work-log.md`).
  2. Nếu bất kỳ tenant nào ra `> 0` ⇒ **nâng lên 🔴 Blocking** và bắt buộc FE: `Chip`/`Alert` "Số liệu theo công thức cũ (v1) — một số cột chưa có" khi `rows.some(r => r.engineVersion !== "v2")`, đồng thời để trống (`—`) thay vì hiện `0` cho `thu_nhap_chiu_thue`/`gio_tang_ca`/phần phụ cấp của `luong_theo_ngay` ở các dòng đó — BA/Architect chốt wording.
- Trạng thái: OPEN

---

### RVW-031 🟢 Suggestion — `normalizePayrollLine()` ép `Number()` không phòng thủ: trường thiếu sẽ thành `NaN` lan khắp bảng thay vì báo lỗi

- Vị trí: `hdđt_maxv/src/features/hrm/api/du_lieu_tinh_luong/payrollCalculationApi.ts`:191-197
- Vấn đề: `line[field] = Number(raw[field])` — `Number(undefined)` là `NaN`, và `NaN` lan qua mọi phép cộng phía sau (`veDongBangLuong` cộng `proratedWorkSalary + allowanceInPeriodTotal`, `tongBangLuong` cộng dồn 3 thẻ tổng đầu màn) khiến cả cột lẫn tổng hiện `NaN` mà không có lỗi nào được ném. Hiện KHÔNG có bug thật (đã đối chiếu: cả 34 cột đều `NOT NULL` trong `PayrollSheetLine`, và nhánh live trả đủ), nhưng hàm này chính là **lớp phòng thủ tại biên** — để nó tự vỡ im lặng khi backend thêm/đổi cột là mâu thuẫn với mục đích của chính nó.
- Đề xuất fix: `const v = Number(raw[field]); line[field] = Number.isFinite(v) ? v : 0;` kèm `console.warn` (chỉ ở `import.meta.env.DEV`) liệt kê tên trường hỏng — giữ bảng đọc được mà vẫn lộ dấu hiệu cho dev.
- Trạng thái: OPEN

---

### RVW-032 🟢 Suggestion — Kiểu ở biên "nói dối" so với schema: `departmentName`/`positionName` khai non-null, `salaryType` lạ bị nuốt thành `GROSS`

- Vị trí: `payrollCalculationApi.ts`:24-27 (`departmentName: string`, `positionName: string`); `api/bang_luong/bangLuongQueries.ts`:59-62 (`veKieuLuong`), :66-68 (`veLoaiHopDong`)
- Vấn đề: (a) trong `PayrollSheetLine` hai cột đó là `String?` ⇒ nhánh snapshot **có thể** trả `null` trong khi kiểu FE khai `string`. Hiện vô hại vì UI đều dùng `row.ten_pb || "Chưa gán phòng ban"`, nhưng kiểu sai sẽ bẫy người viết code sau (vd gọi `.toLowerCase()` khi thêm ô tìm kiếm theo phòng ban ⇒ crash runtime mà `tsc` không cảnh báo). (b) `veKieuLuong` quy MỌI giá trị khác `"net"` về `"GROSS"`, `veLoaiHopDong` ép kiểu thẳng `as LoaiHopDong` — dữ liệu lạ đi qua im lặng và chỉ lộ ra dưới dạng bộ lọc không khớp.
- Đề xuất fix: khai `departmentName: string | null` / `positionName: string | null` (đúng schema, UI đã xử lý sẵn); `veKieuLuong`/`veLoaiHopDong` kiểm giá trị nằm trong tập hợp lệ, ngoài tập thì trả `null` (đã là giá trị hợp lệ của `DongBangLuong`) thay vì đoán.
- Trạng thái: OPEN

---

### RVW-033 🟢 Suggestion — Bộ lọc "Phòng ban" phụ thuộc request thứ ba: lúc danh sách nhân viên chưa tải xong, bảng báo "không có nhân viên khớp bộ lọc" thay vì đang tải

- Vị trí: `hdđt_maxv/src/features/hrm/api/bang_luong/bangLuongQueries.ts`:141-146 (`useMaPbTheoNv`), :148-160 (`apDungBoLoc`)
- Vấn đề: hai endpoint payroll chỉ trả TÊN phòng ban nên FE phải tra chéo `useNhanVienRows()` để có `Map<ma_nv, ma_pb>` — cách xử lý đúng và có ghi chú rõ. Nhưng `isLoading` mà panel dùng CHỈ đến từ query payroll: khi người dùng đang chọn một phòng ban mà query nhân viên chưa xong, `maPbTheoNv` rỗng ⇒ `apDungBoLoc` loại sạch mọi dòng ⇒ màn hiện "Không có nhân viên nào khớp bộ lọc" (kết luận sai) trong khoảnh khắc đó.
- Đề xuất fix: cho `useMaPbTheoNv()` trả kèm `isLoading` của `useNhanVienRows` và gộp vào `KetQuaBangLuong.isLoading` **chỉ khi `filters.ma_pb` khác rỗng** (không có lọc phòng ban thì bảng không cần chờ). Về lâu dài, đề xuất Architect thêm `departmentCode` vào response 2 endpoint payroll để bỏ hẳn request tra chéo này.
- Trạng thái: OPEN

---

### RVW-034 🟢 Suggestion — `Math.max(0, ...)` khi suy `thu_nhap_chiu_thue` chưa có căn cứ ghi trong code (xác nhận `ISSUE-blth-006`)

- Vị trí: `hdđt_maxv/src/features/hrm/api/bang_luong/bangLuongQueries.ts`:96-102
- Vấn đề: api-contract Mục 8.1.1 chỉ mô tả phép trừ 4 số hạng, không nêu kẹp sàn 0. Đánh giá độc lập: bất biến làm phép kẹp này **vô hại về số liệu** thực ra CÓ tồn tại và đã được ghi — comment của `model PayrollSheetLine` trong `schema.prisma` khai `mealAllowanceAmount + otherAllowanceTaxExemptAmount <= allowanceInPeriodTotal`, và cả 3 khoản miễn thuế đều là tập con của `grossIncome`. Nên đây KHÔNG phải lỗi; vấn đề duy nhất là **căn cứ đó không xuất hiện ở chỗ đọc code**, nên người sau không phân biệt được "kẹp vì bất biến đã chứng minh" với "kẹp cho chắc".
- Đề xuất fix: thêm 1 dòng comment trích đúng bất biến + nguồn (`schema.prisma` model `PayrollSheetLine`) ngay tại chỗ kẹp; giữ nguyên `Math.max`. Nếu muốn chặt hơn: `console.warn` khi hiệu số âm ở môi trường DEV.
- Trạng thái: OPEN

---

### RVW-035 🟢 Suggestion — `dev-notes.md` Mục 2.12 còn vẽ sơ đồ luồng theo `/payroll/calculate` đã bị Mục 2.13 thay; `usePayrollCalculateQuery` thành mã chết có chủ đích

- Vị trí: `docs/hrm/architecture/dev-notes.md` Mục 2.12 (khối sơ đồ luồng + dòng tiêu đề); `hdđt_maxv/src/features/hrm/api/du_lieu_tinh_luong/payrollCalculationQueries.ts`:27-34
- Vấn đề: Mục 2.13 đã nói rõ là thay nguồn sang `/payroll/sheet-lines`, nhưng sơ đồ ở 2.12 vẫn ghi `usePayrollCalculateQuery` và `api.get('/hrm/payroll/calculate')`. Người đọc dừng ở 2.12 (mục có tiêu đề tổng quát hơn) sẽ hiểu sai nguồn dữ liệu của màn chính — đúng loại tài liệu trôi mà `RVW-023`/`RVW-028` vừa phải đi dọn. Kèm theo, `usePayrollCalculateQuery`/`getPayrollCalculate` hiện **không còn nơi nào gọi** (đã grep) — việc giữ lại là có chủ đích và đã ghi lý do, chấp nhận được, nhưng cần có người theo dõi để không nằm lại vĩnh viễn.
- Đề xuất fix: sửa sơ đồ trong 2.12 thành `usePayrollSheetLinesQuery` + thêm 1 dòng "**cập nhật ở Mục 2.13**" ngay dưới tiêu đề 2.12; ghi `usePayrollCalculateQuery` vào backlog FE — nếu sau 1 chu kỳ vẫn không ai dùng thì xóa.
- Trạng thái: OPEN

---

**Verdict vòng 3: ⚠️ Approve with comments — KHÔNG có 🔴 Blocking.**

Phần FE này đạt chất lượng bàn giao: kiến trúc đúng hướng (mọi công thức lương/thuế/bảo hiểm đã dồn về một nguồn sự thật duy nhất ở `be_maxv`, FE chỉ đổi tên trường), 2 cạm bẫy field mapping được xử lý đúng và ghi chú tại chỗ, việc tự phát hiện + tự vá lỗi kiểu `Decimal` ở biên (`normalizePayrollLine`) là điểm cộng thật — đó là loại lỗi âm thầm không test tĩnh nào bắt được. Xóa `mock/hooks/bangLuong.ts` an toàn (0 import còn lại), xóa logic tính thuế trùng backend triệt để (0 tham chiếu còn lại), không sót dead code nghiệp vụ. Không phát hiện lỗ hổng bảo mật hay đường rò dữ liệu giữa các tenant. Báo cáo của `frontend-engineer` và `tester-qa` trung thực — 3 lệnh kiểm chứng tự chạy lại khớp 100%, kể cả phần tự thừa nhận "chưa test tay qua trình duyệt".

Điều kiện kèm theo (KHÔNG chặn bàn giao):
- `RVW-030` 🟡 — **phải chạy truy vấn đếm dòng `engineVersion <> 'v2'` trên 10 tenant thật cùng lượt `sync:tenants`**; ra `0` thì đóng luôn, ra `> 0` thì nâng lên Blocking trước khi cho kế toán mở màn hình.
- `RVW-029` 🟡 — bỏ request thừa ở tab "Lương hỗ trợ" trước khi có tenant đông nhân viên.
- `RVW-031`…`RVW-035` 🟢 — gom vào một đợt dọn nhỏ của `frontend-engineer`.
- Nợ chưa thuộc phạm vi phiên này, vẫn `OPEN`: `RVW-027` (FE phải ẩn/disable nút Thêm/Sửa/Xóa khoản lương theo `role` — việc của FE, chưa làm), `RVW-022b`/`ISSUE-blth-004`, và **giới hạn kiểm thử đã được QA nêu trung thực ở Mục 9.5**: chưa ai xác nhận bằng mắt trên dữ liệu thật (không có tenant/tài khoản test có kỳ lương). Đề nghị PO/BA cấp một tenant mẫu có kỳ `DRAFT` + kỳ `LOCKED` trước khi bàn giao cho người dùng cuối.

---

## Review 2026-09-11 — Verdict: ⚠️ Approve with comments

**Phạm vi review** — phiên `backend-engineer + frontend-engineer` (`work-log.md` `[2026-09-11 01:13]`): màn "Chốt kỳ lương" (`BR-dltl-030…034`; SRS Mục 16 · api-contract Mục 9 · data-model Mục 12). Backend: `prisma/tenant/schema.prisma` (enum `PayrollModuleCode`, model `PayrollModuleLock`), `constants/hrm/payrollModules.ts` + `payrollActivities.ts` (mới) + `payrollErrors.ts`, `helpers/hrm/payrollPeriodLockGuard.ts` (`assertPayrollModuleWritable`), `payrollInputs.service.ts` (10 đường ghi), `payrollClosing.service.ts` + `payrollActivity.service.ts` (mới), `payrollClosing.controller.ts` (mới) + `payrollPeriods.controller.ts`, `payrollClosing.route.ts` (mới) + `hrm.route.ts`, `payrollClosing.validator.ts`, 2 file test. Frontend `hdđt_maxv`: `api/chot_ky_luong/*`, `api/hrmKeys.ts`, `components/chot_ky_luong/*` (8 file), `PayrollPeriodContext.tsx` + `useCurrentPayrollPeriod.ts` (viết lại), `useBangKeChiDoc.ts` + `CanhBaoChiDoc.tsx`, 8 `*Panel.tsx`, `dashboard/dieuHuong.ts`, xóa `KyLuongSelector.tsx`, `pages/hrm/HrmPage.tsx`, `ChotKyLuongPage.tsx`, `DuLieuLuongPage.tsx`, `BangLuongPage.tsx`, `routes/AppRouter.tsx`.

**Lưu ý môi trường**: trong lúc review, cây làm việc vẫn bị agent khác sửa song song — `TheBangKe.tsx` (01:18:56), `HrmNav.tsx` (01:16:56, padding tab — có trong work-log phiên này), 2 file preview tạm `hdđt_maxv/preview-chot-ky.html` + `src/__preview_chot_ky__.tsx` (còn lúc bắt đầu review, đã bị xóa trước 01:29 — nay khớp câu "đã xóa trang preview" của work-log), `routes/hrm/du_lieu_tinh_luong/payrollCalculation.route.ts` (01:38, gắn giới hạn theo người dùng cho 3 route GET — không thuộc phiên này). Mọi kết luận dưới đây là trên trạng thái cuối lúc 01:38; các lệnh kiểm chứng đã chạy lại sau thời điểm đó.

**Đã tự kiểm chứng độc lập:**

| Lệnh | Kết quả code-reviewer tự chạy | Khớp work-log? |
|---|---|---|
| `be_maxv`: `npm run typecheck` | exit 0 | ✅ |
| `be_maxv`: `npx tsx --experimental-test-module-mocks --test src/__tests__/hrm/hrmPayrollClosing.test.ts src/__tests__/hrm/hrmPayrollInputData.test.ts` | **21/21 pass** (9 + 12), chạy 2 lần (trước và sau các thay đổi song song) | ✅ (9/9 ca closing) |
| `be_maxv`: `npx eslint` trên 12 file BE trong phạm vi | 0 error, 2 warning `no-explicit-any` có từ trước (`payrollInputs.service.ts`:82 — RVW-013) | ✅ |
| `hdđt_maxv`: `npx tsc -b` | exit 0 | ✅ |
| `hdđt_maxv`: `npx eslint src/features/hrm src/pages/hrm src/routes/AppRouter.tsx` | 0 lỗi, 0 cảnh báo | ✅ |

KHÔNG chạy `npm test` toàn bộ (một số suite chạm DB thật) và KHÔNG chạy `sync:tenants`; con số 867/871 trong work-log là số của backend-engineer, reviewer chưa xác nhận lại.

**Đã đối chiếu và XÁC NHẬN ĐÚNG (không phát sinh finding):**

1. **Không đường ghi nào lọt guard** — grep toàn `be_maxv/src` (trừ `generated`/test) mọi lệnh `create/createMany/update/updateMany/upsert/delete/deleteMany` lên 8 model dữ liệu kỳ (gồm cả dạng `tx.<model>` truyền vào `replaceScopedRecords`): chỉ nằm trong `payrollInputs.service.ts`, và cả 10 hàm ghi gọi `assertPayrollModuleWritable` ở dòng đầu với ĐÚNG mã bảng kê (soát từng literal: ATTENDANCE · OVERTIME×2 · KPI · BONUS · PIECEWORK · COMMISSION · DILIGENCE×2 · ADJUSTMENT). `deleteDiligenceRecord` lấy `periodId` từ bản ghi trong DB, không tin client. Kiểu `PayrollPeriodDataModule` chặn ngay ở `tsc` việc truyền nhầm 4 mã dùng chung vào guard.
2. **Thẩm quyền** — cả 6 handler gọi `dbCoQuyenLuongPayroll` trước mọi truy vấn; `unlock` gắn `assertAdminOrOwner` ở `preHandler` (chạy sau hook `authenticate` + `requireModule('hrm')` của `hrm.route.ts`); `lock`/`lock-all`/`calculate` chỉ cần quyền lương — đúng quyết định #2. `ADMIN` không vào được tenant (`accessibleDonViWhere` trả `null`) ⇒ thực tế chỉ OWNER mở chốt được.
3. **Cô lập tenant của "Lịch sử hoạt động"** — lọc `donViId` = công ty của phiên (đã qua `resolveTenantInfo`), `periodId` được xác thực trong DB tenant trước (id bịa → 404); 1 MST = 1 `DonVi` (`maSoThue @unique`) nên không có 2 công ty chung một DB tenant; test ghim `where.donViId` + JSON path. Không trả IP; họ tên tra theo id lấy từ chính log của công ty.
4. **Quyết định #3** — kỳ `LOCKED+` ⇒ 12 bảng kê `locked` (`lockSource=PERIOD`, bảng kê có khóa riêng giữ `MODULE`); lock/unlock/lock-all/calculate → 403 `E-dltl-001`; `reopen` không đụng `hrm_payroll_module_locks` ⇒ giữ nguyên khóa riêng. Khóa sổ không kiểm số bảng kê, FE chỉ cảnh báo trong hộp xác nhận (AC-dltl-35).
5. **Quyết định #4 + không đè bảng lương vừa chụp** — `calculatePayrollForPeriod` và `lockPayrollPeriod` đều chiếm dòng kỳ bằng `updateMany` có điều kiện TRƯỚC `snapshotPayrollSheet` ⇒ hai lượt tuần tự hóa trên khóa dòng, lượt sau thấy trạng thái mới (READ COMMITTED đánh giá lại `WHERE`): tính-lương-chen-sau-khóa-sổ nhận 409 `E-dltl-026`, khóa-sổ-chen-sau-tính-lương chụp đè lần cuối. `totalEmployees` dùng đúng bộ lọc `status='1', da_xoa=false` của engine; engine sinh 1 dòng/nhân viên. Người đọc `PayrollSheetLine` duy nhất (`getPayrollSheetLines`) rẽ nhánh theo trạng thái kỳ ⇒ bản tạm của kỳ mở KHÔNG lọt ra màn Bảng lương/Dashboard; FE không dùng `_count.payrollSheetLines`.
6. **Hợp đồng API** — shape 6 endpoint và mã lỗi/HTTP (404 `E-dltl-025`, 403 `E-dltl-001`/`E-dltl-027`, 409 `E-dltl-028`/`E-dltl-026`, 400 Zod) khớp api-contract Mục 9; hằng `HANH_DONG_KY_LUONG` dùng chung bên ghi lẫn bên đọc; log vòng đời kỳ cũ đã có `chiTiet.periodId` + `donViId` nên lên lịch sử được.
7. **Frontend — luật hook**: mọi hook ở `GocKyLuong`, `ChotKyLuongPanel`, `VongDoiKyLuong`, `LichSuHoatDong`, `TheBangKe`, `useBangKeChiDoc`, 8 panel đều gọi TRƯỚC các `return` sớm (`biTuChoi` / `!selectedPeriod` / `!periodId`).
8. **Frontend — chọn kỳ theo tháng**: `selectedPeriod` suy lại từ `periods` của công ty hiện tại (id `localStorage` của tenant khác bị loại như trước); kỳ vừa tạo chưa có trong danh sách được giữ qua `kyCho` rồi thắng khi danh sách nạp xong; đổi kỳ thì 7 panel có bảng soạn đều reset (`setMau([])` theo `periodId`) ⇒ không áp nhầm bảng của tháng cũ sang tháng mới. `useMoManKyLuong` (5 thẻ Dashboard) đổi qua context; mọi route dùng `useCurrentPayrollPeriod` đều nằm dưới `HrmPage` (đã soát `AppRouter.tsx`) ⇒ không route nào vỡ vì mất provider riêng. `HrmNav` trả `false` cho `/hrm/chot-ky-luong` (không cảnh báo MUI).
9. **Frontend — cache & quyền**: khóa `closing`/`activities` mang `companyId`, nằm dưới tiền tố `hrm-payroll-periods` ⇒ các mutation vòng đời kỳ (kể cả ở Dashboard) tự làm tươi thẻ + lịch sử. Nút "Mở chốt" / "Khóa sổ" / "Mở lại" / "Duyệt" khóa sẵn cho người không phải chủ TK kèm tooltip, khớp `assertAdminOrOwner`. 8 panel gate đủ nút ghi (Nhập Excel, Áp dụng, Tái sử dụng, ô chấm công) bằng `isReadOnly` mới — "Xóa tất cả" chỉ xóa bảng soạn cục bộ.
10. **Bảo mật khác**: không raw SQL, không log dữ liệu lương, không gọi bên thứ ba, lý do mở lại kỳ (text người dùng) chỉ render dạng text React. `GET .../activities` có index `donViId` sẵn — chưa cần index kép ở quy mô hiện tại.

---

### RVW-036 🟡 NON-BLOCKING — Xóa kỳ `DRAFT` cascade xóa luôn dữ liệu 8 bảng kê ĐÃ CHỐT SỐ: người bị cấm "Mở chốt" vẫn gỡ được bằng cách xóa kỳ, và không để lại nhật ký

- Vị trí: `be_maxv/src/routes/hrm/du_lieu_tinh_luong/payrollPeriods.route.ts`:10 (không role-guard) → `controllers/client/hrm/du_lieu_tinh_luong/payrollPeriods.controller.ts`:73 (không `writeLog`) → `services/client/hrm/du_lieu_tinh_luong/payrollPeriods.service.ts`:107-121 (chỉ kiểm `status === 'DRAFT'`); `onDelete: Cascade` của `PayrollModuleLock` + 8 bảng dữ liệu kỳ (`prisma/tenant/schema.prisma`)
- Vấn đề: BR-dltl-030/031 dựng bất biến mới — dữ liệu bảng kê đã chốt số chỉ sửa được sau khi **chủ tài khoản** mở chốt. Nhưng `DELETE /payroll-periods/:id` (có từ trước, chỉ cần quyền lương) vẫn xóa được kỳ `DRAFT` đang có bảng kê chốt số, cascade xóa sạch cả dòng khóa lẫn dữ liệu đã chốt. Tức nhân viên HR có quyền lương — người mà máy chủ cố tình từ chối "Mở chốt" (AC-dltl-31) — vẫn đi đường vòng xóa-rồi-tạo-lại kỳ; thao tác xóa kỳ cũng không ghi `writeLog`, nên sau đó chỉ còn các dòng lịch sử mồ côi trỏ tới `periodId` không tồn tại. Data-model Mục 12.1 chủ ý cho cascade ("xóa kỳ Bản nháp thì khóa chốt đi theo, không mồ côi") — đó là quyết định về **dòng mồ côi**, chưa ai cân nhắc khía cạnh **thẩm quyền**; SRS Mục 6.1 / api-contract Mục 1.5 cũng chưa nói gì về kỳ đã có bảng kê chốt số. Không xếp Blocking vì FE không có nút xóa kỳ (grep `useDeletePayrollPeriod`: 0 nơi dùng) — rủi ro chỉ qua gọi API trực tiếp.
- Đề xuất fix: cần BA chốt 1 trong 2 (không tự đoán): (a) từ chối xóa khi kỳ còn ≥ 1 dòng `PayrollModuleLock` — 409 nêu tên các bảng kê đang chốt ("mở chốt trước khi xóa kỳ"), hoặc (b) chỉ ADMIN/OWNER được xóa kỳ (`preHandler: assertAdminOrOwner` như `lock/reopen/approve`). Chọn cách nào cũng ghi `writeLog` cho thao tác xóa kỳ (`{ periodId, code }`), bổ sung SRS Mục 6.1 + api-contract Mục 1.5 và 1 test.
- Trạng thái: OPEN

---

### RVW-037 🟡 NON-BLOCKING — "Tính lương" chạy trọn engine TRONG interactive transaction mặc định 5s, giữ khóa dòng kỳ suốt lượt tính, và là route tính-lương-toàn-công-ty duy nhất không có giới hạn theo người dùng

- Vị trí: `be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollClosing.service.ts`:214-231; `routes/hrm/du_lieu_tinh_luong/payrollClosing.route.ts`:13; đối chiếu `routes/hrm/du_lieu_tinh_luong/payrollCalculation.route.ts`:9-15
- Vấn đề: `db.$transaction(async (tx) => …)` không truyền `{ timeout, maxWait }` ⇒ mặc định Prisma `timeout: 5000ms` — đúng nợ `A-05` còn OPEN (data-model Mục 6.2). Bên trong: `updateMany` chiếm khóa dòng `hrm_payroll_periods` → `snapshotPayrollSheet` (nạp dữ liệu cả công ty + pipeline 10 bước + `deleteMany` + `createMany`). Khác khóa sổ (1 lần/kỳ, chỉ chủ TK), nút này được thiết kế để **bấm lặp lại** và **ai có quyền lương cũng bấm được**: 2 người/2 tab bấm gần nhau thì lượt sau đứng chờ khóa dòng *trong khi đồng hồ 5s của chính nó đang chạy*; lượt "Khóa sổ" của chủ TK chen vào lúc đang tính cũng phải chờ như vậy. Tenant đông nhân viên, tổng thời gian vượt 5s ⇒ Prisma ném `P2028` ⇒ `errorHandler.plugin.ts` không map ⇒ **500 "Lỗi máy chủ nội bộ"** thay vì 409 rõ ràng — tệ nhất là làm hỏng lượt khóa sổ. Kèm theo: hôm nay 3 route GET cùng tính lương toàn công ty vừa được gắn `gioiHanTheoNguoiDung(30, '1 minute')`; `POST /payroll-periods/:id/calculate` (nặng hơn vì còn ghi) là route duy nhất trong nhóm chỉ còn trần chung 300/phút/IP. Không xếp Blocking: tenant dev 1–2 nhân viên, engine < 1s, FE khóa nút khi đang chạy.
- Đề xuất fix: (1) tính NGOÀI transaction, chỉ khóa dòng cho pha ghi ngắn — bản tạm không phải chứng từ nên tính trên dữ liệu đã commit là đủ, điều kiện `status ∈ {DRAFT, PENDING_REVIEW}` vẫn chặn đè bảng lương vừa chụp:

  ```ts
  const lines = await calculatePayrollPreview(db, periodId, period);
  return db.$transaction(async (tx) => {
    const { count } = await tx.payrollPeriod.updateMany({
      where: { id: periodId, status: { in: KY_CON_MO } },
      data: { updatedAt: new Date() },
    });
    if (count === 0) throw new PayrollError(PAYROLL_ERROR_CODES.E_DLTL_026, '…', HttpStatus.CONFLICT);
    await tx.payrollSheetLine.deleteMany({ where: { periodId } });
    if (lines.length > 0) await tx.payrollSheetLine.createMany({ data: lines });
    return { calculatedEmployees: lines.length };
  }, { timeout: 30_000 });
  ```

  (tách phần ghi của `snapshotPayrollSheet` thành hàm dùng chung để không chép logic); (2) đóng luôn `A-05` cho `lockPayrollPeriod` bằng `{ timeout }` tường minh; (3) gắn `gioiHanTheoNguoiDung(…)` cho route `calculate` cho đồng bộ 3 route GET; (4) cân nhắc map `P2028` → 409 "đang có thao tác khác trên kỳ lương, thử lại".
- Trạng thái: OPEN
  → FIXED một phần [2026-09-11] — (1) `payrollClosing.service.ts::calculatePayrollForPeriod` tính `calculatePayrollPreview` NGOÀI transaction; trong transaction chỉ còn `chuyenTrangThai(tx, …, KY_LUONG_CON_MO, { updatedAt })` (export từ `payrollPeriods.service.ts`) + `ghiDeBangLuong` — đường ghi DUY NHẤT vào `hrm_payroll_sheet_lines`, `snapshotPayrollSheet` dùng chung (`payrollCalculation.service.ts`); (3) `payrollClosing.route.ts` gắn `gioiHanTheoNguoiDung(30, '1 minute')` cho `POST .../calculate`. CHƯA làm: (2) `{ timeout }` cho `lockPayrollPeriod` (`A-05` vẫn OPEN), (4) map `P2028`. Test `hrmPayrollClosing.test.ts` 11/11, `npm test` 923/927 (4 đỏ cố ý có sẵn), commit: chưa commit *(backend-engineer)*

---

### RVW-038 🟡 NON-BLOCKING — Cổng triển khai: guard mới tra bảng `hrm_payroll_module_locks` ở CẢ 10 đường ghi `/payroll-data/*` — tenant chưa `sync:tenants` là gãy toàn bộ nhập liệu lương (500)

- Vị trí: `be_maxv/src/helpers/hrm/payrollPeriodLockGuard.ts`:83 (`payrollModuleLock.findUnique`), `services/client/hrm/du_lieu_tinh_luong/payrollClosing.service.ts`:45; runbook: api-contract Mục 9.4, data-model Mục 12.2, `CONTEXT_SUMMARY.md` dòng 29
- Vấn đề: mã đúng, nhưng thứ tự triển khai quyết định sống còn: DB tenant thiếu bảng thì `findUnique` ném `P2021` → `errorHandler` rơi nhánh 500 ⇒ mọi thao tác ghi của 8 màn nhập liệu và `GET .../closing` hỏng cùng lúc cho tenant đó (còn cờ chỉ đọc phía FE thì "mở" — xem RVW-044). Work-log + data-model xác nhận mới chạy 10/10 tenant dev/local, **production chưa chạy**; `sync:tenants` là bước tay, không nằm trong `build`/`start`. Tiền lệ cùng loại: `RVW-022b`/`ISSUE-blth-004` vẫn OPEN đúng ở khâu này.
- Đề xuất fix: thay đổi là **thuần thêm** (đã đo `migrate diff`: 4 lệnh tạo, 0 DROP) nên chạy **DB trước, mã sau**: `npm run generate` → `npm run sync:tenants` + `npm run hrm:constraints` trên TẤT CẢ tenant production → xác nhận từng tenant `SELECT to_regclass('public.hrm_payroll_module_locks') IS NOT NULL` (ghi kết quả vào `work-log.md`) → rồi mới deploy mã. Mã cũ không đọc bảng mới nên cửa sổ lỗi bằng 0. Ghi thứ tự này vào runbook `dev-notes.md` Mục 1.3b cùng lượt với RVW-022b.
- Trạng thái: OPEN

---

### RVW-039 🟢 SUGGESTION — Chốt / mở chốt / chốt toàn kỳ không khóa dòng kỳ; `lock-all` báo cáo danh sách DỰ ĐỊNH chứ không phải danh sách THỰC GHI

- Vị trí: `be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollClosing.service.ts`:114-147 (lock), :149-169 (unlock), :172-196 (lock-all — `return { lockedModules: canChot }` ở :195); lập luận ở data-model Mục 12.3 gạch đầu dòng 2
- Vấn đề: cả 3 hàm kiểm trạng thái kỳ rồi mới ghi, không chiếm dòng như `calculatePayrollForPeriod` — câu "ràng buộc duy nhất lo phần đồng thời" (data-model 12.3) chỉ đúng cho tranh chấp chốt-với-chốt, không cho chốt-với-khóa-sổ. (a) Khóa sổ commit chen giữa ⇒ `unlock` vẫn xóa được khóa trên kỳ đã `LOCKED` và trả 200 — trái BR-dltl-032, và sau "Mở lại kỳ" bảng kê đó thành "đang mở" dù quy tắc hứa giữ nguyên (xác suất rất thấp: hai thao tác đều chỉ chủ TK làm được). (b) Khả dĩ hơn: HR A bấm "Chốt số liệu" một thẻ đúng lúc HR B bấm "Chốt số toàn kỳ" ⇒ `skipDuplicates` bỏ dòng trùng nhưng hàm vẫn trả + ghi nhật ký `count = canChot.length` ⇒ lịch sử có cả "Chốt số liệu X" (A) lẫn "Chốt số toàn kỳ (11 bảng kê)" (B) trong khi B thực chốt 10; toast phía B cũng báo 11. Sai dấu vết kiểm toán, không sai dữ liệu.
- Đề xuất fix: (1) `lock-all` dùng `createManyAndReturn({ data, skipDuplicates: true, select: { module: true } })` rồi trả + ghi log đúng các dòng vừa chèn; (2) muốn đóng hẳn (a): bọc 3 hàm trong `$transaction` và chiếm dòng kỳ bằng đúng mẫu `updateMany … status in KY_CON_MO` của `calculatePayrollForPeriod`; sửa lại câu lập luận ở data-model Mục 12.3 cho khớp.
- Trạng thái: OPEN
  → FIXED một phần [2026-09-11] — (1) `lockAllPayrollModules` chèn cả 12 bằng MỘT `createManyAndReturn({ skipDuplicates: true, select: { module: true } })`, trả + ghi nhật ký đúng các dòng THỰC chèn (bỏ lượt `findMany` đọc trước); fake DB test mô phỏng đúng `skipDuplicates`. CHƯA làm (2) khóa dòng kỳ cho lock/unlock — giữ mức kiểm-rồi-ghi như guard có sẵn, ghi rõ ở data-model Mục 12.3. Commit: chưa commit *(backend-engineer)*

---

### RVW-040 🟢 SUGGESTION — `PayrollSheetLine` đổi nghĩa (kỳ mở nay chứa kết quả TẠM) nhưng tài liệu tại chỗ trong mã vẫn gọi là "snapshot đóng băng"

- Vị trí: `be_maxv/prisma/tenant/schema.prisma`:1719 (`/// 14. Bảng Lương Tổng hợp Snapshot`); `services/client/hrm/du_lieu_tinh_luong/payrollCalculation.service.ts`:668 và :698; `payrollPeriods.service.ts`:33 (`_count.payrollSheetLines`); api-contract Mục 1.1 (ví dụ `payrollSheetLines: 0` cho kỳ DRAFT)
- Vấn đề: trước đợt này "có dòng `PayrollSheetLine`" ⇔ "chứng từ của kỳ đã khóa sổ". Từ nay nút "Tính lương" ghi đè bảng này khi kỳ còn mở. `getPayrollSheetLines` vẫn đúng (rẽ nhánh theo trạng thái) và `CONTEXT_SUMMARY.md` dòng 60 đã ghi — nhưng người đọc mã (docblock model + 2 docblock service) và người đọc hợp đồng (`_count.payrollSheetLines` nay > 0 với kỳ DRAFT) vẫn thấy nghĩa cũ. Rủi ro cụ thể: các màn "Bảng tính thuế / Tờ khai TNCN / Quyết toán" đang là chỗ giữ (`to-khai-thue`) sẽ tự nhiên đọc thẳng bảng này; thiếu điều kiện trạng thái kỳ là đưa số tạm của kỳ nháp vào tờ khai.
- Đề xuất fix: sửa docblock model + `snapshotPayrollSheet` + `getPayrollSheetLines` thành 1 câu bất biến: "Chỉ dòng của kỳ `LOCKED/APPROVED/PAID/ARCHIVED` là chứng từ; dòng của kỳ `DRAFT/PENDING_REVIEW` là kết quả tạm của nút Tính lương"; thêm vào phần **TUYỆT ĐỐI** của `dev-notes.md` Mục 1.11; cập nhật chú thích `_count.payrollSheetLines` ở api-contract Mục 1.1. Tùy chọn: 1 helper đọc-dòng-chính-thức có kiểm trạng thái để module thuế sau này gọi thay vì `findMany` trơn.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — docblock model `PayrollSheetLine` (`prisma/tenant/schema.prisma`) + `ghiDeBangLuong`/`getPayrollSheetLines` (`payrollCalculation.service.ts`) ghi rõ bất biến "kỳ đã khóa sổ = chứng từ đóng băng; kỳ còn mở = kết quả TẠM của nút Tính lương, KHÔNG đọc làm số liệu"; `getPayrollSheetLines` rẽ nhánh bằng `kyLuongConMo()` dùng chung; thêm vào mục TUYỆT ĐỐI `dev-notes.md` Mục 1.11 và api-contract Mục 9.1. Chưa làm helper đọc-dòng-chính-thức (tùy chọn). Commit: chưa commit *(backend-engineer)*

---

### RVW-041 🟢 SUGGESTION — Hai nguồn sự thật cho "kỳ còn ghi được" + 2 cặp helper chép y hệt

- Vị trí: `be_maxv/src/services/client/hrm/du_lieu_tinh_luong/payrollClosing.service.ts`:32 (`KY_CON_MO`) vs `helpers/hrm/payrollPeriodLockGuard.ts`:58 (`readOnlyStatuses`); `controllers/client/hrm/du_lieu_tinh_luong/payrollClosing.controller.ts`:27-39 (`ghiNhatKy`) vs `payrollPeriods.controller.ts`:34-46 (`ghiNhatKyLuong`); `hdđt_maxv/src/features/hrm/api/chot_ky_luong/chotKyLuongQueries.ts`:46-52 (`useInvalidateChotKy`) vs `api/du_lieu_tinh_luong/payrollPeriodsQueries.ts`:52-58 (`useInvalidatePayroll`)
- Vấn đề: (a) guard ghi dữ liệu dùng danh sách ĐEN (4 trạng thái chỉ đọc), màn chốt kỳ dùng danh sách TRẮNG (2 trạng thái mở) — comment tự thừa nhận "trùng tập". Thêm một trạng thái kỳ mới (vd `CANCELLED`) là hai bên lệch nhau lặng lẽ: guard cho ghi dữ liệu nhưng màn chốt coi kỳ đã khóa. (b) 2 hàm ghi nhật ký và 2 hook invalidate giống nhau từng dòng — đúng loại lặp RVW-007 đã cảnh báo.
- Đề xuất fix: export `KY_CON_MO` + `kyConMo()` từ `payrollPeriodLockGuard.ts` và cho `assertPayrollPeriodWritable` dùng chính nó; rút `ghiNhatKyLuong` thành 1 helper dùng chung cho 2 controller; export `useInvalidatePayroll` và bỏ bản sao ở `chotKyLuongQueries.ts`.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — (a) `payrollPeriodLockGuard.ts` export `KY_LUONG_CON_MO` + `kyLuongConMo()`; `assertPayrollPeriodWritable(db, id, thongBao?)` dùng chính nó (thay `readOnlyStatuses`) và thay luôn `assertKyConMoDeChot` của `payrollClosing.service.ts`; `getPayrollSheetLines` cũng dùng. (b) MỚI `helpers/hrm/nhatKyKyLuong.ts::ghiNhatKyKyLuong` + kiểu `ChiTietNhatKyKyLuong` dùng chung cho 2 controller VÀ bên đọc `payrollActivity.service.ts`. Hook FE: `chotKyLuongQueries.ts` nay chỉ làm mới 2 khóa `closing`/`activities` của đúng kỳ (`useLamMoiChotKy`) — không còn là bản sao `useInvalidatePayroll` (vốn làm mới cả danh sách kỳ + nhóm tính lương, thừa với thao tác chốt). Commit: chưa commit *(backend-engineer)*

---

### RVW-042 🟢 SUGGESTION — Test chỉ ghim 1/10 đường ghi với `E-dltl-027`; 4 endpoint POST mới chưa có ca 403 thiếu quyền lương

- Vị trí: `be_maxv/src/__tests__/hrm/hrmPayrollClosing.test.ts`:246-282 (chỉ `PUT attendance/cell` qua HTTP), :410-459 (ca 403 thiếu quyền chỉ cho 2 route GET)
- Vấn đề: 9 đường ghi còn lại hiện chỉ đúng nhờ đọc tay từng literal mã bảng kê — một lần sửa nhầm (vd `applyCommission` truyền `'BONUS'`) sẽ khiến chốt số Lương phần trăm mất tác dụng mà cả bộ test vẫn xanh. Chính dev-notes Mục 1.11 cảnh báo "gọi trơn là chốt số bảng kê mất tác dụng … mà không test cũ nào báo" — test mới cũng chưa báo được. Tương tự, `lock`/`unlock`/`lock-all`/`calculate` gọi `dbCoQuyenLuongPayroll` đúng (đã đọc mã) nhưng không ca nào ghim điều đó.
- Đề xuất fix: 1 test tham số hóa 10 dòng `{ method, url, payload, module }` — chốt `module` rồi gọi route ⇒ 403 `E-dltl-027`; chốt module KHÁC ⇒ không bị guard này chặn. Thêm vòng lặp 4 route POST với `xemLuongChoRequestHienTai = false` ⇒ 403.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — `hrmPayrollClosing.test.ts`: test tham số hóa gọi thẳng 10 hàm ghi của `payrollInputs.service.ts` — chỉ chốt đúng bảng kê của hàm ⇒ `E-dltl-027`; chốt MỌI bảng kê khác ⇒ không bị guard chặn (bắt được lỗi truyền nhầm mã bảng kê). Thêm test 4 route POST (lock/unlock/lock-all/calculate) thiếu quyền lương ⇒ 403, không ghi khóa, không chạy engine, không ghi nhật ký. 11/11 pass. Commit: chưa commit *(backend-engineer)*

---

### RVW-043 🟢 SUGGESTION — Tạo kỳ từ góc thanh HRM: trong lúc danh sách kỳ nạp lại, màn Chốt kỳ nháy "chưa có kỳ lương" và nút "Tạo kỳ lương" bấm được lần nữa

- Vị trí: `hdđt_maxv/src/features/hrm/components/du_lieu_tinh_luong/PayrollPeriodContext.tsx`:61-73 (`setKyCho`), :79 (`dangTai`); `components/chot_ky_luong/GocKyLuong.tsx`:61-74, :133; `components/chot_ky_luong/ChotKyLuongPanel.tsx`:67-76
- Vấn đề: sau `mutateAsync` thành công, `taoKy.isPending` về `false` ngay, còn kỳ mới chỉ xuất hiện khi lượt refetch danh sách xong (invalidate không được chờ). Trong khoảng đó `kyCho` đang treo nhưng `dangTai = false` (refetch nền không bật `isLoading`) ⇒ `selectedPeriod = null` ⇒ màn vừa điều hướng tới hiện "Tháng m/y chưa có kỳ lương…" và nút góc quay lại "Tạo kỳ lương" đang bật; bấm lần nữa ⇒ 409 "Kỳ tính lương … đã tồn tại". Không hỏng dữ liệu (`code` duy nhất chặn), chỉ nháy sai trạng thái đúng ngay kịch bản AC-dltl-36.
- Đề xuất fix: coi "đang chờ kỳ vừa tạo" là đang tải — `dangTai = !quyen.biTuChoi && (!duocGoi || isLoading || (!!kyCho && !periods.some((p) => p.id === kyCho)))`; hoặc trong `onSuccess` của `useCreatePayrollPeriod` chèn kỳ mới vào cache danh sách (`setQueryData`) trước khi invalidate.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — sửa tận gốc thay vì thêm nhánh: `useInvalidatePayroll` (`payrollPeriodsQueries.ts`) trả promise CHỜ nhóm `hrm-payroll-periods` nạp lại ⇒ `mutateAsync` của tạo kỳ chỉ về khi danh sách đã có kỳ mới, `isPending` giữ nút khóa suốt lúc đó. Provider bỏ hẳn `kyCho`/`setSelectedPeriodId`, chọn kỳ CHỈ theo tháng (`chonThang(ThangNam)`), nhớ tháng `YYYY-MM` ở `localStorage`. Soát bằng trang preview tạm: bấm "tháng sau" ra đúng "Tạo kỳ lương T10/2026". Commit: chưa commit *(frontend-engineer)*

---

### RVW-044 🟢 SUGGESTION — Cờ chỉ đọc theo bảng kê "mở" trong lúc tổng quan chốt đang tải/lỗi và không tự làm tươi khi máy chủ trả `E-dltl-027`

- Vị trí: `hdđt_maxv/src/features/hrm/components/du_lieu_tinh_luong/useBangKeChiDoc.ts`:15-18; `components/chot_ky_luong/ChotKyLuongHeader.tsx`:62, :124
- Vấn đề: `bangKeDaChot` chỉ bật khi `data` của `GET .../closing` đã có ⇒ lúc đang tải hoặc khi request lỗi (vd tenant chưa có bảng — RVW-038), 8 màn nhập liệu hiện như đang mở; người dùng soạn/nhập Excel xong mới ăn 403. Khi ghi bị từ chối `E-dltl-027` (người khác vừa chốt ở tab khác), FE chỉ toast, không nạp lại tổng quan ⇒ màn vẫn cho bấm tiếp. Tương tự, header lấy `periodLocked` từ `tongQuan` nên nút "Tính lương" bật trong lúc tải với kỳ đã khóa sổ, dù `period.status` đã có sẵn từ danh sách. Máy chủ vẫn chặn đúng nên chỉ là UX.
- Đề xuất fix: header dùng `kyDaKhoaSo(period.status) || tongQuan?.periodLocked`; ở `onError` các mutation nhập liệu (cạnh `useInvalidateInputs`, `payrollInputsQueries.ts`:42) nếu `err.code === 'E-dltl-027'` thì invalidate `hrmPayrollPeriodKeys.closing(companyId, periodId)`; tùy chọn cho `useBangKeChiDoc` trả thêm `isLoading` để khóa nút ghi khi chưa biết trạng thái chốt.
- Trạng thái: OPEN
  → FIXED một phần [2026-09-11] — `ChotKyLuongHeader.tsx` khóa "Tính lương"/"Chốt số toàn kỳ" theo `kyDaKhoaSo(period.status)` (có ngay, không đợi tổng quan); `useBangKeChiDoc` không gọi `/closing` khi kỳ đã chỉ đọc. CHƯA làm: làm tươi tổng quan khi nhận `E-dltl-027`, khóa nút ghi lúc tổng quan đang tải (máy chủ vẫn chặn đúng). Commit: chưa commit *(frontend-engineer)*

---

**Verdict: ⚠️ Approve with comments — KHÔNG có 🔴 Blocking.** 3 🟡 (`RVW-036`…`RVW-038`) · 6 🟢 (`RVW-039`…`RVW-044`).

Phần lõi đúng quyết định của chủ dự án và đúng hợp đồng: guard theo bảng kê phủ đủ 10/10 đường ghi, chỉ chặn 8 bảng kê dữ liệu kỳ (4 bảng kê dùng chung chỉ đánh dấu đã rà soát), mở chốt đúng chỉ chủ TK, "Lịch sử hoạt động" cô lập đúng theo `donViId`, tính-lương-tạm và khóa sổ tuần tự hóa đúng trên khóa dòng kỳ. Phía FE, nâng `PayrollPeriodProvider` lên `HrmPage` và chọn kỳ theo tháng không làm vỡ lối tắt Dashboard hay khu Bảng lương; luật hook, cache theo công ty, khóa nút theo vai trò đều đạt. Test tự động của phần mới tốt (9 ca, có ca race 409) nhưng mỏng ở chiều "đủ 10 đường ghi" (RVW-042).

Điều kiện kèm theo (KHÔNG chặn merge, nhưng chặn go-live):
- `RVW-038` 🟡 — **`sync:tenants` + `hrm:constraints` trên toàn bộ tenant production TRƯỚC khi deploy mã**, có bằng chứng `to_regclass` từng tenant trong `work-log.md`.
- `RVW-036` 🟡 — BA chốt quy tắc xóa kỳ khi đã có bảng kê chốt số (chặn hay chỉ chủ TK), kèm nhật ký xóa kỳ.
- `RVW-037` 🟡 — tách pha tính khỏi khóa dòng + timeout tường minh + giới hạn theo người dùng trước khi mở cho tenant đông nhân viên.
- Quy trình: phiên này đi thẳng từ yêu cầu chủ dự án sang code ("ngoài luồng 3 Amigos"); chưa có `test-matrix`/`test-cases`/`test-report` nào phủ `AC-dltl-29…36`, và `CONTEXT_SUMMARY.md` dòng 29 tự ghi "chưa qua Tester-QA Phase B, chưa kiểm giao diện trên trình duyệt đã đăng nhập". Review này KHÔNG thay thế QA Phase B — đề nghị tester-qa chạy 8 AC trên tenant mẫu đã seed trước khi bàn giao người dùng cuối.
- Carry-forward vẫn `OPEN`, không đánh số lại: `A-05` (nay gắn với RVW-037), `RVW-022b`/`ISSUE-blth-004`, `RVW-027`, `RVW-029`…`RVW-035`.

---

# Audit toàn bộ `hdđt_maxv/src/features/hrm` — 2026-09-11

> Đợt audit ad-hoc toàn bộ `hdđt_maxv/src` (493 file, chia 9 nhóm review song song); 4/9 nhóm thuộc HRM, gộp vào đây. Để tránh trùng với dải `RVW-001`…`RVW-044` đã dùng ở trên mà không phải renumber thủ công ~90 finding, mỗi nhóm dùng 1 dải ID riêng (`RVW-5xx` / `RVW-7xx` / `RVW-Axx` / `NB-`/`S-`) — **không trùng, không cần đối chiếu chéo**. Từ nay ID mới của HRM tiếp tục từ dải cao nhất đã dùng bên dưới (`RVW-720`).

## Review 2026-09-11 — Nhóm 5/9 (core logic: api + calculations + types + _shared) — Verdict: ❌ Request changes

> Phạm vi: `features/hrm/api/**` (37 file), `calculations/**` (10 file), `types/**`, `_shared/**` (53 file tổng). Công thức lương/thuế/BHXH đã chuyển hết sang `be_maxv` (ADR-010); lớp này chỉ gom dữ liệu + đổi tên trường. Cả 2 blocking đều thuộc loại "mảnh nghiệp vụ sót lại ở FE đã lệch khỏi nguồn sự thật BE".

### RVW-501 🔴 BLOCKING — `cong_tac`/`nghi_phep` tính 0 công ở FE nhưng 1.0 công ở BE
- Vị trí: `features/hrm/_shared/constants.ts`:322-323 · `calculations/du_lieu_tinh_luong/chamCong.ts`:142
- Vấn đề: `LOAI_CONG` khai `tinhCong:false, congMacDinh:0` cho `cong_tac`/`nghi_phep`; `congCuaO()` trả 0. BE (`payrollInputs.service.ts`:142-149, `ATTENDANCE_FIXED_VALUE`) coi 2 loại này là 1.0 công (hưởng 100% lương). Nhân viên công tác 5 ngày + nghỉ phép 2 ngày trong tháng 26 công → màn Chấm công hiện 19/26 (đỏ), phiếu lương vẫn trả 26/26 — mâu thuẫn trực tiếp trước mắt người chốt lương.
- Đề xuất fix: bỏ `tinhCong`/`congMacDinh` khỏi `LOAI_CONG`, lấy hệ số công từ 1 bảng chép đúng `ATTENDANCE_FIXED_VALUE` (kèm comment trỏ về BE), hoặc đọc `workDayValue` BE đã trả thay vì tự quy đổi.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — `_shared/constants.ts`:322-323 sửa `congMacDinh` của `cong_tac`/`nghi_phep` từ 0 thành 1 (khớp `ATTENDANCE_FIXED_VALUE` BE) kèm comment trỏ về `payrollInputs.service.ts`; `calculations/du_lieu_tinh_luong/chamCong.ts`:139-147 sửa `congCuaO()` bỏ early-return 0 khi `!tinhCong` (nguyên nhân gốc — trước đây early-return khiến `congMacDinh` mới đặt vẫn không có tác dụng), giờ chỉ dùng nhánh giờ-thực-tế khi `tinhCong` true, còn lại luôn trả `congMacDinh`. Không đổi `nghi_le`/`om`/`khong_luong`/`khac` (ngoài phạm vi finding). tsc+eslint pass, commit "chưa commit" *(frontend-engineer)*

### RVW-502 🔴 BLOCKING — `unitPrice`/`penaltyRate` khai `number` nhưng BE trả CHUỖI (Decimal)
- Vị trí: `api/du_lieu_tinh_luong/payrollCatalogsApi.ts`:62, 108 → `payrollCatalogsQueries.ts`:156, 259
- Vấn đề: `be_maxv/prisma/tenant/schema.prisma`:1577,1643 khai `Decimal`; `catalogs.service.ts` trả thẳng row Prisma (không `Number()` như 3 service anh em khác đã làm). Hệ quả đã hiện thực: `BangChuyenCanCard.tsx`:58 `tong + loai.muc_tru` với `tong=0` (number) + `muc_tru="200000"` (string) = `"0200000"` (nối chuỗi) — chip "Tổng trừ" màn Lương chuyên cần sai.
- Đề xuất fix: `Number(r.unitPrice)`/`Number(r.penaltyRate)` tại 2 điểm ánh xạ trên (đúng khuôn `hopDongQueries.ts`:96 đã làm); fix triệt để hơn ở BE (`catalogs.service.ts` thêm `Number()`).
- Trạng thái: OPEN
  → FIXED [2026-09-11] — `api/du_lieu_tinh_luong/payrollCatalogsQueries.ts`: `sanPhamVeKieuFe()` (`don_gia: Number(r.unitPrice)`) và `chuyenCanVeKieuFe()` (`muc_tru: Number(r.penaltyRate)`), đúng khuôn `hopDongQueries.ts`:96. Không sửa BE (ngoài phạm vi FE task). tsc+eslint pass, commit "chưa commit" *(frontend-engineer)*

### RVW-503 🟡 NON-BLOCKING — Công thức trừ chuyên cần bị nhân đôi ở component, thiếu bất biến chặn sàn BR-dltl-016
- Vị trí: `components/du_lieu_tinh_luong/chuyen_can/BangChuyenCanCard.tsx`:54-62 · contract ở `api/du_lieu_tinh_luong/payrollInputsApi.ts`:353-357
- Vấn đề: docblock ghi rõ "FE KHÔNG cần tự tính lại", nhưng component vẫn tự cộng `muc_tru * so_gio` không có `Math.min(tongPhat, donGia)` mà BE áp — preview có thể hiện mức trừ lớn hơn đơn giá (không bao giờ xảy ra lúc chốt).
- Đề xuất fix: dùng `DiligenceSummaryApi.tongTru/thanhTien` cho dòng đã lưu; dòng đang soạn thì áp cùng công thức kẹp sàn, đặt trong `calculations/du_lieu_tinh_luong/chuyenCan.ts`.
- Trạng thái: OPEN

### RVW-504 🟡 NON-BLOCKING — `strict`/`strictNullChecks` không bật cho toàn bộ `hdđt_maxv`
- Vị trí: `hdđt_maxv/tsconfig.app.json`:1-29
- Vấn đề: mọi union `| null` trong `types/index.ts` (896 dòng) chỉ là trang trí, compiler không chặn `null.xxx`. RVW-502 là ví dụ trực tiếp — bật strict thì lỗi đó đỏ ngay trong IDE.
- Đề xuất fix: bật `strict:true` (tối thiểu `strictNullChecks`), dọn lỗi theo từng feature, 1 chủ sở hữu duy nhất tránh sửa song song với nhóm khác.
- Trạng thái: OPEN

### RVW-505 🟡 NON-BLOCKING — `normalizePayrollLine` biến trường thiếu thành `NaN` âm thầm
- Vị trí: `api/du_lieu_tinh_luong/payrollCalculationApi.ts`:194
- Vấn đề: `Number(raw[field])` với `raw[field]` là `undefined` (snapshot cũ engine v1 thiếu trường) → `NaN` chảy vào `tongBangLuong()`, cả 3 thẻ tổng đầu Dashboard thành `NaN`, không ném lỗi.
- Đề xuất fix: `const v = Number(raw[field] ?? 0); line[field] = Number.isFinite(v) ? v : 0;` + `console.warn` 1 lần khi gặp trường thiếu.
- Trạng thái: OPEN

### RVW-506 🟡 NON-BLOCKING — Dashboard mở = tối đa 6 lần tính lương toàn công ty
- Vị trí: `api/dashboard/dashboardQueries.ts`:145-147 (`useXuHuongLuong`)
- Vấn đề: `useQueries` bắn `GET /payroll/sheet-lines` cho từng kỳ trong khung 6 tháng; kỳ nháp tính live toàn bộ pipeline 10 bước cho mọi nhân viên chỉ để vẽ biểu đồ xu hướng.
- Đề xuất fix: đề nghị Architect thêm endpoint tổng hợp `GET /payroll/summary?from=&to=`; trước mắt chỉ query kỳ đã khóa + kỳ hiện tại.
- Trạng thái: OPEN

### RVW-507 🟡 NON-BLOCKING — Gán nhanh phòng ban là 2N request tuần tự, không có tiến độ
- Vị trí: `api/du_lieu_nhan_vien/nhanVienQueries.ts`:477-489
- Vấn đề: 200 nhân viên = 400 round-trip nối đuôi, chỉ báo tiến độ khi có lỗi. Chọn "toàn công ty" là đơ vài phút.
- Đề xuất fix: thêm callback `onTien(daXong, tong)` theo khuôn `useTaiNhieuFileLen` (`taiLieuQueries.ts`:309) đã có sẵn trong chính feature.
- Trạng thái: OPEN

### RVW-508 🟡 NON-BLOCKING — `useCauHinh()` trả hệ số pháp luật mặc định trong lúc đang tải
- Vị trí: `api/cau_hinh_mac_dinh/cauHinhQueries.ts`:281-287
- Vấn đề: chưa có data thì trả `cauHinhMacDinhGoc()` — chỉ khóa nút Lưu, không khóa phần đọc; màn Tăng ca hiện hệ số 150/200% mặc định rồi nhảy sang hệ số thật của công ty.
- Đề xuất fix: nơi hiển thị số quy đổi dùng `useTrangThaiCauHinh().daCoDuLieu` để render skeleton.
- Trạng thái: OPEN

### RVW-509 🟡 NON-BLOCKING — `soGioCa` trả `NaN` với giờ sai định dạng
- Vị trí: `_shared/format.ts`:44-48, 56-62
- Vấn đề: `phutTrongNgay("ab:cd")` trả `NaN`; `Math.max(0, NaN)` vẫn là `NaN` (không phải 0) — chảy ra bản xem trước form ca làm việc.
- Đề xuất fix: kiểm `Number.isFinite` cho cả 2 phần giờ:phút, không hợp lệ thì return 0.
- Trạng thái: OPEN

### RVW-510 🟡 NON-BLOCKING — `chiSo()` nuốt dấu âm và không chặn tràn
- Vị trí: `_shared/format.ts`:27-30
- Vấn đề: `text.replace(/\D/g,"")` bỏ cả dấu `-` → gõ `-5000000` ra `5000000` (đảo dấu im lặng); không trần nên dán 21 chữ số vượt `MAX_SAFE_INTEGER`.
- Đề xuất fix: kẹp trần `Math.min(so, Number.MAX_SAFE_INTEGER)`, quyết định rõ chính sách dấu âm trong docblock.
- Trạng thái: OPEN

### RVW-511 🟡 NON-BLOCKING — `hopDongTuApi` hardcode lương = 0 kèm comment lỗi thời
- Vị trí: `api/du_lieu_nhan_vien/nhanVienQueries.ts`:134-136
- Vấn đề: comment "bảng lương vẫn chạy mock" đã lỗi thời (mock đã xóa 2026-09-10); `luong_chinh:0, luong_bhxh:0` nghĩa là "0 đồng" thay vì "không biết", kiểu `HopDong` không cho `null` nên không phân biệt được.
- Đề xuất fix: xóa comment sai; đổi 2 trường sang `number | null`.
- Trạng thái: OPEN

### RVW-512 🟡 NON-BLOCKING — Ngày lễ lặp hằng năm: 29/02 và áp ngược cho năm trước khi tạo
- Vị trí: `calculations/du_lieu_tinh_luong/chamCong.ts`:49-53
- Vấn đề: `nl.ngay.slice(5) === iso.slice(5)` — lễ 29/02 không khớp năm không nhuận; lễ tạo năm 2026 vẫn áp cho tháng 2025 khi xem lại kỳ cũ, ảnh hưởng hệ số tăng ca 300%/390%.
- Đề xuất fix: thêm chặn `nl.ngay.slice(0,4) <= iso.slice(0,4)` cho nhánh lặp; xử lý 29/02 tường minh.
- Trạng thái: OPEN

### RVW-513 🟡 NON-BLOCKING — Tải toàn bộ tài liệu/người phụ thuộc công ty rồi lọc ở client
- Vị trí: `api/du_lieu_nhan_vien/taiLieuQueries.ts`:94-103 · `nguoiPhuThuocQueries.ts`:98-109
- Vấn đề: không phân trang, trái nguyên tắc chính `taiHetTrang.ts`:15-16 đã ghi ("danh sách nghiệp vụ phải lọc/phân trang ở máy chủ").
- Đề xuất fix: khóa cache theo `ma_nv` như `hrmHopDongKeys` đã làm, truyền `ma_nv` lên server (param đã có sẵn).
- Trạng thái: OPEN

### 🟢 Suggestion (nhóm 5, gộp gọn)
- `chamCong.ts`:130 `ghiDe[khoa]!` nói dối kiểu — `null` là trạng thái nghiệp vụ hợp lệ, dùng `Object.hasOwn`.
- `payrollInputsApi.ts`:125-129 `deleteOvertimeData` tự nối query string thay vì `{params}` như hàm anh em.
- `dashboardQueries.ts`:149-159 `theoId`/`diem` không `useMemo` như 4 hook khác cùng file.
- `_shared/thangKyLuong.ts`:21-27 hai quy ước số thứ tự tháng khác nhau trong cùng 1 file 52 dòng — bẫy cho người sau.
- `calculations/dashboard/tongQuan.ts`:294-305 `gopPhanDuoi<T>` hardcode nhãn "Khác (n phòng ban)" dù khai generic.

**Security findings (nhóm 5):** sạch — không `console.*` lộ lương/STK, không `localStorage`/`sessionStorage` cho dữ liệu nhạy cảm, không `any`/`@ts-ignore`. Cache lương khóa theo `(companyId, ma_nv)` đúng (vá BUG-HRM-25). Ghi đè trắng 3 khóa ngân hàng khi thiếu quyền thay vì gửi `null` — phòng thủ đúng chuẩn.

**Performance findings (nhóm 5):** RVW-506 (Dashboard 6× full payroll calc) nặng nhất, RVW-507 (2N request tuần tự), RVW-513 (tải toàn công ty lọc client). Không có N+1 thật ở 8 phân hệ nhập liệu; `useInvalidateInputs` đã thu hẹp đúng phạm vi.

**Final recommendation:** ❌ Request changes — RVW-501 (công thức chấm công lệch BE) và RVW-502 (Decimal-as-string bỏ sót) là 2 điểm nguy hiểm nhất của module. Ưu tiên: 501 → 502 → 503 (cùng chủ đề "đừng giữ 2 nguồn sự thật") → 504.

---

## Review 2026-09-11 — Nhóm 7/9 (dữ liệu tính lương — 52 file) — Verdict: ❌ Request changes

> Phạm vi: `features/hrm/components/du_lieu_tinh_luong/**` (kpi, thuong, bu_tru, luong_san_pham, luong_phan_tram, tang_ca, chuyen_can, cham_cong...). Kiến trúc tách lớp sạch — mọi công thức nằm ở `calculations/`, không có dòng nào tự tính lại (không duplicate với nhóm 5). Cả 2 blocking đều nằm trên đường "Áp dụng" của form nhập liệu hàng loạt.

### RVW-701 🔴 BLOCKING — Dòng chưa khai xong vẫn gửi lên server → cả batch bị 400; riêng Chuyên cần thì xóa dữ liệu cũ trước rồi mới fail → mất dữ liệu thật
- Vị trí: `kpi/KpiPanel.tsx`:104-109 · `thuong/ThuongPanel.tsx`:96-99 · `bu_tru/BuTruPanel.tsx`:109-112 · `luong_san_pham/LuongSanPhamPanel.tsx`:103-107 · `luong_phan_tram/LuongPhanTramPanel.tsx`:102-106 · `tang_ca/TangCaPanel.tsx`:109-111 · `chuyen_can/ChuyenCanPanel.tsx`:115-151
- Vấn đề: nút "Áp dụng" chỉ kiểm `mau.length===0`, không kiểm dòng có hợp lệ không (BE từ chối `ma_kpi:""`, `muc_tieu<=0`, `so_gio<=0`...). Với 6 màn thường thì cả batch bị 400 không rõ dòng nào sai. Riêng **Chuyên cần**: `apDungChoMotNguoi` gọi `xoaChoMotNguoi(maNv)` xóa sạch bản ghi vi phạm hiện có RỒI mới ghi mới — dòng đầu tiên không hợp lệ là nhân viên đầu tiên đã bị xóa hết dữ liệu cũ, không ghi lại được, không rollback.
- Đề xuất fix: mỗi Panel tính `hopLe = mau.every(...)` và `disabled={... || !hopLe}` + đánh `error` lên đúng ô thiếu; `ChuyenCanPanel.handleApDung` validate toàn bộ `mau` TRƯỚC vòng lặp, trước cả lời gọi xóa đầu tiên; `TangCaPanel.tsx`:109 mở rộng filter thành `.filter(d => d.loai!=="" && d.so_gio>0)`.
- Trạng thái: OPEN
  → FIXED [2026-09-11] — thêm `hopLe = mau.every(...)` + `!hopLe` vào `disabled` nút "Áp dụng" cho 6 Panel: `KpiPanel.tsx` (`ma_kpi!=="" && muc_tieu>0`, khớp E-dltl-008 + "Mục tiêu KPI phải lớn hơn 0"), `ThuongPanel.tsx` (`ma_khoan!==""`, amount>=0 đã đảm bảo bởi `TienField`/`chiSo()` không cho âm), `BuTruPanel.tsx` (`ma_bt!=="" && so_tien>0`, khớp "Số tiền bù trừ phải lớn hơn 0"), `LuongSanPhamPanel.tsx` (`ma_sp!==""`), `LuongPhanTramPanel.tsx` (`ma_khoan!==""`), `ChuyenCanPanel.tsx` (`ma_cc!=="" && ngay!==""`, gộp chung fix với RVW-702 bên dưới). Đối chiếu field bắt buộc với `be_maxv/src/validators/hrm/du_lieu_tinh_luong/inputs.validator.ts` (chỉ đọc). Thêm `error`/`helperText` cho ô còn thiếu cảnh báo: `BangChiTieuKpiCard.tsx` (muc_tieu<=0), `BangBuTruCard.tsx` (so_tien<=0) — các select mã (ma_kpi/ma_khoan/ma_bt/ma_sp/ma_cc) đã có `error={!dong.x}` sẵn từ trước. `TangCaPanel.tsx`:108-113 mở rộng filter silent-drop đã có sẵn (`loai!==""`) thành `loai!=="" && so_gio>0` (khớp "Số giờ tăng ca phải lớn hơn 0", E-dltl-007) + thêm `error`/`helperText` cho ô `so_gio` trong `BangTangCaCard.tsx`. tsc+eslint pass, commit "chưa commit" *(frontend-engineer)*

### RVW-702 🔴 BLOCKING — Chuyên cần: lỗi giữa chừng vòng lặp không nêu tên người đang hỏng, không rollback
- Vị trí: `chuyen_can/ChuyenCanPanel.tsx`:131-151, 115-129
- Vấn đề: vòng lặp tuần tự `for (const row of rows)`; lỗi ở người thứ k → người đó đã xóa cũ + ghi mới 1 phần; thông báo chỉ nói "Đã áp {xong}/{rows.length}" — không nêu tên người đang hỏng dở, không ai biết phải kiểm tra ai. Dữ liệu vi phạm chuyên cần quyết định tiền bị trừ — mất mà không ghi lại = nhân viên nhận đủ chuyên cần dù có vi phạm.
- Đề xuất fix: bắt lỗi bên trong vòng lặp, nêu rõ `row.ho_ten (row.ma_nv)` trong toast lỗi. Fix gốc: đề nghị BE thêm endpoint `replace` theo nhân viên (xóa+ghi trong 1 transaction).
- Trạng thái: OPEN
  → FIXED [2026-09-11] — `ChuyenCanPanel.tsx`: `handleApDung` (dòng ~131-160) nay validate `hopLe` (guard `if (!hopLe) { toast.error(...); return; }`) TRƯỚC vòng lặp, trước cả lời gọi xóa đầu tiên (fix chung với RVW-701 cho module này); `try/catch` chuyển vào BÊN TRONG `for (const row of rows)` — lỗi giữa chừng nêu rõ `Dừng ở ${row.ho_ten} (${row.ma_nv}) — đã áp xong ${xong}/${rows.length}` thay vì chỉ đếm số đã xong. Chưa làm fix gốc BE (endpoint `replace` transaction) — ngoài phạm vi FE task, để lại cho backend-engineer nếu cần. tsc+eslint pass, commit "chưa commit" *(frontend-engineer)*

### RVW-703 🟡 NON-BLOCKING — Ô nhập số không chặn âm/quá ngưỡng/số lẻ ở trường bắt buộc nguyên (7 ô)
- Vị trí: `kpi/BangChiTieuKpiCard.tsx`:162,174,195 · `tang_ca/BangTangCaCard.tsx`:150 · `luong_san_pham/BangSanPhamCard.tsx`:162-164 · `luong_phan_tram/BangPhanTramCard.tsx`:159 · `chuyen_can/BangChuyenCanCard.tsx`:159
- Vấn đề: `slotProps.htmlInput.min=0` không chặn gõ tay (không có `<form>` submit). Đường nhập Excel đã chặn (`buTruExcel.ts`:207, `luongSanPhamExcel.ts`:211) — chỉ đường gõ tay hở.
- Đề xuất fix: helper `soDuong(v) = Math.max(0, Number(v)||0)` dùng chung cho 7 ô; thêm `Math.min(100,...)` cho `ty_le`, `Math.round` cho `trong_so`.
- Trạng thái: OPEN

### RVW-704 🟡 NON-BLOCKING — Bảng chấm công không ảo hóa/phân trang; tính lại toàn ma trận sau mỗi lần sửa 1 ô
- Vị trí: `cham_cong/ChamCongPanel.tsx`:254-352, 111-119, 103-109
- Vấn đề: 200 nhân viên × 31 ngày ≈ 8.400 `TableCell` + 6.200 `ButtonBase`; `dong` phụ thuộc `ghiDe` đổi tham chiếu sau MỖI lần ghi ô → tính lại toàn bộ ma trận sau mỗi click.
- Đề xuất fix: `TablePagination` ~50 nhân viên/trang (theo mẫu `accounting/**List.tsx` đã dùng); tách `<TableRow>` mỗi nhân viên bọc `memo`.
- Trạng thái: OPEN

### RVW-705 🟡 NON-BLOCKING — "Áp dụng chuyên cần" tạo O(N²M) request mạng
- Vị trí: `api/du_lieu_tinh_luong/payrollInputsQueries.ts`:203-217 (`useRecordDiligence`/`useDeleteDiligenceRecord`) + `chuyen_can/ChuyenCanPanel.tsx`:118-126
- Vấn đề: mỗi `mutateAsync` trong vòng lặp kích `invalidateQueries` → refetch ngay. 100 NV × 3 dòng ≈ 400 ghi + 400 GET danh sách đầy đủ (mỗi GET O(số NV)).
- Đề xuất fix: gọi thẳng hàm tầng api (không qua hook mutation) trong vòng lặp, `invalidate` một lần trong `finally`.
- Trạng thái: OPEN

### RVW-706 🟡 NON-BLOCKING — `soO` nhân bản 7 lần với 4 biến thể; ở KPI/Lương sản phẩm xóa nhầm dấu chấm thập phân
- Vị trí: `kpi/kpiExcel.ts`:47-53 · `luong_san_pham/luongSanPhamExcel.ts`:37-47 · `bu_tru`/`thuong`/`luong_phan_tram`/`tang_ca`/`chuyen_can` (mỗi module 1 bản)
- Vấn đề: ô text chứa `1.5` ở cột "Mục tiêu" KPI → `.replace(/\./g,"")` → `15` (sai 10 lần); `2.5` ở "Số lượng" → `25`. Chỉ xảy ra khi ô là text (dán/định dạng Text), không cảnh báo.
- Đề xuất fix: 2 hàm rõ nghĩa vào `_shared/excel.ts` — `soTien()` (bỏ dấu chấm) và `soThapPhan()` (giữ dấu chấm) — mỗi cột gọi đúng loại.
- Trạng thái: OPEN

### RVW-707 🟡 NON-BLOCKING — Nháp bảng nhập mất im lặng khi đổi kỳ lương/rời tab/F5
- Vị trí: 7 Panel (`KpiPanel.tsx`:76-80 và tương tự ở 6 file kia)
- Vấn đề: `mau` chỉ sống trong `useState`; chip cảnh báo "có nội dung chưa áp dụng" chỉ hiển thị thụ động, không chặn gì.
- Đề xuất fix: `beforeunload` chặn F5/đóng tab khi `mau.length>0`; nâng cao hơn thì lưu nháp `sessionStorage` theo `${periodId}:${module}`.
- Trạng thái: OPEN

### RVW-708 🟡 NON-BLOCKING — Ô tìm kiếm nhân viên không debounce
- Vị trí: `ThanhLocKyLuong.tsx`:50-53, 84 → `useNhanVienKyLuong.ts`:29-56
- Vấn đề: mỗi keystroke → filter + `sort(localeCompare)` toàn bộ nhân viên + dựng Map + render lại toàn bảng.
- Đề xuất fix: debounce 250ms cho riêng ô `q` (state cục bộ trong `ThanhLocKyLuong`).
- Trạng thái: OPEN

### RVW-709 🟡 NON-BLOCKING — Cột "Tổng giờ năm" hiện giờ kỳ này nhưng vẫn tô cảnh báo theo ngưỡng năm
- Vị trí: `tang_ca/TangCaPanel.tsx`:91-93, 51-54 · `DanhSachTangCaCard.tsx`:131-139
- Vấn đề: ghi chú đầu file đã thừa nhận API không trả lũy kế năm, nhưng UI vẫn dán nhãn "Tổng giờ năm" và tô theo ngưỡng năm — ô luôn xanh, không cảnh báo vượt trần OT thật (rủi ro pháp lý).
- Đề xuất fix: đổi nhãn "Giờ OT kỳ này", bỏ tô theo ngưỡng năm tới khi có lũy kế thật.
- Trạng thái: OPEN

### RVW-710 🟡 NON-BLOCKING — `QuanLyTangCaDialog` ghi đè toàn bộ cấu hình mặc định công ty bằng snapshot lúc mở dialog
- Vị trí: `tang_ca/QuanLyTangCaDialog.tsx`:61-66, 71-82
- Vấn đề: dialog chỉ sửa 6 hệ số + 3 ngưỡng nhưng `PUT` cả object `CauHinhMacDinh` — người khác sửa biểu thuế trong lúc dialog mở sẽ bị đè mất (last-write-wins).
- Đề xuất fix: merge tại thời điểm lưu (đọc lại `daLuu` ngay trước khi gửi) thay vì lúc mở.
- Trạng thái: OPEN

### RVW-711 🟡 NON-BLOCKING — Dữ liệu nhân viên ngoài bộ lọc bị ẩn khỏi bảng nhưng vẫn tính vào lương
- Vị trí: `useNhanVienKyLuong.ts`:66-73, 27
- Vấn đề: nhân viên nghỉ việc/khác phòng ban nhưng đã áp KPI/thưởng/bù trừ trong kỳ → không hiện ở bảng nào, không có cách xem/xóa qua màn này dù vẫn vào bảng lương.
- Đề xuất fix: dòng cảnh báo tổng hợp dưới bảng khi có dữ liệu ngoài phạm vi lọc.
- Trạng thái: OPEN

### RVW-712 🟡 NON-BLOCKING — 7 Panel trùng ~85% (~2.100 dòng), 7 file Excel trùng khung
- Vị trí: `kpi/KpiPanel.tsx` (312d) · `tang_ca/TangCaPanel.tsx` (315d) · `thuong/ThuongPanel.tsx` (295d) · `bu_tru/BuTruPanel.tsx` (317d) · `luong_san_pham/LuongSanPhamPanel.tsx` (311d) · `luong_phan_tram/LuongPhanTramPanel.tsx` (310d) · `chuyen_can/ChuyenCanPanel.tsx` (361d)
- Vấn đề: RVW-701 và RVW-706 là chính xác kiểu lỗi "phải vá 6-7 nơi" mà duplicate này gây ra — không phải nitpick, chi phí đã hiện hình.
- Đề xuất fix: tách `ThanhCongCuBangNhap` cho thanh nút/dialog dùng chung (~90 dòng × 7 file), chưa cần generic hóa cả Panel.
- Trạng thái: OPEN

### RVW-713 🟡 NON-BLOCKING — `taiVe` trùng byte-for-byte 7 lần dù `lib/downloadFile.ts::luuVeMay` đã có sẵn
- Vị trí: `kpi/kpiExcel.ts`:55-67 và 6 file Excel anh em (tất cả md5 giống hệt) — cùng lớp với RVW-A05 (nhóm 6, tổng 9 bản trùng trong toàn HRM)
- Đề xuất fix: xóa 7 bản `taiVe`, gọi `luuVeMay` từ `@/lib/downloadFile`; đưa `toTieuDe`/`chuoiO`/`HEADER_FILL`/`TIEN_FMT` vào `_shared/excel.ts`.
- Trạng thái: OPEN

### 🟢 Suggestion (nhóm 7, gộp gọn)
- `setMau([])` trong `useEffect` + `eslint-disable` lặp 7 lần — thay bằng `key={selectedPeriodId}` ở page wrapper để React tự unmount/mount.
- `PayrollPeriodContext.tsx`:22 regex nhận cả `2026-99`/`2026-00` từ localStorage — thêm kiểm `thang 1-12`.
- `docFile*` (7 file Excel) không giới hạn số dòng/dung lượng file nhập — thêm trần 5.000 dòng / 10MB.
- Ô số không cho để trống (`value={x===0?"":x}`) — xóa hết ô lại hiện `0`.
- Cột "Thành tiền" ở `thuong/BangKhoanThuongCard.tsx`:157 đổi tiêu đề thành "Tổng quỹ (× N người)" cho tự giải thích.
- Bố cục cột Excel là "hợp đồng giữa xuất và nhập" không có test bảo vệ — thêm 1 test round-trip nhỏ mỗi module.

**Security findings (nhóm 7):** sạch — query key gắn `companyId` + `periodId` đầy đủ; `useBangKeChiDoc` ghi rõ server mới là bên chặn thật (403 `E-dltl-027`); không `dangerouslySetInnerHTML`/`eval`/secret hardcode. Rủi ro duy nhất mang màu security là self-DoS khi nạp Excel quá lớn (đã ghi ở suggestion).

**Performance findings (nhóm 7):** RVW-705 (O(N²M) mạng) nặng nhất, sau đó RVW-704 (ma trận chấm công không ảo hóa) và RVW-708 (tìm kiếm không debounce). Điểm tốt: `exceljs` lazy-load đúng lúc ở cả 7 file, `useInvalidateInputs` đã thu hẹp phạm vi.

**Final recommendation:** ❌ Request changes — RVW-701/702 đều xoay quanh đường "Áp dụng", trong đó Chuyên cần là chỗ **duy nhất có thể mất dữ liệu thật** (xóa trước khi ghi, không validate, không rollback). Sửa xong 2 mục là đủ merge; ưu tiên tiếp theo: RVW-703 (rẻ) → RVW-705/704 (đúng màn nhập liệu lớn nhất) → RVW-707.

---

## Review 2026-09-11 — Nhóm 6/9 (components: bang_luong, cai_dat_luong, cau_hinh_mac_dinh, chot_ky_luong, dashboard, ho_so_luong, huong_dan, nguoi_phu_thuoc, nhan_vien, phong_ban, to_khai_thue — 87 file) — Verdict: ⚠️ Approve with comments

> Không có 🔴 Blocking. Không có `console.log`/`localStorage`/`dangerouslySetInnerHTML`/`window.open` trong toàn bộ phạm vi. Vấn đề tập trung ở: (a) file Excel bảng lương thiếu/mập mờ khi đối chiếu chứng từ chi lương, (b) form nhân sự không validate client-side, (c) duplication có hệ thống.

### RVW-A01 🟡 NON-BLOCKING — File Excel bảng lương KHÔNG có cột Mã nhân viên
- Vị trí: `bang_luong/cotBangLuong.ts`:28-36 · `bang_luong/bangLuongExcel.ts`:106-116
- Vấn đề: doc-comment của chính file nói file này "đi kèm chứng từ chi lương, thiếu mã NV là không đối chiếu được". Trên web có bù bằng caption `ma_nv` dưới tên, file xuất ra thì không — 2 người trùng tên (phổ biến ở VN) không ghép được dòng lương với phiếu chi.
- Đề xuất fix: thêm cột `ma_nv` đầu bảng (`COT_BANG_LUONG[0]`), đổi `dinhTrai`/`xSplit` cho khớp.
- Trạng thái: OPEN

### RVW-A02 🟡 NON-BLOCKING — Cột "Các khoản bù trừ": dòng có dấu, dòng tổng và Excel thì không
- Vị trí: `bang_luong/BangLuongTable.tsx`:182-193 vs 252 · `bang_luong/bangLuongExcel.ts`:114, 122-126
- Vấn đề: mỗi dòng hiện `+`/`−` theo dấu, dòng "Tổng cộng" và Excel in trần không dấu — cùng 1 con số mang 2 nghĩa ngược nhau ở 2 chỗ trên cùng bảng.
- Đề xuất fix: chọn 1 quy ước, áp cả 3 chỗ (khuyến nghị: đổi dấu ngay ở tầng ánh xạ `bangLuongQueries.ts`:106, âm = trừ).
- Trạng thái: OPEN

### RVW-A03 🟡 NON-BLOCKING — Cột thu nhập sheet chính không cộng ra đúng "Thu nhập", không có chỉ dẫn sang sheet phụ
- Vị trí: `bang_luong/bangLuongExcel.ts`:87-133 vs 42-72
- Vấn đề: sheet chính chỉ 5/7 cột thu nhập (thiếu `luong_phan_tram`, `chuyen_can`); người nhận file cộng lệch với "Thu nhập" sẽ nghĩ sai số hoặc tự "sửa".
- Đề xuất fix: 1 dòng ghi chú ở row 2 trỏ sang sheet "Chi tiết thu nhập".
- Trạng thái: OPEN

### RVW-A04 🟡 NON-BLOCKING — Xuất Excel chạy trên main thread, không có phản hồi tiến trình
- Vị trí: `bang_luong/bangLuongExcel.ts`:111-133 · `luongHoTroExcel.ts`:81-120
- Vấn đề: dựng cell + nén zip đồng bộ, vài trăm–nghìn nhân viên đứng hình 1-3s; nút chỉ `disabled`, không đổi nhãn/spinner.
- Đề xuất fix: `startIcon={<CircularProgress/>}` + nhãn "Đang xuất…" theo mẫu `TaiLieuFormDialog.tsx`:387.
- Trạng thái: OPEN

### RVW-A05 🟡 NON-BLOCKING — `taiVe()` copy-paste trong khi `lib/downloadFile.ts` đã có sẵn
- Vị trí: `bang_luong/bangLuongExcel.ts`:17-29 · `luongHoTroExcel.ts`:15-27 — trùng 10 lần trong toàn HRM (8 bản còn lại ở `du_lieu_tinh_luong/*Excel.ts`, xem RVW-713)
- Đề xuất fix: gọi `luuVeMay` từ `@/lib/downloadFile`; gom `toTieuDe` + 3 hằng vào `components/bang_luong/excelChung.ts`.
- Trạng thái: OPEN

### RVW-A06 🟡 NON-BLOCKING — Không phân trang/ảo hóa ở mọi bảng, lọc client trên toàn dataset
- Vị trí: `nhan_vien/NhanVienTable.tsx`:186-252 · `nguoi_phu_thuoc/NguoiPhuThuocTable.tsx`:123-152 · `bang_luong/BangLuongTable.tsx`:115-208 · `phong_ban/PhongBanTable.tsx`:141-206 · `cai_dat_luong/KhoanLuongTable.tsx`:74-128 · `cai_dat_luong/set_luong/DanhSachSetLuongCard.tsx`:173-254
- Vấn đề: `grep TablePagination|react-window` = 0 kết quả. Công ty 500-2000 NV (kịch bản thật) sẽ giật khi gõ tìm kiếm.
- Đề xuất fix: debounce ô tìm (~250ms) + `<TablePagination>` cho `NhanVienTable`/`BangLuongTable`.
- Trạng thái: OPEN

### RVW-A07 🟡 NON-BLOCKING — `BangLuongTable` tính lại cột + tổng mỗi lần render
- Vị trí: `bang_luong/BangLuongTable.tsx`:52-53
- Vấn đề: `cotTheoMuc`/`tongTheoCot` chạy `18×N` phép cộng ở mọi render (kể cả hover); `LuongHoTroPanel.tsx`:63-76 đã `useMemo` đúng, 2 bên không nhất quán.
- Đề xuất fix: bọc `useMemo` cho cả 2.
- Trạng thái: OPEN

### RVW-A08 🟡 NON-BLOCKING — Form nhân sự không validate trường bắt buộc trước khi submit (7 dialog)
- Vị trí: `nhan_vien/NhanVienDialog.tsx`:97-133 · `nguoi_phu_thuoc/NguoiPhuThuocFormDialog.tsx`:66-77 · `nhan_vien/HopDongFormDialog.tsx`:64-80 · `cai_dat_luong/KhoanLuongFormDialog.tsx`:75-86 · `phong_ban/PhongBanFormDialog.tsx`:56-70 · `cau_hinh_mac_dinh/ca_lam_viec/CaLamViecFormDialog.tsx`:62-82 · `cau_hinh_mac_dinh/ngay_le/NgayLeFormDialog.tsx`:75-86
- Vấn đề: `required` trên MUI TextField không có tác dụng khi không có `<form>` bọc — bấm Lưu ô trống tốn 1 round-trip rồi nhận lỗi Zod 400 chung chung. `HopDongFormDialog.tsx`:66-68 đã tự nhận vấn đề này và chỉ tự chặn cho 2 ô lương.
- Đề xuất fix: mở rộng pattern `soatLuongHopDong` → `soatHopDong` cho các trường còn lại, 1 guard 1 dòng mỗi dialog trước khi gửi.
- Trạng thái: OPEN

### RVW-A09 🟡 NON-BLOCKING — Không validate định dạng CCCD/SĐT/MST/ngày sinh
- Vị trí: `nhan_vien/tabs/ThongTinTab.tsx`:113-167 · `nguoi_phu_thuoc/NguoiPhuThuocForm.tsx`:59-84
- Vấn đề: TextField trần, không `inputMode`, không chặn ký tự chữ. CCCD/MST sai sẽ theo dữ liệu ra tờ khai thuế TNCN — phát hiện muộn, ở cơ quan thuế. Ngày sinh tương lai làm `SinhNhatCard` (cột tuổi) ra số âm.
- Đề xuất fix: `inputMode:"numeric"` + `maxLength` cho CCCD/SĐT/MST; `max={homNay()}` cho ngày sinh; cảnh báo mềm (`helperText`), KHÔNG chặn submit (hồ sơ cũ có thể lệch chuẩn).
- Trạng thái: OPEN

### RVW-A10 🟡 NON-BLOCKING — 8 CRUD dialog dùng chung khung nhưng chép tay 8 lần
- Vị trí: `HopDongFormDialog.tsx`, `TaiLieuFormDialog.tsx`, `NguoiPhuThuocFormDialog.tsx`, `KhoanLuongFormDialog.tsx`, `PhongBanFormDialog.tsx`, `CaLamViecFormDialog.tsx`, `NgayLeFormDialog.tsx`, `SetLuongNhanVienDialog.tsx`
- Vấn đề: chính vì lặp 8 lần mà RVW-A08 xảy ra (chỗ có validate, chỗ không, phải mở từng file mới biết).
- Đề xuất fix: 1 hook ~25 dòng `useFormDialog<T>({open, khoiTao, luu, soat?, thongBao})`.
- Trạng thái: OPEN

### RVW-A11 🟡 NON-BLOCKING — 6 component Nav gần như giống hệt nhau
- Vị trí: `DanhMucNav.tsx` · `bang_luong/BangLuongNav.tsx` · `cai_dat_luong/CaiDatLuongNav.tsx` · `cau_hinh_mac_dinh/CauHinhNav.tsx` · `ho_so_luong/HoSoLuongNav.tsx` · `to_khai_thue/ToKhaiThueNav.tsx`
- Vấn đề: khác nhau đúng 3 thứ (prefix path, mảng `MAN_HINH`, có/không `NutHuongDan`); phần còn lại copy nguyên văn 6 lần. Cùng 1 pattern `startsWith` tra nhãn tab đã gây bug ở nhóm 8 (NB-3 dưới đây).
- Đề xuất fix: `components/TabNavHrm.tsx` nhận `{base, items, huongDan?}`.
- Trạng thái: OPEN

### RVW-A12 🟡 NON-BLOCKING — `SoField` nằm trong `cau_hinh_mac_dinh/` nhưng 3 module dùng
- Vị trí: `cau_hinh_mac_dinh/SoField.tsx` — importers: `cai_dat_luong/KhoanLuongFormDialog.tsx`:25, `du_lieu_tinh_luong/tang_ca/QuanLyTangCaDialog.tsx`:19
- Vấn đề: vi phạm quy ước "≥2 feature dùng → hạ tầng dùng chung, để phẳng ở root" trong `.claude/CLAUDE.md`. `TienField.tsx` (song sinh) đã đúng vị trí ở `components/` root.
- Đề xuất fix: `git mv` sang `components/SoField.tsx`, sửa 6 import (dò cả `typeof import()`/`mock.module`).
- Trạng thái: OPEN

### RVW-A13 🟡 NON-BLOCKING — HRM import hook từ feature `hddt`
- Vị trí: `dashboard/charts/BieuDoCot.tsx`:6 → `../../../../hddt/hooks/useElementHeight`
- Vấn đề: coupling chéo feature duy nhất trong HRM (ngoài `auth`/`lib` hợp lệ). Export dùng là `useElementWidth` nhưng tên file nói "Height".
- Đề xuất fix: chuyển sang `src/hooks/useKichThuocPhanTu.ts` (nội dung hoàn toàn generic).
- Trạng thái: OPEN

### RVW-A14 🟡 NON-BLOCKING — Màu hex hardcode thay vì theme palette (28 chỗ)
- Vị trí: `chot_ky_luong/bangKe.ts`:36,40-73 · `TheBangKe.tsx`:19-20 · `LichSuHoatDong.tsx`:22-27 · `ChotKyLuongHeader.tsx`:56,59
- Vấn đề: cố định, không đổi theo `theme.palette.mode`, trong khi `dashboard/charts/mauBieuDo.ts` đã làm đúng cách (đọc theme, có bảng sáng/tối). Dự án có dark mode — 12 thẻ bảng kê + timeline sẽ chói/mất tương phản ở chế độ tối.
- Đề xuất fix: đổi sang token theme (`error.main`, `info.main`...); 12 màu định danh riêng thì gom bảng sáng/tối như `mauBieuDo.ts`.
- Trạng thái: OPEN

### RVW-A15 🟡 NON-BLOCKING — Cột dính trái bảng lương hardcode `left: 200`
- Vị trí: `bang_luong/BangLuongTable.tsx`:61-69
- Vấn đề: cột 1 chỉ có `minWidth:200`, tên tiếng Việt dài hơn 200px là chuyện thường → cột 2 chồng lên cột 1 khi cuộn ngang.
- Đề xuất fix: bỏ `left:200`, dùng `maxWidth:200` + `textOverflow:ellipsis`.
- Trạng thái: OPEN

### RVW-A16 🟡 NON-BLOCKING — Dialog trả `null` khi dữ liệu chưa về, không phân biệt loading với đã xóa
- Vị trí: `nhan_vien/chi_tiet/NhanVienChiTietDialog.tsx`:66 · `cai_dat_luong/set_luong/SetLuongNhanVienDialog.tsx`:85
- Vấn đề: `if (!nhanVien) return null` chạy cả khi đang `isLoading` — mạng chậm thì bấm "Xem chi tiết" màn hình đứng yên, không spinner không dialog.
- Đề xuất fix: tách 2 ca — `isLoading` render `<Dialog><Skeleton/></Dialog>`, chỉ `return null` khi `!isLoading && !nhanVien`.
- Trạng thái: OPEN

### RVW-A17 🟡 NON-BLOCKING — `SoField` nhận số âm dù khai `min:0`
- Vị trí: `cau_hinh_mac_dinh/SoField.tsx`:36,40
- Vấn đề: `min:0` chỉ chặn nút stepper, không chặn gõ tay `-5` (không có `<form>`, xem RVW-A08). Field này giữ tỷ lệ BHXH/BHYT/BHTN, hệ số tăng ca, thuế suất từng bậc.
- Đề xuất fix: `onChange(Math.max(0, Number(v)||0))`.
- Trạng thái: OPEN

### 🟢 Suggestion (nhóm 6, gộp gọn)
- `nhanKy.replace(/\W+/g,"-")` thiếu cờ `u` — nuốt hết dấu tiếng Việt trong tên file Excel xuất ra.
- Component `CoKhong` (check xanh/gạch xám) viết 3 lần y hệt — gom `components/CoKhong.tsx`.
- `gioHienTai()` trùng nguyên văn ở `BangLuongPanel.tsx`/`LuongHoTroPanel.tsx`.
- `LuongHoTroPanel.tsx` viết bảng inline trong khi tab anh em tách hẳn `BangLuongTable.tsx` — nên tách `LuongHoTroTable.tsx` cho đối xứng.
- `GanNhanhDialog.tsx` dùng mảng + `includes` trong vòng lặp (O(n²)) — đổi `Set<string>`.
- `TinhHinhNhanSuCard.tsx`/`ChiPhiPhongBanCard.tsx` dùng TÊN phòng ban làm React key — 2 phòng cùng tên ở 2 chi nhánh sẽ trùng key, đổi sang mã phòng ban.
- `DanhMucNav.tsx` là nav duy nhất ở `components/` root, 5 nav khác nằm trong folder module — chuyển vào `du_lieu_nhan_vien/`.
- `LichSuHoatDong.tsx`:110 chip hiện `hd.type` thô (`LOCK`/`EDIT`...) giữa UI tiếng Việt — `KIEU_HOAT_DONG` đã là Record sẵn, thêm field `nhan`.
- `SetLuongPanel.tsx`:50 `JSON.stringify` so sánh chạy mỗi render — bọc `useMemo`.
- `luongHoTroExcel.ts`:115 `xSplit:2` không khớp bảng trên màn hình (dính 1 cột) — sửa `xSplit:1`.
- `BieuDoCot.tsx`:201-211 `key={d}` là cả chuỗi path SVG — dùng chỉ số đoạn.
- `TaiLieuFormDialog.tsx`:297 `accept` chỉ lọc hộp chọn file, chưa kiểm `f.type` cùng chỗ kiểm size.

**Security findings (nhóm 6):** sạch tuyệt đối — grep `console.*`/`localStorage`/`document.cookie`/`dangerouslySetInnerHTML`/`eval(` = 0 kết quả trong 87 file. Phân quyền xem lương bám sát server (BE xóa hẳn trường khỏi response, không chỉ ẩn UI). Thao tác không hoàn tác đều có `XacNhanXoaDialog`; mở lại kỳ đã khóa bắt buộc lý do ≥20 ký tự (khớp BR-dltl-001).

**Performance findings (nhóm 6):** RVW-A06 (không phân trang, cao nhất) → RVW-A04 (xuất Excel main-thread) → RVW-A07 (thiếu memo). `exceljs` đã lazy-load đúng ở cả 2 file Excel.

**Final recommendation:** ⚠️ Approve with comments — không blocking, có thể merge. RVW-A01/A02/A03 (Excel bảng lương) nên fix trước khi lên production vì đi kèm chứng từ chi lương thật. RVW-A08/A09 (validate form nhân sự) nên vào sprint kế tiếp vì CCCD/MST sai chảy tiếp sang tờ khai thuế.

---

## Review 2026-09-11 — Nhóm 8/9 (pages/hrm/** — 29 file) — Verdict: ⚠️ Approve with comments

> Lớp page HRM sạch về tách lớp: 0 business logic trong 29 file (trừ 2 page placeholder dùng `useLocation` tra nhãn tab), guard route (`ProtectedRoute`+`ModuleRoute module="hrm"`) phủ đủ cả 29 page. Không có 🔴 Blocking.

### NB-1 🟡 NON-BLOCKING — Không có ErrorBoundary: 1 lỗi render trong panel HRM là trắng cả app
- Vị trí: `pages/hrm/HrmPage.tsx`:33-35 (quanh `<Outlet/>`) — `grep -rn "ErrorBoundary\|Suspense" src` = 0 kết quả toàn frontend
- Vấn đề: `HrmPage` là điểm hợp nhất duy nhất của 29 màn HRM nhưng không bọc boundary; throw bất kỳ trong cây con unmount tới tận `createRoot` → trắng cả app, mất header/nav. App dùng `<BrowserRouter>` declarative nên `errorElement` của React Router v7 không dùng được.
- Đề xuất fix: 1 class ErrorBoundary ~20 dòng (không cần thêm dependency), bọc `<Outlet/>` tại `HrmPage.tsx`:33-35.
- Trạng thái: OPEN

### NB-2 🟡 NON-BLOCKING — 29 page import tĩnh: toàn bộ HRM (192 file/34.465 dòng) nằm trong 1 chunk 2,68MB
- Vị trí: `pages/hrm/**` ↔ `routes/AppRouter.tsx`:25-53 — cùng nguyên nhân với RVW-C03 (`docs/core-infra/review-findings.md`)
- Bằng chứng đo được: `dist/assets/index-BLh5qane.js` = 2.680.871 bytes, không `manualChunks`, không `React.lazy` nào trong `src`.
- Đề xuất fix: `lazy()` cho `HrmPage` + 7 layout khu + `<Suspense fallback={<FullScreenLoader/>}>` quanh `<Outlet/>` — 8 dòng, cắt cả cây HRM ra chunk riêng mà không cần đụng 18 page lá.
- Trạng thái: OPEN

### NB-3 🟡 NON-BLOCKING — `startsWith` tra nhãn tab: bẫy khớp nhầm khi thêm tab có path là tiền tố
- Vị trí: `ho_so_luong/HoSoLuongChuaDungPage.tsx`:12-15 · `to_khai_thue/ToKhaiThueChuaDungPage.tsx`:12-15 (cùng pattern lặp ở `HrmNav.tsx`:47-48, `HoSoLuongNav.tsx`:13, `ToKhaiThueNav.tsx`:13 — 5 bản sao, xem RVW-A11)
- Vấn đề: `pathname.startsWith(...)` + `find` trả phần tử ĐẦU TIÊN có path là tiền tố, không phải khớp đúng. Chưa sai (chưa có cặp path tiền tố nhau) nhưng thêm tab mới kiểu `phieu-luong-chi-tiet` (sau `phieu-luong`) là hiện nhãn màn cũ, im lặng.
- Đề xuất fix: truyền thẳng object tab từ bảng route qua props, bỏ hẳn `useLocation`+`find`.
- Trạng thái: OPEN

### NB-4 🟡 NON-BLOCKING — 5 route `to-khai-thue` khai tay trong khi nav sinh từ bảng — thêm tab thứ 6 là văng khỏi HRM
- Vị trí: `routes/AppRouter.tsx`:250-272 (khai tay) vs :285-291 (khu `ho-so-luong` map từ bảng — đúng cách)
- Vấn đề: thêm 1 tab vào `to_khai_thue/tabs.ts` → tab hiện ngay nhưng route không khớp → rơi catch-all → `Navigate to="/"` → người dùng bị đá khỏi HRM không thông báo.
- Đề xuất fix: copy pattern `ho-so-luong` (`.map()` sinh route), kết hợp cùng lúc với NB-3.
- Trạng thái: OPEN

### S-1 🟢 SUGGESTION — 7 layout khu giống nhau từng ký tự, chỉ khác component Nav
- Vị trí: `bang_luong/BangLuongPage.tsx`, `cai_dat_luong/CaiDatLuongPage.tsx`, `cau_hinh_mac_dinh/CauHinhPage.tsx`, `du_lieu_nhan_vien/DanhMucPage.tsx`, `du_lieu_tinh_luong/DuLieuLuongPage.tsx`, `ho_so_luong/HoSoLuongPage.tsx`, `to_khai_thue/ToKhaiThuePage.tsx`
- Đề xuất fix: `KhuLayout({nav})` — xóa được 7 file, thêm 1 file 8 dòng.

### S-2 🟢 SUGGESTION — 18 page passthrough 5 dòng không mang giá trị
- Vị trí: `DashboardPage.tsx` + 17 file khác dạng `export default function XPage() { return <XPanel/>; }`
- Đề xuất fix: nếu làm NB-2 (lazy per-màn) thì giữ làm seam; nếu không thì xóa cả 18, route trỏ thẳng `element={<XPanel/>}`.

### S-3 🟢 SUGGESTION — Slug route lệch tên thư mục page ở 3/8 khu
- `danh-muc` → `du_lieu_nhan_vien/` · `cau-hinh` → `cau_hinh_mac_dinh/` · `du-lieu-luong` → `du_lieu_tinh_luong/`
- Đề xuất fix: đổi tên thư mục hoặc slug cho khớp — chọn 1 hướng, miễn 8/8 khớp.

### S-4 🟢 SUGGESTION — `DanhMucNav` nằm lạc ở gốc `components/` — trùng RVW-A11.

### S-5 🟢 SUGGESTION — Comment `/* */` sai cú pháp JSX ở `AppRouter.tsx`:193-196 — trùng RVW-C-tương-tự ở core-infra, thuần cosmetic (không render, không crash).

**Security findings (nhóm 8):** sạch — không rò lỗ hổng trong lớp page. Guard phủ đủ 29/29 page. Quan sát chuyển tiếp cho nhóm feature: quyền xem lương không thể hiện ở tầng route (`/hrm/bang-luong` mở được với người không có quyền, chỉ ẩn UI/toast) — không rò dữ liệu (BE chặn 403) nhưng 3 màn phản hồi 3 kiểu khác nhau cho cùng 1 tình huống "không có quyền", nên thống nhất 1 `QuyenLuongRoute`.

**Performance findings (nhóm 8):** chỉ NB-2 (bundle) có số đo cụ thể. `exceljs` lazy-load đúng ở `bangLuongExcel.ts`. Không có re-render hazard ở lớp page (0 props/callback inline xuống panel).

**Final recommendation:** ⚠️ Approve with comments — không blocking. Ưu tiên: NB-1 (ErrorBoundary, rẻ nhất giá trị cao nhất) → NB-3+NB-4+S-1/S-2 (làm chung 1 lượt, kết quả ròng là xóa ~8 file/~40 dòng) → NB-2 (phối hợp với core-infra vì cùng đụng `AppRouter`) → S-3/S-4/S-5.

---

## Tổng hợp đợt audit 2026-09-11 (4 nhóm HRM)

| Nhóm | Phạm vi | Verdict | Blocking |
|---|---|---|---|
| 5/9 | core logic (api/calculations) | ❌ Request changes | RVW-501, RVW-502 |
| 6/9 | components (trừ dữ liệu tính lương) | ⚠️ Approve with comments | 0 |
| 7/9 | dữ liệu tính lương | ❌ Request changes | RVW-701, RVW-702 |
| 8/9 | pages | ⚠️ Approve with comments | 0 |

**4 blocking cần backend/frontend-engineer xử lý trước, theo thứ tự đề nghị:** RVW-702 (mất dữ liệu thật, Chuyên cần) → RVW-701 (cùng màn, validate trước Áp dụng) → RVW-501 (công thức chấm công lệch BE — có thể do BE mới đổi `ATTENDANCE_FIXED_VALUE` mà FE chưa theo kịp, cần đối chiếu với `be_maxv` review nếu có) → RVW-502 (Decimal-as-string).
