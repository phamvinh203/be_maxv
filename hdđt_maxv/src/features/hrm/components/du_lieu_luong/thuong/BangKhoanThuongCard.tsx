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
import { tienVn } from "../../../format";
import { dongThuongRong, thanhTien, tongTienThuong } from "../../../thuong";
import { useKhoanThuongList } from "../../../mock/hooks/thuong";
import type { DongThuong } from "../../../types";
import TienField from "../../TienField";

interface Props {
  values: DongThuong[];
  onChange: (values: DongThuong[]) => void;
  /** Số nhân viên đang chọn ở danh sách bên dưới — nhân ra cột "Thành tiền". */
  soNhanVien: number;
}

/**
 * Bảng các khoản thưởng đang soạn.
 *
 * Hai cột tiền đọc theo hai hướng khác nhau, cố ý:
 * - **Số tiền** là mức của **một** nhân viên — đây là con số được ghi vào bảng
 *   thưởng của từng người khi bấm "Áp dụng thưởng";
 * - **Thành tiền** là phần quỹ khoản đó tiêu tốn cho **cả danh sách đang chọn**
 *   (số tiền × số nhân viên). Người duyệt cần thấy tổng chi trước khi đồng ý,
 *   mà nhẩm tay giữa mấy khoản thì rất dễ sai một chữ số 0.
 *
 * Vì vậy cột "Thành tiền" đổi theo phạm vi và bộ lọc bên dưới — đổi từ một phòng
 * sang toàn công ty là thấy ngay tổng chi nhảy lên.
 */
export default function BangKhoanThuongCard({ values, onChange, soNhanVien }: Props) {
  const danhMuc = useKhoanThuongList();

  const khoanTheoMa = useMemo(
    () => new Map(danhMuc.map((kl) => [kl.ma_khoan, kl])),
    [danhMuc],
  );
  const daDung = useMemo(() => new Set(values.map((d) => d.ma_khoan)), [values]);

  const datDong = (id: string, moi: Partial<DongThuong>) =>
    onChange(values.map((d) => (d.id === id ? { ...d, ...moi } : d)));

  const xoaDong = (id: string) => onChange(values.filter((d) => d.id !== id));

  const tongMotNguoi = tongTienThuong(values);

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ mb: 2, alignItems: { sm: "center" }, justifyContent: "space-between" }}
      >
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Bảng thưởng
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Số tiền là mức của một nhân viên. Thành tiền = Số tiền × {soNhanVien} nhân viên đang
            chọn.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Chip
            size="small"
            variant="outlined"
            color="primary"
            label={`Mỗi người: ${tienVn(tongMotNguoi)} ₫`}
          />
          <Chip
            size="small"
            color="primary"
            label={`Tổng quỹ: ${tienVn(tongMotNguoi * soNhanVien)} ₫`}
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
              <TableCell sx={{ minWidth: 280 }}>Loại thưởng</TableCell>
              <TableCell sx={{ width: 220 }}>Số tiền</TableCell>
              <TableCell align="right" sx={{ width: 200 }}>
                Thành tiền
              </TableCell>
              <TableCell align="right" sx={{ width: 60 }} />
            </TableRow>
          </TableHead>

          <TableBody>
            {values.map((dong, i) => {
              const khoan = khoanTheoMa.get(dong.ma_khoan);
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
                      onChange={(e) => datDong(dong.id, { ma_khoan: e.target.value })}
                      error={!dong.ma_khoan}
                      helperText={
                        !dong.ma_khoan ? "Chưa chọn loại thưởng" : (khoan?.ghi_chu ?? undefined)
                      }
                    >
                      {danhMuc
                        // Khoản đã ngừng vẫn hiện nếu dòng này đang dùng nó — bỏ
                        // đi thì ô chọn trống trơn và người dùng tưởng mất dữ liệu.
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
                    <TienField
                      label=""
                      value={dong.so_tien}
                      onChange={(so) => datDong(dong.id, { so_tien: so })}
                    />
                  </TableCell>

                  <TableCell align="right" sx={{ whiteSpace: "nowrap", fontWeight: 700 }}>
                    {tienVn(thanhTien(dong, soNhanVien))} ₫
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
                    Bảng thưởng đang trống. Bấm "Thêm dòng" hoặc nhập từ file Excel.
                  </Typography>
                </TableCell>
              </TableRow>
            )}

            {values.length > 0 && (
              <TableRow>
                {/* Hai ô tổng đứng đúng cột của chúng: một người ở cột "Số tiền",
                    cả danh sách ở cột "Thành tiền". */}
                <TableCell colSpan={2} align="right" sx={{ fontWeight: 700 }}>
                  Tổng cộng
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 700 }}>
                  {tienVn(tongMotNguoi)} ₫
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap", fontWeight: 700 }}>
                  {tienVn(tongMotNguoi * soNhanVien)} ₫
                </TableCell>
                <TableCell />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Button
        startIcon={<AddRounded />}
        onClick={() => onChange([...values, dongThuongRong()])}
        sx={{ textTransform: "none", mt: 1.5 }}
      >
        Thêm dòng
      </Button>
    </Paper>
  );
}
