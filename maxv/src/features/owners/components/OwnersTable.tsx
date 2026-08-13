import type { JSX } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  Box,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Paper,
  Typography,
} from '@mui/material';
import { tableCardSx, tableHeadRowSx } from '@/components/tableStyles';
import { formatDate, formatLimit } from '@/lib/format';
import { useOwners } from '@/features/owners/hooks/useOwners';
import type { ListOwnersParams } from '@/features/owners/types/owner';
import { MODULE_KEYS, MODULE_META } from '@/features/owners/modules';

interface Props {
  params: ListOwnersParams & { page: number; pageSize: number };
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

/** "dùng / trần" theo gói — đỏ khi đã chạm trần. */
function Usage({
  used,
  limit,
}: {
  used: number;
  limit: number | null;
}): JSX.Element {
  const atLimit = limit != null && used >= limit;
  return (
    <Typography
      component="span"
      sx={{ fontWeight: 600, color: atLimit ? 'error.main' : 'text.primary' }}
    >
      {used} / {formatLimit(limit)}
    </Typography>
  );
}

export function OwnersTable({
  params,
  onPageChange,
  onPageSizeChange,
}: Props): JSX.Element {
  const navigate = useNavigate();
  const { data } = useOwners(params);

  return (
    <Paper elevation={0} sx={tableCardSx}>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow sx={tableHeadRowSx}>
              <TableCell>Tài khoản</TableCell>
              <TableCell>Gói</TableCell>
              <TableCell>MST (dùng / trần)</TableCell>
              <TableCell>Nhân viên (dùng / trần)</TableCell>
              {MODULE_KEYS.map((k) => (
                <TableCell key={k} align="center">
                  {MODULE_META[k].nhanNgan}
                </TableCell>
              ))}
              <TableCell>Ngày tạo</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.data.map((o) => (
              <TableRow
                key={o.id}
                hover
                sx={{
                  cursor: 'pointer',
                  '&:last-child td': { border: 0 },
                  '& td': { py: 1.75 },
                }}
                onClick={() =>
                  navigate({
                    to: '/owners/$ownerId',
                    params: { ownerId: o.id },
                  })
                }
              >
                <TableCell>
                  <Typography sx={{ fontWeight: 600 }}>{o.hoTen}</Typography>
                  <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                    {o.email}
                  </Typography>
                </TableCell>
                <TableCell>
                  {o.plan ? (
                    <Chip label={o.plan.ten} size="small" color="primary" />
                  ) : (
                    <Box component="span" sx={{ color: 'text.secondary' }}>
                      Chưa có gói
                    </Box>
                  )}
                </TableCell>
                <TableCell>
                  <Usage used={o.soCongTy} limit={o.gioiHan.soMstToiDa} />
                </TableCell>
                <TableCell>
                  <Usage used={o.soNhanVien} limit={o.gioiHan.soNguoiToiDa} />
                </TableCell>
                {MODULE_KEYS.map((k) => (
                  <TableCell key={k} align="center">
                    <Chip
                      size="small"
                      label={o.modules[k] ? 'Bật' : 'Tắt'}
                      color={o.modules[k] ? 'success' : 'default'}
                      variant={o.modules[k] ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                ))}
                <TableCell sx={{ color: 'text.secondary' }}>
                  {formatDate(o.createdAt)}
                </TableCell>
              </TableRow>
            ))}
            {data.data.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5 + MODULE_KEYS.length}
                  align="center"
                  sx={{ py: 6, color: 'text.secondary' }}
                >
                  Không có tài khoản nào
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={data.total}
        page={params.page - 1}
        rowsPerPage={params.pageSize}
        onPageChange={(_e, page) => onPageChange(page + 1)}
        onRowsPerPageChange={(e) => onPageSizeChange(Number(e.target.value))}
        rowsPerPageOptions={[10, 20, 50]}
        labelRowsPerPage="Số dòng/trang"
      />
    </Paper>
  );
}
