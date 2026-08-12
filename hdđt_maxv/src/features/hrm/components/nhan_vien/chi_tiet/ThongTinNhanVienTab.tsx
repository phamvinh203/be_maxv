import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import SwapHorizRounded from "@mui/icons-material/SwapHorizRounded";
import PersonRounded from "@mui/icons-material/PersonRounded";
import WorkRounded from "@mui/icons-material/WorkRounded";
import DescriptionRounded from "@mui/icons-material/DescriptionRounded";
import AccountBalanceRounded from "@mui/icons-material/AccountBalanceRounded";
import {
  CHUC_VU,
  GIOI_TINH,
  KIEU_LUONG,
  LOAI_HD,
  TRANG_THAI_NV,
} from "../../../constants";
import { homNay, ngayVn, nhan, tienVn } from "../../../format";
import { trangThaiHopDong } from "../../../cay";
import { usePhongBanList } from "../../../mock/hooks/phongBan";
import type { HopDong, NhanVien } from "../../../types";
import OThongTin from "../../OThongTin";

interface Props {
  nhanVien: NhanVien;
  hopDongHienTai: HopDong | null;
  onThayDoiHopDong: () => void;
}

function Nhom({
  tieuDe,
  icon,
  hanhDong,
  children,
}: {
  tieuDe: string;
  icon: ReactNode;
  hanhDong?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ alignItems: { sm: "center" }, justifyContent: "space-between", mb: 2 }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          {icon}
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {tieuDe}
          </Typography>
        </Stack>
        {hanhDong}
      </Stack>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(4, 1fr)" },
          gap: 2.5,
        }}
      >
        {children}
      </Box>
    </Paper>
  );
}

/** Bốn nhóm thông tin của một nhân viên, chỉ đọc. Sửa thì mở hồ sơ chỉnh sửa. */
export default function ThongTinNhanVienTab({
  nhanVien,
  hopDongHienTai,
  onThayDoiHopDong,
}: Props) {
  const phongBan = usePhongBanList();
  const tenPb = phongBan.find((pb) => pb.ma_pb === nhanVien.ma_pb)?.ten_pb ?? "";
  const moc = homNay();

  return (
    <Stack spacing={2.5}>
      <Nhom tieuDe="Thông tin cá nhân" icon={<PersonRounded color="primary" />}>
        <OThongTin nhan="Mã nhân viên" giaTri={nhanVien.ma_nv} />
        <OThongTin nhan="Họ và tên" giaTri={nhanVien.ho_ten} />
        <OThongTin nhan="Số CCCD" giaTri={nhanVien.so_cccd} />
        <OThongTin nhan="MST cá nhân" giaTri={nhanVien.mst_ca_nhan} />
        <OThongTin nhan="Ngày sinh" giaTri={nhanVien.ngay_sinh ? ngayVn(nhanVien.ngay_sinh) : ""} />
        <OThongTin nhan="Giới tính" giaTri={nhan(GIOI_TINH, nhanVien.gioi_tinh)} />
        <OThongTin nhan="Điện thoại" giaTri={nhanVien.dien_thoai} />
        <OThongTin nhan="Email" giaTri={nhanVien.email} />
        <Box sx={{ gridColumn: { sm: "1 / -1" } }}>
          <OThongTin nhan="Địa chỉ" giaTri={nhanVien.dia_chi} />
        </Box>
        <Box sx={{ gridColumn: { sm: "1 / -1" } }}>
          <OThongTin nhan="Ghi chú" giaTri={nhanVien.ghi_chu} />
        </Box>
      </Nhom>

      <Nhom tieuDe="Thông tin công việc" icon={<WorkRounded color="primary" />}>
        <OThongTin nhan="Phòng ban" giaTri={tenPb} />
        <OThongTin nhan="Chức vụ" giaTri={nhanVien.ma_cv ? nhan(CHUC_VU, nhanVien.ma_cv) : ""} />
        <OThongTin nhan="Cấp bậc" giaTri={nhanVien.cap_bac} />
        <OThongTin nhan="Ngày vào" giaTri={nhanVien.ngay_vao ? ngayVn(nhanVien.ngay_vao) : ""} />
        <OThongTin
          nhan="Tham gia công đoàn"
          giaTri={
            <Chip
              size="small"
              label={nhanVien.cong_doan ? "Có" : "Không"}
              color={nhanVien.cong_doan ? "primary" : "default"}
              variant={nhanVien.cong_doan ? "filled" : "outlined"}
              sx={{ height: 22, mt: 0.25 }}
            />
          }
        />
        <OThongTin
          nhan="Trạng thái"
          giaTri={
            <Chip
              size="small"
              label={nhan(TRANG_THAI_NV, nhanVien.status)}
              color={nhanVien.status === "1" ? "success" : "default"}
              variant={nhanVien.status === "1" ? "filled" : "outlined"}
              sx={{ height: 22, mt: 0.25 }}
            />
          }
        />
      </Nhom>

      <Nhom
        tieuDe="Thông tin hợp đồng"
        icon={<DescriptionRounded color="primary" />}
        hanhDong={
          <Button
            variant="outlined"
            startIcon={<SwapHorizRounded />}
            onClick={onThayDoiHopDong}
            sx={{ textTransform: "none" }}
          >
            Thay đổi hợp đồng
          </Button>
        }
      >
        {hopDongHienTai ? (
          <>
            <OThongTin nhan="Số hợp đồng" giaTri={hopDongHienTai.so_hd} />
            <OThongTin nhan="Loại hợp đồng" giaTri={nhan(LOAI_HD, hopDongHienTai.loai_hd)} />
            <OThongTin
              nhan="Kiểu lương"
              giaTri={nhan(KIEU_LUONG, hopDongHienTai.kieu_luong).split(" — ")[0]}
            />
            <OThongTin
              nhan="Trạng thái"
              giaTri={
                <Chip
                  size="small"
                  label={trangThaiHopDong(hopDongHienTai, moc)}
                  color={
                    trangThaiHopDong(hopDongHienTai, moc) === "Hiệu lực" ? "success" : "default"
                  }
                  variant={
                    trangThaiHopDong(hopDongHienTai, moc) === "Hết hạn" ? "outlined" : "filled"
                  }
                  sx={{ height: 22, mt: 0.25 }}
                />
              }
            />
            <OThongTin nhan="Ngày bắt đầu" giaTri={ngayVn(hopDongHienTai.ngay_bat_dau)} />
            <OThongTin
              nhan="Ngày kết thúc"
              giaTri={
                hopDongHienTai.ngay_ket_thuc
                  ? ngayVn(hopDongHienTai.ngay_ket_thuc)
                  : "Không xác định"
              }
            />
            <OThongTin nhan="Lương chính" giaTri={`${tienVn(hopDongHienTai.luong_chinh)} ₫`} />
            <OThongTin
              nhan="Lương đóng BHXH"
              giaTri={`${tienVn(hopDongHienTai.luong_bhxh)} ₫`}
            />
            <OThongTin
              nhan="Trích đóng BHXH"
              giaTri={hopDongHienTai.trich_bhxh ? "Có" : "Không"}
            />
            <OThongTin
              nhan="Tính thuế TNCN"
              giaTri={hopDongHienTai.tinh_tncn ? "Có" : "Không"}
            />
            <Box sx={{ gridColumn: { sm: "1 / -1" } }}>
              <OThongTin nhan="Ghi chú" giaTri={hopDongHienTai.ghi_chu} />
            </Box>
          </>
        ) : (
          <Box sx={{ gridColumn: "1 / -1" }}>
            <Typography variant="body2" color="text.secondary">
              Nhân viên này chưa có hợp đồng nào.
            </Typography>
          </Box>
        )}
      </Nhom>

      <Nhom tieuDe="Tài khoản ngân hàng" icon={<AccountBalanceRounded color="primary" />}>
        <OThongTin nhan="Ngân hàng" giaTri={nhanVien.ngan_hang} />
        <OThongTin nhan="Số tài khoản" giaTri={nhanVien.so_tk} />
        <OThongTin nhan="Tên chủ tài khoản" giaTri={nhanVien.chu_tk} />
      </Nhom>
    </Stack>
  );
}
