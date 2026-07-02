import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../controllers/client/tonKho/danh_muc/hangHoa.controller';

/**
 * Tồn kho › Danh mục › Hàng hóa (+ lookup cho form).
 * Auth: BẮT BUỘC đăng nhập — DB tenant resolve từ donViId trong JWT
 * (xem resolveTenantDb). Test bằng tài khoản thật đã đăng ký công ty.
 */
export async function tonKhoRoutes(app: FastifyInstance) {
  // Mọi endpoint trong nhóm này yêu cầu JWT hợp lệ.
  app.addHook('preHandler', app.authenticate);

  // --- Hàng hóa (dmvt) ---
  app.get('/hang-hoa', ctrl.list);
  app.post('/hang-hoa', ctrl.create);
  app.put('/hang-hoa/doi-ma', ctrl.doiMa); // đặt trước /:ma_vt để không bị nuốt route
  app.get('/hang-hoa/:ma_vt', ctrl.getOne);
  app.put('/hang-hoa/:ma_vt', ctrl.update);
  app.delete('/hang-hoa/:ma_vt', ctrl.remove);

  // --- Lookup danh mục (dvt do dvt.route.ts sở hữu) ---
  app.get('/loai-vt', ctrl.loaiVt);
  app.get('/kho', ctrl.kho);
  app.get('/thue', ctrl.thue);
  app.get('/thue-nk', ctrl.thueNk);
  app.get('/phan-nhom', ctrl.phanNhom);
}
