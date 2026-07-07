import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  registerCompanySchema,
  inviteUserSchema,
  setEmployeeAccessSchema,
} from '../../validators/company.validator';
import {
  inviteUserToCompany,
  listCompanyEmployees,
  listCompanyInvites,
  registerCompany,
  setEmployeeAccess,
} from '../../services/client/company.service';
import {
  listAccessibleCompaniesDetailed,
  resolveAccountOwnerId,
} from '../../services/shared/companyAccess.service';
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
  const data = await listAccessibleCompaniesDetailed(req.user.userId, req.user.role);
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

// POST /api/v1/companies/invite - owner mời nhân viên vào tài khoản + cấp quyền MST (donViIds)
export async function inviteUser(req: FastifyRequest, reply: FastifyReply) {
  const data = await inviteUserToCompany({
    ...validateBody(inviteUserSchema, req.body),
    ownerId: req.user.userId, // route yêu cầu role OWNER -> account = chính user này
    requestedById: req.user.userId,
  });
  return sendCreated(reply, data);
}

// GET /api/v1/companies/employees - thành viên tài khoản (owner + nhân viên đều xem được)
export async function listEmployees(req: FastifyRequest, reply: FastifyReply) {
  const ownerId = await resolveAccountOwnerId(req.user.userId, req.user.role);
  const data = await listCompanyEmployees(ownerId);
  return sendOk(reply, data);
}

// GET /api/v1/companies/invites - toàn bộ lời mời (mọi trạng thái) của tài khoản
export async function listInvites(req: FastifyRequest, reply: FastifyReply) {
  const ownerId = await resolveAccountOwnerId(req.user.userId, req.user.role);
  const data = await listCompanyInvites(ownerId);
  return sendOk(reply, data);
}

// PUT /api/v1/companies/employees/:userId/access - owner đặt lại tập MST của 1 nhân viên
export async function setAccess(req: FastifyRequest, reply: FastifyReply) {
  const { userId } = req.params as { userId: string };
  const { donViIds } = validateBody(setEmployeeAccessSchema, req.body);
  const data = await setEmployeeAccess(req.user.userId, userId, donViIds);
  return sendOk(reply, data);
}
