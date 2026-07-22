import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Dialog from "@mui/material/Dialog";
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
import { getCaptcha, loginGdt } from "../features/hddt/api/gdt";
import { getErrorMessage } from "../lib/errors";
import logoThueNhaNuoc from "../assets/logo_thue_nha_nuoc.jpg";

/** Giữ dialog thêm 1s sau khi đăng nhập thành công để người dùng kịp thấy báo thành công. */
const SUCCESS_CLOSE_DELAY_MS = 1000;

interface Props {
  open: boolean;
  onClose: () => void;
  /** `mst` là tên đăng nhập (tenant) vừa dùng để login GDT. */
  onLoginSuccess?: (token: string, mst: string) => void;
  /** Điền sẵn MST (vd đã biết từ form công ty) — người dùng chỉ cần nhập mật khẩu/captcha. */
  initialUsername?: string;
}

/**
 * Dialog đăng nhập Thuế điện tử (GDT): nhập MST + mật khẩu + captcha. Thành công thì gọi
 * `onLoginSuccess(token, mst)` để lưu vào phiên GDT. Captcha lấy qua useQuery, login qua useMutation.
 * Dùng: `CompanyFormDialog` (nút "Đăng nhập vào hóa đơn điện tử").
 */
export default function DialogLoginHddt({
  open,
  onClose,
  onLoginSuccess,
  initialUsername,
}: Props) {
  const [username, setUsername] = useState(""); // = MST
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [captchaInput, setCaptchaInput] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // Captcha: mỗi lần mở dialog lấy phiên mới (staleTime 0 -> tự fetch lại khi enabled bật).
  // Key gắn id riêng từng instance để không rò/đè phiên captcha giữa các dialog cùng lúc.
  const captchaId = useId();
  const captchaQuery = useQuery({
    queryKey: ["gdtCaptcha", captchaId],
    queryFn: getCaptcha,
    enabled: open,
    staleTime: 0,
    retry: false,
  });
  const captcha = captchaQuery.data;
  const loadingCaptcha = captchaQuery.isFetching;

  const loginMutation = useMutation({ mutationFn: loginGdt });
  const submitting = loginMutation.isPending;

  // Ẩn ảnh captcha cũ khi lấy captcha lỗi — tránh người dùng nhập theo phiên đã hỏng.
  const captchaSrc = useMemo(
    () =>
      captcha?.content && !captchaQuery.isError
        ? `data:image/svg+xml;utf8,${encodeURIComponent(captcha.content)}`
        : undefined,
    [captcha?.content, captchaQuery.isError],
  );

  const displayError =
    error ||
    (captchaQuery.isError ? "Không lấy được mã captcha. Vui lòng bấm tải lại." : "");

  /** Lấy captcha mới + xóa ô nhập cũ. Dùng: nút refresh cạnh ảnh captcha, và khi login thất bại. */
  const refreshCaptcha = () => {
    setCaptchaInput("");
    void captchaQuery.refetch();
  };

  // Mở dialog -> reset form (giữ sẵn MST nếu được truyền vào); captcha tự nạp qua useQuery.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUsername(initialUsername ?? "");
    setPassword("");
    setCaptchaInput("");
    setError("");
    setDone(false);
  }, [open, initialUsername]);

  /**
   * Đăng nhập xong -> để người dùng kịp đọc "Đăng nhập thành công." rồi tự đóng sau 1s.
   * Đóng ngay lập tức thì dialog biến mất trước khi mắt kịp thấy báo thành công.
   *
   * Gọi `onClose` qua ref, KHÔNG để nó vào deps: nơi gọi thường truyền arrow inline (đổi định danh
   * mỗi lần cha re-render, vd dialog Đồng bộ poll tiến độ 2s/lần) -> effect chạy lại và reset timer
   * liên tục, dialog có thể không bao giờ tự đóng.
   */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => onCloseRef.current(), SUCCESS_CLOSE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [done]);

  /** Validate + gọi loginGdt; thành công báo lên qua onLoginSuccess, thất bại thì lấy captcha mới. Dùng: submit form (nút "Đăng nhập" hoặc phím Enter). */
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting || done) return;
    setError("");
    if (!username || !password || !captchaInput || !captcha?.key) {
      setError("Vui lòng nhập đầy đủ thông tin.");
      return;
    }
    const mst = username.trim();
    loginMutation.mutate(
      { mst, password, captcha: captchaInput.trim(), key: captcha.key },
      {
        onSuccess: (res) => {
          setDone(true);
          if (res.token) onLoginSuccess?.(res.token, mst);
        },
        onError: (e) => {
          setError(getErrorMessage(e, "Đăng nhập thất bại."));
          setCaptchaInput("");
          void captchaQuery.refetch(); // sai captcha/thông tin -> lấy captcha mới
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 2, overflow: "hidden" } } }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 2.5,
          py: 1.5,
        }}
      >
        <Box
          component="img"
          src={logoThueNhaNuoc}
          alt="Thuế điện tử"
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1,
            objectFit: "contain",
          }}
        />
        <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>
          Đăng nhập
        </Typography>
        <IconButton aria-label="Đóng" onClick={onClose} size="small">
          <Close fontSize="small" />
        </IconButton>
      </Box>
      <Box sx={{ height: 3, bgcolor: "primary.main" }} />

      {/* Bọc form để nhấn Enter ở bất kỳ ô nhập nào cũng submit được. */}
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogContent sx={{ pt: 3, pb: 1 }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 2.5,
              mb: 3,
            }}
          >
            <TextField
              label="Tên đăng nhập"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              fullWidth
              autoFocus={!initialUsername}
              autoComplete="username"
            />

            <TextField
              label="Mật khẩu"
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              autoFocus={!!initialUsername}
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
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 2.5,
              alignItems: "start",
            }}
          >
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Mã captcha
              </Typography>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
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
                  onClick={refreshCaptcha}
                  disabled={loadingCaptcha}
                  size="small"
                >
                  <Refresh />
                </IconButton>
              </Stack>
            </Box>

            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                <Typography component="span" color="error">
                  *{" "}
                </Typography>
                Nhập mã captcha
              </Typography>
              <TextField
                placeholder="Nhập mã captcha"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
                size="small"
                fullWidth
              />
            </Box>
          </Box>

          <Typography
            variant="body2"
            color="primary"
            sx={{ cursor: "pointer", alignSelf: "flex-start", mt: 2 }}
          >
            Quên mật khẩu
          </Typography>

          {displayError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {displayError}
            </Alert>
          )}
          {done && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Đăng nhập thành công.
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ justifyContent: "center", pb: 3 }}>
          <Button
            type="submit"
            variant="contained"
            color="primary"
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
      </Box>
    </Dialog>
  );
}
