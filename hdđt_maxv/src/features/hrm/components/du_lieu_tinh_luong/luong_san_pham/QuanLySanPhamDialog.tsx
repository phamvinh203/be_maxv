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
import { TRANG_THAI_PB } from "../../../constants";
import { tienVn } from "../../../format";
import { sanPhamRong } from "../../../formDefaults";
import { useSanPhamList, useLuuSanPham, useXoaSanPham } from "../../../mock/hooks/luongSanPham";
import type { SanPham, SanPhamFormValues, TrangThai } from "../../../types";
import TienField from "../../TienField";
import XacNhanXoaDialog from "../../XacNhanXoaDialog";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Danh mục sản phẩm nghiệm thu — nguồn của ô chọn "Sản phẩm" ở bảng.
 *
 * Form thêm/sửa nằm **trong** dialog này chứ không mở dialog con: sản phẩm chỉ
 * có bốn ô, mà chồng hai lớp dialog thì bấm ra ngoài rất dễ đóng nhầm cả hai.
 */
export default function QuanLySanPhamDialog({ open, onClose }: Props) {
  const danhMuc = useSanPhamList();
  const luuSanPham = useLuuSanPham();
  const xoaSanPham = useXoaSanPham();

  /** `null` = form đang đóng; chuỗi rỗng = đang thêm mới; có mã = đang sửa mã đó. */
  const [dangSua, setDangSua] = useState<string | null>(null);
  const [values, setValues] = useState<SanPhamFormValues>(sanPhamRong);
  const [dangLuu, setDangLuu] = useState(false);
  const [dangXoa, setDangXoa] = useState<SanPham | undefined>(undefined);

  useEffect(() => {
    if (open) return;
    // Đóng dialog thì bỏ luôn form đang mở — mở lại lần sau không nên thấy nửa
    // chừng bản nháp của lần trước.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDangSua(null);
  }, [open]);

  const dat = <K extends keyof SanPhamFormValues>(khoa: K, giaTri: SanPhamFormValues[K]) =>
    setValues((cu) => ({ ...cu, [khoa]: giaTri }));

  const moThem = () => {
    setValues(sanPhamRong());
    setDangSua("");
  };

  const moSua = (sp: SanPham) => {
    setValues({
      ten_sp: sp.ten_sp,
      don_vi: sp.don_vi,
      don_gia: sp.don_gia,
      ghi_chu: sp.ghi_chu,
      status: sp.status,
    });
    setDangSua(sp.ma_sp);
  };

  const handleLuu = async () => {
    setDangLuu(true);
    try {
      await luuSanPham(values, dangSua || undefined);
      toast.success(dangSua ? "Đã cập nhật sản phẩm." : "Đã thêm sản phẩm.");
      setDangSua(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không lưu được sản phẩm."));
    } finally {
      setDangLuu(false);
    }
  };

  const xacNhanXoa = async () => {
    if (!dangXoa) return;
    try {
      await xoaSanPham(dangXoa.ma_sp);
      toast.success(`Đã xóa sản phẩm "${dangXoa.ten_sp}".`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không xóa được sản phẩm."));
    } finally {
      setDangXoa(undefined);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>Quản lý sản phẩm</DialogTitle>
      <Typography variant="body2" color="text.secondary" sx={{ px: 3, pb: 2 }}>
        Danh mục sản phẩm nghiệm thu dùng chung cho mọi bảng lương sản phẩm. Đơn giá ở đây là
        bảng giá hiện hành; từng kỳ vẫn sửa lại được ngay trên bảng.
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
                Thêm sản phẩm
              </Button>
            </Box>
          ) : (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                {dangSua ? `Sửa sản phẩm ${dangSua}` : "Sản phẩm mới"}
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "minmax(0, 2fr) 120px 180px" },
                  gap: 2,
                }}
              >
                <TextField
                  label="Tên sản phẩm"
                  required
                  autoFocus
                  size="small"
                  value={values.ten_sp}
                  onChange={(e) => dat("ten_sp", e.target.value)}
                />
                <TextField
                  label="Đơn vị"
                  size="small"
                  placeholder="cái, kiện, đơn…"
                  value={values.don_vi}
                  onChange={(e) => dat("don_vi", e.target.value)}
                />
                <TienField
                  label="Đơn giá"
                  value={values.don_gia}
                  onChange={(so) => dat("don_gia", so)}
                />
                <TextField
                  label="Ghi chú"
                  size="small"
                  value={values.ghi_chu}
                  onChange={(e) => dat("ghi_chu", e.target.value)}
                  sx={{ gridColumn: { md: "span 2" } }}
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
                  {dangSua ? "Lưu thay đổi" : "Thêm sản phẩm"}
                </Button>
              </Stack>
            </Paper>
          )}

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: 700, whiteSpace: "nowrap" } }}>
                  <TableCell>Mã</TableCell>
                  <TableCell>Tên sản phẩm</TableCell>
                  <TableCell>Đơn vị</TableCell>
                  <TableCell align="right">Đơn giá</TableCell>
                  <TableCell>Ghi chú</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <TableCell align="right">Thao tác</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {danhMuc.map((sp) => (
                  <TableRow key={sp.ma_sp} hover>
                    <TableCell sx={{ whiteSpace: "nowrap", fontFamily: "monospace" }}>
                      {sp.ma_sp}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{sp.ten_sp}</TableCell>
                    <TableCell>{sp.don_vi || "—"}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      {tienVn(sp.don_gia)} ₫
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {sp.ghi_chu || "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={sp.status === "1" ? "success" : "default"}
                        variant={sp.status === "1" ? "filled" : "outlined"}
                        label={sp.status === "1" ? "Đang dùng" : "Ngừng"}
                        sx={{ height: 22 }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      <Tooltip title="Sửa">
                        <IconButton size="small" onClick={() => moSua(sp)}>
                          <EditRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Xóa">
                        <IconButton size="small" color="error" onClick={() => setDangXoa(sp)}>
                          <DeleteRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {danhMuc.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography
                        variant="body2"
                        color="text.disabled"
                        sx={{ textAlign: "center", py: 4 }}
                      >
                        Chưa có sản phẩm nào. Thêm sản phẩm trước khi dựng bảng.
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
        tieuDe="Xóa sản phẩm"
        noiDung={
          <>
            Xóa sản phẩm <strong>{dangXoa?.ten_sp}</strong> khỏi danh mục?
          </>
        }
        onClose={() => setDangXoa(undefined)}
        onXacNhan={xacNhanXoa}
      />
    </Dialog>
  );
}
