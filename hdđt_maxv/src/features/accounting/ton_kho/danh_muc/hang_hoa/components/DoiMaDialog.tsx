import { useEffect, useState, type FormEvent, type JSX } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import { getApiError } from '@/lib/apiClient';
import { useDoiMaHangHoa } from '@/features/accounting/ton_kho/danh_muc/hang_hoa/hooks/useHangHoa';

interface Props {
  open: boolean;
  /** Mã đang chọn để đổi (điền sẵn ô "mã cũ"). */
  maCu: string;
  onClose: () => void;
}

export function DoiMaDialog({ open, maCu, onClose }: Props): JSX.Element {
  const { mutate, isPending } = useDoiMaHangHoa();
  const [maMoi, setMaMoi] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset form khi dialog vừa mở, không phải đồng bộ liên tục
      setMaMoi('');
      setError('');
    }
  }, [open]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    mutate(
      { ma_cu: maCu, ma_moi: maMoi.trim() },
      {
        onSuccess: onClose,
        onError: (err) => setError(getApiError(err, 'Đổi mã thất bại.')),
      },
    );
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle>Đổi / gộp mã hàng</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <DialogContentText sx={{ fontSize: 13 }}>
              Đổi mã sẽ cập nhật toàn bộ dữ liệu liên quan (quy đổi ĐVT, tồn
              đầu kỳ...). Không thể hoàn tác.
            </DialogContentText>
            <TextField label="Mã cũ" value={maCu} disabled fullWidth />
            <TextField
              label="Mã mới"
              required
              autoFocus
              fullWidth
              value={maMoi}
              onChange={(e) => setMaMoi(e.target.value)}
              sx={{ '& input': { textTransform: 'uppercase' } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={isPending}>
            Hủy
          </Button>
          <Button type="submit" variant="contained" disabled={isPending}>
            {isPending ? 'Đang đổi...' : 'Đổi mã'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
