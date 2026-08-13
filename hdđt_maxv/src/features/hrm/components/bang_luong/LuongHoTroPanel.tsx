import { useMemo, useState } from "react";
import { toast } from "react-toastify";
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
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import CalculateRounded from "@mui/icons-material/CalculateRounded";
import VolunteerActivismRounded from "@mui/icons-material/VolunteerActivismRounded";
import { alpha } from "@mui/material/styles";
import { getErrorMessage } from "../../../../lib/errors";
import { tienVn } from "../../format";
import {
  useKhoanHoTroList,
  useKyBangLuong,
  useLuongHoTroRows,
  useSoNhanVienDangLam,
} from "../../mock/hooks/bangLuong";
import type { BangLuongFilters } from "../../types";
import ThanhLocBangLuong from "./ThanhLocBangLuong";
import { xuatLuongHoTroExcel } from "./luongHoTroExcel";

/** Giờ:phút:giây của lần tính gần nhất — hiện cạnh nút "Tính lương". */
function gioHienTai(): string {
  return new Date().toLocaleTimeString("vi-VN");
}

/**
 * Bóc tách lương hỗ trợ của kỳ.
 *
 * Mỗi khoản hỗ trợ trong Danh mục lương & phụ cấp là **một cột**, sinh động
 * theo danh mục chứ không viết cứng: thêm "Hỗ trợ đi lại" ở Cài đặt lương là
 * bảng này có thêm cột ngay, không phải sửa màn hình.
 *
 * Số trong bảng là mức **đã quy theo ngày công**, đúng con số đang nằm trong cột
 * "Thu nhập" của tab Bảng lương — người dùng chắc chắn sẽ cộng thử hai tab với
 * nhau, nên hai bên phải khớp.
 */
export default function LuongHoTroPanel() {
  const ky = useKyBangLuong();
  const soNhanVien = useSoNhanVienDangLam();
  const khoanHoTro = useKhoanHoTroList();

  const [filters, setFilters] = useState<BangLuongFilters>({
    q: "",
    ma_pb: "",
    loai_hd: "",
    kieu_luong: "",
  });
  const [nonce, setNonce] = useState(0);
  const [tinhLuc, setTinhLuc] = useState(gioHienTai);
  const [dangXuat, setDangXuat] = useState(false);

  const rows = useLuongHoTroRows(filters, nonce);

  const tongHoTro = useMemo(
    () => rows.reduce((tong, row) => tong + row.tong, 0),
    [rows],
  );
  const tongTheoKhoan = useMemo(() => {
    const tong = new Map<string, number>();
    for (const kl of khoanHoTro) {
      tong.set(
        kl.ma_khoan,
        rows.reduce((cong, row) => cong + (row.khoan[kl.ma_khoan] ?? 0), 0),
      );
    }
    return tong;
  }, [rows, khoanHoTro]);

  const handleTinh = () => {
    setNonce((cu) => cu + 1);
    setTinhLuc(gioHienTai());
    toast.success(`Đã tính lương hỗ trợ cho ${rows.length} nhân viên.`);
  };

  const handleXuat = async () => {
    setDangXuat(true);
    try {
      await xuatLuongHoTroExcel(rows, khoanHoTro, ky.nhan);
      toast.success("Đã xuất file lương hỗ trợ.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Không xuất được lương hỗ trợ."));
    } finally {
      setDangXuat(false);
    }
  };

  return (
    <Stack spacing={2.5}>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={2}
        sx={{ alignItems: { lg: "flex-start" }, justifyContent: "space-between" }}
      >
        <Paper variant="outlined" sx={{ p: 2, minWidth: 280 }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 44,
                height: 44,
                borderRadius: 2,
                color: "success.main",
                bgcolor: (theme) => alpha(theme.palette.success.main, 0.12),
              }}
            >
              <VolunteerActivismRounded />
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Tổng hỗ trợ
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                {tienVn(tongHoTro)} ₫
              </Typography>
              <Typography variant="caption" color="text.disabled">
                {khoanHoTro.length} khoản hỗ trợ đang áp dụng
              </Typography>
            </Box>
          </Stack>
        </Paper>

        <Stack spacing={0.5} sx={{ alignItems: { lg: "flex-end" } }}>
          <Stack direction="row" spacing={1.5}>
            <Button
              startIcon={<FileDownloadRounded />}
              onClick={handleXuat}
              disabled={dangXuat || rows.length === 0}
              sx={{ textTransform: "none", whiteSpace: "nowrap" }}
            >
              Xuất Excel
            </Button>
            <Button
              variant="contained"
              startIcon={<CalculateRounded />}
              onClick={handleTinh}
              sx={{ textTransform: "none", whiteSpace: "nowrap" }}
            >
              Tính lương
            </Button>
          </Stack>
          <Typography variant="caption" color="text.disabled">
            {ky.nhan} · tính lúc {tinhLuc}
          </Typography>
        </Stack>
      </Stack>

      <ThanhLocBangLuong
        filters={filters}
        onFilters={setFilters}
        soHienThi={rows.length}
        soTong={soNhanVien}
      />

      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: "62vh" }}>
        <Table size="small" stickyHeader sx={{ width: "max-content", minWidth: "100%" }}>
          <TableHead>
            <TableRow sx={{ "& th": { fontWeight: 700, whiteSpace: "nowrap" } }}>
              <TableCell
                sx={{
                  // Cột tên dính trái: số cột đổi theo danh mục nên bảng có thể
                  // rộng ra bất cứ lúc nào.
                  position: "sticky",
                  left: 0,
                  zIndex: 4,
                  bgcolor: "background.paper",
                  minWidth: 200,
                }}
              >
                Họ và tên
              </TableCell>
              <TableCell sx={{ minWidth: 190 }}>Bộ phận/Chức vụ</TableCell>
              <TableCell align="center" sx={{ minWidth: 90 }}>
                Ngày công
              </TableCell>
              {khoanHoTro.map((kl) => (
                <TableCell key={kl.ma_khoan} align="right" sx={{ minWidth: 130 }}>
                  {kl.ten_khoan}
                </TableCell>
              ))}
              <TableCell align="right" sx={{ minWidth: 140 }}>
                Tổng hỗ trợ
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.ma_nv} hover>
                <TableCell
                  sx={{
                    position: "sticky",
                    left: 0,
                    zIndex: 2,
                    bgcolor: "background.paper",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {row.ho_ten}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {row.ma_nv}
                  </Typography>
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  <Typography variant="body2">
                    {row.ten_pb || "Chưa gán phòng ban"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {row.ten_cv || "—"}
                  </Typography>
                </TableCell>
                <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                  {row.ngay_cong}/{row.ngay_cong_chuan}
                </TableCell>

                {khoanHoTro.map((kl) => {
                  const so = row.khoan[kl.ma_khoan] ?? 0;
                  return (
                    <TableCell key={kl.ma_khoan} align="right" sx={{ whiteSpace: "nowrap" }}>
                      {so === 0 ? (
                        <Box component="span" sx={{ color: "text.disabled" }}>
                          0
                        </Box>
                      ) : (
                        tienVn(so)
                      )}
                    </TableCell>
                  );
                })}

                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  <Tooltip
                    title={
                      row.tong === row.tong_muc_thang
                        ? "Đủ công nên nhận trọn mức tháng"
                        : `Mức tháng ${tienVn(row.tong_muc_thang)} ₫, quy theo ${row.ngay_cong}/${row.ngay_cong_chuan} ngày công`
                    }
                  >
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 700, cursor: "help", display: "inline" }}
                      // Bị cắt so với mức tháng thì tô cam — người nhận sẽ hỏi
                      // vì sao tháng này ít hơn, phải thấy ngay trên bảng.
                      color={row.tong < row.tong_muc_thang ? "warning.main" : "text.primary"}
                    >
                      {tienVn(row.tong)} ₫
                    </Typography>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}

            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={khoanHoTro.length + 4}>
                  <Typography
                    variant="body2"
                    color="text.disabled"
                    sx={{ textAlign: "center", py: 4 }}
                  >
                    {khoanHoTro.length === 0
                      ? "Chưa có khoản hỗ trợ nào đang dùng — tạo ở Cài đặt lương › Danh mục khoản."
                      : "Không có nhân viên nào khớp bộ lọc."}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>

          {rows.length > 0 && (
            <TableBody>
              <TableRow
                sx={{
                  position: "sticky",
                  bottom: 0,
                  zIndex: 3,
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                  "& td": { fontWeight: 700, borderTop: 1, borderColor: "divider" },
                }}
              >
                <TableCell
                  sx={{
                    position: "sticky",
                    left: 0,
                    zIndex: 4,
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                    whiteSpace: "nowrap",
                  }}
                >
                  Tổng cộng
                </TableCell>
                <TableCell />
                <TableCell />
                {khoanHoTro.map((kl) => (
                  <TableCell key={kl.ma_khoan} align="right" sx={{ whiteSpace: "nowrap" }}>
                    {tienVn(tongTheoKhoan.get(kl.ma_khoan) ?? 0)}
                  </TableCell>
                ))}
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  {tienVn(tongHoTro)} ₫
                </TableCell>
              </TableRow>
            </TableBody>
          )}
        </Table>
      </TableContainer>

      <Typography variant="caption" color="text.secondary">
        Mỗi cột là một khoản hỗ trợ đang dùng ở Cài đặt lương › Danh mục khoản. Số đã quy theo
        ngày công nên cộng đúng bằng phần hỗ trợ nằm trong cột "Thu nhập" của tab Bảng lương.
      </Typography>
    </Stack>
  );
}
