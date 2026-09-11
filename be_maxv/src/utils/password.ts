import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';

const SALT_ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/**
 * Băm một mật khẩu NGẪU NHIÊN không ai biết (kể cả hệ thống — không giữ lại bản rõ): cho tài khoản vừa duyệt
 * lời mời, hoặc vừa bị admin vô hiệu mật khẩu. Người dùng tự đặt mật khẩu bằng "Quên mật khẩu" (OTP).
 * Thay cho việc sinh mật khẩu rồi gửi dạng rõ qua email / hiện cho admin (vbsec 2026-09-10).
 */
export function bamMatKhauKhongAiBiet(): Promise<string> {
  return hashPassword(randomBytes(32).toString('base64url'));
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
