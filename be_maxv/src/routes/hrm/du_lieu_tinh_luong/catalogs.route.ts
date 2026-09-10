import type { FastifyInstance } from 'fastify';
import * as ctrl from '../../../controllers/client/hrm/du_lieu_tinh_luong/catalogs.controller';

export async function hrmPayrollCatalogsRoutes(app: FastifyInstance) {
  // 1. KPI Items
  app.get('/payroll-catalogs/kpi-items', ctrl.listKpi);
  app.post('/payroll-catalogs/kpi-items', ctrl.createKpi);
  app.patch('/payroll-catalogs/kpi-items/:id', ctrl.updateKpi);
  app.delete('/payroll-catalogs/kpi-items/:id', ctrl.removeKpi);

  // 2. Products
  app.get('/payroll-catalogs/products', ctrl.listProducts);
  app.post('/payroll-catalogs/products', ctrl.createProduct);
  app.patch('/payroll-catalogs/products/:id', ctrl.updateProduct);
  app.delete('/payroll-catalogs/products/:id', ctrl.removeProduct);

  // 3. Diligence Types
  app.get('/payroll-catalogs/diligence-types', ctrl.listDiligence);
  app.post('/payroll-catalogs/diligence-types', ctrl.createDiligence);
  app.patch('/payroll-catalogs/diligence-types/:id', ctrl.updateDiligence);
  app.delete('/payroll-catalogs/diligence-types/:id', ctrl.removeDiligence);

  // 4. Adjustment Items
  app.get('/payroll-catalogs/adjustment-items', ctrl.listAdjustments);
  app.post('/payroll-catalogs/adjustment-items', ctrl.createAdjustment);
  app.patch('/payroll-catalogs/adjustment-items/:id', ctrl.updateAdjustment);
  app.delete('/payroll-catalogs/adjustment-items/:id', ctrl.removeAdjustment);
}
