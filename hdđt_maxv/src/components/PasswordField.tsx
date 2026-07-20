import { useState, type ChangeEvent } from "react";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

interface Props {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  /** Thông báo lỗi — có giá trị thì ô chuyển đỏ và hiện chữ bên dưới. */
  error?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  required?: boolean;
}

/**
 * Ô nhập mật khẩu kèm nút ẩn/hiện. Trạng thái ẩn/hiện do CHÍNH ô tự giữ, nên nhiều ô
 * trên cùng form toggle độc lập mà form cha không phải khai báo state cho từng ô.
 * `aria-label` của nút ghép từ `label` để screen reader phân biệt được các ô.
 * Dùng: `RegisterForm` (mật khẩu + xác nhận mật khẩu).
 */
export default function PasswordField({
  label,
  value,
  onChange,
  error,
  autoComplete = "new-password",
  autoFocus,
  required,
}: Props) {
  const [shown, setShown] = useState(false);

  return (
    <TextField
      label={label}
      type={shown ? "text" : "password"}
      value={value}
      onChange={onChange}
      error={!!error}
      helperText={error}
      fullWidth
      autoComplete={autoComplete}
      autoFocus={autoFocus}
      required={required}
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label={`${shown ? "Ẩn" : "Hiện"} ${label}`}
                onClick={() => setShown((s) => !s)}
                edge="end"
              >
                {shown ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
