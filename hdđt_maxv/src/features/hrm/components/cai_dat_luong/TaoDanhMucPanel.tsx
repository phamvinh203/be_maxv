import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import AddRounded from "@mui/icons-material/AddRounded";
import { LOAI_KHOAN_LUONG } from "../../constants";
import { useSoKhoanTheoLoai } from "../../mock/hooks/khoanLuong";
import type { LoaiKhoanLuong } from "../../types";

interface Props {
  onTao: (loai: LoaiKhoanLuong) => void;
  /** Loại đang được lọc ở bảng bên phải — rỗng là đang xem tất cả. */
  loaiDangLoc: LoaiKhoanLuong | "";
  onLoc: (loai: LoaiKhoanLuong | "") => void;
}

/**
 * Cột "Tạo danh mục" bên trái.
 *
 * Mỗi dòng vừa là nút tạo, vừa là bộ lọc cho bảng bên phải: bấm vào tên loại để
 * xem riêng loại đó, bấm dấu cộng để tạo mới. Gộp hai việc vào một hàng vì
 * người dùng gần như luôn tạo xong rồi muốn xem ngay loại vừa tạo.
 */
export default function TaoDanhMucPanel({ onTao, loaiDangLoc, onLoc }: Props) {
  const soTheoLoai = useSoKhoanTheoLoai();

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
        Tạo danh mục
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Bấm tên loại để lọc bảng bên phải.
      </Typography>

      <Stack spacing={1}>
        <Button
          fullWidth
          variant={loaiDangLoc === "" ? "contained" : "outlined"}
          onClick={() => onLoc("")}
          sx={{ textTransform: "none", justifyContent: "space-between" }}
        >
          Tất cả khoản
          <Chip
            size="small"
            label={[...soTheoLoai.values()].reduce((a, b) => a + b, 0)}
            sx={{ height: 20 }}
          />
        </Button>

        {LOAI_KHOAN_LUONG.map((moTa) => {
          const dangChon = loaiDangLoc === moTa.value;
          return (
            <Box
              key={moTa.value}
              sx={{
                display: "flex",
                alignItems: "stretch",
                gap: 0.5,
                borderRadius: 1,
                bgcolor: dangChon ? "action.selected" : undefined,
              }}
            >
              <Button
                fullWidth
                color="inherit"
                onClick={() => onLoc(moTa.value)}
                sx={{
                  textTransform: "none",
                  justifyContent: "space-between",
                  fontWeight: dangChon ? 700 : 500,
                  minWidth: 0,
                }}
              >
                <Box sx={{ textAlign: "left", minWidth: 0 }}>
                  <Typography variant="body2" noWrap sx={{ fontWeight: "inherit" }}>
                    {moTa.label}
                  </Typography>
                </Box>
                <Chip size="small" label={soTheoLoai.get(moTa.value) ?? 0} sx={{ height: 20 }} />
              </Button>
              <Button
                variant="outlined"
                onClick={() => onTao(moTa.value)}
                title={moTa.nhanNut}
                aria-label={moTa.nhanNut}
                sx={{ minWidth: 40, px: 0, flexShrink: 0 }}
              >
                <AddRounded fontSize="small" />
              </Button>
            </Box>
          );
        })}
      </Stack>
    </Paper>
  );
}
