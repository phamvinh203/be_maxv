import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import CakeRounded from "@mui/icons-material/CakeRounded";
import type { DongSinhNhat } from "../../calculations/dashboard/tongQuan";
import TheDashboard, { DanhSach, DongDanhSach, ThongBaoRong } from "./TheDashboard";

interface Props {
  thang: number;
  rows: DongSinhNhat[];
  isLoading: boolean;
  loi: string | null;
  onXem: (maNv: string) => void;
}

/** Chữ cái đầu của TÊN (từ cuối) — cách người Việt gọi nhau, không phải của họ. */
function chuCaiDau(hoTen: string): string {
  const tu = hoTen.trim().split(/\s+/);
  return (tu[tu.length - 1]?.[0] ?? "?").toUpperCase();
}

export default function SinhNhatCard({ thang, rows, isLoading, loi, onXem }: Props) {
  const noiDung = () => {
    if (rows.length === 0) {
      return (
        <ThongBaoRong icon={<CakeRounded />}>
          Không có nhân viên nào sinh nhật trong tháng {thang}.
        </ThongBaoRong>
      );
    }
    return (
      <DanhSach>
        {rows.map((r) => (
          <DongDanhSach
            key={r.ma_nv}
            onClick={() => onXem(r.ma_nv)}
            mo={r.daQua}
            dau={
              <Avatar
                sx={{
                  width: 34,
                  height: 34,
                  fontSize: 15,
                  bgcolor: r.laHomNay ? "primary.main" : "action.selected",
                  color: r.laHomNay ? "primary.contrastText" : "text.primary",
                }}
              >
                {r.laHomNay ? <CakeRounded fontSize="small" /> : chuCaiDau(r.ho_ten)}
              </Avatar>
            }
            tieuDe={r.ho_ten}
            phu={r.ten_pb || r.ma_nv}
            cuoi={
              <>
                {r.laHomNay ? (
                  <Chip size="small" color="primary" label="Hôm nay" sx={{ height: 22 }} />
                ) : (
                  <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                    {String(r.ngay).padStart(2, "0")}/{String(thang).padStart(2, "0")}
                  </Typography>
                )}
                {r.tuoi !== null && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    tròn {r.tuoi} tuổi
                  </Typography>
                )}
              </>
            }
          />
        ))}
      </DanhSach>
    );
  };

  return (
    <TheDashboard
      tieuDe={`Sinh nhật tháng ${thang}`}
      phuDe="Nhân viên đang làm việc"
      icon={<CakeRounded />}
      hanhDong={rows.length > 0 ? <Chip size="small" label={`${rows.length} người`} /> : undefined}
      chan={{ loi, dangTai: isLoading }}
    >
      {noiDung}
    </TheDashboard>
  );
}
