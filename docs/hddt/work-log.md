# Nhật ký làm việc — hddt (hóa đơn điện tử)

## [2026-09-16 10:50] backend-engineer — sửa lỗi cổng thuế chặn 403 khi đăng nhập/lấy hóa đơn
- Nhiệm vụ: chức năng HĐĐT chết hoàn toàn ở local — `/api/v1/gdt/login` trả 400 "sai tài khoản, mật khẩu hoặc mã captcha", trong khi cổng thuế trả **403** sau ~66ms.
- Nguyên nhân (đo trực tiếp lên cổng thuế, bisect từng header, dùng MST giả `0000000000`): cổng thuế đã bật lớp **chống bot** — mọi endpoint `/api/*` **trừ `/captcha`** mà thiếu header `request-id` đều bị chặn với `{"status":403,"message":"Hệ thống phát hiện hành vi không hợp lệ. Yêu cầu đã bị chặn."}`. Các header trình duyệt khác (`user-agent`, `origin`, `referer`, `end-point`, `action`, `sec-*`) không liên quan — thử riêng từng cái vẫn bị chặn; riêng `request-id` một mình thì qua.
- Đã sửa:
  - `be_maxv/src/config/gdt-client.ts`:164 — gắn `request-id: randomUUID()` cho MỌI call trong `gdtSend` (một chỗ, phủ captcha/login/list/detail/export-xml/sco-query).
  - `be_maxv/src/config/gdt-client.ts`:206 — gộp nhánh lỗi, log kèm 300 ký tự đầu của body (trước chỉ có status nên không phân biệt được 403 chống bot với 403 token hết hạn).
  - `be_maxv/src/config/gdt-client.ts`:255 — chặn ca "HTTP 200 nhưng body là trang chặn HTML" (tường lửa F5), trước đây nổi lên thành `SyntaxError: Unexpected token '<'` rồi bị đoán nhầm là đứt socket.
  - `be_maxv/src/services/client/hddt/gdt.service.ts`:2692 — thêm `isBotGuardBlocked()` + `GDT_BOT_GUARD_MESSAGE`.
  - `be_maxv/src/services/client/hddt/gdt.service.ts`:119 — `login()` nhận diện chặn bot TRƯỚC nhánh "auth", không hiện nhầm "sai tài khoản/mật khẩu/captcha".
  - `be_maxv/src/services/client/hddt/gdt.service.ts`:2011 — luồng cập nhật/đồng bộ trả câu đúng thay vì chuỗi kỹ thuật "GDT API Error: 403 Forbidden {...}".
  - `be_maxv/src/__tests__/hddt/gdtRequestId.test.ts` (mới) + `gdtClassifyError.test.ts`:195 — khóa lại hành vi.
- Liên kết: không có REQ/BUG/RVW (sự cố vận hành do cổng thuế đổi phía họ).
- Kiểm chứng:
  - `npm run typecheck` pass · `npm run lint` 0 error (467 warning có sẵn).
  - `npm test`: 1199 test, 1182 pass, 4 fail — cả 4 thuộc `hrm/hrmSettingsShiftsHolidaysApi.test.ts` (TC-hrm-301, TC-hrm-316), **có sẵn từ trước**, đã xác nhận bằng cách stash 2 file vừa sửa rồi chạy lại: vẫn fail y hệt 4/78.
  - Test mới `gdtRequestId.test.ts` + `gdtClassifyError.test.ts`: 23/23 pass.
  - Gọi THẬT lên cổng thuế qua đúng code đã sửa (MST giả): `/captcha` 200, `/authenticate` trả **401 "Mã captcha không đúng."** — tức đã qua được lớp chống bot, không còn 403.
- Commit: chưa commit.
