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
import { PHAM_VI_AP_DUNG } from "../../../constants";
import { nhan, tienVn } from "../../../format";
import { tongTienThuong } from "../../../thuong";
import { useKhoanThuongList, useKhoanLuongIdByCode } from "../../../api/salaryItemsQueries";
import { useApplyBonus, useBonusDataList } from "../../../api/payrollInputsQueries";
import { useCurrentPayrollPeriod } from "../useCurrentPayrollPeriod";
import { mergeNhanVienKyLuongWithData, useNhanVienKyLuong } from "../useNhanVienKyLuong";
import type { DongThuong, LocNhanVienKyLuong, PhamViApDung, ThuongNhanVienRow } from "../../../types";
import XacNhanXoaDialog from "../../XacNhanXoaDialog";
import BangKhoanThuongCard from "./BangKhoanThuongCard";
import DanhSachThuongCard from "./DanhSachThuongCard";
import QuanLyThuongDialog from "./QuanLyThuongDialog";
import TaiSuDungThuongDialog from "./TaiSuDungThuongDialog";
import { docFileThuong, taiFileMauThuong, xuatThuongExcel } from "./thuongExcel";

/**
 * Màn hình Thưởng của khu "Dữ liệu tính lương".
 *
 * Cùng lối làm việc với màn KPI (xem ghi chú ở `KpiPanel`): bảng là bản nháp cục bộ, ghi thật duy
 * nhất qua "Áp dụng thưởng", LUÔN gửi `scope: 'nhan_vien'` kèm danh sách `ma_nv` tường minh —
 * danh sách nhìn thấy chính là danh sách sẽ bị ghi.
 */
export default function ThuongPanel() {
  const { selectedPeriodId, isReadOnly } = useCurrentPayrollPeriod();
  const periodId = selectedPeriodId ?? "";

  const danhMuc = useKhoanThuongList();
  const idTheoMa = useKhoanLuongIdByCode();
  const applyMut = useApplyBonus(periodId);

  const [mau, setMau] = useState<DongThuong[]>([]);
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
  const { data: bonusData } = useBonusDataList({ periodId });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMau([]);
  }, [periodId]);

  const rows: ThuongNhanVienRow[] = useMemo(
    () =>
      mergeNhanVienKyLuongWithData(nhanVien, bonusData, (row, ban) => ({
        ...row,
        tien_thuong: ban ? ban.totalAmount : null,
        so_khoan: ban?.records.length ?? 0,
      })),
    [nhanVien, bonusData],
  );

  const coThayDoi = mau.length > 0;

  const handleApDung = async () => {
    setMoApDung(false);
    try {
      await applyMut.mutateAsync({
        periodId,
        scope: "nhan_vien",
        employeeIds: rows.map((row) => row.ma_nv),
        items: mau.map((d) => ({
          salaryItemId: idTheoMa.get(d.ma_khoan) ?? d.ma_khoan,
          amount: d.so_tien,
        })),
      });
      toast.success(`Đã áp bảng thưởng cho ${rows.length} nhân viên.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không áp được thưởng."));
    }
  };

  const handleTaiMau = async () => {
    try {
      await taiFileMauThuong(danhMuc);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không tạo được file mẫu."));
    }
  };

  const handleXuat = async () => {
    try {
      await xuatThuongExcel(mau, danhMuc, rows);
      toast.success("Đã xuất file Bang-thuong.xlsx.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Không xuất được Excel."));
    }
  };

  const handleNhap = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dong = await docFileThuong(file, danhMuc);
      setMau(dong);
      toast.success(`Đã đọc ${dong.length} khoản thưởng từ file. Bấm "Áp dụng thưởng" để ghi lại.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không đọc được file Excel."));
    }
  };

  if (!periodId) {
    return (
      <Alert severity="info">
        Chưa có kỳ lương nào được chọn — tạo hoặc chọn một kỳ lương ở thanh phía trên trước khi
        nhập thưởng.
      </Alert>
    );
  }

  return (
    <Stack spacing={2.5}>
      {isReadOnly && (
        <Alert severity="warning">
          Kỳ lương đang chọn đã khóa sổ/chờ duyệt — không thể sửa hoặc áp dụng thưởng mới.
        </Alert>
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
              disabled={isReadOnly || mau.length === 0 || rows.length === 0}
              sx={{ textTransform: "none" }}
            >
              Áp dụng thưởng ({rows.length})
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
              Quản lý thưởng
            </Button>
          </Stack>

          {coThayDoi && (
            <Box>
              <Chip
                size="small"
                color="warning"
                label="Bảng thưởng có nội dung chưa áp dụng"
                sx={{ height: 22 }}
              />
            </Box>
          )}
        </Stack>

        <input ref={inputFile} type="file" accept=".xlsx,.xlsm" hidden onChange={handleNhap} />
      </Paper>

      <BangKhoanThuongCard values={mau} onChange={setMau} soNhanVien={rows.length} />

      <DanhSachThuongCard
        phamVi={phamVi}
        onPhamVi={setPhamVi}
        filters={filters}
        onFilters={setFilters}
        rows={rows}
        periodId={periodId}
        isReadOnly={isReadOnly}
      />

      <QuanLyThuongDialog open={moQuanLy} onClose={() => setMoQuanLy(false)} />

      <TaiSuDungThuongDialog
        open={moTaiSuDung}
        onClose={() => setMoTaiSuDung(false)}
        onChon={setMau}
      />

      <XacNhanXoaDialog
        open={moXoaTatCa}
        tieuDe="Xóa tất cả khoản thưởng"
        noiDung={
          <>
            Xóa toàn bộ <strong>{mau.length} khoản</strong> khỏi bảng thưởng đang soạn? Thưởng đã
            áp cho nhân viên vẫn giữ nguyên cho tới lần áp sau.
          </>
        }
        onClose={() => setMoXoaTatCa(false)}
        onXacNhan={() => {
          setMau([]);
          setMoXoaTatCa(false);
        }}
      />

      <Dialog open={moApDung} onClose={() => setMoApDung(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Áp dụng thưởng</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            Áp bảng thưởng đang soạn ({tienVn(tongTienThuong(mau))} ₫ mỗi người) cho{" "}
            <strong>{rows.length} nhân viên</strong> theo phạm vi{" "}
            <strong>{nhan(PHAM_VI_AP_DUNG, phamVi).toLowerCase()}</strong>? Tổng quỹ thưởng là{" "}
            <strong>{tienVn(tongTienThuong(mau) * rows.length)} ₫</strong>. Bảng thưởng cũ của
            những người này sẽ bị thay thế.
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
