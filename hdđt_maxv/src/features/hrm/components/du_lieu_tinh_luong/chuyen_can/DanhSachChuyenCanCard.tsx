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
import { useXoaBanChuyenCan } from "../../../mock/hooks/chuyenCan";
import type {
  ChuyenCanNhanVienRow,
  LocNhanVienKyLuong,
  PhamViApDung,
} from "../../../types";
import XacNhanXoaDialog from "../../XacNhanXoaDialog";
import ThanhLocKyLuong from "../ThanhLocKyLuong";

interface Props {
  phamVi: PhamViApDung;
  onPhamVi: (phamVi: PhamViApDung) => void;
  filters: LocNhanVienKyLuong;
  onFilters: (filters: LocNhanVienKyLuong) => void;
  /** Danh sách đã lọc — cũng chính là danh sách "Áp dụng chuyên cần" sẽ ghi. */
  rows: ChuyenCanNhanVienRow[];
  coThayDoi: boolean;
  dangLuu: boolean;
  onLuu: () => void;
}

/**
 * Chọn phạm vi áp chuyên cần và xem tiền chuyên cần còn lại của từng nhân viên.
 *
 * Đơn giá đọc từ **Set lương** nên hiện ngay cả khi chưa áp bảng nào; đơn giá 0
 * nghĩa là người đó chưa được set khoản chuyên cần, nói rõ chứ không để cột tiền
 * trơ ra số 0 khó hiểu.
 */
export default function DanhSachChuyenCanCard({
  phamVi,
  onPhamVi,
  filters,
  onFilters,
  rows,
  coThayDoi,
  dangLuu,
  onLuu,
}: Props) {
  const xoaBan = useXoaBanChuyenCan();
  const [dangXoa, setDangXoa] = useState<ChuyenCanNhanVienRow | undefined>(undefined);

  const xacNhanXoa = async () => {
    if (!dangXoa) return;
    try {
      await xoaBan(dangXoa.ma_nv);
      toast.success(`Đã xóa chuyên cần của ${dangXoa.ho_ten}.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không xóa được chuyên cần."));
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
              <TableCell align="right" sx={{ width: 160 }}>
                Đơn giá
              </TableCell>
              <TableCell align="right" sx={{ width: 170 }}>
                Tổng trừ
              </TableCell>
              <TableCell align="right" sx={{ width: 170 }}>
                Thành tiền
              </TableCell>
              <TableCell align="right" sx={{ width: 100 }}>
                Thao tác
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {rows.map((row) => {
              const chuaAp = row.tong_tru === null;
              const tongTru = row.tong_tru ?? 0;
              return (
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

                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    {row.don_gia > 0 ? (
                      `${tienVn(row.don_gia)} ₫`
                    ) : (
                      <Tooltip title="Set lương của nhân viên này chưa có khoản chuyên cần">
                        <Typography variant="caption" color="warning.main">
                          Chưa set
                        </Typography>
                      </Tooltip>
                    )}
                  </TableCell>

                  <TableCell align="right">
                    {chuaAp ? (
                      <Typography variant="caption" color="text.disabled">
                        Chưa áp
                      </Typography>
                    ) : (
                      <>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 600 }}
                          color={tongTru > 0 ? "error.main" : "text.secondary"}
                        >
                          {tongTru > 0 ? `− ${tienVn(tongTru)} ₫` : "0 ₫"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {row.so_dong > 0 ? `${row.so_dong} lần vi phạm` : "Không vi phạm"}
                        </Typography>
                      </>
                    )}
                  </TableCell>

                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    {chuaAp ? (
                      "—"
                    ) : (
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 700 }}
                        color={row.thanh_tien === 0 ? "error.main" : "success.main"}
                      >
                        {tienVn(row.thanh_tien ?? 0)} ₫
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell align="right">
                    <Tooltip title={chuaAp ? "Chưa có gì để xóa" : "Xóa chuyên cần"}>
                      <Box component="span">
                        <IconButton
                          size="small"
                          color="error"
                          disabled={chuaAp}
                          onClick={() => setDangXoa(row)}
                        >
                          <DeleteRounded fontSize="small" />
                        </IconButton>
                      </Box>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}

            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography
                    variant="body2"
                    color="text.disabled"
                    sx={{ textAlign: "center", py: 4 }}
                  >
                    {phamVi === "phong_ban" && !filters.ma_pb
                      ? "Chọn một phòng ban để xem danh sách nhân viên sẽ nhận chuyên cần."
                      : "Không có nhân viên nào khớp bộ lọc."}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
        Đơn giá lấy từ khoản chuyên cần ở Cài đặt lương › Set lương; người chưa set lương thì
        lấy mức của Cấu trúc lương công ty.
      </Typography>

      <XacNhanXoaDialog
        open={Boolean(dangXoa)}
        tieuDe="Xóa chuyên cần của nhân viên"
        noiDung={
          <>
            Xóa bảng chuyên cần của <strong>{dangXoa?.ho_ten}</strong> ({dangXoa?.ma_nv})? Hai
            cột "Tổng trừ" và "Thành tiền" sẽ trống cho tới lần áp sau.
          </>
        }
        onClose={() => setDangXoa(undefined)}
        onXacNhan={xacNhanXoa}
      />
    </Paper>
  );
}
