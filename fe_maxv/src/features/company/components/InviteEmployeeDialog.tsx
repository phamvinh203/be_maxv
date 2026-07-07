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
  Typography,
} from '@mui/material';
import { useInviteEmployee } from '@/features/company/hooks/useCompany';
import { getCurrentCompany } from '@/features/auth/hooks/useAuth';
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

  // Nhân viên được cấp quyền vào đúng MST đang mở (chọn ở Select trên header).
  const current = getCurrentCompany();

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
    if (!current) {
      setError('Chưa xác định được công ty đang làm việc. Vui lòng chọn MST trên thanh tiêu đề.');
      return;
    }
    mutate(
      {
        hoTen: form.hoTen.trim(),
        email: form.email.trim(),
        chucVu: form.chucVu.trim(),
        donViIds: [current.id],
      },
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
            {current && (
              <Typography sx={{ fontSize: 13, color: '#475569' }}>
                Cấp quyền vào công ty:{' '}
                <b>
                  {current.maSoThue} — {current.tenDonVi}
                </b>
              </Typography>
            )}
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
