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
import { moTaLoaiTangCa } from "../../../constants";
import { gioVn, mauGioTangCa, nhanBanDongTangCa } from "../../../tangCa";
import { useCauHinh } from "../../../api/cauHinhQueries";
import { useOvertimeList } from "../../../api/payrollInputsQueries";
import { useCurrentPayrollPeriod } from "../useCurrentPayrollPeriod";
import type { DongTangCa } from "../../../types";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Nhận bản sao bảng tăng ca đã chọn — id sinh lại trước khi trả về. */
  onChon: (dong: DongTangCa[]) => void;
}

/**
 * Chép lại bảng tăng ca của một nhân viên đã áp trước đó **trong cùng kỳ lương đang chọn**.
 *
 * Cả tổ thường tăng ca cùng buổi nên bảng giờ giống nhau — chép rồi sửa vài số
 * nhanh hơn và không sót loại giờ nào.
 */
export default function TaiSuDungTangCaDialog({ open, onClose, onChon }: Props) {
  const { selectedPeriodId } = useCurrentPayrollPeriod();
  const { data: otData } = useOvertimeList({ periodId: selectedPeriodId ?? "" });
  const cauHinh = useCauHinh();

  const danhSach = useMemo(() => {
    return (otData ?? [])
      .filter((ban) => ban.records.length > 0)
      .map((ban) => {
        const dong: DongTangCa[] = ban.records.map((r) => ({
          id: r.id,
          loai: r.otType,
          so_gio: r.hours,
        }));
        return {
          ma_nv: ban.ma_nv,
          ho_ten: ban.ho_ten,
          dong,
          tong: ban.totalHours,
          // Liệt kê loại giờ ngay ở dòng chọn — không phải bấm vào mới biết bảng
          // đó gồm những gì.
          tomTat: dong
            .map((d) => (d.loai ? `${moTaLoaiTangCa(d.loai).label} ${gioVn(d.so_gio)}h` : "—"))
            .join(" · "),
        };
      })
      .sort((a, b) => a.ma_nv.localeCompare(b.ma_nv));
  }, [otData]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>Tái sử dụng bảng tăng ca</DialogTitle>
      <Typography variant="body2" color="text.secondary" sx={{ px: 3, pb: 1 }}>
        Chọn một nhân viên đã có tăng ca trong kỳ lương này để chép bảng của họ vào bảng đang
        soạn. Bảng đang soạn sẽ bị thay thế.
      </Typography>

      <DialogContent dividers sx={{ p: 0 }}>
        <List disablePadding>
          {danhSach.map((item) => (
            <ListItemButton
              key={item.ma_nv}
              onClick={() => {
                onChon(nhanBanDongTangCa(item.dong));
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
                      color={mauGioTangCa(item.tong, cauHinh.gioi_han_tc_thang)}
                      label={`${gioVn(item.tong)}h`}
                      sx={{ height: 20 }}
                    />
                  </Stack>
                }
                secondary={`${item.dong.length} dòng — ${item.tomTat}`}
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
              Chưa có nhân viên nào được áp tăng ca trong kỳ này, nên chưa có bảng nào để tái sử
              dụng.
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
