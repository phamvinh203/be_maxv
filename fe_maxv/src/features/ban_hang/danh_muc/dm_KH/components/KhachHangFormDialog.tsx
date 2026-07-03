import { useEffect, useState, type FormEvent, type JSX } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { getApiError } from '@/lib/apiClient';
import {
  useCreateKhachHang,
  useUpdateKhachHang,
} from '@/features/ban_hang/danh_muc/dm_KH/hooks/useKhachHang';
import {
  EMPTY_KHACH_HANG,
  khachHangToForm,
  type KhachHang,
  type KhachHangForm,
} from '@/features/ban_hang/danh_muc/dm_KH/types';

export type KhachHangMode = 'new' | 'edit' | 'copy';

interface Props {
  open: boolean;
  mode: KhachHangMode;
  current: KhachHang | null;
  onClose: () => void;
}

const TITLES: Record<KhachHangMode, string> = {
  new: 'Thêm khách hàng',
  edit: 'Sửa khách hàng',
  copy: 'Thêm khách hàng',
};

export function KhachHangFormDialog({ open, mode, current, onClose }: Props): JSX.Element {
  const create = useCreateKhachHang();
  const update = useUpdateKhachHang();
  const [form, setForm] = useState<KhachHangForm>(EMPTY_KHACH_HANG);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (mode === 'new' || !current) {
      setForm(EMPTY_KHACH_HANG);
    } else {
      const f = khachHangToForm(current);
      setForm(mode === 'copy' ? { ...f, ma_kh: '' } : f);
    }
  }, [open, mode, current]);

  function setField<K extends keyof KhachHangForm>(key: K, value: KhachHangForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const pending = create.isPending || update.isPending;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const onError = (err: unknown) =>
      setError(getApiError(err, 'Lưu thất bại, vui lòng thử lại.'));

    if (mode === 'edit' && current) {
      update.mutate({ maKh: current.ma_kh, body: form }, { onSuccess: onClose, onError });
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
                label="Mã khách hàng"
                required
                autoFocus={mode !== 'edit'}
                value={form.ma_kh}
                onChange={(e) => setField('ma_kh', e.target.value.toUpperCase())}
                sx={{ flex: 1 }}
                helperText={mode === 'edit' ? 'Không đổi được mã khi sửa' : undefined}
                slotProps={{ input: { readOnly: mode === 'edit' } }}
              />
              <TextField
                select
                label="Trạng thái"
                value={form.status}
                onChange={(e) => setField('status', e.target.value)}
                sx={{ flex: 1 }}
              >
                <MenuItem value="1">Đang dùng</MenuItem>
                <MenuItem value="0">Ngừng dùng</MenuItem>
              </TextField>
            </Stack>
            <TextField
              label="Tên khách hàng"
              required
              fullWidth
              value={form.ten_kh}
              onChange={(e) => setField('ten_kh', e.target.value)}
            />
            <TextField
              label="Tên khác"
              fullWidth
              value={form.ten_kh2}
              onChange={(e) => setField('ten_kh2', e.target.value)}
            />
            <TextField
              label="Địa chỉ"
              fullWidth
              value={form.dia_chi}
              onChange={(e) => setField('dia_chi', e.target.value)}
            />
            <TextField
              label="Mã số thuế"
              fullWidth
              value={form.ma_so_thue}
              onChange={(e) => setField('ma_so_thue', e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} disabled={pending}>
            Hủy
          </Button>
          <Button type="submit" variant="contained" disabled={pending}>
            {pending ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
