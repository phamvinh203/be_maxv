import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Checkbox from "@mui/material/Checkbox";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import { getErrorMessage } from "../../../../lib/errors";
import { sapXepCay } from "../../cay";
import { PB_CHUA_GAN } from "../../constants";
// Danh sách phòng ban lấy từ API thật (cùng nguồn với bảng phía sau dialog); còn danh sách
// nhân viên và thao tác gán vẫn là mock cho tới khi API nhân viên xong — nghĩa là gán xong,
// bảng Nhân viên (đọc mock) sẽ chưa tra được tên phòng ban thật.
import { usePhongBanList } from "../../api/phongBanQueries";
import { useGanNhanhPhongBan } from "../../mock/hooks/phongBan";
import { useNhanVienList } from "../../mock/hooks/nhanVien";

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Gán hàng loạt nhân viên vào một phòng ban. */
export default function GanNhanhDialog({ open, onClose }: Props) {
  const phongBan = usePhongBanList();
  const nhanVien = useNhanVienList();
  const ganNhanh = useGanNhanhPhongBan();

  const [loc, setLoc] = useState(PB_CHUA_GAN);
  const [tuKhoa, setTuKhoa] = useState("");
  const [daChon, setDaChon] = useState<string[]>([]);
  const [maPbDich, setMaPbDich] = useState("");
  const [dangLuu, setDangLuu] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoc(PB_CHUA_GAN);
    setTuKhoa("");
    setDaChon([]);
    setMaPbDich("");
  }, [open]);

  const cayPhongBan = useMemo(() => sapXepCay(phongBan), [phongBan]);
  const tenPbTheoMa = useMemo(
    () => new Map(phongBan.map((pb) => [pb.ma_pb, pb.ten_pb])),
    [phongBan],
  );

  const danhSachHien = useMemo(() => {
    const q = tuKhoa.trim().toLowerCase();
    return nhanVien
      // Nhân viên đã nghỉ không nằm trong danh sách gán — chuyển phòng ban cho
      // người đã nghỉ chỉ làm sai cột đếm ở màn Phòng ban.
      .filter((nv) => nv.status === "1")
      .filter((nv) => {
        if (loc === PB_CHUA_GAN) return !nv.ma_pb;
        if (loc) return nv.ma_pb === loc;
        return true;
      })
      .filter((nv) => {
        if (!q) return true;
        return [nv.ma_nv, nv.ho_ten].some((truong) => truong.toLowerCase().includes(q));
      })
      .sort((a, b) => a.ma_nv.localeCompare(b.ma_nv));
  }, [nhanVien, loc, tuKhoa]);

  const toggle = (maNv: string) => {
    setDaChon((cu) =>
      cu.includes(maNv) ? cu.filter((ma) => ma !== maNv) : [...cu, maNv],
    );
  };

  const chonTatCa = () => {
    const dangHien = danhSachHien.map((nv) => nv.ma_nv);
    const daChonHet = dangHien.every((ma) => daChon.includes(ma));
    setDaChon(daChonHet ? [] : Array.from(new Set([...daChon, ...dangHien])));
  };

  const handleSubmit = async () => {
    setDangLuu(true);
    try {
      await ganNhanh(maPbDich, daChon);
      toast.success(
        `Đã gán ${daChon.length} nhân viên vào ${tenPbTheoMa.get(maPbDich) ?? maPbDich}.`,
      );
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, "Không gán được phòng ban."));
    } finally {
      setDangLuu(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Gán nhanh phòng ban</DialogTitle>
      <DialogContent dividers>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1.4fr 1fr" },
            gap: 3,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
              1. Chọn nhân viên
            </Typography>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 1.5 }}>
              <TextField
                select
                label="Lọc theo phòng ban"
                size="small"
                fullWidth
                value={loc}
                onChange={(e) => setLoc(e.target.value)}
              >
                <MenuItem value={PB_CHUA_GAN}>Chưa có phòng ban</MenuItem>
                <MenuItem value="">Tất cả nhân viên</MenuItem>
                <Divider />
                {cayPhongBan.map((pb) => (
                  <MenuItem key={pb.ma_pb} value={pb.ma_pb}>
                    {" ".repeat((pb.cap - 1) * 4)}
                    {pb.ten_pb}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Tìm mã hoặc tên"
                size="small"
                fullWidth
                value={tuKhoa}
                onChange={(e) => setTuKhoa(e.target.value)}
              />
            </Stack>

            <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
              <ListItemButton onClick={chonTatCa} disabled={danhSachHien.length === 0} dense>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Checkbox
                    edge="start"
                    disableRipple
                    tabIndex={-1}
                    checked={
                      danhSachHien.length > 0 &&
                      danhSachHien.every((nv) => daChon.includes(nv.ma_nv))
                    }
                    indeterminate={
                      danhSachHien.some((nv) => daChon.includes(nv.ma_nv)) &&
                      !danhSachHien.every((nv) => daChon.includes(nv.ma_nv))
                    }
                  />
                </ListItemIcon>
                <ListItemText
                  primary="Chọn tất cả đang hiển thị"
                  slotProps={{ primary: { variant: "body2", sx: { fontWeight: 600 } } }}
                />
              </ListItemButton>
              <Divider />
              <List dense disablePadding sx={{ maxHeight: 320, overflowY: "auto" }}>
                {danhSachHien.map((nv) => (
                  <ListItemButton key={nv.ma_nv} onClick={() => toggle(nv.ma_nv)}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <Checkbox
                        edge="start"
                        disableRipple
                        tabIndex={-1}
                        checked={daChon.includes(nv.ma_nv)}
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={`${nv.ma_nv} — ${nv.ho_ten}`}
                      secondary={
                        nv.ma_pb
                          ? (tenPbTheoMa.get(nv.ma_pb) ?? nv.ma_pb)
                          : "Chưa có phòng ban"
                      }
                    />
                  </ListItemButton>
                ))}
                {danhSachHien.length === 0 && (
                  <Typography
                    variant="body2"
                    color="text.disabled"
                    sx={{ textAlign: "center", py: 4 }}
                  >
                    Không có nhân viên nào khớp bộ lọc.
                  </Typography>
                )}
              </List>
            </Box>
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
              2. Chọn phòng ban đích
            </Typography>
            <TextField
              select
              label="Phòng ban"
              size="small"
              fullWidth
              required
              value={maPbDich}
              onChange={(e) => setMaPbDich(e.target.value)}
            >
              {cayPhongBan.map((pb) => (
                <MenuItem key={pb.ma_pb} value={pb.ma_pb}>
                  {" ".repeat((pb.cap - 1) * 4)}
                  {pb.ten_pb}
                </MenuItem>
              ))}
            </TextField>

            <Alert severity="info" sx={{ mt: 2 }}>
              Đã chọn <strong>{daChon.length}</strong> nhân viên. Phòng ban hiện tại của họ
              sẽ bị thay thế.
            </Alert>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>
          Hủy
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={dangLuu || daChon.length === 0 || !maPbDich}
          sx={{ textTransform: "none" }}
        >
          Gán {daChon.length > 0 ? `(${daChon.length})` : ""}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
