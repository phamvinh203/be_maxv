import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ShowChartRounded from "@mui/icons-material/ShowChartRounded";
import { kyDaKhoaSo, TRANG_THAI_KY } from "../../_shared/constants";
import {
  useXuHuongLuong,
  type DiemXuHuongLuong,
  type KyLuongDashboard,
} from "../../api/dashboard/dashboardQueries";
import { nhanThang } from "../../_shared/thangKyLuong";
import BieuDoCot, { DongChiTiet } from "./charts/BieuDoCot";
import { useMauBieuDo } from "./charts/mauBieuDo";
import { DUONG_DAN, useMoManKyLuong } from "./dieuHuong";
import { nhanCotThang, phanTram, tienDayDu, tienGon } from "./dinhDang";
import TheDashboard, { DangTai, SoSanh, ThongBaoRong } from "./TheDashboard";

/**
 * Quỹ lương (cột) và thực lĩnh (đường) của 6 tháng gần nhất — CÙNG đơn vị đồng nên chung một
 * trục. Tháng chưa có kỳ để trống chỗ, không dồn cột.
 */
export default function XuHuongLuongCard({ ky }: { ky: KyLuongDashboard }) {
  const { diem, isLoading } = useXuHuongLuong(ky.periods, ky.khungXuHuong);
  const moKy = useMoManKyLuong();
  const mau = useMauBieuDo();

  const coSo = diem.filter(
    (d): d is DiemXuHuongLuong & { tong: NonNullable<DiemXuHuongLuong["tong"]> } => d.tong !== null,
  );
  const moiNhat = coSo[coSo.length - 1];
  const truocDo = coSo[coSo.length - 2];
  const viTriMoiNhat = moiNhat ? diem.indexOf(moiNhat) : -1;
  const loiThang = diem.filter((d) => d.loi);

  const khung = ky.khungXuHuong;
  const phuDe =
    khung.length > 0
      ? `Quỹ lương và thực lĩnh theo kỳ · ${nhanThang(khung[0]!)} – ${nhanThang(khung[khung.length - 1]!)}`
      : "Quỹ lương và thực lĩnh theo kỳ";

  const noiDung = () => {
    if (ky.periods.length === 0) {
      return (
        <ThongBaoRong icon={<ShowChartRounded />}>
          Chưa có kỳ lương nào. Bấm "Tạo kỳ lương" ở góc phải thanh HRM để bắt đầu theo dõi.
        </ThongBaoRong>
      );
    }

    return (
      <>
        {moiNhat && (
          <Stack direction="row" sx={{ flexWrap: "wrap", columnGap: 4, rowGap: 1, mb: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Quỹ lương {nhanThang(moiNhat)}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {tienGon(moiNhat.tong.quyLuong)}
                </Typography>
                {moiNhat.ky && !kyDaKhoaSo(moiNhat.ky.status) && (
                  <Chip size="small" label="Tạm tính" variant="outlined" sx={{ height: 22 }} />
                )}
              </Stack>
              {truocDo && truocDo.tong.quyLuong > 0 && (
                <SoSanh
                  chenh={moiNhat.tong.quyLuong - truocDo.tong.quyLuong}
                  dinhDang={(v) => phanTram(v, truocDo.tong.quyLuong)}
                  moc={nhanThang(truocDo)}
                />
              )}
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Thực lĩnh
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {tienGon(moiNhat.tong.thucLinh)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {moiNhat.tong.soNhanVien} nhân viên
              </Typography>
            </Box>
          </Stack>
        )}

        <BieuDoCot
          duLieu={diem.map((d, i) => ({
            ...nhanCotThang(d, i),
            cot: d.tong?.quyLuong ?? null,
            duong: d.tong?.thucLinh ?? null,
            ghiNhan: i === viTriMoiNhat,
            chiTiet: <ChiTietThang d={d} mauCot={mau.chuoi[0]} mauDuong={mau.chuoi[1]} />,
            moTa: d.tong
              ? `${nhanThang(d)}: quỹ lương ${tienDayDu(d.tong.quyLuong)}, thực lĩnh ${tienDayDu(d.tong.thucLinh)}, ${d.tong.soNhanVien} nhân viên`
              : `${nhanThang(d)}: ${d.ky ? "chưa có số liệu" : "chưa tạo kỳ lương"}`,
          }))}
          tenCot="Quỹ lương"
          tenDuong="Thực lĩnh"
          dinhDang={tienGon}
          cao={200}
          moTa="Quỹ lương và thực lĩnh 6 tháng gần nhất"
        />

        {loiThang.length > 0 && (
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            {loiThang.map((d) => `Không tính được bảng lương ${nhanThang(d)}: ${d.loi}`).join(" · ")}
          </Alert>
        )}
      </>
    );
  };

  return (
    <TheDashboard
      tieuDe="Xu hướng lương 6 tháng"
      phuDe={phuDe}
      hanhDong={
        !ky.biTuChoi && ky.kyTheoDoi ? (
          <Button
            size="small"
            onClick={() => moKy(DUONG_DAN.bangLuong, moiNhat?.ky ?? ky.kyTheoDoi)}
            sx={{ textTransform: "none" }}
          >
            Bảng lương
          </Button>
        ) : undefined
      }
      chan={{
        biTuChoi: ky.biTuChoi,
        loi: ky.loi,
        dangTai: ky.isLoading || (isLoading && coSo.length === 0),
        khungTai: <DangTai soDong={1} cao={260} />,
      }}
    >
      {noiDung}
    </TheDashboard>
  );
}

function ChiTietThang({
  d,
  mauCot,
  mauDuong,
}: {
  d: DiemXuHuongLuong;
  mauCot: string;
  mauDuong: string;
}) {
  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {d.ky?.name ?? `Tháng ${d.thang}/${d.nam}`}
        </Typography>
        {d.ky && (
          <Typography variant="caption" color="text.secondary">
            {TRANG_THAI_KY[d.ky.status].nhan}
          </Typography>
        )}
      </Stack>
      {!d.ky ? (
        <Typography variant="caption" color="text.secondary">
          Chưa tạo kỳ lương cho tháng này.
        </Typography>
      ) : d.loi ? (
        <Typography variant="caption" color="error">
          {d.loi}
        </Typography>
      ) : !d.tong ? (
        <Typography variant="caption" color="text.secondary">
          Đang tính…
        </Typography>
      ) : (
        <>
          <DongChiTiet mau={mauCot} nhan="Quỹ lương" giaTri={tienDayDu(d.tong.quyLuong)} />
          <DongChiTiet mau={mauDuong} nhan="Thực lĩnh" giaTri={tienDayDu(d.tong.thucLinh)} />
          <DongChiTiet nhan="Tổng thu nhập" giaTri={tienDayDu(d.tong.thuNhap)} />
          <DongChiTiet nhan="nhân viên" giaTri={`${d.tong.soNhanVien}`} />
          {!kyDaKhoaSo(d.ky.status) && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
              Tạm tính — kỳ chưa khóa sổ.
            </Typography>
          )}
        </>
      )}
    </Box>
  );
}
