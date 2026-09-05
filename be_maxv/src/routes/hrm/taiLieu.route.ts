import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../controllers/client/hrm/taiLieu.controller';

/**
 * HRM › Nhân viên › Hồ sơ tài liệu (hrm_tai_lieu).
 *
 * Tài nguyên phẳng lọc theo `?ma_nv=`, cùng lý do với người phụ thuộc: dùng được cho cả tab
 * trong hồ sơ nhân viên lẫn màn tra cứu chung sau này.
 * Auth + guard module `hrm` kế thừa từ `hrmRoutes` ở hrm.route.ts.
 */
export async function hrmTaiLieuRoutes(app: FastifyInstance) {
  app.get('/tai-lieu', ctrl.list);
  app.post('/tai-lieu', ctrl.create);
  app.put('/tai-lieu/:id', ctrl.update);
  app.delete('/tai-lieu/:id', ctrl.remove);

  // ── File scan trên Google Drive của chính công ty ────────────────────────
  // Đặt chung file route với tài liệu (không tách route riêng) vì đây là các thao tác của
  // cùng một thực thể: một dòng tài liệu = thông tin giấy tờ (DB) + file scan (Drive).
  //
  // Đường `/tai-lieu/drive/...` khai TRƯỚC `/tai-lieu/:id/...` cho dễ đọc; Fastify tự ưu tiên
  // đoạn tĩnh hơn tham số nên không có chuyện "drive" bị bắt nhầm thành một `:id`.
  app.get('/tai-lieu/drive/trang-thai', ctrl.driveTrangThai);
  app.get('/tai-lieu/drive/lien-ket', ctrl.driveLienKet);
  app.get('/tai-lieu/drive/callback', ctrl.driveCallback);
  app.delete('/tai-lieu/drive/ket-noi', ctrl.driveNgatKetNoi);

  app.post('/tai-lieu/:id/file', ctrl.taiFileLenTaiLieu);
  app.get('/tai-lieu/:id/file', ctrl.xemFileTaiLieu);
  app.delete('/tai-lieu/:id/file', ctrl.goFileTaiLieu);
}
