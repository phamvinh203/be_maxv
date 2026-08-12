import { useEffect, useMemo, useState } from "react";
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
import { layConChau, sapXepCay } from "../../cay";
import { TRANG_THAI_PB } from "../../constants";
import { useLuuPhongBan, usePhongBanList } from "../../mock/hooks/phongBan";
import type { PhongBanRow, TrangThai } from "../../types";

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

  const [tenPb, setTenPb] = useState("");
  const [maPbMe, setMaPbMe] = useState("");
  const [ghiChu, setGhiChu] = useState("");
  const [status, setStatus] = useState<TrangThai>("1");
  const [dangLuu, setDangLuu] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Nạp lại form mỗi lần mở dialog — cố ý reset theo state ngoài.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTenPb(phongBan?.ten_pb ?? "");
    setMaPbMe(phongBan?.ma_pb_me ?? "");
    setGhiChu(phongBan?.ghi_chu ?? "");
    setStatus(phongBan?.status ?? "1");
  }, [open, phongBan]);

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

  const handleSubmit = async () => {
    setDangLuu(true);
    try {
      await luuPhongBan(
        { ten_pb: tenPb, ma_pb_me: maPbMe || null, ghi_chu: ghiChu, status },
        phongBan?.ma_pb,
      );
      toast.success(laSua ? "Đã cập nhật phòng ban." : "Đã thêm phòng ban.");
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, "Không lưu được phòng ban."));
    } finally {
      setDangLuu(false);
    }
  };

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
            value={tenPb}
            onChange={(e) => setTenPb(e.target.value)}
          />

          <TextField
            select
            label="Trực thuộc phòng ban"
            fullWidth
            size="small"
            value={maPbMe}
            onChange={(e) => setMaPbMe(e.target.value)}
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
            value={ghiChu}
            onChange={(e) => setGhiChu(e.target.value)}
          />

          {/* Chỉ có ở chế độ sửa — phòng ban mới luôn đang dùng. */}
          {laSua && (
            <TextField
              select
              label="Trạng thái"
              fullWidth
              size="small"
              value={status}
              onChange={(e) => setStatus(e.target.value as TrangThai)}
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
