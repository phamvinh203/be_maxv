import { useState } from "react";
import { toast } from "react-toastify";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
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
import { getErrorMessage } from "../../../../../lib/errors";
import {
  useKhoanPhanTramList,
  useXoaKhoanPhanTram,
} from "../../../mock/hooks/luongPhanTram";
import type { KhoanLuong } from "../../../types";
import KhoanLuongFormDialog from "../../cai_dat_luong/KhoanLuongFormDialog";
import XacNhanXoaDialog from "../../XacNhanXoaDialog";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Danh mục loại % — chính là các khoản loại `luong_phan_tram` của **Danh mục
 * lương & phụ cấp** ở tab Cài đặt lương, mở ra ngay tại đây cho đỡ phải đi vòng.
 *
 * Form thêm/sửa dùng lại `KhoanLuongFormDialog`, vốn đã có sẵn ô "Tỷ lệ mặc
 * định" cho đúng loại khoản này — xem ghi chú ở `QuanLyThuongDialog`.
 */
export default function QuanLyPhanTramDialog({ open, onClose }: Props) {
  const danhMuc = useKhoanPhanTramList();
  const xoaKhoan = useXoaKhoanPhanTram();

  const [moForm, setMoForm] = useState(false);
  const [dangSua, setDangSua] = useState<KhoanLuong | undefined>(undefined);
  const [dangXoa, setDangXoa] = useState<KhoanLuong | undefined>(undefined);

  const moThem = () => {
    setDangSua(undefined);
    setMoForm(true);
  };

  const moSua = (khoan: KhoanLuong) => {
    setDangSua(khoan);
    setMoForm(true);
  };

  const xacNhanXoa = async () => {
    if (!dangXoa) return;
    try {
      await xoaKhoan(dangXoa.ma_khoan);
      toast.success(`Đã xóa loại % "${dangXoa.ten_khoan}".`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không xóa được loại %."));
    } finally {
      setDangXoa(undefined);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>Quản lý loại %</DialogTitle>
      <Typography variant="body2" color="text.secondary" sx={{ px: 3, pb: 2 }}>
        Các loại hoa hồng dùng chung với Danh mục lương & phụ cấp ở tab Cài đặt lương. Tỷ lệ ở
        đây là mức mặc định; từng kỳ vẫn sửa lại được ngay trên bảng.
      </Typography>

      <DialogContent dividers>
        <Box sx={{ mb: 2 }}>
          <Button
            startIcon={<AddRounded />}
            variant="outlined"
            onClick={moThem}
            sx={{ textTransform: "none" }}
          >
            Thêm loại %
          </Button>
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, whiteSpace: "nowrap" } }}>
                <TableCell>Mã</TableCell>
                <TableCell>Tên khoản</TableCell>
                <TableCell align="center">Tỷ lệ mặc định</TableCell>
                <TableCell>Ghi chú</TableCell>
                <TableCell align="center">Chịu thuế TNCN</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell align="right">Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {danhMuc.map((kl) => (
                <TableRow key={kl.ma_khoan} hover>
                  <TableCell sx={{ whiteSpace: "nowrap", fontFamily: "monospace" }}>
                    {kl.ma_khoan}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{kl.ten_khoan}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 600 }}>
                    {kl.ty_le}%
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {kl.ghi_chu || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">{kl.chiu_thue_tncn ? "Có" : "—"}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={kl.status === "1" ? "success" : "default"}
                      variant={kl.status === "1" ? "filled" : "outlined"}
                      label={kl.status === "1" ? "Đang dùng" : "Ngừng"}
                      sx={{ height: 22 }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    <Tooltip title="Sửa">
                      <IconButton size="small" onClick={() => moSua(kl)}>
                        <EditRounded fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Xóa">
                      <IconButton size="small" color="error" onClick={() => setDangXoa(kl)}>
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
                      Chưa có loại % nào. Thêm một loại trước khi dựng bảng.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained" sx={{ textTransform: "none" }}>
          Đóng
        </Button>
      </DialogActions>

      <KhoanLuongFormDialog
        open={moForm}
        loai="luong_phan_tram"
        khoan={dangSua}
        onClose={() => setMoForm(false)}
      />
      <XacNhanXoaDialog
        open={Boolean(dangXoa)}
        tieuDe="Xóa loại %"
        noiDung={
          <>
            Xóa khoản <strong>{dangXoa?.ten_khoan}</strong> khỏi danh mục lương & phụ cấp?
          </>
        }
        onClose={() => setDangXoa(undefined)}
        onXacNhan={xacNhanXoa}
      />
    </Dialog>
  );
}
