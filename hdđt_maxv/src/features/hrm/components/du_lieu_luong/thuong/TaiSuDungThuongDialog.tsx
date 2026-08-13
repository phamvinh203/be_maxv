import { useMemo } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import { tienVn } from "../../../format";
import { nhanBanDongThuong, tongTienThuong } from "../../../thuong";
import { useBanThuongList, useKhoanThuongList } from "../../../mock/hooks/thuong";
import { useNhanVienList } from "../../../mock/hooks/nhanVien";
import type { DongThuong } from "../../../types";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Nhận bản sao bảng thưởng đã chọn — id sinh lại trước khi trả về. */
  onChon: (dong: DongThuong[]) => void;
}

/**
 * Chép lại bảng thưởng của một nhân viên đã áp trước đó.
 *
 * Thưởng lễ, thưởng tết thường giống nhau cho cả nhóm, chỉ khác vài người — mở
 * bảng của một người rồi sửa vài con số nhanh hơn nhiều so với thêm lại từng
 * khoản.
 */
export default function TaiSuDungThuongDialog({ open, onClose, onChon }: Props) {
  const banThuong = useBanThuongList();
  const nhanVien = useNhanVienList();
  const danhMuc = useKhoanThuongList();

  const danhSach = useMemo(() => {
    const tenNvTheoMa = new Map(nhanVien.map((nv) => [nv.ma_nv, nv.ho_ten]));
    const tenKhoanTheoMa = new Map(danhMuc.map((kl) => [kl.ma_khoan, kl.ten_khoan]));
    return banThuong
      .map((ban) => ({
        ma_nv: ban.ma_nv,
        ho_ten: tenNvTheoMa.get(ban.ma_nv) ?? ban.ma_nv,
        dong: ban.dong,
        tong: tongTienThuong(ban.dong),
        // Liệt kê tên khoản ngay ở dòng chọn — không phải bấm vào mới biết bảng
        // đó gồm những gì.
        tomTat: ban.dong.map((d) => tenKhoanTheoMa.get(d.ma_khoan) ?? d.ma_khoan).join(" · "),
      }))
      .sort((a, b) => a.ma_nv.localeCompare(b.ma_nv));
  }, [banThuong, nhanVien, danhMuc]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>Tái sử dụng bảng thưởng</DialogTitle>
      <Typography variant="body2" color="text.secondary" sx={{ px: 3, pb: 1 }}>
        Chọn một nhân viên để chép bảng thưởng của họ vào bảng đang soạn. Bảng đang soạn sẽ bị
        thay thế.
      </Typography>

      <DialogContent dividers sx={{ p: 0 }}>
        <List disablePadding>
          {danhSach.map((item) => (
            <ListItemButton
              key={item.ma_nv}
              onClick={() => {
                onChon(nhanBanDongThuong(item.dong));
                onClose();
              }}
            >
              <ListItemText
                primary={
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {item.ho_ten}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.ma_nv}
                    </Typography>
                    <Chip
                      size="small"
                      color="primary"
                      variant="outlined"
                      label={`${tienVn(item.tong)} ₫`}
                      sx={{ height: 20 }}
                    />
                  </Stack>
                }
                secondary={`${item.dong.length} khoản — ${item.tomTat}`}
                slotProps={{ secondary: { variant: "caption" } }}
              />
            </ListItemButton>
          ))}

          {danhSach.length === 0 && (
            <Typography
              variant="body2"
              color="text.disabled"
              sx={{ textAlign: "center", py: 5, px: 3 }}
            >
              Chưa có nhân viên nào được áp thưởng, nên chưa có bảng nào để tái sử dụng.
            </Typography>
          )}
        </List>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>
          Đóng
        </Button>
      </DialogActions>
    </Dialog>
  );
}
