---
type: adr
feature: phan-quyen-nhan-vien
status: rejected
updated: 2026-09-17
links:
  - docs/phan-quyen-nhan-vien/CONTEXT_SUMMARY.md
  - docs/hrm/architecture/adr/ADR-007-pham-vi-quyen-xem-du-lieu-luong.md
---

# ADR-001: Quyền module theo từng nhân viên — giới hạn chỉ thu hẹp, gói thuê bao vẫn là trần

> **REJECTED — 2026-09-17.** Anh @phamvinh203 bỏ hẳn quyền module theo từng nhân viên khi đổi phạm vi feature (`CONTEXT_SUMMARY.md` Mục 0): nhân viên tiếp tục dùng chung module theo gói của owner.
> Không thêm `User.modules`, `modulesHieuLuc`, `MODULE_NOT_GRANTED`. Docstring `moduleCuaUser()` (`modules.service.ts:70-85`) **giữ nguyên, không sửa**.
> Phần dưới giữ làm lịch sử quyết định; `api-contract.md`/`data-model.md` hiện hành không còn tham chiếu ADR này.

## Context

### Quyết định cũ đang nằm trong code

`be_maxv/src/services/shared/modules.service.ts:70-85`, docstring của `moduleCuaUser()`:

> Quyền **chỉ đến từ gói thuê bao** — muốn cho một tài khoản dùng module thì đổi gói của họ. Không có cơ chế bật/tắt riêng cho từng tài khoản: hai nguồn quyền song song sẽ khiến "vì sao khách này thấy HRM" trở thành câu hỏi phải tra hai chỗ mới trả lời được.

Hiện tại mọi `OWNER_EMPLOYEE` nhận nguyên bộ module của gói owner (`modules.service.ts:93-100`). Không có cách nào để owner cho một nhân viên chỉ làm HRM mà không thấy Kế toán.

### Nhu cầu mới

Owner muốn giao đúng phần việc cho từng nhân viên (spec Mục 1, US-01, US-02). Thứ phải quyết là: có chấp nhận một nguồn quyền thứ hai không, và nếu có thì với ràng buộc nào để nỗi lo cũ ("tra hai chỗ") không thành sự thật.

### Nỗi lo cũ thực chất là gì

Nỗi lo "tra hai chỗ" nặng nhất khi **hai nguồn cùng CẤP được quyền** (hợp, hoặc ghi đè): khi đó nhìn gói không biết khách thấy gì, và có đường để dùng module chưa trả tiền. Nếu nguồn thứ hai **chỉ được THU HẸP** (giao) thì:

- Câu "vì sao khách này **thấy** HRM" vẫn chỉ tra **một chỗ**: gói phải có HRM. Không có đường nào để thấy module mà gói không có.
- Chỉ câu "vì sao nhân viên này **không thấy** HRM" mới cần tra hai chỗ, và chiều sai này an toàn hơn (người dùng báo ngay, không rò doanh thu, không lộ dữ liệu).
- Chi phí tra hai chỗ giảm được bằng cách để hệ thống **tự nói ra nguồn** thay vì bắt người hỗ trợ tự dò (Mục Decision, điểm 5).

## Decision

**Chấp nhận đảo ngược, có điều kiện.** Thêm giới hạn module theo từng nhân viên (`User.modules`, xem `data-model.md` M-01) với 6 bất biến sau. Vi phạm bất kỳ điều nào thì quyết định này không còn giá trị và phải quay lại ADR.

1. **Chỉ thu hẹp, gói là trần.** Quyền hiệu lực = module của gói owner ∩ giới hạn của nhân viên. `null` = không giới hạn. Không tồn tại giá trị nào khiến nhân viên có module mà gói không có. Cấm mọi thiết kế sau này dạng "bật thêm cho nhân viên ngoài gói".
2. **Chỉ áp cho `OWNER_EMPLOYEE`.** `OWNER` và `ADMIN` bỏ qua cột này hoàn toàn, kể cả khi có giá trị do sửa tay trong DB.
3. **Một nơi tính duy nhất:** `services/shared/modules.service.ts` (hàm thuần giao hai tập + `moduleCuaUser`). `/auth/login`, `/auth/me`, `requireModule`, `GET /companies/employees` đều gọi qua đây. FE không tự tính giao, chỉ đọc kết quả.
4. **Không đưa vào JWT.** Đọc từ DB mỗi request trong đúng truy vấn `user` mà `requireModule` đã có sẵn (thêm 1 field vào `select`, không thêm lượt truy vấn). Cùng lý do với ADR-007: vé sống 15 phút, thu hồi quyền trễ 15 phút là không chấp nhận được.
5. **Hệ thống phải tự nói ra nguồn gốc quyền** (đây là cách trả chi phí "tra hai chỗ"):
   - 403 của `requireModule` mang `code` phân biệt: `MODULE_NOT_INCLUDED` (gói không có) và `MODULE_NOT_GRANTED` (gói có, chủ tài khoản chưa cấp). Nhân viên đọc thông báo là biết phải hỏi ai.
   - `GET /companies/employees` trả cả giá trị đã lưu (`modules`) và quyền hiệu lực (`modulesHieuLuc`) cho từng người; dòng của owner chính là module của gói. Owner nhìn một màn là đủ.
   - `SysLog` `SET_EMPLOYEE_ACCESS` ghi `modulesTruoc` và `modules`, truy lại được ai thu hẹp lúc nào.
   - (Nếu anh chốt OQ-6 theo mặc định) `GET /admin/owners/:id` trả thêm `nhanVien[].modules` chỉ để đọc — người vận hành trả lời được mà không cần SQL.
6. **Cấp tài khoản, không theo công ty.** Một giá trị áp cho nhân viên ở mọi công ty được cấp (BR-002). Khác có chủ đích với `xemLuong` (theo cặp nhân viên–công ty, ADR-007): module là thứ **bán theo tài khoản** (gói của owner), còn quyền xem lương là thứ **nhạy cảm theo từng công ty**. Hai trục độc lập, chạy tuần tự: `requireModule` chặn trước, rồi `resolveTenantInfo` kiểm quyền vào công ty và `xemLuong`.

### Docstring phải sửa khi code (bắt buộc cùng commit)

Thay đoạn "Quyền chỉ đến từ gói thuê bao ... tra hai chỗ mới trả lời được." ở `modules.service.ts:73-76` bằng nội dung tương đương:

```ts
/**
 * Quyền module của một user.
 *
 * Gói thuê bao là TRẦN và là nguồn DUY NHẤT cấp quyền. `User.modules` của nhân viên
 * (OWNER_EMPLOYEE) chỉ được THU HẸP trong trần đó — hiệu lực = gói ∩ giới hạn,
 * `null` = không giới hạn (ADR-001 phan-quyen-nhan-vien, đảo ngược quyết định "không
 * bật/tắt riêng từng tài khoản" trước đây). Không được thêm đường nào cho nhân viên
 * dùng module mà gói không có.
 *
 * - `ADMIN` luôn có tất cả. `OWNER` = đúng module của gói, bỏ qua `User.modules`.
 * - Muốn biết "vì sao nhân viên không thấy module X": 403 có `code`
 *   (MODULE_NOT_INCLUDED = gói, MODULE_NOT_GRANTED = chủ tài khoản), và
 *   `GET /companies/employees` trả cả giá trị lưu lẫn hiệu lực.
 *
 * Đây là nơi DUY NHẤT quy đổi ra quyền module. ...(giữ đoạn cuối hiện có)
 */
```

Đồng thời sửa comment đang mô tả sai ở FE: `hdđt_maxv/src/features/auth/types/index.ts:8-11` ("Nhân viên thừa hưởng cờ của owner").

## Alternatives

| Phương án | Lý do không chọn |
|---|---|
| Giữ quyết định cũ, không cho thu hẹp | Không đáp ứng nhu cầu. Gói gắn với owner (`Subscription.ownerId` unique), không có cách "mua gói nhỏ hơn cho một nhân viên". |
| Nguồn thứ hai được cấp thêm/ghi đè gói (hợp) | Đúng thứ docstring cũ cảnh báo: rò doanh thu, nhìn gói không biết khách thấy gì. |
| Giới hạn theo cặp nhân viên–công ty trên `DonViAccess` (phương án B của BA) | Phải đổi `moduleCuaUser` nhận `donViId`, FE gate phải tính lại mỗi lần đổi công ty; chưa có nhu cầu thật. Xem spec Mục 4. |
| Nhóm quyền/vai trò mẫu (RBAC) | Thừa cho 4 khoá module và một owner quản lý. Thêm khi có yêu cầu nhiều người quản trị hoặc hàng chục quyền. |
| Danh sách chặn thay vì danh sách cho phép | Đổi nghĩa nghiệp vụ: module mới thêm vào danh mục sau này sẽ tự mở cho nhân viên đã bị giới hạn. BR-003/004 đã chốt theo danh sách cho phép. Xem `data-model.md` Mục 2. |

## Trade-offs

**Được:**
- Owner giao đúng phần việc, không cần đổi gói.
- Gói vẫn là trần nên không mở đường rò doanh thu; hạ gói/hết hạn tự thu hẹp quyền nhân viên mà không phải sửa dữ liệu (BR-005).
- Tương thích ngược: cột mới `NULL` = hành vi cũ, không nhân viên nào mất quyền ngày triển khai.
- Chi phí đọc: 0 lượt truy vấn thêm trên đường nóng (`requireModule`, login, me).

**Mất:**
- Có thêm một chỗ phải xem khi hỗ trợ "vì sao nhân viên không thấy module" — giảm bằng `code` 403 và API trả nguồn, nhưng không về 0.
- Nhân viên đã bị giới hạn **không tự nhận** module mới thêm vào danh mục sau này (đúng nghĩa danh sách cho phép); nhân viên `null` thì nhận. Owner phải tick thêm.
- Menu FE trễ tới lượt gọi API bị chặn đầu tiên hoặc lần tải lại trang (API luôn chặn đúng ngay).
- Rollback không trung tính: xem Consequences.

## Consequences

- **Rollback là MỞ quyền, không phải đóng.** Gỡ code mới (dù giữ cột) thì mọi nhân viên đang bị giới hạn quay lại dùng đủ module của gói. Người quyết rollback phải biết điều này; ưu tiên sửa tiến. Chi tiết `data-model.md` Mục 4.
- `requireModule` phải đọc thêm `modules` trong `select` hiện có (`modules.service.ts:128-131`); thiếu là nhân viên bị giới hạn vẫn gọi được API (menu ẩn nhưng API mở) — lỗi bảo mật, QA phải có ca kiểm riêng.
- Lớp lỗi `ForbiddenError` nhận thêm `code` tuỳ chọn và `errorHandler.plugin.ts` trả kèm `code` khi có. Thay đổi cộng thêm, client cũ không vỡ.
- Test thuần `__tests__/admin/moduleQuyen.test.ts` phải có thêm ca cho phép giao (null, rỗng, tập con, khoá lạ, OWNER bỏ qua giới hạn, giá trị không phải mảng).
- Không đổi cách đếm trần nhân viên (`limits.service.ts`), không đổi luồng duyệt lời mời (`adminInvite.service.ts`): `User` mới nhận `modules = NULL` theo mặc định cột.
- Khi có yêu cầu module khác nhau theo từng công ty, phải viết ADR mới thay thế điểm 6, không vá thêm cột.
