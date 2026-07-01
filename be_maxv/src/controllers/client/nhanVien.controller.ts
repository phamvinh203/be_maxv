import type { FastifyRequest, FastifyReply } from 'fastify';
import { inviteEmployeeSchema } from '../../validators/nhanVien.validator';
import { inviteEmployee, listEmployees } from '../../services/client/nhanVien.service';
import { validateBody } from '../../utils/validate';
import { sendCreated, sendOk } from '../../helpers/response';
import { ForbiddenError } from '../../helpers/errors';
import { MESSAGES } from '../../constants/messages';

/** POST /api/v1/nhan-vien/invite */
export async function createInvite(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user.donViId) throw new ForbiddenError(MESSAGES.NHAN_VIEN.NO_COMPANY);
  const input = validateBody(inviteEmployeeSchema, req.body);
  const data = await inviteEmployee(req.user.donViId, req.user.userId, input);
  return sendCreated(reply, data);
}

/** GET /api/v1/nhan-vien */
export async function getEmployees(req: FastifyRequest, reply: FastifyReply) {
  if (!req.user.donViId) throw new ForbiddenError(MESSAGES.NHAN_VIEN.NO_COMPANY);
  return sendOk(reply, await listEmployees(req.user.donViId));
}
