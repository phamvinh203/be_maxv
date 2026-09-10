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
import { nhan, tienVn } from "../../../_shared/format";
import { tongBiTru } from "../../../calculations/du_lieu_tinh_luong/buTru";
import { useKhoanBuTruIdByCode, useKhoanBuTruList } from "../../../api/du_lieu_tinh_luong/payrollCatalogsQueries";
import { useAdjustmentDataList, useApplyAdjustments } from "../../../api/du_lieu_tinh_luong/payrollInputsQueries";
import { useCurrentPayrollPeriod } from "../useCurrentPayrollPeriod";
import { mergeNhanVienKyLuongWithData, useNhanVienKyLuong } from "../useNhanVienKyLuong";
import type {
  BuTruNhanVienRow,
  DongBuTru,
  LocNhanVienKyLuong,
  PhamViApDung,
} from "../../../types";
import XacNhanXoaDialog from "../../XacNhanXoaDialog";
import BangBuTruCard from "./BangBuTruCard";
import DanhSachBuTruCard from "./DanhSachBuTruCard";
import QuanLyBuTruDialog from "./QuanLyBuTruDialog";
import TaiSuDungBuTruDialog from "./TaiSuDungBuTruDialog";
import { docFileBuTru, taiFileMauBuTru, xuatBuTruExcel } from "./buTruExcel";

/**
 * Màn hình Các khoản ứng - bù trừ lương của khu "Dữ liệu tính lương".
 *
 * Cùng lối làm việc với các màn còn lại (xem ghi chú ở `KpiPanel`): bảng là bản nháp cục bộ, ghi
 * thật duy nhất qua "Áp dụng bù trừ".
 *
 * Đây là màn dễ gây hậu quả nhất trong khu: số ở đây là tiền đã ứng ra thật, áp
 * nhầm cho cả phòng là trừ oan tiền của người không ứng. Vì vậy dialog xác nhận
 * nói rõ số tiền và nhắc riêng khi danh sách có nhiều hơn một người.
 */
export default function BuTruPanel() {
  const { selectedPeriodId, isReadOnly } = useCurrentPayrollPeriod();
  const periodId = selectedPeriodId ?? "";

  const danhMuc = useKhoanBuTruList();
  const idTheoMa = useKhoanBuTruIdByCode();
  const applyMut = useApplyAdjustments(periodId);

  const [mau, setMau] = useState<DongBuTru[]>([]);
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
  const { data: adjustmentData } = useAdjustmentDataList({ periodId });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMau([]);
  }, [periodId]);

  const rows: BuTruNhanVienRow[] = useMemo(
    () =>
      mergeNhanVienKyLuongWithData(nhanVien, adjustmentData, (row, ban) => ({
        ...row,
        tong_bi_tru: ban ? ban.netAdjustment : null,
        so_dong: ban?.records.length ?? 0,
      })),
    [nhanVien, adjustmentData],
  );

  const coThayDoi = mau.length > 0;
  const khoanTheoMa = useMemo(
    () => new Map(danhMuc.map((bt) => [bt.ma_bt, bt])),
    [danhMuc],
  );
  const rong = tongBiTru(mau, khoanTheoMa);

  const handleApDung = async () => {
    setMoApDung(false);
    try {
      await applyMut.mutateAsync({
        periodId,
        scope: "nhan_vien",
        employeeIds: rows.map((row) => row.ma_nv),
        items: mau.map((d) => ({
          adjustmentItemId: idTheoMa.get(d.ma_bt) ?? d.ma_bt,
          amount: d.so_tien,
        })),
      });
      toast.success(`Đã áp bảng ứng - bù trừ cho ${rows.length} nhân viên.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không áp được khoản bù trừ."));
    }
  };

  const handleTaiMau = async () => {
    try {
      await taiFileMauBuTru(danhMuc);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không tạo được file mẫu."));
    }
  };

  const handleXuat = async () => {
    try {
      await xuatBuTruExcel(mau, danhMuc, rows);
      toast.success("Đã xuất file Bang-ung-bu-tru.xlsx.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Không xuất được Excel."));
    }
  };

  const handleNhap = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dong = await docFileBuTru(file, danhMuc);
      setMau(dong);
      toast.success(`Đã đọc ${dong.length} khoản từ file. Bấm "Áp dụng bù trừ" để ghi lại.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không đọc được file Excel."));
    }
  };

  if (!periodId) {
    return (
      <Alert severity="info">
        Chưa có kỳ lương nào được chọn — tạo hoặc chọn một kỳ lương ở thanh phía trên trước khi
        nhập khoản ứng - bù trừ.
      </Alert>
    );
  }

  return (
    <Stack spacing={2.5}>
      {isReadOnly && (
        <Alert severity="warning">
          Kỳ lương đang chọn đã khóa sổ/chờ duyệt — không thể sửa hoặc áp dụng khoản bù trừ mới.
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
              Áp dụng bù trừ ({rows.length})
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
              Quản lý khoản bù trừ
            </Button>
          </Stack>

          {coThayDoi && (
            <Box>
              <Chip
                size="small"
                color="warning"
                label="Bảng ứng - bù trừ có nội dung chưa áp dụng"
                sx={{ height: 22 }}
              />
            </Box>
          )}
        </Stack>

        <input ref={inputFile} type="file" accept=".xlsx,.xlsm" hidden onChange={handleNhap} />
      </Paper>

      <BangBuTruCard values={mau} onChange={setMau} />

      <DanhSachBuTruCard
        phamVi={phamVi}
        onPhamVi={setPhamVi}
        filters={filters}
        onFilters={setFilters}
        rows={rows}
        periodId={periodId}
        isReadOnly={isReadOnly}
      />

      <QuanLyBuTruDialog open={moQuanLy} onClose={() => setMoQuanLy(false)} />

      <TaiSuDungBuTruDialog
        open={moTaiSuDung}
        onClose={() => setMoTaiSuDung(false)}
        onChon={setMau}
      />

      <XacNhanXoaDialog
        open={moXoaTatCa}
        tieuDe="Xóa tất cả khoản bù trừ"
        noiDung={
          <>
            Xóa toàn bộ <strong>{mau.length} khoản</strong> khỏi bảng đang soạn? Khoản đã áp cho
            nhân viên vẫn giữ nguyên cho tới lần áp sau.
          </>
        }
        onClose={() => setMoXoaTatCa(false)}
        onXacNhan={() => {
          setMau([]);
          setMoXoaTatCa(false);
        }}
      />

      <Dialog open={moApDung} onClose={() => setMoApDung(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Áp dụng khoản bù trừ</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            Áp bảng đang soạn ({mau.length} khoản,{" "}
            {rong >= 0 ? `trừ ${tienVn(rong)} ₫` : `bù thêm ${tienVn(-rong)} ₫`} mỗi người) cho{" "}
            <strong>{rows.length} nhân viên</strong> theo phạm vi{" "}
            <strong>{nhan(PHAM_VI_AP_DUNG, phamVi).toLowerCase()}</strong>? Bảng cũ của những
            người này sẽ bị thay thế.
            {rows.length > 1 && (
              <Box component="span" sx={{ display: "block", mt: 1.5, color: "error.main" }}>
                Lưu ý: cả {rows.length} người sẽ bị ghi cùng số tiền này. Tạm ứng là khoản của
                riêng từng người — kiểm tra kỹ danh sách trước khi áp.
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
