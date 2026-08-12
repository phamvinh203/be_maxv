import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import { getErrorMessage } from "../../../../lib/errors";
import { nptRong } from "../../formDefaults";
import { useLuuNguoiPhuThuoc } from "../../mock/hooks/nguoiPhuThuoc";
import { useNhanVienList } from "../../mock/hooks/nhanVien";
import type { NguoiPhuThuoc, NguoiPhuThuocFormValues } from "../../types";
import NguoiPhuThuocForm from "./NguoiPhuThuocForm";

interface Props {
  open: boolean;
  onClose: () => void;
  /**
   * Nhân viên đã biết trước (mở từ tab trong hồ sơ nhân viên) — khi đó không
   * hiện ô chọn nhân viên. Bỏ trống là mở từ màn hình độc lập.
   */
  maNvCoDinh?: string;
  /** Có giá trị = sửa bản ghi này. */
  npt?: NguoiPhuThuoc;
}

export default function NguoiPhuThuocFormDialog({
  open,
  onClose,
  maNvCoDinh,
  npt,
}: Props) {
  const laSua = Boolean(npt);
  const nhanVien = useNhanVienList();
  const luuNpt = useLuuNguoiPhuThuoc();

  const [maNv, setMaNv] = useState("");
  const [values, setValues] = useState<NguoiPhuThuocFormValues>(nptRong);
  const [dangLuu, setDangLuu] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMaNv(npt?.ma_nv ?? maNvCoDinh ?? "");
    setValues(
      npt
        ? {
            ho_ten: npt.ho_ten,
            quan_he: npt.quan_he,
            ngay_sinh: npt.ngay_sinh,
            so_cccd: npt.so_cccd,
            mst_ca_nhan: npt.mst_ca_nhan,
            dien_thoai: npt.dien_thoai,
            dia_chi: npt.dia_chi,
            gt_tu_thang: npt.gt_tu_thang,
            gt_den_thang: npt.gt_den_thang,
          }
        : nptRong(),
    );
  }, [open, npt, maNvCoDinh]);

  const handleSubmit = async () => {
    setDangLuu(true);
    try {
      await luuNpt(maNv, values, npt?.id);
      toast.success(laSua ? "Đã cập nhật người phụ thuộc." : "Đã thêm người phụ thuộc.");
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, "Không lưu được người phụ thuộc."));
    } finally {
      setDangLuu(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{laSua ? "Sửa người phụ thuộc" : "Thêm người phụ thuộc"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          {/* Chỉ hiện khi mở từ màn hình độc lập — mở từ hồ sơ thì nhân viên đã xác định. */}
          {!maNvCoDinh && (
            <TextField
              select
              label="Nhân viên"
              required
              size="small"
              fullWidth
              value={maNv}
              onChange={(e) => setMaNv(e.target.value)}
              disabled={laSua}
              helperText={laSua ? "Không đổi được nhân viên của một bản ghi đã lưu." : undefined}
            >
              {nhanVien.map((nv) => (
                <MenuItem key={nv.ma_nv} value={nv.ma_nv}>
                  {nv.ma_nv} — {nv.ho_ten}
                </MenuItem>
              ))}
            </TextField>
          )}

          <NguoiPhuThuocForm values={values} onChange={setValues} />
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
          {laSua ? "Lưu thay đổi" : "Thêm người phụ thuộc"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
