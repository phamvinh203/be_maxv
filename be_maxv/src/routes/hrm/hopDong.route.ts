import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../controllers/client/hrm/hopDong.controller';

/**
 * HRM › Nhân viên › Lịch sử hợp đồng (hrm_hop_dong).
 * Auth + guard module `hrm` kế thừa từ `hrmRoutes` ở hrm.route.ts.
 *
 * `/doi` khai TRƯỚC `/:id` không cần thiết với Fastify (router phân biệt được path tĩnh với
 * tham số), nhưng để cạnh nhau cho dễ đọc: đây là hai đường ghi khác nhau của cùng thực thể.
 */
export async function hrmHopDongRoutes(app: FastifyInstance) {
  app.get('/hop-dong', ctrl.list);
  app.post('/hop-dong', ctrl.create);
  app.post('/hop-dong/doi', ctrl.doi);
  app.put('/hop-dong/:id', ctrl.update);
  app.delete('/hop-dong/:id', ctrl.remove);
}
