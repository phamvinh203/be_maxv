import type { JSX } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tooltip,
} from '@mui/material';
import { LevelChip } from './LevelChip';
import { tableCardSx, tableHeadRowSx } from '@/components/tableStyles';
import { formatDateTime } from '@/lib/format';
import { useLogs } from '@/features/logs/hooks/useLogs';
import type { ListLogsParams } from '@/features/logs/types/log';

interface Props {
  params: Required<Pick<ListLogsParams, 'page' | 'pageSize'>> & ListLogsParams;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

function mono(value: string | null): JSX.Element {
  if (!value) return <Box component="span" sx={{ color: 'text.disabled' }}>—</Box>;
  return (
    <Tooltip title={value}>
      <Box
        component="span"
        sx={{
          fontFamily: 'ui-monospace, Consolas, monospace',
          fontSize: 12.5,
          color: 'text.secondary',
        }}
      >
        {value.length > 10 ? `${value.slice(0, 8)}…` : value}
      </Box>
    </Tooltip>
  );
}

export function LogsTable({
  params,
  onPageChange,
  onPageSizeChange,
}: Props): JSX.Element {
  const { data } = useLogs(params);

  return (
    <Paper elevation={0} sx={tableCardSx}>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={tableHeadRowSx}>
              <TableCell>Thời gian</TableCell>
              <TableCell>Mức</TableCell>
              <TableCell>Hành động</TableCell>
              <TableCell>Người dùng</TableCell>
              <TableCell>Đơn vị</TableCell>
              <TableCell>IP</TableCell>
              <TableCell>Chi tiết</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.data.map((log) => (
              <TableRow key={log.id} hover sx={{ '& td': { py: 1.25 } }}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {formatDateTime(log.createdAt)}
                </TableCell>
                <TableCell>
                  <LevelChip level={log.level} />
                </TableCell>
                <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {log.hanhDong}
                </TableCell>
                <TableCell>{mono(log.userId)}</TableCell>
                <TableCell>{mono(log.donViId)}</TableCell>
                <TableCell>{mono(log.ip)}</TableCell>
                <TableCell sx={{ maxWidth: 280 }}>
                  {log.chiTiet ? (
                    <Box
                      component="span"
                      sx={{
                        fontFamily: 'ui-monospace, Consolas, monospace',
                        fontSize: 12.5,
                        color: 'text.secondary',
                        wordBreak: 'break-all',
                      }}
                    >
                      {JSON.stringify(log.chiTiet)}
                    </Box>
                  ) : (
                    <Box component="span" sx={{ color: 'text.disabled' }}>
                      —
                    </Box>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {data.data.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  align="center"
                  sx={{ py: 6, color: 'text.secondary' }}
                >
                  Không có nhật ký phù hợp
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
        rowsPerPageOptions={[20, 50, 100]}
        labelRowsPerPage="Số dòng/trang"
      />
    </Paper>
  );
}
