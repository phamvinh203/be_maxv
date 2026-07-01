import type { FastifyRequest, FastifyReply } from 'fastify';
import { registerCompanySchema } from '../../validators/company.validator';
import { inviteUserSchema } from '../../validators/company.validator';
import {
  inviteUserToCompany,
  listCompanyEmployees,
  listCompanyInvites,
  registerCompany,
} from '../../services/client/company.service';
import { validateBody } from '../../utils/validate';
import { sendCreated, sendOk } from '../../helpers/response';

/** POST /api/v1/companies — Step 2: register company + provision DB maxv2_<mst>_app. */
export async function createCompany(req: FastifyRequest, reply: FastifyReply) {
  const data = await registerCompany(
    validateBody(registerCompanySchema, req.body),
  );
  return sendCreated(reply, data);
}

// POST /api/v1/companies/invite - owner thêm user vào công ty (khi owner tạo công ty thì mặc định owner là user đầu tiên của công ty đó)
export async function inviteUser(req: FastifyRequest, reply: FastifyReply) {
  const data = await inviteUserToCompany({
    ...validateBody(inviteUserSchema, req.body),
    donViId: req.user.donViId,
    requestedById: req.user.userId,
  });
  return sendCreated(reply, data);
}

// GET /api/v1/companies/employees - xem danh sách nhân viên của công ty mình (owner + nhân viên đều xem được)
export async function listEmployees(req: FastifyRequest, reply: FastifyReply) {
  const data = await listCompanyEmployees(req.user.donViId);
  return sendOk(reply, data);
}

// GET /api/v1/companies/invites - xem toàn bộ lời mời (mọi trạng thái) của công ty mình
export async function listInvites(req: FastifyRequest, reply: FastifyReply) {
  const data = await listCompanyInvites(req.user.donViId);
  return sendOk(reply, data);
}
