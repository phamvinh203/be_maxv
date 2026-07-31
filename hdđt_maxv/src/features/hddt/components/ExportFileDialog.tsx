import { useMemo, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import FormLabel from "@mui/material/FormLabel";
import CircularProgress from "@mui/material/CircularProgress";
import CloseRounded from "@mui/icons-material/CloseRounded";
import FolderOpenRounded from "@mui/icons-material/FolderOpenRounded";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import { toast } from "react-toastify";
import { useDetailCompleteQuery } from "../api/invoiceDetailQueries";
import { exportInvoiceBundle, type ExportFormats } from "../exportBundle";
import {
  supportsDirectoryPicker,
  pickDirectory,
  type FsDirHandle,
} from "../../../lib/fileSystemAccess";
import { getErrorMessage } from "../../../lib/errors";
import { useActiveGdtToken } from "../gdtSession/useActiveGdtToken";
import type { InvoiceQuery } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Khoảng ngày đang lọc ở tab (mặc định cho dialog). */
  defaultRange: { tuNgay: string; denNgay: string };
}

/**
 * Dialog "Xuất file Excel tổng hợp + hóa đơn": xuất CẢ 2 CHIỀU (mua vào + bán ra) vào cấu trúc
 * `<MST người nhập>/<khoảng ngày>/{purchase,sold}/{html,xml,pdf}` + 2 file Excel tổng hợp, ghi vào thư
 * mục người dùng chọn (File System Access — Chrome/Edge). Chỉ cho xuất khi CẢ 2 chiều đã "đồng bộ hoàn
 * thành" (mọi HĐ có chi tiết). Mở từ tab Hóa đơn.
 *
 * HTML/PDF dựng từ chi tiết đã lưu (không cần mạng ngoài); riêng XML là BẢN GỐC ĐÃ KÝ SỐ tải từ cổng
 * thuế nên tick XML thì bắt buộc có token GDT của MST đang chọn.
 */
export default function ExportFileDialog({ open, onClose, defaultRange }: Props) {
  // MST công ty đang chọn (tên thư mục xuất + gate) và token GDT của ĐÚNG công ty đó — XML gốc phải
  // xin từ cổng thuế nên cần token; KHÔNG dùng currentGdtMst (xem useActiveGdtToken).
  const { activeMst, token: gdtToken } = useActiveGdtToken();
  const canPick = supportsDirectoryPicker();
  const [loai, setLoai] = useState<"all" | "ctt">("all");
  const [range, setRange] = useState(defaultRange);
  const [formats, setFormats] = useState<ExportFormats>({ html: true, xml: true, pdf: true });
  const [dir, setDir] = useState<FsDirHandle | null>(null);
  const [exporting, setExporting] = useState(false);

  // Query cho gate: đọc theo khoảng + loại (máy tính tiền -> ketQuaHd="8"). Dùng chung 2 chiều.
  const query: InvoiceQuery = useMemo(
    () => ({
      tuNgay: range.tuNgay,
      denNgay: range.denNgay,
      ...(loai === "ctt" ? { ketQuaHd: "8" } : {}),
    }),
    [range.tuNgay, range.denNgay, loai],
  );
  const purchaseComplete = useDetailCompleteQuery("purchase", query, open);
  const soldComplete = useDetailCompleteQuery("sold", query, open);
  const pData = purchaseComplete.data;
  const sData = soldComplete.data;

  const anyFormat = formats.html || formats.xml || formats.pdf;
  const hasRange = !!range.tuNgay && !!range.denNgay;
  const bothLoaded = !!pData && !!sData;
  const synced = bothLoaded && pData.missing === 0 && sData.missing === 0;
  const totalInvoices = (pData?.total ?? 0) + (sData?.total ?? 0);
  // XML gốc tải từ cổng thuế -> thiếu token thì chặn ngay, đừng để chạy rồi hỏng từng hóa đơn một.
  const needsGdtLogin = formats.xml && !gdtToken;
  const canExport =
    canPick &&
    !!dir &&
    !!activeMst &&
    anyFormat &&
    hasRange &&
    synced &&
    !needsGdtLogin &&
    !exporting;

  const toggle = (k: keyof ExportFormats) => setFormats((f) => ({ ...f, [k]: !f[k] }));

  const handlePickDir = async () => {
    try {
      const d = await pickDirectory();
      if (d) setDir(d);
    } catch (e) {
      toast.error(getErrorMessage(e, "Không chọn được thư mục."));
    }
  };

  const handleExport = async () => {
    if (!dir || !activeMst) return;
    setExporting(true);
    const toastId = toast.loading("Đang chuẩn bị xuất…");
    try {
      const res = await exportInvoiceBundle({
        mst: activeMst,
        query,
        range: { tuNgay: range.tuNgay, denNgay: range.denNgay },
        formats,
        dir,
        gdtToken,
        onProgress: (p) =>
          toast.update(toastId, {
            render:
              p.round === 0
                ? `Đang xuất hóa đơn ${p.done}/${p.total}…`
                : `Đang tải lại hóa đơn còn thiếu (lượt ${p.round}) ${p.done}/${p.total}…`,
          }),
      });

      // Nêu rõ THIẾU FILE Ở ĐỊNH DẠNG NÀO: một hóa đơn có thể ra đủ HTML/PDF mà chỉ hỏng XML (cổng
      // thuế chặn/không có bản gốc) — báo gộp "n lỗi" sẽ khiến người dùng chạy lại cả lượt vô ích.
      const missing = (["html", "xml", "pdf"] as const)
        .filter((k) => res.failed[k] > 0)
        .map((k) => `${res.failed[k]} ${k.toUpperCase()}`)
        .join(", ");
      // Có vá được thì nói ra: người dùng thấy toast "đang tải lại" nên cần biết kết cục của nó.
      const fixedNote = res.recovered > 0 ? ` Đã tự tải lại được ${res.recovered} hóa đơn.` : "";
      // Hóa đơn không có XML gốc KHÔNG phải lỗi — nói thành câu riêng, giọng bình thường, để người
      // dùng khỏi tưởng thiếu file rồi chạy lại cả lượt. Xuất hiện ở cả hai nhánh vì nó độc lập với
      // việc lượt xuất có hóa đơn lỗi hay không.
      const noXmlNote =
        res.noOriginalXml > 0
          ? ` ${res.noOriginalXml} hóa đơn không có XML gốc trên cổng thuế ` +
            `(hóa đơn kê khai qua bảng tổng hợp) — các file khác vẫn đủ.`
          : "";
      // File PDF gộp là thứ người dùng đi tìm ngay sau khi xuất -> nói rõ có nó và gồm bao nhiêu tờ.
      const mergedNote =
        res.mergedPdf > 0
          ? ` Kèm 1 file PDF gộp ${res.mergedPdf} hóa đơn (đứng đầu thư mục pdf/).`
          : "";
      toast.update(toastId, {
        render:
          res.err > 0
            ? `Đã xuất ${res.ok}/${res.total} hóa đơn + Excel vào "${dir.name}".${fixedNote}${noXmlNote}${mergedNote} ` +
              `Vẫn thiếu: ${missing} (đã thử lại ${res.retryRounds} lượt).` +
              (res.authExpired
                ? " Token Thuế điện tử hết hạn giữa chừng — đăng nhập lại rồi xuất lại phần XML."
                : res.firstError
                  ? ` Lỗi: ${res.firstError}`
                  : "")
            : `Đã xuất ${res.ok} hóa đơn (2 chiều) + Excel vào thư mục "${dir.name}".${fixedNote}${noXmlNote}${mergedNote}`,
        type: res.err > 0 ? "warning" : "success",
        isLoading: false,
        autoClose: res.err > 0 ? 10000 : 5000,
      });
    } catch (e) {
      toast.update(toastId, {
        render: getErrorMessage(e, "Không xuất được file."),
        type: "error",
        isLoading: false,
        autoClose: 5000,
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onClose={exporting ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: 1 }}>
        Xuất file Excel tổng hợp + hóa đơn
        <IconButton size="small" onClick={onClose} disabled={exporting} aria-label="Đóng">
          <CloseRounded fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 2 }}>
          Xuất CẢ 2 chiều (mua vào + bán ra) trong khoảng đã đồng bộ hoàn thành. Cấu trúc:{" "}
          <b>{activeMst ?? "MST"}</b> / <b>khoảng ngày</b> / {"{purchase, sold}"} /{" "}
          {"{html, xml, pdf}"} + 2 file Excel. File XML là <b>bản gốc đã ký số</b> tải trực tiếp từ
          Thuế điện tử. Phần mềm cần chút thời gian để render PDF và tải XML.
        </Alert>

        {!canPick && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Trình duyệt hiện tại không hỗ trợ chọn thư mục để lưu. Vui lòng dùng Chrome hoặc Edge.
          </Alert>
        )}
        {!activeMst && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Chưa chọn công ty có MST — không đặt được tên thư mục gốc. Hãy chọn công ty (có MST) trước.
          </Alert>
        )}
        {needsGdtLogin && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Hóa đơn XML gốc được tải trực tiếp từ Thuế điện tử nên cần đăng nhập cổng thuế cho MST
            đang chọn. Hãy đăng nhập, hoặc bỏ tick "Hóa đơn XML gốc (ký số)" để chỉ xuất HTML/PDF.
          </Alert>
        )}

        <TextField
          select
          fullWidth
          size="small"
          label="Loại hóa đơn"
          value={loai}
          onChange={(e) => setLoai(e.target.value as "all" | "ctt")}
          sx={{ mb: 2 }}
        >
          <MenuItem value="all">Tất cả hóa đơn</MenuItem>
          <MenuItem value="ctt">Hóa đơn máy tính tiền</MenuItem>
        </TextField>

        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <TextField
            type="date"
            fullWidth
            size="small"
            label="Từ ngày"
            slotProps={{ inputLabel: { shrink: true } }}
            value={range.tuNgay}
            onChange={(e) => setRange((r) => ({ ...r, tuNgay: e.target.value }))}
          />
          <TextField
            type="date"
            fullWidth
            size="small"
            label="Đến ngày"
            slotProps={{ inputLabel: { shrink: true } }}
            value={range.denNgay}
            onChange={(e) => setRange((r) => ({ ...r, denNgay: e.target.value }))}
          />
        </Stack>

        <FormLabel sx={{ fontWeight: 600, fontSize: 14 }}>Xuất kèm hóa đơn dạng</FormLabel>
        <FormGroup row sx={{ mb: 2, mt: 0.5 }}>
          <FormControlLabel
            control={<Checkbox checked={formats.html} onChange={() => toggle("html")} />}
            label="Hóa đơn HTML"
          />
          <FormControlLabel
            control={<Checkbox checked={formats.xml} onChange={() => toggle("xml")} />}
            label="Hóa đơn XML gốc (ký số)"
          />
          <FormControlLabel
            control={<Checkbox checked={formats.pdf} onChange={() => toggle("pdf")} />}
            label="Hóa đơn PDF"
          />
        </FormGroup>

        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1 }}>
          <Button
            variant="outlined"
            startIcon={<FolderOpenRounded />}
            onClick={handlePickDir}
            disabled={!canPick || exporting}
            sx={{ textTransform: "none", whiteSpace: "nowrap" }}
          >
            Chọn thư mục lưu file
          </Button>
          <Typography variant="body2" sx={{ color: dir ? "text.primary" : "text.secondary", wordBreak: "break-all" }}>
            {dir ? dir.name : "Chưa chọn thư mục"}
          </Typography>
        </Stack>

        {(purchaseComplete.isError || soldComplete.isError) && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {getErrorMessage(
              purchaseComplete.error ?? soldComplete.error,
              "Không kiểm tra được trạng thái đồng bộ.",
            )}
          </Alert>
        )}
        {bothLoaded && !synced && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            Còn hóa đơn chưa tải chi tiết — Mua vào: {pData.missing}/{pData.total}, Bán ra:{" "}
            {sData.missing}/{sData.total}. Hãy đồng bộ hoàn thành cả 2 chiều trước khi xuất.
          </Alert>
        )}
        {bothLoaded && synced && totalInvoices === 0 && (
          <Alert severity="info" sx={{ mt: 1 }}>
            Không có hóa đơn nào trong khoảng đã chọn.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={exporting} sx={{ textTransform: "none" }}>
          Hủy
        </Button>
        <Button
          variant="contained"
          startIcon={exporting ? <CircularProgress size={16} color="inherit" /> : <FileDownloadRounded />}
          onClick={handleExport}
          disabled={!canExport || totalInvoices === 0}
          sx={{ textTransform: "none" }}
        >
          Xuất file
        </Button>
      </DialogActions>
    </Dialog>
  );
}
