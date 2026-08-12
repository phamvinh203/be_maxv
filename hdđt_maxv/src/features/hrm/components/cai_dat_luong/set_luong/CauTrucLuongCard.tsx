import { useMemo, useState, type MouseEvent } from "react";
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
import MenuItem from "@mui/material/MenuItem";
import Menu from "@mui/material/Menu";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import Switch from "@mui/material/Switch";
import AddRounded from "@mui/icons-material/AddRounded";
import DeleteRounded from "@mui/icons-material/DeleteRounded";
import { PHAN_LOAI_THUE, TIEU_THUC_TINH, moTaLoaiKhoan } from "../../../constants";
import { tienVn } from "../../../format";
import { useKhoanLuongList } from "../../../mock/hooks/khoanLuong";
import type {
  CauTrucLuong,
  DongCauTrucLuong,
  PhanLoaiThue,
  TieuThucTinh,
} from "../../../types";
import TienField from "../../TienField";

interface Props {
  values: CauTrucLuong;
  onChange: (values: CauTrucLuong) => void;
}

/**
 * Thời gian hiệu lực và bảng cấu trúc lương.
 *
 * Mỗi dòng trỏ về một khoản trong **Danh mục lương & phụ cấp** — không cho gõ
 * tên tự do ở đây, nếu không hai tab của cùng một khu sẽ có hai danh sách khoản
 * khác nhau và bảng lương không biết lấy khoản nào.
 */
export default function CauTrucLuongCard({ values, onChange }: Props) {
  const danhMuc = useKhoanLuongList();
  const [menuEl, setMenuEl] = useState<HTMLElement | null>(null);

  const khoanTheoMa = useMemo(
    () => new Map(danhMuc.map((kl) => [kl.ma_khoan, kl])),
    [danhMuc],
  );

  const chuaDung = useMemo(() => {
    const daDung = new Set(values.dong.map((d) => d.ma_khoan));
    return danhMuc.filter((kl) => kl.status === "1" && !daDung.has(kl.ma_khoan));
  }, [danhMuc, values.dong]);

  const datDong = (viTri: number, moi: Partial<DongCauTrucLuong>) =>
    onChange({
      ...values,
      dong: values.dong.map((d, i) => (i === viTri ? { ...d, ...moi } : d)),
    });

  const themKhoan = (maKhoan: string) => {
    setMenuEl(null);
    const kl = khoanTheoMa.get(maKhoan);
    onChange({
      ...values,
      dong: [
        ...values.dong,
        {
          ma_khoan: maKhoan,
          // Kế thừa cờ thuế đã khai ở danh mục — người dùng đổi lại được.
          phan_loai: kl?.chiu_thue_tncn ? "tncn" : "mien_thue",
          tang_ca: false,
          tieu_thuc: "co_dinh_thang",
          so_tien: 0,
        },
      ],
    });
  };

  const tongMuc = values.dong.reduce((tong, d) => tong + d.so_tien, 0);

  return (
    <Stack spacing={2.5}>
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
          Thời gian hiệu lực
        </Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "220px 220px minmax(0, 1fr)" },
            gap: 2,
          }}
        >
          <TextField
            label="Từ ngày"
            type="date"
            required
            size="small"
            value={values.tu_ngay}
            onChange={(e) => onChange({ ...values, tu_ngay: e.target.value })}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Đến ngày"
            type="date"
            size="small"
            value={values.den_ngay}
            onChange={(e) => onChange({ ...values, den_ngay: e.target.value })}
            slotProps={{ inputLabel: { shrink: true } }}
            helperText="Để trống nếu áp dụng vô thời hạn."
          />
          <TextField
            label="Ghi chú"
            size="small"
            value={values.ghi_chu}
            onChange={(e) => onChange({ ...values, ghi_chu: e.target.value })}
          />
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{ mb: 2, alignItems: { sm: "center" }, justifyContent: "space-between" }}
        >
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Cấu trúc lương
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Thiết lập cho từng khoản dùng trong bảng lương.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<AddRounded />}
            disabled={chuaDung.length === 0}
            onClick={(e: MouseEvent<HTMLElement>) => setMenuEl(e.currentTarget)}
            sx={{ textTransform: "none", flexShrink: 0 }}
          >
            {chuaDung.length > 0
              ? `Thêm khoản có sẵn (${chuaDung.length})`
              : "Đã dùng hết khoản trong danh mục"}
          </Button>
          <Menu anchorEl={menuEl} open={Boolean(menuEl)} onClose={() => setMenuEl(null)}>
            {chuaDung.map((kl) => (
              <MenuItem key={kl.ma_khoan} onClick={() => themKhoan(kl.ma_khoan)}>
                {kl.ten_khoan}
                <Chip
                  size="small"
                  variant="outlined"
                  label={moTaLoaiKhoan(kl.loai).nhanNgan}
                  sx={{ height: 20, ml: 1.5 }}
                />
              </MenuItem>
            ))}
          </Menu>
        </Stack>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, whiteSpace: "nowrap" } }}>
                <TableCell sx={{ minWidth: 240 }}>Khoản lương / Phụ cấp</TableCell>
                <TableCell sx={{ minWidth: 150 }}>Phân loại</TableCell>
                <TableCell align="center" sx={{ minWidth: 90 }}>
                  Tăng ca
                </TableCell>
                <TableCell sx={{ minWidth: 220 }}>Tiêu thức tính</TableCell>
                <TableCell sx={{ minWidth: 180 }}>Tiền lương/phụ cấp</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {values.dong.map((dong, i) => {
                const kl = khoanTheoMa.get(dong.ma_khoan);
                return (
                  <TableRow key={dong.ma_khoan} hover>
                    <TableCell>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center", flexWrap: "wrap" }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {kl?.ten_khoan ?? dong.ma_khoan}
                        </Typography>
                        {kl && (
                          <Chip
                            size="small"
                            variant="outlined"
                            label={moTaLoaiKhoan(kl.loai).nhanNgan}
                            sx={{ height: 20 }}
                          />
                        )}
                      </Stack>
                      {kl?.ghi_chu && (
                        <Typography variant="caption" color="text.secondary">
                          {kl.ghi_chu}
                        </Typography>
                      )}
                    </TableCell>

                    <TableCell>
                      <TextField
                        select
                        size="small"
                        fullWidth
                        value={dong.phan_loai}
                        onChange={(e) =>
                          datDong(i, { phan_loai: e.target.value as PhanLoaiThue })
                        }
                      >
                        {PHAN_LOAI_THUE.map((item) => (
                          <MenuItem key={item.value} value={item.value}>
                            {item.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>

                    <TableCell align="center">
                      <Tooltip title={dong.tang_ca ? "Đang bật" : "Đang tắt"}>
                        <Switch
                          size="small"
                          checked={dong.tang_ca}
                          onChange={(e) => datDong(i, { tang_ca: e.target.checked })}
                        />
                      </Tooltip>
                    </TableCell>

                    <TableCell>
                      <TextField
                        select
                        size="small"
                        fullWidth
                        value={dong.tieu_thuc}
                        onChange={(e) =>
                          datDong(i, { tieu_thuc: e.target.value as TieuThucTinh })
                        }
                      >
                        {TIEU_THUC_TINH.map((item) => (
                          <MenuItem key={item.value} value={item.value}>
                            {item.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>

                    <TableCell>
                      <TienField
                        label=""
                        value={dong.so_tien}
                        onChange={(v) => datDong(i, { so_tien: v })}
                      />
                    </TableCell>

                    <TableCell align="right">
                      <Tooltip title="Bỏ khoản khỏi cấu trúc">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() =>
                            onChange({
                              ...values,
                              dong: values.dong.filter((_, j) => j !== i),
                            })
                          }
                        >
                          <DeleteRounded fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}

              {values.dong.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography
                      variant="body2"
                      color="text.disabled"
                      sx={{ textAlign: "center", py: 4 }}
                    >
                      Chưa có khoản nào. Bấm "Thêm khoản có sẵn" để lấy từ danh mục.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}

              {values.dong.length > 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="right" sx={{ fontWeight: 700 }}>
                    Tổng mức mặc định
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{tienVn(tongMuc)} ₫</TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Stack>
  );
}
