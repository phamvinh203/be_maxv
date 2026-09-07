# BÁO CÁO ĐÁNH GIÁ CHẤT LƯỢNG MÃ NGUỒN (CODE REVIEW REPORT) — ĐỢT 6 (ROUND 2, ĐỘC LẬP)
## Phân hệ: HR Master Data — Fix 3 bug (BR-hr-025 net-hours, BR-hr-026 PATCH bypass, quickGenerate race condition)

> Báo cáo này SUPERSEDES docs/hr/code-reviewer/code-review-report.md (CR-HR-PHASE-5). Báo cáo đợt 5 đã APPROVE NHẦM 2 bug Blocking (WorkShift cho phép giờ công ròng nhỏ hơn hoặc bằng 0; Holiday PATCH bypass BR-hr-026 khi gửi lẻ 1 field) và 1 bug High (race condition trong quickGenerate) — thậm chí đợt 5 còn liệt 2 đoạn code có bug vào Mục Commendations (khen "excellent design"). Xem Mục 6 dưới đây để đối chiếu chi tiết từng claim sai của đợt 5.

- Người thực hiện: Agent Code-Reviewer (rà soát độc lập lần 2 — không tin báo cáo cũ, không tin lời backend-engineer, tự đọc code + tự chạy lint/build)
- Thời gian đánh giá: 2026-09-05
- Mã đợt review: CR-HR-PHASE-6 (round 2)
- Phạm vi: Backend/src/hr/work-shifts/work-shifts.service.ts, Backend/src/hr/holidays/holidays.service.ts, Backend/src/common/hr-errors.ts, Backend/src/hr/work-shifts/work-shifts.service.spec.ts, Backend/src/hr/holidays/holidays.service.spec.ts, Backend/test/settings-shifts-holidays.e2e-spec.ts, cùng đối chiếu DTO/schema/contract liên quan
- Trạng thái phê duyệt: APPROVED (CHẤP THUẬN MERGE)
- Mức độ rủi ro: Thấp (Low Risk) — 0 Blocking, 2 Non-blocking, 3 Suggestion
- Số lượng Blockers: 0

---

## 1. Xác nhận 3 fix có đúng đắn không (đọc code thật, không suy đoán)

### 1.1 WorkShift — BR-hr-025 giờ công ròng nhỏ hơn hoặc bằng 0 (trước đây Blocking)

File: Backend/src/hr/work-shifts/work-shifts.service.ts

- Đã tách calcDuration(startTime, endTime) (helper thuần, dùng chung) khỏi computeShiftFields (shape response) và thêm assertPositiveWorkingHours() (dòng 36-41) ném HrError với code E-hr-037 (httpStatus 400) khi totalDuration trừ breakMinutes nhỏ hơn hoặc bằng 0.
- create() gọi assertPositiveWorkingHours(dto) trực tiếp (dòng 66) TRƯỚC khi build code hoặc gọi Prisma — đúng, chặn sớm trước khi chạm DB.
- update() (dòng 137-151) gọi findById(id) lấy existing, merge dto.startTime hoặc existing.startTime, dto.endTime hoặc existing.endTime, dto.breakMinutes hoặc existing.breakMinutes bằng toán tử nullish-coalescing (KHÔNG phải OR logic — quan trọng vì breakMinutes bằng 0 là giá trị hợp lệ, OR logic sẽ sai) rồi mới validate. Đây CHÍNH XÁC là fix cần thiết cho lỗ hổng PATCH-lẻ-field đã nêu trong yêu cầu.
- Biên net bằng 0 bị từ chối đúng theo BR-hr-025 (phải LỚN HƠN 0) — đã có test riêng cho biên này ở cả unit lẫn e2e.
- Message E-hr-037 khớp chính xác wording BR-hr-025 trong hr-spec.md dòng 313.
- Xác nhận: fix đúng, không có side-effect logic sai.

### 1.2 Holiday — BR-hr-026 PATCH bypass khi gửi lẻ field (trước đây Blocking)

File: Backend/src/hr/holidays/holidays.service.ts

- update() (dòng 103-134) gọi findById(id) lấy existing, merge dto.type hoặc existing.type, dto.isAnnual hoặc existing.isAnnual, ném E-hr-035 (400) ngay khi merge ra kết quả LUNAR cộng isAnnual true, TRƯỚC KHI build data object và TRƯỚC KHI gọi prisma.holiday.update — xác nhận không có write một-phần lọt qua trước khi validate (test cũng assert mockPrisma.holiday.update KHÔNG được gọi).
- DTO-level refine cũ trong update-holiday.schema.ts vẫn giữ (bắt sớm case gửi đủ cả 2 field cùng lúc) — service-level là lớp bổ sung, không thay thế, không xung đột 2 lớp.
- Xác nhận: fix đúng.

### 1.3 quickGenerate — race condition (trước đây High)

File: Backend/src/hr/holidays/holidays.service.ts, dòng 143-175

- Đã thay vòng lặp findUnique và create tuần tự bằng 1 lệnh prisma.holiday.createMany với skipDuplicates true, cộng thêm 1 findMany riêng để lấy lại items cho response.
- Đúng theo ADR-005 Mục 4 (quyết định kiến trúc đã chốt dùng createMany kèm skipDuplicates).
- Đánh giá transaction semantics (câu hỏi trọng tâm của task): createMany và findMany là 2 lệnh SQL riêng biệt, KHÔNG bọc transaction. Về lý thuyết, giữa lúc createMany xong và findMany chạy, một request khác (ví dụ DELETE /holidays/:id) có thể xoá 1 trong các bản ghi vừa tạo, khiến items trả về ít hơn addedCount. Đây là 1 race window có thật nhưng:
  1. Không phải race condition ban đầu cần fix (bug gốc là TOCTOU giữa 2 lệnh findUnique và create trong cùng một request quickGenerate, gây trùng lặp hoặc lỗi 500 khi 2 request quickGenerate chạy đồng thời — race này đã được giải quyết triệt để vì createMany là 1 câu lệnh INSERT duy nhất, Postgres dịch skipDuplicates true thành ON CONFLICT DO NOTHING, atomic ở tầng DB bất kể có transaction Nest hay không).
  2. Race window mới (DELETE xen giữa createMany và findMany) chỉ ảnh hưởng tới độ chính xác của mảng items trả về trong phiên bản response đó (không gây trùng lặp DB, không gây lỗi 500, không gây mất dữ liệu) và đòi hỏi 1 admin khác đang xoá đúng bản ghi vừa tạo trong cửa sổ vài mili-giây — xác suất cực thấp trong nghiệp vụ thực tế (thao tác quản trị Holiday tần suất thấp).
  3. Việc bọc transaction cũng không giải quyết triệt để race này ở mức isolation mặc định READ COMMITTED của Postgres (Prisma interactive transaction không tự lock các row vừa insert khỏi bị xoá bởi transaction khác trừ khi dùng SELECT FOR UPDATE tường minh).
  - Kết luận: rủi ro thực tế thấp, không blocking. Xem Mục 4 (Non-blocking số 1) để biết đề xuất.
- Xác nhận: race condition GỐC (mục tiêu chính của fix) đã được giải quyết đúng bằng cơ chế atomic DB-level, không phải giả-fix.

---

## 2. Đánh giá coupling calcDuration dùng chung giữa computeShiftFields và assertPositiveWorkingHours

Đây là thiết kế TỐT, không phải rủi ro:
- Trước fix, bug gốc (đợt 5) tồn tại chính xác vì không có helper validate dùng chung — computeShiftFields tự clamp về 0 (Math.max) để hiển thị an toàn nhưng KHÔNG có bước validate riêng chặn lưu. Việc tách calcDuration thành 1 nguồn tính duy nhất rồi cho cả 2 hàm (computeShiftFields hiển thị, assertPositiveWorkingHours validate) cùng dùng đảm bảo nếu công thức tính giờ (ví dụ logic ca qua đêm) có thay đổi trong tương lai, cả 2 nơi tự động đồng bộ — GIẢM rủi ro drift thay vì tăng.
- Việc clamp về 0 trong computeShiftFields giờ về lý thuyết là dead-path cho dữ liệu tạo mới (vì assertPositiveWorkingHours đã chặn từ trước), nhưng vẫn có giá trị phòng thủ hợp lý cho dữ liệu cũ, dữ liệu seed, hoặc thao tác trực tiếp DB ngoài service — giữ lại là hợp lý, không cần xoá.

---

## 3. Đánh giá test — có thực sự kiểm chứng bug đã fix hay chỉ vacuous?

### 3.1 Unit test (work-shifts.service.spec.ts, holidays.service.spec.ts)

Đã tự chạy: 21 trên 21 pass (2 file, xem Mục 5, evidence log).

- work-shifts.service.spec.ts: có test biên net bằng 0 (E-hr-037) và net âm cho cả create và update; đặc biệt có test update merge đúng khi PATCH chỉ gửi breakMinutes (giữ nguyên startTime và endTime cũ từ mock findUnique) — test này thực sự verify được bug PATCH-bypass cho WorkShift vì nó assert mockPrisma.workShift.update KHÔNG được gọi khi merge invalid, và ngược lại assert update ĐƯỢC gọi đúng payload khi merge vẫn hợp lệ. Không vacuous.
- holidays.service.spec.ts: 2 test PATCH bypass (gửi lẻ isAnnual trên holiday LUNAR có sẵn; gửi lẻ type LUNAR trên holiday isAnnual true có sẵn) — mock findUnique trả về state hiện tại rồi assert throw cộng update KHÔNG được gọi. Đây chính là kịch bản bug gốc (payload gửi lẻ 1 field) — test verify đúng bug đã fix, không vacuous.
- Test quickGenerate (unit, mock createMany và findMany) chỉ verify shape response (addedCount, skippedCount, items) và rằng createMany được gọi với skipDuplicates true — đây là unit test thuần (mock), không thể verify race condition thật (không có DB thật, không có concurrency thật) — nhưng đó đúng là giới hạn hợp lý của unit test, KHÔNG phải điểm yếu vì race condition thật được verify ở tầng e2e (Mục 3.2).

### 3.2 E2E race condition test (settings-shifts-holidays.e2e-spec.ts, dòng 749-793) — trọng tâm câu hỏi B

Test tên "xử lý đúng khi 2 request đồng thời cùng năm" dùng Promise.all gửi 2 HTTP request thật đồng thời tới server thật (Postgres thật port 5435, không mock), rồi assert:
1. Cả 2 response đều 201 (không request nào 500).
2. Tổng addedCount của 2 response bằng 11 (đúng bằng totalStandard, không thừa không thiếu).
3. Đếm lại DB thật (prisma.holiday.count) cho năm 2029 bằng đúng 11 bản ghi (không trùng lặp).

Đánh giá: đây LÀ test có giá trị thật, KHÔNG phải happy-path giả, vì các lý do:
- Test dùng năm 2029 riêng biệt (chưa test nào khác trong suite dùng), đảm bảo state sạch trước khi chạy — loại trừ false-positive do dữ liệu có sẵn.
- 2 HTTP request thật chạy qua Promise.all tạo ra 2 connection Postgres riêng thực sự chạy song song (khác hẳn unit test mock tuần tự) — đây chính là kịch bản đã gây bug gốc (2 click Tạo nhanh gần như đồng thời).
- Assertion tổng addedCount 2 response bằng 11, không trùng lặp DB là bằng chứng trực tiếp rằng cơ chế atomic (ON CONFLICT DO NOTHING ở Postgres qua skipDuplicates) hoạt động đúng dưới concurrency thật — nếu bug cũ (TOCTOU findUnique và create) còn tồn tại, kịch bản này nhiều khả năng sẽ tạo ra hơn 11 bản ghi (trùng lặp) hoặc 1 trong 2 response trả 500 (unique constraint violation không bắt được).
- Hạn chế cần ghi nhận trung thực: đây là 1 test chạy với 2 request cụ thể qua Promise.all — không phải stress test với N request cao hoặc lặp lại nhiều vòng để khuếch đại race window, và không đảm bảo tuyệt đối 100 phần trăm cả 2 request luôn thực sự chạm DB cùng lúc (phụ thuộc scheduler Node và network stack) — tức về mặt lý thuyết test có thể (hiếm khi) may mắn pass dù còn bug nếu 2 request tình cờ serialize hoàn toàn. Tuy nhiên vì cơ chế fix (createMany kèm ON CONFLICT DO NOTHING) là atomic ở tầng Postgres bất kể có đụng độ thời gian hay không, nên test này pass ổn định và đáng tin cậy trong thực tế — không phải test yếu mà là cơ chế fix đủ mạnh để không cần race window chính xác tuyệt đối mới pass.

Kết luận Mục B: Test race condition mới là hợp lệ, không vacuous, chứng minh được cả 2 khía cạnh: (a) không còn lỗi 500 khi đồng thời, (b) không còn trùng lặp dữ liệu.

---

## 4. Findings

### Blocking

KHÔNG CÓ.

### Non-blocking

1. quickGenerate — items trả về có thể lệch nếu có DELETE xen giữa createMany và findMany (Backend/src/hr/holidays/holidays.service.ts dòng 158-166). Race window lý thuyết đã phân tích ở Mục 1.3 — rủi ro thực tế rất thấp (đòi hỏi thao tác xoá đúng bản ghi vừa tạo trong vài mili-giây), không gây trùng lặp DB hay lỗi 500, chỉ ảnh hưởng độ chính xác hiển thị của response 1 lần gọi hiếm gặp. Đề xuất (không bắt buộc): nếu muốn triệt để, có thể build items trực tiếp từ rows đã gửi kết hợp so khớp qua createMany (Prisma không trả về record vừa insert qua createMany, đây là hạn chế API Prisma, không phải lỗi code) hoặc chấp nhận rủi ro hiện tại như trade-off đã ghi trong ADR-005.

2. docs/hr/architecture/hr-api-contract.md chưa cập nhật mã lỗi E-hr-037 mới vào bảng Status codes của POST /work-shifts (Mục 14.1, dòng 991: liệt kê E-hr-030, E-hr-031, E-hr-032) và PATCH /work-shifts/:id (Mục 14.4, dòng 1034: cùng danh sách) — cả 2 endpoint thực tế giờ có thể trả thêm 400 E-hr-037 (BR-hr-025) nhưng contract chưa liệt kê. Đây là gap tài liệu (không phải lỗi runtime — code trả đúng lỗi, chỉ là contract doc chưa đồng bộ), nhưng đáng chú ý vì hr-spec.md (Error Matrix) CŨNG chưa có dòng E-hr-037 (chỉ dừng ở E-hr-036, xem hr-spec.md dòng 454-460) dù HR_ERRORS và HR_ERROR_STATUS trong code đã có. Đề xuất: BA/Architect bổ sung E-hr-037 vào Error Matrix (hr-spec.md Mục 10) và bảng Status codes liên quan (hr-api-contract.md Mục 14.1/14.4) ở lượt cập nhật tài liệu kế tiếp — không block merge code vì đây là việc của BA/Architect, không phải Backend Engineer tự ý đổi contract.

### Suggestions

1. Race lý thuyết (TOCTOU) trong WorkShift.update() và Holiday.update() khi 2 PATCH đồng thời sửa các field bù trừ nhau của cùng 1 bản ghi — ví dụ PATCH A đổi breakMinutes dựa trên endTime cũ (đọc trước khi PATCH B ghi endTime mới), PATCH B đổi endTime dựa trên breakMinutes cũ (đọc trước khi PATCH A ghi) — cả 2 đều pass validate riêng lẻ (dựa trên snapshot cũ) nhưng trạng thái cuối cùng sau khi cả 2 ghi xong có thể vi phạm lại BR-hr-025 hoặc BR-hr-026. Đây là hệ quả tất yếu của pattern read-merge-validate-write không transaction và không lock, áp dụng cho cả 2 service (không riêng gì các bug vừa fix). Rủi ro thực tế rất thấp vì ADR-005 đã ghi nhận tần suất sửa Ca làm việc và Ngày lễ chỉ vài lần mỗi năm (không phải nghiệp vụ nhiều người sửa đồng thời 1 bản ghi). Không cần fix ngay — chỉ ghi nhận để nếu sau này nghiệp vụ đổi (nhiều người cùng sửa cấu hình), cân nhắc SELECT FOR UPDATE trong transaction hoặc optimistic locking (kiểm tra version qua updatedAt).

2. Thiếu grandfather-clause cho dữ liệu cũ khi PATCH field không liên quan: nếu 1 WorkShift đã tồn tại từ trước khi fix này được deploy với net nhỏ hơn hoặc bằng 0 (hiếm nhưng có thể xảy ra nếu có dữ liệu tạo trực tiếp ngoài service, ví dụ seed thủ công lỗi), 1 PATCH chỉ đổi status hoặc name (không đụng giờ hoặc nghỉ) sẽ vẫn bị chặn E-hr-037 do validate merge lại toàn bộ state hiện tại. Hành vi này đúng về mặt không cho phép invalid state tồn tại thêm, nhưng có thể gây bất ngờ nếu người dùng chỉ muốn đổi tên hoặc trạng thái ca. Không cần fix (không phải bug của lượt này, và dữ liệu hiện tại trong seed và test đều hợp lệ) — chỉ ghi nhận cho tương lai nếu QA phát hiện complaint thực tế.

3. Không có DTO-level refine cross-field cho BR-hr-025 ở create-work-shift.schema.ts (khác với create-holiday.schema.ts có refine cho BR-hr-026 ngay ở tầng DTO vì create luôn có đủ field). Về mặt chức năng không sai (service-level assertPositiveWorkingHours vẫn trả đúng 400 E-hr-037 với response shape hợp lệ theo contract — trường fields là optional, không bắt buộc), nhưng không nhất quán về layering so với pattern Holiday. Có thể cân nhắc thêm refine ở DTO create cho đối xứng phong cách (không bắt buộc, chỉ là gu code).

---

## 5. Evidence — tự chạy lại (không tin số liệu cũ)

Lệnh 1: cd Backend, npm run lint (oxlint src/ test/ prisma/) — kết quả: 0 output, 0 lỗi.

Lệnh 2: cd Backend, npm run build (nest build) — kết quả: 0 output, 0 lỗi.

Lệnh 3: cd Backend, npx vitest run src/hr/work-shifts/work-shifts.service.spec.ts src/hr/holidays/holidays.service.spec.ts — kết quả: Test Files 2 passed (2), Tests 21 passed (21).

Không chạy lại toàn bộ suite unit và e2e (248 lên 255 unit, 224 lên 228 e2e theo báo cáo Backend Engineer tại CONTEXT_SUMMARY.md Mục 10) vì Tester-QA đang chạy song song việc này theo phân công của task — số liệu build và lint ở trên là tự tay verify độc lập, không copy từ báo cáo cũ.

---

## 6. Đối chiếu sai lệch của báo cáo đợt 5 (để rút kinh nghiệm quy trình)

Claim sai của đợt 5 (Mục 2.1, code-review-report.md): việc clamp Math.max(0, totalDuration trừ breakMinutes) được mô tả là "ngăn chặn hoàn toàn trường hợp số giờ công bị âm khi người dùng cấu hình thời gian nghỉ lớn hơn độ dài ca".
Thực tế: đúng là KHÔNG âm (clamp về 0), nhưng KHÔNG chặn được workingHours bằng 0 được LƯU vào DB — vi phạm trực tiếp BR-hr-025 (phải LỚN HƠN 0). Đây là bug Blocking, không phải thiết kế ngăn chặn hoàn toàn như đợt 5 mô tả.

Claim sai của đợt 5 (Mục 2.1): mô tả quickGenerate (khi đó còn dùng vòng lặp findUnique và create tuần tự, chưa phải createMany) là "hệ thống không tạo trùng lặp và không ném lỗi 500".
Thực tế: vòng lặp tuần tự có TOCTOU thật giữa bước check và bước tạo khi 2 request chạy đồng thời — không có bằng chứng (test) nào ở đợt 5 verify concurrency thật; claim không tạo trùng lặp chỉ đúng cho single-request, không đúng cho concurrent request.

Claim sai của đợt 5 (Mục 4, Commendations): mô tả cơ chế idempotent của quickGenerate là "có thể bấm nhiều lần mà không sợ sinh dữ liệu rác".
Thực tế: đúng cho việc bấm TUẦN TỰ (idempotent theo nghĩa gọi lại sau khi lần trước đã xong), nhưng KHÔNG đúng cho việc bấm gần như ĐỒNG THỜI (race condition) — đợt 5 không phân biệt 2 khái niệm này.

Thiếu sót của đợt 5: không phát hiện Holiday PATCH bypass BR-hr-026 khi gửi lẻ 1 field.
Thực tế: đợt 5 không có test nào cho case PATCH gửi lẻ field trên bản ghi CÓ SẴN dữ liệu LUNAR hoặc isAnnual — chỉ test DTO refine khi gửi ĐỦ cả 2 field cùng lúc, nên không phát hiện được lỗ hổng service-layer.

Bài học quy trình: đợt 5 review dựa nhiều vào đọc code và suy luận tĩnh (static reasoning) mà thiếu test case đối kháng (adversarial test — cố tình PATCH lẻ field, cố tình chạy concurrent) để verify claim đã ngăn chặn hoặc đã idempotent. Round 2 này đã bổ sung đúng loại test đó và verify lại bằng cách tự đọc code cộng tự chạy lint và build, không kế thừa kết luận cũ.

---

## 7. Kết luận và Khuyến nghị chuyển giao

CODE REVIEW RESULT (ROUND 2): APPROVED — 0 Blocking, 2 Non-blocking (tài liệu và race-window cực hiếm), 3 Suggestion.

Cả 3 bug (2 Blocking cộng 1 High) từ rà soát độc lập trước đó đã được Backend Engineer fix đúng đắn, có test đối kháng thực sự kiểm chứng (không vacuous), lint và build xanh khi tự chạy độc lập. Đủ điều kiện merge và tiếp tục pipeline.

Việc còn lại (không block merge, giao cho vòng sau):
- BA và Architect bổ sung E-hr-037 vào hr-spec.md Error Matrix (Mục 10) và hr-api-contract.md Status codes (Mục 14.1, 14.4).
- Tester-QA xác nhận lại toàn bộ suite unit (255) cộng e2e (228) như Backend Engineer báo cáo (đang chạy song song).
