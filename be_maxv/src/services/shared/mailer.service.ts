import nodemailer from 'nodemailer';
import { env } from '../../config/env';

/**
 * Tùy chọn kết nối SMTP.
 *
 * Timeout tường minh: mặc định của nodemailer là 2 phút cho connection — quá dài, đủ để treo cả request
 * HTTP đang chờ gửi mail (vd adminApproveInvite bắt buộc await). Cổng 587 bị firewall chặn là tình huống
 * hay gặp trên VPS.
 *
 * `requireTLS` (vbsec 2026-09-10): cổng STARTTLS (587) mà không bắt buộc thì máy chủ — hoặc kẻ đứng giữa
 * gỡ lệnh STARTTLS — không chào TLS là nodemailer gửi TRẦN: mật khẩu SMTP lẫn nội dung mail (mật khẩu tạm,
 * lời mời) đi dạng rõ. Cổng 465 là TLS ngầm (`secure`) từ đầu.
 */
export function cauHinhSmtp(c: { host: string; port: number; user: string; pass: string }) {
  return {
    host: c.host,
    port: c.port,
    secure: c.port === 465,
    requireTLS: c.port !== 465,
    auth: { user: c.user, pass: c.pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  };
}

const transporter = nodemailer.createTransport(
  cauHinhSmtp({
    host: env.smtpHost,
    port: env.smtpPort,
    user: env.smtpUser,
    pass: env.smtpPassword,
  }),
);

export interface SendMailInput {
  to: string | string[];
  subject: string;
  text: string;
}

// Gmail SMTP ghi đè địa chỉ From bằng tài khoản đã xác thực (SMTP_USER) nếu
// SMTP_FROM không phải alias đã verify -> đặt tên hiển thị "MaxV" gắn với
// đúng địa chỉ Gmail auth để tránh hiện "Unknown Sender" ở client mail.
const FROM = `"MaxV" <${env.smtpUser}>`;

/** Gửi email qua SMTP. Ném lỗi gốc của nodemailer nếu thất bại — caller tự quyết định xử lý. */
export async function sendMail(input: SendMailInput): Promise<void> {
  await transporter.sendMail({
    from: FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });
}
