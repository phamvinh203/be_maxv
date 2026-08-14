import type { JSX } from 'react';
import { Button, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { DetailGrid } from '@/features/accounting/ban_hang/chung_tu/hoa_don_ban_hang/components/DetailGrid';
import type { LineForm } from '@/features/accounting/ban_hang/chung_tu/hoa_don_ban_hang/types';

interface Props {
  lines: LineForm[];
  ro: boolean;
  onLineChange: (idx: number, patch: Partial<LineForm>) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
}

/** Tab "Chi tiết" = mục Chi tiết hàng bán (tiêu đề + nút thêm dòng + bảng). */
export function ChiTietTab({ lines, ro, onLineChange, onAdd, onRemove }: Props): JSX.Element {
  return (
    <>
      <Stack direction="row" sx={{ alignItems: 'center', mb: 1, gap: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Chi tiết hàng bán
        </Typography>
        {!ro && (
          <Button size="small" startIcon={<AddIcon />} onClick={onAdd} sx={{ ml: 'auto' }}>
            Thêm dòng
          </Button>
        )}
      </Stack>
      <DetailGrid lines={lines} ro={ro} onLineChange={onLineChange} onRemove={onRemove} />
    </>
  );
}
