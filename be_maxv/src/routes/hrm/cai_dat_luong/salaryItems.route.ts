import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../../controllers/client/hrm/cai_dat_luong/salaryItems.controller';
import { assertAdminOrOwner } from '../cau_hinh_mac_dinh/generalSettings.route';

/**
 * HRM › Cài đặt lương › Danh mục khoản lương & phụ cấp (hrm_salary_items).
 * Auth + guard module `hrm` kế thừa từ `hrmRoutes` ở hrm.route.ts.
 *
 * RVW-018 (review-findings.md 2026-09-10) — kể từ ADR-010, hai cờ `isTaxable`/`isMealAllowance`
 * của khoản lương KHÔNG còn là nhãn hiển thị: chúng quyết định trực tiếp thu nhập tính thuế TNCN
 * và giỏ miễn thuế ăn ca của TOÀN BỘ nhân viên đang gán khoản đó (`payrollCalculation.service.ts`
 * `tinhKhoanPhuCapTheoKy`). Trước đợt này 3 route ghi chỉ kế thừa `authenticate` +
 * `requireModule('hrm')` — không RBAC riêng, không nhật ký — tức là một đòn bẩy đổi số thuế
 * không ai canh, kể cả `OWNER_EMPLOYEE` đã bị tắt `xemLuong`.
 *
 * Quyết định đã chọn (ghi vào `ADR-010` Consequences): siết CẢ BA route ghi (`POST`/`PATCH`/
 * `DELETE`) về `assertAdminOrOwner` — dùng lại NGUYÊN hàm đã có ở "Cấu hình mặc định"
 * (`generalSettings.route.ts`), đúng tiền lệ `payrollPeriods.route.ts` (lock/reopen/approve).
 * KHÔNG tách quyền hẹp theo từng trường (`isTaxable`/`isMealAllowance` riêng, các trường khác
 * riêng) vì: (a) danh mục khoản lương thay đổi không thường xuyên (khác 8 phân hệ NHẬP LIỆU theo
 * kỳ mà kế toán/OWNER_EMPLOYEE cần thao tác hằng ngày), (b) không có đặc tả/SRS nào yêu cầu
 * OWNER_EMPLOYEE phải tự tạo/sửa danh mục khoản lương, (c) tách quyền theo field cần thêm logic
 * "diff trước/sau" ở tầng service để biết field nào đổi — phức tạp hơn lợi ích mang lại. Nhất
 * quán với "Cấu hình mặc định" — nơi TOÀN BỘ thao tác ghi cũng chỉ dành cho ADMIN/OWNER dù phần
 * lớn trường không nhạy cảm bằng biểu thuế.
 */
export async function hrmSalaryItemsRoutes(app: FastifyInstance) {
  app.get('/salary-items', ctrl.list);
  app.get('/salary-items/count-by-category', ctrl.countByCategory);
  app.get('/salary-items/:id', ctrl.detail);
  app.post('/salary-items', { preHandler: assertAdminOrOwner }, ctrl.create);
  app.patch('/salary-items/:id', { preHandler: assertAdminOrOwner }, ctrl.update);
  app.delete('/salary-items/:id', { preHandler: assertAdminOrOwner }, ctrl.remove);
}
