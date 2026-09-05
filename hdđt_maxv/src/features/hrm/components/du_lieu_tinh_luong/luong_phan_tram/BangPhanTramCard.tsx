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
import { tienVn } from "../../../format";
import {
  dongPhanTramRong,
  thanhTienPhanTram,
  tongCoSoPhanTram,
  tongTienPhanTram,
} from "../../../luongPhanTram";
import { useKhoanPhanTramList } from "../../../mock/hooks/luongPhanTram";
import type { DongLuongPhanTram } from "../../../types";
import TienField from "../../TienField";

interface Props {
  values: DongLuongPhanTram[];
  onChange: (values: DongLuongPhanTram[]) => void;
}

/**
 * Bảng hoa hồng theo phần trăm đang soạn.
 *
 * Tỷ lệ **sửa được từng dòng** dù danh mục đã có tỷ lệ mặc định: mức hoa hồng
 * hay thỏa thuận riêng theo người và theo kỳ, mà số đã chốt của kỳ trước thì
 * phải giữ nguyên tỷ lệ cũ. Lệch so với danh mục chỉ bị nhắc, không bị chặn.
 */
export default function BangPhanTramCard({ values, onChange }: Props) {
  const danhMuc = useKhoanPhanTramList();

  const khoanTheoMa = useMemo(
    () => new Map(danhMuc.map((kl) => [kl.ma_khoan, kl])),
    [danhMuc],
  );
  const daDung = useMemo(() => new Set(values.map((d) => d.ma_khoan)), [values]);

  const datDong = (id: string, moi: Partial<DongLuongPhanTram>) =>
    onChange(values.map((d) => (d.id === id ? { ...d, ...moi } : d)));

  const xoaDong = (id: string) => onChange(values.filter((d) => d.id !== id));

  /** Chọn loại % thì mượn luôn tỷ lệ mặc định nếu dòng chưa khai tỷ lệ. */
  const doiKhoan = (dong: DongLuongPhanTram, maKhoan: string) =>
    datDong(dong.id, {
      ma_khoan: maKhoan,
      ty_le: dong.ty_le > 0 ? dong.ty_le : (khoanTheoMa.get(maKhoan)?.ty_le ?? 0),
    });

  const tong = tongTienPhanTram(values);

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ mb: 2, alignItems: { sm: "center" }, justifyContent: "space-between" }}
      >
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Bảng lương phần trăm
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Thành tiền = Số tiền cơ sở × Tỉ lệ %. Tỷ lệ chốt theo kỳ, không chạy theo danh mục.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Chip
            size="small"
            variant="outlined"
            label={`Gốc: ${tienVn(tongCoSoPhanTram(values))} ₫`}
          />
          <Chip
            size="small"
            color="primary"
            label={`Tổng: ${tienVn(tong)} ₫`}
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
              <TableCell sx={{ minWidth: 260 }}>Loại %</TableCell>
              <TableCell sx={{ width: 150 }}>Tỉ lệ %</TableCell>
              <TableCell sx={{ width: 220 }}>Số tiền cơ sở</TableCell>
              <TableCell align="right" sx={{ width: 190 }}>
                Thành tiền
              </TableCell>
              <TableCell align="right" sx={{ width: 60 }} />
            </TableRow>
          </TableHead>

          <TableBody>
            {values.map((dong, i) => {
              const khoan = khoanTheoMa.get(dong.ma_khoan);
              const tyLeGoc = khoan?.ty_le ?? 0;
              return (
                <TableRow key={dong.id} hover>
                  <TableCell align="center">{i + 1}</TableCell>

                  <TableCell>
                    <TextField
                      select
                      required
                      fullWidth
                      size="small"
                      value={dong.ma_khoan}
                      onChange={(e) => doiKhoan(dong, e.target.value)}
                      error={!dong.ma_khoan}
                      helperText={
                        !dong.ma_khoan ? "Chưa chọn loại %" : (khoan?.ghi_chu ?? undefined)
                      }
                    >
                      {danhMuc
                        // Khoản đã ngừng vẫn hiện nếu dòng này đang dùng nó — bỏ
                        // đi thì ô chọn trống trơn, người dùng tưởng mất dữ liệu.
                        .filter((kl) => kl.status === "1" || kl.ma_khoan === dong.ma_khoan)
                        .map((kl) => (
                          <MenuItem
                            key={kl.ma_khoan}
                            value={kl.ma_khoan}
                            disabled={kl.ma_khoan !== dong.ma_khoan && daDung.has(kl.ma_khoan)}
                          >
                            {kl.ten_khoan}
                            {kl.status === "0" ? " (đã ngừng)" : ""}
                          </MenuItem>
                        ))}
                    </TextField>
                  </TableCell>

                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      fullWidth
                      value={dong.ty_le}
                      onChange={(e) => datDong(dong.id, { ty_le: Number(e.target.value) || 0 })}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      // Chỉ nhắc khi lệch danh mục, không chặn — lệch tỷ lệ là
                      // có thật, chỉ cần người nhập biết mình đang lệch.
                      helperText={
                        khoan && dong.ty_le !== tyLeGoc ? `Danh mục: ${tyLeGoc}%` : undefined
                      }
                      slotProps={{
                        htmlInput: { min: 0, step: 0.5 },
                        input: {
                          endAdornment: <InputAdornment position="end">%</InputAdornment>,
                        },
                      }}
                    />
                  </TableCell>

                  <TableCell>
                    <TienField
                      label=""
                      value={dong.so_tien_co_so}
                      onChange={(so) => datDong(dong.id, { so_tien_co_so: so })}
                    />
                  </TableCell>

                  <TableCell align="right" sx={{ whiteSpace: "nowrap", fontWeight: 700 }}>
                    {tienVn(thanhTienPhanTram(dong))} ₫
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
                <TableCell colSpan={6}>
                  <Typography
                    variant="body2"
                    color="text.disabled"
                    sx={{ textAlign: "center", py: 4 }}
                  >
                    Bảng lương phần trăm đang trống. Bấm "Thêm dòng" hoặc nhập từ file Excel.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {values.length > 0 && (
              <TableRow>
                <TableCell colSpan={3} align="right" sx={{ fontWeight: 700 }}>
                  Tổng cộng
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 700 }}>
                  {tienVn(tongCoSoPhanTram(values))} ₫
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap", fontWeight: 700 }}>
                  {tienVn(tong)} ₫
                </TableCell>
                <TableCell />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Button
        startIcon={<AddRounded />}
        onClick={() => onChange([...values, dongPhanTramRong()])}
        sx={{ textTransform: "none", mt: 1.5 }}
      >
        Thêm dòng
      </Button>
    </Paper>
  );
}
