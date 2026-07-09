import { useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import Collapse from "@mui/material/Collapse";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import CircularProgress from "@mui/material/CircularProgress";
import RemoveRounded from "@mui/icons-material/RemoveRounded";
import AddRounded from "@mui/icons-material/AddRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import RestartAltRounded from "@mui/icons-material/RestartAltRounded";
import type { InvoiceDirection } from "../api/gdt";

export interface InvoiceFilterValues {
  tuNgay: string;
  denNgay: string;
  mstDoiTac: string;
  trangThaiHd: string;
  ketQuaHd: string;
  mauHd: string;
  soSeri: string;
  soHd: string;
}

const EMPTY_FILTERS: InvoiceFilterValues = {
  tuNgay: "",
  denNgay: "",
  mstDoiTac: "",
  trangThaiHd: "",
  ketQuaHd: "",
  mauHd: "",
  soSeri: "",
  soHd: "",
};

interface Props {
  direction: InvoiceDirection;
  loading: boolean;
  onSearch: (values: InvoiceFilterValues) => void;
  onReset: () => void;
}

/** Bộ lọc tra cứu hóa đơn — gập/mở được, khớp layout màn tra cứu HĐĐT của GDT. */
export default function InvoiceFilterPanel({ direction, loading, onSearch, onReset }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [values, setValues] = useState<InvoiceFilterValues>(EMPTY_FILTERS);

  const setField =
    (key: keyof InvoiceFilterValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [key]: e.target.value }));
    };

  const partnerLabel = direction === "purchase" ? "MST người bán" : "MST người mua";
  const cccdLabel = direction === "purchase" ? "CCCD người bán" : "CCCD người mua";

  const handleReset = () => {
    setValues(EMPTY_FILTERS);
    onReset();
  };

  return (
    <Paper variant="outlined" sx={{ mb: 2 }}>
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", px: 2, py: 1 }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Bộ lọc hóa đơn {direction === "purchase" ? "mua vào" : "bán ra"} đã được đồng bộ
        </Typography>
        <IconButton
          size="small"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Thu gọn bộ lọc" : "Mở rộng bộ lọc"}
        >
          {expanded ? <RemoveRounded fontSize="small" /> : <AddRounded fontSize="small" />}
        </IconButton>
      </Stack>

      <Collapse in={expanded}>
        <Divider />
        <Box sx={{ p: 2 }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 2,
            }}
          >
            <TextField
              label={partnerLabel}
              value={values.mstDoiTac}
              onChange={setField("mstDoiTac")}
              size="small"
              fullWidth
            />
            <Tooltip title="Chưa hỗ trợ lọc theo CCCD">
              <TextField label={cccdLabel} size="small" fullWidth disabled />
            </Tooltip>

            <TextField
              label="Trạng thái"
              placeholder="Nhập mã trạng thái (vd: 1)"
              value={values.trangThaiHd}
              onChange={setField("trangThaiHd")}
              size="small"
              fullWidth
            />
            <Stack direction="row" spacing={1.5}>
              <TextField
                label="Từ ngày"
                type="date"
                value={values.tuNgay}
                onChange={setField("tuNgay")}
                size="small"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="Đến ngày"
                type="date"
                value={values.denNgay}
                onChange={setField("denNgay")}
                size="small"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Stack>

            <TextField
              label="Kết quả kiểm tra"
              placeholder="Nhập mã kết quả (vd: 1)"
              value={values.ketQuaHd}
              onChange={setField("ketQuaHd")}
              size="small"
              fullWidth
            />
            <TextField
              label="Ký hiệu mẫu số hóa đơn"
              value={values.mauHd}
              onChange={setField("mauHd")}
              size="small"
              fullWidth
            />

            <TextField
              label="Số hóa đơn"
              value={values.soHd}
              onChange={setField("soHd")}
              size="small"
              fullWidth
            />
            <TextField
              label="Ký hiệu hóa đơn"
              value={values.soSeri}
              onChange={setField("soSeri")}
              size="small"
              fullWidth
            />
          </Box>

          <Tooltip title="Chưa hỗ trợ lọc hóa đơn ủy nhiệm">
            <FormControlLabel
              sx={{ mt: 1 }}
              control={<Checkbox size="small" disabled />}
              label="Hóa đơn ủy nhiệm"
            />
          </Tooltip>

          <Stack direction="row" spacing={2} sx={{ justifyContent: "center", mt: 2 }}>
            <Button
              variant="contained"
              startIcon={loading ? undefined : <SearchRounded />}
              sx={{ textTransform: "none", px: 4 }}
              disabled={loading}
              onClick={() => onSearch(values)}
            >
              {loading ? <CircularProgress size={20} color="inherit" /> : "Tìm kiếm"}
            </Button>
            <Button
              variant="outlined"
              startIcon={<RestartAltRounded />}
              sx={{ textTransform: "none" }}
              disabled={loading}
              onClick={handleReset}
            >
              Bỏ tìm kiếm
            </Button>
          </Stack>
        </Box>
      </Collapse>
    </Paper>
  );
}
