import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import { chiSo, tienVn } from "../_shared/format";

interface Props {
  label: string;
  value: number;
  onChange: (value: number) => void;
  helperText?: string;
  /** Khóa ô khi giá trị chưa có chỗ lưu — xem ô lương ở ThongTinTab. */
  disabled?: boolean;
  /** Bôi đỏ ô + `helperText` — dùng cho ràng buộc lương lớn hơn 0 (E-hrm-056 / E-hrm-057). */
  error?: boolean;
  required?: boolean;
}

/**
 * Ô nhập số tiền có dấu phân cách hàng nghìn.
 *
 * Dùng `type="text"` chứ không `type="number"`: ô số của trình duyệt không hiện
 * được dấu chấm phân cách, và lăn chuột trên ô đang focus sẽ âm thầm đổi giá trị.
 */
export default function TienField({
  label,
  value,
  onChange,
  helperText,
  disabled,
  error,
  required,
}: Props) {
  return (
    <TextField
      label={label}
      size="small"
      fullWidth
      disabled={disabled}
      error={error}
      required={required}
      value={value ? tienVn(value) : ""}
      onChange={(e) => onChange(chiSo(e.target.value))}
      helperText={helperText}
      slotProps={{
        htmlInput: { inputMode: "numeric" },
        input: {
          endAdornment: <InputAdornment position="end">₫</InputAdornment>,
        },
      }}
    />
  );
}
