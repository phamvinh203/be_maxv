import { useMemo } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import AddRounded from "@mui/icons-material/AddRounded";
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import { moTaCachTru } from "../../../_shared/constants";
import { dongChuyenCanRong, tongGioChuyenCan } from "../../../calculations/du_lieu_tinh_luong/chuyenCan";
import { tienVn } from "../../../_shared/format";
import { useLoaiChuyenCanList } from "../../../api/du_lieu_tinh_luong/payrollCatalogsQueries";
import { soDuong } from "../_shared/inputGuards";
import type { ChuyenCanNhanVienRow, DongChuyenCan } from "../../../types";

interface Props {
  values: DongChuyenCan[];
  onChange: (values: DongChuyenCan[]) => void;
  /** Nhân viên trong phạm vi áp dụng — dùng để kẹp preview theo đơn giá thật của từng người (RVW-503). */
  rows: ChuyenCanNhanVienRow[];
}

/**
 * Bảng lỗi chuyên cần đang soạn — mỗi dòng là **một lần** vi phạm.
 *
 * Không có cột tiền theo TỪNG dòng, cố ý: mức trừ của loại "mất toàn bộ" bằng
 * đúng khoản chuyên cần của **từng người**, nên cùng một dòng lỗi mà mỗi nhân
 * viên mất một số khác nhau. Con số CHÍNH THỨC hiện ở bảng nhân viên bên dưới
 * (Đơn giá → Tổng trừ → Thành tiền, đọc thẳng từ máy chủ, đã áp bất biến chặn
 * sàn BR-dltl-016). Chip "Trừ dự kiến" ở đây chỉ là preview của bảng đang soạn
 * TRƯỚC khi áp — cũng kẹp theo `min(tổng phạt, đơn giá)` của từng người trong
 * `rows` (RVW-503) để không hiện số vượt đơn giá, việc không bao giờ xảy ra
 * thật lúc chốt.
 *
 * Cùng một loại lỗi được lặp nhiều dòng miễn khác ngày — đi trễ ba hôm là ba
 * dòng, gộp lại thì mất dấu ngày vi phạm.
 */
export default function BangChuyenCanCard({ values, onChange, rows }: Props) {
  const danhMuc = useLoaiChuyenCanList();

  const loaiTheoMa = useMemo(() => new Map(danhMuc.map((cc) => [cc.ma_cc, cc])), [danhMuc]);

  const datDong = (id: string, moi: Partial<DongChuyenCan>) =>
    onChange(values.map((d) => (d.id === id ? { ...d, ...moi } : d)));

  const xoaDong = (id: string) => onChange(values.filter((d) => d.id !== id));

  /** Mức trừ cố định (theo giờ + theo lần) — chưa gồm khoản mất toàn bộ. */
  const truCoDinh = values.reduce((tong, d) => {
    const loai = loaiTheoMa.get(d.ma_cc);
    if (!loai) return tong;
    if (loai.cach_tru === "theo_gio") return tong + loai.muc_tru * d.so_gio;
    if (loai.cach_tru === "theo_lan") return tong + loai.muc_tru;
    return tong;
  }, 0);
  const coMatToanBo = values.some(
    (d) => loaiTheoMa.get(d.ma_cc)?.cach_tru === "mat_toan_bo",
  );

  /**
   * RVW-503: kẹp sàn theo đúng bất biến BR-dltl-016 của máy chủ (`tongTru =
   * min(tongPhat, donGia)`, khớp `payrollInputs.service.ts::getDiligenceData`)
   * — đơn giá chuyên cần khác nhau theo từng người nên số trừ thật khi áp dụng
   * không giống nhau. Hiện dải thấp nhất/cao nhất thay vì một số không kẹp,
   * có thể vượt hẳn đơn giá và không bao giờ xảy ra thật lúc chốt.
   */
  const duKienTheoNguoi = rows.map((r) =>
    coMatToanBo ? r.don_gia : Math.min(truCoDinh, r.don_gia),
  );
  const duKienThapNhat = duKienTheoNguoi.length ? Math.min(...duKienTheoNguoi) : truCoDinh;
  const duKienCaoNhat = duKienTheoNguoi.length ? Math.max(...duKienTheoNguoi) : truCoDinh;
  const nhanTruDuKien =
    duKienThapNhat === duKienCaoNhat
      ? `Trừ dự kiến: ${tienVn(Math.round(duKienThapNhat))} ₫`
      : `Trừ dự kiến: ${tienVn(Math.round(duKienThapNhat))}–${tienVn(Math.round(duKienCaoNhat))} ₫`;

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ mb: 2, alignItems: { sm: "center" }, justifyContent: "space-between" }}
      >
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Bảng chuyên cần
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Mỗi dòng là một lần vi phạm. Số tiền trừ của từng nhân viên xem ở bảng bên dưới.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <Chip
            size="small"
            variant="outlined"
            label={`${values.length} lần · ${tongGioChuyenCan(values)}h`}
          />
          <Chip
            size="small"
            color={duKienCaoNhat > 0 ? "warning" : "default"}
            variant="outlined"
            label={nhanTruDuKien}
          />
          {coMatToanBo && (
            <Chip size="small" color="error" label="Có lỗi mất toàn bộ chuyên cần" />
          )}
        </Stack>
      </Stack>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ "& th": { fontWeight: 700, whiteSpace: "nowrap" } }}>
              <TableCell align="center" sx={{ width: 56 }}>
                STT
              </TableCell>
              <TableCell sx={{ minWidth: 280 }}>Loại chuyên cần</TableCell>
              <TableCell sx={{ width: 180 }}>Số giờ trễ/nghỉ</TableCell>
              <TableCell sx={{ width: 190 }}>Ngày</TableCell>
              <TableCell align="right" sx={{ width: 60 }} />
            </TableRow>
          </TableHead>

          <TableBody>
            {values.map((dong, i) => {
              const loai = loaiTheoMa.get(dong.ma_cc);
              const moTa = loai ? moTaCachTru(loai.cach_tru) : null;
              return (
                <TableRow key={dong.id} hover>
                  <TableCell align="center">{i + 1}</TableCell>

                  <TableCell>
                    <TextField
                      select
                      required
                      fullWidth
                      size="small"
                      value={dong.ma_cc}
                      onChange={(e) => datDong(dong.id, { ma_cc: e.target.value })}
                      error={!dong.ma_cc}
                      helperText={
                        !dong.ma_cc
                          ? "Chưa chọn loại chuyên cần"
                          : loai && moTa
                            ? loai.cach_tru === "mat_toan_bo"
                              ? moTa.label
                              : `${tienVn(loai.muc_tru)} ${moTa.donVi}`
                            : undefined
                      }
                    >
                      {danhMuc
                        // Loại đã ngừng vẫn hiện nếu dòng này đang dùng nó — bỏ
                        // đi thì ô chọn trống trơn, người dùng tưởng mất dữ liệu.
                        .filter((cc) => cc.status === "1" || cc.ma_cc === dong.ma_cc)
                        .map((cc) => (
                          <MenuItem key={cc.ma_cc} value={cc.ma_cc}>
                            {cc.ten_cc}
                            {cc.status === "0" ? " (đã ngừng)" : ""}
                          </MenuItem>
                        ))}
                    </TextField>
                  </TableCell>

                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      fullWidth
                      value={dong.so_gio}
                      onChange={(e) => datDong(dong.id, { so_gio: soDuong(e.target.value) })}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      // Loại không trừ theo giờ vẫn cho nhập, chỉ nói rõ là số
                      // này không vào tiền — biên bản vẫn cần ghi trễ bao lâu.
                      helperText={
                        loai && loai.cach_tru !== "theo_gio" ? "Không tính vào tiền trừ" : undefined
                      }
                      slotProps={{
                        htmlInput: { min: 0, step: 0.5 },
                        input: {
                          endAdornment: <InputAdornment position="end">h</InputAdornment>,
                        },
                      }}
                    />
                  </TableCell>

                  <TableCell>
                    <TextField
                      type="date"
                      required
                      size="small"
                      fullWidth
                      value={dong.ngay}
                      onChange={(e) => datDong(dong.id, { ngay: e.target.value })}
                      error={!dong.ngay}
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                  </TableCell>

                  <TableCell align="right">
                    <Tooltip title="Xóa dòng">
                      <IconButton size="small" color="error" onClick={() => xoaDong(dong.id)}>
                        <DeleteRounded fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}

            {values.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography
                    variant="body2"
                    color="text.disabled"
                    sx={{ textAlign: "center", py: 4 }}
                  >
                    Bảng trống. Áp bảng trống nghĩa là kỳ này không vi phạm — nhân viên nhận đủ
                    chuyên cần.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Button
        startIcon={<AddRounded />}
        onClick={() => onChange([...values, dongChuyenCanRong()])}
        sx={{ textTransform: "none", mt: 1.5 }}
      >
        Thêm dòng
      </Button>
    </Paper>
  );
}
