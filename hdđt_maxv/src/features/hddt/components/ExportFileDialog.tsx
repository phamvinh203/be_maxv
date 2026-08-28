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
import {
  exportInvoiceBundle,
  NO_ORIGINAL_XML_FILENAME,
  type ExportFormats,
} from "../exportBundle";
import {
  supportsDirectoryPicker,
  pickDirectory,
  type FsDirHandle,
} from "../../../lib/fileSystemAccess";
import { getErrorMessage } from "../../../lib/errors";
import { useActiveGdtToken } from "../gdtSession/useActiveGdtToken";
import { useActiveCompany } from "../../auth/useActiveCompanyMst";
import type { InvoiceQuery } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Khoảng ngày đang lọc ở tab (mặc định cho dialog). */
  defaultRange: { tuNgay: string; denNgay: string };
}

/**
 * Dialog "Xuất file Excel tổng hợp + hóa đơn": ghi vào cấu trúc
 * `<MST người nhập>/<khoảng ngày>/{purchase,sold}/{html,xml,pdf}` + file Excel tổng hợp, vào thư mục
 * người dùng chọn (File System Access — Chrome/Edge). Mở từ tab Hóa đơn.
 *
 * Excel là bảng kê PER-CHIỀU nên có 2 ô tick riêng (mua vào / bán ra) — cần bảng kê bên nào chỉ tải
 * bên đó. File TỪNG TỜ (html/xml/pdf) thì vẫn xuất cả 2 chiều. Gate "đồng bộ hoàn thành" bám đúng
 * phạm vi đã tick, không bắt chờ chiều mà lượt này không đụng tới.
 *
 * HTML/PDF dựng từ chi tiết đã lưu (không cần mạng ngoài); riêng XML là BẢN GỐC ĐÃ KÝ SỐ tải từ cổng
 * thuế nên tick XML thì bắt buộc có token GDT của MST đang chọn.
 */
export default function ExportFileDialog({ open, onClose, defaultRange }: Props) {
  // MST công ty đang chọn (tên thư mục xuất + gate) và token GDT của ĐÚNG công ty đó — XML gốc phải
  // xin từ cổng thuế nên cần token; KHÔNG dùng currentGdtMst (xem useActiveGdtToken).
  const { activeMst, token: gdtToken } = useActiveGdtToken();
  // Tên đơn vị cho dòng "Đơn vị:" đầu file Excel — cùng nguồn tra cứu với `activeMst`.
  const activeCompany = useActiveCompany();
  const canPick = supportsDirectoryPicker();
  const [loai, setLoai] = useState<"all" | "ctt">("all");
  const [range, setRange] = useState(defaultRange);
  const [formats, setFormats] = useState<ExportFormats>({
    html: true,
    xml: true,
    pdf: true,
    excelPurchase: true,
    excelSold: true,
  });
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
  // Chạy CẢ 2 chiều bất kể ô tick — bật/tắt checkbox chỉ đổi phạm vi gate bên dưới, không phải lý do
  // để fetch lại.
  const purchaseComplete = useDetailCompleteQuery("purchase", query, open);
  const soldComplete = useDetailCompleteQuery("sold", query, open);

  // anyFormat = có tick file TỪNG hóa đơn (html/xml/pdf); anyExcel = có tick ít nhất 1 bảng kê Excel.
  // Chỉ tick Excel cũng đủ để xuất (tải mỗi bảng kê, không kèm file hóa đơn).
  const anyFormat = formats.html || formats.xml || formats.pdf;
  const anyExcel = formats.excelPurchase || formats.excelSold;
  const anySelected = anyFormat || anyExcel;
  const hasRange = !!range.tuNgay && !!range.denNgay;

  // Chiều nào THỰC SỰ bị đụng tới trong lượt này: file từng tờ luôn ghi CẢ 2 chiều, còn Excel chỉ ghi
  // chiều được tick. Gate đồng bộ + đếm số hóa đơn bám đúng phạm vi đó — đừng bắt người chỉ cần Excel
  // mua vào phải chờ chiều bán ra đồng bộ xong, cũng đừng để chiều không dùng tới làm bật nút.
  const needed = [
    { label: "Mua vào", need: anyFormat || formats.excelPurchase, res: purchaseComplete },
    { label: "Bán ra", need: anyFormat || formats.excelSold, res: soldComplete },
  ].filter((d) => d.need);
  const neededLoaded = needed.length > 0 && needed.every((d) => !!d.res.data);
  // Dựng sẵn chuỗi cảnh báo ở đây để JSX khỏi phải đọc lại `data` (đã lọc theo missing > 0).
  const missingLines = needed
    .filter((d) => (d.res.data?.missing ?? 0) > 0)
    .map((d) => `${d.label}: ${d.res.data?.missing}/${d.res.data?.total}`);
  const synced = neededLoaded && missingLines.length === 0;
  const totalInvoices = needed.reduce((s, d) => s + (d.res.data?.total ?? 0), 0);
  const loadFailed = needed.find((d) => d.res.isError);

  // Nhãn phạm vi Excel dùng chung cho mọi câu tổng kết — tránh mỗi chỗ tự ghép một kiểu.
  const excelScope =
    formats.excelPurchase && formats.excelSold
      ? "mua vào + bán ra"
      : formats.excelPurchase
        ? "mua vào"
        : "bán ra";

  // XML gốc tải từ cổng thuế -> thiếu token thì chặn ngay, đừng để chạy rồi hỏng từng hóa đơn một.
  const needsGdtLogin = formats.xml && !gdtToken;
  const canExport =
    canPick &&
    !!dir &&
    !!activeMst &&
    anySelected &&
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
        // Cùng bản ghi công ty với `activeMst` -> dòng "Đơn vị:" trong Excel không thể ghép nhầm
        // MST của công ty này với tên của công ty kia.
        tenDonVi: activeCompany?.tenDonVi,
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
            `(hóa đơn kê khai qua bảng tổng hợp) — vẫn đủ PDF/HTML, đã liệt kê trong file "${NO_ORIGINAL_XML_FILENAME}".`
          : "";
      // File PDF gộp là thứ người dùng đi tìm ngay sau khi xuất -> nói rõ có nó và gồm bao nhiêu tờ.
      const mergedNote =
        res.mergedPdf > 0
          ? ` Kèm 1 file PDF gộp ${res.mergedPdf} hóa đơn (đứng đầu thư mục pdf/).`
          : "";
      // Nói ĐÚNG bảng kê nào vừa ghi: tick 1 chiều mà báo trống trơn "Excel tổng hợp" thì người dùng
      // đi tìm cả file của chiều kia. Không tick Excel thì không nhắc tới Excel.
      const excelNote = anyExcel ? ` + Excel tổng hợp (${excelScope})` : "";
      // Chỉ tick Excel (không html/xml/pdf) -> không ghi file hóa đơn nào, nên câu tổng kết nói theo
      // Excel thay vì "đã xuất N hóa đơn". Nhánh lỗi (res.err > 0) chỉ xảy ra khi có file hóa đơn, nên
      // ở đó luôn có "hóa đơn".
      const okSummary = anyFormat
        ? `Đã xuất ${res.ok} hóa đơn (2 chiều)${excelNote} vào thư mục "${dir.name}".${fixedNote}${noXmlNote}${mergedNote}`
        : `Đã xuất Excel tổng hợp (${excelScope}) vào thư mục "${dir.name}".`;
      toast.update(toastId, {
        render:
          res.err > 0
            ? `Đã xuất ${res.ok}/${res.total} hóa đơn${excelNote} vào "${dir.name}".${fixedNote}${noXmlNote}${mergedNote} ` +
              `Vẫn thiếu: ${missing} (đã thử lại ${res.retryRounds} lượt).` +
              (res.authExpired
                ? " Token Thuế điện tử hết hạn giữa chừng — đăng nhập lại rồi xuất lại phần XML."
                : res.firstError
                  ? ` Lỗi: ${res.firstError}`
                  : "")
            : okSummary,
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
          Cấu trúc thư mục: <b>{activeMst ?? "MST"}</b> / <b>khoảng ngày</b> / {"{purchase, sold}"} /{" "}
          {"{html, xml, pdf}"}, kèm file Excel tổng hợp đặt ngay ở thư mục khoảng ngày. Mỗi phần chỉ
          xuất khi được tick bên dưới — <b>Excel tách riêng theo chiều</b>, còn file từng hóa đơn thì
          xuất cả 2 chiều. File XML là <b>bản gốc đã ký số</b> tải trực tiếp từ Thuế điện tử. Phần
          mềm cần chút thời gian để render PDF và tải XML.
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

        <FormLabel sx={{ fontWeight: 600, fontSize: 14 }}>Bảng kê tổng hợp (Excel)</FormLabel>
        <FormGroup row sx={{ mb: 1.5, mt: 0.5 }}>
          <FormControlLabel
            control={
              <Checkbox checked={formats.excelPurchase} onChange={() => toggle("excelPurchase")} />
            }
            label="Excel hóa đơn mua vào"
          />
          <FormControlLabel
            control={<Checkbox checked={formats.excelSold} onChange={() => toggle("excelSold")} />}
            label="Excel hóa đơn bán ra"
          />
        </FormGroup>

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

        {!anySelected && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            Chưa chọn nội dung cần xuất — tick ít nhất 1 ô Excel hoặc 1 định dạng file hóa đơn.
          </Alert>
        )}
        {loadFailed && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {getErrorMessage(loadFailed.res.error, "Không kiểm tra được trạng thái đồng bộ.")}
          </Alert>
        )}
        {neededLoaded && !synced && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            Còn hóa đơn chưa tải chi tiết — {missingLines.join(", ")}. Hãy đồng bộ hoàn thành trước
            khi xuất.
          </Alert>
        )}
        {neededLoaded && synced && totalInvoices === 0 && (
          <Alert severity="info" sx={{ mt: 1 }}>
            Không có hóa đơn nào trong khoảng đã chọn
            {needed.length === 1 ? ` (chiều ${needed[0].label.toLowerCase()})` : ""}.
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
