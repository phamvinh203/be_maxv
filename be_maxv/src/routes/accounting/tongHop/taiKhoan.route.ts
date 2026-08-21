import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../../controllers/client/accounting/tongHop/danh_muc/taiKhoan.controller';
import { requireModule } from '../../../services/shared/modules.service';

/**
 * Tổng hợp › Danh mục › Tài khoản (dmtk).
 * Phân cấp (tk_me = TK mẹ, bac_tk = cấp); tham chiếu ngoại tệ (ma_nt -> dmnt).
 * Auth: bắt buộc đăng nhập (DB tenant resolve từ donViId trong JWT).
 */
export async function taiKhoanRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', requireModule('accounting'));

  app.get('/tai-khoan', ctrl.list);
  app.post('/tai-khoan', ctrl.create);
  app.put('/tai-khoan/:tk', ctrl.update);
  app.delete('/tai-khoan/:tk', ctrl.remove);
}
