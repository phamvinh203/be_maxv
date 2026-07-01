import { useState, type JSX } from 'react';
import {
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
  invite: AdminInvite;
  onClose: () => void;
}

export function RejectInviteDialog({ invite, onClose }: Props): JSX.Element {
  const { mutate, isPending } = useRejectInvite();
  const [reason, setReason] = useState('');

  function submit(): void {
    mutate({ id: invite.id, reason: reason.trim() || undefined }, { onSuccess: onClose });
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Từ chối lời mời</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Email: <b>{invite.email}</b>
          </Typography>
          <TextField
            label="Lý do (không bắt buộc)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Hủy
        </Button>
        <Button variant="contained" color="error" onClick={submit} disabled={isPending}>
          {isPending ? 'Đang xử lý…' : 'Từ chối'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
