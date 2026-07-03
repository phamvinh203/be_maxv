import { randomBytes } from 'node:crypto';

/** Khóa chứng từ 16 ký tự hex (tương đương genKey của maxv_v1). */
export function genKey(): string {
  return randomBytes(8).toString('hex');
}
