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
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import { SubStatusChip } from './SubStatusChip';
import { tableCardSx, tableHeadRowSx } from '@/components/tableStyles';
import { formatVnd, formatDate } from '@/lib/format';
import type { Subscription } from '@/features/subscriptions/types/subscription';

interface Props {
  rows: Subscription[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onChangePlan: (sub: Subscription) => void;
  onHistory: (sub: Subscription) => void;
  onCancel: (sub: Subscription) => void;
}

export function SubscriptionsTable({
  rows,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onChangePlan,
  onHistory,
  onCancel,
}: Props): JSX.Element {
  return (
    <Paper elevation={0} sx={tableCardSx}>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow sx={tableHeadRowSx}>
              <TableCell>Đơn vị</TableCell>
              <TableCell>Gói</TableCell>
              <TableCell>Giá</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell>Bắt đầu</TableCell>
              <TableCell>Kết thúc</TableCell>
              <TableCell align="right">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.id} hover sx={{ '& td': { py: 1.5 } }}>
                <TableCell>
                  <Box sx={{ fontWeight: 600 }}>{s.donVi.tenDonVi}</Box>
                  <Box sx={{ fontSize: 12.5, color: 'text.secondary' }}>
                    MST: {s.donVi.maSoThue}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ fontWeight: 600 }}>{s.plan.ten}</Box>
                  <Box sx={{ fontSize: 12.5, color: 'text.secondary' }}>
                    {s.plan.ma}
                  </Box>
                </TableCell>
                <TableCell>{formatVnd(s.plan.gia)}</TableCell>
                <TableCell>
                  <SubStatusChip status={s.status} />
                </TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>
                  {formatDate(s.batDau)}
                </TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>
                  {formatDate(s.ketThuc)}
                </TableCell>
                <TableCell align="right">
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ justifyContent: 'flex-end' }}
                  >
                    <Button
                      size="small"
                      startIcon={<SwapHorizRoundedIcon />}
                      onClick={() => onChangePlan(s)}
                    >
                      Đổi gói
                    </Button>
                    <Button
                      size="small"
                      color="inherit"
                      startIcon={<HistoryRoundedIcon />}
                      onClick={() => onHistory(s)}
                    >
                      Lịch sử
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<CancelRoundedIcon />}
                      disabled={s.status === 'CANCELED'}
                      onClick={() => onCancel(s)}
                    >
                      Hủy
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  align="center"
                  sx={{ py: 6, color: 'text.secondary' }}
                >
                  Không có thuê bao phù hợp
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
