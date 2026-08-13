import { useMemo } from "react";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import InputAdornment from "@mui/material/InputAdornment";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import SearchRounded from "@mui/icons-material/SearchRounded";
import { sapXepCay } from "../../cay";
import { KIEU_LUONG, LOAI_HD } from "../../constants";
import { usePhongBanList } from "../../mock/hooks/phongBan";
import type { BangLuongFilters, KieuLuong, LoaiHopDong } from "../../types";

interface Props {
  filters: BangLuongFilters;
  onFilters: (filters: BangLuongFilters) => void;
  /** Số dòng đang hiện sau khi lọc. */
  soHienThi: number;
  /** Tổng nhân viên đang làm — mẫu số của chip bên phải. */
  soTong: number;
}

/**
 * Thanh lọc dùng chung cho hai tab của khu "Bảng lương".
 *
 * Hai màn hình lọc trên **cùng một tập** nhân viên theo cùng bốn tiêu chí, nên
 * tách ra một chỗ: viết hai lần thì sớm muộn cũng có bên quên sửa và hai tab
 * hiện ra hai danh sách khác nhau cho cùng bộ lọc.
 */
export default function ThanhLocBangLuong({
  filters,
  onFilters,
  soHienThi,
  soTong,
}: Props) {
  const phongBan = usePhongBanList();
  const cayPhongBan = useMemo(() => sapXepCay(phongBan), [phongBan]);

  const dat = <K extends keyof BangLuongFilters>(khoa: K, giaTri: BangLuongFilters[K]) =>
    onFilters({ ...filters, [khoa]: giaTri });

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={1.5}
        sx={{ alignItems: { lg: "center" }, justifyContent: "space-between" }}
      >
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          <TextField
            size="small"
            placeholder="Tìm mã/tên nhân viên"
            value={filters.q}
            onChange={(e) => dat("q", e.target.value)}
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
            label="Hợp đồng"
            value={filters.loai_hd}
            onChange={(e) => dat("loai_hd", e.target.value as LoaiHopDong | "")}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">Tất cả hợp đồng</MenuItem>
            {LOAI_HD.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Kiểu lương"
            value={filters.kieu_luong}
            onChange={(e) => dat("kieu_luong", e.target.value as KieuLuong | "")}
            sx={{ minWidth: 190 }}
          >
            <MenuItem value="">Tất cả kiểu lương</MenuItem>
            {KIEU_LUONG.map((item) => (
              <MenuItem key={item.value} value={item.value}>
                {item.value}
              </MenuItem>
            ))}
          </TextField>
        </Stack>

        <Chip
          size="small"
          color="primary"
          variant="outlined"
          // Chỉ hiện dạng phân số khi đang lọc — không lọc mà thấy "11 / tổng
          // 11" thì thừa và làm người đọc tưởng có gì bị ẩn.
          label={
            soHienThi === soTong
              ? `Tổng ${soTong} nhân viên`
              : `${soHienThi} / tổng ${soTong} nhân viên`
          }
          sx={{ fontWeight: 600, whiteSpace: "nowrap" }}
        />
      </Stack>
    </Paper>
  );
}
