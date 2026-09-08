import { z } from 'zod';
import { MESSAGES } from '../../../constants/messages';

const ngayLeDate = z
  .string({ required_error: MESSAGES.HRM.TEN_NGAY_LE_HOAC_NGAY_EMPTY })
  .trim()
  .min(1, MESSAGES.HRM.TEN_NGAY_LE_HOAC_NGAY_EMPTY)
  .regex(/^\d{4}-\d{2}-\d{2}$/, MESSAGES.HRM.TEN_NGAY_LE_HOAC_NGAY_EMPTY)
  .transform((s, ctx) => {
    const d = new Date(`${s}T00:00:00Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Ngày không có thật: ${s}`,
      });
      return z.NEVER;
    }
    return d;
  });

const ngayLeDateOptional = z
  .string()
  .trim()
  .min(1, MESSAGES.HRM.TEN_NGAY_LE_HOAC_NGAY_EMPTY)
  .regex(/^\d{4}-\d{2}-\d{2}$/, MESSAGES.HRM.TEN_NGAY_LE_HOAC_NGAY_EMPTY)
  .transform((s, ctx) => {
    const d = new Date(`${s}T00:00:00Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Ngày không có thật: ${s}`,
      });
      return z.NEVER;
    }
    return d;
  })
  .optional();

export const createHolidaySchema = z
  .object({
    date: ngayLeDate,
    name: z
      .string({ required_error: MESSAGES.HRM.TEN_NGAY_LE_HOAC_NGAY_EMPTY })
      .trim()
      .min(1, MESSAGES.HRM.TEN_NGAY_LE_HOAC_NGAY_EMPTY)
      .max(150, 'Tên ngày lễ tối đa 150 ký tự'),
    type: z.enum(['NATIONAL', 'LUNAR', 'COMPANY', 'COMPENSATORY']).default('NATIONAL'),
    isAnnual: z.boolean().default(true),
    isPaid: z.boolean().default(true),
    note: z
      .string()
      .trim()
      .max(500, 'Ghi chú tối đa 500 ký tự')
      .nullable()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
  })
  .superRefine((data, ctx) => {
    // E-hrm-075: Lễ âm lịch và nghỉ bù không được lặp lại hàng năm
    if ((data.type === 'LUNAR' || data.type === 'COMPENSATORY') && data.isAnnual === true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['isAnnual'],
        message: MESSAGES.HRM.LE_AM_LICH_KHONG_THE_LAP_LAI,
      });
    }
  });

export const updateHolidaySchema = z
  .object({
    date: ngayLeDateOptional,
    name: z
      .string()
      .trim()
      .min(1, MESSAGES.HRM.TEN_NGAY_LE_HOAC_NGAY_EMPTY)
      .max(150, 'Tên ngày lễ tối đa 150 ký tự')
      .optional(),
    type: z.enum(['NATIONAL', 'LUNAR', 'COMPANY', 'COMPENSATORY']).optional(),
    isAnnual: z.boolean().optional(),
    isPaid: z.boolean().optional(),
    note: z
      .string()
      .trim()
      .max(500, 'Ghi chú tối đa 500 ký tự')
      .nullable()
      .optional()
      .transform((v) => (v !== undefined ? (v && v.length > 0 ? v : null) : undefined)),
  })
  .superRefine((data, ctx) => {
    if ((data.type === 'LUNAR' || data.type === 'COMPENSATORY') && data.isAnnual === true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['isAnnual'],
        message: MESSAGES.HRM.LE_AM_LICH_KHONG_THE_LAP_LAI,
      });
    }
  });

export const holidayListQuerySchema = z.object({
  /*
   * Trần dưới/trên là chặn KỸ THUẬT, không phải dải nghiệp vụ 2024–2030 (`BR-hrm-079` chỉ áp cho
   * "Tạo nhanh"). Ở đây người dùng được xem lịch của năm bất kỳ, nhưng `year` đi thẳng vào
   * `new Date(\`${year}-01-01T00:00:00.000Z\`)` ở service: `year = 0 / 1 / -1 / 99999` tạo ra
   * `Invalid Date`, lọt xuống Prisma rồi vỡ thành **500** trong khi đó là lỗi của đầu vào và phải
   * là **400**. Chặn tại đây để mọi năm còn lại đều dựng được `Date` hợp lệ.
   */
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  filter: z.enum(['THIS_YEAR', 'ANNUAL', 'ALL']).default('THIS_YEAR'),
  type: z.enum(['NATIONAL', 'LUNAR', 'COMPANY', 'COMPENSATORY']).optional(),
  /*
   * KHÔNG dùng `z.coerce.boolean()` cho tham số query — `Boolean("false") === true` trong
   * JavaScript, mà query string thì LUÔN là chuỗi. Bản cũ vì thế biến `?isPaid=false` thành bộ
   * lọc `isPaid = true`: trả về đúng NHÓM NGƯỢC LẠI, và im lặng (`BE-03`, `api-contract.md`
   * Mục 7F.2). Enum tường minh vừa lọc đúng, vừa báo 400 ngay khi nhận giá trị lạ thay vì đoán.
   */
  isPaid: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  sortBy: z.enum(['date', 'name', 'createdAt']).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const holidayParamSchema = z.object({
  id: z.string().trim().min(1, 'ID ngày lễ không được để trống'),
});

export const quickGenerateHolidaySchema = z
  .object({
    /* E-hrm-079 — dải năm nghiệp vụ 2024–2030 (BR-hrm-079). Lớp chặn thứ hai ở `holidays.service.ts`. */
    year: z.coerce
      .number({ invalid_type_error: MESSAGES.HRM.NAM_KHOI_TAO_LE_INVALID })
      .int()
      .min(2024, MESSAGES.HRM.NAM_KHOI_TAO_LE_INVALID)
      .max(2030, MESSAGES.HRM.NAM_KHOI_TAO_LE_INVALID)
      .optional(),
    /*
     * CHẾ ĐỘ CHẠY THỬ (xem trước) — `dryRun: true` thì KHÔNG ghi dòng nào vào `hrm_holidays`.
     *
     * ⚠️ `z.boolean()` THẬT — TUYỆT ĐỐI KHÔNG "tối ưu" thành `z.coerce.boolean()`.
     * `Boolean("false") === true` trong JavaScript, nên `coerce` biến mọi chuỗi khác rỗng thành
     * `true`. Người gọi gửi `{"dryRun":"false"}` với ý "ghi thật" sẽ nhận về một lượt xem trước,
     * không dòng nào được lưu, và không có gì báo cho họ biết. Đây đúng là lỗi `BE-03` vừa sửa ở
     * `holidayListQuerySchema` ngay trên (`?isPaid=false` lọc ra nhóm ngược lại), chỉ khác chỗ tổn
     * thất: bên kia trả sai danh sách, bên này nuốt mất thao tác ghi.
     *
     * Ở ĐÂY không cần `coerce` vì đây là **thân JSON** — `JSON.parse` đã trả về boolean thật;
     * còn query string thì luôn là chuỗi. Gửi `"true"`/`"false"` dạng chuỗi vào đây bị từ chối 400:
     * cố ý — thà báo lỗi còn hơn đoán bừa ý người gọi.
     */
    dryRun: z.boolean().optional(),
  });

export type CreateHolidayInput = z.infer<typeof createHolidaySchema>;
export type UpdateHolidayInput = z.infer<typeof updateHolidaySchema>;
export type HolidayListQuery = z.infer<typeof holidayListQuerySchema>;
export type QuickGenerateHolidayInput = z.infer<typeof quickGenerateHolidaySchema>;
