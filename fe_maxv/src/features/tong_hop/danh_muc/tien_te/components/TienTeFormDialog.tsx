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
import { TaiKhoanPickerDialog } from "@/features/tong_hop/danh_muc/tai_khoan/components/TaiKhoanPickerDialog";
import {
  useCreateTienTe,
  useUpdateTienTe,
} from "@/features/tong_hop/danh_muc/tien_te/hooks/useTienTe";
import {
  EMPTY_TIEN_TE,
  tienTeToForm,
  type TienTe,
  type TienTeForm,
} from "@/features/tong_hop/danh_muc/tien_te/types";

export type TienTeMode = "new" | "edit" | "copy";

interface Props {
  open: boolean;
  mode: TienTeMode;
  current: TienTe | null;
  onClose: () => void;
}

const TITLES: Record<TienTeMode, string> = {
  new: "Thêm ngoại tệ",
  edit: "Sửa ngoại tệ",
  copy: "Thêm ngoại tệ",
};

/** Các field là tài khoản chênh lệch tỷ giá (chọn qua dialog). */
type TkField = "tk_pscl_no" | "tk_pscl_co" | "tk_dgcl_no" | "tk_dgcl_co";

export function TienTeFormDialog({
  open,
  mode,
  current,
  onClose,
}: Props): JSX.Element {
  const create = useCreateTienTe();
  const update = useUpdateTienTe();
  const [form, setForm] = useState<TienTeForm>(EMPTY_TIEN_TE);
  const [error, setError] = useState("");
  /** Field TK đang mở dialog chọn tài khoản (null = đóng). */
  const [pickerField, setPickerField] = useState<TkField | null>(null);

  useEffect(() => {
    if (!open) return;
    setError("");
    if (mode === "new" || !current) {
      setForm(EMPTY_TIEN_TE);
    } else {
      const f = tienTeToForm(current);
      setForm(mode === "copy" ? { ...f, ma_nt: "" } : f);
    }
  }, [open, mode, current]);

  function setField<K extends keyof TienTeForm>(key: K, value: TienTeForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const pending = create.isPending || update.isPending;

  /** 1 ô nhập tài khoản kèm nút search mở dialog chọn tài khoản. */
  const tkField = (field: TkField, label: string): JSX.Element => (
    <TextField
      label={label}
      fullWidth
      value={form[field]}
      onChange={(e) => setField(field, e.target.value.toUpperCase())}
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <Tooltip title="Chọn tài khoản">
                <IconButton
                  edge="end"
                  size="small"
                  onClick={() => setPickerField(field)}
                >
                  <SearchIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </InputAdornment>
          ),
        },
      }}
    />
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const onError = (err: unknown) =>
      setError(getApiError(err, "Lưu thất bại, vui lòng thử lại."));

    if (mode === "edit" && current) {
      update.mutate(
        { maNt: current.ma_nt, body: form },
        { onSuccess: onClose, onError },
      );
    } else {
      create.mutate(form, { onSuccess: onClose, onError });
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle>{TITLES[mode]}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction="row" spacing={2}>
              <TextField
                label="Mã ngoại tệ"
                required
                autoFocus
                value={form.ma_nt}
                onChange={(e) =>
                  setField("ma_nt", e.target.value.toUpperCase())
                }
                disabled={mode === "edit"}
                sx={{ width: 160 }}
              />
              <TextField
                select
                label="Trạng thái"
                value={form.status}
                onChange={(e) => setField("status", e.target.value)}
                sx={{ flex: 1 }}
              >
                <MenuItem value="1">Đang dùng</MenuItem>
                <MenuItem value="0">Ngừng dùng</MenuItem>
              </TextField>
            </Stack>
            <TextField
              label="Tên ngoại tệ"
              required
              fullWidth
              value={form.ten_nt}
              onChange={(e) => setField("ten_nt", e.target.value)}
            />
            <TextField
              label="Tên khác"
              fullWidth
              value={form.ten_nt2}
              onChange={(e) => setField("ten_nt2", e.target.value)}
            />

            <Divider />
            <Typography
              variant="subtitle2"
              color="primary"
              sx={{ fontWeight: 700 }}
            >
              Tài khoản chênh lệch tỷ giá
            </Typography>
            <Stack direction="row" spacing={2}>
              {tkField("tk_pscl_no", "PS CL - Nợ")}
              {tkField("tk_pscl_co", "PS CL - Có")}
            </Stack>
            <Stack direction="row" spacing={2}>
              {tkField("tk_dgcl_no", "ĐG CL - Nợ")}
              {tkField("tk_dgcl_co", "ĐG CL - Có")}
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
        open={pickerField !== null}
        title="Chọn tài khoản chênh lệch tỷ giá"
        onClose={() => setPickerField(null)}
        onSelect={(r) => {
          if (pickerField) setField(pickerField, r.tk);
        }}
      />
    </Dialog>
  );
}
