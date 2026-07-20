import type { RegisterFieldErrors, RegisterFormValues } from "../types";
import {
  checkEmail,
  checkHoTen,
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
  return pruneEmpty<RegisterFieldErrors>({
    hoTen: checkHoTen(v.hoTen),
    email: checkEmail(v.email),
    sdt: checkPhone(v.sdt),
    password: checkPassword(v.password),
    xacNhanMatKhau: checkPasswordConfirm(v.password, v.xacNhanMatKhau),
  });
}
