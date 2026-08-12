import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import EditRounded from "@mui/icons-material/EditRounded";
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import RemoveRounded from "@mui/icons-material/RemoveRounded";
import { moTaLoaiKhoan } from "../../constants";
import { useKhoanLuongRows, type KhoanLuongFilters } from "../../mock/hooks/khoanLuong";
import type { KhoanLuong } from "../../types";

interface Props {
  filters: KhoanLuongFilters;
  onTuKhoaChange: (q: string) => void;
  onSua: (khoan: KhoanLuong) => void;
  onXoa: (khoan: KhoanLuong) => void;
}

export default function KhoanLuongTable({
  filters,
  onTuKhoaChange,
  onSua,
  onXoa,
}: Props) {
  const rows = useKhoanLuongRows(filters);

  return (
    <Box>
      <TextField
        size="small"
        placeholder="Tìm mã, tên khoản hoặc ghi chú"
        value={filters.q}
        onChange={(e) => onTuKhoaChange(e.target.value)}
        sx={{ mb: 2, width: { xs: "100%", sm: 340 } }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchRounded fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ "& th": { fontWeight: 700, whiteSpace: "nowrap" } }}>
              <TableCell>Mã</TableCell>
              <TableCell>Tên khoản</TableCell>
              <TableCell>Loại</TableCell>
              <TableCell>Ghi chú</TableCell>
              <TableCell align="center">Tỷ lệ</TableCell>
              <TableCell align="center">Vào BHXH</TableCell>
              <TableCell align="center">Chịu TNCN</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell align="right">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((kl) => (
              <TableRow key={kl.ma_khoan} hover sx={{ opacity: kl.status === "1" ? 1 : 0.55 }}>
                <TableCell sx={{ whiteSpace: "nowrap", fontFamily: "monospace" }}>
                  {kl.ma_khoan}
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{kl.ten_khoan}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={moTaLoaiKhoan(kl.loai).label}
                    sx={{ height: 22 }}
                  />
                </TableCell>
                <TableCell>
                  {kl.ghi_chu || <Box component="span" sx={{ color: "text.disabled" }}>—</Box>}
                </TableCell>
                <TableCell align="center">
                  {kl.loai === "luong_phan_tram" ? (
                    `${kl.ty_le}%`
                  ) : (
                    <Box component="span" sx={{ color: "text.disabled" }}>
                      —
                    </Box>
                  )}
                </TableCell>
                <TableCell align="center">
                  <CoKhong co={kl.tinh_bhxh} />
                </TableCell>
                <TableCell align="center">
                  <CoKhong co={kl.chiu_thue_tncn} />
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={kl.status === "1" ? "Đang dùng" : "Ngừng"}
                    color={kl.status === "1" ? "success" : "default"}
                    variant={kl.status === "1" ? "filled" : "outlined"}
                    sx={{ height: 22 }}
                  />
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  <Tooltip title="Sửa">
                    <IconButton size="small" onClick={() => onSua(kl)}>
                      <EditRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Xóa">
                    <IconButton size="small" color="error" onClick={() => onXoa(kl)}>
                      <DeleteRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9}>
                  <Typography
                    variant="body2"
                    color="text.disabled"
                    sx={{ textAlign: "center", py: 4 }}
                  >
                    {filters.q || filters.loai
                      ? "Không có khoản nào khớp bộ lọc."
                      : "Chưa có khoản lương nào. Tạo khoản đầu tiên ở cột bên trái."}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

function CoKhong({ co }: { co: boolean }) {
  return co ? (
    <CheckRounded fontSize="small" color="success" />
  ) : (
    <RemoveRounded fontSize="small" sx={{ color: "text.disabled" }} />
  );
}
