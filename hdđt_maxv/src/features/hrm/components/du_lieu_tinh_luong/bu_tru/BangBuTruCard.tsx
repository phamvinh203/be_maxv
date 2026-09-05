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
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import AddRounded from "@mui/icons-material/AddRounded";
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import { moTaChieuBuTru } from "../../../constants";
import { dongBuTruRong, tongBiTru, tongTheoChieu } from "../../../buTru";
import { tienVn } from "../../../format";
import { useKhoanBuTruList } from "../../../mock/hooks/buTru";
import type { DongBuTru } from "../../../types";
import TienField from "../../TienField";

interface Props {
  values: DongBuTru[];
  onChange: (values: DongBuTru[]) => void;
}

/**
 * Bảng các khoản ứng - bù trừ đang soạn.
 *
 * Số tiền luôn nhập **dương**; trừ hay bù là do `chieu` của khoản trong danh mục
 * quyết định, hiện ngay dưới ô chọn. Cho gõ số âm ở đây thì chỉ cần một dấu trừ
 * lọt vào là khoản khấu trừ biến thành khoản cộng thêm mà nhìn bảng không thấy.
 */
export default function BangBuTruCard({ values, onChange }: Props) {
  const danhMuc = useKhoanBuTruList();

  const khoanTheoMa = useMemo(
    () => new Map(danhMuc.map((bt) => [bt.ma_bt, bt])),
    [danhMuc],
  );
  const daDung = useMemo(() => new Set(values.map((d) => d.ma_bt)), [values]);

  const datDong = (id: string, moi: Partial<DongBuTru>) =>
    onChange(values.map((d) => (d.id === id ? { ...d, ...moi } : d)));

  const xoaDong = (id: string) => onChange(values.filter((d) => d.id !== id));

  const tongTru = tongTheoChieu(values, khoanTheoMa, "tru");
  const tongBu = tongTheoChieu(values, khoanTheoMa, "bu");
  const rong = tongBiTru(values, khoanTheoMa);

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ mb: 2, alignItems: { sm: "center" }, justifyContent: "space-between" }}
      >
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Bảng ứng - bù trừ
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Nhập số dương; khoản là trừ hay bù đã khai sẵn ở danh mục.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <Chip
            size="small"
            variant="outlined"
            color="error"
            label={`Trừ: ${tienVn(tongTru)} ₫`}
          />
          <Chip
            size="small"
            variant="outlined"
            color="success"
            label={`Bù: ${tienVn(tongBu)} ₫`}
          />
          <Chip
            size="small"
            color={rong > 0 ? "error" : rong < 0 ? "success" : "default"}
            label={
              rong >= 0
                ? `Tổng bị trừ: ${tienVn(rong)} ₫`
                : `Được nhận thêm: ${tienVn(-rong)} ₫`
            }
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
              <TableCell sx={{ minWidth: 320 }}>Khoản bù trừ</TableCell>
              <TableCell sx={{ width: 240 }}>Số tiền</TableCell>
              <TableCell align="right" sx={{ width: 60 }} />
            </TableRow>
          </TableHead>

          <TableBody>
            {values.map((dong, i) => {
              const khoan = khoanTheoMa.get(dong.ma_bt);
              const moTa = khoan ? moTaChieuBuTru(khoan.chieu) : null;
              return (
                <TableRow key={dong.id} hover>
                  <TableCell align="center">{i + 1}</TableCell>

                  <TableCell>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
                      <TextField
                        select
                        required
                        fullWidth
                        size="small"
                        value={dong.ma_bt}
                        onChange={(e) => datDong(dong.id, { ma_bt: e.target.value })}
                        error={!dong.ma_bt}
                        helperText={
                          !dong.ma_bt ? "Chưa chọn khoản bù trừ" : (khoan?.ghi_chu ?? undefined)
                        }
                      >
                        {danhMuc
                          // Khoản đã ngừng vẫn hiện nếu dòng này đang dùng nó —
                          // bỏ đi thì ô chọn trống trơn, tưởng mất dữ liệu.
                          .filter((bt) => bt.status === "1" || bt.ma_bt === dong.ma_bt)
                          .map((bt) => (
                            <MenuItem
                              key={bt.ma_bt}
                              value={bt.ma_bt}
                              disabled={bt.ma_bt !== dong.ma_bt && daDung.has(bt.ma_bt)}
                            >
                              {bt.ten_bt}
                              {bt.status === "0" ? " (đã ngừng)" : ""}
                            </MenuItem>
                          ))}
                      </TextField>
                      {moTa && (
                        <Chip
                          size="small"
                          color={moTa.mau}
                          variant="outlined"
                          label={moTa.label}
                          sx={{ mt: 0.5, whiteSpace: "nowrap" }}
                        />
                      )}
                    </Stack>
                  </TableCell>

                  <TableCell>
                    <TienField
                      label=""
                      value={dong.so_tien}
                      onChange={(so) => datDong(dong.id, { so_tien: so })}
                    />
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
                <TableCell colSpan={4}>
                  <Typography
                    variant="body2"
                    color="text.disabled"
                    sx={{ textAlign: "center", py: 4 }}
                  >
                    Bảng đang trống. Bấm "Thêm dòng" hoặc nhập từ file Excel.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {values.length > 0 && (
              <TableRow>
                <TableCell colSpan={2} align="right" sx={{ fontWeight: 700 }}>
                  Tổng bị trừ
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 700 }}>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 700 }}
                    color={rong > 0 ? "error.main" : rong < 0 ? "success.main" : "text.primary"}
                  >
                    {rong >= 0 ? `${tienVn(rong)} ₫` : `+ ${tienVn(-rong)} ₫`}
                  </Typography>
                </TableCell>
                <TableCell />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Button
        startIcon={<AddRounded />}
        onClick={() => onChange([...values, dongBuTruRong()])}
        sx={{ textTransform: "none", mt: 1.5 }}
      >
        Thêm dòng
      </Button>
    </Paper>
  );
}
