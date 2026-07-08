import { useEffect, useMemo, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Close from "@mui/icons-material/Close";
import Refresh from "@mui/icons-material/Refresh";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import {
  type CaptchaInfo,
  getCaptcha,
  loginGdt,
} from "../features/hddt/api/gdt";

interface Props {
  open: boolean;
  onClose: () => void;
  onLoginSuccess?: (token: string) => void;
}

export default function DialogLoginHddt({
  open,
  onClose,
  onLoginSuccess,
}: Props) {
  const [username, setUsername] = useState(""); // = MST
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [captchaInput, setCaptchaInput] = useState("");
  const [captcha, setCaptcha] = useState<CaptchaInfo | null>(null);
  const [loadingCaptcha, setLoadingCaptcha] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const captchaSrc = useMemo(
    () =>
      captcha?.content
        ? `data:image/svg+xml;utf8,${encodeURIComponent(captcha.content)}`
        : undefined,
    [captcha?.content],
  );

  const fetchCaptcha = async () => {
    setError("");
    setLoadingCaptcha(true);
    try {
      setCaptcha(await getCaptcha());
      setCaptchaInput("");
    } catch {
      setError("Không lấy được mã captcha. Vui lòng bấm tải lại.");
    } finally {
      setLoadingCaptcha(false);
    }
  };

  // Mở dialog -> reset + lấy captcha mới
  useEffect(() => {
    if (open) {
      setUsername("");
      setPassword("");
      setCaptchaInput("");
      setError("");
      setDone(false);
      fetchCaptcha();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSubmit = async () => {
    setError("");
    if (!username || !password || !captchaInput || !captcha?.key) {
      setError("Vui lòng nhập đầy đủ thông tin.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await loginGdt({
        mst: username.trim(),
        password,
        captcha: captchaInput.trim(),
        key: captcha.key,
      });
      setDone(true);
      if (res.token) onLoginSuccess?.(res.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Đăng nhập thất bại.");
      fetchCaptcha(); // sai captcha/thông tin → lấy captcha mới
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle
        sx={{
          position: "relative",
          m: 0,
          p: 1.5,
          bgcolor: "primary.main",
          color: "primary.contrastText",
          fontWeight: 700,
        }}
      >
        Đăng nhập
        <IconButton
          aria-label="Đóng"
          onClick={onClose}
          sx={{
            position: "absolute",
            right: 8,
            top: 6,
            color: "primary.contrastText",
          }}
          size="small"
        >
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2, mt: 3, pb: 2 }}>
        <Stack spacing={3}>
          <TextField
            label="Tên đăng nhập"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            fullWidth
            autoFocus
            autoComplete="username"
          />

          <TextField
            label="Mật khẩu"
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            autoComplete="current-password"
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={showPw ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      onClick={() => setShowPw((s) => !s)}
                      edge="end"
                    >
                      {showPw ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />

          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Mã captcha{" "}
              <Typography component="span" color="error">
                * Nhập mã captcha
              </Typography>
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              sx={{ mt: 0.5, alignItems: "center" }}
            >
              <Box
                sx={{
                  height: 48,
                  minWidth: 150,
                  px: 1,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  bgcolor: "action.hover",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {loadingCaptcha ? (
                  <CircularProgress size={22} />
                ) : captchaSrc ? (
                  <Box
                    component="img"
                    src={captchaSrc}
                    alt="captcha"
                    sx={{ height: 38 }}
                  />
                ) : (
                  <Typography variant="caption" color="text.disabled">
                    —
                  </Typography>
                )}
              </Box>
              <IconButton
                aria-label="Lấy captcha mới"
                onClick={fetchCaptcha}
                disabled={loadingCaptcha}
                size="small"
              >
                <Refresh />
              </IconButton>
              <TextField
                placeholder="Nhập mã captcha"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
                size="small"
              />
            </Stack>
          </Box>

          <Typography
            variant="body2"
            color="primary"
            sx={{ cursor: "pointer", alignSelf: "flex-start" }}
          >
            Quên mật khẩu
          </Typography>

          {error && <Alert severity="error">{error}</Alert>}
          {done && <Alert severity="success">Đăng nhập thành công.</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ justifyContent: "center", pb: 3 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSubmit}
          disabled={submitting || done}
          sx={{ px: 5, fontWeight: 700 }}
        >
          {submitting ? (
            <CircularProgress size={22} color="inherit" />
          ) : (
            "Đăng nhập"
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
