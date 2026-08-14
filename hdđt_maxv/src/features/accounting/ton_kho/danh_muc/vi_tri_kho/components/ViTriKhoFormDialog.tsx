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
import { useKhoList } from '@/features/accounting/ton_kho/danh_muc/kho/hooks/useKho';
import {
  useCreateViTri,
  useUpdateViTri,
} from '@/features/accounting/ton_kho/danh_muc/vi_tri_kho/hooks/useViTriKho';
import {
  EMPTY_VI_TRI,
  viTriToForm,
  type ViTri,
  type ViTriForm,
} from '@/features/accounting/ton_kho/danh_muc/vi_tri_kho/types';

export type ViTriMode = 'new' | 'edit' | 'copy';

interface Props {
  open: boolean;
  mode: ViTriMode;
  current: ViTri | null;
  onClose: () => void;
}

const TITLES: Record<ViTriMode, string> = {
  new: 'Thêm vị trí kho',
  edit: 'Sửa vị trí kho',
  copy: 'Thêm vị trí kho',
};

export function ViTriKhoFormDialog({ open, mode, current, onClose }: Props): JSX.Element {
  const create = useCreateViTri();
  const update = useUpdateViTri();
  const { data: khoData } = useKhoList();
  const khos = khoData ?? [];

  const [form, setForm] = useState<ViTriForm>(EMPTY_VI_TRI);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset form khi dialog vừa mở, không phải đồng bộ liên tục
    setError('');
    if (mode === 'new' || !current) {
      setForm(EMPTY_VI_TRI);
    } else {
      const f = viTriToForm(current);
      setForm(mode === 'copy' ? { ...f, ma_vi_tri: '' } : f);
    }
  }, [open, mode, current]);

  function setField<K extends keyof ViTriForm>(key: K, value: ViTriForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const pending = create.isPending || update.isPending;
  const lockKey = mode === 'edit';

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const onError = (err: unknown) =>
      setError(getApiError(err, 'Lưu thất bại, vui lòng thử lại.'));

    if (mode === 'edit' && current) {
      update.mutate(
        { maKho: current.ma_kho, maViTri: current.ma_vi_tri, body: form },
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
            <TextField
              select
              label="Kho"
              required
              value={form.ma_kho}
              onChange={(e) => setField('ma_kho', e.target.value)}
              disabled={lockKey}
              fullWidth
            >
              <MenuItem value="">
                <em>— Chọn kho —</em>
              </MenuItem>
              {form.ma_kho !== '' && !khos.some((k) => k.ma_kho === form.ma_kho) && (
                <MenuItem value={form.ma_kho}>{form.ma_kho}</MenuItem>
              )}
              {khos.map((k) => (
                <MenuItem key={k.ma_kho} value={k.ma_kho}>
                  {k.ma_kho} — {k.ten_kho}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Mã vị trí"
              required
              value={form.ma_vi_tri}
              onChange={(e) => setField('ma_vi_tri', e.target.value.toUpperCase())}
              disabled={lockKey}
              fullWidth
            />
            <TextField
              label="Tên vị trí"
              required
              fullWidth
              value={form.ten_vi_tri}
              onChange={(e) => setField('ten_vi_tri', e.target.value)}
            />
            <TextField
              label="Tên khác"
              fullWidth
              value={form.ten_vi_tri2}
              onChange={(e) => setField('ten_vi_tri2', e.target.value)}
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
