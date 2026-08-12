import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import { QUAN_HE } from "../../constants";
import type { NguoiPhuThuocFormValues, QuanHe } from "../../types";

interface Props {
  values: NguoiPhuThuocFormValues;
  onChange: (values: NguoiPhuThuocFormValues) => void;
}

/**
 * Các ô nhập của một người phụ thuộc.
 *
 * Tách riêng khỏi dialog để tab "Người phụ thuộc" trong hồ sơ nhân viên và màn
 * hình độc lập dùng đúng một bộ ô — thêm trường mới chỉ phải sửa một chỗ.
 */
export default function NguoiPhuThuocForm({ values, onChange }: Props) {
  const dat = <K extends keyof NguoiPhuThuocFormValues>(
    khoa: K,
    giaTri: NguoiPhuThuocFormValues[K],
  ) => onChange({ ...values, [khoa]: giaTri });

  const oLuoi = {
    display: "grid",
    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
    gap: 2,
  } as const;

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
          Thông tin người phụ thuộc
        </Typography>
        <Box sx={oLuoi}>
          <TextField
            label="Họ và tên người phụ thuộc"
            required
            size="small"
            value={values.ho_ten}
            onChange={(e) => dat("ho_ten", e.target.value)}
          />
          <TextField
            select
            label="Quan hệ"
            size="small"
            value={values.quan_he}
            onChange={(e) => dat("quan_he", e.target.value as QuanHe)}
          >
            {QUAN_HE.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Ngày sinh"
            type="date"
            size="small"
            value={values.ngay_sinh}
            onChange={(e) => dat("ngay_sinh", e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Số CCCD"
            size="small"
            value={values.so_cccd}
            onChange={(e) => dat("so_cccd", e.target.value)}
          />
          <TextField
            label="MST cá nhân"
            size="small"
            value={values.mst_ca_nhan}
            onChange={(e) => dat("mst_ca_nhan", e.target.value)}
          />
          <TextField
            label="Điện thoại"
            size="small"
            value={values.dien_thoai}
            onChange={(e) => dat("dien_thoai", e.target.value)}
          />
          <Box sx={{ gridColumn: { sm: "1 / -1" } }}>
            <TextField
              label="Địa chỉ"
              fullWidth
              size="small"
              value={values.dia_chi}
              onChange={(e) => dat("dia_chi", e.target.value)}
            />
          </Box>
        </Box>
      </Box>

      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
          Đăng ký giảm trừ gia cảnh
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
          Để trống "Đến tháng" nếu đăng ký còn hiệu lực.
        </Typography>
        <Box sx={oLuoi}>
          <TextField
            label="Từ tháng"
            type="month"
            size="small"
            value={values.gt_tu_thang}
            onChange={(e) => dat("gt_tu_thang", e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Đến tháng"
            type="month"
            size="small"
            value={values.gt_den_thang}
            onChange={(e) => dat("gt_den_thang", e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Box>
      </Box>
    </Stack>
  );
}
