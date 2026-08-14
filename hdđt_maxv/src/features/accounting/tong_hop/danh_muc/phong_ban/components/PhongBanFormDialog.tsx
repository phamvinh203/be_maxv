import { useEffect, useState, type FormEvent, type JSX } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { getApiError } from "@/lib/apiClient";
import { TaiKhoanPickerDialog } from "@/components/Accounting/TaiKhoanPickerDialog";
import {
  useCreatePhongBan,
  useUpdatePhongBan,
} from "@/features/accounting/tong_hop/danh_muc/phong_ban/hooks/usePhongBan";
import {
  EMPTY_PHONG_BAN,
  phongBanToForm,
  type PhongBan,
  type PhongBanForm,
} from "@/features/accounting/tong_hop/danh_muc/phong_ban/types";

export type PhongBanMode = "new" | "edit" | "copy";

interface Props {
  open: boolean;
  mode: PhongBanMode;
  current: PhongBan | null;
  onClose: () => void;
}

const TITLES: Record<PhongBanMode, string> = {
  new: "Thêm phòng ban",
  edit: "Sửa phòng ban",
  copy: "Thêm phòng ban",
};

export function PhongBanFormDialog({
  open,
  mode,
  current,
  onClose,
}: Props): JSX.Element {
  const create = useCreatePhongBan();
  const update = useUpdatePhongBan();
  const [form, setForm] = useState<PhongBanForm>(EMPTY_PHONG_BAN);
  const [error, setError] = useState("");
  const [pickTk, setPickTk] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset form khi dialog vừa mở, không phải đồng bộ liên tục
    setError("");
    if (mode === "new" || !current) {
      setForm(EMPTY_PHONG_BAN);
    } else {
      const f = phongBanToForm(current);
      setForm(mode === "copy" ? { ...f, ma_pb: "" } : f);
    }
  }, [open, mode, current]);

  function setField<K extends keyof PhongBanForm>(
    key: K,
    value: PhongBanForm[K],
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
        { maPb: current.ma_pb, body: form },
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
                label="Mã phòng ban"
                required
                autoFocus={mode !== "edit"}
                value={form.ma_pb}
                onChange={(e) =>
                  setField("ma_pb", e.target.value.toUpperCase())
                }
                sx={{ flex: 1 }}
                helperText={
                  mode === "edit" ? "Không đổi được mã khi sửa" : undefined
                }
                slotProps={{ input: { readOnly: mode === "edit" } }}
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
              label="Tên phòng ban"
              required
              fullWidth
              value={form.ten_pb}
              onChange={(e) => setField("ten_pb", e.target.value)}
            />
            <TextField
              label="Tên khác"
              fullWidth
              value={form.ten_pb2}
              onChange={(e) => setField("ten_pb2", e.target.value)}
            />
            <TextField
              label="Địa chỉ"
              fullWidth
              value={form.dia_chi}
              onChange={(e) => setField("dia_chi", e.target.value)}
            />
            <TextField
              label="Điện thoại"
              fullWidth
              value={form.dien_thoai}
              onChange={(e) => setField("dien_thoai", e.target.value)}
            />
            <TextField
              label="Tk chi phí"
              fullWidth
              value={form.ma_td1}
              onChange={(e) => setField("ma_td1", e.target.value.toUpperCase())}
              helperText={form.ten_tk || undefined}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="Chọn tài khoản">
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => setPickTk(true)}
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
              label="Ghi chú"
              fullWidth
              multiline
              minRows={2}
              value={form.ghi_chu}
              onChange={(e) => setField("ghi_chu", e.target.value)}
            />
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
        open={pickTk}
        title="Chọn tài khoản chi phí"
        onClose={() => setPickTk(false)}
        onSelect={(r) =>
          setForm((f) => ({ ...f, ma_td1: r.tk, ten_tk: r.ten_tk }))
        }
      />
    </Dialog>
  );
}
