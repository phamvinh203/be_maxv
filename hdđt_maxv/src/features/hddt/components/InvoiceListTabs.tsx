import { useState, type SyntheticEvent } from "react";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import InputAdornment from "@mui/material/InputAdornment";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import Typography from "@mui/material/Typography";
import SearchRounded from "@mui/icons-material/SearchRounded";
import SyncRounded from "@mui/icons-material/SyncRounded";
import InboxRounded from "@mui/icons-material/InboxRounded";

type InvoiceDirection = "in" | "out";

const TAB_CONFIG: Record<
  InvoiceDirection,
  { label: string; partnerColumn: string }
> = {
  in: { label: "Hóa đơn đầu vào", partnerColumn: "MST / Tên người bán" },
  out: { label: "Hóa đơn đầu ra", partnerColumn: "MST / Tên người mua" },
};

interface InvoiceTablePanelProps {
  direction: InvoiceDirection;
}

function InvoiceTablePanel({ direction }: InvoiceTablePanelProps) {
  const { partnerColumn } = TAB_CONFIG[direction];
  const [keyword, setKeyword] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  return (
    <Box sx={{ pt: 2.5 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ mb: 2, alignItems: { sm: "center" } }}
      >
        <TextField
          label="Từ ngày"
          type="date"
          size="small"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label="Đến ngày"
          type="date"
          size="small"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          placeholder="Tìm theo số hóa đơn, MST..."
          size="small"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          sx={{ flexGrow: 1, minWidth: 220 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRounded fontSize="small" color="action" />
                </InputAdornment>
              ),
            },
          }}
        />
        <Button variant="outlined" sx={{ textTransform: "none" }}>
          Tra cứu
        </Button>
        <Button
          variant="contained"
          startIcon={<SyncRounded />}
          sx={{ textTransform: "none", whiteSpace: "nowrap" }}
        >
          Đồng bộ từ Thuế
        </Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "action.hover" } }}>
              <TableCell>Ký hiệu</TableCell>
              <TableCell>Số hóa đơn</TableCell>
              <TableCell>Ngày lập</TableCell>
              <TableCell>{partnerColumn}</TableCell>
              <TableCell align="right">Tổng tiền</TableCell>
              <TableCell align="center">Trạng thái</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell colSpan={6} sx={{ border: 0, py: 6 }}>
                <Stack spacing={1} sx={{ alignItems: "center", color: "text.disabled" }}>
                  <InboxRounded fontSize="large" />
                  <Typography variant="body2">Chưa có dữ liệu</Typography>
                </Stack>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default function InvoiceListTabs() {
  const [tab, setTab] = useState<InvoiceDirection>("in");

  const handleChange = (_e: SyntheticEvent, value: InvoiceDirection) => {
    setTab(value);
  };

  return (
    <Box>
      <Tabs
        value={tab}
        onChange={handleChange}
        sx={{ borderBottom: 1, borderColor: "divider" }}
      >
        <Tab label={TAB_CONFIG.in.label} value="in" />
        <Tab label={TAB_CONFIG.out.label} value="out" />
      </Tabs>

      {tab === "in" && <InvoiceTablePanel direction="in" />}
      {tab === "out" && <InvoiceTablePanel direction="out" />}
    </Box>
  );
}
