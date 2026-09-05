import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import GroupAddRounded from "@mui/icons-material/GroupAddRounded";
import SubdirectoryArrowRightRounded from "@mui/icons-material/SubdirectoryArrowRightRounded";
import { getErrorMessage } from "../../../../lib/errors";
import { usePhongBanRows, useXoaPhongBan } from "../../api/phongBanQueries";
import type { PhongBanRow } from "../../types";
import XacNhanXoaDialog from "../XacNhanXoaDialog";
import GanNhanhDialog from "./GanNhanhDialog";
import PhongBanFormDialog from "./PhongBanFormDialog";

export default function PhongBanTable() {
  const { rows, isLoading, isError, error } = usePhongBanRows();
  const xoaPhongBan = useXoaPhongBan();

  const [tuKhoa, setTuKhoa] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [dangSua, setDangSua] = useState<PhongBanRow | undefined>(undefined);
  const [ganNhanhOpen, setGanNhanhOpen] = useState(false);
  const [dangXoa, setDangXoa] = useState<PhongBanRow | undefined>(undefined);

  const rowsHien = useMemo(() => {
    const q = tuKhoa.trim().toLowerCase();
    if (!q) return rows;
    // Lọc phẳng theo mã/tên: giữ nguyên `cap` nên dòng khớp vẫn thụt lề đúng
    // vị trí của nó trong cây, dù phòng ban cha có thể không hiện.
    return rows.filter((pb) =>
      [pb.ma_pb, pb.ten_pb].some((truong) => truong.toLowerCase().includes(q)),
    );
  }, [rows, tuKhoa]);

  const moThem = () => {
    setDangSua(undefined);
    setFormOpen(true);
  };

  const moSua = (pb: PhongBanRow) => {
    setDangSua(pb);
    setFormOpen(true);
  };

  const xacNhanXoa = async () => {
    if (!dangXoa) return;
    try {
      await xoaPhongBan(dangXoa.ma_pb);
      toast.success(`Đã xóa phòng ban ${dangXoa.ten_pb}.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không xóa được phòng ban."));
    } finally {
      setDangXoa(undefined);
    }
  };

  return (
    <Box>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        sx={{ mb: 2, alignItems: { md: "center" }, justifyContent: "space-between" }}
      >
        <TextField
          size="small"
          placeholder="Tìm mã hoặc tên phòng ban"
          value={tuKhoa}
          onChange={(e) => setTuKhoa(e.target.value)}
          sx={{ width: { xs: "100%", md: 320 } }}
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
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            startIcon={<GroupAddRounded />}
            onClick={() => setGanNhanhOpen(true)}
            sx={{ textTransform: "none" }}
          >
            Gán nhanh phòng ban
          </Button>
          <Button
            variant="contained"
            startIcon={<AddRounded />}
            onClick={moThem}
            sx={{ textTransform: "none" }}
          >
            Thêm phòng ban
          </Button>
        </Stack>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ "& th": { fontWeight: 700, whiteSpace: "nowrap" } }}>
              <TableCell>Mã</TableCell>
              <TableCell>Tên phòng ban</TableCell>
              <TableCell>Trực thuộc</TableCell>
              <TableCell align="center">Cấp</TableCell>
              <TableCell align="center">Nhân viên</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell align="right">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rowsHien.map((pb) => (
              <TableRow key={pb.ma_pb} hover sx={{ opacity: pb.status === "1" ? 1 : 0.55 }}>
                <TableCell sx={{ whiteSpace: "nowrap", fontFamily: "monospace" }}>
                  {pb.ma_pb}
                </TableCell>
                <TableCell>
                  <Stack
                    direction="row"
                    spacing={0.5}
                    sx={{ alignItems: "center", pl: (pb.cap - 1) * 3 }}
                  >
                    {pb.cap > 1 && (
                      <SubdirectoryArrowRightRounded
                        sx={{ fontSize: 16, color: "text.disabled" }}
                      />
                    )}
                    <Typography variant="body2" sx={{ fontWeight: pb.cap === 1 ? 700 : 400 }}>
                      {pb.ten_pb}
                    </Typography>
                  </Stack>
                  {pb.ghi_chu && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block", pl: (pb.cap - 1) * 3 }}
                    >
                      {pb.ghi_chu}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  {pb.ten_pb_me || <Box component="span" sx={{ color: "text.disabled" }}>—</Box>}
                </TableCell>
                <TableCell align="center">{pb.cap}</TableCell>
                <TableCell align="center">
                  {pb.so_nv > 0 ? (
                    pb.so_nv
                  ) : (
                    <Box component="span" sx={{ color: "text.disabled" }}>
                      0
                    </Box>
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={pb.status === "1" ? "Đang dùng" : "Ngừng"}
                    color={pb.status === "1" ? "success" : "default"}
                    variant={pb.status === "1" ? "filled" : "outlined"}
                    sx={{ height: 22 }}
                  />
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  <Tooltip title="Sửa">
                    <IconButton size="small" onClick={() => moSua(pb)}>
                      <EditRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Xóa">
                    <IconButton size="small" color="error" onClick={() => setDangXoa(pb)}>
                      <DeleteRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {rowsHien.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  {/* Ba trạng thái phải phân biệt được: đang tải, tải hỏng, và thật sự
                      chưa có phòng ban nào — cùng hiện "Chưa có" thì lỗi mạng trông
                      hệt như danh mục rỗng, người dùng sẽ đi tạo lại từ đầu. */}
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
                      {getErrorMessage(error, "Không tải được danh sách phòng ban.")}
                    </Typography>
                  ) : (
                    <Typography
                      variant="body2"
                      color="text.disabled"
                      sx={{ textAlign: "center", py: 4 }}
                    >
                      {tuKhoa ? "Không có phòng ban nào khớp." : "Chưa có phòng ban nào."}
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <PhongBanFormDialog
        open={formOpen}
        phongBan={dangSua}
        onClose={() => setFormOpen(false)}
      />
      <GanNhanhDialog open={ganNhanhOpen} onClose={() => setGanNhanhOpen(false)} />
      <XacNhanXoaDialog
        open={Boolean(dangXoa)}
        tieuDe="Xóa phòng ban"
        noiDung={
          <>
            Xóa phòng ban <strong>{dangXoa?.ten_pb}</strong> ({dangXoa?.ma_pb})? Thao tác này
            không hoàn tác được.
          </>
        }
        onClose={() => setDangXoa(undefined)}
        onXacNhan={xacNhanXoa}
      />
    </Box>
  );
}
