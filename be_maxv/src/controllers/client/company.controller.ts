import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  deleteCompanySchema,
  registerCompanySchema,
  inviteUserSchema,
  setEmployeeAccessSchema,
  updateCompanySchema,
} from '../../validators/company.validator';
import {
  destroyCompany,
  inviteUserToCompany,
  listCompanyEmployees,
  listCompanyInvites,
  registerCompany,
  setEmployeeAccess,
  updateCompanyInfo,
} from '../../services/client/company.service';
import {
  firstAccessibleCompanyId,
  listAccessibleCompaniesDetailed,
  resolveAccountOwnerId,
} from '../../services/shared/companyAccess.service';
import { canAccessDonVi } from '../../helpers/access';
import { reissueSession } from '../../helpers/authTokens';
import { validateBody } from '../../utils/validate';
import { sendCreated, sendOk } from '../../helpers/response';
import { ForbiddenError } from '../../helpers/errors';
import { MESSAGES } from '../../constants/messages';

/**
 * POST /api/v1/companies — Owner tạo 1 công ty/MST + cấp DB maxv_<mst>_app.
 *
 * Mặc định (activate=true, dùng ở luồng thiết lập lần đầu): tự động switch sang MST
 * vừa tạo (cấp token mới + refresh cookie) để owner vào làm ngay.
 *
 * activate=false (dùng khi thêm MST từ Cài đặt, owner đang làm việc ở MST khác):
 * KHÔNG đụng tới token/refresh cookie hiện tại — tránh cửa sổ đua khi FE phải
 * switch-back thủ công (refresh cookie có thể ngầm trỏ sang MST mới nếu 1 request
 * khác 401 đúng lúc đó).
 */
export async function createCompany(req: FastifyRequest, reply: FastifyReply) {
  const { activate = true } = (req.body as { activate?: boolean }) ?? {};

  const company = await registerCompany({
    ...validateBody(registerCompanySchema, req.body),
    ownerId: req.user.userId,
  });

  if (!activate) {
    return sendCreated(reply, { company });
  }

  // Đặt access cookie mới nhúng donViId công ty vừa tạo — không trả token qua body.
  await reissueSession(reply, req.user, company.id);
  return sendCreated(reply, {
    company,
    activeDonViId: company.id,
  });
}

/** GET /api/v1/companies — danh sách công ty/MST user được phép (owner + nhân viên). */
export async function listCompanies(req: FastifyRequest, reply: FastifyReply) {
  const data = await listAccessibleCompaniesDetailed(
    req.user.userId,
    req.user.role,
  );
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

  // Đặt access cookie mới nhúng donViId công ty vừa đổi — không trả token qua body.
  await reissueSession(reply, req.user, id);
  return sendOk(reply, { activeDonViId: id });
}

/** PUT /api/v1/companies/:id — owner sửa thông tin công ty của chính mình (MST không đổi được). */
export async function updateCompany(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const data = await updateCompanyInfo(
    id,
    req.user.userId,
    validateBody(updateCompanySchema, req.body),
  );
  return sendOk(reply, data);
}

/**
 * DELETE /api/v1/companies/:id — owner XÓA VĨNH VIỄN công ty của chính mình (xem destroyCompany).
 * Body { maSoThue } là bước gõ xác nhận.
 *
 * Nếu vừa xóa đúng công ty đang làm việc thì phải cấp lại token: cookie access còn nhúng donViId
 * của công ty đã biến mất sẽ khiến mọi endpoint theo tenant trả 403 — mà 403 thì apiFetch bên FE
 * không refresh cũng không đăng xuất, user kẹt tới khi access token hết hạn.
 */
export async function deleteCompany(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string };
  const { maSoThue } = validateBody(deleteCompanySchema, req.body);

  await destroyCompany(id, req.user.userId, maSoThue);

  // Xóa công ty KHÁC công ty đang làm việc -> cookie hiện tại vẫn đúng, khỏi truy vấn gì thêm.
  if (req.user.donViId !== id) {
    return sendOk(reply, { id, activeDonViId: req.user.donViId });
  }

  // Đọc SAU khi xóa -> công ty vừa xóa chắc chắn không được chọn lại.
  const activeDonViId = await firstAccessibleCompanyId(
    req.user.userId,
    req.user.role,
  );
  await reissueSession(reply, req.user, activeDonViId);

  return sendOk(reply, { id, activeDonViId });
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
