import type { JSX } from 'react';
import {
  Box,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import type { Employee } from '@/features/company/types/company';

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Chủ sở hữu',
  OWNER_EMPLOYEE: 'Nhân viên',
};

interface Props {
  employees: Employee[];
}

export function EmployeesTable({ employees }: Props): JSX.Element {
  return (
    <Paper elevation={0} variant="outlined">
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nhân viên</TableCell>
              <TableCell>Chức vụ</TableCell>
              <TableCell>Vai trò</TableCell>
              <TableCell>Trạng thái</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {employees.map((emp) => (
              <TableRow key={emp.id} hover>
                <TableCell>
                  <Box sx={{ fontWeight: 600 }}>{emp.hoTen}</Box>
                  <Box sx={{ fontSize: 12.5, color: 'text.secondary' }}>{emp.email}</Box>
                </TableCell>
                <TableCell>{emp.chucVu ?? '—'}</TableCell>
                <TableCell>
                  <Chip
                    label={ROLE_LABELS[emp.role] ?? emp.role}
                    color={emp.role === 'OWNER' ? 'primary' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>{emp.isActive ? 'Đang hoạt động' : 'Chưa kích hoạt'}</TableCell>
              </TableRow>
            ))}
            {employees.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                  Chưa có nhân viên nào
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
