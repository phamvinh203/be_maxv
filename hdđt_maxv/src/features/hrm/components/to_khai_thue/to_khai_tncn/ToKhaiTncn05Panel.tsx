import { useState } from "react";
import { toast } from "react-toastify";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import PictureAsPdfRounded from "@mui/icons-material/PictureAsPdfRounded";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import TableChartRounded from "@mui/icons-material/TableChartRounded";
import UploadFileRounded from "@mui/icons-material/UploadFileRounded";
import { luuVeMay } from "@/lib/downloadFile";
import { getErrorMessage } from "@/lib/errors";
import { tenFileToKhai } from "../../../api/to_khai_thue/toKhaiThueApi";
import {
  useDanhDauDaNop,
  useGhiDeChiTieu,
  useLichSuKyKhai,
  useTaiBangChiTietExcel,
  useTaiLaiFileToKhai,
  useToKhaiQuy,
  useXoaGhiDeChiTieu,
  useXuatToKhai,
} from "../../../api/to_khai_thue/toKhaiThueQueries";
import type { CtTagTncn05, DinhDangFile } from "../../../types/toKhaiThue";
import { tienVn } from "../../../_shared/format";
import { useCurrentPayrollPeriod } from "../../du_lieu_tinh_luong/useCurrentPayrollPeriod";
import { useLaChuTaiKhoan } from "../../chot_ky_luong/useLaChuTaiKhoan";
import { MAU_TRANG_THAI_TO_KHAI, NHAN_TRANG_THAI_TO_KHAI } from "../nhan";
import ToKhaiTncn05Editor from "./ToKhaiTncn05Editor";
import XuatToKhaiDialog from "./XuatToKhaiDialog";

/**
 * Màn Tờ khai thuế TNCN quý (mẫu 05/KK-TNCN).
 *
 * Vòng đời một kỳ: chưa đủ 3 tháng chốt → sẵn sàng xuất (sửa được chỉ tiêu) → đã xuất (đóng băng,
 * 3 tháng khóa vĩnh viễn) → đã nộp. Mỗi trạng thái mở ra một bộ thao tác khác nhau, nên các nút ở
 * đây bám theo `trangThai` của máy chủ chứ không tự đoán.
 */

const NAM_HIEN_TAI = new Date().getFullYear();
const CAC_NAM = [NAM_HIEN_TAI + 1, NAM_HIEN_TAI, NAM_HIEN_TAI - 1, NAM_HIEN_TAI - 2];
const CAC_QUY = [1, 2, 3, 4];

export default function ToKhaiTncn05Panel() {
  const { selectedPeriod, thangChon } = useCurrentPayrollPeriod();
  // Xuất tờ khai, tải lại file và đánh dấu đã nộp đều đòi ADMIN/OWNER (E-tkt-014) — khóa nút sớm
  // kèm lời giải thích, máy chủ vẫn là bên chặn thật.
  const laChuTaiKhoan = useLaChuTaiKhoan();
  const khongDuQuyen = laChuTaiKhoan ? "" : "Chỉ chủ tài khoản hoặc quản trị viên làm được việc này";
  const namTheoKy = selectedPeriod?.year ?? thangChon.nam;
  const quyTheoKy = Math.ceil((selectedPeriod?.month ?? thangChon.thang) / 3);

  // Kỳ xem mặc định BÁM theo tháng đang chọn ở thanh HRM; chỉ khi kế toán tự chọn năm/quý mới
  // giữ lựa chọn đó. Làm bằng giá trị dẫn xuất chứ không đồng bộ bằng effect: đồng bộ kiểu đó sẽ
  // đá lựa chọn tay của người dùng mỗi lần thanh HRM đổi tháng.
  const [chonTay, setChonTay] = useState<{ nam: number; quy: number } | null>(null);
  const nam = chonTay?.nam ?? namTheoKy;
  const quy = chonTay?.quy ?? quyTheoKy;
  const setNam = (n: number) => setChonTay({ nam: n, quy });
  const setQuy = (q: number) => setChonTay({ nam, quy: q });
  const [hoiXuat, setHoiXuat] = useState<DinhDangFile | null>(null);
  const [hoiNop, setHoiNop] = useState(false);
  // Dọn ở MỌI đường đóng (RVW-747): tên người ký gõ dở của quý này mà còn lại sang quý khác là ghi
  // thẳng một người ký sai vào tờ khai chính thức đã xuất.
  const dongHoiNop = () => {
    setHoiNop(false);
    setNopNguoiKy("");
    setNopNgayKy("");
  };
  const [nopNguoiKy, setNopNguoiKy] = useState("");
  const [nopNgayKy, setNopNgayKy] = useState("");

  const { data: toKhai, isLoading, isFetching, refetch } = useToKhaiQuy(nam, quy);
  const { data: lichSu = [] } = useLichSuKyKhai(nam);
  const ghiDeMut = useGhiDeChiTieu();
  const xoaGhiDeMut = useXoaGhiDeChiTieu();
  const xuatMut = useXuatToKhai();
  const taiLaiMut = useTaiLaiFileToKhai();
  const chiTietMut = useTaiBangChiTietExcel();
  const nopMut = useDanhDauDaNop();

  const trangThai = toKhai?.trangThai;
  const suaDuocChiTieu = trangThai === "READY_TO_EXPORT";
  const daXuat = trangThai === "EXPORTED" || trangThai === "SUBMITTED";

  async function luuGhiDe(tag: CtTagTncn05, gia: number, lyDo: string) {
    try {
      await ghiDeMut.mutateAsync({ nam, quy, overrides: { [tag]: { gia, lyDo } } });
      toast.success(`Đã ghi đè chỉ tiêu [${tag.replace("ct", "")}].`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Chưa ghi đè được chỉ tiêu này."));
      throw err;
    }
  }

  async function xoaGhiDe(tag: CtTagTncn05) {
    try {
      await xoaGhiDeMut.mutateAsync({ nam, quy, ct: tag });
      toast.success(`Đã trả chỉ tiêu [${tag.replace("ct", "")}] về số máy tính.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Chưa đặt lại được chỉ tiêu này."));
      throw err;
    }
  }

  async function xuat(format: DinhDangFile, nguoiKy: string, ngayKy: string) {
    try {
      const blob = await xuatMut.mutateAsync({
        nam,
        quy,
        format,
        nguoiKy: nguoiKy || undefined,
        ngayKy: ngayKy || undefined,
      });
      luuVeMay(blob, tenFileToKhai(nam, quy, format));
      toast.success(`Đã xuất tờ khai quý ${quy}/${nam}. Ba tháng của quý từ giờ không mở lại được.`);
    } catch (err) {
      toast.error(
        getErrorMessage(
          err,
          "Chưa xuất được tờ khai. Nếu tờ khai đã chuyển sang trạng thái đã xuất, hãy dùng nút Tải lại file.",
        ),
      );
    } finally {
      setHoiXuat(null);
    }
  }

  async function taiLai(format: DinhDangFile) {
    try {
      const blob = await taiLaiMut.mutateAsync({ nam, quy, format });
      luuVeMay(blob, tenFileToKhai(nam, quy, format));
    } catch (err) {
      toast.error(getErrorMessage(err, "Chưa tải lại được file tờ khai."));
    }
  }

  async function taiBangChiTiet() {
    try {
      const blob = await chiTietMut.mutateAsync({ nam, quy });
      luuVeMay(blob, `Bang-chi-tiet-05-KK-TNCN_Quy${quy}_${nam}.xlsx`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Chưa tải được bảng chi tiết."));
    }
  }

  async function danhDauNop() {
    try {
      await nopMut.mutateAsync({
        nam,
        quy,
        nguoiKy: nopNguoiKy.trim() || undefined,
        ngayKy: nopNgayKy || undefined,
      });
      toast.success("Đã ghi nhận tờ khai là đã nộp.");
      dongHoiNop();
    } catch (err) {
      toast.error(getErrorMessage(err, "Chưa đánh dấu được là đã nộp."));
    }
  }

  const thangThieu = (toKhai?.cacThang ?? []).filter((t) => !t.daChot);

  return (
    <Box sx={{ p: 2 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ mb: 2, alignItems: { md: "center" }, justifyContent: "space-between" }}
      >
        <Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Typography variant="h6">Tờ khai thuế TNCN quý</Typography>
            {trangThai && (
              <Chip
                size="small"
                color={MAU_TRANG_THAI_TO_KHAI[trangThai]}
                label={NHAN_TRANG_THAI_TO_KHAI[trangThai]}
              />
            )}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Mẫu 05/KK-TNCN · kỳ khai theo quý
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
          <TextField
            select
            size="small"
            label="Năm"
            value={nam}
            onChange={(e) => setNam(Number(e.target.value))}
            sx={{ minWidth: 110 }}
          >
            {CAC_NAM.map((n) => (
              <MenuItem key={n} value={n}>
                {n}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Quý"
            value={quy}
            onChange={(e) => setQuy(Number(e.target.value))}
            sx={{ minWidth: 100 }}
          >
            {CAC_QUY.map((q) => (
              <MenuItem key={q} value={q}>
                Quý {q}
              </MenuItem>
            ))}
          </TextField>
          <Button
            startIcon={isFetching ? <CircularProgress size={16} /> : <RefreshRounded />}
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            Làm mới
          </Button>
        </Stack>
      </Stack>

      {isLoading ? (
        <Stack sx={{ alignItems: "center", py: 6 }}>
          <CircularProgress />
        </Stack>
      ) : !toKhai ? (
        <Alert severity="warning">Chưa đọc được tờ khai quý {quy}/{nam}.</Alert>
      ) : (
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              sx={{ justifyContent: "space-between" }}
            >
              <Box>
                <Typography variant="subtitle2">{toKhai.thongTinNguoiNopThue.ten}</Typography>
                <Typography variant="body2" color="text.secondary">
                  MST {toKhai.thongTinNguoiNopThue.maSoThue}
                  {toKhai.thongTinNguoiNopThue.diaChi ? ` · ${toKhai.thongTinNguoiNopThue.diaChi}` : ""}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Cơ quan thuế quản lý:{" "}
                  {toKhai.thongTinNguoiNopThue.coQuanThueQuanLy || "chưa có trong hệ thống"}
                </Typography>
              </Box>

              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                {toKhai.cacThang.map((t) => (
                  <Chip
                    key={t.month}
                    size="small"
                    variant={t.daChot ? "filled" : "outlined"}
                    color={t.daChot ? "success" : "default"}
                    icon={t.daChot ? <CheckCircleRounded /> : undefined}
                    label={`T${t.month} ${t.daChot ? "đã chốt" : t.periodId ? "chưa chốt" : "chưa có kỳ"}`}
                  />
                ))}
              </Stack>
            </Stack>

            <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 2, flexWrap: "wrap" }}>
              {suaDuocChiTieu && (
                <Tooltip title={khongDuQuyen}>
                  <span>
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="contained"
                        startIcon={<FileDownloadRounded />}
                        disabled={xuatMut.isPending || !laChuTaiKhoan}
                        onClick={() => setHoiXuat("excel")}
                      >
                        Xuất tờ khai (Excel)
                      </Button>
                      <Button
                        startIcon={<PictureAsPdfRounded />}
                        disabled={xuatMut.isPending || !laChuTaiKhoan}
                        onClick={() => setHoiXuat("pdf")}
                      >
                        Xuất tờ khai (PDF)
                      </Button>
                    </Stack>
                  </span>
                </Tooltip>
              )}
              {daXuat && (
                <Tooltip title={khongDuQuyen}>
                  <span>
                    <Stack direction="row" spacing={1}>
                      <Button
                        startIcon={<FileDownloadRounded />}
                        disabled={taiLaiMut.isPending || !laChuTaiKhoan}
                        onClick={() => void taiLai("excel")}
                      >
                        Tải lại file Excel
                      </Button>
                      <Button
                        startIcon={<PictureAsPdfRounded />}
                        disabled={taiLaiMut.isPending || !laChuTaiKhoan}
                        onClick={() => void taiLai("pdf")}
                      >
                        Tải lại file PDF
                      </Button>
                    </Stack>
                  </span>
                </Tooltip>
              )}
              {trangThai === "EXPORTED" && (
                <Tooltip title={khongDuQuyen}>
                  <span>
                    <Button
                      color="success"
                      variant="contained"
                      startIcon={<UploadFileRounded />}
                      disabled={!laChuTaiKhoan}
                      onClick={() => setHoiNop(true)}
                    >
                      Đánh dấu đã nộp
                    </Button>
                  </span>
                </Tooltip>
              )}
              {toKhai.ct && (
                <Button
                  startIcon={
                    chiTietMut.isPending ? <CircularProgress size={16} /> : <TableChartRounded />
                  }
                  disabled={chiTietMut.isPending}
                  onClick={() => void taiBangChiTiet()}
                >
                  Bảng chi tiết từng người
                </Button>
              )}
            </Stack>

            {(toKhai.xuatLuc || toKhai.nopLuc) && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                {toKhai.xuatLuc
                  ? `Xuất lúc ${new Date(toKhai.xuatLuc).toLocaleString("vi-VN")}${toKhai.xuatBoiTen ? ` bởi ${toKhai.xuatBoiTen}` : ""}. `
                  : ""}
                {toKhai.nopLuc
                  ? `Đánh dấu đã nộp lúc ${new Date(toKhai.nopLuc).toLocaleString("vi-VN")}${toKhai.nopBoiTen ? ` bởi ${toKhai.nopBoiTen}` : ""}.`
                  : ""}
              </Typography>
            )}
          </Paper>

          {trangThai === "CHUA_SAN_SANG" ? (
            <Alert severity="info">
              Quý {quy}/{nam} chưa đủ điều kiện lập tờ khai: còn{" "}
              {thangThieu.map((t) => `tháng ${t.month}`).join(", ")} chưa chốt Bảng tính thuế. Chốt
              đủ ba tháng thì bộ chỉ tiêu tự lên.
            </Alert>
          ) : (
            <>
              {daXuat && (
                <Alert severity="warning">
                  Tờ khai đã xuất nên số liệu đóng băng: không sửa chỉ tiêu được nữa và ba tháng
                  trong quý không mở lại được. Cần bản in thì dùng nút Tải lại file để lấy đúng file
                  đã xuất.
                </Alert>
              )}
              <ToKhaiTncn05Editor
                toKhai={toKhai}
                isLocked={!suaDuocChiTieu}
                onUpdateGhiDe={luuGhiDe}
                onResetGhiDe={xoaGhiDe}
              />
            </>
          )}

          {lichSu.length > 0 && (
            <Paper variant="outlined">
              <Typography variant="subtitle2" sx={{ p: 2, pb: 1 }}>
                Lịch sử kỳ khai năm {nam}
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Kỳ</TableCell>
                      <TableCell>Trạng thái</TableCell>
                      <TableCell align="right">[16] Tổng cá nhân</TableCell>
                      <TableCell align="right">[21] Tổng thu nhập</TableCell>
                      <TableCell align="right">[29] Tổng thuế</TableCell>
                      <TableCell>Người xuất</TableCell>
                      <TableCell>Người nộp</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lichSu.map((k) => (
                      <TableRow
                        key={`${k.nam}-${k.quy}`}
                        hover
                        selected={k.nam === nam && k.quy === quy}
                        sx={{ cursor: "pointer" }}
                        onClick={() => setChonTay({ nam: k.nam, quy: k.quy })}
                      >
                        <TableCell>
                          Quý {k.quy}/{k.nam}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={MAU_TRANG_THAI_TO_KHAI[k.trangThai]}
                            label={NHAN_TRANG_THAI_TO_KHAI[k.trangThai]}
                          />
                        </TableCell>
                        <TableCell align="right">{k.ct16}</TableCell>
                        <TableCell align="right">{tienVn(k.ct21)}</TableCell>
                        <TableCell align="right">{tienVn(k.ct29)}</TableCell>
                        <TableCell>{k.xuatBoiTen ?? "—"}</TableCell>
                        <TableCell>{k.nopBoiTen ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </Stack>
      )}

      {hoiXuat !== null && (
        <XuatToKhaiDialog
          open
          nam={nam}
          quy={quy}
          format={hoiXuat}
          nguoiKyMacDinh={toKhai?.thongTinNguoiNopThue.nguoiKy ?? null}
          dangChay={xuatMut.isPending}
          onClose={() => setHoiXuat(null)}
          onXacNhan={(nguoiKy, ngayKy) => void xuat(hoiXuat, nguoiKy, ngayKy)}
        />
      )}

      <Dialog open={hoiNop} onClose={dongHoiNop} maxWidth="xs" fullWidth>
        <DialogTitle>Đánh dấu đã nộp tờ khai quý {quy}/{nam}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="info">
              Hệ thống KHÔNG gửi tờ khai cho cơ quan thuế. Thao tác này chỉ ghi nhận rằng kế toán đã
              nộp bằng đường của mình (eTax, nộp trực tiếp…).
            </Alert>
            <TextField
              label="Người ký"
              value={nopNguoiKy}
              onChange={(e) => setNopNguoiKy(e.target.value)}
              helperText="Bỏ trống thì giữ nguyên người ký đã lưu."
            />
            <TextField
              type="date"
              label="Ngày ký"
              value={nopNgayKy}
              onChange={(e) => setNopNgayKy(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={dongHoiNop} disabled={nopMut.isPending}>
            Hủy
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={() => void danhDauNop()}
            disabled={nopMut.isPending}
          >
            {nopMut.isPending ? "Đang ghi nhận…" : "Đã nộp"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
