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
import { nhanBanDongBuTru } from "../../../buTru";
import { tienVn } from "../../../format";
import { useAdjustmentDataList } from "../../../api/payrollInputsQueries";
import { useCurrentPayrollPeriod } from "../useCurrentPayrollPeriod";
import type { DongBuTru } from "../../../types";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Nhận bản sao bảng đã chọn — id sinh lại trước khi trả về. */
  onChon: (dong: DongBuTru[]) => void;
}

/**
 * Chép lại bảng ứng - bù trừ của một nhân viên đã áp trước đó **trong cùng kỳ lương đang chọn**.
 *
 * Hay dùng cho các khoản đồng loạt: cả tổ cùng trừ tiền cơm, cùng nhận bù chênh
 * lệch bảo hiểm — chép rồi sửa số tiền nhanh hơn chọn lại từng khoản.
 */
export default function TaiSuDungBuTruDialog({ open, onClose, onChon }: Props) {
  const { selectedPeriodId } = useCurrentPayrollPeriod();
  const { data: adjustmentData } = useAdjustmentDataList({ periodId: selectedPeriodId ?? "" });

  const danhSach = useMemo(() => {
    return (adjustmentData ?? [])
      .filter((ban) => ban.records.length > 0)
      .map((ban) => {
        const dong: DongBuTru[] = ban.records.map((r) => ({
          id: r.id,
          ma_bt: r.adjustmentItem?.code ?? r.adjustmentItemId,
          so_tien: r.amount,
        }));
        return {
          ma_nv: ban.ma_nv,
          ho_ten: ban.ho_ten,
          dong,
          tong: ban.netAdjustment,
          // Liệt kê tên khoản ngay ở dòng chọn — không phải bấm vào mới biết bảng
          // đó gồm những gì.
          tomTat: ban.records
            .map((r) => r.adjustmentItem?.name ?? r.adjustmentItemId)
            .join(" · "),
        };
      })
      .sort((a, b) => a.ma_nv.localeCompare(b.ma_nv));
  }, [adjustmentData]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>Tái sử dụng bảng ứng - bù trừ</DialogTitle>
      <Typography variant="body2" color="text.secondary" sx={{ px: 3, pb: 1 }}>
        Chọn một nhân viên đã có khoản bù trừ trong kỳ lương này để chép bảng của họ vào bảng
        đang soạn. Bảng đang soạn sẽ bị thay thế.
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
              Chưa có nhân viên nào được áp khoản bù trừ trong kỳ này, nên chưa có bảng nào để
              tái sử dụng.
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
