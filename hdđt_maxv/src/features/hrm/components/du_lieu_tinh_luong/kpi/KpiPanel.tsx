import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { toast } from "react-toastify";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import UploadFileRounded from "@mui/icons-material/UploadFileRounded";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import PlaylistAddCheckRounded from "@mui/icons-material/PlaylistAddCheckRounded";
import ContentCopyRounded from "@mui/icons-material/ContentCopyRounded";
import DeleteSweepRounded from "@mui/icons-material/DeleteSweepRounded";
import TuneRounded from "@mui/icons-material/TuneRounded";
import { getErrorMessage } from "../../../../../lib/errors";
import { PHAM_VI_AP_DUNG } from "../../../_shared/constants";
import { nhan } from "../../../_shared/format";
import { useChiTieuKpiIdByCode, useChiTieuKpiList } from "../../../api/du_lieu_tinh_luong/payrollCatalogsQueries";
import { useApplyKpi, useKpiDataList } from "../../../api/du_lieu_tinh_luong/payrollInputsQueries";
import { useCurrentPayrollPeriod } from "../useCurrentPayrollPeriod";
import { useBangKeChiDoc } from "../useBangKeChiDoc";
import CanhBaoChiDoc from "../CanhBaoChiDoc";
import { mergeNhanVienKyLuongWithData, useNhanVienKyLuong } from "../useNhanVienKyLuong";
import type { DongKpi, KpiNhanVienRow, LocNhanVienKyLuong, PhamViApDung } from "../../../types";
import XacNhanXoaDialog from "../../XacNhanXoaDialog";
import BangChiTieuKpiCard from "./BangChiTieuKpiCard";
import DanhSachKpiCard from "./DanhSachKpiCard";
import QuanLyKpiDialog from "./QuanLyKpiDialog";
import TaiSuDungKpiDialog from "./TaiSuDungKpiDialog";
import { docFileKpi, taiFileMauKpi, xuatKpiExcel } from "./kpiExcel";

/**
 * Màn hình KPI của khu "Dữ liệu tính lương".
 *
 * Bảng KPI là **bản nháp cục bộ** trong state màn hình (`useState`, KHÔNG còn đồng bộ với một
 * "mẫu đã lưu" ở máy chủ — API `POST /payroll-data/kpi/apply` không có khái niệm lưu-riêng-chưa-
 * áp, chỉ có ghi thật cho danh sách nhân viên cụ thể). Đóng màn hoặc đổi kỳ lương thì bản nháp
 * mất, giống hệt việc mở một biểu mẫu giấy mới mỗi lần.
 *
 * "Áp dụng KPI" ghi bảng đang soạn cho **toàn bộ nhân viên đang hiện ở danh sách bên dưới**, LUÔN
 * gửi `scope: 'nhan_vien'` kèm danh sách `ma_nv` tường minh (xem ghi chú ở `useNhanVienKyLuong`) —
 * phạm vi và ba ô lọc chỉ là cách chọn nhanh "áp cho ai" phía trình duyệt.
 */
export default function KpiPanel() {
  const { selectedPeriodId } = useCurrentPayrollPeriod();
  const { isReadOnly, bangKeDaChot } = useBangKeChiDoc("KPI");
  const periodId = selectedPeriodId ?? "";

  const danhMuc = useChiTieuKpiList();
  const idTheoMa = useChiTieuKpiIdByCode();
  const applyMut = useApplyKpi(periodId);

  const [mau, setMau] = useState<DongKpi[]>([]);
  const [phamVi, setPhamVi] = useState<PhamViApDung>("nhan_vien");
  const [filters, setFilters] = useState<LocNhanVienKyLuong>({
    q: "",
    ma_pb: "",
    loai_hd: "",
  });

  const [moQuanLy, setMoQuanLy] = useState(false);
  const [moTaiSuDung, setMoTaiSuDung] = useState(false);
  const [moXoaTatCa, setMoXoaTatCa] = useState(false);
  const [moApDung, setMoApDung] = useState(false);

  const inputFile = useRef<HTMLInputElement>(null);
  const nhanVien = useNhanVienKyLuong(phamVi, filters);
  const { data: kpiData } = useKpiDataList({ periodId });

  useEffect(() => {
    // Đổi kỳ lương thì bản nháp đang soạn của kỳ cũ không còn ý nghĩa gì nữa.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMau([]);
  }, [periodId]);

  const rows: KpiNhanVienRow[] = useMemo(
    () =>
      mergeNhanVienKyLuongWithData(nhanVien, kpiData, (row, ban) => ({
        ...row,
        // BE không giữ bộ đếm "lần lương" tăng dần như bản mock — 0/1 biểu thị đã áp cho kỳ
        // này hay chưa, đủ để điều khiển nút "Xóa" và hiện cột.
        lan_luong: ban && ban.totalKpiItems > 0 ? 1 : 0,
        hieu_suat: ban?.avgScore ?? null,
        so_chi_tieu: ban?.totalKpiItems ?? 0,
      })),
    [nhanVien, kpiData],
  );

  const coThayDoi = mau.length > 0;
  // RVW-701: dòng chưa chọn chỉ tiêu hoặc mục tiêu <= 0 bị BE từ chối (E-dltl-008,
  // "Mục tiêu KPI phải lớn hơn 0") — chặn trước khi gửi cả batch, tránh 400 mù mờ.
  const hopLe = mau.every((d) => d.ma_kpi !== "" && d.muc_tieu > 0);

  const handleApDung = async () => {
    setMoApDung(false);
    try {
      await applyMut.mutateAsync({
        periodId,
        scope: "nhan_vien",
        employeeIds: rows.map((row) => row.ma_nv),
        items: mau.map((d) => ({
          kpiItemId: idTheoMa.get(d.ma_kpi) ?? d.ma_kpi,
          weight: d.trong_so,
          targetValue: d.muc_tieu,
          actualValue: d.thuc_thi,
        })),
      });
      toast.success(`Đã áp bảng KPI cho ${rows.length} nhân viên.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không áp được KPI."));
    }
  };

  const handleTaiMau = async () => {
    try {
      await taiFileMauKpi(danhMuc);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không tạo được file mẫu."));
    }
  };

  const handleXuat = async () => {
    try {
      await xuatKpiExcel(mau, danhMuc, rows);
      toast.success("Đã xuất file Bang-KPI.xlsx.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Không xuất được Excel."));
    }
  };

  const handleNhap = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Xóa giá trị input ngay: không xóa thì chọn lại đúng file vừa lỗi sẽ không
    // bắn `change` lần nữa và nút trông như hỏng.
    e.target.value = "";
    if (!file) return;
    try {
      const dong = await docFileKpi(file, danhMuc);
      setMau(dong);
      toast.success(`Đã đọc ${dong.length} chỉ tiêu từ file. Bấm "Áp dụng KPI" để ghi lại.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không đọc được file Excel."));
    }
  };

  if (!periodId) {
    return (
      <Alert severity="info">
        Chưa có kỳ lương nào được chọn — tạo hoặc chọn một kỳ lương ở thanh phía trên trước khi
        nhập KPI.
      </Alert>
    );
  }

  return (
    <Stack spacing={2.5}>
      {isReadOnly && (
        <CanhBaoChiDoc bangKeDaChot={bangKeDaChot} hanhDong="không thể sửa hoặc áp dụng KPI mới" />
      )}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack
          direction={{ xs: "column", xl: "row" }}
          spacing={1.5}
          sx={{ alignItems: { xl: "center" }, justifyContent: "space-between" }}
        >
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1.5 }}>
            <Button
              startIcon={<DownloadRounded />}
              onClick={handleTaiMau}
              sx={{ textTransform: "none" }}
            >
              Tải mẫu
            </Button>
            <Button
              startIcon={<UploadFileRounded />}
              onClick={() => inputFile.current?.click()}
              disabled={isReadOnly}
              sx={{ textTransform: "none" }}
            >
              Nhập Excel
            </Button>
            <Button
              startIcon={<FileDownloadRounded />}
              onClick={handleXuat}
              sx={{ textTransform: "none" }}
            >
              Xuất Excel
            </Button>
            <Button
              variant="contained"
              startIcon={<PlaylistAddCheckRounded />}
              onClick={() => setMoApDung(true)}
              disabled={isReadOnly || mau.length === 0 || rows.length === 0 || !hopLe}
              sx={{ textTransform: "none" }}
            >
              Áp dụng KPI ({rows.length})
            </Button>
            <Button
              startIcon={<ContentCopyRounded />}
              onClick={() => setMoTaiSuDung(true)}
              disabled={isReadOnly}
              sx={{ textTransform: "none" }}
            >
              Tái sử dụng
            </Button>
            <Button
              color="error"
              startIcon={<DeleteSweepRounded />}
              onClick={() => setMoXoaTatCa(true)}
              disabled={mau.length === 0}
              sx={{ textTransform: "none" }}
            >
              Xóa tất cả
            </Button>
            <Button
              variant="outlined"
              startIcon={<TuneRounded />}
              onClick={() => setMoQuanLy(true)}
              sx={{ textTransform: "none" }}
            >
              Quản lý KPI
            </Button>
          </Stack>

          {coThayDoi && (
            <Box>
              <Chip
                size="small"
                color="warning"
                label="Bảng KPI có nội dung chưa áp dụng"
                sx={{ height: 22 }}
              />
            </Box>
          )}
        </Stack>

        <input
          ref={inputFile}
          type="file"
          accept=".xlsx,.xlsm"
          hidden
          onChange={handleNhap}
        />
      </Paper>

      <BangChiTieuKpiCard values={mau} onChange={setMau} />

      <DanhSachKpiCard
        phamVi={phamVi}
        onPhamVi={setPhamVi}
        filters={filters}
        onFilters={setFilters}
        rows={rows}
        periodId={periodId}
        isReadOnly={isReadOnly}
      />

      <QuanLyKpiDialog open={moQuanLy} onClose={() => setMoQuanLy(false)} />

      <TaiSuDungKpiDialog
        open={moTaiSuDung}
        onClose={() => setMoTaiSuDung(false)}
        onChon={setMau}
      />

      <XacNhanXoaDialog
        open={moXoaTatCa}
        tieuDe="Xóa tất cả chỉ tiêu"
        noiDung={
          <>
            Xóa toàn bộ <strong>{mau.length} chỉ tiêu</strong> khỏi bảng KPI đang soạn? KPI đã áp
            cho nhân viên vẫn giữ nguyên cho tới lần áp sau.
          </>
        }
        onClose={() => setMoXoaTatCa(false)}
        onXacNhan={() => {
          setMau([]);
          setMoXoaTatCa(false);
        }}
      />

      <Dialog open={moApDung} onClose={() => setMoApDung(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Áp dụng KPI</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            Áp bảng KPI đang soạn ({mau.length} chỉ tiêu) cho{" "}
            <strong>{rows.length} nhân viên</strong> theo phạm vi{" "}
            <strong>{nhan(PHAM_VI_AP_DUNG, phamVi).toLowerCase()}</strong>? Bảng KPI cũ của những
            người này sẽ bị thay thế.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoApDung(false)} sx={{ textTransform: "none" }}>
            Hủy
          </Button>
          <Button
            variant="contained"
            onClick={handleApDung}
            disabled={applyMut.isPending}
            sx={{ textTransform: "none" }}
          >
            Áp dụng
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
