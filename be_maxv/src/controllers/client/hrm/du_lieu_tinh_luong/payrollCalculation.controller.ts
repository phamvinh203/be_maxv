import type { FastifyReply, FastifyRequest } from 'fastify';
import { dbCoQuyenLuongPayroll } from '../../../../helpers/hrm/payrollAccessGuard';
import { sendOk } from '../../../../helpers/response';
import { validateQuery } from '../../../../utils/validate';
import { z } from 'zod';
import * as service from '../../../../services/client/hrm/du_lieu_tinh_luong/payrollCalculation.service';

const periodIdQuerySchema = z.object({
  periodId: z.string().trim().min(1),
});

// A-01 (review-findings.md RVW đợt 2026-09-09): endpoint nhạy cảm nhất module (lương gộp +
// thực lĩnh + thuế TNCN toàn công ty) — BẮT BUỘC qua `dbCoQuyenLuongPayroll`, không dùng
// `resolveTenantDb` trơn.
export async function calculatePreview(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const { periodId } = validateQuery(periodIdQuerySchema, req.query);
  return sendOk(reply, await service.calculatePayrollPreview(db, periodId));
}

export async function getSheetLines(req: FastifyRequest, reply: FastifyReply) {
  const db = await dbCoQuyenLuongPayroll(req);
  const { periodId } = validateQuery(periodIdQuerySchema, req.query);
  return sendOk(reply, await service.getPayrollSheetLines(db, periodId));
}
