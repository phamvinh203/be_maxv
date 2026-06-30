import type { JSX } from 'react';
import {
  Box,
  Button,
  Chip,
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
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import LockOpenRoundedIcon from '@mui/icons-material/LockOpenRounded';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import KeyRoundedIcon from '@mui/icons-material/KeyRounded';
import { UserStatusChip } from './UserStatusChip';
import { tableCardSx, tableHeadRowSx } from '@/components/tableStyles';
import { formatDate } from '@/lib/format';
import { ROLE_LABELS, type AdminUser } from '@/features/users/types/user';

interface Props {
  rows: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
  meId: string | undefined;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onToggleActive: (user: AdminUser) => void;
  onChangeRole: (user: AdminUser) => void;
  onResetPassword: (user: AdminUser) => void;
}

export function UsersTable({
  rows,
  total,
  page,
  pageSize,
  meId,
  onPageChange,
  onPageSizeChange,
  onToggleActive,
  onChangeRole,
  onResetPassword,
}: Props): JSX.Element {
  return (
    <Paper elevation={0} sx={tableCardSx}>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow sx={tableHeadRowSx}>
              <TableCell>Người dùng</TableCell>
              <TableCell>Vai trò</TableCell>
              <TableCell>Đơn vị</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell>Kích hoạt</TableCell>
              <TableCell>Ngày tạo</TableCell>
              <TableCell align="right">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((u) => {
              const self = u.id === meId;
              const lock = u.isActive
                ? { color: 'warning' as const, icon: <LockRoundedIcon />, label: 'Khóa' }
                : { color: 'success' as const, icon: <LockOpenRoundedIcon />, label: 'Mở khóa' };
              const activeChip = u.isActive
                ? { label: 'Đang hoạt động', color: 'success' as const, variant: 'filled' as const }
                : { label: 'Đã khóa', color: 'default' as const, variant: 'outlined' as const };
              return (
                <TableRow key={u.id} hover sx={{ '& td': { py: 1.5 } }}>
                  <TableCell>
                    <Box sx={{ fontWeight: 600 }}>{u.hoTen}</Box>
                    <Box sx={{ fontSize: 12.5, color: 'text.secondary' }}>
                      {u.email}
                      {u.sdt ? ` · ${u.sdt}` : ''}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={ROLE_LABELS[u.role]}
                      size="small"
                      variant="outlined"
                      color={u.role === 'ADMIN' ? 'primary' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    {u.donVi ? (
                      u.donVi.tenDonVi
                    ) : (
                      <Box component="span" sx={{ color: 'text.secondary' }}>
                        Hệ thống
                      </Box>
                    )}
                  </TableCell>
                  <TableCell>
                    <UserStatusChip status={u.status} />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={activeChip.label}
                      size="small"
                      color={activeChip.color}
                      variant={activeChip.variant}
                    />
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>
                    {formatDate(u.createdAt)}
                  </TableCell>
                  <TableCell align="right">
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ justifyContent: 'flex-end' }}
                    >
                      <Button
                        size="small"
                        color={lock.color}
                        startIcon={lock.icon}
                        disabled={self}
                        onClick={() => onToggleActive(u)}
                      >
                        {lock.label}
                      </Button>
                      <Button
                        size="small"
                        color="inherit"
                        startIcon={<BadgeRoundedIcon />}
                        disabled={self || u.role === 'ADMIN'}
                        onClick={() => onChangeRole(u)}
                      >
                        Vai trò
                      </Button>
                      <Button
                        size="small"
                        color="inherit"
                        startIcon={<KeyRoundedIcon />}
                        onClick={() => onResetPassword(u)}
                      >
                        Đặt lại MK
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  align="center"
                  sx={{ py: 6, color: 'text.secondary' }}
                >
                  Không có người dùng phù hợp
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
