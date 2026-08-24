import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CloseRounded from "@mui/icons-material/CloseRounded";
import DeleteOutlineRounded from "@mui/icons-material/DeleteOutlineRounded";
import DeleteSweepRounded from "@mui/icons-material/DeleteSweepRounded";
import ReplayRounded from "@mui/icons-material/ReplayRounded";
import SyncRounded from "@mui/icons-material/SyncRounded";
import { toast } from "react-toastify";

import { TAB_DVC } from "../config";
import { currentMonthRange, formatDateVN, formatDateTimeVN } from "../../hddt/dateUtils";
import {
  dongBoDvc,
  layLichSuDongBoDvc,
  xoaLichSuDongBoDvc,
  xoaTatCaLichSuDongBoDvc,
  type DvcDongBoLog,
} from "../api/dvc";
import { getErrorMessage } from "../../../lib/errors";

/** Loại giấy tờ DUY NHẤT đã có backend đồng bộ thật — hai tab còn lại (Tờ khai Thuế điện tử, Giấy
 * nộp tiền) chưa có tích hợp cổng nào phía sau, giữ trong danh sách nhưng khóa lại. */
const LOAI_DA_HO_TRO = "to-khai-dvc";

/**
 * Tiêu đề bảng lịch sử kèm cách căn — gắn `align` NGAY TẠI cột thay vì suy từ so khớp chuỗi
 * nhãn ở nơi render: đổi câu chữ một cột (vd "Thao tác" -> "Hành động") trước đây sẽ âm thầm
 * làm cột đó rớt về căn trái vì so khớp chuỗi trật, giờ đổi nhãn không đụng gì tới canh lề.
 */
const COT_LICH_SU: { label: string; align: "left" | "center" }[] = [
  { label: "STT", align: "center" },
  { label: "Từ ngày", align: "left" },
  { label: "Đến ngày", align: "left" },
  { label: "Số lượng đồng bộ", align: "left" },
  { label: "Trạng thái", align: "left" },
  { label: "Diễn giải", align: "left" },
  { label: "Ngày đồng bộ", align: "left" },
  { label: "Thao tác", align: "center" },
];

/** Nhãn loại giấy tờ cho cột "Diễn giải"/tooltip — loại lạ thì trả nguyên mã. */
function nhanLoai(loai: string): string {
  return TAB_DVC.find((muc) => muc.value === loai)?.label ?? loai;
}

const QUERY_KEY_LICH_SU = ["dvc", "dong-bo", "lich-su"];

interface Props {
  open: boolean;
  onClose: () => void;
  /** Khóa phiên cổng DVC đã đăng nhập — `null` = chưa đăng nhập, nút "Đồng bộ" báo cần đăng nhập
   * trước (đồng bộ vẫn gọi cổng thật, khác nút "Tìm kiếm" chính đã đọc thẳng DB). */
  dvcKey: string | null;
  /** Báo lên `DvcPage` khi lượt đồng bộ hỏng, để nơi đó bỏ khóa phiên nếu BE nói phiên chết hẳn —
   * xem `boKhoaNeuPhienChet`. Dialog không tự giữ khóa nên không tự bỏ được. */
  onPhienChet?: (err: unknown) => void;
}

/**
 * Dialog "Đồng bộ dữ liệu thuế điện tử" — chọn loại giấy tờ + khoảng ngày để kéo hồ sơ từ cổng
 * Dịch vụ công về lưu lại, kèm bảng lịch sử các lượt đã chạy.
 *
 * Tách hẳn khỏi ô tìm kiếm ở `DvcPage`: tìm kiếm đọc thẳng dữ liệu đã lưu (nhanh, không cần đăng
 * nhập cổng), còn đồng bộ mới là lượt gọi cổng thật — gộp chung thì mỗi lần lọc lại phải chờ cổng.
 */
export default function DialogDongBo({ open, onClose, dvcKey, onPhienChet }: Props) {
  const [loai, setLoai] = useState(TAB_DVC[0]!.value);
  const [range, setRange] = useState(currentMonthRange);
  const [loiForm, setLoiForm] = useState("");
  /** Dòng lịch sử đang chờ xác nhận xóa (null = không mở dialog xác nhận). */
  const [dongChoXoa, setDongChoXoa] = useState<DvcDongBoLog | null>(null);
  /** Đang chờ xác nhận "Xóa tất cả" (dialog riêng, không dùng chung state với xóa 1 dòng). */
  const [choXoaTatCa, setChoXoaTatCa] = useState(false);

  const queryClient = useQueryClient();

  // `enabled: open` — dialog đóng thì khỏi fetch, mở lại luôn thấy lịch sử mới nhất.
  const lichSuQuery = useQuery({
    queryKey: QUERY_KEY_LICH_SU,
    queryFn: layLichSuDongBoDvc,
    enabled: open,
  });
  const lichSu = lichSuQuery.data ?? [];
  const dangTaiLichSu = lichSuQuery.isLoading;

  const lamMoiLichSu = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY_LICH_SU });

  const dongBoMutation = useMutation({
    mutationFn: (vars: { tuNgay: string; denNgay: string }) =>
      dongBoDvc({ key: dvcKey!, tuNgay: vars.tuNgay, denNgay: vars.denNgay }),
    onSuccess: (log) => {
      void lamMoiLichSu();
      toast.success(
        log.trang_thai === "done"
          ? `Đồng bộ xong: ${log.dong_bo_xong} hồ sơ mới, ${log.da_co_san} đã có sẵn.`
          : `Đồng bộ xong nhưng còn ${log.loi} hồ sơ lỗi — sẽ tự bù ở lượt sau.`,
      );
    },
    onError: (err) => {
      onPhienChet?.(err);
      toast.error(getErrorMessage(err, "Đồng bộ dữ liệu Dịch vụ công thất bại."));
    },
  });

  const xoaMutation = useMutation({
    mutationFn: (id: string) => xoaLichSuDongBoDvc(id),
    onSuccess: () => {
      void lamMoiLichSu();
      toast.success("Đã xóa dòng lịch sử đồng bộ.");
    },
    onError: (err) => toast.error(getErrorMessage(err, "Xóa dòng lịch sử đồng bộ thất bại.")),
  });

  const xoaTatCaMutation = useMutation({
    mutationFn: xoaTatCaLichSuDongBoDvc,
    onSuccess: (res) => {
      void lamMoiLichSu();
      toast.success(`Đã xóa ${res.deleted} dòng lịch sử đồng bộ.`);
    },
    onError: (err) => toast.error(getErrorMessage(err, "Xóa lịch sử đồng bộ thất bại.")),
  });

  const datRange = (key: "tuNgay" | "denNgay", value: string) => {
    setLoiForm("");
    setRange((prev) => ({ ...prev, [key]: value }));
  };

  const handleDongBo = () => {
    setLoiForm("");
    if (!range.tuNgay || !range.denNgay) {
      setLoiForm("Vui lòng chọn đủ Từ ngày / Đến ngày.");
      return;
    }
    if (range.tuNgay > range.denNgay) {
      setLoiForm("Từ ngày phải trước hoặc bằng Đến ngày.");
      return;
    }
    if (loai !== LOAI_DA_HO_TRO) {
      setLoiForm("Loại giấy tờ này chưa hỗ trợ đồng bộ.");
      return;
    }
    if (!dvcKey) {
      setLoiForm('Chưa có phiên cổng Dịch vụ công — bấm "Đăng nhập cổng Dịch vụ công" trước.');
      return;
    }
    dongBoMutation.mutate({ tuNgay: range.tuNgay, denNgay: range.denNgay });
  };

  /**
   * "Đồng bộ lại": chỉ nạp loại + khoảng ngày của dòng đó lên form, KHÔNG tự chạy — chạy lại một
   * lượt là gọi cổng thật hàng loạt, nên để người dùng xem lại điều kiện rồi tự bấm.
   */
  const handleDongBoLai = (row: DvcDongBoLog) => {
    setLoiForm("");
    setLoai(row.loai);
    setRange({ tuNgay: row.tu_ngay.slice(0, 10), denNgay: row.den_ngay.slice(0, 10) });
  };

  const handleXoa = () => {
    if (!dongChoXoa) return;
    xoaMutation.mutate(dongChoXoa.id);
    setDongChoXoa(null);
  };

  const handleXoaTatCa = () => {
    xoaTatCaMutation.mutate();
    setChoXoaTatCa(false);
  };

  const dangDongBo = dongBoMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" scroll="paper">
      <DialogTitle
        sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}
      >
        Đồng bộ dữ liệu thuế điện tử
        <IconButton size="small" onClick={onClose} aria-label="Đóng">
          <CloseRounded fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Kéo hồ sơ từ cổng Dịch vụ công về lưu lại, sau đó tìm kiếm ở ngoài đọc thẳng dữ liệu đã
          lưu nên không phải đăng nhập lại từng lượt.
        </Typography>

        {loiForm && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setLoiForm("")}>
            {loiForm}
          </Alert>
        )}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
          <TextField
            select
            fullWidth
            size="small"
            label="Loại giấy tờ"
            value={loai}
            onChange={(e) => setLoai(e.target.value)}
          >
            {TAB_DVC.map((muc) => (
              <MenuItem key={muc.value} value={muc.value} disabled={muc.value !== LOAI_DA_HO_TRO}>
                {muc.label}
                {muc.value !== LOAI_DA_HO_TRO ? " (chưa hỗ trợ)" : ""}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            type="date"
            fullWidth
            size="small"
            label="Từ ngày"
            slotProps={{ inputLabel: { shrink: true } }}
            value={range.tuNgay}
            onChange={(e) => datRange("tuNgay", e.target.value)}
          />
          <TextField
            type="date"
            fullWidth
            size="small"
            label="Đến ngày"
            slotProps={{ inputLabel: { shrink: true } }}
            value={range.denNgay}
            onChange={(e) => datRange("denNgay", e.target.value)}
          />
        </Stack>

        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}
        >
          <Typography sx={{ fontWeight: 700 }}>Lịch sử đồng bộ</Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            {dangTaiLichSu && <CircularProgress size={16} />}
            <Tooltip title="Xóa tất cả lịch sử đồng bộ">
              <span>
                <IconButton
                  size="small"
                  color="error"
                  aria-label="Xóa tất cả lịch sử đồng bộ"
                  disabled={lichSu.length === 0}
                  onClick={() => setChoXoaTatCa(true)}
                >
                  <DeleteSweepRounded fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        <TableContainer sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
          <Table size="small" sx={{ "& td, & th": { whiteSpace: "nowrap" } }}>
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "action.hover" } }}>
                {COT_LICH_SU.map((cot) => (
                  <TableCell key={cot.label} align={cot.align}>
                    {cot.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {lichSu.length > 0 ? (
                lichSu.map((row, i) => (
                  <TableRow key={row.id} hover>
                    <TableCell align="center">{i + 1}</TableCell>
                    <TableCell>{formatDateVN(row.tu_ngay)}</TableCell>
                    <TableCell>{formatDateVN(row.den_ngay)}</TableCell>
                    <TableCell>
                      {/* Ghi "mới/tổng" như bảng lịch sử hóa đơn; phần đã có sẵn và phần lỗi để
                          trong tooltip cho khỏi chật cột. */}
                      <Tooltip
                        title={`Đã có sẵn: ${row.da_co_san} — Lỗi: ${row.loi} — Tổng cổng trả: ${row.tong_ho_so}`}
                      >
                        <span>
                          {row.dong_bo_xong}/{row.tong_ho_so}
                        </span>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      {row.trang_thai === "done" ? (
                        <Chip size="small" color="success" variant="outlined" label="Hoàn thành" />
                      ) : (
                        <Tooltip title={row.dien_giai ?? "Còn hồ sơ chưa lấy xong"}>
                          <Chip
                            size="small"
                            color="warning"
                            variant="outlined"
                            label="Chưa hoàn thành"
                          />
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "normal", minWidth: 220 }}>
                      {row.dien_giai ?? `Đồng bộ ${nhanLoai(row.loai)}`}
                    </TableCell>
                    <TableCell>{formatDateTimeVN(row.created_at)}</TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} sx={{ justifyContent: "center" }}>
                        <Tooltip title="Nạp lại điều kiện của lượt này lên form">
                          <IconButton
                            size="small"
                            aria-label="Đồng bộ lại khoảng ngày này"
                            onClick={() => handleDongBoLai(row)}
                          >
                            <ReplayRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Xóa dòng lịch sử này">
                          <IconButton
                            size="small"
                            color="error"
                            aria-label="Xóa dòng lịch sử đồng bộ"
                            onClick={() => setDongChoXoa(row)}
                          >
                            <DeleteOutlineRounded fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={COT_LICH_SU.length}
                    sx={{ border: 0, py: 5, textAlign: "center", color: "text.disabled" }}
                  >
                    {dangTaiLichSu ? "Đang tải…" : "Chưa có lượt đồng bộ nào."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>

      <Divider />
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button color="inherit" onClick={onClose} sx={{ textTransform: "none" }}>
          Đóng
        </Button>
        <Button
          variant="contained"
          startIcon={dangDongBo ? undefined : <SyncRounded />}
          onClick={handleDongBo}
          disabled={dangDongBo}
          sx={{ textTransform: "none" }}
        >
          {dangDongBo ? <CircularProgress size={20} color="inherit" /> : "Đồng bộ"}
        </Button>
      </DialogActions>

      {/* Xác nhận xóa 1 dòng lịch sử */}
      <Dialog open={!!dongChoXoa} onClose={() => setDongChoXoa(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Xóa dòng lịch sử đồng bộ</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {dongChoXoa && (
              <>
                Xóa dòng lịch sử đồng bộ {nhanLoai(dongChoXoa.loai).toLowerCase()} từ{" "}
                {formatDateVN(dongChoXoa.tu_ngay)} đến {formatDateVN(dongChoXoa.den_ngay)} khỏi danh
                sách?{" "}
              </>
            )}
            Chỉ xóa bản ghi lịch sử này, KHÔNG ảnh hưởng đến hồ sơ đã lưu trong cơ sở dữ liệu.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDongChoXoa(null)} sx={{ textTransform: "none" }}>
            Hủy
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleXoa}
            sx={{ textTransform: "none" }}
          >
            Xóa
          </Button>
        </DialogActions>
      </Dialog>

      {/* Xác nhận xóa TẤT CẢ lịch sử */}
      <Dialog open={choXoaTatCa} onClose={() => setChoXoaTatCa(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Xóa tất cả lịch sử đồng bộ</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Xóa toàn bộ {lichSu.length} dòng lịch sử đồng bộ? Chỉ xóa bản ghi lịch sử, KHÔNG ảnh
            hưởng đến hồ sơ đã lưu trong cơ sở dữ liệu.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setChoXoaTatCa(false)} sx={{ textTransform: "none" }}>
            Hủy
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleXoaTatCa}
            sx={{ textTransform: "none" }}
          >
            Xóa tất cả
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
