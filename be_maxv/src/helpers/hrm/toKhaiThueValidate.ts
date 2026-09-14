import type { ZodTypeAny, infer as ZodInfer } from 'zod';
import { ValidationError } from '../errors';
import { ToKhaiThueError } from './toKhaiThueErrors';
import type { ToKhaiThueErrorCode } from '../../constants/hrm/to_khai_thue/toKhaiThueErrors';

/**
 * Kiểm đầu vào cho sub-cụm Tờ khai thuế TNCN, **giữ nguyên mã lỗi nghiệp vụ**.
 *
 * Hợp đồng Mục 0.2 đòi MỌI lỗi trả về đều có trường `code`, *kể cả lỗi Zod* — mà `validateBody`
 * dùng chung lại ném `ValidationError` (chỉ có `errors`, không có `code`). Bọc ở đây thay vì sửa
 * `utils/validate.ts`: file đó là hạ tầng chung của toàn máy chủ, đổi hình dạng lỗi ở đó là đổi
 * hợp đồng của mọi phân hệ khác cùng lúc.
 *
 * Chi tiết từng trường sai được gộp vào `message` để người dùng biết sai ở đâu, thay vì chỉ nhận
 * một câu chung chung.
 */
export function kiemTraTkt<S extends ZodTypeAny>(
  schema: S,
  data: unknown,
  code: ToKhaiThueErrorCode,
): ZodInfer<S> {
  const parsed = schema.safeParse(data);
  if (parsed.success) return parsed.data;

  const { fieldErrors, formErrors } = parsed.error.flatten();
  const chiTiet = [
    ...formErrors,
    ...Object.entries(fieldErrors).flatMap(([truong, loi]) =>
      (loi ?? []).map((l) => `${truong}: ${l}`),
    ),
  ];

  throw new ToKhaiThueError(
    code,
    chiTiet.length > 0 ? chiTiet.join(' · ') : undefined,
  );
}

/** Dùng lại cho nhánh không phải Zod: giữ `ValidationError` của tầng khác đi tiếp bình thường. */
export function laLoiKiemTra(err: unknown): err is ValidationError {
  return err instanceof ValidationError;
}
