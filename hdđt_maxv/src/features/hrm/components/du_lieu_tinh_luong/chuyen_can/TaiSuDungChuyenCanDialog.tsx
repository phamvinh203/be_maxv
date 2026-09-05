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
import { nhanBanDongChuyenCan, tongGioChuyenCan } from "../../../chuyenCan";
import { ngayVn } from "../../../format";
import {
  useBanChuyenCanList,
  useLoaiChuyenCanList,
} from "../../../mock/hooks/chuyenCan";
import { useNhanVienList } from "../../../mock/hooks/nhanVien";
import type { DongChuyenCan } from "../../../types";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Nhận bản sao bảng đã chọn — id sinh lại trước khi trả về. */
  onChon: (dong: DongChuyenCan[]) => void;
}

/**
 * Chép lại bảng chuyên cần của một nhân viên đã áp trước đó.
 *
 * Ở màn này hay dùng cho trường hợp cả tổ nghỉ chung một hôm (mất điện, họp đột
 * xuất) — chép bảng của một người rồi áp cho cả nhóm nhanh hơn gõ lại từng dòng.
 */
export default function TaiSuDungChuyenCanDialog({ open, onClose, onChon }: Props) {
  const banList = useBanChuyenCanList();
  const nhanVien = useNhanVienList();
  const danhMuc = useLoaiChuyenCanList();

  const danhSach = useMemo(() => {
    const tenNvTheoMa = new Map(nhanVien.map((nv) => [nv.ma_nv, nv.ho_ten]));
    const tenLoaiTheoMa = new Map(danhMuc.map((cc) => [cc.ma_cc, cc.ten_cc]));
    return banList
      .map((ban) => ({
        ma_nv: ban.ma_nv,
        ho_ten: tenNvTheoMa.get(ban.ma_nv) ?? ban.ma_nv,
        dong: ban.dong,
        gio: tongGioChuyenCan(ban.dong),
        // Liệt kê lỗi kèm ngày ngay ở dòng chọn — không phải bấm vào mới biết
        // bảng đó gồm những gì.
        tomTat:
          ban.dong.length === 0
            ? "Không vi phạm — nhận đủ chuyên cần"
            : ban.dong
                .map((d) => `${tenLoaiTheoMa.get(d.ma_cc) ?? d.ma_cc} ${ngayVn(d.ngay)}`)
                .join(" · "),
      }))
      .sort((a, b) => a.ma_nv.localeCompare(b.ma_nv));
  }, [banList, nhanVien, danhMuc]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>Tái sử dụng bảng chuyên cần</DialogTitle>
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
                onChon(nhanBanDongChuyenCan(item.dong));
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
                      color={item.dong.length === 0 ? "success" : "warning"}
                      label={
                        item.dong.length === 0
                          ? "Không vi phạm"
                          : `${item.dong.length} lần · ${item.gio}h`
                      }
                      sx={{ height: 20 }}
                    />
                  </Stack>
                }
                secondary={item.tomTat}
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
              Chưa có nhân viên nào được áp chuyên cần, nên chưa có bảng nào để tái sử dụng.
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
