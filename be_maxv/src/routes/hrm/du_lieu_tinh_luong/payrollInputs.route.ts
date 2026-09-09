import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../../controllers/client/hrm/du_lieu_tinh_luong/payrollInputs.controller';

export async function hrmPayrollInputsRoutes(app: FastifyInstance) {
  // 1. Chấm công
  app.get('/payroll-data/attendance/matrix', ctrl.getAttendance);
  app.put('/payroll-data/attendance/cell', ctrl.overrideCell);

  // 2. Tăng ca
  app.get('/payroll-data/overtime', ctrl.getOvertime);
  app.post('/payroll-data/overtime/apply', ctrl.applyOvertime);
  app.delete('/payroll-data/overtime/:ma_nv', ctrl.removeOvertime);

  // 3. KPI
  app.get('/payroll-data/kpi', ctrl.getKpi);
  app.post('/payroll-data/kpi/apply', ctrl.applyKpi);

  // 4. Thưởng
  app.get('/payroll-data/bonus', ctrl.getBonus);
  app.post('/payroll-data/bonus/apply', ctrl.applyBonus);

  // 5. Lương sản phẩm
  app.get('/payroll-data/piecework', ctrl.getPiecework);
  app.post('/payroll-data/piecework/apply', ctrl.applyPiecework);

  // 6. Lương phần trăm
  app.get('/payroll-data/commission', ctrl.getCommission);
  app.post('/payroll-data/commission/apply', ctrl.applyCommission);

  // 7. Chuyên cần
  app.get('/payroll-data/diligence', ctrl.getDiligence);
  app.post('/payroll-data/diligence/record', ctrl.recordDiligence);
  app.delete('/payroll-data/diligence/:id', ctrl.removeDiligence);

  // 8. Ứng - Bù trừ
  app.get('/payroll-data/adjustments', ctrl.getAdjustments);
  app.post('/payroll-data/adjustments/apply', ctrl.applyAdjustments);
}
