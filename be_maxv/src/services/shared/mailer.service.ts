import nodemailer from 'nodemailer';
import { env } from '../../config/env';

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const transporter = nodemailer.createTransport({
  host: env.smtpHost,
  port: env.smtpPort,
  secure: false,
  auth: { user: env.smtpUser, pass: env.smtpPassword },
});

/** Khung HTML dùng chung cho mọi email — mỗi hàm chỉ khai báo phần header + nội dung riêng. */
function renderEmail(header: string, body: string): string {
  return `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        ${header}
        <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px">
          ${body}
        </div>
      </div>
    `;
}

/**
 * Gửi mail best-effort: nuốt lỗi ngay tại đây (log ra console) thay vì bắt
 * caller nào cũng phải tự `.catch()` — gửi mail không bao giờ làm hỏng luồng
 * nghiệp vụ chính (mời/duyệt nhân viên).
 */
async function sendMailSafe(
  options: Parameters<typeof transporter.sendMail>[0],
): Promise<void> {
  try {
    await transporter.sendMail(options);
  } catch (err) {
    console.error('[mailer] gửi email thất bại:', err);
  }
}

/** Gửi khi owner tạo lời mời mới — tới tất cả email user role=ADMIN. */
export async function sendInviteNotifyToAdmins({
  adminEmails,
  companyName,
  ownerName,
  inviteEmail,
  roleLabel,
}: {
  adminEmails: string[];
  companyName: string;
  ownerName: string;
  inviteEmail: string;
  roleLabel: string;
}): Promise<void> {
  if (adminEmails.length === 0) return;
  await sendMailSafe({
    from: `"MAXV System" <${env.smtpFrom}>`,
    to: adminEmails.join(','),
    subject: `[MAXV] Yêu cầu mời nhân viên mới — ${companyName}`,
    html: renderEmail(
      `<div style="background:#0f2b5b;padding:20px 24px;border-radius:8px 8px 0 0">
          <h2 style="color:#fff;margin:0;font-size:18px">MAXV — Yêu cầu mời nhân viên</h2>
        </div>`,
      `<p style="margin:0 0 16px;color:#374151">Có một yêu cầu mới cần duyệt:</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;width:160px;border:1px solid #e5e7eb">Công ty</td>
                <td style="padding:8px 12px;border:1px solid #e5e7eb">${esc(companyName)}</td></tr>
            <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;border:1px solid #e5e7eb">Người yêu cầu</td>
                <td style="padding:8px 12px;border:1px solid #e5e7eb">${esc(ownerName)}</td></tr>
            <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;border:1px solid #e5e7eb">Email nhân viên</td>
                <td style="padding:8px 12px;border:1px solid #e5e7eb"><b>${esc(inviteEmail)}</b></td></tr>
            <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;border:1px solid #e5e7eb">Vai trò đề xuất</td>
                <td style="padding:8px 12px;border:1px solid #e5e7eb">${esc(roleLabel)}</td></tr>
          </table>
          <div style="margin-top:20px;padding:12px 16px;background:#fffbeb;border-radius:6px;border:1px solid #fde68a;font-size:13px;color:#92400e">
            Vui lòng đăng nhập Admin Panel để duyệt hoặc từ chối yêu cầu này.
          </div>`,
    ),
  });
}

/** Gửi khi admin duyệt — mật khẩu tạm cho nhân viên. */
export async function sendApprovedToEmployee({
  email,
  companyName,
  tempPassword,
  loginUrl,
}: {
  email: string;
  companyName: string;
  tempPassword: string;
  loginUrl: string;
}): Promise<void> {
  await sendMailSafe({
    from: `"MAXV" <${env.smtpFrom}>`,
    to: email,
    subject: `Bạn đã được thêm vào ${companyName} trên MAXV`,
    html: renderEmail(
      `<div style="background:linear-gradient(135deg,#0a3d91,#0078ff);padding:28px 24px;border-radius:8px 8px 0 0;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800">MAXV</h1>
        </div>`,
      `<h2 style="margin:0 0 16px;font-size:17px;color:#1a2744">Xin chào!</h2>
          <p style="color:#374151;line-height:1.7;margin:0 0 20px">
            Bạn đã được thêm vào công ty <b>${esc(companyName)}</b> trên hệ thống MAXV.<br>
            Dưới đây là thông tin đăng nhập của bạn:
          </p>
          <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:20px 24px;margin-bottom:20px">
            <div style="margin-bottom:12px">
              <div style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase">Email đăng nhập</div>
              <div style="font-size:15px;color:#1a2744;margin-top:4px;font-weight:500">${esc(email)}</div>
            </div>
            <div>
              <div style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase">Mật khẩu tạm thời</div>
              <div style="font-size:20px;color:#1e4d91;margin-top:4px;font-weight:800;font-family:monospace;letter-spacing:2px">${esc(tempPassword)}</div>
            </div>
          </div>
          <a href="${esc(loginUrl)}" style="display:block;background:#1e4d91;color:#fff;text-decoration:none;text-align:center;padding:13px;border-radius:8px;font-weight:700;font-size:14px">
            Đăng nhập ngay →
          </a>
          <p style="margin-top:16px;font-size:12px;color:#9ca3af;line-height:1.6">
            Vui lòng đổi mật khẩu sau lần đăng nhập đầu tiên.
          </p>`,
    ),
  });
}
