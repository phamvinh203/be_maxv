import { useMemo } from "react";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import InputAdornment from "@mui/material/InputAdornment";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import SearchRounded from "@mui/icons-material/SearchRounded";
import { sapXepCay } from "../../_shared/cay";
import { LOAI_HD, PHAM_VI_AP_DUNG } from "../../_shared/constants";
import { usePhongBanList } from "../../api/du_lieu_nhan_vien/phongBanQueries";
import type { LoaiHopDong, LocNhanVienKyLuong, PhamViApDung } from "../../types";

interface Props {
  phamVi: PhamViApDung;
  onPhamVi: (phamVi: PhamViApDung) => void;
  filters: LocNhanVienKyLuong;
  onFilters: (filters: LocNhanVienKyLuong) => void;
  /** Số nhân viên đang hiện ở bảng bên dưới — ghép vào dòng chú thích. */
  soNhanVien: number;
}

/**
 * Thanh chọn phạm vi + ba ô lọc, dùng chung cho các màn hình của khu "Dữ liệu
 * tính lương".
 *
 * Ba ô lọc đổi tác dụng theo phạm vi: "Toàn công ty" khóa hết vì đã lấy trọn
 * danh sách, "Phòng ban" chỉ còn ô phòng ban, "Nhân viên" mở cả ba. Khóa ô thay
 * vì giấu đi để bố cục thanh công cụ không nhảy mỗi lần đổi phạm vi.
 *
 * KHÔNG còn nút "Lưu thay đổi": API `payroll-data/*` không có khái niệm "mẫu
 * đã lưu nhưng chưa áp dụng" riêng biệt (bản mock trước đây có) — bảng đang
 * soạn ở mỗi Panel chỉ là state cục bộ, ghi thật duy nhất qua nút "Áp dụng".
 */
export default function ThanhLocKyLuong({
  phamVi,
  onPhamVi,
  filters,
  onFilters,
  soNhanVien,
}: Props) {
  const phongBan = usePhongBanList();
  const cayPhongBan = useMemo(() => sapXepCay(phongBan), [phongBan]);

  const moTaPhamVi = PHAM_VI_AP_DUNG.find((item) => item.value === phamVi)?.moTa ?? "";
  const toanCongTy = phamVi === "toan_cong_ty";

  const dat = <K extends keyof LocNhanVienKyLuong>(
    khoa: K,
    giaTri: LocNhanVienKyLuong[K],
  ) => onFilters({ ...filters, [khoa]: giaTri });

  return (
    <>
      <Stack
        direction={{ xs: "column", xl: "row" }}
        spacing={1.5}
        sx={{ alignItems: { xl: "center" }, justifyContent: "space-between" }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={phamVi}
          onChange={(_, giaTri: PhamViApDung | null) => giaTri !== null && onPhamVi(giaTri)}
        >
          {PHAM_VI_AP_DUNG.map((item) => (
            <ToggleButton
              key={item.value}
              value={item.value}
              sx={{ textTransform: "none", px: 2 }}
            >
              {item.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          <TextField
            size="small"
            placeholder="Tìm mã/tên nhân viên"
            value={filters.q}
            onChange={(e) => dat("q", e.target.value)}
            disabled={phamVi !== "nhan_vien"}
            sx={{ width: { xs: "100%", md: 240 } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRounded fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            select
            size="small"
            label="Phòng ban"
            value={filters.ma_pb}
            onChange={(e) => dat("ma_pb", e.target.value)}
            disabled={toanCongTy}
            required={phamVi === "phong_ban"}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">Tất cả phòng ban</MenuItem>
            <Divider />
            {cayPhongBan.map((pb) => (
              <MenuItem key={pb.ma_pb} value={pb.ma_pb}>
                {" ".repeat((pb.cap - 1) * 4)}
                {pb.ten_pb}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Loại HĐ"
            value={filters.loai_hd}
            onChange={(e) => dat("loai_hd", e.target.value as LoaiHopDong | "")}
            disabled={toanCongTy}
            sx={{ minWidth: 190 }}
          >
            <MenuItem value="">Tất cả loại HĐ</MenuItem>
            {LOAI_HD.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Stack>

      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
        {moTaPhamVi} Đang có <strong>{soNhanVien}</strong> nhân viên trong danh sách.
      </Typography>
    </>
  );
}
