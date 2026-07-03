import { useEffect, useState, type FormEvent, type JSX } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
} from '@mui/material';
import { getApiError } from '@/lib/apiClient';
import { getCurrentCompany } from '@/features/auth/hooks/useAuth';
import {
  useCreateKho,
  useUpdateKho,
} from '@/features/ton_kho/danh_muc/kho/hooks/useKho';
import { useNhomKhoList } from '@/features/ton_kho/danh_muc/nhom_kho/hooks/useNhomKho';
import {
  EMPTY_KHO,
  khoToForm,
  type Kho,
  type KhoForm,
} from '@/features/ton_kho/danh_muc/kho/types';

export type KhoMode = 'new' | 'edit' | 'copy';

interface Props {
  open: boolean;
  mode: KhoMode;
  current: Kho | null;
  onClose: () => void;
}

const TITLES: Record<KhoMode, string> = {
  new: 'Thêm kho hàng',
  edit: 'Sửa kho hàng',
  copy: 'Thêm kho hàng',
};

export function KhoFormDialog({ open, mode, current, onClose }: Props): JSX.Element {
  const create = useCreateKho();
  const update = useUpdateKho();
  const [form, setForm] = useState<KhoForm>(EMPTY_KHO);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (mode === 'new' || !current) {
      setForm(EMPTY_KHO);
    } else {
      const f = khoToForm(current);
      setForm(mode === 'copy' ? { ...f, ma_kho: '' } : f);
    }
  }, [open, mode, current]);

  function setField<K extends keyof KhoForm>(key: K, value: KhoForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const pending = create.isPending || update.isPending;
  const tenDonVi = getCurrentCompany()?.tenDonVi ?? '';
  const { data: nhomKhoData } = useNhomKhoList();
  const nhomKhos = nhomKhoData ?? [];

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const onError = (err: unknown) =>
      setError(getApiError(err, 'Lưu thất bại, vui lòng thử lại.'));

    if (mode === 'edit' && current) {
      update.mutate({ maKho: current.ma_kho, body: form }, { onSuccess: onClose, onError });
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
                label="Đơn vị"
                value={tenDonVi}
                disabled
                sx={{ flex: 1 }}
              />
              <TextField
                label="Mã kho"
                required
                autoFocus
                value={form.ma_kho}
                onChange={(e) => setField('ma_kho', e.target.value.toUpperCase())}
                disabled={mode === 'edit'}
                sx={{ width: 120 }}
              />
            </Stack>
            <TextField
              label="Tên kho"
              required
              fullWidth
              value={form.ten_kho}
              onChange={(e) => setField('ten_kho', e.target.value)}
            />
            <TextField
              label="Tên khác"
              fullWidth
              value={form.ten_kho2}
              onChange={(e) => setField('ten_kho2', e.target.value)}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                select
                label="Nhóm kho"
                value={form.ma_nh}
                onChange={(e) => setField('ma_nh', e.target.value)}
                sx={{ flex: 1 }}
              >
                <MenuItem value="">
                  <em>— Không chọn —</em>
                </MenuItem>
                {form.ma_nh !== '' &&
                  !nhomKhos.some((n) => n.ma_nh === form.ma_nh) && (
                    <MenuItem value={form.ma_nh}>{form.ma_nh}</MenuItem>
                  )}
                {nhomKhos.map((n) => (
                  <MenuItem key={n.ma_nh} value={n.ma_nh}>
                    {n.ma_nh} — {n.ten_nh}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Trạng thái"
                value={form.status}
                onChange={(e) => setField('status', e.target.value)}
                sx={{ width: 150 }}
              >
                <MenuItem value="1">Đang dùng</MenuItem>
                <MenuItem value="0">Ngừng dùng</MenuItem>
              </TextField>
            </Stack>
            <FormControlLabel
              control={
                <Switch
                  checked={form.dai_ly_yn}
                  onChange={(e) => setField('dai_ly_yn', e.target.checked)}
                />
              }
              label="Là kho đại lý"
            />
            <TextField
              label="Ghi chú"
              fullWidth
              multiline
              minRows={2}
              value={form.ghi_chu}
              onChange={(e) => setField('ghi_chu', e.target.value)}
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
