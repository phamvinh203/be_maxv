import nodemailer from 'nodemailer';
import { env } from '../../config/env';

const transporter = nodemailer.createTransport({
  host: env.smtpHost,
  port: env.smtpPort,
  secure: env.smtpPort === 465,
  auth: { user: env.smtpUser, pass: env.smtpPassword },
});

interface SendMailInput {
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
