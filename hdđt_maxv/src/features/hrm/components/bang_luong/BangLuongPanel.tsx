import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import CalculateRounded from "@mui/icons-material/CalculateRounded";
import SavingsRounded from "@mui/icons-material/SavingsRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import { alpha } from "@mui/material/styles";
import { getErrorMessage } from "../../../../lib/errors";
import { CHE_DO_HIEN_THI, tongBangLuong } from "../../bangLuong";
import { tienVn } from "../../format";
import {
  useBangLuongRows,
  useKyBangLuong,
  useSoNhanVienDangLam,
} from "../../mock/hooks/bangLuong";
import type { BangLuongFilters, CheDoHienThi, MucChiTiet } from "../../types";
import BangLuongTable from "./BangLuongTable";
import ThanhLocBangLuong from "./ThanhLocBangLuong";
import { xuatBangLuongExcel } from "./bangLuongExcel";

const MUC_CHI_TIET: { value: MucChiTiet; label: string }[] = [
  { value: "day_du", label: "Đầy đủ" },
  { value: "rut_gon", label: "Rút gọn" },
];

/** Giờ:phút:giây của lần tính gần nhất — hiện cạnh nút "Tính lại lương". */
function gioHienTai(): string {
  return new Date().toLocaleTimeString("vi-VN");
}

interface ThongKeProps {
  nhan: string;
  gia_tri: number;
  mau: "primary" | "success" | "warning";
  icon: React.ReactNode;
  moTa: string;
}

function TheThongKe({ nhan, gia_tri, mau, icon, moTa }: ThongKeProps) {
  return (
    <Paper variant="outlined" sx={{ p: 2, flex: 1, minWidth: 220 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 44,
            height: 44,
            borderRadius: 2,
            color: `${mau}.main`,
            bgcolor: (theme) => alpha(theme.palette[mau].main, 0.12),
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">
            {nhan}
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>
            {tienVn(gia_tri)} ₫
          </Typography>
          <Typography variant="caption" color="text.disabled">
            {moTa}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

/**
 * Bảng lương của kỳ hiện tại.
 *
 * Màn hình này **chỉ đọc**: mọi con số ráp từ Set lương, Chấm công và bảy màn
 * của khu Dữ liệu tính lương. Sai số ở đây thì phải sửa ở màn nguồn rồi bấm
 * "Tính lại lương", chứ không sửa tay trên bảng — sửa tay là bảng lương và dữ
 * liệu gốc nói hai chuyện khác nhau.
 */
export default function BangLuongPanel() {
  const ky = useKyBangLuong();
  const soNhanVien = useSoNhanVienDangLam();

  const [filters, setFilters] = useState<BangLuongFilters>({
    q: "",
    ma_pb: "",
    loai_hd: "",
    kieu_luong: "",
  });
  const [cheDo, setCheDo] = useState<CheDoHienThi>("dong");
  const [mucChiTiet, setMucChiTiet] = useState<MucChiTiet>("day_du");
  const [nonce, setNonce] = useState(0);
  const [tinhLuc, setTinhLuc] = useState(gioHienTai);
  const [dangXuat, setDangXuat] = useState(false);

  const rows = useBangLuongRows(filters, nonce);
  const tong = useMemo(() => tongBangLuong(rows), [rows]);

  const handleTinhLai = () => {
    setNonce((cu) => cu + 1);
    setTinhLuc(gioHienTai());
    toast.success(`Đã tính lại bảng lương cho ${rows.length} nhân viên.`);
  };

  const handleXuat = async () => {
    setDangXuat(true);
    try {
      await xuatBangLuongExcel(rows, ky.nhan);
      toast.success("Đã xuất bảng lương — file ghi đủ 18 cột và theo đơn vị đồng.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Không xuất được bảng lương."));
    } finally {
      setDangXuat(false);
    }
  };

  return (
    <Stack spacing={2.5}>
      <Stack
        direction={{ xs: "column", xl: "row" }}
        spacing={2}
        sx={{ alignItems: { xl: "flex-start" }, justifyContent: "space-between" }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ flexGrow: 1 }}>
          <TheThongKe
            nhan="Tổng quỹ lương"
            gia_tri={tong.quy_luong}
            mau="primary"
            icon={<SavingsRounded />}
            moTa="Gồm cả bảo hiểm và KPCĐ công ty đóng"
          />
          <TheThongKe
            nhan="Tổng thực lĩnh"
            gia_tri={tong.thuc_linh}
            mau="success"
            icon={<PaymentsRounded />}
            moTa="Số tiền thực trả cho nhân viên"
          />
          <TheThongKe
            nhan="Tổng thuế TNCN"
            gia_tri={tong.thue_tncn}
            mau="warning"
            icon={<ReceiptLongRounded />}
            moTa="Khấu trừ nộp thay nhân viên"
          />
        </Stack>

        <Stack spacing={0.5} sx={{ alignItems: { xl: "flex-end" } }}>
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1.5 }}>
            <TextField
              select
              size="small"
              label="Chế độ"
              value={cheDo}
              onChange={(e) => setCheDo(e.target.value as CheDoHienThi)}
              sx={{ minWidth: 150 }}
            >
              {CHE_DO_HIEN_THI.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Chi tiết"
              value={mucChiTiet}
              onChange={(e) => setMucChiTiet(e.target.value as MucChiTiet)}
              sx={{ minWidth: 130 }}
            >
              {MUC_CHI_TIET.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </TextField>
            <Button
              startIcon={<FileDownloadRounded />}
              onClick={handleXuat}
              disabled={dangXuat || rows.length === 0}
              sx={{ textTransform: "none", whiteSpace: "nowrap" }}
            >
              Xuất Excel
            </Button>
            <Button
              variant="contained"
              startIcon={<CalculateRounded />}
              onClick={handleTinhLai}
              sx={{ textTransform: "none", whiteSpace: "nowrap" }}
            >
              Tính lại lương
            </Button>
          </Stack>
          <Typography variant="caption" color="text.disabled">
            {ky.nhan} · tính lúc {tinhLuc}
          </Typography>
        </Stack>
      </Stack>

      <ThanhLocBangLuong
        filters={filters}
        onFilters={setFilters}
        soHienThi={rows.length}
        soTong={soNhanVien}
      />

      <BangLuongTable rows={rows} cheDo={cheDo} rutGon={mucChiTiet === "rut_gon"} />

      <Typography variant="caption" color="text.secondary">
        Số liệu ráp từ Set lương, Chấm công và các màn của khu Dữ liệu tính lương. Lương phần
        trăm và Chuyên cần không có cột riêng — di chuột vào cột "Thu nhập" để xem đủ bảy khoản
        cấu thành.
      </Typography>
    </Stack>
  );
}
