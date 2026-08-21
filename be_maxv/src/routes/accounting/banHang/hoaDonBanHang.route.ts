import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../../controllers/client/accounting/banHang/chung_tu/hoaDonBanHang.controller';
import { requireModule } from '../../../services/shared/modules.service';

/**
 * Bán hàng › Chứng từ › Hóa đơn bán hàng (m81 header + d81 chi tiết).
 * Auth: bắt buộc đăng nhập (DB tenant resolve từ donViId trong JWT).
 */
export async function hoaDonBanHangRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', requireModule('accounting'));

  app.get('/hoa-don-ban-hang', ctrl.list);
  app.post('/hoa-don-ban-hang', ctrl.create);
  app.get('/hoa-don-ban-hang/next-so-ct', ctrl.getNextSoCt);
  app.get('/hoa-don-ban-hang/:stt_rec/chi-tiet', ctrl.chiTiet);
  app.put('/hoa-don-ban-hang/:stt_rec', ctrl.update);
  app.delete('/hoa-don-ban-hang/:stt_rec', ctrl.remove);
}
