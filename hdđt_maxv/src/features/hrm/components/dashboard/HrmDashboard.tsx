import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableContainer from "@mui/material/TableContainer";
import BadgeRounded from "@mui/icons-material/BadgeRounded";
import AccountTreeRounded from "@mui/icons-material/AccountTreeRounded";
import FamilyRestroomRounded from "@mui/icons-material/FamilyRestroomRounded";
import Diversity3Rounded from "@mui/icons-material/Diversity3Rounded";
import { ngayVn } from "../../format";
import { useThongKeHrm } from "../../mock/hooks/tongQuan";

/**
 * Tổng quan khu HRM.
 *
 * Chỉ đọc từ đúng bộ dữ liệu mà ba màn hình danh mục đang dùng, nên thêm một
 * nhân viên ở tab Danh mục là các con số ở đây đổi theo ngay.
 */
export default function HrmDashboard() {
  const tk = useThongKeHrm();
  const navigate = useNavigate();

  const soNvLonNhat = Math.max(1, ...tk.phanBo.map((pb) => pb.so_nv));

  return (
    <Stack spacing={2.5}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
          gap: 2,
        }}
      >
        <TheSo
          nhan_="Nhân viên đang làm"
          giaTri={tk.soNhanVienDangLam}
          phu={tk.soNhanVienDaNghi > 0 ? `${tk.soNhanVienDaNghi} đã nghỉ` : "Không có ai đã nghỉ"}
          icon={<BadgeRounded />}
        />
        <TheSo
          nhan_="Phòng ban"
          giaTri={tk.soPhongBan}
          phu={`${tk.phanBo.filter((pb) => pb.cap === 1).length} phòng ban gốc`}
          icon={<AccountTreeRounded />}
        />
        <TheSo
          nhan_="Người phụ thuộc"
          giaTri={tk.soNguoiPhuThuoc}
          phu="Đã đăng ký giảm trừ"
          icon={<FamilyRestroomRounded />}
        />
        <TheSo
          nhan_="Tham gia công đoàn"
          giaTri={tk.soThamGiaCongDoan}
          phu={`Trên ${tk.soNhanVienDangLam} người đang làm`}
          icon={<Diversity3Rounded />}
        />
      </Box>

      {(tk.soChuaGanPhongBan > 0 || tk.soChuaCoHopDong > 0) && (
        <Alert
          severity="warning"
          action={
            <Button
              size="small"
              color="inherit"
              onClick={() => navigate("/hrm/danh-muc/nhan-vien")}
              sx={{ textTransform: "none" }}
            >
              Mở danh sách
            </Button>
          }
        >
          {tk.soChuaGanPhongBan > 0 && (
            <>
              <strong>{tk.soChuaGanPhongBan}</strong> nhân viên chưa được gán phòng ban.{" "}
            </>
          )}
          {tk.soChuaCoHopDong > 0 && (
            <>
              <strong>{tk.soChuaCoHopDong}</strong> nhân viên chưa có hợp đồng.
            </>
          )}
        </Alert>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
          gap: 2.5,
          alignItems: "start",
        }}
      >
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
            Nhân viên theo phòng ban
          </Typography>
          <Stack spacing={1.5}>
            {tk.phanBo.map((pb) => (
              <Box key={pb.ma_pb}>
                <Stack
                  direction="row"
                  sx={{ justifyContent: "space-between", alignItems: "baseline" }}
                >
                  <Typography
                    variant="body2"
                    sx={{ pl: (pb.cap - 1) * 2, fontWeight: pb.cap === 1 ? 700 : 400 }}
                  >
                    {pb.ten_pb}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {pb.so_nv}
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={(pb.so_nv / soNvLonNhat) * 100}
                  sx={{ height: 6, borderRadius: 3, mt: 0.5 }}
                />
              </Box>
            ))}
            {tk.phanBo.length === 0 && (
              <Typography variant="body2" color="text.disabled" sx={{ py: 2 }}>
                Chưa có phòng ban nào.
              </Typography>
            )}
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
            Hợp đồng cần để ý
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Hợp đồng hiện hành hết hạn trong 90 ngày tới hoặc đã quá hạn mà chưa ký tiếp.
          </Typography>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: 700, whiteSpace: "nowrap" } }}>
                  <TableCell>Nhân viên</TableCell>
                  <TableCell>Số HĐ</TableCell>
                  <TableCell>Hết hạn</TableCell>
                  <TableCell align="right">Còn lại</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tk.sapHetHan.map((dong) => (
                  <TableRow key={dong.id} hover>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {dong.ho_ten}
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block" }}
                      >
                        {dong.ma_nv}
                      </Typography>
                    </TableCell>
                    <TableCell>{dong.so_hd}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {ngayVn(dong.ngay_ket_thuc)}
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        size="small"
                        color={dong.con_lai_ngay < 0 ? "error" : "warning"}
                        variant={dong.con_lai_ngay < 0 ? "filled" : "outlined"}
                        label={
                          dong.con_lai_ngay < 0
                            ? `Quá ${Math.abs(dong.con_lai_ngay)} ngày`
                            : `${dong.con_lai_ngay} ngày`
                        }
                        sx={{ height: 22 }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {tk.sapHetHan.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Typography
                        variant="body2"
                        color="text.disabled"
                        sx={{ textAlign: "center", py: 4 }}
                      >
                        Không có hợp đồng nào sắp hết hạn.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    </Stack>
  );
}

function TheSo({
  nhan_,
  giaTri,
  phu,
  icon,
}: {
  nhan_: string;
  giaTri: number;
  phu: string;
  icon: ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", color: "primary.main" }}>
        {icon}
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {nhan_}
        </Typography>
      </Stack>
      <Typography variant="h4" sx={{ fontWeight: 700, mt: 1 }}>
        {giaTri}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {phu}
      </Typography>
    </Paper>
  );
}
