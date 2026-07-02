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
  useCreateDvt,
  useUpdateDvt,
} from '@/features/ton_kho/danh_muc/dvt/hooks/useDvt';
import {
  EMPTY_DVT,
  dvtToForm,
  type Dvt,
  type DvtForm,
} from '@/features/ton_kho/danh_muc/dvt/types';

export type DvtMode = 'new' | 'edit' | 'copy';

interface Props {
  open: boolean;
  mode: DvtMode;
  /** Dòng nguồn cho edit/copy (null khi thêm mới). */
  current: Dvt | null;
  onClose: () => void;
}

const TITLES: Record<DvtMode, string> = {
  new: 'Thêm đơn vị tính',
  edit: 'Sửa đơn vị tính',
  copy: 'Thêm đơn vị tính',
};

export function DvtFormDialog({ open, mode, current, onClose }: Props): JSX.Element {
  const create = useCreateDvt();
  const update = useUpdateDvt();
  const [form, setForm] = useState<DvtForm>(EMPTY_DVT);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (mode === 'new' || !current) {
      setForm(EMPTY_DVT);
    } else {
      const f = dvtToForm(current);
      setForm(mode === 'copy' ? { ...f, dvt: '' } : f);
    }
  }, [open, mode, current]);

  function setField<K extends keyof DvtForm>(key: K, value: DvtForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const pending = create.isPending || update.isPending;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const onError = (err: unknown) =>
      setError(getApiError(err, 'Lưu thất bại, vui lòng thử lại.'));

    if (mode === 'edit' && current) {
      update.mutate({ dvt: current.dvt, body: form }, { onSuccess: onClose, onError });
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
                label="Mã ĐVT"
                required
                autoFocus
                value={form.dvt}
                onChange={(e) => setField('dvt', e.target.value)}
                sx={{ flex: 1 }}
              />
              <TextField
                label="ĐVT 2"
                value={form.dvt2}
                onChange={(e) => setField('dvt2', e.target.value)}
                sx={{ flex: 1 }}
              />
            </Stack>
            <TextField
              label="Tên đơn vị tính"
              required
              fullWidth
              value={form.ten_dvt}
              onChange={(e) => setField('ten_dvt', e.target.value)}
            />
            <TextField
              label="Tên khác"
              fullWidth
              value={form.ten_dvt2}
              onChange={(e) => setField('ten_dvt2', e.target.value)}
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
