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

/** Gửi email qua SMTP. Ném lỗi gốc của nodemailer nếu thất bại — caller tự quyết định xử lý. */
export async function sendMail(input: SendMailInput): Promise<void> {
  await transporter.sendMail({
    from: env.smtpFrom,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });
}
