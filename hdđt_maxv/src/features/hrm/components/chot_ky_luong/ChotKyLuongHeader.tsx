import { useState } from "react";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import LockRounded from "@mui/icons-material/LockRounded";
import LockOutlined from "@mui/icons-material/LockOutlined";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import { kyDaKhoaSo, TRANG_THAI_KY } from "../../_shared/constants";
import type { PayrollPeriodApiItem } from "../../api/du_lieu_tinh_luong/payrollPeriodsQueries";
import {
  useChotToanKy,
  useTinhLuongKy,
  type ChotKyLuongApi,
} from "../../api/chot_ky_luong/chotKyLuongQueries";
import XacNhanXoaDialog from "../XacNhanXoaDialog";
import NutHuongDan from "../huong_dan/NutHuongDan";
import { HUONG_DAN_CHOT_KY_LUONG } from "../huong_dan/noiDung";
import IconVuong from "./IconVuong";
import VongDoiKyLuong from "./VongDoiKyLuong";
import { chayVoiThongBao } from "./chayVoiThongBao";

interface Props {
  period: PayrollPeriodApiItem;
  tongQuan: ChotKyLuongApi | undefined;
}

const chipSx = { borderRadius: 1, fontWeight: 600, height: 24 } as const;

/**
 * Dòng đầu màn Chốt kỳ lương: trạng thái kỳ, "Bảng lương a/b NV", "x/12 bảng kê", các nút Tính lương /
 * Chốt số toàn kỳ / Hướng dẫn (tự quản mutation + hộp thoại của mình) và dải nút vòng đời kỳ.
 */
export default function ChotKyLuongHeader({ period, tongQuan }: Props) {
  const theme = useTheme();
  const tinhLuongMut = useTinhLuongKy(period.id);
  const chotToanKyMut = useChotToanKy(period.id);
  const [moChotToanKy, setMoChotToanKy] = useState(false);

  const trangThai = TRANG_THAI_KY[period.status];
  // Đọc từ kỳ đang chọn (có ngay) chứ không đợi tổng quan — kỳ đã khóa sổ thì nút khóa ngay từ đầu.
  const kyDaKhoa = kyDaKhoaSo(period.status);
  const bangKeChuaChot = tongQuan?.modules.filter((m) => !m.locked) ?? [];
  const bangLuong = tongQuan?.payroll;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={2}
        sx={{ alignItems: { lg: "center" }, justifyContent: "space-between" }}
      >
        <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
          {/* Màu theo token theme (không hardcode hex) — tự đổi đúng theo sáng/tối (RVW-A14). */}
          <IconVuong mau={theme.palette.error.main}>
            <LockRounded fontSize="small" />
          </IconVuong>
          <IconVuong mau={theme.palette.info.main}>
            <LockOutlined fontSize="small" />
          </IconVuong>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, letterSpacing: 0.3 }}>
            CHỐT KỲ LƯƠNG
          </Typography>
          <Chip
            size="small"
            variant="outlined"
            color="primary"
            label={trangThai?.nhan ?? period.status}
            sx={chipSx}
          />
          <Tooltip title="Số nhân viên đã có kết quả tính lương / số nhân viên đang làm việc">
            <Chip
              size="small"
              variant="outlined"
              color="primary"
              label={
                bangLuong
                  ? `Bảng lương ${bangLuong.calculatedEmployees}/${bangLuong.totalEmployees} NV`
                  : "Bảng lương …"
              }
              sx={chipSx}
            />
          </Tooltip>
          <Chip
            size="small"
            variant="outlined"
            color="success"
            label={
              tongQuan
                ? `Số bảng kê đã chốt số ${tongQuan.lockedModuleCount}/${tongQuan.totalModules}`
                : "Số bảng kê đã chốt số …"
            }
            sx={chipSx}
          />
        </Stack>

        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
          <Tooltip title={kyDaKhoa ? "Kỳ đã khóa sổ — bảng lương đã được chụp lúc khóa sổ." : ""}>
            <span>
              <Button
                variant="contained"
                size="small"
                startIcon={<ReceiptLongRounded />}
                onClick={() =>
                  chayVoiThongBao(
                    () => tinhLuongMut.mutateAsync(),
                    (kq) => `Đã tính lương cho ${kq.calculatedEmployees} nhân viên.`,
                  )
                }
                disabled={kyDaKhoa || tinhLuongMut.isPending}
                sx={{ textTransform: "none", fontWeight: 600 }}
              >
                {tinhLuongMut.isPending ? "Đang tính..." : "Tính lương"}
              </Button>
            </span>
          </Tooltip>
          <Button
            variant="contained"
            size="small"
            startIcon={<LockRounded />}
            onClick={() => setMoChotToanKy(true)}
            disabled={kyDaKhoa || chotToanKyMut.isPending || bangKeChuaChot.length === 0}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Chốt số toàn kỳ
          </Button>
          <NutHuongDan huongDan={HUONG_DAN_CHOT_KY_LUONG} />
        </Stack>
      </Stack>

      {["DRAFT", "PENDING_REVIEW", "LOCKED"].includes(period.status) && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            sx={{ alignItems: { md: "center" }, justifyContent: "space-between" }}
          >
            <Typography variant="body2" color="text.secondary">
              {period.name} · {trangThai?.nhan ?? period.status}
              {period.status === "LOCKED" && " — dữ liệu tính lương của kỳ đang ở chế độ chỉ đọc."}
            </Typography>
            <VongDoiKyLuong period={period} bangKeChuaChot={bangKeChuaChot} />
          </Stack>
        </>
      )}

      <XacNhanXoaDialog
        open={moChotToanKy}
        tieuDe="Chốt số toàn kỳ?"
        nhanXacNhan="Chốt số toàn kỳ"
        onClose={() => setMoChotToanKy(false)}
        onXacNhan={() => {
          setMoChotToanKy(false);
          void chayVoiThongBao(
            () => chotToanKyMut.mutateAsync(),
            ({ lockedModules }) =>
              lockedModules.length > 0
                ? `Đã chốt số ${lockedModules.length} bảng kê còn lại của kỳ.`
                : "Mọi bảng kê của kỳ đã được chốt số từ trước.",
          );
        }}
        noiDung={
          <>
            Sẽ chốt số <strong>{bangKeChuaChot.length}</strong> bảng kê còn đang mở của{" "}
            {period.name}: {bangKeChuaChot.map((b) => b.label).join(", ")}. Dữ liệu các bảng kê theo
            kỳ sẽ bị khóa sửa cho tới khi chủ tài khoản mở chốt.
          </>
        }
      />
    </Paper>
  );
}
