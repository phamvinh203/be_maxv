import { useState, type ReactElement } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import LockRounded from "@mui/icons-material/LockRounded";
import LockOpenRounded from "@mui/icons-material/LockOpenRounded";
import SendRounded from "@mui/icons-material/SendRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import UndoRounded from "@mui/icons-material/UndoRounded";
import {
  useApprovePayrollPeriod,
  useLockPayrollPeriod,
  useRejectPayrollPeriod,
  useReopenPayrollPeriod,
  useSubmitPayrollPeriod,
  type PayrollPeriodApiItem,
} from "../../api/du_lieu_tinh_luong/payrollPeriodsQueries";
import type { BangKeApiItem } from "../../api/chot_ky_luong/chotKyLuongQueries";
import XacNhanXoaDialog from "../XacNhanXoaDialog";
import { chayVoiThongBao } from "./chayVoiThongBao";
import { useLaChuTaiKhoan } from "./useLaChuTaiKhoan";

const LY_DO_TOI_THIEU = 20;

interface Props {
  period: PayrollPeriodApiItem;
  /** Bảng kê còn đang mở — khóa sổ vẫn cho, chỉ cảnh báo (chủ dự án chốt 2026-09-11). */
  bangKeChuaChot: BangKeApiItem[];
}

/**
 * Các nút vòng đời kỳ lương (Trình duyệt · Từ chối · Khóa sổ · Mở lại · Duyệt) — trước nằm ở khối
 * chọn kỳ trên đầu khu Dữ liệu tính lương / Bảng lương, nay về màn Chốt kỳ lương.
 */
export default function VongDoiKyLuong({ period, bangKeChuaChot }: Props) {
  // Khóa sổ / mở lại / duyệt là thẩm quyền tài chính — máy chủ chỉ cho ADMIN/OWNER.
  const laChuTaiKhoan = useLaChuTaiKhoan();
  const submitMut = useSubmitPayrollPeriod();
  const rejectMut = useRejectPayrollPeriod();
  const lockMut = useLockPayrollPeriod();
  const reopenMut = useReopenPayrollPeriod();
  const approveMut = useApprovePayrollPeriod();

  const [moKhoaSo, setMoKhoaSo] = useState(false);
  const [moMoLai, setMoMoLai] = useState(false);
  const [lyDo, setLyDo] = useState("");

  const handleMoLai = async () => {
    if (lyDo.trim().length < LY_DO_TOI_THIEU) return;
    const xong = await chayVoiThongBao(
      () => reopenMut.mutateAsync({ id: period.id, body: { reason: lyDo.trim() } }),
      "Đã mở lại kỳ lương về bản nháp.",
    );
    if (xong) {
      setMoMoLai(false);
      setLyDo("");
    }
  };

  const nutChuTk = (nut: ReactElement) =>
    laChuTaiKhoan ? (
      nut
    ) : (
      <Tooltip title="Chỉ chủ tài khoản được thực hiện thao tác này.">
        <span>{nut}</span>
      </Tooltip>
    );

  const nutKhoaSo = nutChuTk(
    <Button
      size="small"
      variant={period.status === "PENDING_REVIEW" ? "contained" : "outlined"}
      color="warning"
      startIcon={<LockRounded />}
      onClick={() => setMoKhoaSo(true)}
      disabled={!laChuTaiKhoan || lockMut.isPending}
      sx={{ textTransform: "none" }}
    >
      Khóa sổ kỳ lương
    </Button>,
  );

  return (
    <>
      <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
        {period.status === "DRAFT" && (
          <>
            {nutKhoaSo}
            <Button
              size="small"
              variant="contained"
              startIcon={<SendRounded />}
              onClick={() =>
                chayVoiThongBao(() => submitMut.mutateAsync(period.id), "Đã trình duyệt kỳ lương.")
              }
              disabled={submitMut.isPending}
              sx={{ textTransform: "none" }}
            >
              Trình duyệt
            </Button>
          </>
        )}

        {period.status === "PENDING_REVIEW" && (
          <>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<UndoRounded />}
              onClick={() =>
                chayVoiThongBao(
                  () => rejectMut.mutateAsync(period.id),
                  "Đã từ chối, trả kỳ lương về bản nháp.",
                )
              }
              disabled={rejectMut.isPending}
              sx={{ textTransform: "none" }}
            >
              Từ chối
            </Button>
            {nutKhoaSo}
          </>
        )}

        {period.status === "LOCKED" && (
          <>
            {nutChuTk(
              <Button
                size="small"
                variant="outlined"
                color="warning"
                startIcon={<LockOpenRounded />}
                onClick={() => setMoMoLai(true)}
                disabled={!laChuTaiKhoan}
                sx={{ textTransform: "none" }}
              >
                Mở lại kỳ lương
              </Button>,
            )}
            {nutChuTk(
              <Button
                size="small"
                variant="contained"
                color="success"
                startIcon={<CheckCircleRounded />}
                onClick={() =>
                  chayVoiThongBao(() => approveMut.mutateAsync(period.id), "Đã duyệt kỳ lương.")
                }
                disabled={!laChuTaiKhoan || approveMut.isPending}
                sx={{ textTransform: "none" }}
              >
                Duyệt kỳ lương
              </Button>,
            )}
          </>
        )}
      </Stack>

      <XacNhanXoaDialog
        open={moKhoaSo}
        tieuDe="Khóa sổ kỳ lương?"
        nhanXacNhan="Khóa sổ"
        onClose={() => setMoKhoaSo(false)}
        onXacNhan={() => {
          setMoKhoaSo(false);
          void chayVoiThongBao(() => lockMut.mutateAsync(period.id), "Đã khóa sổ kỳ lương.");
        }}
        noiDung={
          <>
            Khóa sổ sẽ tính lại và <strong>chụp bảng lương chính thức</strong> của {period.name}; mọi
            dữ liệu tính lương của kỳ chuyển sang chỉ đọc.
            {bangKeChuaChot.length > 0 && (
              <Typography variant="body2" color="warning.main" sx={{ mt: 1.5 }}>
                Còn {bangKeChuaChot.length} bảng kê chưa chốt số:{" "}
                {bangKeChuaChot.map((b) => b.label).join(", ")}. Khóa sổ vẫn thực hiện được — các
                bảng kê này sẽ được coi là đã chốt theo kỳ.
              </Typography>
            )}
          </>
        }
      />

      <Dialog open={moMoLai} onClose={() => setMoMoLai(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Mở lại kỳ lương</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Mở lại kỳ lương đã khóa sổ bắt buộc phải có lý do giải trình từ {LY_DO_TOI_THIEU} ký tự
            trở lên (BR-dltl-001). Các bảng kê đã chốt số riêng vẫn giữ nguyên trạng thái chốt.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Lý do mở lại kỳ lương"
            placeholder={`Nhập tối thiểu ${LY_DO_TOI_THIEU} ký tự giải trình lý do mở khóa sổ...`}
            value={lyDo}
            onChange={(e) => setLyDo(e.target.value)}
            helperText={`${lyDo.trim().length}/${LY_DO_TOI_THIEU} ký tự tối thiểu`}
            error={lyDo.trim().length > 0 && lyDo.trim().length < LY_DO_TOI_THIEU}
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
            disabled={reopenMut.isPending || lyDo.trim().length < LY_DO_TOI_THIEU}
            sx={{ textTransform: "none" }}
          >
            Xác nhận mở lại
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
