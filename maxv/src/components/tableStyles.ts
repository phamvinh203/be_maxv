import type { SxProps, Theme } from '@mui/material';

/** Khung Paper bọc bảng (bo góc + viền + bóng nhẹ). Dùng chung mọi bảng admin. */
export const tableCardSx: SxProps<Theme> = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 3,
  overflow: 'hidden',
  boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)',
};

/** Style cho TableRow của TableHead (nền nhạt, chữ hoa nhỏ). */
export const tableHeadRowSx: SxProps<Theme> = {
  '& th': {
    bgcolor: '#f8fafc',
    color: 'text.secondary',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: '1px solid',
    borderColor: 'divider',
  },
};
