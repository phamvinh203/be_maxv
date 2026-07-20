import nodemailer from 'nodemailer';
import { env } from '../../config/env';

// Timeout tường minh: mặc định của nodemailer là 2 phút cho connection — quá dài,
// đủ để treo cả request HTTP đang chờ gửi mail (vd adminApproveInvite bắt buộc await).
// Cổng 587 bị firewall chặn là tình huống hay gặp trên VPS.
const transporter = nodemailer.createTransport({
  host: env.smtpHost,
  port: env.smtpPort,
  secure: env.smtpPort === 465,
  auth: { user: env.smtpUser, pass: env.smtpPassword },
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
});

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
