import { useState, type SyntheticEvent } from "react";
import Box from "@mui/material/Box";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import InboxRounded from "@mui/icons-material/InboxRounded";
import ConstructionRounded from "@mui/icons-material/ConstructionRounded";
import DescriptionRounded from "@mui/icons-material/DescriptionRounded";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import { useAuth } from "../../auth/useAuth";
import { useGdtSession } from "../gdtSession/useGdtSession";
import { getInvoices, trangThaiHdLabel, type InvoiceDirection, type InvoiceRaw } from "../api/gdt";
import InvoiceFilterPanel, { type InvoiceFilterValues } from "./InvoiceFilterPanel";

/** Cột chưa có nguồn dữ liệu (cần API/tính năng riêng, chưa xây) — hiển thị tạm "—". */
const NO_DATA_YET = "—";
/** Số cột của bảng "Tổng quát" — dùng cho colSpan của empty-state. */
const COLUMN_COUNT = 27;

/** Dòng hiển thị — chuẩn hóa field GDT + tách rõ bên bán/bên mua theo chiều hóa đơn. */
interface DisplayRow {
  id: string;
  mauHd: string;
  soSeri: string;
  soHd: string;
  ngayLap: string;
  sellerMst: string;
  sellerTen: string;
  sellerDiaChi: string;
  buyerMst: string;
  buyerTen: string;
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

/**
 * GDT chỉ trả về thông tin bên đối tác (bên còn lại là công ty mình, đã biết trước qua
 * phiên đăng nhập) — nên cần `ownMst`/`ownTen` (tra từ danh sách công ty đã đăng nhập)
 * để điền đủ cột "người bán"/"người mua" bất kể đang xem chiều nào.
 */
function toDisplayRow(
  r: InvoiceRaw,
  direction: InvoiceDirection,
  ownMst: string,
  ownTen: string,
): DisplayRow {
  const isPurchase = direction === "purchase";
  return {
    id: r.id,
    mauHd: r.khmshdon,
    soSeri: r.khhdon,
    soHd: r.shdon,
    ngayLap: r.tdlap,
    sellerMst: isPurchase ? r.mstDoiTac : ownMst,
    sellerTen: isPurchase ? r.tenDoiTac : ownTen,
    sellerDiaChi: isPurchase ? (r.diaChiDoiTac ?? "") : "",
    buyerMst: isPurchase ? ownMst : r.mstDoiTac,
    buyerTen: isPurchase ? ownTen : r.tenDoiTac,
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

type ResultTab = "tong-quat" | "chi-tiet";

function InvoiceTablePanel({ direction }: InvoiceTablePanelProps) {
  const { companies } = useAuth();
  const { currentGdtMst, getGdtToken } = useGdtSession();
  const [resultTab, setResultTab] = useState<ResultTab>("tong-quat");
  const [rows, setRows] = useState<DisplayRow[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (filters: InvoiceFilterValues) => {
    setError("");

    if (!filters.tuNgay || !filters.denNgay) {
      setError("Vui lòng chọn đủ Từ ngày / Đến ngày.");
      return;
    }

    const token = currentGdtMst ? getGdtToken(currentGdtMst) : undefined;
    if (!token || !currentGdtMst) {
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
      const ownTen = companies.find((c) => c.maSoThue === currentGdtMst)?.tenDonVi ?? "";
      setRows((result.datas ?? []).map((r) => toDisplayRow(r, direction, currentGdtMst, ownTen)));
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

      <Tabs
        value={resultTab}
        onChange={(_e, value: ResultTab) => setResultTab(value)}
        sx={{ minHeight: 0, mb: 1.5 }}
      >
        <Tab label="Tổng quát" value="tong-quat" sx={{ minHeight: 0 }} />
        <Tab label="Chi tiết hoá đơn" value="chi-tiet" sx={{ minHeight: 0 }} />
      </Tabs>

      {resultTab === "chi-tiet" ? (
        <Box
          sx={{
            py: 8,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1.5,
            color: "text.disabled",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
          }}
        >
          <ConstructionRounded fontSize="large" />
          <Typography variant="body2">
            Chi tiết hóa đơn — tính năng đang phát triển.
          </Typography>
        </Box>
      ) : (
      <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ "& td, & th": { whiteSpace: "nowrap" } }}>
          <TableHead>
            <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "action.hover" } }}>
              <TableCell>STT</TableCell>
              <TableCell>Ký hiệu mẫu số</TableCell>
              <TableCell>Ký hiệu hóa đơn</TableCell>
              <TableCell>Số hóa đơn</TableCell>
              <TableCell>Ngày lập</TableCell>
              <TableCell>MST người bán/MST người xuất hàng</TableCell>
              <TableCell>Tên người bán/Tên người xuất hàng</TableCell>
              <TableCell>Địa chỉ người bán</TableCell>
              <TableCell>MST người mua/MST người nhận hàng</TableCell>
              <TableCell>CCCD người mua</TableCell>
              <TableCell>Tên người mua/Tên người nhận hàng</TableCell>
              <TableCell align="right">Tổng tiền chưa thuế</TableCell>
              <TableCell align="right">Tổng tiền thuế</TableCell>
              <TableCell align="right">Tổng tiền chiết khấu thương mại</TableCell>
              <TableCell align="right">Tổng tiền phí</TableCell>
              <TableCell align="right">Tổng tiền thanh toán</TableCell>
              <TableCell>Đơn vị tiền tệ</TableCell>
              <TableCell align="right">Tỷ giá</TableCell>
              <TableCell>Ghi chú: Hóa đơn thay thế, điều chỉnh, bị thay thế, bị điều chỉnh</TableCell>
              <TableCell align="center">Trạng thái hóa đơn</TableCell>
              <TableCell align="center">Kết quả kiểm tra hóa đơn</TableCell>
              <TableCell>Website người bán</TableCell>
              <TableCell>Url tra cứu hóa đơn gốc</TableCell>
              <TableCell>Mã tra cứu hóa đơn gốc</TableCell>
              <TableCell>Hóa đơn liên quan</TableCell>
              <TableCell align="center">Xem hóa đơn</TableCell>
              <TableCell align="center">Tải file</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((r, i) => (
                <TableRow key={r.id} hover>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{r.mauHd}</TableCell>
                  <TableCell>{r.soSeri}</TableCell>
                  <TableCell>{r.soHd}</TableCell>
                  <TableCell>{formatDate(r.ngayLap)}</TableCell>
                  <TableCell>{r.sellerMst}</TableCell>
                  <TableCell>{r.sellerTen}</TableCell>
                  <TableCell>{r.sellerDiaChi || NO_DATA_YET}</TableCell>
                  <TableCell>{r.buyerMst}</TableCell>
                  <TableCell>{NO_DATA_YET}</TableCell>
                  <TableCell>{r.buyerTen}</TableCell>
                  <TableCell align="right">{formatMoney(r.tienChuaThue)}</TableCell>
                  <TableCell align="right">{formatMoney(r.tienThue)}</TableCell>
                  <TableCell align="right">{formatMoney(r.cktm)}</TableCell>
                  <TableCell align="right">{formatMoney(r.phi)}</TableCell>
                  <TableCell align="right">{formatMoney(r.tongTt)}</TableCell>
                  <TableCell>{r.maNt}</TableCell>
                  <TableCell align="right">{formatMoney(r.tyGia)}</TableCell>
                  <TableCell>{NO_DATA_YET}</TableCell>
                  <TableCell align="center">{trangThaiHdLabel(r.trangThaiHd)}</TableCell>
                  <TableCell align="center">{r.ketQuaKt}</TableCell>
                  <TableCell>{NO_DATA_YET}</TableCell>
                  <TableCell>{NO_DATA_YET}</TableCell>
                  <TableCell>{NO_DATA_YET}</TableCell>
                  <TableCell>{NO_DATA_YET}</TableCell>
                  <TableCell align="center">
                    <IconButton size="small" disabled>
                      <VisibilityRounded fontSize="small" />
                    </IconButton>
                  </TableCell>
                  <TableCell align="center">
                    <IconButton size="small" disabled>
                      <DownloadRounded fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} sx={{ border: 0, py: 6 }}>
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
      )}
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
