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
import { nhanBanDongBuTru, tongBiTru } from "../../../buTru";
import { tienVn } from "../../../format";
import { useBanBuTruList, useKhoanBuTruList } from "../../../mock/hooks/buTru";
import { useNhanVienList } from "../../../mock/hooks/nhanVien";
import type { DongBuTru } from "../../../types";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Nhận bản sao bảng đã chọn — id sinh lại trước khi trả về. */
  onChon: (dong: DongBuTru[]) => void;
}

/**
 * Chép lại bảng ứng - bù trừ của một nhân viên đã áp trước đó.
 *
 * Hay dùng cho các khoản đồng loạt: cả tổ cùng trừ tiền cơm, cùng nhận bù chênh
 * lệch bảo hiểm — chép rồi sửa số tiền nhanh hơn chọn lại từng khoản.
 */
export default function TaiSuDungBuTruDialog({ open, onClose, onChon }: Props) {
  const banList = useBanBuTruList();
  const nhanVien = useNhanVienList();
  const danhMuc = useKhoanBuTruList();

  const danhSach = useMemo(() => {
    const tenNvTheoMa = new Map(nhanVien.map((nv) => [nv.ma_nv, nv.ho_ten]));
    const khoanTheoMa = new Map(danhMuc.map((bt) => [bt.ma_bt, bt]));
    return banList
      .map((ban) => ({
        ma_nv: ban.ma_nv,
        ho_ten: tenNvTheoMa.get(ban.ma_nv) ?? ban.ma_nv,
        dong: ban.dong,
        tong: tongBiTru(ban.dong, khoanTheoMa),
        // Liệt kê tên khoản ngay ở dòng chọn — không phải bấm vào mới biết bảng
        // đó gồm những gì.
        tomTat: ban.dong
          .map((d) => khoanTheoMa.get(d.ma_bt)?.ten_bt ?? d.ma_bt)
          .join(" · "),
      }))
      .sort((a, b) => a.ma_nv.localeCompare(b.ma_nv));
  }, [banList, nhanVien, danhMuc]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>Tái sử dụng bảng ứng - bù trừ</DialogTitle>
      <Typography variant="body2" color="text.secondary" sx={{ px: 3, pb: 1 }}>
        Chọn một nhân viên để chép bảng của họ vào bảng đang soạn. Bảng đang soạn sẽ bị thay
        thế.
      </Typography>

      <DialogContent dividers sx={{ p: 0 }}>
        <List disablePadding>
          {danhSach.map((item) => (
            <ListItemButton
              key={item.ma_nv}
              onClick={() => {
                onChon(nhanBanDongBuTru(item.dong));
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
                      variant="outlined"
                      color={item.tong > 0 ? "error" : item.tong < 0 ? "success" : "default"}
                      label={
                        item.tong >= 0
                          ? `− ${tienVn(item.tong)} ₫`
                          : `+ ${tienVn(-item.tong)} ₫`
                      }
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
              Chưa có nhân viên nào được áp khoản bù trừ, nên chưa có bảng nào để tái sử dụng.
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
