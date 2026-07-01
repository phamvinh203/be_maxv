import type { JSX } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { useApproveInvite } from '@/features/invites/hooks/useInvites';
import type { AdminInvite } from '@/features/invites/types/invite';

interface Props {
  invite: AdminInvite; // mount khi cần (key ở parent) -> state luôn tươi
  onClose: () => void;
}

export function ApproveInviteDialog({ invite, onClose }: Props): JSX.Element {
  const { mutate, isPending, isError } = useApproveInvite();

  function handleSubmit(): void {
    mutate(invite.id, { onSuccess: onClose });
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Duyệt lời mời nhân viên</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Duyệt <b>{invite.hoTen}</b> ({invite.email}) vào công ty{' '}
            <b>{invite.donVi.tenDonVi}</b>?
          </Typography>
          <Alert severity="info">
            Hệ thống sẽ tạo tài khoản và gửi mật khẩu đăng nhập qua email{' '}
            <b>{invite.email}</b>.
          </Alert>
          {isError && (
            <Alert severity="error">
              Không duyệt được — có thể do gửi email thất bại, vui lòng thử lại.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Hủy bỏ
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={isPending}>
          {isPending ? 'Đang duyệt…' : 'Duyệt'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
