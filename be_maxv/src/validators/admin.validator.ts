import { z } from 'zod';

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

export type IdParam = z.infer<typeof idParamSchema>;
export type ListCompaniesQuery = z.infer<typeof listCompaniesQuerySchema>;
export type ListLogsQuery = z.infer<typeof listLogsQuerySchema>;
