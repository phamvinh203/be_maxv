import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../../controllers/client/hrm/du_lieu_tinh_luong/payrollCalculation.controller';

export async function hrmPayrollCalculationRoutes(app: FastifyInstance) {
  app.get('/payroll/calculate', ctrl.calculatePreview);
  app.get('/payroll/sheet-lines', ctrl.getSheetLines);
  app.get('/payroll/support-allowances', ctrl.getSupportAllowances);
}
