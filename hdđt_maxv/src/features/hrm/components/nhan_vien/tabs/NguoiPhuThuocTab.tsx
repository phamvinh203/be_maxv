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
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import { getErrorMessage } from "../../../../../lib/errors";
import { QUAN_HE } from "../../../constants";
import { kyGiamTru, ngayVn, nhan } from "../../../format";
import {
  useNguoiPhuThuocList,
  useXoaNguoiPhuThuoc,
} from "../../../api/nguoiPhuThuocQueries";
import type { NguoiPhuThuoc } from "../../../types";
import XacNhanXoaDialog from "../../XacNhanXoaDialog";
import NguoiPhuThuocFormDialog from "../../nguoi_phu_thuoc/NguoiPhuThuocFormDialog";

/** Tab người phụ thuộc trong hồ sơ nhân viên — dùng chung form với màn hình độc lập. */
export default function NguoiPhuThuocTab({ maNv }: { maNv: string }) {
  const {
    items: danhSach,
    isLoading,
    isError,
    error,
  } = useNguoiPhuThuocList(maNv);
  const xoaNpt = useXoaNguoiPhuThuoc();

  const [formOpen, setFormOpen] = useState(false);
  const [dangSua, setDangSua] = useState<NguoiPhuThuoc | undefined>(undefined);
  const [dangXoa, setDangXoa] = useState<NguoiPhuThuoc | undefined>(undefined);

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
      <Stack direction="row" sx={{ mb: 2, justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          startIcon={<AddRounded />}
          onClick={() => {
            setDangSua(undefined);
            setFormOpen(true);
          }}
          sx={{ textTransform: "none" }}
        >
          Thêm người phụ thuộc
        </Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ "& th": { fontWeight: 700, whiteSpace: "nowrap" } }}>
              <TableCell>Họ và tên</TableCell>
              <TableCell>Quan hệ</TableCell>
              <TableCell>Ngày sinh</TableCell>
              <TableCell>CCCD</TableCell>
              <TableCell>MST</TableCell>
              <TableCell>Điện thoại</TableCell>
              <TableCell>ĐK giảm trừ</TableCell>
              <TableCell align="right">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {danhSach.map((npt) => (
              <TableRow key={npt.id} hover>
                <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 600 }}>
                  {npt.ho_ten}
                </TableCell>
                <TableCell>{nhan(QUAN_HE, npt.quan_he)}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>{ngayVn(npt.ngay_sinh)}</TableCell>
                <TableCell>{npt.so_cccd || "—"}</TableCell>
                <TableCell>{npt.mst_ca_nhan || "—"}</TableCell>
                <TableCell>{npt.dien_thoai || "—"}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  {kyGiamTru(npt.gt_tu_thang, npt.gt_den_thang)}
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  <Tooltip title="Sửa">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setDangSua(npt);
                        setFormOpen(true);
                      }}
                    >
                      <EditRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Xóa">
                    <IconButton size="small" color="error" onClick={() => setDangXoa(npt)}>
                      <DeleteRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {danhSach.length === 0 && (
              <TableRow>
                <TableCell colSpan={8}>
                  {/* Lỗi tải KHÔNG được hiện thành "chưa có" — người dùng sẽ nhập lại
                      một bản trùng cho người phụ thuộc đã đăng ký. */}
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
                      {getErrorMessage(error, "Không tải được người phụ thuộc.")}
                    </Typography>
                  ) : (
                    <Typography
                      variant="body2"
                      color="text.disabled"
                      sx={{ textAlign: "center", py: 4 }}
                    >
                      Chưa có người phụ thuộc nào.
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
        maNvCoDinh={maNv}
        npt={dangSua}
        onClose={() => setFormOpen(false)}
      />
      <XacNhanXoaDialog
        open={Boolean(dangXoa)}
        tieuDe="Xóa người phụ thuộc"
        noiDung={
          <>
            Xóa người phụ thuộc <strong>{dangXoa?.ho_ten}</strong>?
          </>
        }
        onClose={() => setDangXoa(undefined)}
        onXacNhan={xacNhanXoa}
      />
    </Box>
  );
}
