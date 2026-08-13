import { useMemo } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import AddRounded from "@mui/icons-material/AddRounded";
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import { LOAI_TANG_CA } from "../../../constants";
import {
  dongTangCaRong,
  gioQuyDoi,
  gioVn,
  heSoTangCa,
  mauGioTangCa,
  tongGioOt,
  tongGioQuyDoi,
} from "../../../tangCa";
import { useCauHinh } from "../../../mock/hooks/cauHinh";
import type { DongTangCa, LoaiTangCa } from "../../../types";

interface Props {
  values: DongTangCa[];
  onChange: (values: DongTangCa[]) => void;
}

/**
 * Bảng giờ tăng ca đang soạn.
 *
 * Cột "Quy đổi" là số giờ đã nhân hệ số của từng loại — 10 giờ ngày thường
 * (150%) ra 15 giờ công. Đây mới là con số bảng lương nhân với đơn giá, còn
 * "Số giờ OT" là giờ người đó thực sự làm và là giờ bị so với trần theo luật.
 *
 * Hệ số **không** nhập ở đây: chúng nằm ở Cấu hình mặc định (nút "Quản lý tăng
 * ca" mở thẳng tới đó). Cho sửa cả hai nơi thì hai màn hình sẽ ra hai con số quy
 * đổi khác nhau cho cùng một giờ làm.
 */
export default function BangTangCaCard({ values, onChange }: Props) {
  const cauHinh = useCauHinh();

  const daDung = useMemo(() => new Set(values.map((d) => d.loai)), [values]);

  const datDong = (id: string, moi: Partial<DongTangCa>) =>
    onChange(values.map((d) => (d.id === id ? { ...d, ...moi } : d)));

  const xoaDong = (id: string) => onChange(values.filter((d) => d.id !== id));

  const tongGio = tongGioOt(values);
  const tongQuyDoi = tongGioQuyDoi(values, cauHinh);
  const mauTongGio = mauGioTangCa(tongGio, cauHinh.gioi_han_tc_thang);

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ mb: 2, alignItems: { sm: "center" }, justifyContent: "space-between" }}
      >
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Bảng tăng ca
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Quy đổi = Số giờ OT × hệ số của loại. Hệ số và trần giờ lấy từ Cấu hình mặc định.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Chip
            size="small"
            variant="outlined"
            color={mauTongGio}
            label={`Tổng OT: ${gioVn(tongGio)}h / trần ${gioVn(cauHinh.gioi_han_tc_thang)}h`}
          />
          <Chip
            size="small"
            color="primary"
            label={`Quy đổi: ${gioVn(tongQuyDoi)}h`}
            sx={{ fontWeight: 700 }}
          />
        </Stack>
      </Stack>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ "& th": { fontWeight: 700, whiteSpace: "nowrap" } }}>
              <TableCell align="center" sx={{ width: 56 }}>
                STT
              </TableCell>
              <TableCell sx={{ minWidth: 280 }}>Loại tăng ca</TableCell>
              <TableCell sx={{ width: 180 }}>Số giờ OT</TableCell>
              <TableCell align="right" sx={{ width: 160 }}>
                Quy đổi
              </TableCell>
              <TableCell align="right" sx={{ width: 60 }} />
            </TableRow>
          </TableHead>

          <TableBody>
            {values.map((dong, i) => {
              const heSo = heSoTangCa(cauHinh, dong.loai);
              return (
                <TableRow key={dong.id} hover>
                  <TableCell align="center">{i + 1}</TableCell>

                  <TableCell>
                    <TextField
                      select
                      required
                      fullWidth
                      size="small"
                      value={dong.loai}
                      onChange={(e) => datDong(dong.id, { loai: e.target.value as LoaiTangCa })}
                      error={!dong.loai}
                      helperText={
                        dong.loai ? `Hệ số ${gioVn(heSo)}%` : "Chưa chọn loại tăng ca"
                      }
                    >
                      {LOAI_TANG_CA.map((item) => (
                        <MenuItem
                          key={item.value}
                          value={item.value}
                          disabled={item.value !== dong.loai && daDung.has(item.value)}
                        >
                          {item.label} — {gioVn(cauHinh[item.truong])}%
                        </MenuItem>
                      ))}
                    </TextField>
                  </TableCell>

                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      fullWidth
                      value={dong.so_gio}
                      onChange={(e) => datDong(dong.id, { so_gio: Number(e.target.value) || 0 })}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      slotProps={{
                        htmlInput: { min: 0, step: 0.5 },
                        input: {
                          endAdornment: <InputAdornment position="end">h</InputAdornment>,
                        },
                      }}
                    />
                  </TableCell>

                  <TableCell align="right" sx={{ whiteSpace: "nowrap", fontWeight: 700 }}>
                    {gioVn(gioQuyDoi(dong, cauHinh))}h
                  </TableCell>

                  <TableCell align="right">
                    <Tooltip title="Xóa dòng">
                      <IconButton size="small" color="error" onClick={() => xoaDong(dong.id)}>
                        <DeleteRounded fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}

            {values.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography
                    variant="body2"
                    color="text.disabled"
                    sx={{ textAlign: "center", py: 4 }}
                  >
                    Bảng tăng ca đang trống. Bấm "Thêm dòng" hoặc nhập từ file Excel.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {values.length > 0 && (
              <TableRow>
                <TableCell colSpan={2} align="right" sx={{ fontWeight: 700 }}>
                  Tổng cộng
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 700 }}>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 700 }}
                    color={`${mauTongGio}.main`}
                  >
                    {gioVn(tongGio)}h
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap", fontWeight: 700 }}>
                  {gioVn(tongQuyDoi)}h
                </TableCell>
                <TableCell />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{ mt: 1.5, alignItems: { sm: "center" }, justifyContent: "space-between" }}
      >
        <Button
          startIcon={<AddRounded />}
          onClick={() => onChange([...values, dongTangCaRong()])}
          sx={{ textTransform: "none" }}
        >
          Thêm dòng
        </Button>

        {tongGio > cauHinh.gioi_han_tc_thang && cauHinh.gioi_han_tc_thang > 0 && (
          <Typography variant="caption" color="error.main">
            Tổng {gioVn(tongGio)}h vượt trần {gioVn(cauHinh.gioi_han_tc_thang)}h/tháng đang khai
            ở Cấu hình mặc định.
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}
