import { z } from 'zod';
import { MESSAGES } from '../../../constants/messages';
import { tinhGioCongThucTe } from '../../../services/client/hrm/cau_hinh_mac_dinh/workShifts.service';

const timeRegex = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const createWorkShiftSchema = z
  .object({
    code: z
      .string()
      .trim()
      .max(20, 'Mã ca tối đa 20 ký tự')
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v.toUpperCase() : undefined)),
    name: z
      .string({ required_error: MESSAGES.HRM.TEN_CA_LAM_VIEC_EMPTY })
      .trim()
      .min(1, MESSAGES.HRM.TEN_CA_LAM_VIEC_EMPTY)
      .max(100, MESSAGES.HRM.TEN_CA_LAM_VIEC_EMPTY),
    startTime: z
      .string({ required_error: MESSAGES.HRM.GIO_VAO_RA_INVALID })
      .trim()
      .regex(timeRegex, MESSAGES.HRM.GIO_VAO_RA_INVALID),
    endTime: z
      .string({ required_error: MESSAGES.HRM.GIO_VAO_RA_INVALID })
      .trim()
      .regex(timeRegex, MESSAGES.HRM.GIO_VAO_RA_INVALID),
    breakMinutes: z
      .number()
      .int()
      .min(0, MESSAGES.HRM.NGHI_GIUA_CA_HOAC_GIO_CONG_INVALID)
      .default(0),
    status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  })
  .superRefine((data, ctx) => {
    try {
      tinhGioCongThucTe(data.startTime, data.endTime, data.breakMinutes ?? 0);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['breakMinutes'],
        message: MESSAGES.HRM.NGHI_GIUA_CA_HOAC_GIO_CONG_INVALID,
      });
    }
  });

export const updateWorkShiftSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, MESSAGES.HRM.TEN_CA_LAM_VIEC_EMPTY)
      .max(100, MESSAGES.HRM.TEN_CA_LAM_VIEC_EMPTY)
      .optional(),
    startTime: z.string().trim().regex(timeRegex, MESSAGES.HRM.GIO_VAO_RA_INVALID).optional(),
    endTime: z.string().trim().regex(timeRegex, MESSAGES.HRM.GIO_VAO_RA_INVALID).optional(),
    breakMinutes: z
      .number()
      .int()
      .min(0, MESSAGES.HRM.NGHI_GIUA_CA_HOAC_GIO_CONG_INVALID)
      .optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  });

export const workShiftListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  sortBy: z.enum(['code', 'name', 'startTime', 'createdAt']).default('code'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const workShiftParamSchema = z.object({
  id: z.string().trim().min(1, 'ID ca làm việc không được để trống'),
});

export type CreateWorkShiftInput = z.infer<typeof createWorkShiftSchema>;
export type UpdateWorkShiftInput = z.infer<typeof updateWorkShiftSchema>;
export type WorkShiftListQuery = z.infer<typeof workShiftListQuerySchema>;
