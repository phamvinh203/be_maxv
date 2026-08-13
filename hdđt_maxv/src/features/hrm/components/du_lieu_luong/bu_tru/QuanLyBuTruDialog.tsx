import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
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
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import { getErrorMessage } from "../../../../../lib/errors";
import { CHIEU_BU_TRU, TRANG_THAI_PB, moTaChieuBuTru } from "../../../constants";
import { khoanBuTruRong } from "../../../formDefaults";
import {
  useKhoanBuTruList,
  useLuuKhoanBuTru,
  useXoaKhoanBuTru,
} from "../../../mock/hooks/buTru";
import type {
  ChieuBuTru,
  KhoanBuTru,
  KhoanBuTruFormValues,
  TrangThai,
} from "../../../types";
import XacNhanXoaDialog from "../../XacNhanXoaDialog";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Danh mục khoản ứng - bù trừ — nguồn của ô chọn "Khoản bù trừ" ở bảng.
 *
 * Form thêm/sửa nằm **trong** dialog này chứ không mở dialog con: khoản chỉ có
 * ba ô, mà chồng hai lớp dialog thì bấm ra ngoài rất dễ đóng nhầm cả hai.
 */
export default function QuanLyBuTruDialog({ open, onClose }: Props) {
  const danhMuc = useKhoanBuTruList();
  const luuKhoan = useLuuKhoanBuTru();
  const xoaKhoan = useXoaKhoanBuTru();

  /** `null` = form đang đóng; chuỗi rỗng = đang thêm mới; có mã = đang sửa mã đó. */
  const [dangSua, setDangSua] = useState<string | null>(null);
  const [values, setValues] = useState<KhoanBuTruFormValues>(khoanBuTruRong);
  const [dangLuu, setDangLuu] = useState(false);
  const [dangXoa, setDangXoa] = useState<KhoanBuTru | undefined>(undefined);

  useEffect(() => {
    if (open) return;
    // Đóng dialog thì bỏ luôn form đang mở — mở lại lần sau không nên thấy nửa
    // chừng bản nháp của lần trước.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDangSua(null);
  }, [open]);

  const dat = <K extends keyof KhoanBuTruFormValues>(
    khoa: K,
    giaTri: KhoanBuTruFormValues[K],
  ) => setValues((cu) => ({ ...cu, [khoa]: giaTri }));

  const moThem = () => {
    setValues(khoanBuTruRong());
    setDangSua("");
  };

  const moSua = (bt: KhoanBuTru) => {
    setValues({
      ten_bt: bt.ten_bt,
      chieu: bt.chieu,
      ghi_chu: bt.ghi_chu,
      status: bt.status,
    });
    setDangSua(bt.ma_bt);
  };

  const handleLuu = async () => {
    setDangLuu(true);
    try {
      await luuKhoan(values, dangSua || undefined);
      toast.success(dangSua ? "Đã cập nhật khoản bù trừ." : "Đã thêm khoản bù trừ.");
      setDangSua(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không lưu được khoản bù trừ."));
    } finally {
      setDangLuu(false);
    }
  };

  const xacNhanXoa = async () => {
    if (!dangXoa) return;
    try {
      await xoaKhoan(dangXoa.ma_bt);
      toast.success(`Đã xóa khoản "${dangXoa.ten_bt}".`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không xóa được khoản bù trừ."));
    } finally {
      setDangXoa(undefined);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>Quản lý khoản bù trừ</DialogTitle>
      <Typography variant="body2" color="text.secondary" sx={{ px: 3, pb: 2 }}>
        Danh mục các khoản ứng, khấu trừ và bù thêm. Chiều của khoản quyết định dấu khi cộng vào
        bảng lương — khoản đang được nhân viên sử dụng thì chuyển sang "Ngừng" thay vì xóa.
      </Typography>

      <DialogContent dividers>
        <Stack spacing={2}>
          {dangSua === null ? (
            <Box>
              <Button
                startIcon={<AddRounded />}
                variant="outlined"
                onClick={moThem}
                sx={{ textTransform: "none" }}
              >
                Thêm khoản bù trừ
              </Button>
            </Box>
          ) : (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                {dangSua ? `Sửa khoản ${dangSua}` : "Khoản bù trừ mới"}
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "minmax(0, 2fr) 240px" },
                  gap: 2,
                }}
              >
                <TextField
                  label="Tên khoản"
                  required
                  autoFocus
                  size="small"
                  value={values.ten_bt}
                  onChange={(e) => dat("ten_bt", e.target.value)}
                />
                <TextField
                  select
                  label="Chiều"
                  size="small"
                  value={values.chieu}
                  onChange={(e) => dat("chieu", e.target.value as ChieuBuTru)}
                  helperText="Quyết định khoản này cắt vào hay cộng thêm vào lương."
                >
                  {CHIEU_BU_TRU.map((item) => (
                    <MenuItem key={item.value} value={item.value}>
                      {item.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Ghi chú"
                  size="small"
                  value={values.ghi_chu}
                  onChange={(e) => dat("ghi_chu", e.target.value)}
                />
                <TextField
                  select
                  label="Trạng thái"
                  size="small"
                  value={values.status}
                  onChange={(e) => dat("status", e.target.value as TrangThai)}
                >
                  {TRANG_THAI_PB.map((item) => (
                    <MenuItem key={item.value} value={item.value}>
                      {item.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
              <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: "flex-end" }}>
                <Button onClick={() => setDangSua(null)} sx={{ textTransform: "none" }}>
                  Hủy
                </Button>
                <Button
                  variant="contained"
                  onClick={handleLuu}
                  disabled={dangLuu}
                  sx={{ textTransform: "none" }}
                >
                  {dangSua ? "Lưu thay đổi" : "Thêm khoản"}
                </Button>
              </Stack>
            </Paper>
          )}

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: 700, whiteSpace: "nowrap" } }}>
                  <TableCell>Mã</TableCell>
                  <TableCell>Tên khoản</TableCell>
                  <TableCell>Chiều</TableCell>
                  <TableCell>Ghi chú</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <TableCell align="right">Thao tác</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {danhMuc.map((bt) => {
                  const moTa = moTaChieuBuTru(bt.chieu);
                  return (
                    <TableRow key={bt.ma_bt} hover>
                      <TableCell sx={{ whiteSpace: "nowrap", fontFamily: "monospace" }}>
                        {bt.ma_bt}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{bt.ten_bt}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={moTa.mau}
                          variant="outlined"
                          label={moTa.label}
                          sx={{ height: 22 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {bt.ghi_chu || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={bt.status === "1" ? "success" : "default"}
                          variant={bt.status === "1" ? "filled" : "outlined"}
                          label={bt.status === "1" ? "Đang dùng" : "Ngừng"}
                          sx={{ height: 22 }}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        <Tooltip title="Sửa">
                          <IconButton size="small" onClick={() => moSua(bt)}>
                            <EditRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Xóa">
                          <IconButton size="small" color="error" onClick={() => setDangXoa(bt)}>
                            <DeleteRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {danhMuc.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography
                        variant="body2"
                        color="text.disabled"
                        sx={{ textAlign: "center", py: 4 }}
                      >
                        Chưa có khoản nào. Thêm một khoản trước khi dựng bảng.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained" sx={{ textTransform: "none" }}>
          Đóng
        </Button>
      </DialogActions>

      <XacNhanXoaDialog
        open={Boolean(dangXoa)}
        tieuDe="Xóa khoản bù trừ"
        noiDung={
          <>
            Xóa khoản <strong>{dangXoa?.ten_bt}</strong> khỏi danh mục?
          </>
        }
        onClose={() => setDangXoa(undefined)}
        onXacNhan={xacNhanXoa}
      />
    </Dialog>
  );
}
