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
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import SearchRounded from "@mui/icons-material/SearchRounded";
import SyncRounded from "@mui/icons-material/SyncRounded";
import InboxRounded from "@mui/icons-material/InboxRounded";
import { useAuth } from "../../auth/useAuth";
import {
  getPurchaseInvoices,
  getSoldInvoices,
  type PurchaseInvoiceRaw,
  type SoldInvoiceRaw,
} from "../api/gdt";

type InvoiceDirection = "in" | "out";

const TAB_CONFIG: Record<
  InvoiceDirection,
  { label: string; partnerColumn: string }
> = {
  in: { label: "Hóa đơn đầu vào", partnerColumn: "MST / Tên người bán" },
  out: { label: "Hóa đơn đầu ra", partnerColumn: "MST / Tên người mua" },
};

/** Dòng hiển thị chuẩn hóa — gộp field khác tên giữa hóa đơn mua vào (nbmst/nbten) và bán ra (nmmst/nmten). */
interface DisplayRow {
  id: string;
  khhdon: string;
  shdon: string;
  tdlap: string;
  partner: string;
  tgtttbso: number;
  tthai: string;
}

function toDisplayRow(direction: InvoiceDirection) {
  return (r: PurchaseInvoiceRaw | SoldInvoiceRaw): DisplayRow => {
    const mst = direction === "in" ? (r as PurchaseInvoiceRaw).nbmst : (r as SoldInvoiceRaw).nmmst;
    const ten = direction === "in" ? (r as PurchaseInvoiceRaw).nbten : (r as SoldInvoiceRaw).nmten;
    return {
      id: r.id,
      khhdon: r.khhdon,
      shdon: r.shdon,
      tdlap: r.tdlap,
      partner: `${mst ?? ""}${ten ? ` - ${ten}` : ""}`,
      tgtttbso: r.tgtttbso,
      tthai: r.tthai,
    };
  };
}

function formatMoney(n?: number) {
  if (typeof n !== "number") return "";
  return n.toLocaleString("vi-VN");
}

function formatDate(s?: string) {
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("vi-VN");
}

interface InvoiceTablePanelProps {
  direction: InvoiceDirection;
}

function InvoiceTablePanel({ direction }: InvoiceTablePanelProps) {
  const { partnerColumn } = TAB_CONFIG[direction];

  const { currentGdtMst, getGdtToken } = useAuth();
  const [keyword, setKeyword] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [rows, setRows] = useState<DisplayRow[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    setError("");

    if (!fromDate || !toDate) {
      setError("Vui lòng chọn đủ Từ ngày / Đến ngày.");
      return;
    }

    const token = currentGdtMst ? getGdtToken(currentGdtMst) : undefined;
    if (!token) {
      setError(
        'Chưa đăng nhập Thuế điện tử — bấm "Đăng nhập Thuế điện tử" ở trên trước khi tra cứu.',
      );
      return;
    }

    setLoading(true);
    try {
      const datas =
        direction === "in"
          ? (await getPurchaseInvoices(token, { tuNgay: fromDate, denNgay: toDate })).datas
          : (await getSoldInvoices(token, { tuNgay: fromDate, denNgay: toDate })).datas;
      setRows((datas ?? []).map(toDisplayRow(direction)));
      setSearched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lấy được danh sách hóa đơn.");
    } finally {
      setLoading(false);
    }
  };

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
        <Button
          variant="outlined"
          sx={{ textTransform: "none" }}
          disabled={loading}
          onClick={handleSearch}
        >
          {loading ? <CircularProgress size={20} /> : "Tra cứu"}
        </Button>
        <Button
          variant="contained"
          startIcon={<SyncRounded />}
          sx={{ textTransform: "none", whiteSpace: "nowrap" }}
          disabled
        >
          Đồng bộ từ Thuế
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

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
            {rows.length > 0 ? (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.khhdon}</TableCell>
                  <TableCell>{r.shdon}</TableCell>
                  <TableCell>{formatDate(r.tdlap)}</TableCell>
                  <TableCell>{r.partner}</TableCell>
                  <TableCell align="right">{formatMoney(r.tgtttbso)}</TableCell>
                  <TableCell align="center">{r.tthai}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} sx={{ border: 0, py: 6 }}>
                  <Stack spacing={1} sx={{ alignItems: "center", color: "text.disabled" }}>
                    <InboxRounded fontSize="large" />
                    <Typography variant="body2">
                      {searched ? "Không có hóa đơn nào trong khoảng đã chọn" : "Chưa có dữ liệu"}
                    </Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            )}
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
