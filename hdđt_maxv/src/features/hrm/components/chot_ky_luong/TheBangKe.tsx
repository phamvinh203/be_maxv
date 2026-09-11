import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { alpha, useTheme } from "@mui/material/styles";
import LockRounded from "@mui/icons-material/LockRounded";
import LockOpenRounded from "@mui/icons-material/LockOpenRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import EventRounded from "@mui/icons-material/EventRounded";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import type { BangKeApiItem } from "../../api/chot_ky_luong/chotKyLuongQueries";
import { hienThiBangKe } from "./bangKe";
import IconVuong from "./IconVuong";

const O_NUT = { flex: "1 1 0", minWidth: 0, display: "flex" } as const;

/** "16:38 10/9/26" — gọn như trên thẻ, đủ để biết chốt lúc nào; ngày giờ đầy đủ ở tooltip. */
function gioChotNgan(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm} ${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`;
}

interface Props {
  bangKe: BangKeApiItem;
  /** Kỳ đã khóa sổ — mọi bảng kê coi như đã chốt, không chốt/mở chốt lẻ được nữa. */
  periodLocked: boolean;
  laChuTaiKhoan: boolean;
  dangXuLy: boolean;
  onChot: () => void;
  onMoChot: () => void;
}

export default function TheBangKe({
  bangKe,
  periodLocked,
  laChuTaiKhoan,
  dangXuLy,
  onChot,
  onMoChot,
}: Props) {
  const navigate = useNavigate();
  const theme = useTheme();
  // Màu KHÔNG hardcode hex — theo theme để đổi đúng theo sáng/tối (RVW-A14).
  const { icon: Icon, mau, duongDan } = hienThiBangKe(bangKe.module, theme.palette.mode === "dark");
  const daChot = bangKe.locked;
  const mauDaChot = theme.palette.error.main;
  const mauThe = daChot ? mauDaChot : mau;

  const moTaChot =
    daChot && bangKe.lockedAt
      ? `${bangKe.lockSource === "PERIOD" ? "Khóa sổ kỳ" : "Chốt số"}${
          bangKe.lockedByName ? ` bởi ${bangKe.lockedByName}` : ""
        } lúc ${new Date(bangKe.lockedAt).toLocaleString("vi-VN")}`
      : "";

  // Bảng kê đã chốt: một nút duy nhất — "Mở chốt", hoặc bị khóa kèm lý do (kỳ đã khóa sổ / không phải chủ TK).
  const lyDoKhongMoChot = periodLocked
    ? "Kỳ đã khóa sổ — mở lại kỳ lương trước khi mở chốt bảng kê."
    : laChuTaiKhoan
      ? ""
      : "Chỉ chủ tài khoản được mở chốt bảng kê.";

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        borderColor: alpha(mauThe, daChot ? 0.7 : 0.35),
        bgcolor: daChot ? alpha(mauDaChot, 0.04) : "background.paper",
        borderWidth: daChot ? 1.5 : 1,
        transition: "border-color .2s, background-color .2s",
      }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
        <IconVuong mau={mauThe}>
          {daChot ? <LockRounded fontSize="small" /> : <Icon fontSize="small" />}
        </IconVuong>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
              {bangKe.label}
            </Typography>
            {!bangKe.periodData && (
              <Tooltip title="Dữ liệu dùng chung nhiều kỳ — chốt số là xác nhận đã rà soát cho kỳ này, không khóa sửa danh mục.">
                <InfoOutlined sx={{ fontSize: 15, color: "text.disabled" }} />
              </Tooltip>
            )}
          </Stack>
          {daChot && bangKe.lockedAt && (
            <Tooltip title={moTaChot}>
              <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", color: "text.secondary", mt: 0.25 }}>
                <EventRounded sx={{ fontSize: 14 }} />
                <Typography variant="caption">{gioChotNgan(bangKe.lockedAt)}</Typography>
              </Stack>
            </Tooltip>
          )}
        </Box>
        <Chip
          size="small"
          variant="outlined"
          label={daChot ? "Đã chốt số" : "Đang mở"}
          color={daChot ? "error" : "success"}
          sx={{ borderRadius: 1, fontWeight: 600, height: 22, "& .MuiChip-label": { px: 0.75 } }}
        />
      </Stack>

      {/* Mỗi nút một ô `flex: 1 1 0` — hai nút luôn chia đôi, kể cả khi nút phải bọc trong <span> để hiện tooltip lúc bị khóa. */}
      <Stack direction="row" spacing={1} sx={{ mt: "auto" }}>
        {duongDan && (
          <Box sx={O_NUT}>
            <Button
              fullWidth
              size="small"
              variant="outlined"
              startIcon={<ChevronRightRounded />}
              onClick={() => navigate(duongDan)}
              sx={{ textTransform: "none", fontWeight: 600, borderColor: "divider" }}
            >
              Xem chi tiết
            </Button>
          </Box>
        )}
        <Box sx={O_NUT}>
          {daChot ? (
            <Tooltip title={lyDoKhongMoChot}>
              <span style={{ display: "flex", width: "100%" }}>
                <Button
                  fullWidth
                  size="small"
                  variant="contained"
                  color="info"
                  startIcon={periodLocked ? <LockRounded /> : <LockOpenRounded />}
                  onClick={onMoChot}
                  disabled={!!lyDoKhongMoChot || dangXuLy}
                  sx={{ textTransform: "none", fontWeight: 600 }}
                >
                  {periodLocked ? "Đã khóa sổ" : "Mở chốt"}
                </Button>
              </span>
            </Tooltip>
          ) : (
            <Button
              fullWidth
              size="small"
              variant="contained"
              color="warning"
              startIcon={<LockRounded />}
              onClick={onChot}
              disabled={dangXuLy}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              Chốt số liệu
            </Button>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}
