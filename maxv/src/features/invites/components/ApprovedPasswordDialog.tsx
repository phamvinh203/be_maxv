import { useState, type JSX } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';

interface Props {
  email: string;
  password: string;
  onClose: () => void;
}

/** Hiện mật khẩu tạm đã cấp cho nhân viên (đã gửi email) đúng 1 lần. */
export function ApprovedPasswordDialog({ email, password, onClose }: Props): JSX.Element {
  const [copied, setCopied] = useState(false);

  function copy(): void {
    void navigator.clipboard.writeText(password);
    setCopied(true);
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Đã duyệt lời mời</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Alert severity="success">Đã gửi mật khẩu tạm tới {email}.</Alert>
          <Typography variant="body2" color="text.secondary">
            Mật khẩu chỉ hiển thị một lần ở đây — phòng khi email không tới nơi.
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Box
              sx={{
                flexGrow: 1,
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: 'action.hover',
                fontFamily: 'ui-monospace, Consolas, monospace',
                fontSize: 18,
                letterSpacing: '0.04em',
              }}
            >
              {password}
            </Box>
            <Tooltip title={copied ? 'Đã sao chép' : 'Sao chép'}>
              <IconButton onClick={copy} color={copied ? 'success' : 'default'}>
                <ContentCopyRoundedIcon />
              </IconButton>
            </Tooltip>
          </Stack>
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
