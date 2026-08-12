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
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import { getErrorMessage } from "../../../../../lib/errors";
import { LOAI_TAI_LIEU } from "../../../constants";
import { ngayVn, nhan } from "../../../format";
import { useTaiLieuList, useXoaTaiLieu } from "../../../mock/hooks/taiLieu";
import type { TaiLieu } from "../../../types";
import XacNhanXoaDialog from "../../XacNhanXoaDialog";
import TaiLieuFormDialog from "../TaiLieuFormDialog";

export default function HoSoTab({ maNv }: { maNv: string }) {
  const danhSach = useTaiLieuList(maNv);
  const xoaTaiLieu = useXoaTaiLieu();

  const [formOpen, setFormOpen] = useState(false);
  const [dangSua, setDangSua] = useState<TaiLieu | undefined>(undefined);
  const [dangXoa, setDangXoa] = useState<TaiLieu | undefined>(undefined);

  const xacNhanXoa = async () => {
    if (!dangXoa) return;
    try {
      await xoaTaiLieu(dangXoa.id);
      toast.success("Đã xóa tài liệu.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Không xóa được tài liệu."));
    } finally {
      setDangXoa(undefined);
    }
  };

  return (
    <Box>
      {/* Nói rõ để người dùng không tưởng là lỗi khi không thấy chỗ tải ảnh lên. */}
      <Alert severity="info" sx={{ mb: 2 }}>
        Bản này lưu thông tin tài liệu dạng chữ. Đính kèm ảnh CCCD và file quét sẽ có ở bản sau.
      </Alert>

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
          Thêm tài liệu
        </Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ "& th": { fontWeight: 700, whiteSpace: "nowrap" } }}>
              <TableCell>Loại</TableCell>
              <TableCell>Số hiệu</TableCell>
              <TableCell>Ngày cấp</TableCell>
              <TableCell>Nơi cấp</TableCell>
              <TableCell>Ghi chú</TableCell>
              <TableCell align="right">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {danhSach.map((tl) => (
              <TableRow key={tl.id} hover>
                <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 600 }}>
                  {nhan(LOAI_TAI_LIEU, tl.loai)}
                </TableCell>
                <TableCell>{tl.so_hieu || "—"}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  {tl.ngay_cap ? ngayVn(tl.ngay_cap) : "—"}
                </TableCell>
                <TableCell>{tl.noi_cap || "—"}</TableCell>
                <TableCell>{tl.ghi_chu || "—"}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  <Tooltip title="Sửa">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setDangSua(tl);
                        setFormOpen(true);
                      }}
                    >
                      <EditRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Xóa">
                    <IconButton size="small" color="error" onClick={() => setDangXoa(tl)}>
                      <DeleteRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {danhSach.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography
                    variant="body2"
                    color="text.disabled"
                    sx={{ textAlign: "center", py: 4 }}
                  >
                    Chưa có tài liệu nào.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TaiLieuFormDialog
        open={formOpen}
        maNv={maNv}
        taiLieu={dangSua}
        onClose={() => setFormOpen(false)}
      />
      <XacNhanXoaDialog
        open={Boolean(dangXoa)}
        tieuDe="Xóa tài liệu"
        noiDung={
          <>
            Xóa tài liệu <strong>{dangXoa ? nhan(LOAI_TAI_LIEU, dangXoa.loai) : ""}</strong>?
          </>
        }
        onClose={() => setDangXoa(undefined)}
        onXacNhan={xacNhanXoa}
      />
    </Box>
  );
}
