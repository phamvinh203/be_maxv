import type { RegisterFieldErrors, RegisterFormValues } from "../types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9]{9,11}$/;
const HO_TEN_MAX = 100;

/** Giá trị rỗng ban đầu của form đăng ký. Dùng: state khởi tạo của `RegisterForm`. */
export const EMPTY_REGISTER_FORM: RegisterFormValues = {
  hoTen: "",
  email: "",
  sdt: "",
  password: "",
  xacNhanMatKhau: "",
};

/**
 * Validate form đăng ký, soi theo `registerSchema` (zod) của be_maxv để lỗi hiện ngay
 * thay vì đợi round-trip. Giữ hai bên khớp nhau: lệch chỗ nào thì chỗ đó lọt qua FE rồi
 * nhận 400 khó hiểu (backend không trả `message` cho lỗi validate).
 * `xacNhanMatKhau` là luật riêng của FE — backend không có trường này.
 *
 * Trả object rỗng nghĩa là hợp lệ.
 * Dùng: `RegisterForm` (lúc submit).
 */
export function validateRegisterForm(v: RegisterFormValues): RegisterFieldErrors {
  const errors: RegisterFieldErrors = {};

  const hoTen = v.hoTen.trim();
  if (!hoTen) errors.hoTen = "Vui lòng nhập họ tên.";
  else if (hoTen.length > HO_TEN_MAX) errors.hoTen = `Họ tên tối đa ${HO_TEN_MAX} ký tự.`;
  else if (/[\r\n]/.test(hoTen)) errors.hoTen = "Họ tên không được xuống dòng.";

  if (!v.email.trim()) errors.email = "Vui lòng nhập email.";
  else if (!EMAIL_RE.test(v.email.trim())) errors.email = "Email không hợp lệ.";

  if (!v.sdt.trim()) errors.sdt = "Vui lòng nhập số điện thoại.";
  else if (!PHONE_RE.test(v.sdt.trim())) errors.sdt = "Số điện thoại phải gồm 9-11 chữ số.";

  if (v.password.length < 8) errors.password = "Mật khẩu tối thiểu 8 ký tự.";
  else if (!/[A-Za-z]/.test(v.password)) errors.password = "Mật khẩu phải có ít nhất 1 chữ cái.";
  else if (!/[0-9]/.test(v.password)) errors.password = "Mật khẩu phải có ít nhất 1 chữ số.";

  if (!v.xacNhanMatKhau) errors.xacNhanMatKhau = "Vui lòng xác nhận mật khẩu.";
  else if (v.xacNhanMatKhau !== v.password)
    errors.xacNhanMatKhau = "Mật khẩu xác nhận không khớp.";

  return errors;
}
