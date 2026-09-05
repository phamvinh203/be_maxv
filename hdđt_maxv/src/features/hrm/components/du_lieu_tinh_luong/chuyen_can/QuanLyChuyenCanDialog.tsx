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
import { CACH_TRU_CHUYEN_CAN, TRANG_THAI_PB, moTaCachTru } from "../../../constants";
import { tienVn } from "../../../format";
import { loaiChuyenCanRong } from "../../../formDefaults";
import {
  useLoaiChuyenCanList,
  useLuuLoaiChuyenCan,
  useXoaLoaiChuyenCan,
} from "../../../mock/hooks/chuyenCan";
import type {
  CachTruChuyenCan,
  LoaiChuyenCan,
  LoaiChuyenCanFormValues,
  TrangThai,
} from "../../../types";
import TienField from "../../TienField";
import XacNhanXoaDialog from "../../XacNhanXoaDialog";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Danh mục lỗi chuyên cần — nguồn của ô chọn "Loại chuyên cần" ở bảng.
 *
 * Form thêm/sửa nằm **trong** dialog này chứ không mở dialog con: loại lỗi chỉ
 * có bốn ô, mà chồng hai lớp dialog thì bấm ra ngoài rất dễ đóng nhầm cả hai.
 */
export default function QuanLyChuyenCanDialog({ open, onClose }: Props) {
  const danhMuc = useLoaiChuyenCanList();
  const luuLoai = useLuuLoaiChuyenCan();
  const xoaLoai = useXoaLoaiChuyenCan();

  /** `null` = form đang đóng; chuỗi rỗng = đang thêm mới; có mã = đang sửa mã đó. */
  const [dangSua, setDangSua] = useState<string | null>(null);
  const [values, setValues] = useState<LoaiChuyenCanFormValues>(loaiChuyenCanRong);
  const [dangLuu, setDangLuu] = useState(false);
  const [dangXoa, setDangXoa] = useState<LoaiChuyenCan | undefined>(undefined);

  useEffect(() => {
    if (open) return;
    // Đóng dialog thì bỏ luôn form đang mở — mở lại lần sau không nên thấy nửa
    // chừng bản nháp của lần trước.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDangSua(null);
  }, [open]);

  const dat = <K extends keyof LoaiChuyenCanFormValues>(
    khoa: K,
    giaTri: LoaiChuyenCanFormValues[K],
  ) => setValues((cu) => ({ ...cu, [khoa]: giaTri }));

  const moThem = () => {
    setValues(loaiChuyenCanRong());
    setDangSua("");
  };

  const moSua = (cc: LoaiChuyenCan) => {
    setValues({
      ten_cc: cc.ten_cc,
      cach_tru: cc.cach_tru,
      muc_tru: cc.muc_tru,
      ghi_chu: cc.ghi_chu,
      status: cc.status,
    });
    setDangSua(cc.ma_cc);
  };

  const handleLuu = async () => {
    setDangLuu(true);
    try {
      await luuLoai(values, dangSua || undefined);
      toast.success(dangSua ? "Đã cập nhật loại chuyên cần." : "Đã thêm loại chuyên cần.");
      setDangSua(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không lưu được loại chuyên cần."));
    } finally {
      setDangLuu(false);
    }
  };

  const xacNhanXoa = async () => {
    if (!dangXoa) return;
    try {
      await xoaLoai(dangXoa.ma_cc);
      toast.success(`Đã xóa loại "${dangXoa.ten_cc}".`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không xóa được loại chuyên cần."));
    } finally {
      setDangXoa(undefined);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>Quản lý chuyên cần</DialogTitle>
      <Typography variant="body2" color="text.secondary" sx={{ px: 3, pb: 2 }}>
        Danh mục lỗi chuyên cần và cách mỗi lỗi cắt vào khoản chuyên cần. Loại đang được nhân
        viên sử dụng thì chuyển sang "Ngừng" thay vì xóa.
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
                Thêm loại chuyên cần
              </Button>
            </Box>
          ) : (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                {dangSua ? `Sửa loại ${dangSua}` : "Loại chuyên cần mới"}
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "minmax(0, 2fr) 220px 200px" },
                  gap: 2,
                }}
              >
                <TextField
                  label="Tên loại"
                  required
                  autoFocus
                  size="small"
                  value={values.ten_cc}
                  onChange={(e) => dat("ten_cc", e.target.value)}
                />
                <TextField
                  select
                  label="Cách trừ"
                  size="small"
                  value={values.cach_tru}
                  onChange={(e) => dat("cach_tru", e.target.value as CachTruChuyenCan)}
                >
                  {CACH_TRU_CHUYEN_CAN.map((item) => (
                    <MenuItem key={item.value} value={item.value}>
                      {item.label}
                    </MenuItem>
                  ))}
                </TextField>
                {/* Loại mất toàn bộ trừ đúng bằng khoản chuyên cần của từng
                    người nên không có mức riêng — ẩn ô đi thay vì để một ô vô
                    tác dụng. */}
                {values.cach_tru === "mat_toan_bo" ? (
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <Typography variant="caption" color="text.secondary">
                      Trừ đúng bằng khoản chuyên cần của nhân viên.
                    </Typography>
                  </Box>
                ) : (
                  <TienField
                    label={`Mức trừ (${moTaCachTru(values.cach_tru).donVi})`}
                    value={values.muc_tru}
                    onChange={(so) => dat("muc_tru", so)}
                  />
                )}
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
                  {dangSua ? "Lưu thay đổi" : "Thêm loại"}
                </Button>
              </Stack>
            </Paper>
          )}

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: 700, whiteSpace: "nowrap" } }}>
                  <TableCell>Mã</TableCell>
                  <TableCell>Tên loại</TableCell>
                  <TableCell>Cách trừ</TableCell>
                  <TableCell align="right">Mức trừ</TableCell>
                  <TableCell>Ghi chú</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <TableCell align="right">Thao tác</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {danhMuc.map((cc) => {
                  const moTa = moTaCachTru(cc.cach_tru);
                  return (
                    <TableRow key={cc.ma_cc} hover>
                      <TableCell sx={{ whiteSpace: "nowrap", fontFamily: "monospace" }}>
                        {cc.ma_cc}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{cc.ten_cc}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{moTa.label}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        {cc.cach_tru === "mat_toan_bo"
                          ? "Toàn bộ"
                          : `${tienVn(cc.muc_tru)} ${moTa.donVi}`}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {cc.ghi_chu || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={cc.status === "1" ? "success" : "default"}
                          variant={cc.status === "1" ? "filled" : "outlined"}
                          label={cc.status === "1" ? "Đang dùng" : "Ngừng"}
                          sx={{ height: 22 }}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        <Tooltip title="Sửa">
                          <IconButton size="small" onClick={() => moSua(cc)}>
                            <EditRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Xóa">
                          <IconButton size="small" color="error" onClick={() => setDangXoa(cc)}>
                            <DeleteRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {danhMuc.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography
                        variant="body2"
                        color="text.disabled"
                        sx={{ textAlign: "center", py: 4 }}
                      >
                        Chưa có loại chuyên cần nào. Thêm một loại trước khi dựng bảng.
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
        tieuDe="Xóa loại chuyên cần"
        noiDung={
          <>
            Xóa loại <strong>{dangXoa?.ten_cc}</strong> khỏi danh mục?
          </>
        }
        onClose={() => setDangXoa(undefined)}
        onXacNhan={xacNhanXoa}
      />
    </Dialog>
  );
}
