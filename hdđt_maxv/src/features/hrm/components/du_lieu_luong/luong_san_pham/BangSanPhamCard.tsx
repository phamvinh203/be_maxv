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
import { dongSanPhamRong, thanhTienSanPham, tongTienSanPham } from "../../../luongSanPham";
import { useSanPhamList } from "../../../mock/hooks/luongSanPham";
import type { DongLuongSanPham } from "../../../types";
import TienField from "../../TienField";

interface Props {
  values: DongLuongSanPham[];
  onChange: (values: DongLuongSanPham[]) => void;
}

/**
 * Bảng sản lượng nghiệm thu đang soạn.
 *
 * Đơn vị lấy từ danh mục và **không sửa** ở đây — đổi đơn vị của một sản phẩm là
 * đổi cách cả công ty đếm nó, việc đó thuộc về "Quản lý sản phẩm". Ngược lại đơn
 * giá **sửa được từng dòng**: bảng giá có kỳ điều chỉnh, mà số đã chốt của kỳ
 * trước thì phải giữ nguyên đơn giá cũ.
 */
export default function BangSanPhamCard({ values, onChange }: Props) {
  const danhMuc = useSanPhamList();

  const spTheoMa = useMemo(() => new Map(danhMuc.map((sp) => [sp.ma_sp, sp])), [danhMuc]);
  const daDung = useMemo(() => new Set(values.map((d) => d.ma_sp)), [values]);

  const datDong = (id: string, moi: Partial<DongLuongSanPham>) =>
    onChange(values.map((d) => (d.id === id ? { ...d, ...moi } : d)));

  const xoaDong = (id: string) => onChange(values.filter((d) => d.id !== id));

  /** Chọn sản phẩm thì mượn luôn đơn giá của danh mục nếu dòng chưa khai giá. */
  const doiSanPham = (dong: DongLuongSanPham, maSp: string) =>
    datDong(dong.id, {
      ma_sp: maSp,
      don_gia: dong.don_gia > 0 ? dong.don_gia : (spTheoMa.get(maSp)?.don_gia ?? 0),
    });

  const tong = tongTienSanPham(values);

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ mb: 2, alignItems: { sm: "center" }, justifyContent: "space-between" }}
      >
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Bảng lương sản phẩm
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Thành tiền = Đơn giá × Số lượng. Đơn giá chốt theo kỳ, không chạy theo bảng giá mới.
          </Typography>
        </Box>

        <Chip
          size="small"
          color="primary"
          label={`Tổng: ${tienVn(tong)} ₫`}
          sx={{ fontWeight: 700 }}
        />
      </Stack>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ "& th": { fontWeight: 700, whiteSpace: "nowrap" } }}>
              <TableCell align="center" sx={{ width: 56 }}>
                STT
              </TableCell>
              <TableCell sx={{ minWidth: 260 }}>Sản phẩm</TableCell>
              <TableCell sx={{ width: 100 }}>Đơn vị</TableCell>
              <TableCell sx={{ width: 190 }}>Đơn giá</TableCell>
              <TableCell sx={{ width: 160 }}>Số lượng</TableCell>
              <TableCell align="right" sx={{ width: 190 }}>
                Thành tiền
              </TableCell>
              <TableCell align="right" sx={{ width: 60 }} />
            </TableRow>
          </TableHead>

          <TableBody>
            {values.map((dong, i) => {
              const sp = spTheoMa.get(dong.ma_sp);
              const giaGoc = sp?.don_gia ?? 0;
              return (
                <TableRow key={dong.id} hover>
                  <TableCell align="center">{i + 1}</TableCell>

                  <TableCell>
                    <TextField
                      select
                      required
                      fullWidth
                      size="small"
                      value={dong.ma_sp}
                      onChange={(e) => doiSanPham(dong, e.target.value)}
                      error={!dong.ma_sp}
                      helperText={!dong.ma_sp ? "Chưa chọn sản phẩm" : undefined}
                    >
                      {danhMuc
                        // Sản phẩm đã ngừng vẫn hiện nếu dòng này đang dùng nó —
                        // bỏ đi thì ô chọn trống trơn, người dùng tưởng mất dữ liệu.
                        .filter((item) => item.status === "1" || item.ma_sp === dong.ma_sp)
                        .map((item) => (
                          <MenuItem
                            key={item.ma_sp}
                            value={item.ma_sp}
                            disabled={item.ma_sp !== dong.ma_sp && daDung.has(item.ma_sp)}
                          >
                            {item.ten_sp}
                            {item.status === "0" ? " (đã ngừng)" : ""}
                          </MenuItem>
                        ))}
                    </TextField>
                  </TableCell>

                  <TableCell sx={{ whiteSpace: "nowrap" }}>{sp?.don_vi || "—"}</TableCell>

                  <TableCell>
                    <TienField
                      label=""
                      value={dong.don_gia}
                      onChange={(so) => datDong(dong.id, { don_gia: so })}
                      // Chỉ nhắc khi lệch bảng giá, không chặn — lệch giá là có
                      // thật (đơn giá của kỳ cũ), chỉ cần người nhập biết mình
                      // đang lệch chứ không phải gõ nhầm.
                      helperText={
                        sp && dong.don_gia !== giaGoc
                          ? `Bảng giá: ${tienVn(giaGoc)} ₫`
                          : undefined
                      }
                    />
                  </TableCell>

                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      fullWidth
                      value={dong.so_luong}
                      onChange={(e) =>
                        datDong(dong.id, { so_luong: Number(e.target.value) || 0 })
                      }
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      slotProps={{
                        htmlInput: { min: 0, step: 1 },
                        input: sp?.don_vi
                          ? {
                              endAdornment: (
                                <InputAdornment position="end">{sp.don_vi}</InputAdornment>
                              ),
                            }
                          : undefined,
                      }}
                    />
                  </TableCell>

                  <TableCell align="right" sx={{ whiteSpace: "nowrap", fontWeight: 700 }}>
                    {tienVn(thanhTienSanPham(dong))} ₫
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
                <TableCell colSpan={7}>
                  <Typography
                    variant="body2"
                    color="text.disabled"
                    sx={{ textAlign: "center", py: 4 }}
                  >
                    Bảng lương sản phẩm đang trống. Bấm "Thêm dòng" hoặc nhập từ file Excel.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {values.length > 0 && (
              <TableRow>
                <TableCell colSpan={4} align="right" sx={{ fontWeight: 700 }}>
                  Tổng cộng
                </TableCell>
                <TableCell />
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
        onClick={() => onChange([...values, dongSanPhamRong()])}
        sx={{ textTransform: "none", mt: 1.5 }}
      >
        Thêm dòng
      </Button>
    </Paper>
  );
}
