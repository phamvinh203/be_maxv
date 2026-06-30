import { Suspense, type JSX } from 'react';
import {
  Box,
  Chip,
  Divider,
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
import { Loading } from '@/components/Loading';
import { useCompany } from '@/features/companies/hooks/useCompanies';
import { CompanyActions } from './CompanyActions';
import { CompanyOverview } from './CompanyOverview';

export function CompanyDetail({ id }: { id: string }): JSX.Element {
  const { data } = useCompany(id);

  return (
    <Stack spacing={3}>
      {/* Header + thao tác */}
      <Stack
        direction="row"
        sx={{
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {data.tenDonVi}
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', mt: 0.5 }}
          >
            <Typography color="text.secondary">MST: {data.maSoThue}</Typography>
            <StatusChip status={data.status} />
          </Stack>
        </Box>
        <CompanyActions id={data.id} status={data.status} />
      </Stack>

      {/* Thuê bao */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Thuê bao
        </Typography>
        {data.subscription ? (
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Chip label={data.subscription.plan.ten} color="primary" />
            <Typography>{data.subscription.status}</Typography>
            <Typography color="text.secondary">
              Hết hạn:{' '}
              {data.subscription.ketThuc
                ? new Date(data.subscription.ketThuc).toLocaleDateString('vi-VN')
                : '—'}
            </Typography>
          </Stack>
        ) : (
          <Typography color="text.secondary">Chưa có thuê bao</Typography>
        )}
      </Paper>

      {/* Người dùng */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Người dùng ({data.users.length})
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Họ tên</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Vai trò</TableCell>
              <TableCell>Kích hoạt</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.hoTen}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.role}</TableCell>
                <TableCell>{u.isActive ? '✓' : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Divider />

      {/* Tổng quan DB tenant — chỉ tải khi DB đã sẵn sàng */}
      {data.dbName ? (
        <Suspense fallback={<Loading />}>
          <CompanyOverview id={id} />
        </Suspense>
      ) : (
        <Typography color="text.secondary">
          Chưa có DB để xem tổng quan (provisioning chưa hoàn tất).
        </Typography>
      )}
    </Stack>
  );
}
