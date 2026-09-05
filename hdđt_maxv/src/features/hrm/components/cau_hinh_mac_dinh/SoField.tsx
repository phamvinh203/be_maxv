import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";

interface Props {
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** Đơn vị hiện ở cuối ô: `%`, `giờ`, `ngày`, `năm`… */
  donVi?: string;
  helperText?: string;
  buocNhay?: number;
}

/**
 * Ô nhập số cho các tham số cấu hình (tỷ lệ, số giờ, số ngày).
 *
 * Lăn chuột trên ô số đang focus sẽ âm thầm đổi giá trị, nên nhả focus khi lăn —
 * người dùng cuộn trang qua một màn hình dày đặc ô số mà không sợ sửa nhầm.
 * Tiền tệ dùng `TienField` vì cần dấu phân cách hàng nghìn.
 */
export default function SoField({
  label,
  value,
  onChange,
  donVi,
  helperText,
  buocNhay = 1,
}: Props) {
  return (
    <TextField
      label={label}
      type="number"
      size="small"
      fullWidth
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      onWheel={(e) => (e.target as HTMLElement).blur()}
      helperText={helperText}
      slotProps={{
        htmlInput: { step: buocNhay, min: 0 },
        input: donVi
          ? { endAdornment: <InputAdornment position="end">{donVi}</InputAdornment> }
          : undefined,
      }}
    />
  );
}
