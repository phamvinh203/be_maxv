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
import { gioVn, mauGioTangCa } from "../../../tangCa";
import { useCauHinh } from "../../../mock/hooks/cauHinh";
import { useXoaBanTangCa } from "../../../mock/hooks/tangCa";
import type { LocNhanVienKyLuong, PhamViApDung, TangCaNhanVienRow } from "../../../types";
import XacNhanXoaDialog from "../../XacNhanXoaDialog";
import ThanhLocKyLuong from "../ThanhLocKyLuong";

interface Props {
  phamVi: PhamViApDung;
  onPhamVi: (phamVi: PhamViApDung) => void;
  filters: LocNhanVienKyLuong;
  onFilters: (filters: LocNhanVienKyLuong) => void;
  /** Danh sách đã lọc — cũng chính là danh sách "Áp dụng tăng ca" sẽ ghi. */
  rows: TangCaNhanVienRow[];
  coThayDoi: boolean;
  dangLuu: boolean;
  onLuu: () => void;
}

/**
 * Chọn phạm vi áp tăng ca và theo dõi giờ OT của từng nhân viên.
 *
 * Hai cột giờ được tô theo trần đang khai ở Cấu hình mặc định — giờ tháng so với
 * `gioi_han_tc_thang`, giờ năm so với `nguong_vuot_muc_tc_nam`. Vượt trần OT là
 * chuyện bị xử phạt, nên phải nhìn thấy ngay trên danh sách chứ không đợi tới
 * lúc chốt lương.
 */
export default function DanhSachTangCaCard({
  phamVi,
  onPhamVi,
  filters,
  onFilters,
  rows,
  coThayDoi,
  dangLuu,
  onLuu,
}: Props) {
  const cauHinh = useCauHinh();
  const xoaBanTangCa = useXoaBanTangCa();
  const [dangXoa, setDangXoa] = useState<TangCaNhanVienRow | undefined>(undefined);

  const xacNhanXoa = async () => {
    if (!dangXoa) return;
    try {
      await xoaBanTangCa(dangXoa.ma_nv);
      toast.success(`Đã xóa tăng ca của ${dangXoa.ho_ten}.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Không xóa được tăng ca."));
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
              <TableCell align="right" sx={{ width: 170 }}>
                Tổng giờ theo tháng
              </TableCell>
              <TableCell align="right" sx={{ width: 150 }}>
                Tổng giờ năm
              </TableCell>
              <TableCell align="right" sx={{ width: 130 }}>
                Quy đổi
              </TableCell>
              <TableCell align="right" sx={{ width: 100 }}>
                Thao tác
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {rows.map((row) => {
              const chuaAp = row.gio_thang === null;
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
                        Chưa áp tăng ca
                      </Typography>
                    ) : (
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 700 }}
                        color={`${mauGioTangCa(row.gio_thang ?? 0, cauHinh.gioi_han_tc_thang)}.main`}
                      >
                        {gioVn(row.gio_thang ?? 0)}h
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 600 }}
                      color={`${mauGioTangCa(row.gio_nam, cauHinh.nguong_vuot_muc_tc_nam)}.main`}
                    >
                      {gioVn(row.gio_nam)}h
                    </Typography>
                  </TableCell>

                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    {chuaAp ? "—" : `${gioVn(row.gio_quy_doi)}h`}
                  </TableCell>

                  <TableCell align="right">
                    <Tooltip title={chuaAp ? "Chưa có tăng ca để xóa" : "Xóa tăng ca"}>
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
                      ? "Chọn một phòng ban để xem danh sách nhân viên sẽ nhận tăng ca."
                      : "Không có nhân viên nào khớp bộ lọc."}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
        Trần đang áp: {gioVn(cauHinh.gioi_han_tc_thang)}h/tháng · cảnh báo{" "}
        {gioVn(cauHinh.nguong_canh_bao_tc_nam)}h/năm · vượt mức{" "}
        {gioVn(cauHinh.nguong_vuot_muc_tc_nam)}h/năm.
      </Typography>

      <XacNhanXoaDialog
        open={Boolean(dangXoa)}
        tieuDe="Xóa tăng ca của nhân viên"
        noiDung={
          <>
            Xóa bảng tăng ca của <strong>{dangXoa?.ho_ten}</strong> ({dangXoa?.ma_nv})? Giờ lũy
            kế cả năm của nhân viên này cũng mất theo.
          </>
        }
        onClose={() => setDangXoa(undefined)}
        onXacNhan={xacNhanXoa}
      />
    </Paper>
  );
}
