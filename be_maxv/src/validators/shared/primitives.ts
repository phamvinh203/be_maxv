import { z } from 'zod';
import { MST_REGEX } from '../../utils/dbName';
import { emailRule } from '../auth.validator';
import { MESSAGES } from '../../constants/messages';

/** '' | null | undefined -> null; có giá trị -> trim(). Dùng chung cho mọi trường text tùy chọn. */
export const optText = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform((v) => (v && v.length ? v : null));

/**
 * Email TÙY CHỌN — vẫn phải qua `emailRule` (trim + lowercase + đúng định dạng).
 * `auth.validator` nói rõ rule đó phải dùng ở MỌI schema nhận email: chỉ giới hạn độ dài thôi
 * thì "nguyen van a" lọt vào DB, tới lúc gửi mail mới vỡ và không ai truy được từ đâu.
 */
export const optEmail = z
  .union([
    emailRule.max(254, 'Email tối đa 254 ký tự'),
    z.literal(''),
    z.null(),
  ])
  .optional()
  .transform((v) => (v ? v : null));

/**
 * Mã số thuế TÙY CHỌN — dùng chung `MST_REGEX` với công ty (10 số, 10 số + nhánh, hoặc 12 số).
 * MST cá nhân đi thẳng vào tờ khai TNCN nên sai định dạng phải chặn lúc nhập, không để tới
 * lúc quyết toán mới phát hiện.
 */
export const optMst = z
  .union([
    z.string().trim().regex(MST_REGEX, MESSAGES.VALIDATION.INVALID_MST),
    z.literal(''),
    z.null(),
  ])
  .optional()
  .transform((v) => (v ? v : null));

/**
 * Ngày dạng `YYYY-MM-DD` -> Date (UTC 00:00).
 *
 * Ép đúng chuẩn ISO thay vì `z.coerce.date()`: coerce nuốt cả `"15/01/2026"` (ra ngày sai) lẫn
 * số nguyên, mà đây là ngày dùng để tính hợp đồng/lương nên sai một ngày là sai bảng lương.
 * Ghim UTC để ngày không tự lùi/tiến theo múi giờ máy chủ (cột là `@db.Date`).
 */
export const ngayISO = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải theo định dạng YYYY-MM-DD')
  .transform((s, ctx) => {
    const d = new Date(`${s}T00:00:00Z`);
    // Đối chiếu ngược chuỗi: `new Date("2026-02-30")` KHÔNG trả Invalid Date mà tự trôi sang
    // 2026-03-02 — chỉ kiểm NaN thì ngày gõ nhầm sẽ lặng lẽ lưu thành ngày khác.
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Ngày không có thật: ${s}`,
      });
      return z.NEVER;
    }
    return d;
  });

/** Ngày tùy chọn: '' | null | thiếu -> null. */
export const ngayTuyChon = z
  // Quy ô trống về `undefined` TRƯỚC rồi mới cho qua `ngayISO`, thay vì bọc union.
  // Union làm zod nuốt mất thông điệp bên trong: gõ "20/05/2021" chỉ nhận được "Invalid input",
  // người nhập không biết sai ở đâu. Cách này giữ nguyên câu tiếng Việt của `ngayISO`.
  .preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    ngayISO.optional(),
  )
  .transform((v) => v ?? null);
