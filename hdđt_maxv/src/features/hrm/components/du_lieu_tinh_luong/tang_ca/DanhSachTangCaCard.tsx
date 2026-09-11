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
import { gioVn, mauGioTangCa } from "../../../calculations/du_lieu_tinh_luong/tangCa";
import { useCauHinh } from "../../../api/cau_hinh_mac_dinh/cauHinhQueries";
import { useDeleteOvertime } from "../../../api/du_lieu_tinh_luong/payrollInputsQueries";
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
  periodId: string;
  isReadOnly: boolean;
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
  periodId,
  isReadOnly,
}: Props) {
  const cauHinh = useCauHinh();
  const deleteMut = useDeleteOvertime(periodId);
  const [dangXoa, setDangXoa] = useState<TangCaNhanVienRow | undefined>(undefined);

  const xacNhanXoa = async () => {
    if (!dangXoa) return;
    try {
      await deleteMut.mutateAsync(dangXoa.ma_nv);
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
                Giờ OT kỳ này
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
                    {/* RVW-709: KHÔNG tô theo ngưỡng năm — cột này thật ra chỉ là giờ OT
                        của KỲ NÀY (API chưa trả lũy kế năm thật, xem ghi chú ở
                        `TangCaPanel`), tô theo `nguong_vuot_muc_tc_nam` sẽ luôn xanh và
                        đánh lừa người chốt lương tưởng đã kiểm tra trần OT/năm. */}
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
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
                          disabled={isReadOnly || chuaAp}
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
            Xóa bảng tăng ca của <strong>{dangXoa?.ho_ten}</strong> ({dangXoa?.ma_nv}) trong kỳ
            lương này?
          </>
        }
        onClose={() => setDangXoa(undefined)}
        onXacNhan={xacNhanXoa}
      />
    </Paper>
  );
}
