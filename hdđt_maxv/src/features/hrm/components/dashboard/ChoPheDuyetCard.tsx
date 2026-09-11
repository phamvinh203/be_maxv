import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import FactCheckRounded from "@mui/icons-material/FactCheckRounded";
import TaskAltRounded from "@mui/icons-material/TaskAltRounded";
import { TRANG_THAI_KY } from "../../_shared/constants";
import type { KyLuongDashboard } from "../../api/dashboard/dashboardQueries";
import type { PayrollPeriodApiItem } from "../../api/du_lieu_tinh_luong/payrollPeriodsQueries";
import { DUONG_DAN, useMoManKyLuong } from "./dieuHuong";
import TheDashboard, { DangTai, DanhSach, DongDanhSach, ThongBaoRong } from "./TheDashboard";

/** Việc còn lại của kỳ — theo đúng vòng đời DRAFT → PENDING_REVIEW → LOCKED → APPROVED. */
function viecConLai(p: PayrollPeriodApiItem): string {
  if (p.status === "PENDING_REVIEW") return "Đã trình — chờ kiểm tra và khóa sổ";
  // `lockedAt` là thời điểm (UTC), không phải ngày — đổi theo giờ máy, cắt chuỗi sẽ lùi một
  // ngày với các lần khóa sổ trước 7 giờ sáng giờ Việt Nam.
  const ngayKhoa = p.lockedAt
    ? ` ${new Date(p.lockedAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}`
    : "";
  return `Đã khóa sổ${ngayKhoa} — chờ phê duyệt`;
}

/**
 * Kỳ lương đang đợi người duyệt. Bấm vào mở màn Bảng lương ĐÚNG kỳ đó — nơi có nút khóa sổ /
 * duyệt / trả về — thay vì cho duyệt ngay ở đây khi người duyệt chưa nhìn thấy bảng số.
 */
export default function ChoPheDuyetCard({ ky }: { ky: KyLuongDashboard }) {
  const moKy = useMoManKyLuong();
  const ds = ky.choPheDuyet;

  const noiDung = () => {
    if (ds.length === 0) {
      return (
        <ThongBaoRong icon={<TaskAltRounded />}>Không có kỳ lương nào đang chờ phê duyệt.</ThongBaoRong>
      );
    }
    return (
      <DanhSach>
        {ds.map((p) => (
          <DongDanhSach
            key={p.id}
            onClick={() => moKy(DUONG_DAN.bangLuong, p)}
            tieuDe={p.name}
            phu={viecConLai(p)}
            cuoi={
              <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                <Chip
                  size="small"
                  color={TRANG_THAI_KY[p.status].mau}
                  label={TRANG_THAI_KY[p.status].nhan}
                  sx={{ height: 22 }}
                />
                <ChevronRightRounded fontSize="small" sx={{ color: "text.secondary" }} />
              </Stack>
            }
          />
        ))}
      </DanhSach>
    );
  };

  return (
    <TheDashboard
      tieuDe="Chờ phê duyệt"
      phuDe="Kỳ lương đã trình hoặc đã khóa sổ"
      icon={<FactCheckRounded />}
      hanhDong={
        ds.length > 0 && !ky.biTuChoi ? (
          <Chip size="small" color="info" label={`${ds.length} kỳ`} />
        ) : undefined
      }
      chan={{
        biTuChoi: ky.biTuChoi,
        loi: ky.loi,
        dangTai: ky.isLoading,
        khungTai: <DangTai soDong={3} cao={44} />,
      }}
    >
      {noiDung}
    </TheDashboard>
  );
}
