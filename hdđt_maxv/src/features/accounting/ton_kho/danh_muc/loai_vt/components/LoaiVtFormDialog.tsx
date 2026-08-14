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
  useCreateLoaiVt,
  useUpdateLoaiVt,
} from '@/features/accounting/ton_kho/danh_muc/loai_vt/hooks/useLoaiVt';
import {
  EMPTY_LOAI_VT,
  loaiVtToForm,
  type LoaiVt,
  type LoaiVtForm,
} from '@/features/accounting/ton_kho/danh_muc/loai_vt/types';

export type LoaiVtMode = 'new' | 'edit' | 'copy';

interface Props {
  open: boolean;
  mode: LoaiVtMode;
  current: LoaiVt | null;
  onClose: () => void;
}

const TITLES: Record<LoaiVtMode, string> = {
  new: 'Thêm loại vật tư',
  edit: 'Sửa loại vật tư',
  copy: 'Thêm loại vật tư',
};

export function LoaiVtFormDialog({ open, mode, current, onClose }: Props): JSX.Element {
  const create = useCreateLoaiVt();
  const update = useUpdateLoaiVt();
  const [form, setForm] = useState<LoaiVtForm>(EMPTY_LOAI_VT);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset form khi dialog vừa mở, không phải đồng bộ liên tục
    setError('');
    if (mode === 'new' || !current) {
      setForm(EMPTY_LOAI_VT);
    } else {
      const f = loaiVtToForm(current);
      setForm(mode === 'copy' ? { ...f, ma_loai_vt: '' } : f);
    }
  }, [open, mode, current]);

  function setField<K extends keyof LoaiVtForm>(key: K, value: LoaiVtForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const pending = create.isPending || update.isPending;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const onError = (err: unknown) =>
      setError(getApiError(err, 'Lưu thất bại, vui lòng thử lại.'));

    if (mode === 'edit' && current) {
      update.mutate({ maLoai: current.ma_loai_vt, body: form }, { onSuccess: onClose, onError });
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
            <TextField
              label="Mã loại"
              required
              autoFocus
              value={form.ma_loai_vt}
              onChange={(e) => setField('ma_loai_vt', e.target.value.toUpperCase())}
              disabled={mode === 'edit'}
              fullWidth
            />
            <TextField
              label="Tên loại"
              required
              fullWidth
              value={form.ten_loai_vt}
              onChange={(e) => setField('ten_loai_vt', e.target.value)}
            />
            <TextField
              label="Tên khác"
              fullWidth
              value={form.ten_loai_vt2}
              onChange={(e) => setField('ten_loai_vt2', e.target.value)}
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
