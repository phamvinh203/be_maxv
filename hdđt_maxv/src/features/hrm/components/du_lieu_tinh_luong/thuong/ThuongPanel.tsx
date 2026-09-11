import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { toast } from "react-toastify";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import { getErrorMessage } from "../../../../../lib/errors";
import { PHAM_VI_AP_DUNG } from "../../../_shared/constants";
import { nhan, tienVn } from "../../../_shared/format";
import { tongTienThuong } from "../../../calculations/du_lieu_tinh_luong/thuong";
import { useKhoanThuongList, useKhoanLuongIdByCode } from "../../../api/cai_dat_luong/salaryItemsQueries";
import { useApplyBonus, useBonusDataList } from "../../../api/du_lieu_tinh_luong/payrollInputsQueries";
import { useCanhBaoRoiTrang } from "../_shared/useCanhBaoRoiTrang";
import { useCurrentPayrollPeriod } from "../useCurrentPayrollPeriod";
import { useBangKeChiDoc } from "../useBangKeChiDoc";
import CanhBaoChiDoc from "../CanhBaoChiDoc";
import CanhBaoNgoaiBoLoc from "../CanhBaoNgoaiBoLoc";
import ThanhCongCuBangNhap from "../ThanhCongCuBangNhap";
import { demSoNgoaiBoLoc, mergeNhanVienKyLuongWithData, useNhanVienKyLuong } from "../useNhanVienKyLuong";
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
  const { selectedPeriodId } = useCurrentPayrollPeriod();
  const { isReadOnly, bangKeDaChot } = useBangKeChiDoc("BONUS");
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
  // RVW-707: nháp chỉ sống trong state — chặn F5/đóng tab khi còn nội dung
  // chưa áp dụng, tránh mất trắng im lặng.
  useCanhBaoRoiTrang(coThayDoi);
  // RVW-711: nhân viên có thưởng trong kỳ nhưng bị 3 ô lọc ẩn khỏi bảng — dữ
  // liệu vẫn tính vào lương, chỉ là không ai thấy để kiểm tra ở màn này.
  const soNgoaiBoLoc = demSoNgoaiBoLoc(nhanVien, bonusData);
  // RVW-701: dòng chưa chọn loại thưởng bị BE từ chối ("Còn dòng chưa chọn loại
  // thưởng") — chặn trước khi gửi cả batch, tránh 400 mù mờ.
  const hopLe = mau.every((d) => d.ma_khoan !== "");

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
        <CanhBaoChiDoc bangKeDaChot={bangKeDaChot} hanhDong="không thể sửa hoặc áp dụng thưởng mới" />
      )}

      <ThanhCongCuBangNhap
        isReadOnly={isReadOnly}
        coThayDoi={coThayDoi}
        soLuongApDung={rows.length}
        disabledApDung={isReadOnly || mau.length === 0 || rows.length === 0 || !hopLe}
        disabledXoaTatCa={mau.length === 0}
        inputFile={inputFile}
        onTaiMau={handleTaiMau}
        onNhap={handleNhap}
        onXuat={handleXuat}
        onApDung={() => setMoApDung(true)}
        onTaiSuDung={() => setMoTaiSuDung(true)}
        onXoaTatCa={() => setMoXoaTatCa(true)}
        onQuanLy={() => setMoQuanLy(true)}
        nhanApDung="Áp dụng thưởng"
        nhanQuanLy="Quản lý thưởng"
        canhBaoChuaApDung="Bảng thưởng có nội dung chưa áp dụng"
      />

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
      <CanhBaoNgoaiBoLoc soLuong={soNgoaiBoLoc} module="thưởng" />

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
