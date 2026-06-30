import { useState, type JSX } from 'react';
import {
  Box,
  Button,
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
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { usePlans } from '@/features/subscriptions/hooks/useSubscriptions';
import { tableCardSx, tableHeadRowSx } from '@/components/tableStyles';
import { formatVnd } from '@/lib/format';
import { PlanFormDialog } from './PlanFormDialog';
import type { Plan } from '@/features/subscriptions/types/subscription';

export function PlansPanel(): JSX.Element {
  const { data: plans } = usePlans();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);

  function openCreate(): void {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(plan: Plan): void {
    setEditing(plan);
    setFormOpen(true);
  }

  return (
    <Stack spacing={1.5}>
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Typography variant="h6">Gói dịch vụ</Typography>
        <Button
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={openCreate}
        >
          Thêm gói
        </Button>
      </Stack>

      <Paper elevation={0} sx={tableCardSx}>
        <Table>
          <TableHead>
            <TableRow sx={tableHeadRowSx}>
              <TableCell>Mã</TableCell>
              <TableCell>Tên</TableCell>
              <TableCell>Giá</TableCell>
              <TableCell>Chu kỳ</TableCell>
              <TableCell>Số người tối đa</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell align="right">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {plans.map((p) => (
              <TableRow key={p.id} hover>
                <TableCell sx={{ fontWeight: 700 }}>{p.ma}</TableCell>
                <TableCell>{p.ten}</TableCell>
                <TableCell>{formatVnd(p.gia)}</TableCell>
                <TableCell>
                  {p.chuKyThang > 0 ? `${p.chuKyThang} tháng` : 'Dùng thử'}
                </TableCell>
                <TableCell>
                  {p.soNguoiToiDa ?? (
                    <Box component="span" sx={{ color: 'text.secondary' }}>
                      Không giới hạn
                    </Box>
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    label={p.isActive ? 'Đang bán' : 'Ngừng bán'}
                    color={p.isActive ? 'success' : 'default'}
                    size="small"
                    variant={p.isActive ? 'filled' : 'outlined'}
                  />
                </TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    startIcon={<EditRoundedIcon />}
                    onClick={() => openEdit(p)}
                  >
                    Sửa
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {formOpen && (
        <PlanFormDialog
          key={editing?.id ?? 'new'}
          open
          plan={editing}
          onClose={() => setFormOpen(false)}
        />
      )}
    </Stack>
  );
}
