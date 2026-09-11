import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { alpha, useTheme, type Theme } from "@mui/material/styles";
import HistoryRounded from "@mui/icons-material/HistoryRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import LockOpenRounded from "@mui/icons-material/LockOpenRounded";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import CheckCircleOutlineRounded from "@mui/icons-material/CheckCircleOutlineRounded";
import type { SvgIconComponent } from "@mui/icons-material";
import { getErrorMessage } from "@/lib/errors";
import {
  useLichSuKyLuong,
  type LoaiHoatDong,
} from "../../api/chot_ky_luong/chotKyLuongQueries";

// Màu theo TOKEN theme (không hardcode hex) — tự đổi đúng theo sáng/tối, khớp ý nghĩa đã dùng
// nơi khác trong app (khóa/mở khóa = error/warning, sửa = info, duyệt = success) (RVW-A14).
function kieuHoatDong(theme: Theme): Record<LoaiHoatDong, { icon: SvgIconComponent; mau: string }> {
  return {
    LOCK: { icon: LockRounded, mau: theme.palette.error.main },
    UNLOCK: { icon: LockOpenRounded, mau: theme.palette.warning.main },
    EDIT: { icon: DescriptionOutlined, mau: theme.palette.info.main },
    APPROVE: { icon: CheckCircleOutlineRounded, mau: theme.palette.success.main },
  };
}

/** "16:38:11 10/9/2026" — giờ trước ngày sau, như trên màn tham chiếu. */
function thoiDiem(iso: string): string {
  const d = new Date(iso);
  const gio = [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
  return `${gio} ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

/** Cột phải màn Chốt kỳ lương — 50 thao tác gần nhất của kỳ, đọc lại từ nhật ký hệ thống. */
export default function LichSuHoatDong({ periodId }: { periodId: string }) {
  const { data = [], isLoading, isError, error } = useLichSuKyLuong(periodId);
  const theme = useTheme();
  const KIEU_HOAT_DONG = kieuHoatDong(theme);

  return (
    <Paper variant="outlined" sx={{ p: 2, alignSelf: "start" }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1.5 }}>
        <HistoryRounded fontSize="small" color="action" />
        <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: 0.3 }}>
          LỊCH SỬ HOẠT ĐỘNG
        </Typography>
      </Stack>
      <Divider sx={{ mb: 2 }} />

      {isLoading && (
        <Stack spacing={2}>
          {[0, 1, 2].map((i) => (
            <Stack key={i} direction="row" spacing={1.5}>
              <Skeleton variant="circular" width={32} height={32} />
              <Box sx={{ flex: 1 }}>
                <Skeleton width="60%" />
                <Skeleton width="90%" />
              </Box>
            </Stack>
          ))}
        </Stack>
      )}

      {isError && (
        <Alert severity="error">{getErrorMessage(error, "Không tải được lịch sử hoạt động.")}</Alert>
      )}

      {!isLoading && !isError && data.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          Chưa có hoạt động nào trên kỳ lương này.
        </Typography>
      )}

      <Stack component="ol" sx={{ listStyle: "none", m: 0, p: 0 }}>
        {data.map((hd, i) => {
          const kieu = KIEU_HOAT_DONG[hd.type] ?? KIEU_HOAT_DONG.EDIT;
          const Icon = kieu.icon;
          const cuoi = i === data.length - 1;
          return (
            <Stack component="li" key={hd.id} direction="row" spacing={1.5}>
              <Stack sx={{ alignItems: "center" }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    color: kieu.mau,
                    border: "1.5px solid",
                    borderColor: alpha(kieu.mau, 0.6),
                    bgcolor: alpha(kieu.mau, 0.06),
                    flexShrink: 0,
                  }}
                >
                  <Icon sx={{ fontSize: 16 }} />
                </Box>
                {!cuoi && <Box sx={{ width: 1.5, flex: 1, minHeight: 16, bgcolor: "divider", my: 0.5 }} />}
              </Stack>
              <Box sx={{ pb: cuoi ? 0 : 2, minWidth: 0 }}>
                <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {hd.userName}
                  </Typography>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={hd.type}
                    sx={{
                      height: 20,
                      borderRadius: 1,
                      fontSize: 11,
                      fontWeight: 600,
                      color: kieu.mau,
                      borderColor: alpha(kieu.mau, 0.6),
                    }}
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, overflowWrap: "anywhere" }}>
                  {hd.description}
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  {thoiDiem(hd.createdAt)}
                </Typography>
              </Box>
            </Stack>
          );
        })}
      </Stack>
    </Paper>
  );
}
