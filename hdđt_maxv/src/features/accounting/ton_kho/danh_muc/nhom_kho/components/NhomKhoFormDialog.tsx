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
  useCreateNhomKho,
  useUpdateNhomKho,
} from '@/features/accounting/ton_kho/danh_muc/nhom_kho/hooks/useNhomKho';
import {
  EMPTY_NHOM_KHO,
  nhomKhoToForm,
  type NhomKho,
  type NhomKhoForm,
} from '@/features/accounting/ton_kho/danh_muc/nhom_kho/types';

export type NhomKhoMode = 'new' | 'edit' | 'copy';

interface Props {
  open: boolean;
  mode: NhomKhoMode;
  current: NhomKho | null;
  onClose: () => void;
}

const TITLES: Record<NhomKhoMode, string> = {
  new: 'Thêm nhóm kho hàng',
  edit: 'Sửa nhóm kho hàng',
  copy: 'Thêm nhóm kho hàng',
};

export function NhomKhoFormDialog({ open, mode, current, onClose }: Props): JSX.Element {
  const create = useCreateNhomKho();
  const update = useUpdateNhomKho();
  const [form, setForm] = useState<NhomKhoForm>(EMPTY_NHOM_KHO);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset form khi dialog vừa mở, không phải đồng bộ liên tục
    setError('');
    if (mode === 'new' || !current) {
      setForm(EMPTY_NHOM_KHO);
    } else {
      const f = nhomKhoToForm(current);
      setForm(mode === 'copy' ? { ...f, ma_nh: '' } : f);
    }
  }, [open, mode, current]);

  function setField<K extends keyof NhomKhoForm>(key: K, value: NhomKhoForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const pending = create.isPending || update.isPending;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const onError = (err: unknown) =>
      setError(getApiError(err, 'Lưu thất bại, vui lòng thử lại.'));

    if (mode === 'edit' && current) {
      update.mutate({ maNh: current.ma_nh, body: form }, { onSuccess: onClose, onError });
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
              label="Mã nhóm"
              required
              autoFocus
              value={form.ma_nh}
              onChange={(e) => setField('ma_nh', e.target.value.toUpperCase())}
              disabled={mode === 'edit'}
              fullWidth
            />
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
