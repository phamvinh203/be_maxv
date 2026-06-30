import type { JSX } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Paper,
} from '@mui/material';
import { StatusChip } from '@/components/StatusChip';
import { tableCardSx, tableHeadRowSx } from '@/components/tableStyles';
import { formatDate } from '@/lib/format';
import { useCompanies } from '@/features/companies/hooks/useCompanies';
import type { ListCompaniesParams } from '@/features/companies/types/company';

interface Props {
  params: Required<Pick<ListCompaniesParams, 'page' | 'pageSize'>> &
    ListCompaniesParams;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function CompaniesTable({
  params,
  onPageChange,
  onPageSizeChange,
}: Props): JSX.Element {
  const navigate = useNavigate();
  const { data } = useCompanies(params);

  return (
    <Paper elevation={0} sx={tableCardSx}>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow sx={tableHeadRowSx}>
              <TableCell>Mã số thuế</TableCell>
              <TableCell>Tên đơn vị</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell>Tên DB</TableCell>
              <TableCell>Ngày tạo</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.data.map((c) => (
              <TableRow
                key={c.id}
                hover
                sx={{
                  cursor: 'pointer',
                  '&:last-child td': { border: 0 },
                  '& td': { py: 1.75 },
                }}
                onClick={() =>
                  navigate({
                    to: '/companies/$companyId',
                    params: { companyId: c.id },
                  })
                }
              >
                <TableCell sx={{ fontWeight: 600 }}>{c.maSoThue}</TableCell>
                <TableCell>{c.tenDonVi}</TableCell>
                <TableCell>
                  <StatusChip status={c.status} />
                </TableCell>
                <TableCell>
                  <Box
                    component="span"
                    sx={{
                      fontFamily: 'ui-monospace, Consolas, monospace',
                      fontSize: 13,
                      color: 'text.secondary',
                    }}
                  >
                    {c.dbName ?? '—'}
                  </Box>
                </TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>
                  {formatDate(c.createdAt)}
                </TableCell>
              </TableRow>
            ))}
            {data.data.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                  Không có đơn vị nào
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
