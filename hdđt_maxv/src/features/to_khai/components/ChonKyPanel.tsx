import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { kyHopLe, soKyToiDa, type Ky, type KyLoai } from "../ky";

/**
 * Chọn kỳ kê khai cho màn Tờ khai. Khác bộ lọc bên Hóa đơn điện tử (lọc khoảng ngày tự do): ở đây
 * kỳ quyết định TẬP hóa đơn, và tập đó do lượt "Kê khai" gán chứ không phải cứ rơi vào khoảng ngày
 * là có.
 *
 * Panel cũng mang nút "Lập tờ khai" để tính thẳng kỳ đang chọn ngay tại đây; phần tính và chuyển
 * tab là việc của cha — panel chỉ hiển thị.
 */
export default function ChonKyPanel({
  ky,
  onChange,
  onLapToKhai,
  dangLap,
  daChot,
}: {
  ky: Ky;
  onChange: (ky: Ky) => void;
  /** Bấm "Lập tờ khai" — cha kê khai rồi tính tờ khai của kỳ đang chọn, xong mở tab mẫu in. */
  onLapToKhai: () => void;
  /** Đang có lượt tính bay tới server — khóa nút kèm vòng quay, và khóa luôn ô chọn kỳ. */
  dangLap: boolean;
  /** Bản tờ khai của kỳ đang chọn đã chốt — không cho kê khai/tính lại, phải "Mở khóa" trước. */
  daChot: boolean;
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
          // Khóa lúc đang chạy: đổi kỳ giữa chừng thì lượt kê khai/tính vẫn của kỳ cũ, nhưng màn
          // hình lại nhảy sang tab tờ khai của kỳ mới — người dùng đọc số của kỳ không hề bấm.
          disabled={dangLap}
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
          disabled={dangLap}
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
          disabled={dangLap}
          onChange={(e) => onChange({ ...ky, nam: Number(e.target.value) })}
          sx={{ minWidth: 110 }}
        >
          {danhSachNam.map((n) => (
            <MenuItem key={n} value={n}>
              {n}
            </MenuItem>
          ))}
        </TextField>

        {/*
          Tooltip bọc ngoài Box vì nút disabled không phát sự kiện chuột — không có lớp bọc thì lý
          do "vì sao bấm không được" không bao giờ hiện ra.
        */}
        <Tooltip
          title={
            daChot
              ? 'Tờ khai kỳ này đã chốt. Mở khóa ở tab "Tờ khai 01/GTGT" rồi lập lại.'
              : ""
          }
        >
          <Box sx={{ ml: { sm: "auto" }, display: "flex" }}>
            <Button
              variant="contained"
              size="small"
              onClick={onLapToKhai}
              // Kỳ đã chốt là số ĐÃ NỘP: kê khai lại có quyền gỡ dòng khỏi bảng kê trong khi bản
              // tờ khai giữ nguyên số — chặn ở đây, server chặn lần nữa (`da_chot`).
              // `kyHopLe` là chốt chặn phòng xa cho kỳ truyền vào từ nơi khác.
              disabled={daChot || !kyHopLe(ky) || dangLap}
              startIcon={dangLap ? <CircularProgress size={16} color="inherit" /> : undefined}
              sx={{ textTransform: "none", flex: 1 }}
            >
              Lập tờ khai
            </Button>
          </Box>
        </Tooltip>
      </Stack>
    </Paper>
  );
}
