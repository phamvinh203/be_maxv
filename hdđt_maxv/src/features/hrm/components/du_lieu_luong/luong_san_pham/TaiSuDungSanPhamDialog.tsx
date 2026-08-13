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
import { nhanBanDongSanPham, tongTienSanPham } from "../../../luongSanPham";
import {
  useBanLuongSanPhamList,
  useSanPhamList,
} from "../../../mock/hooks/luongSanPham";
import { useNhanVienList } from "../../../mock/hooks/nhanVien";
import type { DongLuongSanPham } from "../../../types";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Nhận bản sao bảng đã chọn — id sinh lại trước khi trả về. */
  onChon: (dong: DongLuongSanPham[]) => void;
}

/**
 * Chép lại bảng lương sản phẩm của một nhân viên đã áp trước đó.
 *
 * Cả tổ thường nghiệm thu cùng loại sản phẩm, chỉ khác số lượng — chép rồi sửa
 * cột số lượng nhanh hơn nhiều so với chọn lại từng sản phẩm và gõ lại đơn giá.
 */
export default function TaiSuDungSanPhamDialog({ open, onClose, onChon }: Props) {
  const banList = useBanLuongSanPhamList();
  const nhanVien = useNhanVienList();
  const danhMuc = useSanPhamList();

  const danhSach = useMemo(() => {
    const tenNvTheoMa = new Map(nhanVien.map((nv) => [nv.ma_nv, nv.ho_ten]));
    const tenSpTheoMa = new Map(danhMuc.map((sp) => [sp.ma_sp, sp.ten_sp]));
    return banList
      .map((ban) => ({
        ma_nv: ban.ma_nv,
        ho_ten: tenNvTheoMa.get(ban.ma_nv) ?? ban.ma_nv,
        dong: ban.dong,
        tong: tongTienSanPham(ban.dong),
        // Liệt kê tên sản phẩm ngay ở dòng chọn — không phải bấm vào mới biết
        // bảng đó gồm những gì.
        tomTat: ban.dong.map((d) => tenSpTheoMa.get(d.ma_sp) ?? d.ma_sp).join(" · "),
      }))
      .sort((a, b) => a.ma_nv.localeCompare(b.ma_nv));
  }, [banList, nhanVien, danhMuc]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>Tái sử dụng bảng lương sản phẩm</DialogTitle>
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
                onChon(nhanBanDongSanPham(item.dong));
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
                secondary={`${item.dong.length} sản phẩm — ${item.tomTat}`}
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
              Chưa có nhân viên nào được áp lương sản phẩm, nên chưa có bảng nào để tái sử dụng.
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
