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
 *
 * Ở `components/` root (không nằm trong `cau_hinh_mac_dinh/`) vì ≥ 2 module khác dùng
 * (`cai_dat_luong/KhoanLuongFormDialog.tsx`, `du_lieu_tinh_luong/tang_ca/QuanLyTangCaDialog.tsx`)
 * — theo đúng quy ước "≥2 feature dùng thì để phẳng ở hạ tầng dùng chung" (RVW-A12,
 * `docs/hrm/review-findings.md`). `TienField.tsx` (song sinh) đã ở đúng vị trí này từ đầu.
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
      // `min:0` ở `htmlInput` chỉ chặn nút mũi tên tăng/giảm, KHÔNG chặn gõ tay "-5" — field
      // này giữ tỷ lệ BHXH/BHYT/BHTN, hệ số tăng ca, thuế suất từng bậc nên phải chặn cứng ở
      // đây (RVW-A17).
      onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
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
