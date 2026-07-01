import type { JSX } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { InviteStatusChip } from '@/features/company/components/InviteStatusChip';
import { formatDate } from '@/lib/format';
import type { CompanyInvite } from '@/features/company/types/company';

interface Props {
  invites: CompanyInvite[];
}

export function PendingInvitesTable({ invites }: Props): JSX.Element {
  return (
    <Paper elevation={0} variant="outlined">
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Người được mời</TableCell>
              <TableCell>Chức vụ</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell>Ngày gửi</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invites.map((invite) => (
              <TableRow key={invite.id} hover>
                <TableCell>
                  <Box sx={{ fontWeight: 600 }}>{invite.hoTen}</Box>
                  <Box sx={{ fontSize: 12.5, color: 'text.secondary' }}>{invite.email}</Box>
                </TableCell>
                <TableCell>{invite.chucVu}</TableCell>
                <TableCell>
                  <InviteStatusChip status={invite.status} />
                  {invite.status === 'REJECTED' && invite.lyDoTuChoi && (
                    <Box sx={{ fontSize: 12.5, color: 'text.secondary', mt: 0.5 }}>
                      {invite.lyDoTuChoi}
                    </Box>
                  )}
                </TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>
                  {formatDate(invite.createdAt)}
                </TableCell>
              </TableRow>
            ))}
            {invites.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                  Chưa có lời mời nào
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
