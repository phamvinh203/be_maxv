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
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import AddRounded from "@mui/icons-material/AddRounded";
import EditRounded from "@mui/icons-material/EditRounded";
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import RemoveRounded from "@mui/icons-material/RemoveRounded";
import { getErrorMessage } from "../../../../../lib/errors";
import { LOAI_NGAY_LE } from "../../../constants";
import { ngayVn, nhan } from "../../../format";
import { useNgayLeRows, useXoaNgayLe } from "../../../mock/hooks/ngayLe";
import type { LocNgayLe, NgayLe } from "../../../types";
import XacNhanXoaDialog from "../../XacNhanXoaDialog";
import NgayLeFormDialog from "./NgayLeFormDialog";
import TaoNhanhDialog from "./TaoNhanhDialog";

const BO_LOC: { value: LocNgayLe; label: string }[] = [
  { value: "tat_ca", label: "Ngày lễ" },
  { value: "hang_nam", label: "Hàng năm" },
  { value: "nam_nay", label: "Năm nay" },
];

const THU_VN = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

/** Thứ trong tuần của một mốc `YYYY-MM-DD`. Tính trên UTC để không lệch múi giờ. */
function thuTrongTuan(iso: string): string {
  const moc = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(moc)) return "";
  return THU_VN[new Date(moc).getUTCDay()] ?? "";
}

export default function LichNgayLePanel() {
  const [loc, setLoc] = useState<LocNgayLe>("nam_nay");
  const rows = useNgayLeRows(loc);
  const xoaNgayLe = useXoaNgayLe();

  const [formOpen, setFormOpen] = useState(false);
  const [taoNhanhOpen, setTaoNhanhOpen] = useState(false);
  const [dangSua, setDangSua] = useState<NgayLe | undefined>(undefined);
  const [dangXoa, setDangXoa] = useState<NgayLe | undefined>(undefined);

  const xacNhanXoa = async () => {
    if (!dangXoa) return;
    try {
      await xoaNgayLe(dangXoa.id);
      toast.success(`Đã xóa ngày lễ ${dangXoa.ten}.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không xóa được ngày lễ."));
    } finally {
      setDangXoa(undefined);
    }
  };

  return (
    <Box>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        sx={{ mb: 2, alignItems: { md: "center" }, justifyContent: "space-between" }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={loc}
          onChange={(_, giaTri: LocNgayLe | null) => giaTri && setLoc(giaTri)}
        >
          {BO_LOC.map((item) => (
            <ToggleButton
              key={item.value}
              value={item.value}
              sx={{ textTransform: "none", px: 2 }}
            >
              {item.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            startIcon={<AutoAwesomeRounded />}
            onClick={() => setTaoNhanhOpen(true)}
            sx={{ textTransform: "none" }}
          >
            Tạo nhanh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddRounded />}
            onClick={() => {
              setDangSua(undefined);
              setFormOpen(true);
            }}
            sx={{ textTransform: "none" }}
          >
            Thêm ngày lễ
          </Button>
        </Stack>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ "& th": { fontWeight: 700, whiteSpace: "nowrap" } }}>
              <TableCell>Ngày</TableCell>
              <TableCell>Tên ngày lễ</TableCell>
              <TableCell>Loại lễ</TableCell>
              <TableCell>Chu kỳ lặp</TableCell>
              <TableCell align="center">Có lương</TableCell>
              <TableCell>Ghi chú</TableCell>
              <TableCell align="right">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((nl) => (
              <TableRow key={nl.id} hover>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {ngayVn(nl.ngay)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {thuTrongTuan(nl.ngay)}
                  </Typography>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{nl.ten}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={nhan(LOAI_NGAY_LE, nl.loai)}
                    sx={{ height: 22 }}
                  />
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  {nl.lap_lai_hang_nam ? (
                    <Chip size="small" color="primary" label="Hàng năm" sx={{ height: 22 }} />
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Chỉ năm {nl.ngay.slice(0, 4)}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="center">
                  {nl.co_luong ? (
                    <CheckRounded fontSize="small" color="success" />
                  ) : (
                    <RemoveRounded fontSize="small" sx={{ color: "text.disabled" }} />
                  )}
                </TableCell>
                <TableCell>
                  {nl.ghi_chu || <Box component="span" sx={{ color: "text.disabled" }}>—</Box>}
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  <Tooltip title="Sửa">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setDangSua(nl);
                        setFormOpen(true);
                      }}
                    >
                      <EditRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Xóa">
                    <IconButton size="small" color="error" onClick={() => setDangXoa(nl)}>
                      <DeleteRounded fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography
                    variant="body2"
                    color="text.disabled"
                    sx={{ textAlign: "center", py: 4 }}
                  >
                    Chưa có ngày lễ nào khớp bộ lọc. Dùng "Tạo nhanh" để sinh lịch chuẩn Việt
                    Nam cho một năm.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <NgayLeFormDialog open={formOpen} ngayLe={dangSua} onClose={() => setFormOpen(false)} />
      <TaoNhanhDialog open={taoNhanhOpen} onClose={() => setTaoNhanhOpen(false)} />
      <XacNhanXoaDialog
        open={Boolean(dangXoa)}
        tieuDe="Xóa ngày lễ"
        noiDung={
          <>
            Xóa ngày lễ <strong>{dangXoa?.ten}</strong> ({dangXoa ? ngayVn(dangXoa.ngay) : ""})?
          </>
        }
        onClose={() => setDangXoa(undefined)}
        onXacNhan={xacNhanXoa}
      />
    </Box>
  );
}
