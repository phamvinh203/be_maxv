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
import { tienVn } from "../../../_shared/format";
import { nhanBanDongPhanTram, tongTienPhanTram } from "../../../calculations/du_lieu_tinh_luong/luongPhanTram";
import { useCommissionDataList } from "../../../api/du_lieu_tinh_luong/payrollInputsQueries";
import { useCurrentPayrollPeriod } from "../useCurrentPayrollPeriod";
import type { DongLuongPhanTram } from "../../../types";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Nhận bản sao bảng đã chọn — id sinh lại trước khi trả về. */
  onChon: (dong: DongLuongPhanTram[]) => void;
}

/**
 * Chép lại bảng lương phần trăm của một nhân viên đã áp trước đó **trong cùng kỳ lương đang
 * chọn**.
 *
 * Cả khối kinh doanh thường ăn cùng bộ loại % với cùng tỷ lệ, chỉ khác doanh số
 * — chép rồi sửa cột số tiền cơ sở nhanh hơn nhiều so với chọn lại từng khoản.
 */
export default function TaiSuDungPhanTramDialog({ open, onClose, onChon }: Props) {
  const { selectedPeriodId } = useCurrentPayrollPeriod();
  const { data: commissionData } = useCommissionDataList({ periodId: selectedPeriodId ?? "" });

  const danhSach = useMemo(() => {
    return (commissionData ?? [])
      .filter((ban) => ban.records.length > 0)
      .map((ban) => {
        const dong: DongLuongPhanTram[] = ban.records.map((r) => ({
          id: r.id,
          ma_khoan: r.salaryItem?.code ?? r.salaryItemId,
          ty_le: r.commissionRate,
          so_tien_co_so: r.baseAmount,
        }));
        return {
          ma_nv: ban.ma_nv,
          ho_ten: ban.ho_ten,
          dong,
          tong: tongTienPhanTram(dong),
          // Liệt kê tên khoản kèm tỷ lệ ngay ở dòng chọn — không phải bấm vào mới
          // biết bảng đó gồm những gì.
          tomTat: ban.records
            .map((r) => `${r.salaryItem?.name ?? r.salaryItemId} ${r.commissionRate}%`)
            .join(" · "),
        };
      })
      .sort((a, b) => a.ma_nv.localeCompare(b.ma_nv));
  }, [commissionData]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>Tái sử dụng bảng lương phần trăm</DialogTitle>
      <Typography variant="body2" color="text.secondary" sx={{ px: 3, pb: 1 }}>
        Chọn một nhân viên đã có lương phần trăm trong kỳ lương này để chép bảng của họ vào bảng
        đang soạn. Bảng đang soạn sẽ bị thay thế.
      </Typography>

      <DialogContent dividers sx={{ p: 0 }}>
        <List disablePadding>
          {danhSach.map((item) => (
            <ListItemButton
              key={item.ma_nv}
              onClick={() => {
                onChon(nhanBanDongPhanTram(item.dong));
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
              Chưa có nhân viên nào được áp lương phần trăm trong kỳ này, nên chưa có bảng nào để
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
