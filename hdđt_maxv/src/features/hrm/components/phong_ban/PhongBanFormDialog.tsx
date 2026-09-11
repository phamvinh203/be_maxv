import { useMemo } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import { layConChau, sapXepCay } from "../../_shared/cay";
import { TRANG_THAI_PB } from "../../_shared/constants";
import { useLuuPhongBan, usePhongBanList } from "../../api/du_lieu_nhan_vien/phongBanQueries";
import type { PhongBanRow, TrangThai } from "../../types";
import { useFormDialog } from "../useFormDialog";

interface PhongBanFormValues {
  ten_pb: string;
  ma_pb_me: string;
  ghi_chu: string;
  status: TrangThai;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Có giá trị = sửa phòng ban này; không có = thêm mới. */
  phongBan?: PhongBanRow;
}

export default function PhongBanFormDialog({ open, onClose, phongBan }: Props) {
  const laSua = Boolean(phongBan);
  const danhSach = usePhongBanList();
  const luuPhongBan = useLuuPhongBan();

  const { values, dat, dangLuu, handleSubmit } = useFormDialog<PhongBanFormValues>({
    open,
    onClose,
    khoiTao: () => ({
      ten_pb: phongBan?.ten_pb ?? "",
      ma_pb_me: phongBan?.ma_pb_me ?? "",
      ghi_chu: phongBan?.ghi_chu ?? "",
      status: phongBan?.status ?? "1",
    }),
    // RVW-A08: trước đây bấm Lưu với tên phòng ban trống tốn 1 round-trip mới nhận lỗi 400 chung chung.
    soat: (v) => (v.ten_pb.trim() ? undefined : "Nhập tên phòng ban."),
    luu: (v) =>
      luuPhongBan(
        { ten_pb: v.ten_pb, ma_pb_me: v.ma_pb_me || null, ghi_chu: v.ghi_chu, status: v.status },
        phongBan?.ma_pb,
      ),
    thongBaoThanhCong: laSua ? "Đã cập nhật phòng ban." : "Đã thêm phòng ban.",
    thongBaoLoiMacDinh: "Không lưu được phòng ban.",
  });

  /**
   * Ô "Trực thuộc" phải loại chính nó và toàn bộ nhánh dưới: cho một phòng ban
   * trực thuộc con cháu của nó sẽ tạo ra nhánh treo, không còn nối về gốc.
   */
  const luaChonCha = useMemo(() => {
    const caysapXep = sapXepCay(danhSach);
    if (!phongBan) return caysapXep;
    const loai = layConChau(danhSach, phongBan.ma_pb);
    return caysapXep.filter((pb) => pb.ma_pb !== phongBan.ma_pb && !loai.has(pb.ma_pb));
  }, [danhSach, phongBan]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{laSua ? `Sửa phòng ban ${phongBan?.ma_pb}` : "Thêm phòng ban"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <TextField
            label="Tên phòng ban"
            required
            autoFocus
            fullWidth
            size="small"
            value={values.ten_pb}
            onChange={(e) => dat("ten_pb", e.target.value)}
          />

          <TextField
            select
            label="Trực thuộc phòng ban"
            fullWidth
            size="small"
            value={values.ma_pb_me}
            onChange={(e) => dat("ma_pb_me", e.target.value)}
            helperText="Để trống nếu đây là phòng ban cấp cao nhất."
          >
            <MenuItem value="">
              <em>— Không trực thuộc —</em>
            </MenuItem>
            {luaChonCha.map((pb) => (
              <MenuItem key={pb.ma_pb} value={pb.ma_pb}>
                {/* Thụt lề bằng khoảng trắng cứng để thấy được cấp ngay trong Select. */}
                {" ".repeat((pb.cap - 1) * 4)}
                {pb.ten_pb}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Mô tả"
            fullWidth
            multiline
            minRows={2}
            size="small"
            value={values.ghi_chu}
            onChange={(e) => dat("ghi_chu", e.target.value)}
          />

          {/* Chỉ có ở chế độ sửa — phòng ban mới luôn đang dùng. */}
          {laSua && (
            <TextField
              select
              label="Trạng thái"
              fullWidth
              size="small"
              value={values.status}
              onChange={(e) => dat("status", e.target.value as TrangThai)}
              helperText="Ngừng dùng để giữ lại phòng ban đã giải thể mà vẫn còn dính chứng từ cũ."
            >
              {TRANG_THAI_PB.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
          )}
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
          {laSua ? "Lưu thay đổi" : "Thêm phòng ban"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
