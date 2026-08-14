import { useEffect, useState, type FormEvent, type JSX } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { getApiError } from "@/lib/apiClient";
import { useTienTeList } from "@/features/accounting/tong_hop/danh_muc/tien_te/hooks/useTienTe";
import {
  useCreateTaiKhoan,
  useUpdateTaiKhoan,
} from "@/features/accounting/tong_hop/danh_muc/tai_khoan/hooks/useTaiKhoan";
import { TaiKhoanPickerDialog } from "@/components/Accounting/TaiKhoanPickerDialog";
import {
  EMPTY_TAI_KHOAN,
  taiKhoanToForm,
  type TaiKhoan,
  type TaiKhoanForm,
} from "@/features/accounting/tong_hop/danh_muc/tai_khoan/types";

export type TaiKhoanMode = "new" | "edit" | "copy";

interface Props {
  open: boolean;
  mode: TaiKhoanMode;
  current: TaiKhoan | null;
  onClose: () => void;
}

const TITLES: Record<TaiKhoanMode, string> = {
  new: "Thêm tài khoản",
  edit: "Sửa tài khoản",
  copy: "Thêm tài khoản",
};

/** Phương pháp tính chênh lệch tỷ giá (loai_cl_no / loai_cl_co). */
const CL_OPTIONS = [
  { value: "", label: "-- Không tính chênh lệch --" },
  { value: "0", label: "0 - Không tính chênh lệch" },
  { value: "1", label: "1 - Trung bình tháng" },
  { value: "2", label: "2 - Đích danh" },
  { value: "3", label: "3 - Nhập trước xuất trước" },
  { value: "4", label: "4 - Trung bình di động" },
];

export function TaiKhoanFormDialog({
  open,
  mode,
  current,
  onClose,
}: Props): JSX.Element {
  const create = useCreateTaiKhoan();
  const update = useUpdateTaiKhoan();
  const { data: currencies } = useTienTeList();
  const [form, setForm] = useState<TaiKhoanForm>(EMPTY_TAI_KHOAN);
  const [error, setError] = useState("");
  /** Mở dialog chọn tài khoản mẹ. */
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset form khi dialog vừa mở, không phải đồng bộ liên tục
    setError("");
    if (mode === "new" || !current) {
      setForm(EMPTY_TAI_KHOAN);
    } else {
      const f = taiKhoanToForm(current);
      setForm(mode === "copy" ? { ...f, tk: "" } : f);
    }
  }, [open, mode, current]);

  function setField<K extends keyof TaiKhoanForm>(
    key: K,
    value: TaiKhoanForm[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const pending = create.isPending || update.isPending;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const onError = (err: unknown) =>
      setError(getApiError(err, "Lưu thất bại, vui lòng thử lại."));

    if (mode === "edit" && current) {
      update.mutate(
        { tk: current.tk, body: form },
        { onSuccess: onClose, onError },
      );
    } else {
      create.mutate(form, { onSuccess: onClose, onError });
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle>{TITLES[mode]}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {error && <Alert severity="error">{error}</Alert>}

            <Stack direction="row" spacing={2}>
              <TextField
                label="Tài khoản"
                required
                autoFocus={mode !== "edit"}
                value={form.tk}
                onChange={(e) => setField("tk", e.target.value.toUpperCase())}
                sx={{ width: 160 }}
                placeholder="VD: 1111"
              />
              <TextField
                label="Tài khoản mẹ"
                value={form.tk_me}
                onChange={(e) =>
                  setField("tk_me", e.target.value.toUpperCase())
                }
                sx={{ width: 200 }}
                placeholder="VD: 111"
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title="Chọn tài khoản mẹ">
                          <IconButton
                            edge="end"
                            size="small"
                            onClick={() => setPickerOpen(true)}
                          >
                            <SearchIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <TextField
                label="Bậc"
                type="number"
                value={form.bac_tk}
                onChange={(e) => setField("bac_tk", e.target.value)}
                sx={{ width: 100 }}
              />
              <TextField
                select
                label="Trạng thái"
                value={form.status}
                onChange={(e) => setField("status", e.target.value)}
                sx={{ flex: 1 }}
              >
                <MenuItem value="1">1 - Theo dõi</MenuItem>
                <MenuItem value="0">0 - Ngừng theo dõi</MenuItem>
              </TextField>
            </Stack>

            <TextField
              label="Tên tài khoản"
              required
              fullWidth
              value={form.ten_tk}
              onChange={(e) => setField("ten_tk", e.target.value)}
            />
            <TextField
              label="Tên khác"
              fullWidth
              value={form.ten_tk2}
              onChange={(e) => setField("ten_tk2", e.target.value)}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Tên ngắn"
                fullWidth
                value={form.ten_ngan}
                onChange={(e) => setField("ten_ngan", e.target.value)}
              />
              <TextField
                label="Tên ngắn khác"
                fullWidth
                value={form.ten_ngan2}
                onChange={(e) => setField("ten_ngan2", e.target.value)}
              />
            </Stack>

            <Divider />
            <Typography
              variant="subtitle2"
              color="primary"
              sx={{ fontWeight: 700 }}
            >
              Thiết lập theo dõi
            </Typography>
            <Stack direction="row" spacing={2}>
              <TextField
                select
                label="Mã ngoại tệ"
                value={form.ma_nt}
                onChange={(e) => setField("ma_nt", e.target.value)}
                sx={{ flex: 1 }}
              >
                <MenuItem value="">-- Không chọn --</MenuItem>
                {(currencies ?? []).map((c) => (
                  <MenuItem key={c.ma_nt} value={c.ma_nt}>
                    {c.ma_nt} - {c.ten_nt}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Tk theo dõi công nợ"
                value={form.tk_cn}
                onChange={(e) => setField("tk_cn", e.target.value)}
                sx={{ flex: 1 }}
              >
                <MenuItem value="0">0 - Không theo dõi công nợ</MenuItem>
                <MenuItem value="1">1 - Theo dõi công nợ</MenuItem>
              </TextField>
              <TextField
                select
                label="Tài khoản sổ cái"
                value={form.tk_sc}
                onChange={(e) => setField("tk_sc", e.target.value)}
                sx={{ flex: 1 }}
              >
                <MenuItem value="0">0 - Không phải tài khoản sổ cái</MenuItem>
                <MenuItem value="1">1 - Tài khoản sổ cái</MenuItem>
              </TextField>
            </Stack>

            <Divider />
            <Typography
              variant="subtitle2"
              color="primary"
              sx={{ fontWeight: 700 }}
            >
              Phương pháp tính chênh lệch tỷ giá
            </Typography>
            <Stack direction="row" spacing={2}>
              <TextField
                select
                label="PP tính TGGS Nợ"
                value={form.loai_cl_no}
                onChange={(e) => setField("loai_cl_no", e.target.value)}
                sx={{ flex: 1 }}
              >
                {CL_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="PP tính TGGS Có"
                value={form.loai_cl_co}
                onChange={(e) => setField("loai_cl_co", e.target.value)}
                sx={{ flex: 1 }}
              >
                {CL_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} disabled={pending}>
            Hủy
          </Button>
          <Button type="submit" variant="contained" disabled={pending}>
            {pending ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogActions>
      </Box>

      <TaiKhoanPickerDialog
        open={pickerOpen}
        title="Chọn tài khoản mẹ"
        onClose={() => setPickerOpen(false)}
        onSelect={(r) => setField("tk_me", r.tk)}
      />
    </Dialog>
  );
}
