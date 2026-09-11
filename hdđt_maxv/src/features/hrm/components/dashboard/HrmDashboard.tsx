import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import { homNay } from "../../_shared/format";
import { thangCua } from "../../_shared/thangKyLuong";
import {
  useKyLuongDashboard,
  useNhanSuDashboard,
} from "../../api/dashboard/dashboardQueries";
import NhanVienDialog from "../nhan_vien/NhanVienDialog";
import NhanVienChiTietDialog from "../nhan_vien/chi_tiet/NhanVienChiTietDialog";
import ChiPhiPhongBanCard from "./ChiPhiPhongBanCard";
import ChoPheDuyetCard from "./ChoPheDuyetCard";
import HopDongSapHetCard from "./HopDongSapHetCard";
import SinhNhatCard from "./SinhNhatCard";
import TangCaCard from "./TangCaCard";
import ThaoTacNhanh from "./ThaoTacNhanh";
import TinhHinhNhanSuCard from "./TinhHinhNhanSuCard";
import XuHuongLuongCard from "./XuHuongLuongCard";

/**
 * Tổng quan khu HRM — đọc API THẬT (không còn kho giả `mock/hooks/tongQuan.ts`).
 *
 * Bốn tầng, theo thứ tự người dùng cần: thao tác nhanh · biểu đồ lương và nhân sự · các danh
 * sách cần để ý. Phần lương (xu hướng, chi phí phòng ban, chờ duyệt, tăng ca) chỉ hiện với người
 * có quyền xem lương; phần nhân sự ai vào được HRM cũng xem được. Nguồn số liệu và luật gom ở
 * `api/dashboard/dashboardQueries.ts` + `calculations/dashboard/tongQuan.ts`.
 */
export default function HrmDashboard() {
  const ngay = homNay();
  const nhanSu = useNhanSuDashboard(ngay);
  const ky = useKyLuongDashboard(ngay);

  // Một dialog cho cả thêm lẫn sửa — giống `NhanVienTable`: `maNv` rỗng là thêm mới.
  const [hoSo, setHoSo] = useState<{ open: boolean; maNv?: string }>({ open: false });
  const [maNvDangXem, setMaNvDangXem] = useState<string | null>(null);

  return (
    <Stack spacing={2.5}>
      <ThaoTacNhanh homNay={ngay} ky={ky} onThemNhanVien={() => setHoSo({ open: true })} />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 7fr) minmax(0, 5fr)" },
          gap: 2.5,
        }}
      >
        <XuHuongLuongCard ky={ky} />
        <ChiPhiPhongBanCard ky={ky} />
      </Box>

      <TinhHinhNhanSuCard nhanSu={nhanSu} />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" },
          gap: 2.5,
        }}
      >
        <SinhNhatCard
          thang={thangCua(ngay).thang}
          rows={nhanSu.sinhNhat}
          isLoading={nhanSu.isLoading}
          loi={nhanSu.loi}
          onXem={setMaNvDangXem}
        />
        <HopDongSapHetCard
          rows={nhanSu.hopDongSapHet}
          isLoading={nhanSu.isLoading}
          loi={nhanSu.loi}
          onXem={setMaNvDangXem}
        />
        <ChoPheDuyetCard ky={ky} />
        <TangCaCard ky={ky} />
      </Box>

      <NhanVienChiTietDialog
        open={Boolean(maNvDangXem)}
        maNv={maNvDangXem}
        onClose={() => setMaNvDangXem(null)}
        onSua={(maNv) => {
          setMaNvDangXem(null);
          setHoSo({ open: true, maNv });
        }}
      />
      <NhanVienDialog
        open={hoSo.open}
        maNv={hoSo.maNv}
        onClose={() => setHoSo((cu) => ({ ...cu, open: false }))}
      />
    </Stack>
  );
}
