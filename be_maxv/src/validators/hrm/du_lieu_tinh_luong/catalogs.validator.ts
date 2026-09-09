import { z } from 'zod';

// --- KPI Item ---
export const createKpiItemSchema = z.object({
  code: z.string().trim().max(20).optional(),
  name: z.string().trim().min(1).max(200),
  unit: z.string().trim().min(1).max(50),
  defaultWeight: z.coerce.number().int().min(0).max(100).default(100),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});
export type CreateKpiItemInput = z.infer<typeof createKpiItemSchema>;

export const updateKpiItemSchema = createKpiItemSchema.partial();
export type UpdateKpiItemInput = z.infer<typeof updateKpiItemSchema>;

// --- Piecework Product ---
export const createProductSchema = z.object({
  code: z.string().trim().max(20).optional(),
  name: z.string().trim().min(1).max(200),
  unit: z.string().trim().min(1).max(50),
  unitPrice: z.coerce.number().min(0).default(0),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial();
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// --- Diligence Violation Type ---
export const createDiligenceTypeSchema = z.object({
  code: z.string().trim().max(20).optional(),
  name: z.string().trim().min(1).max(200),
  deductionMethod: z.enum(['theo_gio', 'theo_lan', 'mat_toan_bo']),
  penaltyRate: z.coerce.number().min(0).default(0),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});
export type CreateDiligenceTypeInput = z.infer<typeof createDiligenceTypeSchema>;

export const updateDiligenceTypeSchema = createDiligenceTypeSchema.partial();
export type UpdateDiligenceTypeInput = z.infer<typeof updateDiligenceTypeSchema>;

// --- Salary Adjustment Item ---
export const createAdjustmentItemSchema = z.object({
  code: z.string().trim().max(20).optional(),
  name: z.string().trim().min(1).max(200),
  direction: z.enum(['tru', 'bu']),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});
export type CreateAdjustmentItemInput = z.infer<typeof createAdjustmentItemSchema>;

export const updateAdjustmentItemSchema = createAdjustmentItemSchema.partial();
export type UpdateAdjustmentItemInput = z.infer<typeof updateAdjustmentItemSchema>;

export const catalogQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'ALL']).default('ACTIVE'),
  q: z.string().trim().optional(),
});
export type CatalogQuery = z.infer<typeof catalogQuerySchema>;
