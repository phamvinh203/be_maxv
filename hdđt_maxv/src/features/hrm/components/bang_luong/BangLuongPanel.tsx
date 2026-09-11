import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import CalculateRounded from "@mui/icons-material/CalculateRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import SavingsRounded from "@mui/icons-material/SavingsRounded";
import PaymentsRounded from "@mui/icons-material/PaymentsRounded";
import ReceiptLongRounded from "@mui/icons-material/ReceiptLongRounded";
import { alpha } from "@mui/material/styles";
import { getApiError } from "@/lib/apiClient";
import { getErrorMessage } from "../../../../lib/errors";
import { CHE_DO_HIEN_THI, tongBangLuong } from "../../calculations/bang_luong/bangLuong";
import { tienVn } from "../../_shared/format";
import { useCurrentPayrollPeriod } from "../du_lieu_tinh_luong/useCurrentPayrollPeriod";
import { useBangLuongRows, useKyBangLuong, useSoNhanVienDangLam } from "../../api/bang_luong/bangLuongQueries";
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
 * Bảng lương của kỳ đang chọn.
 *
 * Màn hình này **chỉ đọc**: mọi con số tính sẵn ở `be_maxv` (`payrollCalculation.service.ts`) từ
 * Hợp đồng, Cài đặt lương, Chấm công và bảy phân hệ của khu Dữ liệu tính lương.
 *
 * Nguồn dữ liệu là `GET /payroll/sheet-lines` (`useBangLuongRows`), KHÔNG phải `/payroll/calculate`
 * — kỳ **DRAFT/PENDING_REVIEW** tính live y hệt `/payroll/calculate`; kỳ **đã khóa sổ**
 * (LOCKED/APPROVED/PAID/ARCHIVED) đọc snapshot đóng băng đúng lúc khóa, KHÔNG tính lại theo dữ
 * liệu nguồn hiện tại dù nó có đổi sau đó (`docs/hrm/CONTEXT_SUMMARY.md` Mục 1 "Snapshot bất
 * biến"). Sai số ở kỳ CHƯA khóa thì sửa ở màn nguồn rồi bấm nút tính lại; kỳ ĐÃ khóa muốn sửa số
 * phải "Mở lại kỳ lương" trước (nghiệp vụ có chủ đích, không phải bug).
 */
export default function BangLuongPanel() {
  const ky = useKyBangLuong();
  const soNhanVien = useSoNhanVienDangLam();
  const { isLocked } = useCurrentPayrollPeriod();

  const [filters, setFilters] = useState<BangLuongFilters>({
    q: "",
    ma_pb: "",
    loai_hd: "",
    kieu_luong: "",
  });
  const [cheDo, setCheDo] = useState<CheDoHienThi>("dong");
  const [mucChiTiet, setMucChiTiet] = useState<MucChiTiet>("day_du");
  const [tinhLuc, setTinhLuc] = useState<string | null>(null);
  const [dangXuat, setDangXuat] = useState(false);

  const { rows, isLoading, isFetching, isError, errorMessage, refetch } = useBangLuongRows(filters);
  const tong = useMemo(() => tongBangLuong(rows), [rows]);

  const handleTinhLai = async () => {
    const ketQua = await refetch();
    if (ketQua.isError) {
      toast.error(getApiError(ketQua.error, "Không tải lại được bảng lương."));
      return;
    }
    setTinhLuc(gioHienTai());
    toast.success(
      isLocked
        ? `Đã tải lại số liệu đã khóa sổ cho ${ketQua.data?.length ?? 0} nhân viên.`
        : `Đã tính lại bảng lương cho ${ketQua.data?.length ?? 0} nhân viên.`,
    );
  };

  const handleXuat = async () => {
    setDangXuat(true);
    try {
      await xuatBangLuongExcel(rows, ky.nhan);
      toast.success("Đã xuất bảng lương — file ghi đủ 19 cột và theo đơn vị đồng.");
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
              startIcon={dangXuat ? <CircularProgress size={16} /> : <FileDownloadRounded />}
              onClick={handleXuat}
              disabled={dangXuat || isLoading || rows.length === 0}
              sx={{ textTransform: "none", whiteSpace: "nowrap" }}
            >
              {dangXuat ? "Đang xuất…" : "Xuất Excel"}
            </Button>
            <Button
              variant="contained"
              startIcon={isLocked ? <RefreshRounded /> : <CalculateRounded />}
              onClick={handleTinhLai}
              disabled={!ky.periodId || isFetching}
              sx={{ textTransform: "none", whiteSpace: "nowrap" }}
            >
              {isLocked ? "Tải lại số liệu" : "Tính lại lương"}
            </Button>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Typography variant="caption" color="text.disabled">
              {ky.nhan}
              {tinhLuc ? ` · tính lúc ${tinhLuc}` : ""}
            </Typography>
            {isLocked && (
              <Chip
                icon={<LockRounded sx={{ fontSize: 14 }} />}
                label="Đã khóa sổ — số liệu đã chốt"
                size="small"
                color="warning"
                variant="outlined"
                sx={{ height: 20, "& .MuiChip-label": { px: 0.75, fontSize: 11 } }}
              />
            )}
          </Stack>
        </Stack>
      </Stack>

      {!ky.periodId && (
        <Alert severity="info">
          Chưa có kỳ lương nào được chọn. Hãy tạo hoặc chọn một kỳ lương ở thanh phía trên để xem
          bảng lương.
        </Alert>
      )}
      {isError && <Alert severity="error">{errorMessage}</Alert>}

      <ThanhLocBangLuong
        filters={filters}
        onFilters={setFilters}
        soHienThi={rows.length}
        soTong={soNhanVien}
      />

      <BangLuongTable
        rows={rows}
        cheDo={cheDo}
        rutGon={mucChiTiet === "rut_gon"}
        isLoading={isLoading}
      />

      <Typography variant="caption" color="text.secondary">
        Số liệu tính sẵn ở máy chủ từ Hợp đồng, Cài đặt lương, Chấm công và các màn của khu Dữ
        liệu tính lương. Lương phần trăm và Chuyên cần không có cột riêng — di chuột vào cột "Thu
        nhập" để xem đủ bảy khoản cấu thành.
      </Typography>
    </Stack>
  );
}
