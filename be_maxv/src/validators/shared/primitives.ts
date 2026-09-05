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
