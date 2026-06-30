import type { ZodTypeAny, infer as ZodInfer } from 'zod';
import { ValidationError } from '../helpers/errors';

// Suy ra theo OUTPUT của schema (sau .default()/.coerce) thay vì input.
function parseOrThrow<S extends ZodTypeAny>(
  schema: S,
  data: unknown,
): ZodInfer<S> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new ValidationError(parsed.error.flatten());
  return parsed.data;
}

export const validateBody = parseOrThrow;
export const validateQuery = parseOrThrow;
export const validateParams = parseOrThrow;
