import type { JSX } from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';

interface Props {
  title: string;
  /** Các trường dự kiến (sẽ nhập được khi backend bổ sung cột tương ứng). */
  fields: string[];
}

/**
 * Khung tab chưa có dữ liệu lưu — các trường liệt kê chưa có cột trong model m81
 * nên tạm hiển thị dạng chip, tránh cho nhập rồi lưu bị mất.
 */
export function PlaceholderTab({ title, fields }: Props): JSX.Element {
  return (
    <Box sx={{ py: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Các trường dưới đây sẽ nhập được khi backend bổ sung cột tương ứng.
      </Typography>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
        {fields.map((f) => (
          <Chip key={f} label={f} size="small" variant="outlined" />
        ))}
      </Stack>
    </Box>
  );
}
