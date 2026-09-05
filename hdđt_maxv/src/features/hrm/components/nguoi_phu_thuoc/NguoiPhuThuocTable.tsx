import { useState } from "react";
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
import InputAdornment from "@mui/material/InputAdornment";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import { getErrorMessage } from "../../../../lib/errors";
import { QUAN_HE } from "../../constants";
import { kyGiamTru, ngayVn, nhan } from "../../format";
import {
  useNguoiPhuThuocRows,
  useXoaNguoiPhuThuoc,
} from "../../api/nguoiPhuThuocQueries";
import type { NguoiPhuThuocRow } from "../../types";
import XacNhanXoaDialog from "../XacNhanXoaDialog";
import NguoiPhuThuocFormDialog from "./NguoiPhuThuocFormDialog";

export default function NguoiPhuThuocTable() {
  const [tuKhoa, setTuKhoa] = useState("");
  const { rows, isLoading, isError, error } = useNguoiPhuThuocRows(tuKhoa);
  const xoaNpt = useXoaNguoiPhuThuoc();

  const [formOpen, setFormOpen] = useState(false);
  const [dangSua, setDangSua] = useState<NguoiPhuThuocRow | undefined>(undefined);
  const [dangXoa, setDangXoa] = useState<NguoiPhuThuocRow | undefined>(undefined);

  const moThem = () => {
    setDangSua(undefined);
    setFormOpen(true);
  };

  const moSua = (row: NguoiPhuThuocRow) => {
    setDangSua(row);
    setFormOpen(true);
  };

  const xacNhanXoa = async () => {
    if (!dangXoa) return;
    try {
      await xoaNpt(dangXoa.id);
      toast.success(`Đã xóa người phụ thuộc ${dangXoa.ho_ten}.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không xóa được người phụ thuộc."));
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
          placeholder="Tìm theo nhân viên, tên NPT, CCCD hoặc MST"
          value={tuKhoa}
          onChange={(e) => setTuKhoa(e.target.value)}
          sx={{ width: { xs: "100%", md: 380 } }}
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
        <Button
          variant="contained"
          startIcon={<AddRounded />}
          onClick={moThem}
          sx={{ textTransform: "none" }}
        >
          Thêm người phụ thuộc
        </Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ "& th": { fontWeight: 700, whiteSpace: "nowrap" } }}>
              <TableCell>Mã NV</TableCell>
              <TableCell>Tên nhân viên</TableCell>
              <TableCell>Họ tên NPT</TableCell>
              <TableCell>Quan hệ</TableCell>
              <TableCell>Ngày sinh</TableCell>
              <TableCell>CCCD</TableCell>
              <TableCell>MST</TableCell>
              <TableCell>ĐK giảm trừ</TableCell>
              <TableCell align="right">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell sx={{ whiteSpace: "nowrap", fontFamily: "monospace" }}>
                  {row.ma_nv}
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>{row.ten_nv}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 600 }}>
                  {row.ho_ten}
                </TableCell>
                <TableCell>{nhan(QUAN_HE, row.quan_he)}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>{ngayVn(row.ngay_sinh)}</TableCell>
                <TableCell>{row.so_cccd || "—"}</TableCell>
                <TableCell>{row.mst_ca_nhan || "—"}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  {kyGiamTru(row.gt_tu_thang, row.gt_den_thang)}
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  <Tooltip title="Sửa">
                    <IconButton size="small" onClick={() => moSua(row)}>
                      <EditRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Xóa">
                    <IconButton size="small" color="error" onClick={() => setDangXoa(row)}>
                      <DeleteRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9}>
                  {/* Tách "đang tải" và "lỗi tải" khỏi "chưa có": gộp chung thì lỗi mạng
                      trông y hệt danh sách rỗng, người dùng sẽ nhập lại từ đầu. */}
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
                      {getErrorMessage(error, "Không tải được danh sách người phụ thuộc.")}
                    </Typography>
                  ) : (
                    <Typography
                      variant="body2"
                      color="text.disabled"
                      sx={{ textAlign: "center", py: 4 }}
                    >
                      {tuKhoa
                        ? "Không có người phụ thuộc nào khớp."
                        : "Chưa có người phụ thuộc nào."}
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <NguoiPhuThuocFormDialog
        open={formOpen}
        npt={dangSua}
        onClose={() => setFormOpen(false)}
      />
      <XacNhanXoaDialog
        open={Boolean(dangXoa)}
        tieuDe="Xóa người phụ thuộc"
        noiDung={
          <>
            Xóa người phụ thuộc <strong>{dangXoa?.ho_ten}</strong> của nhân viên{" "}
            {dangXoa?.ten_nv}?
          </>
        }
        onClose={() => setDangXoa(undefined)}
        onXacNhan={xacNhanXoa}
      />
    </Box>
  );
}
