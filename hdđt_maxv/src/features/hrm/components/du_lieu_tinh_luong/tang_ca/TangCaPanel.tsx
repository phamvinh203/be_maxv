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
import { gioVn, tongGioOt, tongGioQuyDoi } from "../../../calculations/du_lieu_tinh_luong/tangCa";
import { useCauHinh } from "../../../api/cau_hinh_mac_dinh/cauHinhQueries";
import { useApplyOvertime, useOvertimeList } from "../../../api/du_lieu_tinh_luong/payrollInputsQueries";
import { useCurrentPayrollPeriod } from "../useCurrentPayrollPeriod";
import { useBangKeChiDoc } from "../useBangKeChiDoc";
import CanhBaoChiDoc from "../CanhBaoChiDoc";
import { mergeNhanVienKyLuongWithData, useNhanVienKyLuong } from "../useNhanVienKyLuong";
import type {
  DongTangCa,
  LoaiTangCa,
  LocNhanVienKyLuong,
  PhamViApDung,
  TangCaNhanVienRow,
} from "../../../types";
import XacNhanXoaDialog from "../../XacNhanXoaDialog";
import BangTangCaCard from "./BangTangCaCard";
import DanhSachTangCaCard from "./DanhSachTangCaCard";
import QuanLyTangCaDialog from "./QuanLyTangCaDialog";
import TaiSuDungTangCaDialog from "./TaiSuDungTangCaDialog";
import { docFileTangCa, taiFileMauTangCa, xuatTangCaExcel } from "./tangCaExcel";

/**
 * Màn hình Tăng ca của khu "Dữ liệu tính lương".
 *
 * Cùng lối làm việc với các màn còn lại (xem ghi chú ở `KpiPanel`): bảng là bản nháp cục bộ, ghi
 * thật duy nhất qua "Áp dụng tăng ca".
 *
 * ⚠️ Cột "Tổng giờ năm" chỉ còn bằng giờ OT **của kỳ này** (`totalHours`) — API
 * `GET /payroll-data/overtime` không trả lũy kế các kỳ TRƯỚC trong năm (khác bản mock vốn giữ
 * `gio_luy_ke_nam` riêng). Muốn có đúng lũy kế cả năm cần cộng dồn `GET` của từng kỳ trong năm,
 * ngoài phạm vi phiên đấu dây này — ghi rõ trong `docs/hrm/work-log.md`.
 */
export default function TangCaPanel() {
  const { selectedPeriodId } = useCurrentPayrollPeriod();
  const { isReadOnly, bangKeDaChot } = useBangKeChiDoc("OVERTIME");
  const periodId = selectedPeriodId ?? "";

  const cauHinh = useCauHinh();
  const applyMut = useApplyOvertime(periodId);

  const [mau, setMau] = useState<DongTangCa[]>([]);
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
  const { data: otData } = useOvertimeList({ periodId });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMau([]);
  }, [periodId]);

  const rows: TangCaNhanVienRow[] = useMemo(
    () =>
      mergeNhanVienKyLuongWithData(nhanVien, otData, (row, ban) => ({
        ...row,
        gio_thang: ban ? ban.totalHours : null,
        // Không có lũy kế các kỳ trước từ máy chủ (xem ghi chú đầu file) — tạm bằng giờ kỳ này.
        gio_nam: ban?.totalHours ?? 0,
        gio_quy_doi: ban?.convertedHours ?? 0,
      })),
    [nhanVien, otData],
  );

  const coThayDoi = mau.length > 0;
  const tongGio = tongGioOt(mau);

  const handleApDung = async () => {
    setMoApDung(false);
    try {
      await applyMut.mutateAsync({
        periodId,
        scope: "nhan_vien",
        employeeIds: rows.map((row) => row.ma_nv),
        // Bỏ dòng chưa chọn loại (`loai === ""`) — máy chủ không nhận enum rỗng.
        items: mau
          .filter((d): d is DongTangCa & { loai: LoaiTangCa } => d.loai !== "")
          .map((d) => ({ otType: d.loai, hours: d.so_gio })),
      });
      toast.success(`Đã áp bảng tăng ca cho ${rows.length} nhân viên.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không áp được tăng ca."));
    }
  };

  const handleTaiMau = async () => {
    try {
      await taiFileMauTangCa(cauHinh);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không tạo được file mẫu."));
    }
  };

  const handleXuat = async () => {
    try {
      await xuatTangCaExcel(mau, cauHinh, rows);
      toast.success("Đã xuất file Bang-tang-ca.xlsx.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Không xuất được Excel."));
    }
  };

  const handleNhap = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dong = await docFileTangCa(file);
      setMau(dong);
      toast.success(`Đã đọc ${dong.length} dòng tăng ca từ file. Bấm "Áp dụng tăng ca" để ghi lại.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không đọc được file Excel."));
    }
  };

  if (!periodId) {
    return (
      <Alert severity="info">
        Chưa có kỳ lương nào được chọn — tạo hoặc chọn một kỳ lương ở thanh phía trên trước khi
        nhập tăng ca.
      </Alert>
    );
  }

  return (
    <Stack spacing={2.5}>
      {isReadOnly && (
        <CanhBaoChiDoc
          bangKeDaChot={bangKeDaChot}
          hanhDong="không thể sửa hoặc áp dụng tăng ca mới"
        />
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
              Áp dụng tăng ca ({rows.length})
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
              Quản lý tăng ca
            </Button>
          </Stack>

          {coThayDoi && (
            <Box>
              <Chip
                size="small"
                color="warning"
                label="Bảng tăng ca có nội dung chưa áp dụng"
                sx={{ height: 22 }}
              />
            </Box>
          )}
        </Stack>

        <input ref={inputFile} type="file" accept=".xlsx,.xlsm" hidden onChange={handleNhap} />
      </Paper>

      <BangTangCaCard values={mau} onChange={setMau} />

      <DanhSachTangCaCard
        phamVi={phamVi}
        onPhamVi={setPhamVi}
        filters={filters}
        onFilters={setFilters}
        rows={rows}
        periodId={periodId}
        isReadOnly={isReadOnly}
      />

      <QuanLyTangCaDialog open={moQuanLy} onClose={() => setMoQuanLy(false)} />

      <TaiSuDungTangCaDialog
        open={moTaiSuDung}
        onClose={() => setMoTaiSuDung(false)}
        onChon={setMau}
      />

      <XacNhanXoaDialog
        open={moXoaTatCa}
        tieuDe="Xóa tất cả dòng tăng ca"
        noiDung={
          <>
            Xóa toàn bộ <strong>{mau.length} dòng</strong> khỏi bảng tăng ca đang soạn? Tăng ca
            đã áp cho nhân viên vẫn giữ nguyên cho tới lần áp sau.
          </>
        }
        onClose={() => setMoXoaTatCa(false)}
        onXacNhan={() => {
          setMau([]);
          setMoXoaTatCa(false);
        }}
      />

      <Dialog open={moApDung} onClose={() => setMoApDung(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Áp dụng tăng ca</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            Áp bảng tăng ca đang soạn ({gioVn(tongGio)}h OT, quy đổi{" "}
            {gioVn(tongGioQuyDoi(mau, cauHinh))}h) cho{" "}
            <strong>{rows.length} nhân viên</strong> theo phạm vi{" "}
            <strong>{nhan(PHAM_VI_AP_DUNG, phamVi).toLowerCase()}</strong>? Bảng tăng ca cũ của
            những người này sẽ bị thay thế.
            {cauHinh.gioi_han_tc_thang > 0 && tongGio > cauHinh.gioi_han_tc_thang && (
              <Box component="span" sx={{ display: "block", mt: 1.5, color: "error.main" }}>
                Lưu ý: {gioVn(tongGio)}h vượt trần {gioVn(cauHinh.gioi_han_tc_thang)}h/tháng.
              </Box>
            )}
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
