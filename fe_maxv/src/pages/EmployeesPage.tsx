import { Suspense, useState, type JSX } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { getApiError } from '@/lib/apiClient';
import { useEmployees, useInviteEmployee } from '@/features/employees/hooks/useEmployees';
import {
  INVITE_ROLES,
  ROLE_LABELS,
  STATUS_LABELS,
  type Employee,
  type InviteRole,
} from '@/features/employees/types/employee';

interface Props {
  onBack: () => void;
}

const STATUS_COLOR: Record<Employee['status'], 'warning' | 'success' | 'error'> = {
  PENDING: 'warning',
  ACTIVE: 'success',
  REJECTED: 'error',
};

function InviteDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const { mutate, isPending, error } = useInviteEmployee();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InviteRole>('KE_TOAN');

  function submit(): void {
    mutate({ email, role }, { onSuccess: onClose });
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Mời nhân viên</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {error && <Alert severity="error">{getApiError(error)}</Alert>}
          <TextField
            label="Email nhân viên"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            autoFocus
          />
          <TextField
            select
            label="Vai trò"
            value={role}
            onChange={(e) => setRole(e.target.value as InviteRole)}
            fullWidth
          >
            {INVITE_ROLES.map((r) => (
              <MenuItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Hủy
        </Button>
        <Button variant="contained" onClick={submit} disabled={isPending || !email.trim()}>
          {isPending ? 'Đang gửi…' : 'Gửi lời mời'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function EmployeesTable(): JSX.Element {
  const { data } = useEmployees();
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Họ tên</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>Vai trò</TableCell>
            <TableCell>Trạng thái</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((e) => (
            <TableRow key={e.id} hover>
              <TableCell>{e.hoTen}</TableCell>
              <TableCell>{e.email}</TableCell>
              <TableCell>{ROLE_LABELS[e.role]}</TableCell>
              <TableCell>
                <Chip size="small" label={STATUS_LABELS[e.status]} color={STATUS_COLOR[e.status]} />
              </TableCell>
            </TableRow>
          ))}
          {data.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                Chưa có nhân viên nào
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function EmployeesPage({ onBack }: Props): JSX.Element {
  const [inviting, setInviting] = useState(false);

  return (
    <Box sx={{ p: 3, height: '100%', overflowY: 'auto' }}>
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Button onClick={onBack} color="inherit">
            ← Quay lại
          </Button>
          <Typography variant="h6">Quản lý nhân viên</Typography>
        </Stack>
        <Button variant="contained" onClick={() => setInviting(true)}>
          Mời nhân viên
        </Button>
      </Stack>

      <Suspense fallback={<Typography color="text.secondary">Đang tải…</Typography>}>
        <EmployeesTable />
      </Suspense>

      {inviting && <InviteDialog onClose={() => setInviting(false)} />}
    </Box>
  );
}
