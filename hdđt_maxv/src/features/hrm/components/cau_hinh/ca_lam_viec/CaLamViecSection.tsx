import { useState } from "react";
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
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import ScheduleRounded from "@mui/icons-material/ScheduleRounded";
import { getErrorMessage } from "../../../../../lib/errors";
import { soGioCa } from "../../../format";
import { useCaLamViecList, useXoaCaLamViec } from "../../../mock/hooks/cauHinh";
import type { CaLamViec } from "../../../types";
import XacNhanXoaDialog from "../../XacNhanXoaDialog";
import CaLamViecFormDialog from "./CaLamViecFormDialog";

/**
 * Danh sách ca làm việc.
 *
 * Lưu ngay khi bấm trong dialog, **không** đi qua nút "Lưu cấu hình" của trang:
 * ca là bản ghi riêng lẻ chứ không phải một ô trong bộ tham số, gom chung vào
 * một nút lưu sẽ khiến người dùng tưởng đã mất ca vừa thêm nếu họ bấm Hoàn tác.
 */
export default function CaLamViecSection() {
  const danhSach = useCaLamViecList();
  const xoaCa = useXoaCaLamViec();

  const [formOpen, setFormOpen] = useState(false);
  const [dangSua, setDangSua] = useState<CaLamViec | undefined>(undefined);
  const [dangXoa, setDangXoa] = useState<CaLamViec | undefined>(undefined);

  const xacNhanXoa = async () => {
    if (!dangXoa) return;
    try {
      await xoaCa(dangXoa.ma_ca);
      toast.success(`Đã xóa ca ${dangXoa.ten_ca}.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không xóa được ca làm việc."));
    } finally {
      setDangXoa(undefined);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ mb: 2, alignItems: { sm: "center" }, justifyContent: "space-between" }}
      >
        <Box>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <ScheduleRounded color="primary" />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Ca làm việc
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Thay đổi ở đây lưu ngay, không cần bấm "Lưu cấu hình".
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddRounded />}
          onClick={() => {
            setDangSua(undefined);
            setFormOpen(true);
          }}
          sx={{ textTransform: "none", flexShrink: 0 }}
        >
          Thêm ca làm việc
        </Button>
      </Stack>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ "& th": { fontWeight: 700, whiteSpace: "nowrap" } }}>
              <TableCell>Mã ca</TableCell>
              <TableCell>Tên ca</TableCell>
              <TableCell align="center">Giờ vào</TableCell>
              <TableCell align="center">Giờ ra</TableCell>
              <TableCell align="center">Nghỉ giữa ca</TableCell>
              <TableCell align="center">Số giờ công</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell align="right">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {danhSach.map((ca) => {
              const quaDem = ca.gio_ra <= ca.gio_vao;
              return (
                <TableRow key={ca.ma_ca} hover sx={{ opacity: ca.status === "1" ? 1 : 0.55 }}>
                  <TableCell sx={{ whiteSpace: "nowrap", fontFamily: "monospace" }}>
                    {ca.ma_ca}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 600 }}>
                    {ca.ten_ca}
                    {quaDem && (
                      <Chip
                        size="small"
                        variant="outlined"
                        label="Qua đêm"
                        sx={{ height: 20, ml: 1 }}
                      />
                    )}
                  </TableCell>
                  <TableCell align="center">{ca.gio_vao}</TableCell>
                  <TableCell align="center">{ca.gio_ra}</TableCell>
                  <TableCell align="center">{ca.nghi_giua_ca} phút</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>
                    {soGioCa(ca.gio_vao, ca.gio_ra, ca.nghi_giua_ca)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={ca.status === "1" ? "Đang dùng" : "Ngừng"}
                      color={ca.status === "1" ? "success" : "default"}
                      variant={ca.status === "1" ? "filled" : "outlined"}
                      sx={{ height: 22 }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    <Tooltip title="Sửa">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setDangSua(ca);
                          setFormOpen(true);
                        }}
                      >
                        <EditRounded fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Xóa">
                      <IconButton size="small" color="error" onClick={() => setDangXoa(ca)}>
                        <DeleteRounded fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
            {danhSach.length === 0 && (
              <TableRow>
                <TableCell colSpan={8}>
                  <Typography
                    variant="body2"
                    color="text.disabled"
                    sx={{ textAlign: "center", py: 4 }}
                  >
                    Chưa có ca làm việc nào.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <CaLamViecFormDialog open={formOpen} ca={dangSua} onClose={() => setFormOpen(false)} />
      <XacNhanXoaDialog
        open={Boolean(dangXoa)}
        tieuDe="Xóa ca làm việc"
        noiDung={
          <>
            Xóa ca <strong>{dangXoa?.ten_ca}</strong> ({dangXoa?.ma_ca})?
          </>
        }
        onClose={() => setDangXoa(undefined)}
        onXacNhan={xacNhanXoa}
      />
    </Paper>
  );
}
