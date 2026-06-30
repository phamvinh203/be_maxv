import { useState, type JSX } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useChangePlan } from '@/features/subscriptions/hooks/useSubscriptions';
import { formatVnd } from '@/lib/format';
import type {
  Plan,
  Subscription,
} from '@/features/subscriptions/types/subscription';

interface Props {
  subscription: Subscription | null;
  plans: Plan[];
  onClose: () => void;
}

export function ChangePlanDialog({
  subscription,
  plans,
  onClose,
}: Props): JSX.Element {
  const { mutate, isPending, isError } = useChangePlan();
  const [planId, setPlanId] = useState('');
  const [ghiChu, setGhiChu] = useState('');

  // Chỉ cho chọn gói đang bán + khác gói hiện tại.
  const options = plans.filter(
    (p) => p.isActive && p.id !== subscription?.planId,
  );

  function handleSubmit(): void {
    if (!subscription || !planId) return;
    mutate(
      { id: subscription.id, planId, ghiChu: ghiChu || undefined },
      { onSuccess: onClose },
    );
  }

  return (
    <Dialog open={Boolean(subscription)} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Đổi gói thuê bao</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {subscription && (
            <Typography variant="body2" color="text.secondary">
              Đơn vị: <b>{subscription.donVi.tenDonVi}</b> — gói hiện tại:{' '}
              <b>{subscription.plan.ten}</b>
            </Typography>
          )}
          {isError && <Alert severity="error">Không đổi được gói</Alert>}

          <TextField
            select
            label="Gói mới"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            fullWidth
          >
            {options.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.ten} — {formatVnd(p.gia)}
                {p.chuKyThang > 0 ? `/${p.chuKyThang} tháng` : ''}
              </MenuItem>
            ))}
            {options.length === 0 && (
              <MenuItem disabled value="">
                Không có gói khả dụng khác
              </MenuItem>
            )}
          </TextField>

          <TextField
            label="Ghi chú (tùy chọn)"
            value={ghiChu}
            onChange={(e) => setGhiChu(e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Hủy bỏ
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!planId || isPending}
        >
          {isPending ? 'Đang đổi…' : 'Xác nhận'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
