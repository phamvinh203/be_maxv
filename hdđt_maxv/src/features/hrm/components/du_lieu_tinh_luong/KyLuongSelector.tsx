import { useState } from "react";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Alert from "@mui/material/Alert";
import AddRounded from "@mui/icons-material/AddRounded";
import LockRounded from "@mui/icons-material/LockRounded";
import LockOpenRounded from "@mui/icons-material/LockOpenRounded";
import SendRounded from "@mui/icons-material/SendRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import UndoRounded from "@mui/icons-material/UndoRounded";
import { toast } from "react-toastify";
import { getApiError } from "@/lib/apiClient";
import { useCurrentPayrollPeriod } from "./useCurrentPayrollPeriod";
import {
  useApprovePayrollPeriod,
  useCreatePayrollPeriod,
  useLockPayrollPeriod,
  useRejectPayrollPeriod,
  useReopenPayrollPeriod,
  useSubmitPayrollPeriod,
} from "../../api/du_lieu_tinh_luong/payrollPeriodsQueries";

export default function KyLuongSelector() {
  const {
    selectedPeriodId,
    setSelectedPeriodId,
    selectedPeriod,
    periods,
    isLocked,
  } = useCurrentPayrollPeriod();

  const [moTaoKy, setMoTaoKy] = useState(false);
  const [moMoLai, setMoMoLai] = useState(false);
  const [lyDoMoLai, setLyDoMoLai] = useState("");

  const now = new Date();
  const [thangMoi, setThangMoi] = useState(now.getMonth() + 1);
  const [namMoi, setNamMoi] = useState(now.getFullYear());
  const [tenMoi, setTenMoi] = useState(
    `Kỳ lương tháng ${now.getMonth() + 1}/${now.getFullYear()}`,
  );

  const taoKyMut = useCreatePayrollPeriod();
  const submitMut = useSubmitPayrollPeriod();
  const lockMut = useLockPayrollPeriod();
  const rejectMut = useRejectPayrollPeriod();
  const reopenMut = useReopenPayrollPeriod();
  const approveMut = useApprovePayrollPeriod();

  const handleTaoKy = async () => {
    try {
      const res = await taoKyMut.mutateAsync({
        month: thangMoi,
        year: namMoi,
        name: tenMoi.trim() || `Kỳ lương tháng ${thangMoi}/${namMoi}`,
      });
      toast.success("Tạo kỳ lương thành công.");
      setSelectedPeriodId(res.id);
      setMoTaoKy(false);
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const handleKhoaSo = async () => {
    if (!selectedPeriodId) return;
    try {
      await lockMut.mutateAsync(selectedPeriodId);
      toast.success("Đã khóa sổ kỳ lương.");
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const handleTrinhDuyet = async () => {
    if (!selectedPeriodId) return;
    try {
      await submitMut.mutateAsync(selectedPeriodId);
      toast.success("Đã trình duyệt kỳ lương.");
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const handleTuChoi = async () => {
    if (!selectedPeriodId) return;
    try {
      await rejectMut.mutateAsync(selectedPeriodId);
      toast.success("Đã từ chối, trả kỳ lương về bản nháp.");
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const handleDuyet = async () => {
    if (!selectedPeriodId) return;
    try {
      await approveMut.mutateAsync(selectedPeriodId);
      toast.success("Đã duyệt kỳ lương.");
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const handleMoLai = async () => {
    if (!selectedPeriodId) return;
    if (lyDoMoLai.trim().length < 20) {
      toast.error("Lý do mở lại phải từ 20 ký tự trở lên (BR-dltl-001).");
      return;
    }
    try {
      await reopenMut.mutateAsync({
        id: selectedPeriodId,
        body: { reason: lyDoMoLai.trim() },
      });
      toast.success("Đã mở lại kỳ lương về bản nháp.");
      setMoMoLai(false);
      setLyDoMoLai("");
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const statusChip = () => {
    if (!selectedPeriod) return null;
    switch (selectedPeriod.status) {
      case "DRAFT":
        return <Chip label="Bản nháp" size="small" color="default" />;
      case "PENDING_REVIEW":
        return <Chip label="Chờ duyệt" size="small" color="info" />;
      case "LOCKED":
        return <Chip label="Đã khóa sổ" size="small" color="warning" icon={<LockRounded />} />;
      case "APPROVED":
        return <Chip label="Đã duyệt" size="small" color="success" icon={<CheckCircleRounded />} />;
      case "PAID":
        return <Chip label="Đã chi trả" size="small" color="success" />;
      case "ARCHIVED":
        return <Chip label="Lưu trữ" size="small" />;
      default:
        return null;
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ alignItems: { md: "center" }, justifyContent: "space-between" }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap", gap: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
            Kỳ lương:
          </Typography>

          <TextField
            select
            size="small"
            value={selectedPeriodId ?? ""}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            sx={{ minWidth: 260 }}
          >
            {periods.length === 0 ? (
              <MenuItem value="" disabled>
                (Chưa có kỳ lương nào)
              </MenuItem>
            ) : (
              periods.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name} (T{p.month}/{p.year})
                </MenuItem>
              ))
            )}
          </TextField>

          {statusChip()}

          <Button
            size="small"
            variant="outlined"
            startIcon={<AddRounded />}
            onClick={() => setMoTaoKy(true)}
            sx={{ textTransform: "none" }}
          >
            Tạo kỳ mới
          </Button>
        </Stack>

        {selectedPeriod && (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            {selectedPeriod.status === "DRAFT" && (
              <>
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  startIcon={<LockRounded />}
                  onClick={handleKhoaSo}
                  disabled={lockMut.isPending}
                  sx={{ textTransform: "none" }}
                >
                  Khóa sổ
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  startIcon={<SendRounded />}
                  onClick={handleTrinhDuyet}
                  disabled={submitMut.isPending}
                  sx={{ textTransform: "none" }}
                >
                  Trình duyệt
                </Button>
              </>
            )}

            {selectedPeriod.status === "PENDING_REVIEW" && (
              <>
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  startIcon={<UndoRounded />}
                  onClick={handleTuChoi}
                  disabled={rejectMut.isPending}
                  sx={{ textTransform: "none" }}
                >
                  Từ chối
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  color="warning"
                  startIcon={<LockRounded />}
                  onClick={handleKhoaSo}
                  disabled={lockMut.isPending}
                  sx={{ textTransform: "none" }}
                >
                  Khóa sổ
                </Button>
              </>
            )}

            {selectedPeriod.status === "LOCKED" && (
              <>
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  startIcon={<LockOpenRounded />}
                  onClick={() => setMoMoLai(true)}
                  sx={{ textTransform: "none" }}
                >
                  Mở lại kỳ lương
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleRounded />}
                  onClick={handleDuyet}
                  disabled={approveMut.isPending}
                  sx={{ textTransform: "none" }}
                >
                  Duyệt kỳ lương
                </Button>
              </>
            )}
          </Stack>
        )}
      </Stack>

      {isLocked && (
        <Alert severity="warning" icon={<LockRounded />} sx={{ mt: 1.5, py: 0.5 }}>
          Kỳ lương này đã bị <strong>KHÓA SỔ</strong>. Dữ liệu tính lương chuyển sang chế độ chỉ đọc. Mở lại kỳ lương để chỉnh sửa nếu cần.
        </Alert>
      )}

      {/* Dialog Tạo kỳ mới */}
      <Dialog open={moTaoKy} onClose={() => setMoTaoKy(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Tạo kỳ lương mới</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={2}>
              <TextField
                select
                fullWidth
                size="small"
                label="Tháng"
                value={thangMoi}
                onChange={(e) => {
                  const m = Number(e.target.value);
                  setThangMoi(m);
                  setTenMoi(`Kỳ lương tháng ${m}/${namMoi}`);
                }}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <MenuItem key={m} value={m}>
                    Tháng {m}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Năm"
                value={namMoi}
                onChange={(e) => {
                  const y = Number(e.target.value);
                  setNamMoi(y);
                  setTenMoi(`Kỳ lương tháng ${thangMoi}/${y}`);
                }}
              />
            </Stack>
            <TextField
              fullWidth
              size="small"
              label="Tên kỳ lương"
              value={tenMoi}
              onChange={(e) => setTenMoi(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoTaoKy(false)} sx={{ textTransform: "none" }}>
            Hủy
          </Button>
          <Button
            variant="contained"
            onClick={handleTaoKy}
            disabled={taoKyMut.isPending}
            sx={{ textTransform: "none" }}
          >
            Tạo kỳ lương
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Mở lại kỳ lương */}
      <Dialog open={moMoLai} onClose={() => setMoMoLai(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Mở lại kỳ lương (Reopen)</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Theo quy định kiểm toán (BR-dltl-001), việc mở lại kỳ lương đã khóa sổ bắt buộc phải có lý do giải trình chi tiết từ 20 ký tự trở lên.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Lý do mở lại kỳ lương"
            placeholder="Nhập tối thiểu 20 ký tự giải trình lý do mở khóa sổ..."
            value={lyDoMoLai}
            onChange={(e) => setLyDoMoLai(e.target.value)}
            helperText={`${lyDoMoLai.trim().length}/20 ký tự tối thiểu`}
            error={lyDoMoLai.trim().length > 0 && lyDoMoLai.trim().length < 20}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoMoLai(false)} sx={{ textTransform: "none" }}>
            Hủy
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleMoLai}
            disabled={reopenMut.isPending || lyDoMoLai.trim().length < 20}
            sx={{ textTransform: "none" }}
          >
            Xác nhận mở lại
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
