import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import InputAdornment from "@mui/material/InputAdornment";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import { getErrorMessage } from "../../../../lib/errors";
import { sapXepCay } from "../../cay";
import { KIEU_LUONG, PB_CHUA_GAN, TRANG_THAI_NV } from "../../constants";
import { ngayVn, nhan } from "../../format";
import { useNhanVienRows, useXoaNhanVien } from "../../api/nhanVienQueries";
import { usePhongBanList } from "../../api/phongBanQueries";
import type { NhanVienFilters, NhanVienRow, TrangThai } from "../../types";
import XacNhanXoaDialog from "../XacNhanXoaDialog";
import NhanVienDialog from "./NhanVienDialog";
import NhanVienChiTietDialog from "./chi_tiet/NhanVienChiTietDialog";

export default function NhanVienTable() {
  // Mặc định chỉ xem người đang làm — danh sách nhân sự hằng ngày là danh sách này.
  const [filters, setFilters] = useState<NhanVienFilters>({ q: "", ma_pb: "", status: "1" });
  const { rows, isLoading, isError, error } = useNhanVienRows(filters);
  const phongBan = usePhongBanList();
  const xoaNhanVien = useXoaNhanVien();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [maNvDangSua, setMaNvDangSua] = useState<string | undefined>(undefined);
  const [maNvDangXem, setMaNvDangXem] = useState<string | null>(null);
  const [dangXoa, setDangXoa] = useState<NhanVienRow | undefined>(undefined);

  const cayPhongBan = useMemo(() => sapXepCay(phongBan), [phongBan]);

  const dat = <K extends keyof NhanVienFilters>(khoa: K, giaTri: NhanVienFilters[K]) =>
    setFilters((cu) => ({ ...cu, [khoa]: giaTri }));

  const moThem = () => {
    setMaNvDangSua(undefined);
    setDialogOpen(true);
  };

  const moSua = (maNv: string) => {
    setMaNvDangSua(maNv);
    setDialogOpen(true);
  };

  /** Từ màn xem chi tiết bấm "Chỉnh sửa hồ sơ" — đóng xem rồi mở sửa. */
  const suaTuChiTiet = (maNv: string) => {
    setMaNvDangXem(null);
    moSua(maNv);
  };

  const xacNhanXoa = async () => {
    if (!dangXoa) return;
    try {
      await xoaNhanVien(dangXoa.ma_nv);
      toast.success(`Đã xóa nhân viên ${dangXoa.ho_ten}.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không xóa được nhân viên."));
    } finally {
      setDangXoa(undefined);
    }
  };

  return (
    <Box>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={1.5}
        sx={{ mb: 2, alignItems: { lg: "center" }, justifyContent: "space-between" }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ flexGrow: 1 }}>
          <TextField
            size="small"
            placeholder="Tìm mã, tên, CCCD hoặc điện thoại"
            value={filters.q}
            onChange={(e) => dat("q", e.target.value)}
            sx={{ width: { xs: "100%", sm: 300 } }}
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
          <TextField
            select
            size="small"
            label="Phòng ban"
            value={filters.ma_pb}
            onChange={(e) => dat("ma_pb", e.target.value)}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="">Tất cả phòng ban</MenuItem>
            <MenuItem value={PB_CHUA_GAN}>Chưa có phòng ban</MenuItem>
            <Divider />
            {cayPhongBan.map((pb) => (
              <MenuItem key={pb.ma_pb} value={pb.ma_pb}>
                {" ".repeat((pb.cap - 1) * 4)}
                {pb.ten_pb}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Trạng thái"
            value={filters.status}
            onChange={(e) => dat("status", e.target.value as TrangThai | "")}
            sx={{ minWidth: 150 }}
          >
            {TRANG_THAI_NV.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
            <MenuItem value="">Tất cả</MenuItem>
          </TextField>
        </Stack>

        <Button
          variant="contained"
          startIcon={<AddRounded />}
          onClick={moThem}
          sx={{ textTransform: "none", flexShrink: 0 }}
        >
          Thêm nhân viên
        </Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ "& th": { fontWeight: 700, whiteSpace: "nowrap" } }}>
              <TableCell>Mã NV</TableCell>
              <TableCell>Họ và tên</TableCell>
              <TableCell>Phòng ban</TableCell>
              <TableCell>Chức vụ</TableCell>
              <TableCell>Hợp đồng</TableCell>
              <TableCell>Kiểu lương</TableCell>
              <TableCell>Điện thoại</TableCell>
              <TableCell>Email</TableCell>
              <TableCell align="center">Công đoàn</TableCell>
              <TableCell>Ngày vào</TableCell>
              <TableCell align="center">NPT</TableCell>
              <TableCell align="right">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((nv) => (
              <TableRow
                key={nv.ma_nv}
                hover
                // Nhân viên đã nghỉ hiện mờ thay vì thêm hẳn một cột Trạng thái.
                sx={{ opacity: nv.status === "1" ? 1 : 0.55 }}
              >
                <TableCell sx={{ whiteSpace: "nowrap", fontFamily: "monospace" }}>
                  {nv.ma_nv}
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 600 }}>
                  {nv.ho_ten}
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  {nv.ten_pb || (
                    <Typography variant="caption" color="warning.main">
                      Chưa gán
                    </Typography>
                  )}
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>{nv.ten_cv || "—"}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  {nv.hop_dong?.so_hd ?? "—"}
                </TableCell>
                <TableCell>
                  {nv.hop_dong ? nhan(KIEU_LUONG, nv.hop_dong.kieu_luong).split(" — ")[0] : "—"}
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>{nv.dien_thoai || "—"}</TableCell>
                <TableCell>{nv.email || "—"}</TableCell>
                <TableCell align="center">
                  {nv.cong_doan ? (
                    <Chip size="small" color="primary" label="Có" sx={{ height: 22 }} />
                  ) : (
                    <Box component="span" sx={{ color: "text.disabled" }}>
                      —
                    </Box>
                  )}
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>{ngayVn(nv.ngay_vao)}</TableCell>
                <TableCell align="center">
                  {nv.so_npt > 0 ? (
                    nv.so_npt
                  ) : (
                    <Box component="span" sx={{ color: "text.disabled" }}>
                      0
                    </Box>
                  )}
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  <Tooltip title="Xem chi tiết">
                    <IconButton size="small" onClick={() => setMaNvDangXem(nv.ma_nv)}>
                      <VisibilityRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Chỉnh sửa hồ sơ">
                    <IconButton size="small" onClick={() => moSua(nv.ma_nv)}>
                      <EditRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Xóa">
                    <IconButton size="small" color="error" onClick={() => setDangXoa(nv)}>
                      <DeleteRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={12}>
                  {/* Phân biệt đang tải / lỗi tải / thật sự không có: gộp chung thì lỗi mạng
                      trông y hệt "chưa có nhân viên nào", người dùng sẽ nhập lại từ đầu. */}
                  {isLoading ? (
                    <Stack sx={{ alignItems: "center", py: 4 }}>
                      <CircularProgress size={24} />
                    </Stack>
                  ) : isError ? (
                    <Typography
                      variant="body2"
                      color="error"
                      sx={{ textAlign: "center", py: 4 }}
                    >
                      {getErrorMessage(error, "Không tải được danh sách nhân viên.")}
                    </Typography>
                  ) : (
                    <Typography
                      variant="body2"
                      color="text.disabled"
                      sx={{ textAlign: "center", py: 4 }}
                    >
                      Không có nhân viên nào khớp bộ lọc.
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <NhanVienChiTietDialog
        open={Boolean(maNvDangXem)}
        maNv={maNvDangXem}
        onClose={() => setMaNvDangXem(null)}
        onSua={suaTuChiTiet}
      />
      <NhanVienDialog
        open={dialogOpen}
        maNv={maNvDangSua}
        onClose={() => setDialogOpen(false)}
      />
      <XacNhanXoaDialog
        open={Boolean(dangXoa)}
        tieuDe="Xóa nhân viên"
        noiDung={
          <>
            Xóa nhân viên <strong>{dangXoa?.ho_ten}</strong> ({dangXoa?.ma_nv})? Toàn bộ hợp
            đồng, tài liệu và người phụ thuộc của nhân viên này cũng bị xóa theo.
          </>
        }
        onClose={() => setDangXoa(undefined)}
        onXacNhan={xacNhanXoa}
      />
    </Box>
  );
}
