import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import MoreTimeRounded from "@mui/icons-material/MoreTimeRounded";
import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import {
  useTangCaDashboard,
  type KyLuongDashboard,
} from "../../api/dashboard/dashboardQueries";
import { nhanThang, thangCuaKy } from "../../calculations/dashboard/tongQuan";
import ThanhNgang from "./charts/ThanhNgang";
import { DUONG_DAN, useMoManKyLuong } from "./dieuHuong";
import { soGio, soVn } from "./dinhDang";
import TheDashboard, { SoSanh, ThongBaoRong } from "./TheDashboard";

const IconVuotNguong = (
  <WarningAmberRounded
    titleAccess="Vượt ngưỡng giờ tăng ca/tháng"
    sx={{ fontSize: 15, color: "warning.main", ml: 0.5, verticalAlign: "-2px" }}
  />
);

export default function TangCaCard({ ky }: { ky: KyLuongDashboard }) {
  const kyXem = ky.kyTheoDoi;
  const { hienTai, tongGioKyTruoc, isLoading, loi } = useTangCaDashboard(kyXem, ky.kyTruoc);
  const moKy = useMoManKyLuong();

  const noiDung = () => {
    if (!kyXem) {
      return <ThongBaoRong icon={<MoreTimeRounded />}>Chưa có kỳ lương nào.</ThongBaoRong>;
    }

    return (
      <>
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.15 }}>
            {soVn(hienTai.tongGio, 1)}
            <Typography component="span" variant="body1" color="text.secondary" sx={{ ml: 0.75 }}>
              giờ
            </Typography>
          </Typography>
          {tongGioKyTruoc !== null && ky.kyTruoc && (
            <SoSanh
              chenh={hienTai.tongGio - tongGioKyTruoc}
              dinhDang={soGio}
              moc={nhanThang(thangCuaKy(ky.kyTruoc))}
            />
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {hienTai.soNguoiCoTangCa} nhân viên có tăng ca
          </Typography>
          {hienTai.soNguoiVuotNguong > 0 && (
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", mt: 0.5 }}>
              <WarningAmberRounded sx={{ fontSize: 18, color: "warning.main" }} />
              <Typography variant="body2">
                <strong>{hienTai.soNguoiVuotNguong}</strong> người vượt ngưỡng giờ tăng ca/tháng
              </Typography>
            </Stack>
          )}
        </Box>

        {hienTai.nhieuNhat.length === 0 ? (
          <ThongBaoRong>Chưa ghi nhận giờ tăng ca nào trong kỳ này.</ThongBaoRong>
        ) : (
          <>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              Tăng ca nhiều nhất
            </Typography>
            <ThanhNgang
              rows={hienTai.nhieuNhat.map((r) => ({
                khoa: r.ma_nv,
                nhan: r.ho_ten,
                giaTri: r.gio,
                nhanGiaTri: soGio(r.gio),
                dauHieu: r.vuotNguong ? IconVuotNguong : undefined,
              }))}
            />
          </>
        )}
      </>
    );
  };

  return (
    <TheDashboard
      tieuDe="Tổng giờ tăng ca"
      phuDe={kyXem && !ky.biTuChoi ? kyXem.name : "Kỳ lương gần nhất"}
      icon={<MoreTimeRounded />}
      hanhDong={
        kyXem && !ky.biTuChoi ? (
          <Button
            size="small"
            onClick={() => moKy(DUONG_DAN.tangCa, kyXem.id)}
            sx={{ textTransform: "none" }}
          >
            Nhập tăng ca
          </Button>
        ) : undefined
      }
      chan={{ biTuChoi: ky.biTuChoi, loi: ky.loi ?? loi, dangTai: ky.isLoading || isLoading }}
    >
      {noiDung}
    </TheDashboard>
  );
}
