import { z } from 'zod';
import { MODULE_KEYS } from '../constants/modules';
import { emailRule } from './auth.validator';

/**
 * `SubscriptionPlan.features` — bản đồ "gói này cho những module nào".
 * Chỉ nhận đúng khóa trong `MODULE_KEYS` nên thêm module không phải sửa đây.
 */
const featuresSchema = z.object(
  Object.fromEntries(MODULE_KEYS.map((k) => [k, z.boolean().optional()])),
) as z.ZodType<Partial<Record<(typeof MODULE_KEYS)[number], boolean>>>;

// :id trên URL (dùng chung cho mọi route admin thao tác 1 công ty)
export const idParamSchema = z.object({
  id: z.string().uuid(),
});

// GET /admin/companies?status=&q=&page=&pageSize=
export const listCompaniesQuerySchema = z.object({
  status: z.enum(['PROVISIONING', 'READY', 'FAILED', 'SUSPENDED']).optional(),
  q: z.string().trim().min(1).optional(), // tìm theo MST hoặc tên công ty
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// GET /admin/logs — nhật ký hệ thống (bảng syslog) + bộ lọc cụ thể.
export const listLogsQuerySchema = z.object({
  // Mức độ
  level: z.enum(['INFO', 'WARN', 'ERROR']).optional(),
  // Hành động (vd LOGIN, REGISTER, CREATE_COMPANY...) — khớp chính xác (có index)
  hanhDong: z.string().trim().min(1).optional(),
  // Lọc theo người dùng / đơn vị
  userId: z.string().uuid().optional(),
  donViId: z.string().uuid().optional(),
  // Lọc theo IP (chứa)
  ip: z.string().trim().min(1).optional(),
  // Khoảng thời gian theo createdAt (ISO date/datetime)
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  // Sắp xếp theo thời gian (mặc định mới nhất trước)
  sort: z.enum(['asc', 'desc']).default('desc'),
  // Phân trang
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ---- Gói dịch vụ (subscription_plans) ----
export const createPlanSchema = z.object({
  ma: z.string().trim().min(1).toUpperCase(),
  ten: z.string().trim().min(1),
  gia: z.coerce.number().min(0).default(0),
  chuKyThang: z.coerce.number().int().min(0).default(1), // 0 = trial
  soMstToiDa: z.coerce.number().int().min(1).nullish(), // null = không giới hạn số MST
  soNguoiToiDa: z.coerce.number().int().min(1).nullish(), // null = không giới hạn số nhân viên
  isActive: z.boolean().default(true),
  features: featuresSchema.default({}),
});

// Cập nhật: mọi field optional (không sửa `ma` để giữ ổn định khóa nghiệp vụ).
export const updatePlanSchema = z.object({
  ten: z.string().trim().min(1).optional(),
  gia: z.coerce.number().min(0).optional(),
  chuKyThang: z.coerce.number().int().min(0).optional(),
  soMstToiDa: z.coerce.number().int().min(1).nullish(),
  soNguoiToiDa: z.coerce.number().int().min(1).nullish(),
  isActive: z.boolean().optional(),
  features: featuresSchema.optional(),
});

// ---- Thuê bao (subscription) ----
export const listSubscriptionsQuerySchema = z.object({
  status: z
    .enum(['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED'])
    .optional(),
  q: z.string().trim().min(1).optional(), // tìm theo MST / tên đơn vị
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const changePlanSchema = z.object({
  planId: z.string().uuid(),
  ghiChu: z.string().trim().optional(),
});

// ---- Người dùng (users) ----
const ROLES = ['ADMIN', 'OWNER', 'OWNER_EMPLOYEE'] as const;
// Vai trò admin có thể GÁN qua UI — KHÔNG gồm ADMIN (gán/gỡ admin chỉ qua DB,
// tránh leo thang đặc quyền bằng dropdown).
const ASSIGNABLE_ROLES = ['OWNER', 'OWNER_EMPLOYEE'] as const;

export const listUsersQuerySchema = z.object({
  role: z.enum(ROLES).optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'REJECTED']).optional(),
  donViId: z.string().uuid().optional(),
  q: z.string().trim().min(1).optional(), // tìm theo email / họ tên / sđt
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const changeRoleSchema = z.object({ role: z.enum(ASSIGNABLE_ROLES) });

// DELETE /admin/users/:id — bắt gõ lại email để xác nhận xóa vĩnh viễn (xem adminDeleteUser:
// xóa OWNER kéo theo DROP DATABASE mọi MST của họ). `emailRule` chuẩn hóa trim + lowercase ở
// ĐÂY là điểm duy nhất — service chỉ so bằng, không tự chuẩn hóa lại.
export const deleteUserSchema = z.object({ email: emailRule });

// ---- Tài khoản (owner-centric) ----
// GET /admin/owners?q=&page=&pageSize=
export const listOwnersQuerySchema = z.object({
  q: z.string().trim().min(1).optional(), // tìm theo email / họ tên owner
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ---- Lời mời nhân viên (invite_requests) ----
export const listInvitesQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  donViId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const rejectInviteSchema = z.object({
  lyDoTuChoi: z.string().trim().min(1).max(255).optional(),
});

export type IdParam = z.infer<typeof idParamSchema>;
export type ListInvitesQuery = z.infer<typeof listInvitesQuerySchema>;
export type RejectInviteInput = z.infer<typeof rejectInviteSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;
export type DeleteUserInput = z.infer<typeof deleteUserSchema>;
export type ListOwnersQuery = z.infer<typeof listOwnersQuerySchema>;
export type ListCompaniesQuery = z.infer<typeof listCompaniesQuerySchema>;
export type ListLogsQuery = z.infer<typeof listLogsQuerySchema>;
export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type ListSubscriptionsQuery = z.infer<typeof listSubscriptionsQuerySchema>;
export type ChangePlanInput = z.infer<typeof changePlanSchema>;
