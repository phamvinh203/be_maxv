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
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import CloseRounded from "@mui/icons-material/CloseRounded";
import FolderOpenRounded from "@mui/icons-material/FolderOpenRounded";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import ErrorOutlineRounded from "@mui/icons-material/ErrorOutlineRounded";
import RemoveCircleOutlineRounded from "@mui/icons-material/RemoveCircleOutlineRounded";
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

/** Tiến trình tải: tổng số hóa đơn + đã xử lý + số hóa đơn lỗi. */
interface TaiProgress {
  total: number;
  done: number;
  loi: number;
}

/**
 * Ba nhóm kết quả của một lượt tải — mỗi nhóm là 1 nút bấm xem danh sách:
 *  - `ok`     : tải được file, đã ghi xuống thư mục.
 *  - `loi`    : ĐÃ GỌI BE nhưng hỏng (mã sai/hết hạn, NCC lỗi, timeout) — đáng thử lại.
 *  - `boQua`  : KHÔNG gọi BE vì thiếu điều kiện tra cứu (không có URL tra cứu gốc, NCC chưa hỗ trợ
 *               tải tự động, hoặc hóa đơn chưa có mã tra cứu). Thử lại y nguyên cũng vô ích.
 */
type KetQuaNhom = "ok" | "loi" | "boQua";

/** Một dòng trong danh sách kết quả. */
interface KetQuaItem {
  key: string;
  soHd: string;
  /** Tên NCC phát hành (theo registry), rỗng thì hiện MST để còn tra được. */
  nccTen: string;
  /** Tên bên bán trên hóa đơn — để kế toán nhận ra tờ nào. */
  benTen: string;
  /** Dòng phụ hiển thị dưới số HĐ: tên file đã ghi (nhóm ok) hoặc lý do (nhóm lỗi/bỏ qua). */
  moTa: string;
}

type KetQuaTai = Record<KetQuaNhom, KetQuaItem[]>;

/**
 * Câu tóm tắt của cả lượt — DẪN XUẤT từ `ketQua` chứ không giữ state riêng, khỏi phải nhớ set/reset
 * song song hai chỗ. `total` = số HĐ thật sự gọi BE (ok + lỗi); `boQua` không tính vào vì chưa gọi.
 */
function tomTatKetQua(kq: KetQuaTai): { severity: "success" | "warning"; text: string } {
  const total = kq.ok.length + kq.loi.length;
  if (total === 0) {
    return kq.boQua.length > 0
      ? {
          severity: "warning",
          text: `Không có hóa đơn nào tải được, ${kq.boQua.length} hóa đơn bị bỏ qua.`,
        }
      : { severity: "success", text: "Không có hóa đơn nào để tải." };
  }
  return {
    severity: kq.loi.length > 0 || kq.boQua.length > 0 ? "warning" : "success",
    text: `Đã tải ${kq.ok.length}/${total} hóa đơn.`,
  };
}

/** Nhãn + màu + icon của từng nhóm, dùng chung cho nút bấm và tiêu đề danh sách. */
const NHOM_META: Record<
  KetQuaNhom,
  { nhan: string; mau: "success" | "error" | "warning"; Icon: typeof CheckCircleRounded }
> = {
  ok: { nhan: "Tải thành công", mau: "success", Icon: CheckCircleRounded },
  loi: { nhan: "Lỗi", mau: "error", Icon: ErrorOutlineRounded },
  boQua: { nhan: "Bỏ qua", mau: "warning", Icon: RemoveCircleOutlineRounded },
};

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
 * Chỉ NCC có cờ `taiTuDong` trong registry tải được; NCC khác đánh dấu "chưa hỗ trợ". Không liệt kê tên
 * NCC ở đây — danh sách đổi theo registry, chép ra là chắc chắn lỗi thời.
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
  const [ketQua, setKetQua] = useState<KetQuaTai | null>(null);
  /** Lỗi làm HỎNG CẢ LƯỢT (không đọc được chi tiết…) — khác lỗi từng hóa đơn nằm trong `ketQua.loi`. */
  const [loiCaLuot, setLoiCaLuot] = useState<string | null>(null);
  /** Nhóm đang mở danh sách; `null` = chưa bấm nút nào. */
  const [nhomDangXem, setNhomDangXem] = useState<KetQuaNhom | null>(null);

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
      setKetQua(null);
      setLoiCaLuot(null);
      setNhomDangXem(null);
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
    setProgress(null);
    setKetQua(null);
    setLoiCaLuot(null);
    setNhomDangXem(null);
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
      // `moTa` của item trong hàng đợi là TÊN FILE sẽ ghi — vào nhóm "ok" thì dùng luôn, khỏi dựng lại.
      const queue: (KetQuaItem & { msttcgp: string; code: string; sellerMst: string })[] = [];
      const boQua: KetQuaItem[] = [];

      for (const row of rows) {
        const key = invoiceKey(row.mauHd, row.soSeri, row.soHd, row.sellerMst);
        const nccMst = row.msttcgp || "";
        const ncc = nccMst ? TRA_CUU_NCC[nccMst] : undefined;
        const item = {
          key,
          soHd: row.soHd,
          nccTen: ncc?.ten.trim() || nccMst,
          benTen: isPurchase ? row.sellerTen : row.buyerTen,
        };

        // NCC phát hành không có trong registry -> KHÔNG có URL tra cứu hóa đơn gốc để mà tải.
        // Nhóm này trước đây bị loại khỏi dialog hoàn toàn nên người dùng không thấy chúng ở đâu cả.
        if (!ncc) {
          const thieu = nccMst ? `NCC phát hành ${nccMst} chưa có trong danh mục` : "hóa đơn thiếu MST NCC phát hành (msttcgp)";
          boQua.push({ ...item, moTa: `Không có URL tra cứu hóa đơn gốc — ${thieu}` });
          continue;
        }
        // NCC người dùng chủ động bỏ tick -> không tính vào nhóm nào, tránh nhiễu danh sách.
        if (!checked.has(nccMst)) continue;
        if (ncc.taiTuDong !== true) {
          boQua.push({ ...item, moTa: "NCC chưa hỗ trợ tải tự động — mở URL tra cứu để tải tay" });
          continue;
        }
        const code = maByKey.get(key) ?? "";
        if (!code) {
          boQua.push({ ...item, moTa: "Chưa có mã tra cứu — cần tải chi tiết hóa đơn trước" });
          continue;
        }
        queue.push({
          ...item,
          moTa: `${invoiceFileBase(sttOf.get(key) ?? 0, row.ngayLap, row.soHd, row.sellerMst)}.pdf`,
          msttcgp: nccMst,
          code,
          sellerMst: row.sellerMst,
        });
      }

      const total = queue.length;
      const ok: KetQuaItem[] = [];
      const loi: KetQuaItem[] = [];
      setProgress({ total, done: 0, loi: 0 });

      for (const item of queue) {
        try {
          const blob = await taiHoaDonGoc({
            msttcgp: item.msttcgp,
            code: item.code,
            sellerMst: item.sellerMst,
          });
          await writeFile(dir, item.moTa, blob);
          ok.push(item);
        } catch (e) {
          // Lỗi 1 hóa đơn (mã sai/hết hạn/NCC lỗi) không dừng cả lượt — giữ message để xem ở nhóm "Lỗi".
          loi.push({ ...item, moTa: getErrorMessage(e, "Không tải được hóa đơn này.") });
        }
        setProgress({ total, done: ok.length + loi.length, loi: loi.length });
      }

      setKetQua({ ok, loi, boQua });
    } catch (e) {
      setLoiCaLuot(getErrorMessage(e, "Không tải được hóa đơn gốc."));
    } finally {
      setDownloading(false);
    }
  };

  const tomTat = ketQua ? tomTatKetQua(ketQua) : null;
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
                    (progress.loi > 0 ? ` (${progress.loi} lỗi)` : "") +
                    "…"
                  : "Đang đọc chi tiết hóa đơn…"}
              </Typography>
            </Stack>
          ) : loiCaLuot ? (
            <Alert severity="error" sx={{ py: 0.5 }}>
              {loiCaLuot}
            </Alert>
          ) : ketQua && tomTat ? (
            <Stack spacing={1.5}>
              <Alert severity={tomTat.severity} sx={{ py: 0.5 }}>
                {tomTat.text}
              </Alert>

              {/* 3 nhóm kết quả — bấm để mở/đóng danh sách hóa đơn của nhóm đó. */}
              <ToggleButtonGroup
                size="small"
                exclusive
                value={nhomDangXem}
                onChange={(_, v: KetQuaNhom | null) => setNhomDangXem(v)}
                sx={{ flexWrap: "wrap" }}
              >
                {(Object.keys(NHOM_META) as KetQuaNhom[]).map((nhom) => {
                  const { nhan, mau, Icon } = NHOM_META[nhom];
                  const soLuong = ketQua[nhom].length;
                  return (
                    <ToggleButton
                      key={nhom}
                      value={nhom}
                      color={mau}
                      disabled={soLuong === 0}
                      sx={{ textTransform: "none", gap: 0.75, px: 1.5 }}
                    >
                      <Icon fontSize="small" color={soLuong ? mau : "disabled"} />
                      {nhan} <b>{soLuong}</b>
                    </ToggleButton>
                  );
                })}
              </ToggleButtonGroup>

              {nhomDangXem && (
                <Box
                  sx={{
                    maxHeight: 200,
                    overflowY: "auto",
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                  }}
                >
                  {ketQua[nhomDangXem].map((item) => (
                    <Box
                      key={item.key}
                      sx={{
                        px: 1.5,
                        py: 0.75,
                        borderBottom: 1,
                        borderColor: "divider",
                        "&:last-of-type": { borderBottom: 0 },
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        HĐ {item.soHd || "(không số)"}
                        <Typography component="span" variant="body2" color="text.secondary">
                          {" "}
                          — {item.benTen || "(không rõ tên)"}
                          {item.nccTen ? ` · ${item.nccTen}` : ""}
                        </Typography>
                      </Typography>
                      <Typography
                        variant="caption"
                        color={nhomDangXem === "ok" ? "text.secondary" : `${NHOM_META[nhomDangXem].mau}.main`}
                        sx={{ wordBreak: "break-word" }}
                      >
                        {item.moTa}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Stack>
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
          // KHÔNG chặn khi chưa tick NCC nào: hóa đơn của NCC ngoài registry không hề xuất hiện trong
          // danh sách tick, nên chặn ở đây thì lượt chỉ toàn HĐ loại đó sẽ không bao giờ xem được
          // nhóm "Bỏ qua" (lý do: không có URL tra cứu gốc).
          disabled={!dir || totalInvoices === 0 || downloading}
          sx={{ textTransform: "none" }}
        >
          Tải xuống
        </Button>
      </DialogActions>
    </Dialog>
  );
}
