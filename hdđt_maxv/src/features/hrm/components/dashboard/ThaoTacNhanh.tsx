import { useState, type ReactNode } from "react";
import { toast } from "react-toastify";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import PersonAddAlt1Rounded from "@mui/icons-material/PersonAddAlt1Rounded";
import EventAvailableRounded from "@mui/icons-material/EventAvailableRounded";
import MoreTimeRounded from "@mui/icons-material/MoreTimeRounded";
import SendRounded from "@mui/icons-material/SendRounded";
import { getApiError } from "@/lib/apiClient";
import { tenKyMacDinh, TRANG_THAI_KY } from "../../_shared/constants";
import { thangCua } from "../../calculations/dashboard/tongQuan";
import type { KyLuongDashboard } from "../../api/dashboard/dashboardQueries";
import { useCreatePayrollPeriod } from "../../api/du_lieu_tinh_luong/payrollPeriodsQueries";
import { DUONG_DAN, useMoManKyLuong } from "./dieuHuong";
import TheDashboard from "./TheDashboard";
import TrinhLuongDialog from "./TrinhLuongDialog";

interface Props {
  homNay: string;
  ky: KyLuongDashboard;
  onThemNhanVien: () => void;
}

/** Màn nhập liệu cần kỳ của tháng này mà kỳ đó chưa tạo — hỏi tạo luôn thay vì đẩy sang kỳ khác. */
interface ManCanKy {
  duongDan: string;
  tenMan: string;
}

/**
 * Bốn lối tắt dùng hằng ngày. Ba lối tắt sau thuộc nhóm lương: người không có quyền xem lương
 * thấy nút mờ kèm lý do, không phải bấm vào rồi mới ăn 403.
 */
export default function ThaoTacNhanh({ homNay, ky, onThemNhanVien }: Props) {
  const moKy = useMoManKyLuong();
  const { nam, thang } = thangCua(homNay);
  const [canTaoKy, setCanTaoKy] = useState<ManCanKy | null>(null);
  const [moTrinh, setMoTrinh] = useState(false);

  const lyDoKhoaLuong = ky.biTuChoi
    ? "Cần quyền xem dữ liệu lương"
    : ky.isLoading
      ? "Đang tải kỳ lương…"
      : ky.loi
        ? "Không tải được kỳ lương"
        : null;

  const moTaKyThangNay = ky.kyThangNay
    ? `${ky.kyThangNay.name} · ${TRANG_THAI_KY[ky.kyThangNay.status].nhan}`
    : `Chưa có kỳ tháng ${thang}/${nam} — bấm để tạo`;

  const moManNhapLieu = (man: ManCanKy) => {
    if (ky.kyThangNay) moKy(man.duongDan, ky.kyThangNay.id);
    else setCanTaoKy(man);
  };

  const moTaTrinh = ky.kyNenTrinh
    ? `${ky.kyNenTrinh.name} · sẵn sàng trình duyệt`
    : ky.kyThangNay?.status === "PENDING_REVIEW"
      ? `${ky.kyThangNay.name} đã trình, đang chờ duyệt`
      : "Không có kỳ nháp nào để trình";

  return (
    <TheDashboard tieuDe="Thao tác nhanh" phuDe={`Tháng ${thang}/${nam}`}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(4, 1fr)" },
          gap: 1.5,
        }}
      >
        <OThaoTac
          icon={<PersonAddAlt1Rounded />}
          tieuDe="Thêm nhân viên mới"
          moTa="Hồ sơ, hợp đồng, người phụ thuộc"
          onClick={onThemNhanVien}
        />
        <OThaoTac
          icon={<EventAvailableRounded />}
          tieuDe="Chấm công tháng này"
          moTa={lyDoKhoaLuong ?? moTaKyThangNay}
          disabled={Boolean(lyDoKhoaLuong)}
          onClick={() => moManNhapLieu({ duongDan: DUONG_DAN.chamCong, tenMan: "chấm công" })}
        />
        <OThaoTac
          icon={<MoreTimeRounded />}
          tieuDe="Nhập tăng ca"
          moTa={lyDoKhoaLuong ?? moTaKyThangNay}
          disabled={Boolean(lyDoKhoaLuong)}
          onClick={() => moManNhapLieu({ duongDan: DUONG_DAN.tangCa, tenMan: "tăng ca" })}
        />
        <OThaoTac
          icon={<SendRounded />}
          tieuDe="Trình lương"
          moTa={lyDoKhoaLuong ?? moTaTrinh}
          disabled={Boolean(lyDoKhoaLuong) || !ky.kyNenTrinh}
          onClick={() => setMoTrinh(true)}
        />
      </Box>

      <TaoKyThangNayDialog
        man={canTaoKy}
        nam={nam}
        thang={thang}
        onClose={() => setCanTaoKy(null)}
        onDaTao={(id, man) => {
          setCanTaoKy(null);
          moKy(man.duongDan, id);
        }}
      />
      <TrinhLuongDialog open={moTrinh} ky={ky.kyNenTrinh} onClose={() => setMoTrinh(false)} />
    </TheDashboard>
  );
}

function OThaoTac({
  icon,
  tieuDe,
  moTa,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  tieuDe: string;
  moTa: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <ButtonBase
      focusRipple
      disabled={disabled}
      onClick={onClick}
      sx={(theme) => ({
        justifyContent: "flex-start",
        textAlign: "left",
        gap: 1.5,
        p: 1.5,
        borderRadius: 2,
        border: 1,
        borderColor: "divider",
        transition: "border-color .15s, background-color .15s",
        "&:hover": { borderColor: "primary.main", bgcolor: alpha(theme.palette.primary.main, 0.04) },
        "&.Mui-disabled": { opacity: 0.6 },
      })}
    >
      <Box
        sx={(theme) => ({
          width: 42,
          height: 42,
          flexShrink: 0,
          borderRadius: 2,
          display: "grid",
          placeItems: "center",
          color: "primary.main",
          bgcolor: alpha(theme.palette.primary.main, 0.1),
        })}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography component="span" variant="body1" sx={{ display: "block", fontWeight: 600 }}>
          {tieuDe}
        </Typography>
        <Typography component="span" variant="caption" color="text.secondary" sx={{ display: "block" }}>
          {moTa}
        </Typography>
      </Box>
    </ButtonBase>
  );
}

function TaoKyThangNayDialog({
  man,
  nam,
  thang,
  onClose,
  onDaTao,
}: {
  man: ManCanKy | null;
  nam: number;
  thang: number;
  onClose: () => void;
  onDaTao: (id: string, man: ManCanKy) => void;
}) {
  const taoKy = useCreatePayrollPeriod();

  const handleTao = async () => {
    if (!man) return;
    try {
      const ky = await taoKy.mutateAsync({ month: thang, year: nam, name: tenKyMacDinh(thang, nam) });
      toast.success(`Đã tạo kỳ lương tháng ${thang}/${nam}.`);
      onDaTao(ky.id, man);
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  return (
    <Dialog open={Boolean(man)} onClose={taoKy.isPending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Tạo kỳ lương tháng {thang}/{nam}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          Chưa có kỳ lương cho tháng {thang}/{nam}. Tạo kỳ mới (trạng thái Bản nháp) để bắt đầu nhập{" "}
          {man?.tenMan}?
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={taoKy.isPending} sx={{ textTransform: "none" }}>
          Hủy
        </Button>
        <Button
          variant="contained"
          onClick={handleTao}
          disabled={taoKy.isPending}
          sx={{ textTransform: "none" }}
        >
          Tạo kỳ và tiếp tục
        </Button>
      </DialogActions>
    </Dialog>
  );
}
