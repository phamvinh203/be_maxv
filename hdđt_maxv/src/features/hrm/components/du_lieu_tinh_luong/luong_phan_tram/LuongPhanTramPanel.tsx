import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { toast } from "react-toastify";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
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
import { tongTienPhanTram } from "../../../calculations/du_lieu_tinh_luong/luongPhanTram";
import { useKhoanLuongIdByCode, useKhoanPhanTramList } from "../../../api/cai_dat_luong/salaryItemsQueries";
import { useApplyCommission, useCommissionDataList } from "../../../api/du_lieu_tinh_luong/payrollInputsQueries";
import { useCanhBaoRoiTrang } from "../_shared/useCanhBaoRoiTrang";
import { useCurrentPayrollPeriod } from "../useCurrentPayrollPeriod";
import { useBangKeChiDoc } from "../useBangKeChiDoc";
import CanhBaoChiDoc from "../CanhBaoChiDoc";
import CanhBaoNgoaiBoLoc from "../CanhBaoNgoaiBoLoc";
import ThanhCongCuBangNhap from "../ThanhCongCuBangNhap";
import { demSoNgoaiBoLoc, mergeNhanVienKyLuongWithData, useNhanVienKyLuong } from "../useNhanVienKyLuong";
import type {
  DongLuongPhanTram,
  LocNhanVienKyLuong,
  LuongPhanTramNhanVienRow,
  PhamViApDung,
} from "../../../types";
import XacNhanXoaDialog from "../../XacNhanXoaDialog";
import BangPhanTramCard from "./BangPhanTramCard";
import DanhSachLuongPhanTramCard from "./DanhSachLuongPhanTramCard";
import QuanLyPhanTramDialog from "./QuanLyPhanTramDialog";
import TaiSuDungPhanTramDialog from "./TaiSuDungPhanTramDialog";
import { docFilePhanTram, taiFileMauPhanTram, xuatPhanTramExcel } from "./luongPhanTramExcel";

/**
 * Màn hình Lương phần trăm của khu "Dữ liệu tính lương".
 *
 * Cùng lối làm việc với các màn còn lại (xem ghi chú ở `KpiPanel`): bảng là bản nháp cục bộ, ghi
 * thật duy nhất qua "Áp dụng lương %", LUÔN gửi `commissionRate` tường minh theo đúng tỷ lệ đã
 * chốt trên bảng đang soạn (không để máy chủ tự lấy tỷ lệ mặc định hiện hành của danh mục).
 */
export default function LuongPhanTramPanel() {
  const { selectedPeriodId } = useCurrentPayrollPeriod();
  const { isReadOnly, bangKeDaChot } = useBangKeChiDoc("COMMISSION");
  const periodId = selectedPeriodId ?? "";

  const danhMuc = useKhoanPhanTramList();
  const idTheoMa = useKhoanLuongIdByCode();
  const applyMut = useApplyCommission(periodId);

  const [mau, setMau] = useState<DongLuongPhanTram[]>([]);
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
  const { data: commissionData } = useCommissionDataList({ periodId });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMau([]);
  }, [periodId]);

  const rows: LuongPhanTramNhanVienRow[] = useMemo(
    () =>
      mergeNhanVienKyLuongWithData(nhanVien, commissionData, (row, ban) => ({
        ...row,
        tien_luong: ban ? ban.totalAmount : null,
        so_dong: ban?.records.length ?? 0,
      })),
    [nhanVien, commissionData],
  );

  const coThayDoi = mau.length > 0;
  // RVW-707: nháp chỉ sống trong state — chặn F5/đóng tab khi còn nội dung
  // chưa áp dụng, tránh mất trắng im lặng.
  useCanhBaoRoiTrang(coThayDoi);
  // RVW-711: nhân viên có lương % trong kỳ nhưng bị 3 ô lọc ẩn khỏi bảng — dữ
  // liệu vẫn tính vào lương, chỉ là không ai thấy để kiểm tra ở màn này.
  const soNgoaiBoLoc = demSoNgoaiBoLoc(nhanVien, commissionData);
  const tong = tongTienPhanTram(mau);
  // RVW-701: dòng chưa chọn loại % bị BE từ chối ("Còn dòng chưa chọn khoản hoa
  // hồng") — chặn trước khi gửi cả batch, tránh 400 mù mờ.
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
          commissionRate: d.ty_le,
          baseAmount: d.so_tien_co_so,
        })),
      });
      toast.success(`Đã áp bảng lương phần trăm cho ${rows.length} nhân viên.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không áp được lương phần trăm."));
    }
  };

  const handleTaiMau = async () => {
    try {
      await taiFileMauPhanTram(danhMuc);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không tạo được file mẫu."));
    }
  };

  const handleXuat = async () => {
    try {
      await xuatPhanTramExcel(mau, danhMuc, rows);
      toast.success("Đã xuất file Bang-luong-phan-tram.xlsx.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Không xuất được Excel."));
    }
  };

  const handleNhap = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dong = await docFilePhanTram(file, danhMuc);
      setMau(dong);
      toast.success(`Đã đọc ${dong.length} khoản % từ file. Bấm "Áp dụng lương %" để ghi lại.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không đọc được file Excel."));
    }
  };

  if (!periodId) {
    return (
      <Alert severity="info">
        Chưa có kỳ lương nào được chọn — tạo hoặc chọn một kỳ lương ở thanh phía trên trước khi
        nhập lương phần trăm.
      </Alert>
    );
  }

  return (
    <Stack spacing={2.5}>
      {isReadOnly && (
        <CanhBaoChiDoc
          bangKeDaChot={bangKeDaChot}
          hanhDong="không thể sửa hoặc áp dụng lương phần trăm mới"
        />
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
        nhanApDung="Áp dụng lương %"
        nhanQuanLy="Quản lý loại %"
        canhBaoChuaApDung="Bảng lương phần trăm có nội dung chưa áp dụng"
      />

      <BangPhanTramCard values={mau} onChange={setMau} />

      <DanhSachLuongPhanTramCard
        phamVi={phamVi}
        onPhamVi={setPhamVi}
        filters={filters}
        onFilters={setFilters}
        rows={rows}
        periodId={periodId}
        isReadOnly={isReadOnly}
      />
      <CanhBaoNgoaiBoLoc soLuong={soNgoaiBoLoc} module="lương phần trăm" />

      <QuanLyPhanTramDialog open={moQuanLy} onClose={() => setMoQuanLy(false)} />

      <TaiSuDungPhanTramDialog
        open={moTaiSuDung}
        onClose={() => setMoTaiSuDung(false)}
        onChon={setMau}
      />

      <XacNhanXoaDialog
        open={moXoaTatCa}
        tieuDe="Xóa tất cả khoản %"
        noiDung={
          <>
            Xóa toàn bộ <strong>{mau.length} khoản</strong> khỏi bảng đang soạn? Lương phần trăm
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
        <DialogTitle>Áp dụng lương phần trăm</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            Áp bảng đang soạn ({mau.length} khoản, {tienVn(tong)} ₫ mỗi người) cho{" "}
            <strong>{rows.length} nhân viên</strong> theo phạm vi{" "}
            <strong>{nhan(PHAM_VI_AP_DUNG, phamVi).toLowerCase()}</strong>? Bảng cũ của những
            người này sẽ bị thay thế.
            {rows.length > 1 && (
              <Box component="span" sx={{ display: "block", mt: 1.5, color: "warning.main" }}>
                Lưu ý: cả {rows.length} người sẽ nhận cùng một số tiền cơ sở. Chỉ nên làm vậy khi
                cả nhóm ăn chung một gốc doanh số.
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
