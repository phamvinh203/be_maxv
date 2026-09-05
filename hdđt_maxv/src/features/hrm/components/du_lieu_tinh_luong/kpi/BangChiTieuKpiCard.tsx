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
import { dongKpiRong, hieuSuat, mauHieuSuat, tongTrongSo, tyLeHt } from "../../../kpi";
import { useChiTieuKpiList } from "../../../mock/hooks/kpi";
import type { DongKpi } from "../../../types";

interface Props {
  values: DongKpi[];
  onChange: (values: DongKpi[]) => void;
}

/**
 * Bảng chỉ tiêu KPI đang soạn.
 *
 * Mỗi dòng trỏ về một chỉ tiêu trong **danh mục KPI** (nút "Quản lý KPI") thay
 * vì cho gõ tên tự do: bảng của tháng này và tháng sau phải gọi cùng một chỉ
 * tiêu bằng cùng một tên thì mới so sánh được hai kỳ với nhau.
 *
 * Cột "Tỉ lệ HT" và hiệu suất chung là số **tính ra**, không nhập — hai người
 * nhập tay hai chỗ thì sớm muộn cũng lệch nhau.
 */
export default function BangChiTieuKpiCard({ values, onChange }: Props) {
  const danhMuc = useChiTieuKpiList();

  const chiTieuTheoMa = useMemo(
    () => new Map(danhMuc.map((ct) => [ct.ma_kpi, ct])),
    [danhMuc],
  );
  const daDung = useMemo(() => new Set(values.map((d) => d.ma_kpi)), [values]);

  const datDong = (id: string, moi: Partial<DongKpi>) =>
    onChange(values.map((d) => (d.id === id ? { ...d, ...moi } : d)));

  const xoaDong = (id: string) => onChange(values.filter((d) => d.id !== id));

  /**
   * Đổi chỉ tiêu ở dòng chưa khai trọng số thì mượn luôn trọng số mặc định của
   * danh mục — đỡ phải gõ lại con số hầu như lúc nào cũng đúng.
   */
  const doiChiTieu = (dong: DongKpi, maKpi: string) =>
    datDong(dong.id, {
      ma_kpi: maKpi,
      trong_so:
        dong.trong_so > 0 ? dong.trong_so : (chiTieuTheoMa.get(maKpi)?.trong_so_mac_dinh ?? 0),
    });

  const tong = tongTrongSo(values);
  const hieuSuatChung = hieuSuat(values);

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ mb: 2, alignItems: { sm: "center" }, justifyContent: "space-between" }}
      >
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Bảng KPI
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Tỉ lệ HT = Thực thi / Mục tiêu. Hiệu suất chung bình quân theo trọng số.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Chip
            size="small"
            variant="outlined"
            // Tổng trọng số khác 100 không sai, chỉ là ít gặp — nhắc bằng màu
            // chứ không chặn, có công ty chấm theo thang khác.
            color={tong === 100 ? "primary" : "warning"}
            label={`Tổng trọng số: ${tong}`}
          />
          <Chip
            size="small"
            color={mauHieuSuat(hieuSuatChung)}
            label={`Hiệu suất chung: ${hieuSuatChung}%`}
            sx={{ fontWeight: 700 }}
          />
        </Stack>
      </Stack>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ "& th": { fontWeight: 700, whiteSpace: "nowrap" } }}>
              <TableCell align="center" sx={{ width: 56 }}>
                STT
              </TableCell>
              <TableCell sx={{ minWidth: 260 }}>Chỉ tiêu</TableCell>
              <TableCell sx={{ width: 130 }}>Trọng số</TableCell>
              <TableCell sx={{ width: 190 }}>Mục tiêu</TableCell>
              <TableCell sx={{ width: 190 }}>Thực thi</TableCell>
              <TableCell align="center" sx={{ width: 110 }}>
                Tỉ lệ HT
              </TableCell>
              <TableCell align="right" sx={{ width: 60 }} />
            </TableRow>
          </TableHead>

          <TableBody>
            {values.map((dong, i) => {
              const chiTieu = chiTieuTheoMa.get(dong.ma_kpi);
              const phanTram = tyLeHt(dong);
              return (
                <TableRow key={dong.id} hover>
                  <TableCell align="center">{i + 1}</TableCell>

                  <TableCell>
                    <TextField
                      select
                      required
                      fullWidth
                      size="small"
                      value={dong.ma_kpi}
                      onChange={(e) => doiChiTieu(dong, e.target.value)}
                      error={!dong.ma_kpi}
                      helperText={!dong.ma_kpi ? "Chưa chọn chỉ tiêu" : undefined}
                    >
                      {danhMuc
                        // Chỉ tiêu đã ngừng vẫn hiện nếu dòng này đang dùng nó —
                        // bỏ đi thì ô chọn trống trơn và người dùng tưởng mất dữ liệu.
                        .filter((ct) => ct.status === "1" || ct.ma_kpi === dong.ma_kpi)
                        .map((ct) => (
                          <MenuItem
                            key={ct.ma_kpi}
                            value={ct.ma_kpi}
                            disabled={ct.ma_kpi !== dong.ma_kpi && daDung.has(ct.ma_kpi)}
                          >
                            {ct.ten_kpi}
                            {ct.status === "0" ? " (đã ngừng)" : ""}
                          </MenuItem>
                        ))}
                    </TextField>
                  </TableCell>

                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      fullWidth
                      value={dong.trong_so}
                      onChange={(e) => datDong(dong.id, { trong_so: Number(e.target.value) || 0 })}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      slotProps={{ htmlInput: { min: 0, step: 1 } }}
                    />
                  </TableCell>

                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      fullWidth
                      value={dong.muc_tieu}
                      onChange={(e) => datDong(dong.id, { muc_tieu: Number(e.target.value) || 0 })}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      slotProps={{
                        htmlInput: { min: 0 },
                        input: chiTieu?.don_vi
                          ? {
                              endAdornment: (
                                <InputAdornment position="end">{chiTieu.don_vi}</InputAdornment>
                              ),
                            }
                          : undefined,
                      }}
                    />
                  </TableCell>

                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      fullWidth
                      value={dong.thuc_thi}
                      onChange={(e) => datDong(dong.id, { thuc_thi: Number(e.target.value) || 0 })}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      slotProps={{
                        htmlInput: { min: 0 },
                        input: chiTieu?.don_vi
                          ? {
                              endAdornment: (
                                <InputAdornment position="end">{chiTieu.don_vi}</InputAdornment>
                              ),
                            }
                          : undefined,
                      }}
                    />
                  </TableCell>

                  <TableCell align="center">
                    {dong.muc_tieu > 0 ? (
                      <Chip
                        size="small"
                        color={mauHieuSuat(phanTram)}
                        variant="outlined"
                        label={`${phanTram}%`}
                        sx={{ fontWeight: 700, height: 24 }}
                      />
                    ) : (
                      <Typography variant="caption" color="text.disabled">
                        chưa có mục tiêu
                      </Typography>
                    )}
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
                <TableCell colSpan={7}>
                  <Typography
                    variant="body2"
                    color="text.disabled"
                    sx={{ textAlign: "center", py: 4 }}
                  >
                    Bảng KPI đang trống. Bấm "Thêm dòng" hoặc nhập từ file Excel.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Button
        startIcon={<AddRounded />}
        onClick={() => onChange([...values, dongKpiRong()])}
        sx={{ textTransform: "none", mt: 1.5 }}
      >
        Thêm dòng
      </Button>
    </Paper>
  );
}
