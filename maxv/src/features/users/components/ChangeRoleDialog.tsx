import { useState, type JSX } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useChangeUserRole } from '@/features/users/hooks/useUsers';
import {
  ASSIGNABLE_ROLES,
  ROLE_LABELS,
  type AdminUser,
  type Role,
} from '@/features/users/types/user';

interface Props {
  user: AdminUser; // mount khi cần (key ở parent) -> state luôn tươi
  onClose: () => void;
}

export function ChangeRoleDialog({ user, onClose }: Props): JSX.Element {
  const { mutate, isPending, isError } = useChangeUserRole();
  const [role, setRole] = useState<Role>(user.role);

  function handleSubmit(): void {
    mutate({ id: user.id, role }, { onSuccess: onClose });
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Đổi vai trò</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Người dùng: <b>{user.hoTen}</b> ({user.email})
          </Typography>
          {isError && <Alert severity="error">Không đổi được vai trò</Alert>}
          <TextField
            select
            label="Vai trò"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            fullWidth
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <MenuItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Hủy bỏ
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={isPending || role === user.role}
        >
          {isPending ? 'Đang lưu…' : 'Lưu'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
