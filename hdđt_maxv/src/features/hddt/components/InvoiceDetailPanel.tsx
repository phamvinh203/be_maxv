import { useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Alert from "@mui/material/Alert";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import InboxRounded from "@mui/icons-material/InboxRounded";
import { trangThaiHdLabel, ketQuaKiemTraLabel } from "../api/gdt";
import { formatDateVN } from "../dateUtils";
import { formatMoney } from "../format";
import InvoicePagination, { DEFAULT_ROWS_PER_PAGE } from "./InvoicePagination";
import { clampPage } from "../pagination";
import type { DetailRow } from "../types";

/** 1 cột bảng "Chi tiết hóa đơn": tiêu đề + căn lề + hàm lấy nội dung ô (`stt` = số thứ tự). */
interface DetailColumn {
  header: string;
  align?: "right" | "center";
  cell: (r: DetailRow, stt: number) => ReactNode;
}

/** 26 cột — thứ tự theo yêu cầu. Thông tin hóa đơn lặp mỗi dòng hàng, phần còn lại là dòng hàng hóa. */
const DETAIL_COLUMNS: DetailColumn[] = [
  { header: "STT", cell: (_r, stt) => stt },
  { header: "Mẫu số", cell: (r) => r.mauHd },
  { header: "Ký hiệu", cell: (r) => r.kyHieu },
  { header: "Số hóa đơn", cell: (r) => r.soHd },
  { header: "Ngày hóa đơn", cell: (r) => formatDateVN(r.ngayHd) },
  { header: "MST/người bán", cell: (r) => r.sellerMst },
  { header: "Tên người bán", cell: (r) => r.sellerTen },
  { header: "Tên hàng hóa", cell: (r) => r.tenHang },
  { header: "Đvt", cell: (r) => r.dvt },
  { header: "Số lượng", align: "right", cell: (r) => formatMoney(r.soLuong) },
  { header: "Giá", align: "right", cell: (r) => formatMoney(r.gia) },
  { header: "Tiền CK", align: "right", cell: (r) => formatMoney(r.tienCk) },
  { header: "Tiền chưa thuế", align: "right", cell: (r) => formatMoney(r.tienChuaThue) },
  { header: "Thuế", align: "right", cell: (r) => formatMoney(r.thue) },
  { header: "Tiền sau thuế", align: "right", cell: (r) => formatMoney(r.tienSauThue) },
  { header: "TL CKTM", align: "right", cell: (r) => formatMoney(r.tlCktm) },
  { header: "Thuế suất", align: "center", cell: (r) => r.thueSuat },
  { header: "Mã nt", cell: (r) => r.maNt },
  { header: "Tỷ giá", align: "right", cell: (r) => formatMoney(r.tyGia) },
  { header: "Tổng tiền hàng", align: "right", cell: (r) => formatMoney(r.tongTienHang) },
  { header: "Tổng tiền thuế", align: "right", cell: (r) => formatMoney(r.tongThue) },
  { header: "Tổng CK", align: "right", cell: (r) => formatMoney(r.tongCk) },
  { header: "Tổng phí", align: "right", cell: (r) => formatMoney(r.tongPhi) },
  { header: "Tổng thanh toán", align: "right", cell: (r) => formatMoney(r.tongTt) },
  { header: "Hình thức thanh toán", cell: (r) => r.hinhThucTt },
  { header: "Trạng thái hóa đơn", align: "center", cell: (r) => trangThaiHdLabel(r.trangThaiHd) },
  { header: "Kết quả kiểm tra", align: "center", cell: (r) => ketQuaKiemTraLabel(r.ketQuaKt) },
];

/** Khung căn giữa dùng cho trạng thái loading / gợi ý (viền + bo góc như placeholder cũ). */
function CenteredState({ children }: { children: ReactNode }) {
  return (
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
      {children}
    </Box>
  );
}

interface Props {
  /** Các dòng chi tiết (đã bung hàng hóa) của TẤT CẢ hóa đơn trong khoảng đang xem. */
  rows: DetailRow[];
  loading: boolean;
  /** Lỗi đọc chi tiết đã lưu. */
  error: string;
}

/**
 * Bảng "Chi tiết hóa đơn" — nội dung tab "Chi tiết hoá đơn" trong `InvoiceListTabs`.
 * Hiển thị tất cả dòng hàng hóa của mọi hóa đơn đã tải chi tiết trong khoảng đang xem.
 */
export default function InvoiceDetailPanel({ rows, loading, error }: Props) {
  // Phân trang phía client (độc lập với tab "Tổng quát"): dùng chung InvoicePagination.
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);

  if (loading) {
    return (
      <CenteredState>
        <CircularProgress />
        <Typography variant="body2">Đang tải chi tiết hóa đơn…</Typography>
      </CenteredState>
    );
  }
  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 1 }}>
        {error}
      </Alert>
    );
  }
  if (rows.length === 0) {
    return (
      <CenteredState>
        <InboxRounded fontSize="large" />
        <Typography variant="body2">
          Chưa có chi tiết. Bấm &quot;Tải chi tiết&quot; để tải từ Thuế điện tử.
        </Typography>
      </CenteredState>
    );
  }

  // Kẹp trang trong khoảng hợp lệ (dữ liệu đổi sau khi tải lại -> khỏi kẹt ở trang trống).
  const safePage = clampPage(page, rows.length, rowsPerPage);
  const pagedRows = rows.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage);

  return (
    <>
      <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ "& td, & th": { whiteSpace: "nowrap" } }}>
          <TableHead>
            <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "action.hover" } }}>
              {DETAIL_COLUMNS.map((col) => (
                <TableCell key={col.header} align={col.align}>
                  {col.header}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {pagedRows.map((r, i) => {
              const stt = safePage * rowsPerPage + i + 1;
              return (
                <TableRow key={stt} hover>
                  {DETAIL_COLUMNS.map((col) => (
                    <TableCell key={col.header} align={col.align}>
                      {col.cell(r, stt)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <InvoicePagination
        count={rows.length}
        page={safePage}
        rowsPerPage={rowsPerPage}
        onPageChange={setPage}
        onRowsPerPageChange={(value) => {
          setRowsPerPage(value);
          setPage(0);
        }}
      />
    </>
  );
}
