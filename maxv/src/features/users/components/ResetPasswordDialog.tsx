import type { JSX } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import type { KetQuaDatLaiMatKhau } from '../api/usersApi';

interface Props {
  ketQua: KetQuaDatLaiMatKhau;
  onClose: () => void;
}

/**
 * Kết quả đặt lại mật khẩu. Máy chủ KHÔNG trả mật khẩu mới: mật khẩu cũ bị vô hiệu, mọi phiên bị đăng
 * xuất, người dùng tự đặt mật khẩu mới bằng "Quên mật khẩu" (theo email hướng dẫn máy chủ gửi).
 */
export function ResetPasswordDialog({ ketQua, onClose }: Props): JSX.Element {
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Đã đặt lại mật khẩu</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Typography variant="body2">
            Mật khẩu cũ của <b>{ketQua.email}</b> không còn dùng được và mọi phiên đăng nhập đã bị
            đăng xuất.
          </Typography>
          {ketQua.daGuiEmail ? (
            <Alert severity="success">
              Đã gửi email hướng dẫn tới {ketQua.email}. Người dùng bấm &quot;Quên mật khẩu&quot; ở
              trang đăng nhập để nhận mã và tự đặt mật khẩu mới.
            </Alert>
          ) : (
            <Alert severity="warning">
              Không gửi được email hướng dẫn. Hãy báo người dùng bấm &quot;Quên mật khẩu&quot; ở trang
              đăng nhập, nhập {ketQua.email} để nhận mã và tự đặt mật khẩu mới.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          Đã hiểu
        </Button>
      </DialogActions>
    </Dialog>
  );
}
