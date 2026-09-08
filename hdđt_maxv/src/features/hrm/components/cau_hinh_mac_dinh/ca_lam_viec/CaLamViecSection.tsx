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
import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import AddRounded from "@mui/icons-material/AddRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import ScheduleRounded from "@mui/icons-material/ScheduleRounded";
import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import { getErrorMessage } from "../../../../../lib/errors";
import { soGioCa } from "../../../format";
import {
  CANH_BAO_GIO_LAM_VUOT_TRAN_BLLD,
  useCaLamViecList,
  useTrangThaiCaLamViec,
  useXoaCaLamViec,
} from "../../../api/workShiftsQueries";
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
  const { dangTai, loi, thieuDong } = useTrangThaiCaLamViec();
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
                  <TableCell align="center" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                    {/* Ưu tiên số của máy chủ; `soGioCa` chỉ là lối lùi khi bản ghi chưa có. */}
                    {ca.so_gio_cong ?? soGioCa(ca.gio_vao, ca.gio_ra, ca.nghi_giua_ca)}
                    {ca.canh_bao === CANH_BAO_GIO_LAM_VUOT_TRAN_BLLD && (
                      <Tooltip title="Ca vượt trần 12 giờ/ngày của Điều 105 & 107 BLLĐ 2019. Vẫn lưu được (ca trực y tế, an ninh, cứu hộ) nhưng cần rà lại.">
                        <WarningAmberRounded
                          color="warning"
                          fontSize="small"
                          sx={{ ml: 0.5, verticalAlign: "text-bottom" }}
                        />
                      </Tooltip>
                    )}
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
            {/* Ba trạng thái rỗng khác nhau, đừng gộp: "đang tải" và "hỏng" mà hiện "chưa có
                ca nào" thì người dùng sẽ đi tạo lại những ca họ đã có. */}
            {dangTai && (
              <TableRow>
                <TableCell colSpan={8}>
                  <Skeleton variant="rounded" height={32} sx={{ my: 1 }} />
                  <Skeleton variant="rounded" height={32} sx={{ my: 1 }} />
                </TableCell>
              </TableRow>
            )}
            {!dangTai && loi && (
              <TableRow>
                <TableCell colSpan={8}>
                  <Alert severity="error" sx={{ my: 1 }}>
                    Không tải được danh sách ca làm việc. Hãy tải lại trang.
                  </Alert>
                </TableCell>
              </TableRow>
            )}
            {/* Danh mục vượt trần tải (2.000 dòng): bảng đang thiếu ca. Nói ra, vì lúc đó sửa
                hoặc xóa một ca không nằm trong phần đã tải sẽ báo nhầm "không còn tồn tại". */}
            {!dangTai && !loi && thieuDong && (
              <TableRow>
                <TableCell colSpan={8}>
                  <Alert severity="warning" sx={{ my: 1 }}>
                    Danh mục ca quá lớn nên bảng chỉ hiện phần đầu. Hãy báo quản trị để rà lại
                    danh mục trước khi sửa hoặc xóa ca.
                  </Alert>
                </TableCell>
              </TableRow>
            )}
            {!dangTai && !loi && danhSach.length === 0 && (
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
