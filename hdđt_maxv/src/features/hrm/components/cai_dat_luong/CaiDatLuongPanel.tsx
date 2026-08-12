import { useState } from "react";
import { toast } from "react-toastify";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { getErrorMessage } from "../../../../lib/errors";
import { useXoaKhoanLuong, type KhoanLuongFilters } from "../../mock/hooks/khoanLuong";
import type { KhoanLuong, LoaiKhoanLuong } from "../../types";
import XacNhanXoaDialog from "../XacNhanXoaDialog";
import KhoanLuongFormDialog from "./KhoanLuongFormDialog";
import KhoanLuongTable from "./KhoanLuongTable";
import TaoDanhMucPanel from "./TaoDanhMucPanel";

/**
 * Màn hình Cài đặt lương › Danh mục lương & phụ cấp.
 *
 * Hai cột: trái là các nút tạo theo bảy loại khoản kiêm bộ lọc, phải là bảng
 * danh mục. Trạng thái lọc và dialog nằm ở đây vì cả hai cột cùng đọc — bấm
 * "Lương KPI" bên trái thì bảng bên phải lọc theo, không phải chọn lại lần nữa.
 */
export default function CaiDatLuongPanel() {
  const xoaKhoan = useXoaKhoanLuong();

  const [filters, setFilters] = useState<KhoanLuongFilters>({ q: "", loai: "" });
  const [formOpen, setFormOpen] = useState(false);
  const [loaiDangTao, setLoaiDangTao] = useState<LoaiKhoanLuong>("luong_phu_cap");
  const [dangSua, setDangSua] = useState<KhoanLuong | undefined>(undefined);
  const [dangXoa, setDangXoa] = useState<KhoanLuong | undefined>(undefined);

  const moTao = (loai: LoaiKhoanLuong) => {
    setDangSua(undefined);
    setLoaiDangTao(loai);
    setFormOpen(true);
  };

  const moSua = (khoan: KhoanLuong) => {
    setDangSua(khoan);
    setLoaiDangTao(khoan.loai);
    setFormOpen(true);
  };

  const xacNhanXoa = async () => {
    if (!dangXoa) return;
    try {
      await xoaKhoan(dangXoa.ma_khoan);
      toast.success(`Đã xóa khoản ${dangXoa.ten_khoan}.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không xóa được khoản lương."));
    } finally {
      setDangXoa(undefined);
    }
  };

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Danh mục lương &amp; phụ cấp
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Khai báo các khoản cấu thành bảng lương và quy định khoản nào vào gốc đóng BHXH,
          khoản nào chịu thuế TNCN.
        </Typography>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "320px minmax(0, 1fr)" },
          gap: 2.5,
          alignItems: "start",
        }}
      >
        <TaoDanhMucPanel
          onTao={moTao}
          loaiDangLoc={filters.loai}
          onLoc={(loai) => setFilters((cu) => ({ ...cu, loai }))}
        />

        <KhoanLuongTable
          filters={filters}
          onTuKhoaChange={(q) => setFilters((cu) => ({ ...cu, q }))}
          onSua={moSua}
          onXoa={setDangXoa}
        />
      </Box>

      <KhoanLuongFormDialog
        open={formOpen}
        loai={loaiDangTao}
        khoan={dangSua}
        onClose={() => setFormOpen(false)}
      />
      <XacNhanXoaDialog
        open={Boolean(dangXoa)}
        tieuDe="Xóa khoản lương"
        noiDung={
          <>
            Xóa khoản <strong>{dangXoa?.ten_khoan}</strong> ({dangXoa?.ma_khoan})? Nếu khoản
            này đã dùng ở kỳ lương cũ, nên chuyển sang trạng thái Ngừng thay vì xóa.
          </>
        }
        onClose={() => setDangXoa(undefined)}
        onXacNhan={xacNhanXoa}
      />
    </Stack>
  );
}
