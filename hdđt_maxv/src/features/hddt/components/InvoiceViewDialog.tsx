import { useMemo } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import CloseRounded from "@mui/icons-material/CloseRounded";
import PrintRounded from "@mui/icons-material/PrintRounded";
import { useSavedInvoiceDetailByIdQuery } from "../api/invoiceDetailQueries";
import { toInvoiceView } from "../invoiceView";
import {
  INVOICE_CSS,
  invoiceAssetCss,
  renderInvoiceHtml,
  standaloneInvoiceHtml,
  PRINT_PAGE_CSS,
} from "../invoiceHtml";
import { PUBLIC_INVOICE_ASSETS } from "../invoiceAssets";
import { getErrorMessage } from "../../../lib/errors";
import type { InvoiceDirection } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  direction: InvoiceDirection;
  /** id hóa đơn đang chọn (null khi chưa chọn — dialog không fetch). */
  id: string | null;
}

/**
 * Dialog "Xem hóa đơn" — dựng tờ hóa đơn GTGT theo bố cục bản in Tổng cục Thuế từ chi tiết ĐÃ LƯU
 * (đọc DB theo id, không gọi GDT), có nút In (in qua iframe ẩn). HTML tờ hóa đơn do `renderInvoiceHtml`
 * dựng (dùng chung với luồng xuất file .html/.pdf) nên bản xem/in/xuất giống hệt nhau. Dùng:
 * `InvoiceTablePanel` (chọn 1 dòng ở bảng "Tổng quát" rồi bấm "Xem hóa đơn").
 */
export default function InvoiceViewDialog({ open, onClose, direction, id }: Props) {
  const query = useSavedInvoiceDetailByIdQuery(direction, id, open);
  const view = useMemo(() => toInvoiceView(query.data?.detail), [query.data]);

  /** In tờ hóa đơn: ghi tài liệu HTML độc lập (CSS + @page) vào iframe ẩn rồi gọi print. */
  const handlePrint = () => {
    if (!view) return;
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }
    doc.open();
    // In từ trong app -> ảnh vẫn lấy được từ `public/` (iframe cùng origin).
    doc.write(
      standaloneInvoiceHtml(view, { extraCss: PRINT_PAGE_CSS, assets: PUBLIC_INVOICE_ASSETS }),
    );
    doc.close();
    const win = iframe.contentWindow;
    if (!win) {
      document.body.removeChild(iframe);
      return;
    }
    // Đợi layout trong iframe xong rồi in; gỡ iframe sau khi in (afterprint hoặc timeout dự phòng).
    win.focus();
    win.onafterprint = () => document.body.removeChild(iframe);
    setTimeout(() => {
      win.print();
      // Dự phòng nếu onafterprint không bắn (một số trình duyệt): gỡ sau vài giây.
      setTimeout(() => {
        if (iframe.parentNode) document.body.removeChild(iframe);
      }, 1000);
    }, 150);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: 1 }}>
        Xem hóa đơn
        <IconButton size="small" onClick={onClose} aria-label="Đóng">
          <CloseRounded fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {query.isLoading ? (
          <Box sx={{ py: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
            <CircularProgress />
            <Typography variant="body2">Đang tải hóa đơn…</Typography>
          </Box>
        ) : query.isError ? (
          <Alert severity="error">
            {getErrorMessage(query.error, "Không đọc được hóa đơn.")}
          </Alert>
        ) : !view ? (
          <Alert severity="info">
            Hóa đơn chưa tải chi tiết. Bấm &quot;Tải chi tiết&quot; ở thanh công cụ để tải từ Thuế
            điện tử rồi mở lại.
          </Alert>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <style>{INVOICE_CSS + invoiceAssetCss(PUBLIC_INVOICE_ASSETS)}</style>
            {/* HTML do renderInvoiceHtml dựng (giá trị động đã escape) — an toàn để nhúng. */}
            <div dangerouslySetInnerHTML={{ __html: renderInvoiceHtml(view) }} />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>
          Đóng
        </Button>
        <Button
          variant="contained"
          startIcon={<PrintRounded fontSize="small" />}
          onClick={handlePrint}
          disabled={!view}
          sx={{ textTransform: "none" }}
        >
          In
        </Button>
      </DialogActions>
    </Dialog>
  );
}
