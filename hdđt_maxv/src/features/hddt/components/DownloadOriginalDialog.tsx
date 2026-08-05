import { useEffect, useMemo, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import LinearProgress from "@mui/material/LinearProgress";
import CloseRounded from "@mui/icons-material/CloseRounded";
import FolderOpenRounded from "@mui/icons-material/FolderOpenRounded";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import {
  supportsDirectoryPicker,
  pickDirectory,
  writeFile,
  type FsDirHandle,
} from "../../../lib/fileSystemAccess";
import { getErrorMessage } from "../../../lib/errors";
import { TRA_CUU_NCC, traCuuNcc, rowStr } from "../traCuuNcc";
import { invoiceFileBase, invoiceKey, invoiceSttMap } from "../invoiceFileName";
import { getSavedDetails } from "../api/invoiceDetail";
import { taiHoaDonGoc } from "../api/traCuuGoc";
import type { DisplayRow, InvoiceDirection } from "../types";

/**
 * NCC đã có bộ tải TỰ ĐỘNG ở BE — đọc cờ `taiTuDong` trong registry `TRA_CUU_NCC` (nguồn DUY NHẤT,
 * khỏi giữ danh sách MST song song). Thêm NCC = bật cờ ở registry (FE) + đăng ký bộ tải (BE).
 */
function nccHoTroTai(msttcgp: string): boolean {
  return TRA_CUU_NCC[msttcgp]?.taiTuDong === true;
}

/** Tiến trình tải: tổng số hóa đơn + đã xử lý + số hóa đơn tải OK (số lỗi = done − ok). */
interface TaiProgress {
  total: number;
  done: number;
  ok: number;
}

/** Kết quả tóm tắt sau khi tải xong (hoặc lỗi cả lượt). */
interface TaiSummary {
  severity: "success" | "warning" | "error";
  text: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  direction: InvoiceDirection;
  rows: DisplayRow[];
  /** Khoảng ngày đang lọc ở tab — định nghĩa "tháng đó" cho danh sách nhà cung cấp. */
  range: { tuNgay: string; denNgay: string };
}

interface Supplier {
  key: string;
  mst: string;
  ten: string;
  count: number;
}

/**
 * Dialog "Tải hóa đơn gốc": tải file PDF gốc của các hóa đơn trong khoảng đang lọc theo từng nhà
 * cung cấp. Mỗi chiều (mua vào/bán ra) có 1 instance riêng — "nhà cung cấp" ở đây là bên đối tác
 * phát sinh hóa đơn (mua vào -> người bán; bán ra -> người mua).
 *
 * LUỒNG TẢI: lấy chi tiết đã lưu của khoảng (`getSavedDetails`) -> rút mã tra cứu từng HĐ
 * (`traCuuNcc(detail).maTraCuu`) -> gọi BE proxy `taiHoaDonGoc` tải PDF -> ghi vào thư mục đã chọn.
 * Chỉ NCC có cờ `taiTuDong` trong registry (hiện MISA) tải được; NCC khác đánh dấu "chưa hỗ trợ".
 */
export default function DownloadOriginalDialog({
  open,
  onClose,
  direction,
  rows,
  range,
}: Props) {
  const canPick = supportsDirectoryPicker();
  const [dir, setDir] = useState<FsDirHandle | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<TaiProgress | null>(null);
  const [summary, setSummary] = useState<TaiSummary | null>(null);

  const isPurchase = direction === "purchase";

  // CHỈ lấy NCC phát hành CÓ trong registry `TRA_CUU_NCC` (Viettel, MISA, VETC, VININVOICE, FPT).
  // Mỗi hóa đơn mang `msttcgp` = MST của NCC phát hành — gom theo khóa này, bỏ qua HĐ của NCC chưa
  // có trong registry (không có link/ cách tra cứu gốc). Tên NCC lấy từ registry, không lấy từ HĐ.
  const suppliers = useMemo<Supplier[]>(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const mst = r.msttcgp || "";
      if (!mst || !TRA_CUU_NCC[mst]) continue;
      counts.set(mst, (counts.get(mst) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([mst, count]) => ({
      key: mst,
      mst,
      ten: TRA_CUU_NCC[mst].ten.trim(),
      count,
    }));
  }, [rows]);

  // Mở dialog -> đánh dấu chọn tất cả NCC (mặc định tải cả tháng) & đặt lại trạng thái tiến trình.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChecked(new Set(suppliers.map((s) => s.key)));
      setDownloading(false);
      setProgress(null);
      setSummary(null);
    }
  }, [open, suppliers]);

  const allChecked = suppliers.length > 0 && checked.size === suppliers.length;
  const someChecked = checked.size > 0 && !allChecked;

  const toggleAll = () => {
    setChecked(allChecked ? new Set() : new Set(suppliers.map((s) => s.key)));
  };
  const toggleOne = (key: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handlePickDir = async () => {
    try {
      const d = await pickDirectory();
      if (d) setDir(d);
    } catch {
      // UI-only: bỏ qua lỗi chọn thư mục cho đến khi wire logic.
    }
  };

  /**
   * Tải file PDF gốc của các hóa đơn thuộc NCC đã tick VÀ có bộ tải (MISA) trong khoảng lọc,
   * lưu vào `dir`. Mã tra cứu từng HĐ lấy từ CHI TIẾT đã lưu (`getSavedDetails` -> `traCuuNcc`), nối
   * với `rows` theo khóa định danh hóa đơn để lấy STT + đặt tên file thống nhất với luồng xuất.
   */
  const handleDownload = async () => {
    if (!dir) return;
    setDownloading(true);
    setSummary(null);
    setProgress(null);
    try {
      // Chi tiết đã lưu của cả khoảng — nơi duy nhất có `cttkhac` để rút mã tra cứu (chưa tải chi
      // tiết -> không có mã -> đếm vào `thieuMa`).
      const details = await getSavedDetails(direction, {
        tuNgay: range.tuNgay,
        denNgay: range.denNgay,
      });
      const maByKey = new Map<string, string>();
      for (const d of details) {
        const r = traCuuNcc(d);
        if (!r?.maTraCuu) continue;
        maByKey.set(
          invoiceKey(rowStr(d.khmshdon), rowStr(d.khhdon), rowStr(d.shdon), rowStr(d.nbmst)),
          r.maTraCuu,
        );
      }

      const sttOf = invoiceSttMap(rows);
      // Hàng đợi tải: chỉ HĐ thuộc NCC đã tick + có bộ tải + có mã tra cứu.
      // `sellerMst` (nbmst) đi kèm vì NCC như Viettel cần nó làm `supplierTaxCode`; MISA bỏ qua.
      const queue: { msttcgp: string; code: string; sellerMst: string; base: string }[] = [];
      let thieuMa = 0; // đã tick + hỗ trợ nhưng chưa có mã (chưa tải chi tiết)
      for (const row of rows) {
        if (!checked.has(row.msttcgp) || !nccHoTroTai(row.msttcgp)) continue;
        const key = invoiceKey(row.mauHd, row.soSeri, row.soHd, row.sellerMst);
        const code = maByKey.get(key) ?? "";
        if (!code) {
          thieuMa += 1;
          continue;
        }
        queue.push({
          msttcgp: row.msttcgp,
          code,
          sellerMst: row.sellerMst,
          base: invoiceFileBase(sttOf.get(key) ?? 0, row.ngayLap, row.soHd, row.sellerMst),
        });
      }

      // NCC đã tick nhưng chưa có bộ tải -> báo để người dùng khỏi tưởng bị bỏ sót.
      const nccChuaHoTro = suppliers.filter((s) => checked.has(s.key) && !nccHoTroTai(s.key));

      const total = queue.length;
      let done = 0;
      let ok = 0;
      setProgress({ total, done, ok });

      for (const item of queue) {
        try {
          const blob = await taiHoaDonGoc({
            msttcgp: item.msttcgp,
            code: item.code,
            sellerMst: item.sellerMst,
          });
          await writeFile(dir, `${item.base}.pdf`, blob);
          ok += 1;
        } catch {
          // Lỗi 1 hóa đơn (mã sai/hết hạn/NCC lỗi) không dừng cả lượt — số lỗi suy ra ở phần tóm tắt.
        }
        done += 1;
        setProgress({ total, done, ok });
      }

      // Dựng câu tóm tắt: kết quả tải + phần thiếu mã + phần NCC chưa hỗ trợ.
      const notes: string[] = [];
      if (thieuMa > 0) notes.push(`${thieuMa} HĐ chưa có mã tra cứu (tải chi tiết trước)`);
      if (nccChuaHoTro.length > 0) {
        notes.push(`${nccChuaHoTro.length} NCC khác chưa hỗ trợ tải tự động`);
      }
      const noteText = notes.length ? ` ${notes.join("; ")}.` : "";

      if (total === 0) {
        setSummary({
          severity: nccChuaHoTro.length || thieuMa ? "warning" : "success",
          text: `Không có hóa đơn nào để tải.${noteText}`,
        });
      } else {
        const err = total - ok;
        setSummary({
          severity: err > 0 ? "warning" : "success",
          text: `Đã tải ${ok}/${total} hóa đơn` + (err > 0 ? `, ${err} lỗi.` : ".") + noteText,
        });
      }
    } catch (e) {
      setSummary({ severity: "error", text: getErrorMessage(e, "Không tải được hóa đơn gốc.") });
    } finally {
      setDownloading(false);
    }
  };

  const totalInvoices = rows.length;
  const selectedInvoiceCount = suppliers
    .filter((s) => checked.has(s.key))
    .reduce((sum, s) => sum + s.count, 0);

  return (
    <Dialog open={open} onClose={downloading ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: 1 }}>
        Tải hóa đơn gốc
        <IconButton size="small" onClick={onClose} disabled={downloading} aria-label="Đóng">
          <CloseRounded fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 2 }}>
          Tải file hóa đơn gốc của chiều <b>{isPurchase ? "mua vào" : "bán ra"}</b> trong khoảng{" "}
          <b>{range.tuNgay}</b> – <b>{range.denNgay}</b>. Chọn nhà cung cấp và thư mục lưu bên dưới.
        </Alert>

        {!canPick && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Trình duyệt hiện tại không hỗ trợ chọn thư mục để lưu. Vui lòng dùng Chrome hoặc Edge.
          </Alert>
        )}

        {/* Tổng danh sách có hóa đơn gốc */}
        <Box
          sx={{
            mb: 2,
            p: 1.5,
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            bgcolor: "action.hover",
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Tổng danh sách có hóa đơn gốc
          </Typography>
          <Stack direction="row" spacing={3} sx={{ mt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Tổng số hóa đơn: <b>{totalInvoices}</b>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Số NCC phát hành: <b>{suppliers.length}</b>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Đã chọn: <b>{selectedInvoiceCount}</b> hóa đơn
            </Typography>
          </Stack>
        </Box>

        {/* Danh sách nhà cung cấp có trong tháng đó */}
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
          Danh sách nhà cung cấp hóa đơn có trong tháng
        </Typography>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={allChecked}
              indeterminate={someChecked}
              onChange={toggleAll}
            />
          }
          label="Chọn tất cả"
          sx={{ mb: 0.5 }}
        />
        <Box
          sx={{
            mb: 2,
            maxHeight: 220,
            overflowY: "auto",
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
          }}
        >
          {suppliers.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>
              Không có hóa đơn nào thuộc NCC đã đăng ký (TRA_CUU_NCC) trong khoảng đã chọn.
            </Typography>
          ) : (
            suppliers.map((s) => (
              <FormControlLabel
                key={s.key}
                sx={{
                  mx: 0,
                  px: 1.5,
                  width: "100%",
                  "&:hover": { bgcolor: "action.hover" },
                }}
                control={
                  <Checkbox
                    size="small"
                    checked={checked.has(s.key)}
                    onChange={() => toggleOne(s.key)}
                  />
                }
                label={
                  <Typography variant="body2" component="span" noWrap>
                    {s.ten || "(không rõ tên)"}{" "}
                    <Typography component="span" variant="body2" color="text.secondary">
                      ({s.count} hóa đơn)
                    </Typography>
                    {!nccHoTroTai(s.key) && (
                      <Typography component="span" variant="body2" color="warning.main">
                        {" "}
                        — chưa hỗ trợ tải
                      </Typography>
                    )}
                  </Typography>
                }
              />
            ))
          )}
        </Box>

        {/* Thư mục lưu */}
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
          Thư mục lưu
        </Typography>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 2 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<FolderOpenRounded />}
            onClick={handlePickDir}
            disabled={!canPick || downloading}
            sx={{ textTransform: "none", whiteSpace: "nowrap" }}
          >
            Chọn thư mục lưu
          </Button>
          <Typography
            variant="body2"
            sx={{ color: dir ? "text.primary" : "text.secondary", wordBreak: "break-all" }}
          >
            {dir ? dir.name : "Chưa chọn thư mục"}
          </Typography>
        </Stack>

        {/* Tiến trình tải hóa đơn */}
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
          Tiến trình tải hóa đơn
        </Typography>
        <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}>
          {downloading ? (
            <Stack spacing={1}>
              <LinearProgress
                variant={progress && progress.total > 0 ? "determinate" : "indeterminate"}
                value={
                  progress && progress.total > 0 ? (progress.done / progress.total) * 100 : undefined
                }
              />
              <Typography variant="body2" color="text.secondary">
                {progress && progress.total > 0
                  ? `Đang tải ${progress.done}/${progress.total} hóa đơn` +
                    (progress.done - progress.ok > 0 ? ` (${progress.done - progress.ok} lỗi)` : "") +
                    "…"
                  : "Đang đọc chi tiết hóa đơn…"}
              </Typography>
            </Stack>
          ) : summary ? (
            <Alert severity={summary.severity} sx={{ py: 0.5 }}>
              {summary.text}
            </Alert>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Chưa bắt đầu tải. Nhấn “Tải xuống” để bắt đầu.
            </Typography>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={downloading} sx={{ textTransform: "none" }}>
          Hủy
        </Button>
        <Button
          variant="contained"
          startIcon={<FileDownloadRounded />}
          onClick={handleDownload}
          disabled={!dir || checked.size === 0 || totalInvoices === 0 || downloading}
          sx={{ textTransform: "none" }}
        >
          Tải xuống
        </Button>
      </DialogActions>
    </Dialog>
  );
}
