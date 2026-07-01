import type { JSX } from 'react';
import {
  Box,
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
} from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { InviteStatusChip } from './InviteStatusChip';
import { tableCardSx, tableHeadRowSx } from '@/components/tableStyles';
import { formatDateTime } from '@/lib/format';
import { ROLE_LABELS, type AdminInvite } from '@/features/invites/types/invite';

interface Props {
  rows: AdminInvite[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onApprove: (invite: AdminInvite) => void;
  onReject: (invite: AdminInvite) => void;
}

export function InvitesTable({
  rows,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onApprove,
  onReject,
}: Props): JSX.Element {
  return (
    <Paper elevation={0} sx={tableCardSx}>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow sx={tableHeadRowSx}>
              <TableCell>Email</TableCell>
              <TableCell>Công ty</TableCell>
              <TableCell>Người yêu cầu</TableCell>
              <TableCell>Vai trò</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell>Ngày gửi</TableCell>
              <TableCell align="right">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((inv) => (
              <TableRow key={inv.id} hover sx={{ '& td': { py: 1.5 } }}>
                <TableCell sx={{ fontWeight: 600 }}>{inv.email}</TableCell>
                <TableCell>
                  {inv.donVi.tenDonVi}
                  <Box sx={{ fontSize: 12, color: 'text.secondary' }}>{inv.donVi.maSoThue}</Box>
                </TableCell>
                <TableCell>{inv.requestedBy.hoTen}</TableCell>
                <TableCell>{ROLE_LABELS[inv.role]}</TableCell>
                <TableCell>
                  <InviteStatusChip status={inv.status} />
                  {inv.status === 'REJECTED' && inv.lyDoTuChoi && (
                    <Box sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
                      {inv.lyDoTuChoi}
                    </Box>
                  )}
                </TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>
                  {formatDateTime(inv.createdAt)}
                </TableCell>
                <TableCell align="right">
                  {inv.status === 'PENDING' && (
                    <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                      <Button
                        size="small"
                        color="success"
                        startIcon={<CheckRoundedIcon />}
                        onClick={() => onApprove(inv)}
                      >
                        Duyệt
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        startIcon={<CloseRoundedIcon />}
                        onClick={() => onReject(inv)}
                      >
                        Từ chối
                      </Button>
                    </Stack>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                  Không có lời mời nào
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={total}
        page={page - 1}
        rowsPerPage={pageSize}
        onPageChange={(_e, p) => onPageChange(p + 1)}
        onRowsPerPageChange={(e) => onPageSizeChange(Number(e.target.value))}
        rowsPerPageOptions={[10, 20, 50]}
        labelRowsPerPage="Số dòng/trang"
      />
    </Paper>
  );
}
