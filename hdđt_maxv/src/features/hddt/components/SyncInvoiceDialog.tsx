import { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Radio from "@mui/material/Radio";
import TextField from "@mui/material/TextField";
import Collapse from "@mui/material/Collapse";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import CloseRounded from "@mui/icons-material/CloseRounded";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import SyncRounded from "@mui/icons-material/SyncRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Chiều đồng bộ (mua vào / bán ra). */
type SyncDirection = "all" | "sold" | "purchase";
/** Loại hóa đơn theo cách xử lý máy tính tiền. */
type SyncInvoiceType = "all" | "exceptCashRegister" | "onlyCashRegister";

const HISTORY_COLUMNS = [
  "STT",
  "Từ ngày",
  "Đến ngày",
  "Số lượng đồng bộ",
  "Trạng thái",
  "Diễn giải",
  "Ngày đồng bộ",
];

/**
 * Dialog "Đồng bộ hóa đơn" — chọn chiều/loại hóa đơn + khoảng ngày rồi đồng bộ từ hệ thống
 * HĐĐT. Hiện chỉ dựng UI (chưa nối dữ liệu): lịch sử đồng bộ để trống, các nút chưa có logic.
 */
export default function SyncInvoiceDialog({ open, onClose }: Props) {
  const [direction, setDirection] = useState<SyncDirection>("all");
  const [invoiceType, setInvoiceType] = useState<SyncInvoiceType>("all");
  const [tuNgay, setTuNgay] = useState("");
  const [denNgay, setDenNgay] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 2 } } }}
    >
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, px: 3, pt: 2.5, pb: 2 }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Đồng bộ hóa đơn
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Chọn khoảng thời gian cần đồng bộ từ hệ thống hóa đơn điện tử
          </Typography>
        </Box>
        <IconButton aria-label="Đóng" onClick={onClose} size="small" sx={{ mt: -0.5 }}>
          <CloseRounded fontSize="small" />
        </IconButton>
      </Box>
      <Divider />

      <DialogContent sx={{ pt: 2.5 }}>
        {/* Chọn chiều đồng bộ */}
        <FormControl sx={{ mb: 2 }}>
          <FormLabel sx={{ fontWeight: 700, color: "text.primary", mb: 0.5 }}>
            Chọn đồng bộ hóa đơn mua vào / bán ra
          </FormLabel>
          <RadioGroup
            row
            value={direction}
            onChange={(e) => setDirection(e.target.value as SyncDirection)}
          >
            <FormControlLabel value="all" control={<Radio size="small" />} label="Đồng bộ tất cả" />
            <FormControlLabel
              value="sold"
              control={<Radio size="small" />}
              label="Chỉ đồng bộ hóa đơn bán ra"
            />
            <FormControlLabel
              value="purchase"
              control={<Radio size="small" />}
              label="Chỉ đồng bộ hóa đơn mua vào"
            />
          </RadioGroup>
        </FormControl>

        {/* Chọn loại hóa đơn */}
        <FormControl sx={{ mb: 2 }}>
          <FormLabel sx={{ fontWeight: 700, color: "text.primary", mb: 0.5 }}>
            Chọn đồng bộ loại hóa đơn
          </FormLabel>
          <RadioGroup
            row
            value={invoiceType}
            onChange={(e) => setInvoiceType(e.target.value as SyncInvoiceType)}
          >
            <FormControlLabel value="all" control={<Radio size="small" />} label="Đồng bộ tất cả" />
            <FormControlLabel
              value="exceptCashRegister"
              control={<Radio size="small" />}
              label="Đồng bộ tất cả trừ hóa đơn máy tính tiền"
            />
            <FormControlLabel
              value="onlyCashRegister"
              control={<Radio size="small" />}
              label="Chỉ đồng bộ hóa đơn máy tính tiền"
            />
          </RadioGroup>
        </FormControl>

        {/* Khoảng ngày */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 2,
            mb: 2.5,
          }}
        >
          <TextField
            label="Từ ngày"
            type="date"
            value={tuNgay}
            onChange={(e) => setTuNgay(e.target.value)}
            size="small"
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Đến ngày"
            type="date"
            value={denNgay}
            onChange={(e) => setDenNgay(e.target.value)}
            size="small"
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Box>

        {/* Thêm lịch đồng bộ (gập/mở) */}
        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, mb: 2.5 }}>
          <Box
            role="button"
            onClick={() => setScheduleOpen((v) => !v)}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: 2,
              py: 1.25,
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <Typography sx={{ fontWeight: 600 }}>Thêm lịch đồng bộ</Typography>
            <ExpandMoreRounded
              sx={{
                transition: "transform 0.15s",
                transform: scheduleOpen ? "rotate(180deg)" : "none",
                color: "text.secondary",
              }}
            />
          </Box>
          <Collapse in={scheduleOpen}>
            <Divider />
            <Box sx={{ px: 2, py: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Lịch đồng bộ tự động đang được phát triển. Bạn sẽ có thể đặt tần suất (hằng ngày /
                hằng tuần) để hệ thống tự đồng bộ hóa đơn theo lịch.
              </Typography>
            </Box>
          </Collapse>
        </Box>

        {/* Lịch sử đồng bộ hóa đơn */}
        <Typography sx={{ fontWeight: 700, mb: 1 }}>Lịch sử đồng bộ hóa đơn</Typography>
        <TableContainer sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
          <Table size="small" sx={{ "& td, & th": { whiteSpace: "nowrap" } }}>
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "action.hover" } }}>
                {HISTORY_COLUMNS.map((col) => (
                  <TableCell key={col}>{col}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell
                  colSpan={HISTORY_COLUMNS.length}
                  sx={{ border: 0, py: 5, textAlign: "center", color: "text.disabled" }}
                >
                  Chưa có lịch sử đồng bộ hóa đơn.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>

      <Divider />
      <DialogActions sx={{ justifyContent: "space-between", px: 3, py: 2 }}>
        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteOutlineRounded />}
          sx={{ textTransform: "none" }}
        >
          Xóa dữ liệu đã đồng bộ
        </Button>
        <Stack direction="row" spacing={1.5}>
          <Button color="inherit" onClick={onClose} sx={{ textTransform: "none" }}>
            Hủy
          </Button>
          <Button
            variant="contained"
            startIcon={<SyncRounded />}
            sx={{ textTransform: "none" }}
          >
            Đồng bộ
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
