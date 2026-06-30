import type { JSX } from 'react';
import { Box, Card, CardContent, Stack, Typography } from '@mui/material';
import { useCompanyOverview } from '@/features/companies/hooks/useCompanies';

const COUNT_LABELS: Record<string, string> = {
  taiKhoan: 'Tài khoản',
  doiTuong: 'Đối tượng',
  chungTu: 'Chứng từ',
  chungTuDong: 'Dòng chứng từ',
  butToan: 'Bút toán',
};

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}): JSX.Element {
  return (
    <Card variant="outlined" sx={{ minWidth: 150, flex: '1 1 150px' }}>
      <CardContent>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

/** Tổng quan dữ liệu trong DB riêng của tenant (đếm bảng + dung lượng). */
export function CompanyOverview({ id }: { id: string }): JSX.Element {
  const { data } = useCompanyOverview(id);

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Tổng quan dữ liệu (DB tenant)</Typography>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {Object.entries(data.counts).map(([key, value]) => (
          <StatCard key={key} label={COUNT_LABELS[key] ?? key} value={value} />
        ))}
        <StatCard label="Dung lượng DB" value={data.dbSize} />
      </Box>

      <Typography variant="body2" color="text.secondary">
        Chứng từ gần nhất:{' '}
        {data.lastChungTuAt
          ? new Date(data.lastChungTuAt).toLocaleString('vi-VN')
          : '—'}
        {' · '}DB: {data.company.dbName ?? '—'}
      </Typography>
    </Stack>
  );
}
