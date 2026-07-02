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
  useCreateMaGd,
  useUpdateMaGd,
} from '@/features/ton_kho/danh_muc/ma_gd/hooks/useMaGd';
import {
  EMPTY_MA_GD,
  maGdToForm,
  type MaGd,
  type MaGdForm,
} from '@/features/ton_kho/danh_muc/ma_gd/types';

export type MaGdMode = 'new' | 'edit' | 'copy';

interface Props {
  open: boolean;
  mode: MaGdMode;
  /** Dòng nguồn cho edit/copy (null khi thêm mới). */
  current: MaGd | null;
  onClose: () => void;
}

const TITLES: Record<MaGdMode, string> = {
  new: 'Thêm mã giao dịch',
  edit: 'Sửa mã giao dịch',
  copy: 'Thêm mã giao dịch',
};

export function MaGdFormDialog({ open, mode, current, onClose }: Props): JSX.Element {
  const create = useCreateMaGd();
  const update = useUpdateMaGd();
  const [form, setForm] = useState<MaGdForm>(EMPTY_MA_GD);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (mode === 'new' || !current) {
      setForm(EMPTY_MA_GD);
    } else {
      const f = maGdToForm(current);
      setForm(mode === 'copy' ? { ...f, ma_gd: '' } : f);
    }
  }, [open, mode, current]);

  function setField<K extends keyof MaGdForm>(key: K, value: MaGdForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const pending = create.isPending || update.isPending;
  const lockKey = mode === 'edit'; // khóa (ma_ct, ma_gd) khi sửa

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const onError = (err: unknown) =>
      setError(getApiError(err, 'Lưu thất bại, vui lòng thử lại.'));

    if (mode === 'edit' && current) {
      update.mutate(
        { maCt: current.ma_ct, maGd: current.ma_gd, body: form },
        { onSuccess: onClose, onError },
      );
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
                label="Mã chứng từ"
                required
                autoFocus
                value={form.ma_ct}
                onChange={(e) => setField('ma_ct', e.target.value.toUpperCase())}
                disabled={lockKey}
                sx={{ flex: 1 }}
              />
              <TextField
                label="Mã giao dịch"
                required
                value={form.ma_gd}
                onChange={(e) => setField('ma_gd', e.target.value.toUpperCase())}
                disabled={lockKey}
                sx={{ flex: 1 }}
              />
            </Stack>
            <TextField
              label="Loại chứng từ"
              fullWidth
              value={form.loai_ct}
              onChange={(e) => setField('loai_ct', e.target.value)}
            />
            <TextField
              label="Tên giao dịch"
              required
              fullWidth
              value={form.ten_gd}
              onChange={(e) => setField('ten_gd', e.target.value)}
            />
            <TextField
              label="Tên khác"
              fullWidth
              value={form.ten_gd2}
              onChange={(e) => setField('ten_gd2', e.target.value)}
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
