import { Link as RouterLink } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import type { SxProps, Theme } from "@mui/material/styles";
import LockRounded from "@mui/icons-material/LockRounded";
import { DUONG_DAN_CHOT_KY_LUONG } from "../chot_ky_luong/bangKe";

interface Props {
  /** Lấy từ `useBangKeChiDoc` — đúng khi lý do chỉ đọc là bảng kê đã chốt số, không phải kỳ khóa sổ. */
  bangKeDaChot: boolean;
  /** Phần đuôi câu, vd "không thể sửa hoặc áp dụng KPI mới". */
  hanhDong: string;
  sx?: SxProps<Theme>;
}

/** Dòng cảnh báo "chỉ đọc" dùng chung cho 8 màn nhập liệu — nói rõ VÌ SAO không sửa được. */
export default function CanhBaoChiDoc({ bangKeDaChot, hanhDong, sx }: Props) {
  if (bangKeDaChot) {
    return (
      <Alert
        severity="info"
        icon={<LockRounded />}
        sx={sx}
        action={
          <Button
            component={RouterLink}
            to={DUONG_DAN_CHOT_KY_LUONG}
            color="inherit"
            size="small"
            sx={{ textTransform: "none", whiteSpace: "nowrap" }}
          >
            Mở màn Chốt kỳ lương
          </Button>
        }
      >
        Bảng kê này đã được <strong>chốt số</strong> cho kỳ lương — {hanhDong}. Mở chốt ở màn Chốt kỳ
        lương nếu cần sửa.
      </Alert>
    );
  }
  return (
    <Alert severity="warning" sx={sx}>
      Kỳ lương đang chọn đã khóa sổ/chờ duyệt — {hanhDong}.
    </Alert>
  );
}
