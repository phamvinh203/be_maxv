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
  useCreatePhanNhom,
  useUpdatePhanNhom,
} from '@/features/ton_kho/danh_muc/phan_nhom/hooks/usePhanNhom';
import {
  EMPTY_PHAN_NHOM,
  LOAI_NH_OPTIONS,
  phanNhomToForm,
  rowId,
  type PhanNhom,
  type PhanNhomForm,
} from '@/features/ton_kho/danh_muc/phan_nhom/types';

export type PhanNhomMode = 'new' | 'edit' | 'copy';

interface Props {
  open: boolean;
  mode: PhanNhomMode;
  /** Dòng nguồn cho edit/copy (null khi thêm mới). */
  current: PhanNhom | null;
  onClose: () => void;
}

const TITLES: Record<PhanNhomMode, string> = {
  new: 'Thêm nhóm hàng hóa, vật tư',
  edit: 'Sửa nhóm hàng hóa, vật tư',
  copy: 'Thêm nhóm hàng hóa, vật tư',
};

export function PhanNhomFormDialog({ open, mode, current, onClose }: Props): JSX.Element {
  const create = useCreatePhanNhom();
  const update = useUpdatePhanNhom();
  const [form, setForm] = useState<PhanNhomForm>(EMPTY_PHAN_NHOM);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (mode === 'new' || !current) {
      setForm(EMPTY_PHAN_NHOM);
    } else {
      const f = phanNhomToForm(current);
      setForm(mode === 'copy' ? { ...f, ma_nh: '' } : f);
    }
  }, [open, mode, current]);

  function setField<K extends keyof PhanNhomForm>(key: K, value: PhanNhomForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const pending = create.isPending || update.isPending;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const onError = (err: unknown) =>
      setError(getApiError(err, 'Lưu thất bại, vui lòng thử lại.'));

    if (mode === 'edit' && current) {
      update.mutate({ id: rowId(current), body: form }, { onSuccess: onClose, onError });
    } else {
      create.mutate(form, { onSuccess: onClose, onError });
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle>{TITLES[mode]}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction="row" spacing={2}>
              <TextField
                select
                label="Loại nhóm"
                required
                value={form.loai_nh}
                onChange={(e) => setField('loai_nh', Number(e.target.value))}
                sx={{ width: 140 }}
              >
                {LOAI_NH_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Mã nhóm"
                required
                autoFocus
                value={form.ma_nh}
                onChange={(e) => setField('ma_nh', e.target.value.toUpperCase())}
                disabled={mode === 'edit'}
                sx={{ flex: 1 }}
              />
            </Stack>
            <TextField
              label="Tên nhóm"
              required
              fullWidth
              value={form.ten_nh}
              onChange={(e) => setField('ten_nh', e.target.value)}
            />
            <TextField
              label="Tên khác"
              fullWidth
              value={form.ten_nh2}
              onChange={(e) => setField('ten_nh2', e.target.value)}
            />
            <TextField
              select
              label="Trạng thái"
              value={form.status}
              onChange={(e) => setField('status', e.target.value)}
            >
              <MenuItem value="1">Đang dùng</MenuItem>
              <MenuItem value="0">Ngừng dùng</MenuItem>
            </TextField>
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
