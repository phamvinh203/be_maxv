import type { JSX, ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import ConstructionRoundedIcon from '@mui/icons-material/ConstructionRounded';

interface Props {
  title: string;
  description?: string;
  icon?: ReactNode;
}

/** Trạng thái rỗng cho các tab đã có route nhưng chưa triển khai. */
export function ComingSoon({ title, description, icon }: Props): JSX.Element {
  return (
    <Stack spacing={2.5}>
      <Typography variant="h4">{title}</Typography>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: 1.5,
          py: 10,
          px: 3,
          borderRadius: 3,
          border: '1px dashed',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Box
          sx={{
            width: 64,
            height: 64,
            display: 'grid',
            placeItems: 'center',
            borderRadius: '50%',
            color: 'primary.main',
            bgcolor: 'rgba(14,159,110,0.1)',
          }}
        >
          {icon ?? <ConstructionRoundedIcon fontSize="large" />}
        </Box>
        <Typography variant="h6">Đang phát triển</Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 440 }}>
          {description ?? 'Chức năng này sẽ sớm có mặt trong bản cập nhật tới.'}
        </Typography>
      </Box>
    </Stack>
  );
}
