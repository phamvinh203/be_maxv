import type { ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TrendingDownRounded from "@mui/icons-material/TrendingDownRounded";
import TrendingUpRounded from "@mui/icons-material/TrendingUpRounded";
import { LOI_KHONG_CO_QUYEN_LUONG } from "../../api/du_lieu_nhan_vien/quyenLuongQueries";

/** Trạng thái thay chỗ nội dung, ưu tiên: không có quyền lương → lỗi → đang tải. */
interface TrangThaiChan {
  biTuChoi?: boolean;
  loi?: string | null;
  dangTai?: boolean;
  /** Khung xương riêng lúc tải; mặc định 4 dòng. */
  khungTai?: ReactNode;
}

interface Props {
  tieuDe: string;
  phuDe?: ReactNode;
  icon?: ReactNode;
  /** Góc phải tiêu đề: chip đếm, nút mở màn chi tiết. */
  hanhDong?: ReactNode;
  chan?: TrangThaiChan;
  /** Truyền HÀM thì chỉ được gọi khi không bị `chan` — nội dung được giả định dữ liệu đã có. */
  children: ReactNode | (() => ReactNode);
}

function noiDungChan(chan: TrangThaiChan | undefined): ReactNode {
  if (chan?.biTuChoi) return <Alert severity="info">{LOI_KHONG_CO_QUYEN_LUONG}</Alert>;
  if (chan?.loi) return <Alert severity="error">{chan.loi}</Alert>;
  if (chan?.dangTai) return chan.khungTai ?? <DangTai />;
  return null;
}

/** Khung chung của mọi thẻ trên Dashboard — cùng lề, cùng kiểu tiêu đề, cao bằng hàng. */
export default function TheDashboard({ tieuDe, phuDe, icon, hanhDong, chan, children }: Props) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2.5, height: "100%", minWidth: 0, display: "flex", flexDirection: "column" }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "flex-start", mb: 2 }}>
        {icon && (
          <Box sx={{ color: "primary.main", display: "flex", mt: 0.25 }}>{icon}</Box>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.35 }}>
            {tieuDe}
          </Typography>
          {phuDe && (
            <Typography component="div" variant="body2" color="text.secondary">
              {phuDe}
            </Typography>
          )}
        </Box>
        {hanhDong && <Box sx={{ flexShrink: 0 }}>{hanhDong}</Box>}
      </Stack>
      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {noiDungChan(chan) ?? (typeof children === "function" ? children() : children)}
      </Box>
    </Paper>
  );
}

/** Lần tải ĐẦU — tải lại thì giữ nguyên số cũ, không nháy khung xương. */
export function DangTai({ soDong = 4, cao = 28 }: { soDong?: number; cao?: number }) {
  return (
    <Stack spacing={1}>
      {Array.from({ length: soDong }, (_, i) => (
        <Skeleton key={i} variant="rounded" height={cao} />
      ))}
    </Stack>
  );
}

export function ThongBaoRong({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <Stack
      spacing={1}
      sx={{ flex: 1, alignItems: "center", justifyContent: "center", py: 4, color: "text.disabled" }}
    >
      {icon}
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
        {children}
      </Typography>
    </Stack>
  );
}

/** Danh sách cuộn trong thẻ — các thẻ trên cùng hàng giữ chiều cao tương đương. */
export function DanhSach({ children }: { children: ReactNode }) {
  return (
    <List disablePadding sx={{ mx: -1, maxHeight: 340, overflowY: "auto" }}>
      {children}
    </List>
  );
}

/** Một dòng bấm được: [đầu] tên đậm + dòng phụ · [cuối] căn phải. */
export function DongDanhSach({
  dau,
  tieuDe,
  phu,
  cuoi,
  onClick,
  mo,
}: {
  dau?: ReactNode;
  tieuDe: ReactNode;
  phu: ReactNode;
  cuoi: ReactNode;
  onClick: () => void;
  /** Làm mờ dòng đã qua (vd sinh nhật đã qua trong tháng). */
  mo?: boolean;
}) {
  return (
    <ListItemButton onClick={onClick} sx={{ borderRadius: 1, px: 1, gap: 1.5, opacity: mo ? 0.6 : 1 }}>
      {dau}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
          {tieuDe}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
          {phu}
        </Typography>
      </Box>
      <Box sx={{ flexShrink: 0, textAlign: "right" }}>{cuoi}</Box>
    </ListItemButton>
  );
}

/** Chênh lệch so với kỳ trước — chữ màu trung tính: tăng không mặc nhiên là tốt hay xấu. */
export function SoSanh({
  chenh,
  dinhDang,
  moc,
}: {
  chenh: number;
  dinhDang: (giaTri: number) => string;
  moc: string;
}) {
  const Icon = chenh < 0 ? TrendingDownRounded : TrendingUpRounded;
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", color: "text.secondary" }}>
      <Icon sx={{ fontSize: 16 }} />
      <Typography variant="caption">
        {chenh === 0 ? "Bằng" : `${chenh > 0 ? "+" : "−"}${dinhDang(Math.abs(chenh))} so với`} {moc}
      </Typography>
    </Stack>
  );
}
