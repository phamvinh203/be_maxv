import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { useAuth } from "@/features/auth/useAuth";
import { getErrorMessage } from "../../../../../lib/errors";
import { PHAM_VI_AP_DUNG } from "../../../_shared/constants";
import { nhan } from "../../../_shared/format";
import { hrmPayrollCalculationKeys, hrmPayrollDataKeys } from "../../../api/hrmKeys";
import { useLoaiChuyenCanIdByCode, useLoaiChuyenCanList } from "../../../api/du_lieu_tinh_luong/payrollCatalogsQueries";
import { deleteDiligenceRecord, recordDiligence } from "../../../api/du_lieu_tinh_luong/payrollInputsApi";
import { useDiligenceDataList } from "../../../api/du_lieu_tinh_luong/payrollInputsQueries";
import { useCanhBaoRoiTrang } from "../_shared/useCanhBaoRoiTrang";
import { useCurrentPayrollPeriod } from "../useCurrentPayrollPeriod";
import { useBangKeChiDoc } from "../useBangKeChiDoc";
import CanhBaoChiDoc from "../CanhBaoChiDoc";
import CanhBaoNgoaiBoLoc from "../CanhBaoNgoaiBoLoc";
import ThanhCongCuBangNhap from "../ThanhCongCuBangNhap";
import { demSoNgoaiBoLoc, mergeNhanVienKyLuongWithData, useNhanVienKyLuong } from "../useNhanVienKyLuong";
import type { ChuyenCanNhanVienRow, DongChuyenCan, LocNhanVienKyLuong, PhamViApDung } from "../../../types";
import XacNhanXoaDialog from "../../XacNhanXoaDialog";
import BangChuyenCanCard from "./BangChuyenCanCard";
import DanhSachChuyenCanCard from "./DanhSachChuyenCanCard";
import QuanLyChuyenCanDialog from "./QuanLyChuyenCanDialog";
import TaiSuDungChuyenCanDialog from "./TaiSuDungChuyenCanDialog";
import { docFileChuyenCan, taiFileMauChuyenCan, xuatChuyenCanExcel } from "./chuyenCanExcel";

/**
 * Màn hình Lương chuyên cần của khu "Dữ liệu tính lương".
 *
 * Bảng là bản nháp cục bộ (xem ghi chú ở `KpiPanel`). KHÁC các màn còn lại: máy chủ KHÔNG có
 * endpoint "áp dụng hàng loạt, thay thế toàn bộ" cho chuyên cần — mỗi lần vi phạm là MỘT bản ghi
 * ghi riêng qua `POST /payroll-data/diligence/record`, không có khái niệm "mẫu" theo `scope`.
 * "Áp dụng chuyên cần" ở đây mô phỏng lại đúng ngữ nghĩa "thay thế" của bản mock bằng cách, với
 * từng nhân viên trong danh sách: xóa hết bản ghi cũ của kỳ này rồi ghi lại từng dòng trong bảng
 * đang soạn, TUẦN TỰ — chạy tuần tự để nếu lỗi giữa chừng vẫn nói được đã xong tới đâu (cùng lối
 * với `useGanNhanhPhongBan`).
 *
 * "Đơn giá"/"Tổng trừ"/"Thành tiền" đọc THẲNG từ máy chủ (`GET .../diligence`, đã áp dụng bất
 * biến "chặn sàn chuyên cần" BR-dltl-016) — không tính lại ở trình duyệt như bản mock.
 */
export default function ChuyenCanPanel() {
  const { selectedPeriodId } = useCurrentPayrollPeriod();
  const { isReadOnly, bangKeDaChot } = useBangKeChiDoc("DILIGENCE");
  const periodId = selectedPeriodId ?? "";

  const danhMuc = useLoaiChuyenCanList();
  const idTheoMa = useLoaiChuyenCanIdByCode();
  const qc = useQueryClient();
  const { currentCompanyId } = useAuth();

  const [mau, setMau] = useState<DongChuyenCan[]>([]);
  const [phamVi, setPhamVi] = useState<PhamViApDung>("nhan_vien");
  const [filters, setFilters] = useState<LocNhanVienKyLuong>({
    q: "",
    ma_pb: "",
    loai_hd: "",
  });
  const [dangApDung, setDangApDung] = useState(false);

  const [moQuanLy, setMoQuanLy] = useState(false);
  const [moTaiSuDung, setMoTaiSuDung] = useState(false);
  const [moXoaTatCa, setMoXoaTatCa] = useState(false);
  const [moApDung, setMoApDung] = useState(false);

  const inputFile = useRef<HTMLInputElement>(null);
  const nhanVien = useNhanVienKyLuong(phamVi, filters);
  const { data: diligenceData } = useDiligenceDataList({ periodId });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMau([]);
  }, [periodId]);

  const rows: ChuyenCanNhanVienRow[] = useMemo(
    () =>
      mergeNhanVienKyLuongWithData(nhanVien, diligenceData, (row, ban) => ({
        ...row,
        don_gia: ban?.donGia ?? 0,
        tong_tru: ban?.tongTru ?? 0,
        thanh_tien: ban?.thanhTien ?? 0,
        so_dong: ban?.records.length ?? 0,
      })),
    [nhanVien, diligenceData],
  );

  const coThayDoi = mau.length > 0;
  // RVW-707: nháp chỉ sống trong state — chặn F5/đóng tab khi còn nội dung
  // chưa áp dụng, tránh mất trắng im lặng.
  useCanhBaoRoiTrang(coThayDoi);
  // RVW-711: nhân viên có vi phạm chuyên cần trong kỳ nhưng bị 3 ô lọc ẩn khỏi
  // bảng — dữ liệu vẫn tính vào lương, chỉ là không ai thấy để kiểm tra ở màn này.
  const soNgoaiBoLoc = demSoNgoaiBoLoc(nhanVien, diligenceData);
  // RVW-701/702: dòng chưa chọn loại hoặc chưa nhập ngày mà lọt qua vòng lặp
  // xóa+ghi sẽ khiến nhân viên đó mất dữ liệu cũ mà không ghi lại được.
  const hopLe = mau.every((d) => d.ma_cc !== "" && d.ngay !== "");

  /**
   * RVW-705: nạp lại danh sách vi phạm + bảng lương xem trước SAU KHI cả loạt
   * ghi/xóa đã xong — gọi 1 lần, không đặt trong vòng lặp theo từng nhân viên.
   * Trước đây dùng `useRecordDiligence`/`useDeleteDiligenceRecord` (tự
   * `invalidateQueries` ở `onSuccess`), khiến mỗi lần ghi 1 bản ghi kích thêm 1
   * lượt GET danh sách toàn bộ nhân viên — N người × M dòng ghi thành O(N²M).
   */
  const napLaiDuLieu = useCallback(() => {
    void qc.invalidateQueries({
      queryKey: hrmPayrollDataKeys.diligenceList(currentCompanyId, periodId),
    });
    void qc.invalidateQueries({
      queryKey: hrmPayrollCalculationKeys.calculate(currentCompanyId, periodId),
    });
  }, [qc, currentCompanyId, periodId]);

  /**
   * Xóa hết bản ghi hiện có của MỘT nhân viên trong kỳ này — gọi thẳng hàm tầng
   * api (không qua hook mutation) để KHÔNG kích invalidate riêng cho từng lần
   * xóa khi hàm này chạy bên trong vòng lặp N người của `apDungChoMotNguoi`.
   */
  const xoaChoMotNguoiSilent = useCallback(
    async (maNv: string) => {
      const banHienTai = (diligenceData ?? []).find((r) => r.ma_nv === maNv);
      for (const rec of banHienTai?.records ?? []) {
        await deleteDiligenceRecord(rec.id);
      }
    },
    [diligenceData],
  );

  /** Xóa hết bản ghi của MỘT nhân viên rồi nạp lại dữ liệu ngay — dùng cho nút "Xóa" đơn lẻ. */
  const xoaChoMotNguoi = useCallback(
    async (maNv: string) => {
      await xoaChoMotNguoiSilent(maNv);
      napLaiDuLieu();
    },
    [xoaChoMotNguoiSilent, napLaiDuLieu],
  );

  /** Xóa hết bản ghi hiện có của MỘT nhân viên trong kỳ này, rồi ghi lại theo bảng đang soạn. */
  const apDungChoMotNguoi = useCallback(
    async (maNv: string) => {
      await xoaChoMotNguoiSilent(maNv);
      for (const d of mau) {
        await recordDiligence({
          periodId,
          ma_nv: maNv,
          violationTypeId: idTheoMa.get(d.ma_cc) ?? d.ma_cc,
          violationDate: d.ngay,
          violationHours: d.so_gio,
        });
      }
    },
    [xoaChoMotNguoiSilent, mau, periodId, idTheoMa],
  );

  const handleApDung = async () => {
    setMoApDung(false);
    // RVW-701: validate TOÀN BỘ bảng đang soạn TRƯỚC vòng lặp, trước cả lời gọi
    // xóa đầu tiên — không thì người đầu tiên đã bị xóa dữ liệu cũ mà không ghi
    // lại được vì dòng chưa khai xong bị BE từ chối.
    if (!hopLe) {
      toast.error(
        "Bảng đang soạn còn dòng chưa chọn loại chuyên cần hoặc chưa nhập ngày — kiểm tra lại trước khi áp dụng.",
      );
      return;
    }
    setDangApDung(true);
    let xong = 0;
    // RVW-702: bắt lỗi BÊN TRONG vòng lặp — lỗi ở người thứ k phải nêu rõ tên
    // người đó, không chỉ đếm số đã xong, để người chốt lương biết phải kiểm tra ai.
    // RVW-705: nạp lại dữ liệu đúng MỘT lần trong `finally`, dù xong hết hay
    // dừng giữa chừng — không còn nạp lại sau MỖI người trong vòng lặp.
    try {
      for (const row of rows) {
        try {
          await apDungChoMotNguoi(row.ma_nv);
          xong += 1;
        } catch (err) {
          toast.error(
            getErrorMessage(
              err,
              `Dừng ở ${row.ho_ten} (${row.ma_nv}) — đã áp xong ${xong}/${rows.length} người, kiểm tra và áp lại cho những người còn thiếu.`,
            ),
          );
          return;
        }
      }
      toast.success(`Đã áp bảng chuyên cần cho ${xong} nhân viên.`);
    } finally {
      napLaiDuLieu();
      setDangApDung(false);
    }
  };

  const handleTaiMau = async () => {
    try {
      await taiFileMauChuyenCan(danhMuc);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không tạo được file mẫu."));
    }
  };

  const handleXuat = async () => {
    try {
      await xuatChuyenCanExcel(mau, danhMuc, rows);
      toast.success("Đã xuất file Bang-chuyen-can.xlsx.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Không xuất được Excel."));
    }
  };

  const handleNhap = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dong = await docFileChuyenCan(file, danhMuc);
      setMau(dong);
      toast.success(`Đã đọc ${dong.length} lần vi phạm từ file. Bấm "Áp dụng chuyên cần" để ghi lại.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không đọc được file Excel."));
    }
  };

  if (!periodId) {
    return (
      <Alert severity="info">
        Chưa có kỳ lương nào được chọn — tạo hoặc chọn một kỳ lương ở thanh phía trên trước khi
        nhập chuyên cần.
      </Alert>
    );
  }

  return (
    <Stack spacing={2.5}>
      {isReadOnly && (
        <CanhBaoChiDoc
          bangKeDaChot={bangKeDaChot}
          hanhDong="không thể sửa hoặc áp dụng chuyên cần mới"
        />
      )}

      <ThanhCongCuBangNhap
        isReadOnly={isReadOnly}
        coThayDoi={coThayDoi}
        soLuongApDung={rows.length}
        // Không khóa theo `mau.length`: áp bảng rỗng là chốt "không vi phạm".
        // `!hopLe` thì khóa: dòng chưa khai xong lọt vào là mất dữ liệu cũ (RVW-701).
        disabledApDung={isReadOnly || dangApDung || rows.length === 0 || !hopLe}
        disabledXoaTatCa={mau.length === 0}
        inputFile={inputFile}
        onTaiMau={handleTaiMau}
        onNhap={handleNhap}
        onXuat={handleXuat}
        onApDung={() => setMoApDung(true)}
        onTaiSuDung={() => setMoTaiSuDung(true)}
        onXoaTatCa={() => setMoXoaTatCa(true)}
        onQuanLy={() => setMoQuanLy(true)}
        nhanApDung="Áp dụng chuyên cần"
        nhanQuanLy="Quản lý chuyên cần"
        canhBaoChuaApDung="Bảng chuyên cần có nội dung chưa áp dụng"
      />

      <BangChuyenCanCard values={mau} onChange={setMau} rows={rows} />

      <DanhSachChuyenCanCard
        phamVi={phamVi}
        onPhamVi={setPhamVi}
        filters={filters}
        onFilters={setFilters}
        rows={rows}
        isReadOnly={isReadOnly}
        onXoaNhanVien={xoaChoMotNguoi}
      />
      <CanhBaoNgoaiBoLoc soLuong={soNgoaiBoLoc} module="chuyên cần" />

      <QuanLyChuyenCanDialog open={moQuanLy} onClose={() => setMoQuanLy(false)} />

      <TaiSuDungChuyenCanDialog
        open={moTaiSuDung}
        onClose={() => setMoTaiSuDung(false)}
        onChon={setMau}
      />

      <XacNhanXoaDialog
        open={moXoaTatCa}
        tieuDe="Xóa tất cả dòng vi phạm"
        noiDung={
          <>
            Xóa toàn bộ <strong>{mau.length} dòng</strong> khỏi bảng đang soạn? Chuyên cần đã áp
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
        <DialogTitle>Áp dụng chuyên cần</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            {mau.length === 0 ? (
              <>
                Bảng đang trống — áp nghĩa là chốt <strong>không vi phạm</strong> cho{" "}
                <strong>{rows.length} nhân viên</strong> theo phạm vi{" "}
                <strong>{nhan(PHAM_VI_AP_DUNG, phamVi).toLowerCase()}</strong>, tất cả nhận đủ
                chuyên cần.
              </>
            ) : (
              <>
                Áp bảng đang soạn ({mau.length} lần vi phạm) cho{" "}
                <strong>{rows.length} nhân viên</strong> theo phạm vi{" "}
                <strong>{nhan(PHAM_VI_AP_DUNG, phamVi).toLowerCase()}</strong>? Số tiền trừ tính
                riêng cho từng người theo mức chuyên cần của họ.
              </>
            )}
            {rows.length > 1 && mau.length > 0 && (
              <Box component="span" sx={{ display: "block", mt: 1.5, color: "warning.main" }}>
                Lưu ý: cả {rows.length} người sẽ bị ghi cùng danh sách vi phạm này — ghi tuần tự
                từng người, có thể mất vài giây với danh sách dài.
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
            disabled={dangApDung}
            sx={{ textTransform: "none" }}
          >
            Áp dụng
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
