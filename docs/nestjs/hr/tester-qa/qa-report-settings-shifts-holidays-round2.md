# BÁO CÁO KIỂM THỬ CHẤT LƯỢNG (QA TEST REPORT) — ĐỢT 6 (ROUND 2 — RÀ SOÁT ĐỘC LẬP)

## Phân hệ: HR Master Data — Cấu hình mặc định, Ca làm việc & Lịch ngày lễ

> ⚠️ **Báo cáo này SUPERSEDES `docs/hr/tester-qa/qa-report-settings-shifts-holidays.md` (đợt 5)** — báo cáo đợt 5 đã bị phát hiện **xác nhận SAI** hành vi vi phạm BR-hr-025 (coi việc lưu ca với giờ công ròng = 0 là kết quả ĐÚNG, trong khi BR-hr-025 yêu cầu giờ công ròng phải LỚN HƠN 0). Xem chi tiết bằng chứng ở Mục 2. Báo cáo đợt 5 KHÔNG được xoá (lưu lại làm lịch sử/bài học), nhưng **không còn giá trị làm căn cứ release**.

- **Người thực hiện**: Agent Tester-QA (rà soát độc lập, không sử dụng lại số liệu của báo cáo đợt 5 hay báo cáo tự khai của Backend Engineer — mọi con số trong báo cáo này do chính Agent QA tự chạy lại)
- **Thời gian thực hiện**: 2026-09-05
- **Mã đợt kiểm thử**: QA-HR-PHASE-6-ROUND2
- **Trạng thái tổng thể**: ✅ **APPROVED** — 3 bug (2 Blocking + 1 High) đã được xác nhận fix đúng, có bằng chứng test tự động + test thủ công độc lập, không phát hiện regression. Có 2 ghi nhận Low severity (tài liệu SRS/API contract chưa cập nhật mã lỗi mới, và 1 khoảng trống test permanent nhỏ) — không chặn release.

---

## 1. Mục tiêu & phạm vi rà soát đợt này

Nhiệm vụ được giao: xác minh ĐỘC LẬP (không tin suông báo cáo cũ, không tin suông lời khai của Backend Engineer) rằng 3 bug sau đã được fix đúng và không tạo regression:

1. **[Blocking] BR-hr-025** — `WorkShift` cho phép lưu ca với giờ công ròng (tổng thời lượng ca trừ nghỉ giữa ca) ≤ 0.
2. **[Blocking] BR-hr-026** — `PATCH /holidays/:id` bypass được ràng buộc "lễ âm lịch không được lặp lại hàng năm" khi client chỉ gửi 1 trong 2 field (`type` hoặc `isAnnual`).
3. **[High] Race condition** — `quickGenerate()` dùng vòng lặp `findUnique` + `create` tuần tự thay vì `createMany` nguyên tử như ADR-005 đã quyết định.

Phương pháp: (A) tự đọc lại toàn bộ code đã sửa + test liên quan; (B) tự chạy lại lint/build/unit/e2e từ đầu; (C) viết thêm test thủ công tạm thời (không commit) để dò các edge case task yêu cầu; (D) đối chiếu với BR/FR/Error Matrix trong SRS.

---

## 2. Vì sao báo cáo đợt 5 SAI — bằng chứng cụ thể

Đối chiếu `docs/hr/tester-qa/qa-report-settings-shifts-holidays.md` (đợt 5) với `docs/hr/srs/hr-spec.md`:

| Nguồn | Nội dung |
|---|---|
| SRS `hr-spec.md` dòng 313 | **BR-hr-025** — "...Tổng thời gian làm việc thực tế của ca sau khi trừ thời gian nghỉ giữa ca phải **LỚN HƠN 0 giờ**." |
| Báo cáo đợt 5, Mục 3.2 điểm 1 (dòng 96 cũ) | "**Ca có thời gian nghỉ vượt quá độ dài ca** (`08:00` đến `12:00` = 4h, nghỉ 300 phút = 5h): Hệ thống tự động clamp `Math.max(0, ...)` -> `workingHours: 0`, không xảy ra số âm -> **201 Created**." — báo cáo đợt 5 ghi nhận `201 Created` với `workingHours: 0` là kết quả **ĐÚNG**. |

→ Đây là **ngược hoàn toàn** với BR-hr-025 (yêu cầu > 0, không phải ≥ 0). Test cũ (dòng ~465-477 trong `test/settings-shifts-holidays.e2e-spec.ts` trước khi sửa) **chủ động assert** `.expect(201)` cho case này — tức QA đợt 5 không chỉ bỏ sót mà còn viết test khẳng định hành vi sai là đúng, khiến bug này "xanh" trong suốt 25/25 test pass của đợt 5.

Bug 2 (Holiday PATCH bypass) và Bug 3 (race condition trong `quickGenerate`) không xuất hiện trong bất kỳ test case nào của đợt 5 (đợt 5 chỉ test case gửi ĐỦ cả 2 field `type`+`isAnnual` cùng lúc, và chỉ test `quickGenerate` tuần tự không có concurrent request) — đây là bug bị **bỏ sót** hoàn toàn, không phải xác nhận sai.

---

## 3. Kết quả build/lint/test — TỰ CHẠY LẠI (2026-09-05, không dùng số liệu cũ)

Toàn bộ lệnh dưới đây được Agent QA tự chạy trực tiếp trong phiên làm việc này, có log đầy đủ:

| Lệnh | Kết quả THẬT | Exit code |
|---|---|---|
| `cd Backend && npm run lint` | `oxlint src/ test/ prisma/` — không có dòng lỗi/cảnh báo nào được in ra | `0` ✅ |
| `cd Backend && npm run build` | `nest build` hoàn tất, không có lỗi biên dịch | `0` ✅ |
| `cd Backend && npm test` | **255 passed / 255 tests** (20 test files), 0 fail | `0` ✅ |
| `cd Backend && npm run test:e2e` | **228 passed / 228 tests** (8 test files), 0 fail — chạy trên Postgres 17 thật (Docker container `hrm_accounting`, port 5435, đang `healthy`) | `0` ✅ |
| `npx vitest run --config ./vitest.config.e2e.ts test/settings-shifts-holidays.e2e-spec.ts --reporter=verbose` (chạy riêng để đếm chính xác + xem tên từng test) | **29 passed / 29 tests** — liệt kê đủ tên toàn bộ 29 test, bao gồm 4 test mới cho 3 bug fix | `0` ✅ |

**Môi trường xác nhận**: `docker ps` cho thấy container `hrm_accounting` (postgres:17-alpine, port 5435) đang `Up ... (healthy)` tại thời điểm chạy — không có tình huống "thiếu Docker/Postgres" nên toàn bộ 228 e2e test đều chạy thật trên DB thật, không phải giả định/skip.

Số liệu này KHỚP với số liệu Backend Engineer tự báo cáo (255/255 unit, 228/228 e2e, 29/29 cho suite liên quan) — nhưng ở đây là do QA **tự chạy lại từ đầu**, không phải sao chép.

---

## 4. Xác minh độc lập từng bug fix (đọc code)

### 4.1 Bug 1 — BR-hr-025: WorkShift giờ công ròng ≤ 0

File: `Backend/src/hr/work-shifts/work-shifts.service.ts`.

- Hàm `calcDuration(startTime, endTime)` tách riêng, tính `{isOvernight, totalDuration}` thuần theo phút — dùng chung cho cả `computeShiftFields` (hiển thị) và `assertPositiveWorkingHours` (validate). Công thức: `isOvernight = endTotal <= startTotal`; `totalDuration = isOvernight ? 1440 - startTotal + endTotal : endTotal - startTotal`.
- `assertPositiveWorkingHours()` ném `HrError({code: 'E-hr-037', httpStatus: 400})` khi `totalDuration - breakMinutes <= 0` (đúng rule "phải LỚN HƠN 0", biên `= 0` cũng bị từ chối).
- Gọi ở **cả `create()`** (dùng thẳng `dto`) **và `update()`** — ở `update()`, code merge đúng: `{startTime: dto.startTime ?? existing.startTime, endTime: dto.endTime ?? existing.endTime, breakMinutes: dto.breakMinutes ?? existing.breakMinutes}` TRƯỚC khi validate, xử lý đúng trường hợp PATCH chỉ gửi 1 field (`UpdateWorkShiftDto` là partial).
- Mã lỗi `E-hr-037` đã đăng ký đầy đủ trong `Backend/src/common/hr-errors.ts` (message + httpStatus 400).

**Xác minh công thức cho ca qua đêm (điểm task yêu cầu đặc biệt kiểm tra)**: đã tự viết 3 test thủ công tạm thời (Vitest, không commit — xem Mục 5.1) để xác nhận `calcDuration` tính đúng `totalDuration` cho ca qua đêm TRƯỚC khi so với `breakMinutes`, không bị lỗi off-by-logic khi `isOvernight = true`. Cả 3 test PASS. File tạm đã được xoá ngay sau khi xác nhận (không để lại rác trong repo).

Test tự động (đã đọc + xác nhận chạy pass):
- `work-shifts.service.spec.ts`: 5 test mới — `create()` reject biên `net <= 0` (bao gồm biên `net = 0`), `update()` reject khi PATCH riêng `breakMinutes` làm net ≤ 0 (merge đúng với `startTime`/`endTime` hiện có), và case PATCH hợp lệ khi net vẫn dương.
- `test/settings-shifts-holidays.e2e-spec.ts`: test cũ sai (dòng ~465-477, kỳ vọng `201`) đã được sửa thành kỳ vọng `400` + `E-hr-037`; thêm test biên `net = 0` và test PATCH.

**Kết luận Bug 1**: ✅ Fix đúng, đúng vị trí (cả create + update), có test cover biên và ca qua đêm, không phát hiện regression.

### 4.2 Bug 2 — BR-hr-026: Holiday PATCH bypass

File: `Backend/src/hr/holidays/holidays.service.ts`.

- `update()` giờ tính `mergedType = dto.type ?? existing.type` và `mergedIsAnnual = dto.isAnnual ?? existing.isAnnual` (lấy `existing` từ `findById()` — tức từ DB, không phải từ payload) TRƯỚC khi check `mergedType === LUNAR && mergedIsAnnual === true` → ném `E-hr-035` (400).
- DTO-layer `.refine()` cũ trong `update-holiday.schema.ts` **vẫn giữ nguyên** — chỉ bắt được case gửi ĐỦ cả 2 field cùng lúc trong 1 payload (vì `.refine` chỉ soi trên `data` đã parse của chính request, không biết state hiện tại trong DB). Lớp Service mới là lớp bổ sung bắt đúng case bypass (chỉ gửi 1 field).

**Xác minh không có false-positive (điểm task yêu cầu đặc biệt kiểm tra)**: đã viết 2 test thủ công tạm thời xác nhận rằng khi PATCH KHÔNG đụng tới `type`/`isAnnual` (chỉ đổi `note`/`name`), hàm **KHÔNG throw**, kể cả khi bản ghi hiện tại đã là `LUNAR + isAnnual:false` (case dễ gây false-positive nhất nếu code merge sai). Cả 2 test PASS. File tạm đã xoá sau khi xác nhận.

Test tự động (đã đọc + xác nhận chạy pass):
- `holidays.service.spec.ts`: 2 test mới xác nhận bypass bị chặn khi PATCH chỉ gửi `isAnnual:true` (existing LUNAR) hoặc chỉ gửi `type:LUNAR` (existing `isAnnual:true`).
- `test/settings-shifts-holidays.e2e-spec.ts` dòng 829-859: test case `(a)` và `(b)` E2E-level cho đúng 2 kịch bản bypass trên thật qua HTTP, cả 2 đều trả `400`/`E-hr-035`.
- Case "PATCH chỉ đổi field không liên quan (`note`)" **đã có sẵn** ở test dòng 683-690 (patch `{note: '...'}` trên record tạo với `type: COMPANY, isAnnual: false` → `200 OK`), gián tiếp xác nhận không có false-positive cho trường hợp đơn giản — nhưng **chưa có test permanent riêng cho trường hợp existing record là LUNAR** (chỉ được xác nhận qua test thủ công tạm thời của QA, xem ghi chú Mục 7).

**Kết luận Bug 2**: ✅ Fix đúng, merge đúng chiều (DB state, không phải payload), có test HTTP-level cho cả 2 hướng bypass, không có false-positive khi patch field không liên quan.

### 4.3 Bug 3 — quickGenerate race condition

File: `Backend/src/hr/holidays/holidays.service.ts`.

- Đã viết lại đúng theo ADR-005: thay vòng lặp tuần tự bằng 1 lệnh `prisma.holiday.createMany({data: rows, skipDuplicates: true})` (atomic ở tầng Postgres) + `findMany` lấy lại danh sách bản ghi theo `OR: rows.map(r => ({date, name}))` để trả về `items` đầy đủ.
- Response shape giữ nguyên (`year`, `totalStandard`, `addedCount`, `skippedCount`, `items`) — không phá contract Mục 15.5 của `hr-api-contract.md`.

**Xác minh 2 kịch bản task yêu cầu đặc biệt kiểm tra**:
- *Kịch bản "gọi lần 2 khi cả 11 ngày đã tồn tại sẵn"*: đã có sẵn test e2e thật (dòng 648-672, gọi `quick-generate` năm 2026 hai lần liên tiếp) — đã tự chạy lại và xác nhận PASS: lần 2 trả đúng `addedCount: 0`, `skippedCount: 11`, và **`items.length: 11`** (không bị rỗng — `findMany` vẫn trả đủ vì query theo `[date, name]` không phụ thuộc vào việc bản ghi vừa được tạo hay đã có sẵn từ trước).
- *Kịch bản race condition thật*: test dòng 749-793 gọi 2 request `quick-generate` đồng thời (`Promise.all`) cho năm 2029 (năm riêng, không đụng data test khác) — đã tự chạy lại và xác nhận PASS: không request nào trả `500`, tổng `addedCount` của 2 response cộng lại đúng bằng `11`, và đếm trực tiếp trong DB (`prisma.holiday.count`) xác nhận đúng 11 bản ghi, không có duplicate.

**Kết luận Bug 3**: ✅ Fix đúng theo đúng quyết định ADR-005, đã xác minh cả 2 kịch bản task yêu cầu bằng test e2e thật (không phải mock), không có duplicate/500 khi concurrent.

---

## 5. Test thủ công độc lập của QA (Vitest tạm thời, không commit)

Theo yêu cầu task Mục C, QA đã tự viết thêm test bổ sung (KHÔNG có trong bàn giao của Backend Engineer) để dò kỹ hơn các edge case, chạy xong xoá ngay — không để lại rác trong repo, không tính vào số liệu chính thức của dự án.

### 5.1 `Backend/src/hr/work-shifts/__qa-manual-verify.spec.ts` (đã xoá sau khi chạy)

| Test | Kết quả |
|---|---|
| Ca qua đêm `22:00→06:00` (tổng 480 phút), `breakMinutes=480` (net = 0) → phải ném `E-hr-037` | ✅ PASS |
| Ca qua đêm `23:30→00:30` (tổng 60 phút), `breakMinutes=61` (net âm, vượt tổng) → phải ném `E-hr-037` | ✅ PASS |
| Ca qua đêm `22:00→06:00`, `breakMinutes=479` (net = 1 phút = 0.02h > 0) → phải cho phép tạo, `workingHours ≈ 0.02` | ✅ PASS |

→ Xác nhận `calcDuration` tính đúng `totalDuration` cho ca qua đêm trước khi so sánh với `breakMinutes` — không có lỗi logic ẩn khi `isOvernight = true`.

### 5.2 `Backend/src/hr/holidays/__qa-manual-verify.spec.ts` (đã xoá sau khi chạy)

| Test | Kết quả |
|---|---|
| Existing holiday `LUNAR + isAnnual:false`, PATCH chỉ gửi `{note: '...'}` (không đụng `type`/`isAnnual`) → KHÔNG được ném lỗi, phải update thành công | ✅ PASS |
| Existing holiday `NATIONAL + isAnnual:true`, PATCH chỉ gửi `{name: '...'}` → KHÔNG được ném lỗi, phải update thành công | ✅ PASS |

→ Xác nhận logic merge không có false-positive khi field bị đổi không liên quan tới `type`/`isAnnual`, kể cả với existing record ở dạng dễ trigger false-positive nhất (`LUNAR`).

### 5.3 Kịch bản quickGenerate gọi lần 2 khi toàn bộ 11 ngày đã tồn tại

Không cần viết test mới — task Mục C.3 đã trùng khớp 100% với test e2e thật đã có sẵn (`test/settings-shifts-holidays.e2e-spec.ts` dòng 648-672). QA đã tự chạy lại test này (nằm trong lượt chạy `test:e2e` đầy đủ ở Mục 3) và xác nhận PASS với đúng số liệu `addedCount: 0`, `skippedCount: 11`, `items.length: 11`.

---

## 6. Regression check

- Toàn bộ 255 unit test (20 file) và 228 e2e test (8 file) — bao gồm các module KHÔNG liên quan trực tiếp tới fix này (Department, Employee, Contract, Dependent, Document, Google Drive, Auth) — đều PASS. Không có test nào bị skip/xfail để che giấu fail.
- `computeShiftFields()` (dùng cho hiển thị `GET`/`POST` response) không bị đổi hành vi — vẫn dùng `Math.max(0, netMinutes)` để hiển thị (phòng trường hợp dữ liệu cũ lỡ có net ≤ 0 từ trước khi fix, tránh hiển thị số âm), tách biệt rõ với `assertPositiveWorkingHours()` (validate khi ghi). Đây là thiết kế hợp lý: validate chặn ghi mới sai, nhưng không sập nếu đọc phải data cũ.
- `seed.ts` (dữ liệu mẫu `CA01`-`CA04`) không có ca nào vi phạm BR-hr-025 mới (đã đọc lại, tất cả đều có net > 0) → seed không bị fix này phá vỡ.
- `vietnam-holidays.util.ts` (nguồn `quickGenerate`) không có bản ghi `LUNAR + isAnnual: true` nào → không có dữ liệu chuẩn nào tự vi phạm BR-hr-026 sau fix.
- RBAC/Auth cho 14 endpoint Settings/WorkShift/Holiday không bị đụng tới trong đợt fix này — test RBAC trong `settings-shifts-holidays.e2e-spec.ts` ("RBAC & Security...") vẫn PASS.

**Kết luận regression**: Không phát hiện regression nào.

---

## 7. Ghi nhận (Low severity — không chặn release)

1. **Tài liệu SRS/API Contract chưa cập nhật mã lỗi mới `E-hr-037`**: `docs/hr/srs/hr-spec.md` Mục 10 (Error Matrix, bảng `E-hr-030`…`E-hr-036`) và `docs/hr/architecture/hr-api-contract.md` chưa có dòng cho `E-hr-037` dù mã lỗi đã tồn tại thật trong code (`Backend/src/common/hr-errors.ts`) và test. Đây là khoảng trống traceability (Requirement → Error Matrix → Implementation chưa khép kín cho mã lỗi mới) — đề nghị BA/Architect cập nhật `hr-spec.md` Mục 10 + `hr-api-contract.md` để đóng vòng traceability. Không ảnh hưởng runtime, chỉ ảnh hưởng tài liệu.
2. **Thiếu 1 test permanent (không phải test tạm của QA) cho case "existing holiday = LUNAR, PATCH chỉ đổi field không liên quan (`note`/`name`) → không throw"**: hiện tại case này chỉ được xác nhận qua test thủ công tạm thời của QA (Mục 5.2, đã xoá) và suy luận logic — bộ test chính thức (`holidays.service.spec.ts`/e2e) có test no-op-update nhưng dùng existing record dạng `COMPANY`/`NATIONAL`, chưa có bản permanent nào dùng existing record dạng `LUNAR`. Đề nghị Backend Engineer bổ sung 1 test permanent tương đương test tạm của QA ở Mục 5.2 (dòng 1) để khoá chặt coverage cho trường hợp dễ false-positive nhất. Non-blocking vì logic đã đúng và đã được QA verify độc lập.

---

## 8. Security cơ bản

- Không có endpoint mới, không có thay đổi RBAC/JWT trong đợt fix này.
- Zod `.strict()` trên các DTO liên quan (`update-work-shift.schema.ts`, `update-holiday.schema.ts`) không bị đụng tới — vẫn chặn mass assignment/parameter tampering như cũ.
- `assertPositiveWorkingHours()` và merge logic của `HolidaysService.update()` chỉ đọc dữ liệu đã qua Zod validate + Prisma parameterized query — không có chỗ nào nội suy string trực tiếp vào câu lệnh DB (không có SQL injection surface mới).
- Không log credential/secret nào trong 2 file service đã sửa.
- `createMany` với `skipDuplicates: true` không mở ra endpoint ghi dữ liệu tuỳ ý — input vẫn đi qua `getStandardVietnamHolidays(year)` (bảng tra tĩnh, không nhận input tự do từ client ngoài `year`), `year` đã được validate giới hạn 2024-2030 ở tầng DTO/service trước khi generate.

---

## 9. Kết luận & khuyến nghị

- **Độ tin cậy mã nguồn**: 0 lỗi lint, 0 lỗi build, 255/255 unit pass, 228/228 e2e pass (số liệu QA tự chạy, không sao chép).
- **3 bug đã fix đúng**: xác nhận độc lập bằng đọc code + trace công thức tay + test tự động đã có + test thủ công bổ sung của QA (đã xoá sau khi verify) cho đúng 3 edge case task yêu cầu (ca qua đêm, holiday no-op update, quickGenerate gọi lại toàn bộ đã tồn tại).
- **Không phát hiện regression** trên toàn bộ 483 test (255 unit + 228 e2e).
- **2 ghi nhận Low severity** (tài liệu SRS/API contract thiếu `E-hr-037`; thiếu 1 test permanent cho case LUNAR no-op-patch) — khuyến nghị xử lý nhưng **không chặn release**.

> **Khuyến nghị QA**: ✅ **APPROVED**. Module HR Settings/Shifts/Holidays đủ điều kiện coi là đã đóng cả 3 bug từng bị đợt 5 bỏ sót/xác nhận sai. Đề nghị BA cập nhật Error Matrix (`E-hr-037`) và Backend Engineer bổ sung 1 test permanent nhỏ (Mục 7) ở đợt sau — cả hai đều không chặn việc bàn giao tiếp cho Code Reviewer/Frontend Engineer.
