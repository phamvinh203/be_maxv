import type { FastifyInstance } from 'fastify';
import { requireModule } from '../../services/shared/modules.service';
import { hrmGeneralSettingsRoutes } from './cau_hinh_mac_dinh/generalSettings.route';
import { hrmHolidaysRoutes } from './cau_hinh_mac_dinh/holidays.route';
import { hrmHopDongRoutes } from './du_lieu_ca_nhan/hopDong.route';
import { hrmNguoiPhuThuocRoutes } from './du_lieu_ca_nhan/nguoiPhuThuoc.route';
import { hrmNhanVienRoutes } from './du_lieu_ca_nhan/nhanVien.route';
import { hrmPhongBanRoutes } from './du_lieu_ca_nhan/phongBan.route';
import { hrmTaiLieuRoutes } from './du_lieu_ca_nhan/taiLieu.route';
import { hrmWorkShiftsRoutes } from './cau_hinh_mac_dinh/workShifts.route';
import { hrmSalaryItemsRoutes } from './cai_dat_luong/salaryItems.route';
import { hrmSalaryStructuresRoutes } from './cai_dat_luong/salaryStructures.route';
import { hrmEmployeeSalariesRoutes } from './cai_dat_luong/employeeSalaries.route';

/**
 * Nhóm route HRM (nhân sự) — chạy trên DB tenant, các bảng `hrm_*`.
 *
 * Auth + guard module khai báo Ở ĐÂY một lần rồi lan xuống mọi route con (hook Fastify
 * áp cho cả plugin đăng ký sau nó trong cùng scope), nên file entity bên dưới chỉ còn
 * việc khai endpoint — thêm nhân viên / người phụ thuộc sau này không phải lặp lại guard,
 * cũng không lo quên guard ở một file lẻ.
 *
 * Tách hẳn khỏi danh mục Kế toán (`dmpb` ở /tong-hop): khác bảng, khác module bán kèm.
 */
export async function hrmRoutes(app: FastifyInstance) {
  // Ngoại lệ DUY NHẤT: route bật `config.khongCanAuth` (xem types/fastify.d.ts). Cần cho
  // callback OAuth của Google — trình duyệt vào thẳng từ accounts.google.com nên cookie
  // access (SameSite=Strict) không được gửi kèm; guard sẽ chặn nhầm bằng 401 và người dùng
  // chỉ thấy JSON lỗi trong cửa sổ popup. Route đó tự xác thực bằng `state` ký HMAC.
  const guard = requireModule('hrm');
  app.addHook('preHandler', async (req) => {
    if (req.routeOptions.config?.khongCanAuth) return;
    await app.authenticate(req);
    await guard(req);
  });

  await app.register(hrmPhongBanRoutes);
  await app.register(hrmNhanVienRoutes);
  await app.register(hrmNguoiPhuThuocRoutes);
  await app.register(hrmTaiLieuRoutes);
  await app.register(hrmHopDongRoutes);
  await app.register(hrmGeneralSettingsRoutes);
  await app.register(hrmWorkShiftsRoutes);
  await app.register(hrmHolidaysRoutes);
  await app.register(hrmSalaryItemsRoutes);
  await app.register(hrmSalaryStructuresRoutes);
  await app.register(hrmEmployeeSalariesRoutes);
}
