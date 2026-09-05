import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import { getErrorMessage } from "../../../../../lib/errors";
import { ngayVn } from "../../../format";
import { NAM_HO_TRO, ngayLeChuanVN } from "../../../ngayLeChuan";
import { useNgayLeList, useTaoNhanhNgayLe } from "../../../mock/hooks/ngayLe";

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Sinh lịch nghỉ lễ chuẩn Việt Nam cho một năm — Điều 112 Bộ luật Lao động 2019. */
export default function TaoNhanhDialog({ open, onClose }: Props) {
  const danhSachHienCo = useNgayLeList();
  const taoNhanh = useTaoNhanhNgayLe();

  const namMacDinh = NAM_HO_TRO.includes(new Date().getFullYear())
    ? new Date().getFullYear()
    : (NAM_HO_TRO[0] ?? new Date().getFullYear());

  const [nam, setNam] = useState(namMacDinh);
  const [dangTao, setDangTao] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNam(namMacDinh);
  }, [open, namMacDinh]);

  // Xem trước để người dùng biết chính xác sẽ thêm gì, và dòng nào đã có sẵn.
  const xemTruoc = useMemo(() => {
    const daCo = new Set(danhSachHienCo.map((nl) => `${nl.ngay}|${nl.ten.trim()}`));
    return ngayLeChuanVN(nam).map((nl) => ({
      ...nl,
      trung: daCo.has(`${nl.ngay}|${nl.ten}`),
    }));
  }, [nam, danhSachHienCo]);

  const soSeThem = xemTruoc.filter((nl) => !nl.trung).length;

  const handleTao = async () => {
    setDangTao(true);
    try {
      const soDaThem = await taoNhanh(nam);
      toast.success(
        soDaThem > 0
          ? `Đã thêm ${soDaThem} ngày lễ chuẩn năm ${nam}.`
          : `Lịch năm ${nam} đã đầy đủ, không có ngày nào cần thêm.`,
      );
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, "Không tạo được lịch ngày lễ."));
    } finally {
      setDangTao(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Tạo nhanh lịch nghỉ lễ</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity="info">
            Hệ thống tự thêm các ngày nghỉ lễ chuẩn Việt Nam theo Điều 112 Bộ luật Lao động
            2019. Ngày đã có sẵn sẽ được bỏ qua, không tạo trùng.
          </Alert>

          <TextField
            select
            label="Năm cần tạo"
            size="small"
            fullWidth
            value={nam}
            onChange={(e) => setNam(Number(e.target.value))}
            helperText="Chỉ mở các năm đã có sẵn ngày âm lịch của Tết và Giỗ Tổ."
          >
            {NAM_HO_TRO.map((n) => (
              <MenuItem key={n} value={n}>
                Năm {n}
              </MenuItem>
            ))}
          </TextField>

          <Paper variant="outlined" sx={{ maxHeight: 280, overflowY: "auto" }}>
            <List dense disablePadding>
              {xemTruoc.map((nl) => (
                <ListItem key={`${nl.ngay}-${nl.ten}-${nl.ghi_chu}`} divider>
                  <ListItemText
                    primary={nl.ten}
                    secondary={ngayVn(nl.ngay)}
                    sx={{ opacity: nl.trung ? 0.5 : 1 }}
                  />
                  {nl.trung && (
                    <Chip size="small" variant="outlined" label="Đã có" sx={{ height: 20 }} />
                  )}
                </ListItem>
              ))}
            </List>
          </Paper>

          <Alert severity="warning">
            Ngày Tết Nguyên đán và Giỗ Tổ Hùng Vương lấy từ bảng tra âm lịch sẵn trong mã
            nguồn — hãy đối chiếu với lịch nghỉ chính thức trước khi dùng.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>
          Hủy
        </Button>
        <Button
          variant="contained"
          onClick={handleTao}
          disabled={dangTao || soSeThem === 0}
          sx={{ textTransform: "none" }}
        >
          {soSeThem > 0 ? `Tạo ${soSeThem} ngày lễ` : "Không có gì để tạo"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
