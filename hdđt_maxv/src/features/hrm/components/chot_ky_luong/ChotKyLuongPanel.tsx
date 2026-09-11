import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import { getErrorMessage } from "@/lib/errors";
import { LOI_KHONG_CO_QUYEN_LUONG } from "../../api/du_lieu_nhan_vien/quyenLuongQueries";
import {
  useChotBangKe,
  useChotKyLuong,
  useMoChotBangKe,
  type BangKeApiItem,
} from "../../api/chot_ky_luong/chotKyLuongQueries";
import { useCurrentPayrollPeriod } from "../du_lieu_tinh_luong/useCurrentPayrollPeriod";
import XacNhanXoaDialog from "../XacNhanXoaDialog";
import ChotKyLuongHeader from "./ChotKyLuongHeader";
import TheBangKe from "./TheBangKe";
import LichSuHoatDong from "./LichSuHoatDong";
import { chayVoiThongBao } from "./chayVoiThongBao";
import { useLaChuTaiKhoan } from "./useLaChuTaiKhoan";

// `minmax(0, 1fr)` chứ không `1fr` trơn: `1fr` lấy độ rộng tối thiểu theo nội dung, thẻ có tên dài
// (vd "Thu nhập ngoài bảng lương") nở cột của nó và bóp các cột khác tới mức nút phải xuống dòng.
const LUOI_THE = {
  display: "grid",
  gridTemplateColumns: {
    xs: "minmax(0, 1fr)",
    sm: "repeat(2, minmax(0, 1fr))",
    md: "repeat(3, minmax(0, 1fr))",
    xl: "repeat(4, minmax(0, 1fr))",
  },
  gap: 1.5,
} as const;

/**
 * Màn "Chốt kỳ lương" (BR-dltl-030): 12 bảng kê của kỳ đang chọn ở góc thanh HRM, mỗi bảng kê chốt
 * số / mở chốt riêng; header lo tính lương, chốt toàn kỳ, hướng dẫn và vòng đời kỳ; cột phải là
 * lịch sử hoạt động.
 */
export default function ChotKyLuongPanel() {
  const { selectedPeriod, thangChon, biTuChoi, isLoading: dangTaiKy } = useCurrentPayrollPeriod();
  const laChuTaiKhoan = useLaChuTaiKhoan();

  const periodId = selectedPeriod?.id ?? "";
  const tongQuan = useChotKyLuong(selectedPeriod?.id ?? null);
  const chotMut = useChotBangKe(periodId);
  const moChotMut = useMoChotBangKe(periodId);
  const [canMoChot, setCanMoChot] = useState<BangKeApiItem | null>(null);

  if (biTuChoi) {
    return <Alert severity="warning">{LOI_KHONG_CO_QUYEN_LUONG}</Alert>;
  }

  if (!selectedPeriod) {
    return dangTaiKy ? (
      <Skeleton variant="rounded" height={120} />
    ) : (
      <Alert severity="info">
        Tháng {thangChon.thang}/{thangChon.nam} chưa có kỳ lương. Bấm <strong>Tạo kỳ lương</strong> ở
        góc phải thanh phía trên để bắt đầu.
      </Alert>
    );
  }

  const data = tongQuan.data;
  // Thẻ đang được chốt / mở chốt — suy thẳng từ mutation, không giữ state riêng.
  const dangXuLy = chotMut.isPending ? chotMut.variables : moChotMut.isPending ? moChotMut.variables : null;

  return (
    <Stack spacing={2}>
      <ChotKyLuongHeader period={selectedPeriod} tongQuan={data} />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1fr) 300px" },
          gap: 2,
          alignItems: "start",
        }}
      >
        <Paper variant="outlined" sx={{ p: 2 }}>
          {tongQuan.isError && (
            <Alert severity="error">
              {getErrorMessage(tongQuan.error, "Không tải được trạng thái chốt các bảng kê.")}
            </Alert>
          )}
          {tongQuan.isLoading && (
            <Box sx={LUOI_THE}>
              {Array.from({ length: 12 }, (_, i) => (
                <Skeleton key={i} variant="rounded" height={104} />
              ))}
            </Box>
          )}
          {data && (
            <Box sx={LUOI_THE}>
              {data.modules.map((bangKe) => (
                <TheBangKe
                  key={bangKe.module}
                  bangKe={bangKe}
                  periodLocked={data.periodLocked}
                  laChuTaiKhoan={laChuTaiKhoan}
                  dangXuLy={dangXuLy === bangKe.module}
                  onChot={() =>
                    chayVoiThongBao(
                      () => chotMut.mutateAsync(bangKe.module),
                      `Đã chốt số liệu ${bangKe.label}.`,
                    )
                  }
                  onMoChot={() => setCanMoChot(bangKe)}
                />
              ))}
            </Box>
          )}
        </Paper>

        <LichSuHoatDong periodId={selectedPeriod.id} />
      </Box>

      <XacNhanXoaDialog
        open={!!canMoChot}
        tieuDe={`Mở chốt ${canMoChot?.label ?? ""}?`}
        nhanXacNhan="Mở chốt"
        onClose={() => setCanMoChot(null)}
        onXacNhan={() => {
          const bangKe = canMoChot;
          setCanMoChot(null);
          if (bangKe) {
            void chayVoiThongBao(
              () => moChotMut.mutateAsync(bangKe.module),
              `Đã mở chốt ${bangKe.label}.`,
            );
          }
        }}
        noiDung={
          canMoChot?.periodData
            ? "Dữ liệu của bảng kê này trong kỳ sẽ sửa được trở lại. Thao tác được ghi vào lịch sử hoạt động."
            : "Bảng kê sẽ trở về trạng thái chưa rà soát. Thao tác được ghi vào lịch sử hoạt động."
        }
      />
    </Stack>
  );
}
