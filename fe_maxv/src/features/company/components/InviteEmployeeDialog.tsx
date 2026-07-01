import { useState, type ChangeEvent, type FormEvent, type JSX } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import { useInviteEmployee } from '@/features/company/hooks/useCompany';
import { getApiError } from '@/lib/apiClient';

interface Props {
  open: boolean;
  onClose: () => void;
}

const EMPTY_FORM = { hoTen: '', email: '', chucVu: '' };

export function InviteEmployeeDialog({ open, onClose }: Props): JSX.Element {
  const { mutate, isPending } = useInviteEmployee();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  function set(field: keyof typeof EMPTY_FORM) {
    return (e: ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function handleClose() {
    setForm(EMPTY_FORM);
    setError('');
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    mutate(
      { hoTen: form.hoTen.trim(), email: form.email.trim(), chucVu: form.chucVu.trim() },
      {
        onSuccess: handleClose,
        onError: (err) =>
          setError(getApiError(err, 'Gửi lời mời thất bại. Vui lòng thử lại.')),
      },
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle>Thêm nhân viên</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Họ và tên"
              required
              fullWidth
              autoFocus
              value={form.hoTen}
              onChange={set('hoTen')}
            />
            <TextField
              label="Email"
              type="email"
              required
              fullWidth
              value={form.email}
              onChange={set('email')}
            />
            <TextField
              label="Chức vụ"
              required
              fullWidth
              placeholder="VD: Kế toán trưởng"
              value={form.chucVu}
              onChange={set('chucVu')}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={isPending}>
            Hủy
          </Button>
          <Button type="submit" variant="contained" disabled={isPending}>
            {isPending ? 'Đang gửi...' : 'Gửi lời mời'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
