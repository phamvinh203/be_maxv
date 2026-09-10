import { z } from 'zod';

// Phạm vi áp dụng chung theo chuẩn giao diện ThanhLocKyLuong
export const scopeEnum = z.enum(['toan_cong_ty', 'phong_ban', 'nhan_vien']);

export const scopeBaseSchema = z.object({
  periodId: z.string().trim().min(1),
  scope: scopeEnum,
  ma_pb: z.string().trim().optional(),
  employeeIds: z.array(z.string().trim().min(1)).optional(),
});

// --- 1. Chấm công (Attendance) ---
export const cellOverrideSchema = z.object({
  periodId: z.string().trim().min(1),
  ma_nv: z.string().trim().min(1),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày chấm công phải theo định dạng YYYY-MM-DD'),
  attendanceType: z.enum([
    'lam_viec',
    'nua_ngay',
    'cong_tac',
    'nghi_phep',
    'nghi_le',
    'om',
    'khong_luong',
    'khac',
  ]),
  actualHours: z.coerce.number().min(0, 'Số giờ không được âm').max(24, 'Số giờ không quá 24h').optional(),
  note: z.string().trim().max(500).optional(),
});
export type CellOverrideInput = z.infer<typeof cellOverrideSchema>;

export const attendanceMatrixQuerySchema = z.object({
  periodId: z.string().trim().min(1),
  ma_pb: z.string().trim().optional(),
  q: z.string().trim().optional(),
});
export type AttendanceMatrixQuery = z.infer<typeof attendanceMatrixQuerySchema>;

// --- 2. Tăng ca (Overtime) ---
export const overtimeItemSchema = z.object({
  otType: z.enum([
    'ngay_thuong_ngay',
    'ngay_thuong_dem',
    'chu_nhat_ngay',
    'chu_nhat_dem',
    'ngay_le_ngay',
    'ngay_le_dem',
  ]),
  hours: z.coerce.number().positive('Số giờ tăng ca phải lớn hơn 0 (E-dltl-007)'),
  note: z.string().trim().max(500).optional(),
});

export const applyOvertimeSchema = scopeBaseSchema.extend({
  items: z.array(overtimeItemSchema),
});
export type ApplyOvertimeInput = z.infer<typeof applyOvertimeSchema>;

// --- 3. KPI ---
export const kpiRecordItemSchema = z.object({
  kpiItemId: z.string().trim().min(1, 'Còn dòng chưa chọn chỉ tiêu (E-dltl-008)'),
  weight: z.coerce.number().int().min(0).default(100),
  targetValue: z.coerce.number().positive('Mục tiêu KPI phải lớn hơn 0'),
  actualValue: z.coerce.number().min(0, 'Thực thi KPI không được âm'),
  note: z.string().trim().max(500).optional(),
});

export const applyKpiSchema = scopeBaseSchema.extend({
  items: z.array(kpiRecordItemSchema),
});
export type ApplyKpiInput = z.infer<typeof applyKpiSchema>;

// --- 4. Thưởng (Bonus) ---
export const bonusRecordItemSchema = z.object({
  salaryItemId: z.string().trim().min(1, 'Còn dòng chưa chọn loại thưởng'),
  amount: z.coerce.number().min(0, 'Số tiền thưởng phải lớn hơn hoặc bằng 0 (E-dltl-012)'),
  note: z.string().trim().max(500).optional(),
});

export const applyBonusSchema = scopeBaseSchema.extend({
  items: z.array(bonusRecordItemSchema),
});
export type ApplyBonusInput = z.infer<typeof applyBonusSchema>;

// --- 5. Lương sản phẩm (Piecework) ---
export const pieceworkRecordItemSchema = z.object({
  productId: z.string().trim().min(1, 'Còn dòng chưa chọn sản phẩm (E-dltl-013)'),
  unitPrice: z.coerce.number().min(0, 'Đơn giá không được âm (E-dltl-015)').optional(),
  quantity: z.coerce.number().min(0, 'Số lượng sản phẩm không được âm (E-dltl-015)'),
  note: z.string().trim().max(500).optional(),
});

export const applyPieceworkSchema = scopeBaseSchema.extend({
  items: z.array(pieceworkRecordItemSchema),
});
export type ApplyPieceworkInput = z.infer<typeof applyPieceworkSchema>;

// --- 6. Lương phần trăm (Commission) ---
export const commissionRecordItemSchema = z.object({
  salaryItemId: z.string().trim().min(1, 'Còn dòng chưa chọn khoản hoa hồng'),
  commissionRate: z.coerce.number().min(0).max(100, 'Tỷ lệ hoa hồng phải từ 0% đến 100% (E-dltl-017)').optional(),
  baseAmount: z.coerce.number().min(0, 'Doanh số cơ sở không được âm'),
  note: z.string().trim().max(500).optional(),
});

export const applyCommissionSchema = scopeBaseSchema.extend({
  items: z.array(commissionRecordItemSchema),
});
export type ApplyCommissionInput = z.infer<typeof applyCommissionSchema>;

// --- 7. Lương chuyên cần (Diligence) ---
export const recordDiligenceSchema = z.object({
  periodId: z.string().trim().min(1),
  ma_nv: z.string().trim().min(1),
  violationTypeId: z.string().trim().min(1, 'Chưa chọn loại vi phạm chuyên cần'),
  violationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày vi phạm phải theo định dạng YYYY-MM-DD (E-dltl-018)'),
  violationHours: z.coerce.number().min(0, 'Số giờ vi phạm không được âm (E-dltl-020)').optional(),
  note: z.string().trim().max(500).optional(),
});
export type RecordDiligenceInput = z.infer<typeof recordDiligenceSchema>;

// --- 8. Ứng - Bù trừ (Adjustments) ---
export const adjustmentRecordItemSchema = z.object({
  adjustmentItemId: z.string().trim().min(1, 'Còn dòng chưa chọn khoản bù trừ (E-dltl-021)'),
  amount: z.coerce.number().positive('Số tiền bù trừ phải lớn hơn 0 (E-dltl-023)'),
  note: z.string().trim().max(500).optional(),
});

export const applyAdjustmentsSchema = scopeBaseSchema.extend({
  items: z.array(adjustmentRecordItemSchema),
});
export type ApplyAdjustmentsInput = z.infer<typeof applyAdjustmentsSchema>;

export const listModuleDataQuerySchema = z.object({
  periodId: z.string().trim().min(1),
  ma_pb: z.string().trim().optional(),
  q: z.string().trim().optional(),
});
export type ListModuleDataQuery = z.infer<typeof listModuleDataQuerySchema>;
