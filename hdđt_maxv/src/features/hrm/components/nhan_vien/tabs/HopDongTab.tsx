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
import CheckRounded from "@mui/icons-material/CheckRounded";
import RemoveRounded from "@mui/icons-material/RemoveRounded";
import { getErrorMessage } from "../../../../../lib/errors";
import { trangThaiHopDong } from "../../../cay";
import { KIEU_LUONG, LOAI_HD } from "../../../constants";
import { homNay, ngayVn, nhan, tienVn } from "../../../format";
import { useHopDongList, useXoaHopDong } from "../../../mock/hooks/hopDong";
import type { HopDong } from "../../../types";
import XacNhanXoaDialog from "../../XacNhanXoaDialog";
import HopDongFormDialog from "../HopDongFormDialog";

const MAU_TRANG_THAI = {
  "Hiệu lực": "success",
  "Sắp tới": "info",
  "Hết hạn": "default",
} as const;

/** Nơi duy nhất ký mới, gia hạn và sửa hợp đồng của một nhân viên. */
export default function HopDongTab({ maNv }: { maNv: string }) {
  const danhSach = useHopDongList(maNv);
  const xoaHopDong = useXoaHopDong();

  const [formOpen, setFormOpen] = useState(false);
  const [dangSua, setDangSua] = useState<HopDong | undefined>(undefined);
  const [dangXoa, setDangXoa] = useState<HopDong | undefined>(undefined);
  const moc = homNay();

  const moThem = () => {
    setDangSua(undefined);
    setFormOpen(true);
  };

  const xacNhanXoa = async () => {
    if (!dangXoa) return;
    try {
      await xoaHopDong(dangXoa.id);
      toast.success(`Đã xóa hợp đồng ${dangXoa.so_hd}.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không xóa được hợp đồng."));
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
          onClick={moThem}
          sx={{ textTransform: "none" }}
        >
          Thêm hợp đồng
        </Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ "& th": { fontWeight: 700, whiteSpace: "nowrap" } }}>
              <TableCell>Số HĐ</TableCell>
              <TableCell>Loại</TableCell>
              <TableCell>Kiểu lương</TableCell>
              <TableCell align="right">Lương chính</TableCell>
              <TableCell align="right">Lương BHXH</TableCell>
              <TableCell>Từ ngày</TableCell>
              <TableCell>Đến ngày</TableCell>
              <TableCell align="center">BHXH</TableCell>
              <TableCell align="center">TNCN</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell align="right">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {danhSach.map((hd) => {
              const trangThai = trangThaiHopDong(hd, moc);
              return (
                <TableRow key={hd.id} hover>
                  <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 600 }}>
                    {hd.so_hd}
                  </TableCell>
                  <TableCell>{nhan(LOAI_HD, hd.loai_hd)}</TableCell>
                  <TableCell>{nhan(KIEU_LUONG, hd.kieu_luong).split(" — ")[0]}</TableCell>
                  <TableCell align="right">{tienVn(hd.luong_chinh)}</TableCell>
                  <TableCell align="right">{tienVn(hd.luong_bhxh)}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {ngayVn(hd.ngay_bat_dau)}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {hd.ngay_ket_thuc ? ngayVn(hd.ngay_ket_thuc) : "Không xác định"}
                  </TableCell>
                  <TableCell align="center">
                    <CoKhong co={hd.trich_bhxh} />
                  </TableCell>
                  <TableCell align="center">
                    <CoKhong co={hd.tinh_tncn} />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={trangThai}
                      color={MAU_TRANG_THAI[trangThai]}
                      variant={trangThai === "Hết hạn" ? "outlined" : "filled"}
                      sx={{ height: 22 }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    <Tooltip title="Sửa">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setDangSua(hd);
                          setFormOpen(true);
                        }}
                      >
                        <EditRounded fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Xóa">
                      <IconButton size="small" color="error" onClick={() => setDangXoa(hd)}>
                        <DeleteRounded fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
            {danhSach.length === 0 && (
              <TableRow>
                <TableCell colSpan={11}>
                  <Typography
                    variant="body2"
                    color="text.disabled"
                    sx={{ textAlign: "center", py: 4 }}
                  >
                    Chưa có hợp đồng nào.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <HopDongFormDialog
        open={formOpen}
        maNv={maNv}
        hopDong={dangSua}
        onClose={() => setFormOpen(false)}
      />
      <XacNhanXoaDialog
        open={Boolean(dangXoa)}
        tieuDe="Xóa hợp đồng"
        noiDung={
          <>
            Xóa hợp đồng <strong>{dangXoa?.so_hd}</strong>? Lịch sử hợp đồng sẽ mất dòng này.
          </>
        }
        onClose={() => setDangXoa(undefined)}
        onXacNhan={xacNhanXoa}
      />
    </Box>
  );
}

function CoKhong({ co }: { co: boolean }) {
  return co ? (
    <CheckRounded fontSize="small" color="success" />
  ) : (
    <RemoveRounded fontSize="small" sx={{ color: "text.disabled" }} />
  );
}
