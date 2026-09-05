import { useState } from "react";
import { toast } from "react-toastify";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import { getErrorMessage } from "../../../../../lib/errors";
import { tienVn } from "../../../format";
import { useXoaBanLuongPhanTram } from "../../../mock/hooks/luongPhanTram";
import type {
  LocNhanVienKyLuong,
  LuongPhanTramNhanVienRow,
  PhamViApDung,
} from "../../../types";
import XacNhanXoaDialog from "../../XacNhanXoaDialog";
import ThanhLocKyLuong from "../ThanhLocKyLuong";

interface Props {
  phamVi: PhamViApDung;
  onPhamVi: (phamVi: PhamViApDung) => void;
  filters: LocNhanVienKyLuong;
  onFilters: (filters: LocNhanVienKyLuong) => void;
  /** Danh sách đã lọc — cũng chính là danh sách "Áp dụng lương %" sẽ ghi. */
  rows: LuongPhanTramNhanVienRow[];
  coThayDoi: boolean;
  dangLuu: boolean;
  onLuu: () => void;
}

/** Chọn phạm vi áp lương phần trăm và xem hoa hồng của từng nhân viên. */
export default function DanhSachLuongPhanTramCard({
  phamVi,
  onPhamVi,
  filters,
  onFilters,
  rows,
  coThayDoi,
  dangLuu,
  onLuu,
}: Props) {
  const xoaBan = useXoaBanLuongPhanTram();
  const [dangXoa, setDangXoa] = useState<LuongPhanTramNhanVienRow | undefined>(undefined);

  const xacNhanXoa = async () => {
    if (!dangXoa) return;
    try {
      await xoaBan(dangXoa.ma_nv);
      toast.success(`Đã xóa lương phần trăm của ${dangXoa.ho_ten}.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không xóa được lương phần trăm."));
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
              <TableCell align="right" sx={{ width: 200 }}>
                Tiền lương
              </TableCell>
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
                <TableCell align="right">
                  {row.tien_luong === null ? (
                    <Typography variant="caption" color="text.disabled">
                      Chưa áp lương %
                    </Typography>
                  ) : (
                    <>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {tienVn(row.tien_luong)} ₫
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.so_dong} khoản %
                      </Typography>
                    </>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Tooltip title={row.so_dong > 0 ? "Xóa lương %" : "Chưa có gì để xóa"}>
                    <Box component="span">
                      <IconButton
                        size="small"
                        color="error"
                        disabled={row.so_dong === 0}
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
                <TableCell colSpan={4}>
                  <Typography
                    variant="body2"
                    color="text.disabled"
                    sx={{ textAlign: "center", py: 4 }}
                  >
                    {phamVi === "phong_ban" && !filters.ma_pb
                      ? "Chọn một phòng ban để xem danh sách nhân viên sẽ nhận lương phần trăm."
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
        tieuDe="Xóa lương phần trăm của nhân viên"
        noiDung={
          <>
            Xóa bảng lương phần trăm của <strong>{dangXoa?.ho_ten}</strong> ({dangXoa?.ma_nv})?
            Cột tiền lương của nhân viên này sẽ trống cho tới lần áp sau.
          </>
        }
        onClose={() => setDangXoa(undefined)}
        onXacNhan={xacNhanXoa}
      />
    </Paper>
  );
}
