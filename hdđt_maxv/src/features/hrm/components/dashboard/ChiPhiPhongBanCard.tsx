import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AccountTreeRounded from "@mui/icons-material/AccountTreeRounded";
import { kyDaKhoaSo, TRANG_THAI_KY } from "../../_shared/constants";
import {
  useChiPhiPhongBan,
  type KyLuongDashboard,
} from "../../api/dashboard/dashboardQueries";
import { gopPhanDuoi, TEN_CHUA_GAN_PHONG_BAN } from "../../calculations/dashboard/tongQuan";
import ThanhNgang from "./charts/ThanhNgang";
import { phanTram, tienDayDu, tienGon } from "./dinhDang";
import TheDashboard, { DangTai, ThongBaoRong } from "./TheDashboard";

/** Quá ngần này phòng ban thì phần đuôi gộp thành "Khác" — quá 7 thanh mắt không so nổi nữa. */
const TOI_DA = 7;

export default function ChiPhiPhongBanCard({ ky }: { ky: KyLuongDashboard }) {
  const kyXem = ky.kyTheoDoi;
  const { rows, tong, isLoading, loi } = useChiPhiPhongBan(kyXem);

  const noiDung = () => {
    if (!kyXem) {
      return <ThongBaoRong icon={<AccountTreeRounded />}>Chưa có kỳ lương nào.</ThongBaoRong>;
    }
    if (rows.length === 0) {
      return (
        <ThongBaoRong icon={<AccountTreeRounded />}>Kỳ này chưa có dòng lương nào.</ThongBaoRong>
      );
    }

    const hienThi = gopPhanDuoi(rows, TOI_DA, (duoi) => ({
      quyLuong: duoi.reduce((s, r) => s + r.quyLuong, 0),
      soNhanVien: duoi.reduce((s, r) => s + r.soNhanVien, 0),
    }));

    return (
      <>
        <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {tienGon(tong.quyLuong)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            tổng quỹ lương · {tong.soNhanVien} nhân viên
          </Typography>
        </Stack>
        <ThanhNgang
          rows={hienThi.map((r) => ({
            khoa: r.ten,
            nhan: r.ten,
            giaTri: r.quyLuong,
            nhanGiaTri: tienGon(r.quyLuong),
            phu: phanTram(r.quyLuong, tong.quyLuong),
            trungTinh: r.laKhac || r.ten === TEN_CHUA_GAN_PHONG_BAN,
            chiTiet: (
              <Box sx={{ py: 0.25 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {tienDayDu(r.quyLuong)}
                </Typography>
                <Typography variant="caption" sx={{ display: "block" }}>
                  {r.soNhanVien} nhân viên · bình quân{" "}
                  {tienGon(r.soNhanVien > 0 ? r.quyLuong / r.soNhanVien : 0)}/người
                </Typography>
              </Box>
            ),
          }))}
        />
      </>
    );
  };

  return (
    <TheDashboard
      tieuDe="Chi phí theo phòng ban"
      phuDe={
        kyXem && !ky.biTuChoi ? (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <span>{kyXem.name}</span>
            <Chip
              size="small"
              color={TRANG_THAI_KY[kyXem.status].mau}
              variant="outlined"
              label={kyDaKhoaSo(kyXem.status) ? TRANG_THAI_KY[kyXem.status].nhan : "Tạm tính"}
              sx={{ height: 20, fontSize: 11 }}
            />
          </Stack>
        ) : (
          "Quỹ lương của kỳ gần nhất"
        )
      }
      chan={{
        biTuChoi: ky.biTuChoi,
        loi: ky.loi ?? loi,
        dangTai: ky.isLoading || isLoading,
        khungTai: <DangTai soDong={6} />,
      }}
    >
      {noiDung}
    </TheDashboard>
  );
}
