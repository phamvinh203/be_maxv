import { useState } from "react";
import { toast } from "react-toastify";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import { getErrorMessage } from "../../../../../lib/errors";
import { mauHieuSuat } from "../../../kpi";
import { useXoaBanKpi } from "../../../mock/hooks/kpi";
import type { KpiNhanVienRow, LocNhanVienKyLuong, PhamViApDung } from "../../../types";
import XacNhanXoaDialog from "../../XacNhanXoaDialog";
import ThanhLocKyLuong from "../ThanhLocKyLuong";

interface Props {
  phamVi: PhamViApDung;
  onPhamVi: (phamVi: PhamViApDung) => void;
  filters: LocNhanVienKyLuong;
  onFilters: (filters: LocNhanVienKyLuong) => void;
  /** Danh sách đã lọc theo phạm vi — cũng chính là danh sách "Áp dụng KPI" sẽ ghi. */
  rows: KpiNhanVienRow[];
  coThayDoi: boolean;
  dangLuu: boolean;
  onLuu: () => void;
}

/** Chọn phạm vi áp KPI và xem hiệu suất của từng nhân viên. */
export default function DanhSachKpiCard({
  phamVi,
  onPhamVi,
  filters,
  onFilters,
  rows,
  coThayDoi,
  dangLuu,
  onLuu,
}: Props) {
  const xoaBanKpi = useXoaBanKpi();
  const [dangXoa, setDangXoa] = useState<KpiNhanVienRow | undefined>(undefined);

  const xacNhanXoa = async () => {
    if (!dangXoa) return;
    try {
      await xoaBanKpi(dangXoa.ma_nv);
      toast.success(`Đã xóa KPI của ${dangXoa.ho_ten}.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không xóa được KPI."));
    } finally {
      setDangXoa(undefined);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <ThanhLocKyLuong
        phamVi={phamVi}
        onPhamVi={onPhamVi}
        filters={filters}
        onFilters={onFilters}
        soNhanVien={rows.length}
        coThayDoi={coThayDoi}
        dangLuu={dangLuu}
        onLuu={onLuu}
      />

      <TableContainer sx={{ mt: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ "& th": { fontWeight: 700, whiteSpace: "nowrap" } }}>
              <TableCell sx={{ width: 110 }}>Mã</TableCell>
              <TableCell>Họ và tên</TableCell>
              <TableCell align="center" sx={{ width: 110 }}>
                Lần lương
              </TableCell>
              <TableCell sx={{ width: 220 }}>Hiệu suất</TableCell>
              <TableCell align="right" sx={{ width: 100 }}>
                Thao tác
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.ma_nv} hover>
                <TableCell sx={{ whiteSpace: "nowrap", fontFamily: "monospace" }}>
                  {row.ma_nv}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {row.ho_ten}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {row.ten_pb || "Chưa gán phòng ban"}
                  </Typography>
                </TableCell>
                <TableCell align="center">{row.lan_luong > 0 ? row.lan_luong : "—"}</TableCell>
                <TableCell>
                  {row.hieu_suat === null ? (
                    <Typography variant="caption" color="text.disabled">
                      Chưa áp KPI
                    </Typography>
                  ) : (
                    <>
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <LinearProgress
                          variant="determinate"
                          // Thanh dừng ở 100 cho dễ so hàng này với hàng kia; con
                          // số bên cạnh mới là mức thật, vượt chỉ tiêu vẫn đọc được.
                          value={Math.min(row.hieu_suat, 100)}
                          color={mauHieuSuat(row.hieu_suat)}
                          sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
                        />
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 700, minWidth: 52, textAlign: "right" }}
                          color={`${mauHieuSuat(row.hieu_suat)}.main`}
                        >
                          {row.hieu_suat}%
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {row.so_chi_tieu} chỉ tiêu
                      </Typography>
                    </>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Tooltip title={row.lan_luong > 0 ? "Xóa KPI" : "Chưa có KPI để xóa"}>
                    <Box component="span">
                      <IconButton
                        size="small"
                        color="error"
                        disabled={row.lan_luong === 0}
                        onClick={() => setDangXoa(row)}
                      >
                        <DeleteRounded fontSize="small" />
                      </IconButton>
                    </Box>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}

            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography
                    variant="body2"
                    color="text.disabled"
                    sx={{ textAlign: "center", py: 4 }}
                  >
                    {phamVi === "phong_ban" && !filters.ma_pb
                      ? "Chọn một phòng ban để xem danh sách nhân viên sẽ nhận KPI."
                      : "Không có nhân viên nào khớp bộ lọc."}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <XacNhanXoaDialog
        open={Boolean(dangXoa)}
        tieuDe="Xóa KPI của nhân viên"
        noiDung={
          <>
            Xóa bảng KPI của <strong>{dangXoa?.ho_ten}</strong> ({dangXoa?.ma_nv})? Cột hiệu
            suất của nhân viên này sẽ trống cho tới khi áp KPI lần sau.
          </>
        }
        onClose={() => setDangXoa(undefined)}
        onXacNhan={xacNhanXoa}
      />
    </Paper>
  );
}
