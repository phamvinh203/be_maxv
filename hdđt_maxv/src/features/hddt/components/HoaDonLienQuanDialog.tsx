import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import CloseRounded from "@mui/icons-material/CloseRounded";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import { ketQuaKiemTraLabel, trangThaiHdLabel } from "../api/gdt";
import { useRelatedInvoicesQuery } from "../api/invoiceDetailQueries";
import { formatDateVN } from "../dateUtils";
import type { InvoiceDirection } from "../types";
import { getErrorMessage } from "../../../lib/errors";

interface Props {
  open: boolean;
  onClose: () => void;
  direction: InvoiceDirection;
  /** id hóa đơn đang xét (null khi chưa chọn — dialog không fetch). */
  id: string | null;
  /** Mở tờ hóa đơn của 1 dòng trong chuỗi (nút "Xem hóa đơn" ở cột cuối). */
  onXemHoaDon: (id: string) => void;
}

/**
 * Dialog "Hóa đơn liên quan" — CHUỖI thay thế/điều chỉnh của một hóa đơn: chính nó cộng mọi tờ đứng
 * trước và sau nó, mới nhất trên cùng (cùng chiều sắp xếp với bảng Tổng quát).
 *
 * Chuỗi do BE dò (`/gdt/invoices/:direction/lien-quan/:id`) chứ không ghép ở FE: hóa đơn thay thế
 * thường lập ở KỲ SAU hóa đơn gốc nên nằm ngoài khoảng đang lọc, mà bảng đang mở chỉ có dữ liệu
 * trong khoảng đó. Nhờ BE dò thẳng trong DB nên dialog đủ cả trạng thái, kết quả kiểm tra và id để
 * xem được từng tờ — kể cả tờ người dùng chưa từng thấy trên bảng.
 *
 * Dùng: `InvoiceListTabs` (cột "Hóa đơn liên quan" ở bảng Tổng quát).
 */
export default function HoaDonLienQuanDialog({ open, onClose, direction, id, onXemHoaDon }: Props) {
  const query = useRelatedInvoicesQuery(direction, id, open);
  const chain = query.data?.chain ?? [];
  // 1 phần tử = chỉ có chính nó, tức hóa đơn này không nằm trong quan hệ thay thế/điều chỉnh nào.
  const coLienQuan = chain.length > 1;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle
        sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: 1 }}
      >
        Hóa đơn liên quan
        <IconButton size="small" onClick={onClose} aria-label="Đóng">
          <CloseRounded fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {query.isLoading ? (
          <Box
            sx={{
              py: 6,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <CircularProgress />
            <Typography variant="body2">Đang tra hóa đơn liên quan…</Typography>
          </Box>
        ) : query.isError ? (
          <Alert severity="error">
            {getErrorMessage(query.error, "Không tra được hóa đơn liên quan.")}
          </Alert>
        ) : (
          <Stack spacing={1.5}>
            {!coLienQuan && (
              <Alert severity="info">
                Hóa đơn này không có hóa đơn thay thế hoặc điều chỉnh liên quan.
              </Alert>
            )}
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>STT</TableCell>
                    <TableCell>Số hóa đơn</TableCell>
                    <TableCell>Ký hiệu hóa đơn</TableCell>
                    <TableCell>Trạng thái</TableCell>
                    <TableCell>Kết quả kiểm tra</TableCell>
                    <TableCell>Ngày lập hóa đơn</TableCell>
                    <TableCell align="center">Xem hóa đơn</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {chain.map((r, i) => (
                    // Tô đậm tờ người dùng bấm vào để phân biệt với các tờ liên quan quanh nó.
                    <TableRow key={r.id} hover selected={r.id === id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{r.shdon}</TableCell>
                      <TableCell>{r.khhdon}</TableCell>
                      <TableCell>{trangThaiHdLabel(r.tthai)}</TableCell>
                      <TableCell>{ketQuaKiemTraLabel(r.ttxly)}</TableCell>
                      <TableCell>{formatDateVN(r.tdlap)}</TableCell>
                      <TableCell align="center">
                        <Tooltip title="Xem hóa đơn">
                          <IconButton
                            size="small"
                            sx={{ p: 0.25 }}
                            onClick={() => onXemHoaDon(r.id)}
                            aria-label={`Xem hóa đơn ${r.shdon}`}
                          >
                            <VisibilityRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>
          Đóng
        </Button>
      </DialogActions>
    </Dialog>
  );
}
