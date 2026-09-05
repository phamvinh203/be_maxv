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
import { chiTieuKpiRong } from "../../../formDefaults";
import {
  useChiTieuKpiList,
  useLuuChiTieuKpi,
  useXoaChiTieuKpi,
} from "../../../mock/hooks/kpi";
import type { ChiTieuKpi, ChiTieuKpiFormValues, TrangThai } from "../../../types";
import XacNhanXoaDialog from "../../XacNhanXoaDialog";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Danh mục chỉ tiêu KPI — nguồn của ô chọn "Chỉ tiêu" ở bảng KPI.
 *
 * Form thêm/sửa nằm **trong** dialog này chứ không mở dialog con: chỉ tiêu chỉ
 * có bốn ô, mà chồng hai lớp dialog thì bấm ra ngoài rất dễ đóng nhầm cả hai.
 */
export default function QuanLyKpiDialog({ open, onClose }: Props) {
  const danhMuc = useChiTieuKpiList();
  const luuChiTieu = useLuuChiTieuKpi();
  const xoaChiTieu = useXoaChiTieuKpi();

  /** `null` = form đang đóng; chuỗi rỗng = đang thêm mới; có mã = đang sửa mã đó. */
  const [dangSua, setDangSua] = useState<string | null>(null);
  const [values, setValues] = useState<ChiTieuKpiFormValues>(chiTieuKpiRong);
  const [dangLuu, setDangLuu] = useState(false);
  const [dangXoa, setDangXoa] = useState<ChiTieuKpi | undefined>(undefined);

  useEffect(() => {
    if (open) return;
    // Đóng dialog thì bỏ luôn form đang mở — mở lại lần sau không nên thấy nửa
    // chừng bản nháp của lần trước.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDangSua(null);
  }, [open]);

  const dat = <K extends keyof ChiTieuKpiFormValues>(
    khoa: K,
    giaTri: ChiTieuKpiFormValues[K],
  ) => setValues((cu) => ({ ...cu, [khoa]: giaTri }));

  const moThem = () => {
    setValues(chiTieuKpiRong());
    setDangSua("");
  };

  const moSua = (ct: ChiTieuKpi) => {
    setValues({
      ten_kpi: ct.ten_kpi,
      don_vi: ct.don_vi,
      trong_so_mac_dinh: ct.trong_so_mac_dinh,
      ghi_chu: ct.ghi_chu,
      status: ct.status,
    });
    setDangSua(ct.ma_kpi);
  };

  const handleLuu = async () => {
    setDangLuu(true);
    try {
      await luuChiTieu(values, dangSua || undefined);
      toast.success(dangSua ? "Đã cập nhật chỉ tiêu." : "Đã thêm chỉ tiêu KPI.");
      setDangSua(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không lưu được chỉ tiêu."));
    } finally {
      setDangLuu(false);
    }
  };

  const xacNhanXoa = async () => {
    if (!dangXoa) return;
    try {
      await xoaChiTieu(dangXoa.ma_kpi);
      toast.success(`Đã xóa chỉ tiêu "${dangXoa.ten_kpi}".`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không xóa được chỉ tiêu."));
    } finally {
      setDangXoa(undefined);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>Quản lý KPI</DialogTitle>
      <Typography variant="body2" color="text.secondary" sx={{ px: 3, pb: 2 }}>
        Danh mục chỉ tiêu dùng chung cho mọi bảng KPI. Chỉ tiêu đang được nhân viên sử dụng thì
        chuyển sang "Ngừng" thay vì xóa, để bảng cũ vẫn đọc được tên.
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
                Thêm chỉ tiêu
              </Button>
            </Box>
          ) : (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                {dangSua ? `Sửa chỉ tiêu ${dangSua}` : "Chỉ tiêu mới"}
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "minmax(0, 2fr) 120px 150px" },
                  gap: 2,
                }}
              >
                <TextField
                  label="Tên chỉ tiêu"
                  required
                  autoFocus
                  size="small"
                  value={values.ten_kpi}
                  onChange={(e) => dat("ten_kpi", e.target.value)}
                />
                <TextField
                  label="Đơn vị"
                  size="small"
                  placeholder="đồng, đơn, %…"
                  value={values.don_vi}
                  onChange={(e) => dat("don_vi", e.target.value)}
                />
                <TextField
                  label="Trọng số mặc định"
                  type="number"
                  size="small"
                  value={values.trong_so_mac_dinh}
                  onChange={(e) => dat("trong_so_mac_dinh", Number(e.target.value) || 0)}
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                  slotProps={{ htmlInput: { min: 0, step: 1 } }}
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
                  {dangSua ? "Lưu thay đổi" : "Thêm chỉ tiêu"}
                </Button>
              </Stack>
            </Paper>
          )}

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: 700, whiteSpace: "nowrap" } }}>
                  <TableCell>Mã</TableCell>
                  <TableCell>Tên chỉ tiêu</TableCell>
                  <TableCell>Đơn vị</TableCell>
                  <TableCell align="center">Trọng số MĐ</TableCell>
                  <TableCell>Ghi chú</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <TableCell align="right">Thao tác</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {danhMuc.map((ct) => (
                  <TableRow key={ct.ma_kpi} hover>
                    <TableCell sx={{ whiteSpace: "nowrap", fontFamily: "monospace" }}>
                      {ct.ma_kpi}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{ct.ten_kpi}</TableCell>
                    <TableCell>{ct.don_vi || "—"}</TableCell>
                    <TableCell align="center">{ct.trong_so_mac_dinh}</TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {ct.ghi_chu || "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={ct.status === "1" ? "success" : "default"}
                        variant={ct.status === "1" ? "filled" : "outlined"}
                        label={ct.status === "1" ? "Đang dùng" : "Ngừng"}
                        sx={{ height: 22 }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      <Tooltip title="Sửa">
                        <IconButton size="small" onClick={() => moSua(ct)}>
                          <EditRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Xóa">
                        <IconButton size="small" color="error" onClick={() => setDangXoa(ct)}>
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
                        Chưa có chỉ tiêu nào. Thêm chỉ tiêu trước khi dựng bảng KPI.
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
        tieuDe="Xóa chỉ tiêu KPI"
        noiDung={
          <>
            Xóa chỉ tiêu <strong>{dangXoa?.ten_kpi}</strong> khỏi danh mục?
          </>
        }
        onClose={() => setDangXoa(undefined)}
        onXacNhan={xacNhanXoa}
      />
    </Dialog>
  );
}
