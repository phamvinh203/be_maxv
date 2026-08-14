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
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import {
  useDeletePlan,
  useUpdatePlan,
} from '@/features/subscriptions/hooks/useSubscriptions';
import { apiErrorMessage, isHttpStatus } from '@/lib/apiError';
import type { Plan } from '@/features/subscriptions/types/subscription';

interface Props {
  plan: Plan;
  onClose: () => void;
}

/**
 * Xác nhận xóa gói. Backend chỉ cho xóa cứng gói CHƯA từng dùng; gói đã có thuê bao
 * hoặc lịch sử trả 409 — khi đó đổi hành động chính thành "Chuyển sang Ngừng bán"
 * (soft-delete) để admin không phải mở lại form Sửa.
 */
export function DeletePlanDialog({ plan, onClose }: Props): JSX.Element {
  const del = useDeletePlan();
  const update = useUpdatePlan();

  const inUse = isHttpStatus(del.error, 409);
  const pending = del.isPending || update.isPending;

  function handleDelete(): void {
    del.mutate(plan.id, { onSuccess: onClose });
  }

  function handleDeactivate(): void {
    update.mutate(
      { id: plan.id, input: { isActive: false } },
      { onSuccess: onClose },
    );
  }

  return (
    <Dialog
      open
      onClose={pending ? undefined : onClose}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle>Xóa gói dịch vụ</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Typography variant="body2">
            Xóa vĩnh viễn gói <b>{plan.ten}</b> ({plan.ma})? Thao tác này không
            hoàn tác được.
          </Typography>
          {del.isError && (
            <Alert severity={inUse ? 'warning' : 'error'}>
              {apiErrorMessage(del.error)}
            </Alert>
          )}
          {update.isError && (
            <Alert severity="error">{apiErrorMessage(update.error)}</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={pending}>
          Đóng
        </Button>
        {inUse && plan.isActive ? (
          <Button
            variant="contained"
            color="warning"
            onClick={handleDeactivate}
            disabled={pending}
          >
            {update.isPending ? 'Đang lưu…' : 'Chuyển sang Ngừng bán'}
          </Button>
        ) : (
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteOutlineRoundedIcon />}
            onClick={handleDelete}
            disabled={pending || inUse}
          >
            {del.isPending ? 'Đang xóa…' : 'Xóa gói'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
