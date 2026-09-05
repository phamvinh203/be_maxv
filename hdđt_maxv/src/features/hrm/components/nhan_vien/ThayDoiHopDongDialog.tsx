import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import { getErrorMessage } from "../../../../lib/errors";
import { KIEU_LUONG, LOAI_HD } from "../../constants";
import { homNay, ngayVn, nhan, tienVn } from "../../format";
import { hopDongRong } from "../../formDefaults";
import { useDoiHopDong } from "../../api/hopDongQueries";
import type { HopDong, HopDongFormValues, KieuLuong, LoaiHopDong, NhanVien } from "../../types";
import OThongTin from "../OThongTin";
import TienField from "../TienField";

interface Props {
  open: boolean;
  onClose: () => void;
  nhanVien: NhanVien;
  /** Hợp đồng hiện hành, `null` khi nhân viên chưa ký hợp đồng nào. */
  hopDongHienTai: HopDong | null;
}

/** Cộng `so` ngày vào một mốc `YYYY-MM-DD`. Tính trên UTC để không lệch múi giờ. */
function themNgay(iso: string, so: number): string {
  const moc = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(moc)) return iso;
  return new Date(moc + so * 86400000).toISOString().slice(0, 10);
}

/**
 * Chốt hợp đồng hiện tại và ký hợp đồng mới trong một lần.
 *
 * Tách khỏi `HopDongFormDialog` (sửa một dòng lịch sử) vì đây là một **thao tác
 * nghiệp vụ** chạm vào hai bản ghi: thiếu bước chốt sẽ để lại hai hợp đồng cùng
 * hiệu lực, và cột "Hợp đồng" trên bảng nhân viên hiện cái nào cũng như nhau.
 */
export default function ThayDoiHopDongDialog({
  open,
  onClose,
  nhanVien,
  hopDongHienTai,
}: Props) {
  const doiHopDong = useDoiHopDong();

  const [ngayChot, setNgayChot] = useState("");
  const [values, setValues] = useState<HopDongFormValues>(hopDongRong);
  const [dangLuu, setDangLuu] = useState(false);

  useEffect(() => {
    if (!open) return;
    const moc = homNay();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNgayChot(moc);
    setValues({
      ...hopDongRong(),
      // Kế thừa điều khoản của hợp đồng đang chạy — đổi hợp đồng thường chỉ
      // thay số hiệu, thời hạn và mức lương, không thay toàn bộ.
      loai_hd: hopDongHienTai?.loai_hd ?? "xac_dinh",
      kieu_luong: hopDongHienTai?.kieu_luong ?? "GROSS",
      luong_chinh: hopDongHienTai?.luong_chinh ?? 0,
      luong_bhxh: hopDongHienTai?.luong_bhxh ?? 0,
      trich_bhxh: hopDongHienTai?.trich_bhxh ?? true,
      tinh_tncn: hopDongHienTai?.tinh_tncn ?? true,
      ngay_bat_dau: hopDongHienTai ? themNgay(moc, 1) : moc,
    });
  }, [open, hopDongHienTai]);

  const dat = <K extends keyof HopDongFormValues>(khoa: K, giaTri: HopDongFormValues[K]) =>
    setValues((cu) => ({ ...cu, [khoa]: giaTri }));

  const handleSubmit = async () => {
    setDangLuu(true);
    try {
      await doiHopDong(nhanVien.ma_nv, hopDongHienTai?.id ?? null, ngayChot, values);
      toast.success(
        hopDongHienTai
          ? `Đã chốt hợp đồng ${hopDongHienTai.so_hd} và ký hợp đồng mới.`
          : "Đã ký hợp đồng mới.",
      );
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, "Không thay đổi được hợp đồng."));
    } finally {
      setDangLuu(false);
    }
  };

  const oLuoi = {
    display: "grid",
    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" },
    gap: 2,
  } as const;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Tạo mới hợp đồng — {nhanVien.ho_ten}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {hopDongHienTai ? (
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                Chốt hợp đồng hiện tại
              </Typography>

              <Box sx={{ ...oLuoi, mb: 2.5 }}>
                <OThongTin nhan="Số hợp đồng" giaTri={hopDongHienTai.so_hd} />
                <OThongTin
                  nhan="Loại hợp đồng"
                  giaTri={nhan(LOAI_HD, hopDongHienTai.loai_hd)}
                />
                <OThongTin
                  nhan="Kiểu lương"
                  giaTri={nhan(KIEU_LUONG, hopDongHienTai.kieu_luong).split(" — ")[0]}
                />
                <OThongTin
                  nhan="Hiệu lực từ"
                  giaTri={ngayVn(hopDongHienTai.ngay_bat_dau)}
                />
                <OThongTin
                  nhan="Lương chính"
                  giaTri={`${tienVn(hopDongHienTai.luong_chinh)} ₫`}
                />
                <OThongTin
                  nhan="Lương đóng BHXH"
                  giaTri={`${tienVn(hopDongHienTai.luong_bhxh)} ₫`}
                />
              </Box>

              <TextField
                label="Ngày chốt hợp đồng"
                type="date"
                required
                size="small"
                value={ngayChot}
                onChange={(e) => setNgayChot(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                helperText="Ghi vào ngày kết thúc của hợp đồng hiện tại."
                sx={{ maxWidth: 260 }}
              />
            </Paper>
          ) : (
            <Alert severity="info">
              Nhân viên này chưa có hợp đồng nào — không có gì để chốt, chỉ tạo hợp đồng mới.
            </Alert>
          )}

          <Paper variant="outlined" sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
              Hợp đồng mới
            </Typography>

            <Box sx={oLuoi}>
              <TextField
                label="Số hợp đồng"
                required
                autoFocus
                size="small"
                value={values.so_hd}
                onChange={(e) => dat("so_hd", e.target.value)}
              />
              <TextField
                select
                label="Loại hợp đồng"
                size="small"
                value={values.loai_hd}
                onChange={(e) => dat("loai_hd", e.target.value as LoaiHopDong)}
              >
                {LOAI_HD.map((item) => (
                  <MenuItem key={item.value} value={item.value}>
                    {item.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Kiểu lương"
                size="small"
                value={values.kieu_luong}
                onChange={(e) => dat("kieu_luong", e.target.value as KieuLuong)}
              >
                {KIEU_LUONG.map((item) => (
                  <MenuItem key={item.value} value={item.value}>
                    {item.label}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Ngày bắt đầu"
                type="date"
                required
                size="small"
                value={values.ngay_bat_dau}
                onChange={(e) => dat("ngay_bat_dau", e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="Ngày kết thúc"
                type="date"
                size="small"
                value={values.ngay_ket_thuc}
                onChange={(e) => dat("ngay_ket_thuc", e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                helperText="Để trống nếu không xác định thời hạn."
              />
              <Box />

              {/* Không nằm trong mô tả nhưng bắt buộc phải có: bỏ đi thì hợp đồng
                  mới lưu với mức lương 0 đ mà không ai thấy. Điền sẵn theo hợp
                  đồng cũ để trường hợp chỉ gia hạn thì không phải gõ lại. */}
              <TienField
                label="Lương chính"
                value={values.luong_chinh}
                onChange={(v) => dat("luong_chinh", v)}
              />
              <TienField
                label="Lương đóng BHXH"
                value={values.luong_bhxh}
                onChange={(v) => dat("luong_bhxh", v)}
              />
              <Box />

              <Box sx={{ gridColumn: "1 / -1" }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={values.trich_bhxh}
                        onChange={(e) => dat("trich_bhxh", e.target.checked)}
                      />
                    }
                    label="Trích đóng BHXH"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={values.tinh_tncn}
                        onChange={(e) => dat("tinh_tncn", e.target.checked)}
                      />
                    }
                    label="Tính thuế TNCN"
                  />
                </Stack>
              </Box>

              <Box sx={{ gridColumn: "1 / -1" }}>
                <TextField
                  label="Ghi chú"
                  fullWidth
                  size="small"
                  value={values.ghi_chu}
                  onChange={(e) => dat("ghi_chu", e.target.value)}
                />
              </Box>
            </Box>
          </Paper>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>
          Hủy
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={dangLuu}
          sx={{ textTransform: "none" }}
        >
          Lưu
        </Button>
      </DialogActions>
    </Dialog>
  );
}
