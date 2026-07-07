import { z } from 'zod';

/** '' | null | undefined -> null; có giá trị -> trim(). Dùng chung cho mọi trường text tùy chọn. */
export const optText = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform((v) => (v && v.length ? v : null));
