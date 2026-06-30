import type { JSX } from 'react';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useSubscriptionHistory } from '@/features/subscriptions/hooks/useSubscriptions';
import { formatVnd, formatDateTime } from '@/lib/format';

interface Props {
  subscriptionId: string | null;
  title?: string;
  onClose: () => void;
}

export function HistoryDialog({
  subscriptionId,
  title,
  onClose,
}: Props): JSX.Element {
  const { data, isLoading } = useSubscriptionHistory(subscriptionId);

  return (
    <Dialog
      open={Boolean(subscriptionId)}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>Lịch sử thuê bao{title ? ` — ${title}` : ''}</DialogTitle>
      <DialogContent sx={{ pb: 2 }}>
        {isLoading && (
          <Typography color="text.secondary" sx={{ py: 2 }}>
            Đang tải…
          </Typography>
        )}
        {data && data.length === 0 && (
          <Typography color="text.secondary" sx={{ py: 2 }}>
            Chưa có lịch sử
          </Typography>
        )}
        {data && data.length > 0 && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Thời gian</TableCell>
                <TableCell>Hành động</TableCell>
                <TableCell>Gói</TableCell>
                <TableCell>Giá trị</TableCell>
                <TableCell>Ghi chú</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((h) => (
                <TableRow key={h.id}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {formatDateTime(h.createdAt)}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{h.hanhDong}</TableCell>
                  <TableCell>{h.plan?.ten ?? '—'}</TableCell>
                  <TableCell>{h.giaTri ? formatVnd(h.giaTri) : '—'}</TableCell>
                  <TableCell>
                    <Box
                      component="span"
                      sx={{ color: 'text.secondary', fontSize: 13 }}
                    >
                      {h.ghiChu ?? '—'}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
