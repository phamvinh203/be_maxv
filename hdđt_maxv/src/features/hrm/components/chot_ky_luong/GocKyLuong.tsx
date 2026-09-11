import { useState, type MouseEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Popover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ChevronLeftRounded from "@mui/icons-material/ChevronLeftRounded";
import ChevronRightRounded from "@mui/icons-material/ChevronRightRounded";
import CalendarMonthRounded from "@mui/icons-material/CalendarMonthRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import AddRounded from "@mui/icons-material/AddRounded";
import { tenKyMacDinh, TRANG_THAI_KY } from "../../_shared/constants";
import { kyCuaThang, luiThang, nhanThang } from "../../_shared/thangKyLuong";
import { useCreatePayrollPeriod } from "../../api/du_lieu_tinh_luong/payrollPeriodsQueries";
import { useCurrentPayrollPeriod } from "../du_lieu_tinh_luong/useCurrentPayrollPeriod";
import { DUONG_DAN_CHOT_KY_LUONG } from "./bangKe";
import { chayVoiThongBao } from "./chayVoiThongBao";

/** Màu chấm tháng theo đúng bảng màu của chip trạng thái kỳ — đổi sáng/tối theo theme. */
function mauCham(mau: string | undefined): string {
  return !mau || mau === "default" ? "grey.500" : `${mau}.main`;
}

/**
 * Góc phải thanh HRM: ô tháng `‹ 09/2026 › 📅` chọn kỳ lương cho cả khu HRM + nút "Chốt kỳ lương
 * T9/2026" mở màn Chốt kỳ lương. Tháng chưa có kỳ thì nút đổi thành "Tạo kỳ lương" (tạo xong mở
 * luôn màn chốt kỳ).
 *
 * Người không có quyền lương thì ẩn cả góc — mọi thao tác ở đây đều chạm nhóm `/payroll-*` (403).
 */
export default function GocKyLuong() {
  const { thangChon, chonThang, selectedPeriod, periods, biTuChoi, isLoading } =
    useCurrentPayrollPeriod();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const taoKy = useCreatePayrollPeriod();

  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [namLich, setNamLich] = useState(thangChon.nam);

  if (biTuChoi) return null;

  const { thang, nam } = thangChon;
  const dangOManChot = pathname.startsWith(DUONG_DAN_CHOT_KY_LUONG);
  const trangThai = selectedPeriod ? TRANG_THAI_KY[selectedPeriod.status] : undefined;

  const handleNut = async () => {
    // Tháng đang xem đã đúng; `mutateAsync` chỉ về khi danh sách kỳ đã nạp lại (xem
    // `useCreatePayrollPeriod`) nên màn Chốt kỳ lương mở ra là có kỳ ngay.
    const coKy =
      !!selectedPeriod ||
      (await chayVoiThongBao(
        () => taoKy.mutateAsync({ month: thang, year: nam, name: tenKyMacDinh(thang, nam) }),
        `Đã tạo kỳ lương tháng ${thang}/${nam}.`,
      ));
    if (coKy) navigate(DUONG_DAN_CHOT_KY_LUONG);
  };

  const moLich = (e: MouseEvent<HTMLElement>) => {
    setNamLich(nam);
    setAnchor(e.currentTarget);
  };

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexShrink: 0 }}>
      <Paper
        variant="outlined"
        sx={{ display: "flex", alignItems: "center", height: 40, px: 0.25, borderRadius: 1.5 }}
      >
        <IconButton size="small" aria-label="Tháng trước" onClick={() => chonThang(luiThang(thangChon))}>
          <ChevronLeftRounded fontSize="small" />
        </IconButton>
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, minWidth: 64, textAlign: "center", fontVariantNumeric: "tabular-nums" }}
        >
          {String(thang).padStart(2, "0")}/{nam}
        </Typography>
        <IconButton
          size="small"
          aria-label="Tháng sau"
          onClick={() => chonThang(luiThang(thangChon, -1))}
        >
          <ChevronRightRounded fontSize="small" />
        </IconButton>
        <Tooltip title="Chọn tháng">
          <IconButton size="small" aria-label="Chọn tháng khác" onClick={moLich}>
            <CalendarMonthRounded fontSize="small" />
          </IconButton>
        </Tooltip>
      </Paper>

      <Tooltip
        title={
          selectedPeriod
            ? `${selectedPeriod.name} — ${trangThai?.nhan ?? selectedPeriod.status}`
            : `Tháng ${thang}/${nam} chưa có kỳ lương — bấm để tạo`
        }
      >
        <span>
          <Button
            variant="contained"
            color={selectedPeriod ? "success" : "primary"}
            startIcon={selectedPeriod ? <LockRounded /> : <AddRounded />}
            onClick={handleNut}
            disabled={isLoading || taoKy.isPending}
            sx={{
              height: 40,
              textTransform: "none",
              borderRadius: 1.5,
              boxShadow: dangOManChot ? 4 : undefined,
              outline: dangOManChot ? "2px solid" : "none",
              outlineColor: "success.light",
              outlineOffset: 2,
            }}
          >
            <Box component="span" sx={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
              <Box component="span" sx={{ fontSize: 12, fontWeight: 700 }}>
                {selectedPeriod ? "Chốt kỳ lương" : "Tạo kỳ lương"}
              </Box>
              <Box component="span" sx={{ fontSize: 11, fontWeight: 600 }}>
                {nhanThang(thangChon)}
              </Box>
            </Box>
          </Button>
        </span>
      </Tooltip>

      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Box sx={{ p: 1.5, width: 272 }}>
          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
            <IconButton size="small" aria-label="Năm trước" onClick={() => setNamLich((n) => n - 1)}>
              <ChevronLeftRounded fontSize="small" />
            </IconButton>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Năm {namLich}
            </Typography>
            <IconButton size="small" aria-label="Năm sau" onClick={() => setNamLich((n) => n + 1)}>
              <ChevronRightRounded fontSize="small" />
            </IconButton>
          </Stack>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0.75, mt: 1 }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
              const ky = kyCuaThang(periods, { nam: namLich, thang: m });
              const dangChon = m === thang && namLich === nam;
              return (
                <Button
                  key={m}
                  size="small"
                  variant={dangChon ? "contained" : "outlined"}
                  color={ky ? "primary" : "inherit"}
                  onClick={() => {
                    chonThang({ nam: namLich, thang: m });
                    setAnchor(null);
                  }}
                  sx={{ minWidth: 0, py: 0.5, textTransform: "none", flexDirection: "column", gap: 0.25 }}
                >
                  T{m}
                  <Box
                    component="span"
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      bgcolor: ky ? mauCham(TRANG_THAI_KY[ky.status]?.mau) : "transparent",
                    }}
                  />
                </Button>
              );
            })}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            Tháng có chấm màu là tháng đã có kỳ lương.
          </Typography>
        </Box>
      </Popover>
    </Stack>
  );
}
