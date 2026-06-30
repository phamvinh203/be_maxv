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

export type IdParam = z.infer<typeof idParamSchema>;
export type ListCompaniesQuery = z.infer<typeof listCompaniesQuerySchema>;
