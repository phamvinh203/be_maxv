import { useMemo, useState, type MouseEvent } from "react";
import { toast } from "react-toastify";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import ButtonBase from "@mui/material/ButtonBase";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { getErrorMessage } from "../../../../../lib/errors";
import {
  cacNgayTrongThang,
  khoaCham,
  ngayCongChuan,
  nhanThu,
  oCham,
  oMacDinh,
  thongKeDong,
  type NgayCham,
} from "../../../calculations/du_lieu_tinh_luong/chamCong";
import { COT_THONG_KE_CONG, moTaLoaiCong } from "../../../_shared/constants";
import { useCauHinh } from "../../../api/cau_hinh_mac_dinh/cauHinhQueries";
import { useNgayLeList } from "../../../api/cau_hinh_mac_dinh/holidaysQueries";
import { useNhanVienList } from "../../../api/du_lieu_nhan_vien/nhanVienQueries";
import { useAttendanceMatrix, useOverrideAttendanceCell } from "../../../api/du_lieu_tinh_luong/payrollInputsQueries";
import { useCurrentPayrollPeriod } from "../useCurrentPayrollPeriod";
import { useBangKeChiDoc } from "../useBangKeChiDoc";
import CanhBaoChiDoc from "../CanhBaoChiDoc";
import type { LoaiCong, OChamCong } from "../../../types";
import OChamCongPopover from "./OChamCongPopover";

/** Bề ngang một cột ngày — đủ chỗ cho ký hiệu mà 31 cột vẫn vừa màn hình rộng. */
const RONG_COT_NGAY = 40;

interface ODangMo {
  neo: HTMLElement;
  maNv: string;
  tenNv: string;
  ngayCham: NgayCham;
  giaTri: OChamCong | null;
}

/**
 * Bảng chấm công của kỳ lương đang chọn.
 *
 * Ô chưa đụng tới đọc theo lịch chuẩn (chính sách thứ 7 / chủ nhật ở Thiết lập
 * chung, trừ ngày lễ ở Lịch ngày lễ, cả hai đều đã là API thật), nên bảng mở ra
 * đã đúng sẵn phần lớn và người dùng chỉ sửa các ngày khác thường.
 *
 * ⚠️ KHÔNG còn nút "Đặt lại theo lịch chuẩn": API chỉ có `PUT .../attendance/cell`
 * (ghi đè MỘT ô), không có endpoint xóa/reset hàng loạt cho cả tháng — xóa từng
 * ô sai một mà không có cách "dọn sạch cả bảng" là chấp nhận được vì số ô người
 * dùng thực sự chỉnh tay luôn là thiểu số (phần lớn ô để mặc định theo lịch).
 *
 * "Xóa ô" trong popover không xóa được bản ghi (API không hỗ trợ `attendanceType`
 * rỗng/`null`) — ghi đè lại đúng giá trị MẶC ĐỊNH suy từ lịch (`oMacDinh`), cho
 * kết quả hiển thị giống hệt "xóa" dù trong CSDL vẫn còn một dòng ghi đè.
 */
export default function ChamCongPanel() {
  const { selectedPeriod } = useCurrentPayrollPeriod();
  const { isReadOnly, bangKeDaChot } = useBangKeChiDoc("ATTENDANCE");
  const periodId = selectedPeriod?.id ?? "";
  const nam = selectedPeriod?.year ?? new Date().getFullYear();
  const thang = selectedPeriod?.month ?? new Date().getMonth() + 1;

  const cauHinh = useCauHinh();
  const ngayLe = useNgayLeList();
  const nhanVienGoc = useNhanVienList();
  const { data: attendanceRecords } = useAttendanceMatrix({ periodId });
  const overrideMut = useOverrideAttendanceCell(periodId);

  const [dangMo, setDangMo] = useState<ODangMo | null>(null);

  const ngayTrongThang = useMemo(
    () => cacNgayTrongThang(nam, thang, cauHinh, ngayLe),
    [nam, thang, cauHinh, ngayLe],
  );
  const gioCongChuanNgay = cauHinh.gio_cong_chuan_ngay;
  const ngayChuan = useMemo(
    () => ngayCongChuan(cauHinh, ngayTrongThang),
    [cauHinh, ngayTrongThang],
  );

  const ghiDe = useMemo(() => {
    const map: Record<string, OChamCong | null> = {};
    for (const rec of attendanceRecords?.records ?? []) {
      map[khoaCham(rec.ma_nv, rec.workDate.slice(0, 10))] = {
        loai: rec.attendanceType as LoaiCong,
        soGio: rec.actualHours,
      };
    }
    return map;
  }, [attendanceRecords]);

  const nhanVien = useMemo(
    () =>
      nhanVienGoc
        .filter((nv) => nv.status === "1")
        .sort((a, b) => a.ma_nv.localeCompare(b.ma_nv)),
    [nhanVienGoc],
  );

  const dong = useMemo(
    () =>
      nhanVien.map((nv) => ({
        nhanVien: nv,
        o: ngayTrongThang.map((nc) => oCham(ghiDe, nv.ma_nv, nc)),
        thongKe: thongKeDong(ghiDe, nv.ma_nv, ngayTrongThang, gioCongChuanNgay),
      })),
    [nhanVien, ngayTrongThang, ghiDe, gioCongChuanNgay],
  );

  const moO = (
    e: MouseEvent<HTMLElement>,
    maNv: string,
    tenNv: string,
    ngayCham: NgayCham,
    giaTri: OChamCong | null,
  ) => setDangMo({ neo: e.currentTarget, maNv, tenNv, ngayCham, giaTri });

  const ghiO = async (maNv: string, ngay: string, o: OChamCong) => {
    try {
      await overrideMut.mutateAsync({
        periodId,
        ma_nv: maNv,
        workDate: ngay,
        attendanceType: o.loai,
        actualHours: o.soGio > 0 ? o.soGio : undefined,
      });
    } catch (err) {
      toast.error(getErrorMessage(err, "Không ghi được ô chấm công."));
    }
  };

  if (!periodId) {
    return (
      <Alert severity="info">
        Chưa có kỳ lương nào được chọn — tạo hoặc chọn một kỳ lương ở thanh phía trên trước khi
        chấm công.
      </Alert>
    );
  }

  return (
    <Box>
      {isReadOnly && (
        <CanhBaoChiDoc
          bangKeDaChot={bangKeDaChot}
          hanhDong="không thể sửa chấm công"
          sx={{ mb: 2 }}
        />
      )}

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        sx={{ mb: 2, alignItems: { md: "center" }, justifyContent: "space-between" }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Tháng {String(thang).padStart(2, "0")}/{nam}
          </Typography>
          <Chip
            size="small"
            color="primary"
            variant="outlined"
            label={`Ngày công chuẩn: ${ngayChuan}`}
          />
          <Chip size="small" variant="outlined" label={`${dong.length} nhân viên`} />
        </Stack>
      </Stack>

      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: "70vh" }}>
        <Table size="small" stickyHeader sx={{ tableLayout: "fixed", width: "max-content" }}>
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  // Cột tên dính bên trái để cuộn ngang qua 31 ngày vẫn biết đang chấm cho ai.
                  position: "sticky",
                  left: 0,
                  zIndex: 3,
                  bgcolor: "background.paper",
                  minWidth: 200,
                  fontWeight: 700,
                }}
              >
                Họ và tên
              </TableCell>

              {ngayTrongThang.map((nc) => {
                const nghi = !nc.laNgayLamViec;
                return (
                  <Tooltip
                    key={nc.ngay}
                    title={
                      nc.tenNgayLe
                        ? `${nc.ngay} — ${nc.tenNgayLe}`
                        : nghi
                          ? `${nc.ngay} — ngày nghỉ`
                          : nc.ngay
                    }
                  >
                    <TableCell
                      align="center"
                      sx={{
                        width: RONG_COT_NGAY,
                        px: 0,
                        bgcolor: (theme) =>
                          nc.tenNgayLe
                            ? alpha(theme.palette.error.main, 0.12)
                            : nghi
                              ? alpha(theme.palette.warning.main, 0.12)
                              : "background.paper",
                      }}
                    >
                      <Typography variant="caption" sx={{ fontWeight: 700, display: "block" }}>
                        {nc.soNgay}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ fontSize: 10, color: "text.secondary" }}
                      >
                        {nhanThu(nc.thu)}
                      </Typography>
                    </TableCell>
                  </Tooltip>
                );
              })}

              <TableCell align="center" sx={{ minWidth: 100, fontWeight: 700 }}>
                Ngày công chuẩn
              </TableCell>
              <TableCell align="center" sx={{ minWidth: 110, fontWeight: 700 }}>
                Ngày công thực tế
              </TableCell>
              {COT_THONG_KE_CONG.map((loai) => (
                <TableCell key={loai} align="center" sx={{ minWidth: 90, fontWeight: 700 }}>
                  {moTaLoaiCong(loai).label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {dong.map((d) => (
              <TableRow key={d.nhanVien.ma_nv} hover>
                <TableCell
                  sx={{
                    position: "sticky",
                    left: 0,
                    zIndex: 1,
                    bgcolor: "background.paper",
                    minWidth: 200,
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                    {d.nhanVien.ho_ten}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {d.nhanVien.ma_nv}
                  </Typography>
                </TableCell>

                {ngayTrongThang.map((nc, i) => {
                  const o = d.o[i] ?? null;
                  const moTa = o ? moTaLoaiCong(o.loai) : null;
                  return (
                    <TableCell
                      key={nc.ngay}
                      align="center"
                      sx={{
                        width: RONG_COT_NGAY,
                        p: 0.25,
                        bgcolor: (theme) =>
                          nc.tenNgayLe
                            ? alpha(theme.palette.error.main, 0.06)
                            : !nc.laNgayLamViec
                              ? alpha(theme.palette.warning.main, 0.06)
                              : undefined,
                      }}
                    >
                      <ButtonBase
                        disabled={isReadOnly}
                        onClick={(e) => moO(e, d.nhanVien.ma_nv, d.nhanVien.ho_ten, nc, o)}
                        sx={{
                          width: "100%",
                          minHeight: 28,
                          borderRadius: 0.75,
                          fontSize: 12,
                          fontWeight: 700,
                          color:
                            !moTa || moTa.mau === "default"
                              ? "text.primary"
                              : `${moTa.mau}.contrastText`,
                          bgcolor: moTa
                            ? moTa.mau === "default"
                              ? "action.selected"
                              : `${moTa.mau}.main`
                            : "transparent",
                          "&:hover": { outline: "2px solid", outlineColor: "primary.main" },
                        }}
                      >
                        {/* Ô đã nhập số giờ riêng thì hiện luôn số giờ, không hiện ký hiệu. */}
                        {o ? (o.soGio > 0 ? `${o.soGio}h` : moTa?.kyHieu) : ""}
                      </ButtonBase>
                    </TableCell>
                  );
                })}

                <TableCell align="center">{ngayChuan}</TableCell>
                <TableCell align="center">
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 700,
                      // Thiếu công so với chuẩn thì tô đỏ, dư thì tô xanh.
                      color:
                        d.thongKe.ngayCongThucTe < ngayChuan
                          ? "error.main"
                          : d.thongKe.ngayCongThucTe > ngayChuan
                            ? "success.main"
                            : "text.primary",
                    }}
                  >
                    {d.thongKe.ngayCongThucTe}
                  </Typography>
                </TableCell>
                {COT_THONG_KE_CONG.map((loai) => {
                  const so = d.thongKe.soNgayTheoLoai[loai];
                  return (
                    <TableCell key={loai} align="center">
                      {so > 0 ? (
                        so
                      ) : (
                        <Box component="span" sx={{ color: "text.disabled" }}>
                          0
                        </Box>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}

            {dong.length === 0 && (
              <TableRow>
                <TableCell colSpan={ngayTrongThang.length + 2 + COT_THONG_KE_CONG.length}>
                  <Typography
                    variant="body2"
                    color="text.disabled"
                    sx={{ textAlign: "center", py: 4 }}
                  >
                    Chưa có nhân viên đang làm việc để chấm công.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Stack direction="row" spacing={2} sx={{ mt: 1.5, flexWrap: "wrap", gap: 1 }}>
        {LOAI_CONG_CHU_THICH.map((loai) => {
          const moTa = moTaLoaiCong(loai);
          return (
            <Stack key={loai} direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
              <Box
                sx={{
                  minWidth: 26,
                  textAlign: "center",
                  px: 0.5,
                  borderRadius: 0.75,
                  fontSize: 11,
                  fontWeight: 700,
                  color: moTa.mau === "default" ? "text.primary" : `${moTa.mau}.contrastText`,
                  bgcolor: moTa.mau === "default" ? "action.selected" : `${moTa.mau}.main`,
                }}
              >
                {moTa.kyHieu}
              </Box>
              <Typography variant="caption" color="text.secondary">
                {moTa.label}
              </Typography>
            </Stack>
          );
        })}
        <Typography variant="caption" color="text.secondary">
          Bấm vào ô để chọn loại công. Ngày công chuẩn và lịch nghỉ lấy từ tab Cấu hình mặc
          định.
        </Typography>
      </Stack>

      <OChamCongPopover
        neo={dangMo?.neo ?? null}
        tenNhanVien={dangMo?.tenNv ?? ""}
        ngayCham={dangMo?.ngayCham ?? null}
        giaTri={dangMo?.giaTri ?? null}
        gioCongChuanNgay={gioCongChuanNgay}
        onClose={() => setDangMo(null)}
        onLuu={(o) => {
          if (dangMo) void ghiO(dangMo.maNv, dangMo.ngayCham.ngay, o);
          setDangMo(null);
        }}
        onXoa={() => {
          // API không hỗ trợ "xóa ô" — ghi đè lại đúng giá trị mặc định suy từ lịch (xem ghi chú
          // đầu file). Ngày không phải ngày làm việc và không phải lễ thì không có mặc định nào
          // để quay về — chọn "khong_luong" 0 giờ làm giá trị trung tính gần nhất.
          if (dangMo) {
            const macDinh = oMacDinh(dangMo.ngayCham) ?? { loai: "khong_luong" as const, soGio: 0 };
            void ghiO(dangMo.maNv, dangMo.ngayCham.ngay, macDinh);
          }
          setDangMo(null);
        }}
      />
    </Box>
  );
}

/** Thứ tự ký hiệu ở dòng chú thích dưới bảng. */
const LOAI_CONG_CHU_THICH = [
  "lam_viec",
  "nua_ngay",
  "cong_tac",
  "nghi_phep",
  "nghi_le",
  "om",
  "khong_luong",
  "khac",
] as const;
