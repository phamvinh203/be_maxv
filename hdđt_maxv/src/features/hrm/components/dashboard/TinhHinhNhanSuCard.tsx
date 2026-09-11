import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import GroupsRounded from "@mui/icons-material/GroupsRounded";
import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import type { NhanSuDashboard } from "../../api/dashboard/dashboardQueries";
import {
  gopPhanDuoi,
  NHAN_NHOM_HOP_DONG,
  TEN_CHUA_GAN_PHONG_BAN,
} from "../../calculations/dashboard/tongQuan";
import { nhanThang } from "../../_shared/thangKyLuong";
import BieuDoCot from "./charts/BieuDoCot";
import { useMauBieuDo } from "./charts/mauBieuDo";
import ThanhNgang from "./charts/ThanhNgang";
import ThanhTyLe from "./charts/ThanhTyLe";
import { DUONG_DAN } from "./dieuHuong";
import { nhanCotThang, phanTram, soVn } from "./dinhDang";
import TheDashboard, { DangTai } from "./TheDashboard";

const TOI_DA_PHONG_BAN = 6;

/**
 * Bức tranh nhân sự từ hồ sơ nhân viên — không dính dữ liệu lương nên ai vào được HRM cũng xem
 * được. Bốn khối: con số chính · cơ cấu (hợp đồng, giới tính) · theo phòng ban · người mới vào.
 */
export default function TinhHinhNhanSuCard({ nhanSu }: { nhanSu: NhanSuDashboard }) {
  const navigate = useNavigate();
  const mau = useMauBieuDo();
  const th = nhanSu.tinhHinh;

  const phongBan = gopPhanDuoi(th.theoPhongBan, TOI_DA_PHONG_BAN, (duoi) => ({
    so: duoi.reduce((s, r) => s + r.so, 0),
  }));

  const chuaCoHopDong = th.coCauHopDong.chua_co;

  const noiDung = () => {
    return (
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr", lg: "repeat(4, minmax(0, 1fr))" },
          columnGap: 4,
          rowGap: 3,
        }}
      >
        <Box>
          <Typography variant="caption" color="text.secondary">
            Đang làm việc
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 700, lineHeight: 1.1, mb: 1.5 }}>
            {th.dangLam}
          </Typography>
          <Stack spacing={0.5}>
            <ChiSo nhan="Vào làm tháng này" giaTri={th.vaoLamThangNay > 0 ? `+${th.vaoLamThangNay}` : "0"} />
            <ChiSo nhan="Đã nghỉ việc" giaTri={`${th.daNghi}`} />
            <ChiSo nhan="Người phụ thuộc (giảm trừ)" giaTri={`${th.soNguoiPhuThuoc}`} />
          </Stack>

          {(chuaCoHopDong > 0 || th.chuaGanPhongBan > 0) && (
            <Stack spacing={0.75} sx={{ mt: 2 }}>
              {chuaCoHopDong > 0 && (
                <CanhBao onXem={() => navigate(DUONG_DAN.nhanVien)}>
                  <strong>{chuaCoHopDong}</strong> người đang làm chưa có hợp đồng
                </CanhBao>
              )}
              {th.chuaGanPhongBan > 0 && (
                <CanhBao onXem={() => navigate(DUONG_DAN.nhanVien)}>
                  <strong>{th.chuaGanPhongBan}</strong> người chưa gán phòng ban
                </CanhBao>
              )}
            </Stack>
          )}
        </Box>

        <Stack spacing={2.5}>
          <ThanhTyLe
            tieuDe="Loại hợp đồng"
            phan={[
              { khoa: "hdld", nhan: NHAN_NHOM_HOP_DONG.hdld, so: th.coCauHopDong.hdld, mau: mau.chuoi[0] },
              { khoa: "thu_viec", nhan: NHAN_NHOM_HOP_DONG.thu_viec, so: th.coCauHopDong.thu_viec, mau: mau.chuoi[1] },
              { khoa: "hdvc", nhan: NHAN_NHOM_HOP_DONG.hdvc, so: th.coCauHopDong.hdvc, mau: mau.chuoi[2] },
              { khoa: "chua_co", nhan: NHAN_NHOM_HOP_DONG.chua_co, so: th.coCauHopDong.chua_co, mau: mau.trungTinh },
            ]}
          />
          <ThanhTyLe
            tieuDe="Giới tính"
            phan={[
              { khoa: "nam", nhan: "Nam", so: th.gioiTinh.nam, mau: mau.chuoi[0] },
              { khoa: "nu", nhan: "Nữ", so: th.gioiTinh.nu, mau: mau.chuoi[1] },
              { khoa: "khac", nhan: "Khác / chưa khai", so: th.gioiTinh.khac, mau: mau.trungTinh },
            ]}
          />
        </Stack>

        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
            Theo phòng ban
          </Typography>
          {phongBan.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Chưa có nhân viên đang làm.
            </Typography>
          ) : (
            <ThanhNgang
              rows={phongBan.map((pb) => ({
                khoa: pb.ten,
                nhan: pb.ten,
                giaTri: pb.so,
                nhanGiaTri: `${pb.so}`,
                phu: phanTram(pb.so, th.dangLam),
                trungTinh: pb.laKhac || pb.ten === TEN_CHUA_GAN_PHONG_BAN,
              }))}
            />
          )}
        </Box>

        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
            Nhân viên mới vào làm
          </Typography>
          <BieuDoCot
            duLieu={th.vaoLam6Thang.map((t, i) => ({
              ...nhanCotThang(t, i),
              cot: t.so,
              ghiNhan: i === th.vaoLam6Thang.length - 1,
              chiTiet: (
                <Typography variant="body2">
                  <strong>{t.so}</strong> người vào làm {nhanThang(t)}
                </Typography>
              ),
              moTa: `${nhanThang(t)}: ${t.so} người vào làm`,
            }))}
            tenCot="Người vào làm"
            dinhDang={(v) => soVn(v, 0)}
            buocToiThieu={1}
            cao={130}
            moTa="Số nhân viên vào làm theo tháng, 6 tháng gần nhất"
          />
        </Box>
      </Box>
    );
  };

  return (
    <TheDashboard
      tieuDe="Tình hình nhân sự"
      phuDe="Theo hồ sơ nhân viên hiện có"
      icon={<GroupsRounded />}
      hanhDong={
        <Button size="small" onClick={() => navigate(DUONG_DAN.nhanVien)} sx={{ textTransform: "none" }}>
          Danh sách nhân viên
        </Button>
      }
      chan={{
        loi: nhanSu.loi,
        dangTai: nhanSu.isLoading,
        khungTai: <DangTai soDong={4} cao={48} />,
      }}
    >
      {noiDung}
    </TheDashboard>
  );
}

function ChiSo({ nhan, giaTri }: { nhan: string; giaTri: string }) {
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: "baseline", borderBottom: 1, borderColor: "divider", pb: 0.5 }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
        {nhan}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {giaTri}
      </Typography>
    </Stack>
  );
}

/** Cảnh báo dạng trạng thái: luôn biểu tượng + chữ, không để màu vàng tự nói. */
function CanhBao({ children, onXem }: { children: ReactNode; onXem: () => void }) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
      <WarningAmberRounded sx={{ fontSize: 18, color: "warning.main" }} />
      <Typography variant="body2" sx={{ flex: 1 }}>
        {children}
      </Typography>
      <Link component="button" variant="body2" onClick={onXem} underline="hover">
        Xem
      </Link>
    </Stack>
  );
}
