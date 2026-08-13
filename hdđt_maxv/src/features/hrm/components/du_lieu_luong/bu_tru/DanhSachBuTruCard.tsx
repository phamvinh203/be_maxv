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
import { useXoaBanBuTru } from "../../../mock/hooks/buTru";
import type { BuTruNhanVienRow, LocNhanVienKyLuong, PhamViApDung } from "../../../types";
import XacNhanXoaDialog from "../../XacNhanXoaDialog";
import ThanhLocKyLuong from "../ThanhLocKyLuong";

interface Props {
  phamVi: PhamViApDung;
  onPhamVi: (phamVi: PhamViApDung) => void;
  filters: LocNhanVienKyLuong;
  onFilters: (filters: LocNhanVienKyLuong) => void;
  /** Danh sách đã lọc — cũng chính là danh sách "Áp dụng bù trừ" sẽ ghi. */
  rows: BuTruNhanVienRow[];
  coThayDoi: boolean;
  dangLuu: boolean;
  onLuu: () => void;
}

/**
 * Chọn phạm vi áp bù trừ và xem số bị trừ của từng nhân viên.
 *
 * Cột "Tổng bị trừ" âm nghĩa là các khoản bù lớn hơn các khoản trừ — kỳ này
 * người đó **được nhận thêm**. Hiện thẳng bằng dấu cộng và màu xanh chứ không
 * để một số âm trần trụi, vì đọc nhanh rất dễ tưởng bị trừ.
 */
export default function DanhSachBuTruCard({
  phamVi,
  onPhamVi,
  filters,
  onFilters,
  rows,
  coThayDoi,
  dangLuu,
  onLuu,
}: Props) {
  const xoaBan = useXoaBanBuTru();
  const [dangXoa, setDangXoa] = useState<BuTruNhanVienRow | undefined>(undefined);

  const xacNhanXoa = async () => {
    if (!dangXoa) return;
    try {
      await xoaBan(dangXoa.ma_nv);
      toast.success(`Đã xóa khoản bù trừ của ${dangXoa.ho_ten}.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không xóa được khoản bù trừ."));
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
              <TableCell align="right" sx={{ width: 220 }}>
                Tổng bị trừ
              </TableCell>
              <TableCell align="right" sx={{ width: 100 }}>
                Thao tác
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {rows.map((row) => {
              const chuaAp = row.tong_bi_tru === null;
              const tong = row.tong_bi_tru ?? 0;
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

                  <TableCell align="right">
                    {chuaAp ? (
                      <Typography variant="caption" color="text.disabled">
                        Chưa áp bù trừ
                      </Typography>
                    ) : (
                      <>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 700 }}
                          color={
                            tong > 0 ? "error.main" : tong < 0 ? "success.main" : "text.primary"
                          }
                        >
                          {tong > 0
                            ? `− ${tienVn(tong)} ₫`
                            : tong < 0
                              ? `+ ${tienVn(-tong)} ₫`
                              : "0 ₫"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {tong < 0
                            ? `${row.so_dong} khoản — được nhận thêm`
                            : `${row.so_dong} khoản`}
                        </Typography>
                      </>
                    )}
                  </TableCell>

                  <TableCell align="right">
                    <Tooltip title={chuaAp ? "Chưa có gì để xóa" : "Xóa khoản bù trừ"}>
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
                <TableCell colSpan={4}>
                  <Typography
                    variant="body2"
                    color="text.disabled"
                    sx={{ textAlign: "center", py: 4 }}
                  >
                    {phamVi === "phong_ban" && !filters.ma_pb
                      ? "Chọn một phòng ban để xem danh sách nhân viên sẽ nhận khoản bù trừ."
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
        tieuDe="Xóa khoản bù trừ của nhân viên"
        noiDung={
          <>
            Xóa bảng ứng - bù trừ của <strong>{dangXoa?.ho_ten}</strong> ({dangXoa?.ma_nv})? Cả
            phần tạm ứng đã ghi cũng mất theo.
          </>
        }
        onClose={() => setDangXoa(undefined)}
        onXacNhan={xacNhanXoa}
      />
    </Paper>
  );
}
