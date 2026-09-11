import { useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import { nptRong } from "../../_shared/formDefaults";
import { useLuuNguoiPhuThuoc } from "../../api/du_lieu_nhan_vien/nguoiPhuThuocQueries";
// Phải là danh sách nhân viên THẬT: BE chặn ma_nv không tồn tại, chọn từ mock sẽ lưu lỗi 404.
import { useNhanVienList } from "../../api/du_lieu_nhan_vien/nhanVienQueries";
import type { NguoiPhuThuoc, NguoiPhuThuocFormValues } from "../../types";
import { useFormDialog } from "../useFormDialog";
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

  // `maNv` nằm NGOÀI `values`: chỉ có ô chọn khi mở từ màn hình độc lập, và không đổi được
  // sau khi đã lưu — tách riêng cho rõ, không lẫn vào giá trị của form người phụ thuộc.
  const [maNv, setMaNv] = useState("");
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- nạp lại mỗi lần mở, cố ý reset theo state ngoài
    setMaNv(npt?.ma_nv ?? maNvCoDinh ?? "");
  }, [open, npt, maNvCoDinh]);

  const { values, setValues, dangLuu, handleSubmit } = useFormDialog<NguoiPhuThuocFormValues>({
    open,
    onClose,
    khoiTao: () =>
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
    // RVW-A08: trước đây bấm Lưu với ô trống tốn 1 round-trip mới nhận lỗi 400 chung chung.
    soat: (v) => {
      if (!maNvCoDinh && !maNv) return "Chọn nhân viên.";
      if (!v.ho_ten.trim()) return "Nhập họ tên.";
      return undefined;
    },
    luu: (v) => luuNpt(maNv, v, npt?.id),
    thongBaoThanhCong: laSua ? "Đã cập nhật người phụ thuộc." : "Đã thêm người phụ thuộc.",
    thongBaoLoiMacDinh: "Không lưu được người phụ thuộc.",
  });

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
