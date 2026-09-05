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
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import { SubStatusChip } from './SubStatusChip';
import { tableCardSx, tableHeadRowSx } from '@/components/tableStyles';
import { formatVnd, formatDate } from '@/lib/format';
import type { Subscription } from '@/features/subscriptions/types/subscription';
import { hetHanNhungStatusChuaDoi } from '@/features/subscriptions/hieuLuc';

interface Props {
  rows: Subscription[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onChangePlan: (sub: Subscription) => void;
  onHistory: (sub: Subscription) => void;
  onRenew: (sub: Subscription) => void;
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
  onRenew,
  onCancel,
}: Props): JSX.Element {
  return (
    <Paper elevation={0} sx={tableCardSx}>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow sx={tableHeadRowSx}>
              <TableCell>Tài khoản</TableCell>
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
                  <Box sx={{ fontWeight: 600 }}>{s.owner.hoTen}</Box>
                  <Box sx={{ fontSize: 12.5, color: 'text.secondary' }}>
                    {s.owner.email} · {s.owner._count.ownedDonVi} MST
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
                  <SubStatusChip status={s.status} ketThuc={s.ketThuc} />
                </TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>
                  {formatDate(s.batDau)}
                </TableCell>
                <TableCell
                  sx={{
                    color: hetHanNhungStatusChuaDoi(s.status, s.ketThuc)
                      ? 'error.main'
                      : 'text.secondary',
                    fontWeight: hetHanNhungStatusChuaDoi(s.status, s.ketThuc)
                      ? 600
                      : 400,
                  }}
                >
                  {formatDate(s.ketThuc) || 'Không hết hạn'}
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
                      color="success"
                      startIcon={<AutorenewRoundedIcon />}
                      // Thuê bao đã hủy phải mở lại bằng "Đổi gói" — hủy là quyết định
                      // nghiệp vụ, gia hạn không được lặng lẽ đảo ngược nó (backend cũng
                      // chặn, đây chỉ là chặn sớm cho đỡ tốn một lượt gọi).
                      disabled={s.status === 'CANCELED'}
                      onClick={() => onRenew(s)}
                    >
                      Gia hạn
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
