/**
 * Nội dung các email hệ thống gửi cho người dùng — thuần dữ liệu, KHÔNG gửi đi.
 * Việc gửi do `services/shared/mailer.service.ts` lo.
 *
 * Mỗi template là 1 hàm trả về `MailContent`, để service gọi gọn:
 *   await sendMail({ to: email, ...welcomeEmail({ hoTen, email }) });
 *
 * Tách riêng khỏi service vì nội dung email thay đổi thường xuyên hơn logic nghiệp vụ,
 * và để các luồng khác (đặt lại mật khẩu, xác thực email, mời nhân viên) dùng chung
 * một chỗ thay vì mỗi service tự nhúng chuỗi.
 */

/**
 * Phần nội dung của 1 email = tham số của `sendMail` trừ người nhận.
 * Suy ra từ `SendMailInput` thay vì khai lại, để nếu `sendMail` thêm field (vd `html`)
 * thì template không âm thầm lệch khỏi hợp đồng.
 */
export type MailContent = Omit<SendMailInput, 'to'>;

import type { SendMailInput } from '../services/shared/mailer.service';

/** Công ty/MST hiển thị trong email — chỉ cần đúng 2 field này. */
export interface MailCongTy {
  tenDonVi: string;
  maSoThue: string;
}

/**
 * "Tên A (MST A), Tên B (MST B)" — dùng chung cho các email nhắc tới danh sách công ty.
 * Dùng: nội bộ file này (`inviteApprovedEmail`, `newInviteNoticeEmail`).
 */
function formatCongTy(list: MailCongTy[]): string {
  return list.map((c) => `${c.tenDonVi} (${c.maSoThue})`).join(', ');
}

/**
 * Email chào mừng sau khi đăng ký tài khoản thành công.
 * KHÔNG chứa mật khẩu — người dùng tự đặt khi đăng ký, gửi lại là rò rỉ vô cớ.
 * Dùng: `registerUser` (services/client/auth.service.ts).
 */
export function welcomeEmail(input: {
  hoTen: string;
  email: string;
}): MailContent {
  return {
    subject: 'Đăng ký tài khoản MaxV thành công',
    text: [
      `Xin chào ${input.hoTen},`,
      '',
      'Tài khoản MaxV của bạn đã được tạo thành công.',
      `Email đăng nhập: ${input.email}`,
      '',
      'Bạn có thể đăng nhập và bắt đầu khai báo công ty/hộ kinh doanh để sử dụng hóa đơn điện tử.',
      'Tài khoản đang dùng gói dùng thử.',
      '',
      'Nếu bạn không thực hiện đăng ký này, vui lòng bỏ qua email.',
    ].join('\n'),
  };
}

/**
 * Email báo nhân viên đã được admin duyệt, kèm mật khẩu đăng nhập.
 *
 * CÓ CHỨA MẬT KHẨU — khác `welcomeEmail`, và đây là chủ ý: mật khẩu do hệ thống sinh
 * (`generatePassword`) nên email này là kênh DUY NHẤT người nhận biết được nó. Vì vậy
 * caller phải rollback việc tạo user nếu gửi thất bại. Đừng "sửa" bằng cách bỏ mật khẩu
 * ra khỏi email mà không đổi luồng cấp mật khẩu.
 * Dùng: `approveInvite` (services/admin/adminInvite.service.ts).
 */
export function inviteApprovedEmail(input: {
  email: string;
  password: string;
  congTy: MailCongTy[];
}): MailContent {
  return {
    subject: 'Tài khoản nhân viên của bạn đã được duyệt',
    text: [
      `Công ty được cấp: ${formatCongTy(input.congTy)}`,
      `Email đăng nhập: ${input.email}`,
      `Mật khẩu: ${input.password}`,
      'Vui lòng đăng nhập và đổi mật khẩu ngay lần đầu sử dụng.',
    ].join('\n'),
  };
}

/**
 * Email báo cho admin hệ thống có lời mời nhân viên mới đang chờ duyệt.
 * Gửi tới nhiều admin cùng lúc — caller truyền mảng địa chỉ vào `to`.
 * Dùng: `notifyAdminsOfNewInvite` (services/client/company.service.ts).
 */
export function newInviteNoticeEmail(input: {
  ownerHoTen: string;
  hoTen: string;
  email: string;
  chucVu: string;
  congTy: MailCongTy[];
}): MailContent {
  return {
    subject: 'Yêu cầu duyệt lời mời nhân viên mới',
    text: [
      `Người gửi mời: ${input.ownerHoTen}`,
      `Nhân viên được mời: ${input.hoTen} <${input.email}>`,
      `Chức vụ: ${input.chucVu}`,
      `Công ty được cấp: ${formatCongTy(input.congTy)}`,
    ].join('\n'),
  };
}
