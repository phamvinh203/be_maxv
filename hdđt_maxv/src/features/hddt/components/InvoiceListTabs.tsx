import { useState, type SyntheticEvent } from "react";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import InboxRounded from "@mui/icons-material/InboxRounded";
import DescriptionRounded from "@mui/icons-material/DescriptionRounded";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import { useGdtSession } from "../gdtSession/useGdtSession";
import { getInvoices, type InvoiceDirection, type InvoiceRaw } from "../api/gdt";
import InvoiceFilterPanel, { type InvoiceFilterValues } from "./InvoiceFilterPanel";

/** Cột chưa có nguồn dữ liệu (cần lưu DB / tra cứu rủi ro riêng) — hiển thị tạm "—". */
const NO_DATA_YET = "—";

/** Dòng hiển thị — đổi tên field GDT sang tên tiếng Việt dễ đọc cho bảng. */
interface DisplayRow {
  id: string;
  mauHd: string;
  soSeri: string;
  soHd: string;
  ngayLap: string;
  ngayKy: string;
  partnerMst: string;
  partnerTen: string;
  tienChuaThue?: number;
  tienThue?: number;
  cktm?: number;
  phi?: number;
  tongTt: number;
  maNt: string;
  tyGia?: number;
  trangThaiHd: string;
  ketQuaKt: string;
}

function toDisplayRow(r: InvoiceRaw): DisplayRow {
  return {
    id: r.id,
    mauHd: r.khmshdon,
    soSeri: r.khhdon,
    soHd: r.shdon,
    ngayLap: r.tdlap,
    ngayKy: r.nky ?? "",
    partnerMst: r.mstDoiTac,
    partnerTen: r.tenDoiTac,
    tienChuaThue: r.tgtcthue,
    tienThue: r.tgtthue,
    cktm: r.ttcktmai,
    phi: r.tgtphi,
    tongTt: r.tgtttbso,
    maNt: r.dvtte ?? "",
    tyGia: r.tgia,
    trangThaiHd: r.tthai,
    ketQuaKt: r.ttxly,
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
  const { currentGdtMst, getGdtToken } = useGdtSession();
  const [rows, setRows] = useState<DisplayRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0 && !allSelected;

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSearch = async (filters: InvoiceFilterValues) => {
    setError("");

    if (!filters.tuNgay || !filters.denNgay) {
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
      const result = await getInvoices(direction, token, {
        tuNgay: filters.tuNgay,
        denNgay: filters.denNgay,
        mstDoiTac: filters.mstDoiTac || undefined,
        trangThaiHd: filters.trangThaiHd || undefined,
        ketQuaHd: filters.ketQuaHd || undefined,
        mauHd: filters.mauHd || undefined,
        soSeri: filters.soSeri || undefined,
        soHd: filters.soHd || undefined,
      });
      setRows((result.datas ?? []).map(toDisplayRow));
      setSelected(new Set());
      setSearched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lấy được danh sách hóa đơn.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setError("");
    setRows([]);
    setSelected(new Set());
    setSearched(false);
  };

  return (
    <Box sx={{ pt: 2.5 }}>
      

      <InvoiceFilterPanel
        direction={direction}
        loading={loading}
        onSearch={handleSearch}
        onReset={handleReset}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ "& td, & th": { whiteSpace: "nowrap" } }}>
          <TableHead>
            <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "action.hover" } }}>
              <TableCell padding="checkbox">
                <Checkbox
                  size="small"
                  indeterminate={someSelected}
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={rows.length === 0}
                />
              </TableCell>
              <TableCell>T. thái tải</TableCell>
              <TableCell>Ký hiệu mẫu số</TableCell>
              <TableCell>Ký hiệu hóa đơn</TableCell>
              <TableCell>Số hóa đơn</TableCell>
              <TableCell>Ngày lập</TableCell>
              <TableCell>Ngày ký</TableCell>
              <TableCell>MST người bán/MST người xuất hàng</TableCell>
              <TableCell>Tên người bán/Tên người xuất hàng</TableCell>
              <TableCell align="right">Tổng tiền chưa thuế</TableCell>
              <TableCell align="right">Tổng tiền thuế</TableCell>
              <TableCell align="right">Tổng CKTM</TableCell>
              <TableCell align="right">Tổng phí</TableCell>
              <TableCell align="right">Tổng tiền thanh toán</TableCell>
              <TableCell>Mã nt</TableCell>
              <TableCell align="right">Tỷ giá</TableCell>
              <TableCell align="center">Trạng thái hóa đơn</TableCell>
              <TableCell align="center">Kết quả kiểm tra</TableCell>
              <TableCell>Mã ct hạch toán</TableCell>
              <TableCell>Tên chứng từ hạch toán</TableCell>
              <TableCell align="center">Hóa đơn rủi ro</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((r) => (
                <TableRow key={r.id} selected={selected.has(r.id)} hover>
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={selected.has(r.id)}
                      onChange={() => toggleOne(r.id)}
                    />
                  </TableCell>
                  <TableCell>{NO_DATA_YET}</TableCell>
                  <TableCell>{r.mauHd}</TableCell>
                  <TableCell>{r.soSeri}</TableCell>
                  <TableCell>{r.soHd}</TableCell>
                  <TableCell>{formatDate(r.ngayLap)}</TableCell>
                  <TableCell>{formatDate(r.ngayKy)}</TableCell>
                  <TableCell>{r.partnerMst}</TableCell>
                  <TableCell>{r.partnerTen}</TableCell>
                  <TableCell align="right">{formatMoney(r.tienChuaThue)}</TableCell>
                  <TableCell align="right">{formatMoney(r.tienThue)}</TableCell>
                  <TableCell align="right">{formatMoney(r.cktm)}</TableCell>
                  <TableCell align="right">{formatMoney(r.phi)}</TableCell>
                  <TableCell align="right">{formatMoney(r.tongTt)}</TableCell>
                  <TableCell>{r.maNt}</TableCell>
                  <TableCell align="right">{formatMoney(r.tyGia)}</TableCell>
                  <TableCell align="center">{r.trangThaiHd}</TableCell>
                  <TableCell align="center">{r.ketQuaKt}</TableCell>
                  <TableCell>{NO_DATA_YET}</TableCell>
                  <TableCell>{NO_DATA_YET}</TableCell>
                  <TableCell align="center">{NO_DATA_YET}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={21} sx={{ border: 0, py: 6 }}>
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
  const [tab, setTab] = useState<InvoiceDirection>("purchase");

  const handleChange = (_e: SyntheticEvent, value: InvoiceDirection) => {
    setTab(value);
  };

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{
          justifyContent: "space-between",
          alignItems: { sm: "center" },
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Tabs value={tab} onChange={handleChange} sx={{ minHeight: 0 }}>
          <Tab label="Hóa đơn đầu vào" value="purchase" />
          <Tab label="Hóa đơn đầu ra" value="sold" />
        </Tabs>

        <Stack direction="row" spacing={1} sx={{ pb: { xs: 1, sm: 0 } }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DescriptionRounded fontSize="small" />}
            sx={{ textTransform: "none", whiteSpace: "nowrap" }}
            
          >
            Lập tờ khai và bảng kê
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<FileDownloadRounded fontSize="small" />}
            sx={{ textTransform: "none", whiteSpace: "nowrap" }}
            
          >
            Xuất file excel tổng hợp và hóa đơn
          </Button>
        </Stack>
      </Stack>

      {/* key={tab}: buộc remount khi đổi tab để mỗi chiều có state tra cứu riêng, không lẫn dữ liệu cũ. */}
      <InvoiceTablePanel key={tab} direction={tab} />
    </Box>
  );
}
