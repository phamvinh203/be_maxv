import { useState, type JSX } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DeleteForeverRoundedIcon from '@mui/icons-material/DeleteForeverRounded';
import { useDeleteUser } from '@/features/users/hooks/useUsers';
import { apiErrorMessage } from '@/lib/apiError';
import { ROLE_LABELS, type AdminUser } from '@/features/users/types/user';

interface Props {
  user: AdminUser;
  onClose: () => void;
}

export function DeleteUserDialog({ user, onClose }: Props): JSX.Element {
  const del = useDeleteUser();
  const [confirm, setConfirm] = useState('');

  const soMst = user.role === 'OWNER' ? user._count.ownedDonVi : 0;
  const soNhanVien = user._count.employees;
  // So sánh y hệt backend (`emailRule` chuẩn hóa trim + lowercase) để nút bấm được
  // đúng lúc request sẽ đi qua — chặn ở UI mà server vẫn 409 thì admin không hiểu vì sao.
  const khop = confirm.trim().toLowerCase() === user.email.toLowerCase();

  function handleDelete(): void {
    del.mutate(
      { id: user.id, email: confirm.trim().toLowerCase() },
      { onSuccess: onClose },
    );
  }

  return (
    <Dialog
      open
      onClose={del.isPending ? undefined : onClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>Xóa vĩnh viễn tài khoản</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Typography variant="body2">
            <b>{user.hoTen}</b> ({user.email}) — {ROLE_LABELS[user.role]}
          </Typography>

          <Alert severity="error">
            <AlertTitle>Thao tác này không hoàn tác được</AlertTitle>
            Xóa tài khoản sẽ xóa theo:
            <Box component="ul" sx={{ pl: 2.5, my: 0.5 }}>
              <li>
                <b>{soMst}</b> công ty/MST — kèm <b>xóa hẳn database</b> chứa
                toàn bộ dữ liệu kế toán của từng MST
              </li>
              <li>
                <b>{soNhanVien}</b> tài khoản nhân viên thuộc tài khoản này
              </li>
              <li>Thuê bao, lịch sử quyền truy cập MST và các lời mời đang chờ</li>
            </Box>
            Dữ liệu đã xóa không khôi phục được kể cả từ bản sao lưu của ứng dụng.
          </Alert>

          <TextField
            label="Gõ lại email để xác nhận"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={user.email}
            fullWidth
            autoComplete="off"
            disabled={del.isPending}
            helperText={`Phải khớp chính xác: ${user.email}`}
          />

          {del.isError && (
            <Alert severity="error">{apiErrorMessage(del.error)}</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={del.isPending}>
          Hủy bỏ
        </Button>
        <Button
          variant="contained"
          color="error"
          startIcon={<DeleteForeverRoundedIcon />}
          onClick={handleDelete}
          disabled={!khop || del.isPending}
        >
          {del.isPending ? 'Đang xóa…' : 'Xóa vĩnh viễn'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
