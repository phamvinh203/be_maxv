import { useState, type JSX } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useRejectInvite } from '@/features/invites/hooks/useInvites';
import type { AdminInvite } from '@/features/invites/types/invite';

interface Props {
  invite: AdminInvite; // mount khi cần (key ở parent) -> state luôn tươi
  onClose: () => void;
}

export function RejectInviteDialog({ invite, onClose }: Props): JSX.Element {
  const { mutate, isPending, isError } = useRejectInvite();
  const [lyDoTuChoi, setLyDoTuChoi] = useState('');

  function handleSubmit(): void {
    mutate(
      { id: invite.id, lyDoTuChoi: lyDoTuChoi.trim() || undefined },
      { onSuccess: onClose },
    );
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Từ chối lời mời</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Từ chối <b>{invite.hoTen}</b> ({invite.email})?
          </Typography>
          {isError && <Alert severity="error">Không từ chối được, vui lòng thử lại</Alert>}
          <TextField
            label="Lý do (không bắt buộc)"
            value={lyDoTuChoi}
            onChange={(e) => setLyDoTuChoi(e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Hủy bỏ
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={handleSubmit}
          disabled={isPending}
        >
          {isPending ? 'Đang từ chối…' : 'Từ chối'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
