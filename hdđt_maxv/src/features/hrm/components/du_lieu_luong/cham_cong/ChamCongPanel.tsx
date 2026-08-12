import { useState, type MouseEvent } from "react";
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
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import RestartAltRounded from "@mui/icons-material/RestartAltRounded";
import { alpha } from "@mui/material/styles";
import { maThang, nhanThu, thangHienTai, type NgayCham } from "../../../chamCong";
import { COT_THONG_KE_CONG, moTaLoaiCong } from "../../../constants";
import {
  useBangChamCong,
  useDatLaiChamCong,
  useDatOChamCong,
} from "../../../mock/hooks/chamCong";
import type { OChamCong } from "../../../types";
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
 * Bảng chấm công tháng hiện tại.
 *
 * Ô chưa đụng tới đọc theo lịch chuẩn (chính sách thứ 7 / chủ nhật ở Thiết lập
 * chung, trừ ngày lễ ở Lịch ngày lễ), nên bảng mở ra đã đúng sẵn phần lớn và
 * người dùng chỉ sửa các ngày khác thường.
 */
export default function ChamCongPanel() {
  const { nam, thang } = thangHienTai();
  const bang = useBangChamCong(nam, thang);
  const datO = useDatOChamCong();
  const datLai = useDatLaiChamCong();

  const [dangMo, setDangMo] = useState<ODangMo | null>(null);

  const moO = (
    e: MouseEvent<HTMLElement>,
    maNv: string,
    tenNv: string,
    ngayCham: NgayCham,
    giaTri: OChamCong | null,
  ) => setDangMo({ neo: e.currentTarget, maNv, tenNv, ngayCham, giaTri });

  return (
    <Box>
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
            label={`Ngày công chuẩn: ${bang.ngayCongChuan}`}
          />
          <Chip size="small" variant="outlined" label={`${bang.dong.length} nhân viên`} />
        </Stack>

        <Button
          startIcon={<RestartAltRounded />}
          onClick={() => datLai(maThang(nam, thang))}
          sx={{ textTransform: "none" }}
        >
          Đặt lại theo lịch chuẩn
        </Button>
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

              {bang.ngayTrongThang.map((nc) => {
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
            {bang.dong.map((dong) => (
              <TableRow key={dong.nhanVien.ma_nv} hover>
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
                    {dong.nhanVien.ho_ten}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {dong.nhanVien.ma_nv}
                  </Typography>
                </TableCell>

                {bang.ngayTrongThang.map((nc, i) => {
                  const o = dong.o[i] ?? null;
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
                        onClick={(e) =>
                          moO(e, dong.nhanVien.ma_nv, dong.nhanVien.ho_ten, nc, o)
                        }
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

                <TableCell align="center">{bang.ngayCongChuan}</TableCell>
                <TableCell align="center">
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 700,
                      // Thiếu công so với chuẩn thì tô đỏ, dư thì tô xanh.
                      color:
                        dong.thongKe.ngayCongThucTe < bang.ngayCongChuan
                          ? "error.main"
                          : dong.thongKe.ngayCongThucTe > bang.ngayCongChuan
                            ? "success.main"
                            : "text.primary",
                    }}
                  >
                    {dong.thongKe.ngayCongThucTe}
                  </Typography>
                </TableCell>
                {COT_THONG_KE_CONG.map((loai) => {
                  const so = dong.thongKe.soNgayTheoLoai[loai];
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

            {bang.dong.length === 0 && (
              <TableRow>
                <TableCell colSpan={bang.ngayTrongThang.length + 2 + COT_THONG_KE_CONG.length}>
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
        gioCongChuanNgay={bang.gioCongChuanNgay}
        onClose={() => setDangMo(null)}
        onLuu={(o) => {
          if (dangMo) datO(dangMo.maNv, dangMo.ngayCham.ngay, o);
          setDangMo(null);
        }}
        onXoa={() => {
          if (dangMo) datO(dangMo.maNv, dangMo.ngayCham.ngay, null);
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
