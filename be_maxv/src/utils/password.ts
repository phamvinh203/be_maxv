import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';

const SALT_ROUNDS = 10;

/** Sinh mật khẩu ngẫu nhiên (~12 ký tự) cho admin đặt lại hộ người dùng. */
export function generatePassword(): string {
  return randomBytes(9).toString('base64url');
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Hash giả cố định. Khi đăng nhập mà email không tồn tại, vẫn so sánh với hash
 * này để thời gian phản hồi không đổi -> không lộ việc email có tồn tại hay
 * không (chống timing attack / user enumeration).
 * Hardcode hằng số (giá trị không cần bí mật) thay vì hashSync lúc khởi động
 * để tránh block event loop ~100ms khi boot.
 */
export const DUMMY_HASH =
  '$2b$10$yleMKhfc1f.qg9xcdar.ZuYHoKbE2FIEPJZ3iE.ngneEPsx3Wip02';
