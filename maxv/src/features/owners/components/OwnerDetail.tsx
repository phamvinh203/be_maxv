import type { JSX } from 'react';
import {
  Box,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { StatusChip } from '@/components/StatusChip';
import { UserStatusChip } from '@/features/users/components/UserStatusChip';
import { formatBytes, formatDate } from '@/lib/format';
import { useOwner } from '@/features/owners/hooks/useOwners';
import { OwnerLimitsForm } from './OwnerLimitsForm';

export function OwnerDetail({ id }: { id: string }): JSX.Element {
  const { data } = useOwner(id);

  return (
    <Stack spacing={3}>
      {/* Header */}
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {data.hoTen}
        </Typography>
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', mt: 0.5 }}
        >
          <Typography color="text.secondary">{data.email}</Typography>
          {data.sdt && (
            <Typography color="text.secondary">· {data.sdt}</Typography>
          )}
          <UserStatusChip status={data.status} />
        </Stack>
      </Box>

      {/* Tổng quan số liệu */}
      <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
        <StatCard label="Công ty / MST" value={String(data.soCongTy)} />
        <StatCard label="Nhân viên" value={String(data.soNhanVien)} />
        <StatCard label="Tổng dung lượng DB" value={formatBytes(data.tongDbBytes)} />
        <StatCard
          label="Gói"
          value={data.subscription?.plan.ten ?? 'Chưa có gói'}
        />
      </Stack>

      {/* Giới hạn (override) */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="h6" gutterBottom>
          Giới hạn tài khoản
        </Typography>
        <OwnerLimitsForm
          ownerId={data.id}
          gioiHan={data.gioiHan}
          override={data.override}
          hasSubscription={data.subscription !== null}
        />
      </Paper>

      {/* Công ty / MST / DB */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Công ty & database ({data.congTy.length})
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Mã số thuế</TableCell>
              <TableCell>Tên công ty</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell>Database</TableCell>
              <TableCell align="right">Dung lượng</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.congTy.map((c) => (
              <TableRow key={c.id}>
                <TableCell sx={{ fontWeight: 600 }}>{c.maSoThue}</TableCell>
                <TableCell>{c.tenDonVi}</TableCell>
                <TableCell>
                  <StatusChip status={c.status} />
                </TableCell>
                <TableCell>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: 'center' }}
                  >
                    <Box
                      component="span"
                      sx={{
                        fontFamily: 'ui-monospace, Consolas, monospace',
                        fontSize: 13,
                        color: 'text.secondary',
                      }}
                    >
                      {c.dbName ?? '—'}
                    </Box>
                    {c.dbName && !c.dbExists && (
                      <Chip
                        label="thiếu DB"
                        size="small"
                        color="error"
                        variant="outlined"
                      />
                    )}
                  </Stack>
                </TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary' }}>
                  {formatBytes(c.dbSizeBytes)}
                </TableCell>
              </TableRow>
            ))}
            {data.congTy.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  align="center"
                  sx={{ py: 4, color: 'text.secondary' }}
                >
                  Chưa tạo công ty nào
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* Nhân viên */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Nhân viên ({data.nhanVien.length})
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Họ tên</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Chức vụ</TableCell>
              <TableCell align="center">Số MST được cấp</TableCell>
              <TableCell align="center">Kích hoạt</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.nhanVien.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.hoTen}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.chucVu ?? '—'}</TableCell>
                <TableCell align="center">{u.donViAccess.length}</TableCell>
                <TableCell align="center">{u.isActive ? '✓' : '—'}</TableCell>
              </TableRow>
            ))}
            {data.nhanVien.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  align="center"
                  sx={{ py: 4, color: 'text.secondary' }}
                >
                  Chưa có nhân viên
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
        Tạo lúc {formatDate(data.createdAt)}
      </Typography>
    </Stack>
  );
}

function StatCard({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <Paper
      variant="outlined"
      sx={{ px: 2.5, py: 1.5, minWidth: 160, flex: '1 1 160px' }}
    >
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 20, fontWeight: 700 }}>{value}</Typography>
    </Paper>
  );
}
