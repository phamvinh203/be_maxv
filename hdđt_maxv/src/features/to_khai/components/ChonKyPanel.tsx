import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import { soKyToiDa, type Ky, type KyLoai } from "../ky";

/**
 * Chọn kỳ kê khai cho màn Tờ khai. Khác bộ lọc bên Hóa đơn điện tử (lọc khoảng ngày tự do): ở đây
 * kỳ quyết định TẬP hóa đơn, và tập đó do lượt "Kê khai" gán chứ không phải cứ rơi vào khoảng ngày
 * là có.
 */
export default function ChonKyPanel({
  ky,
  onChange,
  disabled,
  soDong,
}: {
  ky: Ky;
  onChange: (ky: Ky) => void;
  disabled?: boolean;
  /** Số dòng đang hiện — để người dùng biết ngay kỳ này đã kê khai hay còn trống. */
  soDong?: number;
}) {
  const namHienTai = new Date().getFullYear();
  const danhSachNam = Array.from({ length: 6 }, (_, i) => namHienTai - i);
  const danhSachKySo = Array.from({ length: soKyToiDa(ky.kyLoai) }, (_, i) => i + 1);

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ alignItems: { sm: "center" } }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Kỳ kê khai
        </Typography>

        <TextField
          select
          size="small"
          label="Loại kỳ"
          value={ky.kyLoai}
          disabled={disabled}
          onChange={(e) => {
            const kyLoai = e.target.value as KyLoai;
            // Kẹp số kỳ khi đổi loại — đang ở tháng 7 mà chuyển sang quý thì "quý 7" vô nghĩa.
            onChange({ ...ky, kyLoai, kySo: Math.min(ky.kySo, soKyToiDa(kyLoai)) });
          }}
          sx={{ minWidth: 120 }}
        >
          <MenuItem value="thang">Tháng</MenuItem>
          <MenuItem value="quy">Quý</MenuItem>
        </TextField>

        <TextField
          select
          size="small"
          label={ky.kyLoai === "thang" ? "Tháng" : "Quý"}
          value={ky.kySo}
          disabled={disabled}
          onChange={(e) => onChange({ ...ky, kySo: Number(e.target.value) })}
          sx={{ minWidth: 100 }}
        >
          {danhSachKySo.map((n) => (
            <MenuItem key={n} value={n}>
              {n}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          size="small"
          label="Năm"
          value={ky.nam}
          disabled={disabled}
          onChange={(e) => onChange({ ...ky, nam: Number(e.target.value) })}
          sx={{ minWidth: 110 }}
        >
          {danhSachNam.map((n) => (
            <MenuItem key={n} value={n}>
              {n}
            </MenuItem>
          ))}
        </TextField>

        {soDong !== undefined && (
          <Typography variant="body2" color="text.secondary">
            {soDong} hóa đơn
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}
