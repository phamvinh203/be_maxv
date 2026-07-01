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
import { formatDate } from '@/lib/format';
import type { AdminInvite } from '@/features/invites/types/invite';

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
              <TableCell>Nhân viên</TableCell>
              <TableCell>Chức vụ</TableCell>
              <TableCell>Công ty</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell>Ngày gửi</TableCell>
              <TableCell align="right">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((invite) => {
              const pending = invite.status === 'PENDING';
              return (
                <TableRow key={invite.id} hover sx={{ '& td': { py: 1.5 } }}>
                  <TableCell>
                    <Box sx={{ fontWeight: 600 }}>{invite.hoTen}</Box>
                    <Box sx={{ fontSize: 12.5, color: 'text.secondary' }}>
                      {invite.email}
                    </Box>
                  </TableCell>
                  <TableCell>{invite.chucVu}</TableCell>
                  <TableCell>
                    {invite.donVi.tenDonVi}
                    <Box sx={{ fontSize: 12.5, color: 'text.secondary' }}>
                      MST: {invite.donVi.maSoThue}
                    </Box>
                  </TableCell>
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
                  <TableCell align="right">
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ justifyContent: 'flex-end' }}
                    >
                      <Button
                        size="small"
                        color="success"
                        startIcon={<CheckRoundedIcon />}
                        disabled={!pending}
                        onClick={() => onApprove(invite)}
                      >
                        Duyệt
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        startIcon={<CloseRoundedIcon />}
                        disabled={!pending}
                        onClick={() => onReject(invite)}
                      >
                        Từ chối
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  align="center"
                  sx={{ py: 6, color: 'text.secondary' }}
                >
                  Không có lời mời phù hợp
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
