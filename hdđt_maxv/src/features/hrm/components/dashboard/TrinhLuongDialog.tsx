import { useMemo } from "react";
import { toast } from "react-toastify";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import SendRounded from "@mui/icons-material/SendRounded";
import { getApiError } from "@/lib/apiClient";
import { tongKyLuong } from "../../calculations/dashboard/tongQuan";
import { usePayrollSheetLinesQuery } from "../../api/du_lieu_tinh_luong/payrollCalculationQueries";
import {
  useSubmitPayrollPeriod,
  type PayrollPeriodApiItem,
} from "../../api/du_lieu_tinh_luong/payrollPeriodsQueries";
import { DUONG_DAN, useMoManKyLuong } from "./dieuHuong";
import { tienDayDu } from "./dinhDang";

interface Props {
  open: boolean;
  ky: PayrollPeriodApiItem | null;
  onClose: () => void;
}

/**
 * Trình duyệt kỳ lương ngay từ Dashboard (DRAFT → PENDING_REVIEW, cùng `POST .../submit` với nút
 * "Trình duyệt" ở màn Chốt kỳ lương — `chot_ky_luong/VongDoiKyLuong`).
 *
 * Hiện tổng bảng lương TRƯỚC khi bấm để người trình biết mình đang gửi đi con số nào — trình mù
 * một kỳ chưa kiểm là thứ thao tác nhanh không được khuyến khích. Muốn soát từng dòng thì nút
 * "Xem bảng lương" mở đúng kỳ này.
 */
export default function TrinhLuongDialog({ open, ky, onClose }: Props) {
  const { data, isLoading, isError, error } = usePayrollSheetLinesQuery(open ? (ky?.id ?? null) : null);
  const tong = useMemo(() => tongKyLuong(data ?? []), [data]);
  const trinh = useSubmitPayrollPeriod();
  const moKy = useMoManKyLuong();

  const handleTrinh = async () => {
    if (!ky) return;
    try {
      await trinh.mutateAsync(ky.id);
      toast.success(`Đã trình duyệt ${ky.name}.`);
      onClose();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  return (
    <Dialog open={open} onClose={trinh.isPending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Trình duyệt {ky?.name ?? "kỳ lương"}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Kỳ lương chuyển sang <strong>Chờ duyệt</strong>. Trong lúc chờ, dữ liệu tính lương của kỳ
          chỉ đọc; người duyệt khóa sổ để chốt số hoặc trả kỳ về bản nháp.
        </Typography>

        {isError ? (
          <Alert severity="warning">
            Không tính được bảng lương của kỳ: {getApiError(error)} Nên mở bảng lương kiểm tra
            trước khi trình.
          </Alert>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              rowGap: 1,
              columnGap: 2,
              p: 1.5,
              borderRadius: 1,
              bgcolor: "action.hover",
            }}
          >
            <DongTong nhan="Số nhân viên" giaTri={isLoading ? null : `${tong.soNhanVien}`} />
            <DongTong nhan="Tổng thu nhập" giaTri={isLoading ? null : tienDayDu(tong.thuNhap)} />
            <DongTong nhan="Thực lĩnh" giaTri={isLoading ? null : tienDayDu(tong.thucLinh)} />
            <DongTong nhan="Quỹ lương" giaTri={isLoading ? null : tienDayDu(tong.quyLuong)} dam />
          </Box>
        )}

        {!isLoading && !isError && tong.soNhanVien === 0 && (
          <Alert severity="info" sx={{ mt: 1.5 }}>
            Kỳ này chưa có dòng lương nào — kiểm tra lại set lương và chấm công trước khi trình.
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={trinh.isPending} sx={{ textTransform: "none", mr: "auto" }}>
          Hủy
        </Button>
        <Button
          variant="outlined"
          onClick={() => moKy(DUONG_DAN.bangLuong, ky)}
          disabled={!ky || trinh.isPending}
          sx={{ textTransform: "none" }}
        >
          Xem bảng lương
        </Button>
        <Button
          variant="contained"
          startIcon={<SendRounded />}
          onClick={handleTrinh}
          disabled={!ky || trinh.isPending}
          sx={{ textTransform: "none" }}
        >
          Trình duyệt
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function DongTong({ nhan, giaTri, dam }: { nhan: string; giaTri: string | null; dam?: boolean }) {
  return (
    <>
      <Typography variant="body2" color="text.secondary">
        {nhan}
      </Typography>
      {giaTri === null ? (
        <Skeleton width={110} />
      ) : (
        <Typography
          variant="body2"
          sx={{ fontWeight: dam ? 700 : 600, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
        >
          {giaTri}
        </Typography>
      )}
    </>
  );
}
