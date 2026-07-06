import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  registerCompanySchema,
  inviteUserSchema,
} from '../../validators/company.validator';
import {
  inviteUserToCompany,
  listCompanyEmployees,
  listCompanyInvites,
  registerCompany,
} from '../../services/client/company.service';
import { listAccessibleCompanies } from '../../services/shared/companyAccess.service';
import { canAccessDonVi } from '../../helpers/access';
import { issueTokens } from '../../helpers/authTokens';
import { validateBody } from '../../utils/validate';
import { sendCreated, sendOk } from '../../helpers/response';
import { ForbiddenError } from '../../helpers/errors';
import { MESSAGES } from '../../constants/messages';

/**
 * POST /api/v1/companies — Owner tạo 1 công ty/MST + cấp DB maxv2_<mst>_app.
 * Tự động switch sang MST vừa tạo (cấp token mới) để owner vào làm ngay.
 */
export async function createCompany(req: FastifyRequest, reply: FastifyReply) {
  const company = await registerCompany({
    ...validateBody(registerCompanySchema, req.body),
    ownerId: req.user.userId,
  });
  const accessToken = await issueTokens(reply, {
    userId: req.user.userId,
    donViId: company.id,
    role: req.user.role,
  });
  return sendCreated(reply, { company, accessToken, activeDonViId: company.id });
}

/** GET /api/v1/companies — danh sách công ty/MST user được phép (owner + nhân viên). */
export async function listCompanies(req: FastifyRequest, reply: FastifyReply) {
  const data = await listAccessibleCompanies(req.user.userId, req.user.role);
  return sendOk(reply, data);
}

/**
 * POST /api/v1/companies/:id/switch — đổi công ty đang làm việc.
 * Kiểm tra quyền rồi cấp lại token nhúng donViId mới; resolveTenantDb dùng token này.
 */
export async function switchCompany(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };

  const allowed = await canAccessDonVi(req.user.userId, req.user.role, id);
  if (!allowed) throw new ForbiddenError(MESSAGES.COMPANY.NO_ACCESS);

  const accessToken = await issueTokens(reply, {
    userId: req.user.userId,
    donViId: id,
    role: req.user.role,
  });
  return sendOk(reply, { accessToken, activeDonViId: id });
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
