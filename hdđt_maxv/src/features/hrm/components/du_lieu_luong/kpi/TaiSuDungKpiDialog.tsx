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
import { hieuSuat, mauHieuSuat, nhanBanDongKpi } from "../../../kpi";
import { useBanKpiList, useChiTieuKpiList } from "../../../mock/hooks/kpi";
import { useNhanVienList } from "../../../mock/hooks/nhanVien";
import type { DongKpi } from "../../../types";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Nhận bản sao bảng KPI đã chọn — id sinh lại trước khi trả về. */
  onChon: (dong: DongKpi[]) => void;
}

/**
 * Chép lại bảng KPI của một nhân viên đã áp trước đó.
 *
 * Phần lớn nhân viên cùng phòng dùng chung bộ chỉ tiêu, chỉ khác mục tiêu — mở
 * bảng của một người rồi sửa vài con số nhanh hơn nhiều so với thêm lại từng
 * dòng, và không sót chỉ tiêu nào.
 */
export default function TaiSuDungKpiDialog({ open, onClose, onChon }: Props) {
  const banKpi = useBanKpiList();
  const nhanVien = useNhanVienList();
  const danhMuc = useChiTieuKpiList();

  const danhSach = useMemo(() => {
    const tenNvTheoMa = new Map(nhanVien.map((nv) => [nv.ma_nv, nv.ho_ten]));
    const tenKpiTheoMa = new Map(danhMuc.map((ct) => [ct.ma_kpi, ct.ten_kpi]));
    return banKpi
      .map((ban) => ({
        ma_nv: ban.ma_nv,
        ho_ten: tenNvTheoMa.get(ban.ma_nv) ?? ban.ma_nv,
        dong: ban.dong,
        hieu_suat: hieuSuat(ban.dong),
        // Liệt kê tên chỉ tiêu ngay ở dòng chọn — không phải bấm vào mới biết
        // bảng đó gồm những gì.
        tomTat: ban.dong.map((d) => tenKpiTheoMa.get(d.ma_kpi) ?? d.ma_kpi).join(" · "),
      }))
      .sort((a, b) => a.ma_nv.localeCompare(b.ma_nv));
  }, [banKpi, nhanVien, danhMuc]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>Tái sử dụng bảng KPI</DialogTitle>
      <Typography variant="body2" color="text.secondary" sx={{ px: 3, pb: 1 }}>
        Chọn một nhân viên để chép bảng KPI của họ vào bảng đang soạn. Bảng đang soạn sẽ bị thay
        thế.
      </Typography>

      <DialogContent dividers sx={{ p: 0 }}>
        <List disablePadding>
          {danhSach.map((item) => (
            <ListItemButton
              key={item.ma_nv}
              onClick={() => {
                onChon(nhanBanDongKpi(item.dong));
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
                      color={mauHieuSuat(item.hieu_suat)}
                      variant="outlined"
                      label={`${item.hieu_suat}%`}
                      sx={{ height: 20 }}
                    />
                  </Stack>
                }
                secondary={`${item.dong.length} chỉ tiêu — ${item.tomTat}`}
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
              Chưa có nhân viên nào được áp KPI, nên chưa có bảng nào để tái sử dụng.
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
