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
} from '@mui/material';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';

interface Props {
  password: string;
  onClose: () => void;
}

/** Hiện mật khẩu mới đúng 1 lần để admin gửi cho người dùng. */
export function ResetPasswordDialog({ password, onClose }: Props): JSX.Element {
  const [copied, setCopied] = useState(false);

  function copy(): void {
    void navigator.clipboard.writeText(password);
    setCopied(true);
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Mật khẩu mới</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Alert severity="warning">
            Mật khẩu chỉ hiển thị một lần. Hãy sao chép và gửi cho người dùng.
          </Alert>
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
