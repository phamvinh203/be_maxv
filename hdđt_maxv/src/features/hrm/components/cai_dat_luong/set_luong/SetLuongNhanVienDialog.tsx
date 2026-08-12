import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { getErrorMessage } from "../../../../../lib/errors";
import { PHAN_LOAI_THUE, TIEU_THUC_TINH, moTaLoaiKhoan } from "../../../constants";
import { ngayVn, nhan, tienVn } from "../../../format";
import { useKhoanLuongList } from "../../../mock/hooks/khoanLuong";
import { useNhanVienDetail } from "../../../mock/hooks/nhanVien";
import {
  useCauTrucLuong,
  useLuuSetLuong,
  useSetLuongCuaNhanVien,
} from "../../../mock/hooks/setLuong";
import TienField from "../../TienField";

interface Props {
  open: boolean;
  onClose: () => void;
  maNv: string | null;
  /** `true` = chỉ xem, không cho sửa số tiền. */
  chiDoc: boolean;
}

/**
 * Set lương cho một nhân viên.
 *
 * Danh sách khoản lấy nguyên từ **cấu trúc lương** đang áp dụng — không cho
 * thêm khoản riêng ở đây, nếu không mỗi người một cấu trúc và bảng lương sẽ
 * không cộng được thành một biểu thống nhất. Số tiền thì từng người một mức,
 * điền sẵn theo mức mặc định của cấu trúc.
 */
export default function SetLuongNhanVienDialog({ open, onClose, maNv, chiDoc }: Props) {
  const nhanVien = useNhanVienDetail(maNv);
  const cauTruc = useCauTrucLuong();
  const banHienCo = useSetLuongCuaNhanVien(maNv);
  const danhMuc = useKhoanLuongList();
  const luuSetLuong = useLuuSetLuong();

  const [khoan, setKhoan] = useState<Record<string, number>>({});
  const [dangLuu, setDangLuu] = useState(false);

  const khoanTheoMa = useMemo(
    () => new Map(danhMuc.map((kl) => [kl.ma_khoan, kl])),
    [danhMuc],
  );

  useEffect(() => {
    if (!open) return;
    const banDau: Record<string, number> = {};
    for (const dong of cauTruc.dong) {
      banDau[dong.ma_khoan] = banHienCo?.khoan[dong.ma_khoan] ?? dong.so_tien;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKhoan(banDau);
  }, [open, cauTruc, banHienCo]);

  const tong = Object.values(khoan).reduce((cong, tien) => cong + tien, 0);

  const handleSubmit = async () => {
    if (!maNv) return;
    setDangLuu(true);
    try {
      await luuSetLuong(maNv, khoan);
      toast.success(`Đã lưu set lương cho ${nhanVien?.ho_ten ?? maNv}.`);
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, "Không lưu được set lương."));
    } finally {
      setDangLuu(false);
    }
  };

  if (!nhanVien) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>
        {chiDoc ? "Xem set lương" : "Set lương"} — {nhanVien.ho_ten}
      </DialogTitle>
      <Stack direction="row" spacing={1} sx={{ px: 3, pb: 2, flexWrap: "wrap" }}>
        <Chip size="small" variant="outlined" label={nhanVien.ma_nv} sx={{ height: 22 }} />
        <Chip
          size="small"
          variant="outlined"
          label={`Hiệu lực ${ngayVn(cauTruc.tu_ngay)} → ${
            cauTruc.den_ngay ? ngayVn(cauTruc.den_ngay) : "không thời hạn"
          }`}
          sx={{ height: 22 }}
        />
        {banHienCo && (
          <Chip
            size="small"
            variant="outlined"
            label={`Lần thiết lập: ${banHienCo.lan_thiet_lap}`}
            sx={{ height: 22 }}
          />
        )}
      </Stack>

      <DialogContent dividers>
        {cauTruc.dong.length === 0 ? (
          <Alert severity="warning">
            Cấu trúc lương chưa có khoản nào. Thêm khoản ở phần "Cấu trúc lương" trước khi set
            lương cho nhân viên.
          </Alert>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: 700, whiteSpace: "nowrap" } }}>
                  <TableCell>Khoản lương / Phụ cấp</TableCell>
                  <TableCell>Phân loại</TableCell>
                  <TableCell>Tiêu thức tính</TableCell>
                  <TableCell align="right" sx={{ minWidth: 180 }}>
                    Số tiền
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cauTruc.dong.map((dong) => {
                  const kl = khoanTheoMa.get(dong.ma_khoan);
                  return (
                    <TableRow key={dong.ma_khoan} hover>
                      <TableCell>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
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
                          {dong.tang_ca && (
                            <Chip
                              size="small"
                              color="info"
                              label="Tăng ca"
                              sx={{ height: 20 }}
                            />
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>{nhan(PHAN_LOAI_THUE, dong.phan_loai)}</TableCell>
                      <TableCell>{nhan(TIEU_THUC_TINH, dong.tieu_thuc)}</TableCell>
                      <TableCell align="right">
                        {chiDoc ? (
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {tienVn(khoan[dong.ma_khoan] ?? 0)} ₫
                          </Typography>
                        ) : (
                          <TienField
                            label=""
                            value={khoan[dong.ma_khoan] ?? 0}
                            onChange={(v) =>
                              setKhoan((cu) => ({ ...cu, [dong.ma_khoan]: v }))
                            }
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow>
                  <TableCell colSpan={3} align="right" sx={{ fontWeight: 700 }}>
                    Tổng lương
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {tienVn(tong)} ₫
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {!chiDoc && (
          <Box sx={{ mt: 2 }}>
            <Alert severity="info">
              Lưu xong bản set lương chuyển về trạng thái <strong>Chờ duyệt</strong> — kể cả
              khi trước đó đã duyệt rồi.
            </Alert>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>
          {chiDoc ? "Đóng" : "Hủy"}
        </Button>
        {!chiDoc && (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={dangLuu || cauTruc.dong.length === 0}
            sx={{ textTransform: "none" }}
          >
            Lưu
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
