import type { FastifyInstance } from 'fastify';
import { requireModule } from '../../services/shared/modules.service';
import { hrmHopDongRoutes } from './hopDong.route';
import { hrmNguoiPhuThuocRoutes } from './nguoiPhuThuoc.route';
import { hrmNhanVienRoutes } from './nhanVien.route';
import { hrmPhongBanRoutes } from './phongBan.route';
import { hrmTaiLieuRoutes } from './taiLieu.route';

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
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', requireModule('hrm'));

  await app.register(hrmPhongBanRoutes);
  await app.register(hrmNhanVienRoutes);
  await app.register(hrmNguoiPhuThuocRoutes);
  await app.register(hrmTaiLieuRoutes);
  await app.register(hrmHopDongRoutes);
}
