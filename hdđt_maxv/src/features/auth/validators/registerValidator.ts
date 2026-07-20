import type { RegisterFieldErrors, RegisterFormValues } from "../types";
import {
  HO_TEN_MAX,
  checkEmail,
  checkPassword,
  checkPasswordConfirm,
  checkPhone,
  pruneEmpty,
} from "./rules";

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

  errors.email = checkEmail(v.email);
  errors.sdt = checkPhone(v.sdt);
  errors.password = checkPassword(v.password);
  errors.xacNhanMatKhau = checkPasswordConfirm(v.password, v.xacNhanMatKhau);

  return pruneEmpty(errors);
}
