import { useEffect, useId, useState, type FormEvent } from "react";
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

import { getDvcCaptcha, loginDvc } from "../../features/dich_vu_cong/api/dvc";
import { getErrorMessage } from "../../lib/errors";
import logoThueNhaNuoc from "../../assets/logo_thue_nha_nuoc.jpg";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Điền sẵn MST công ty đang chọn — người dùng chỉ phải nhập mật khẩu và captcha. */
  initialUsername?: string;
  /** Báo khóa phiên đã đăng nhập ra ngoài để các lượt tra cứu sau dùng lại. */
  onLoginSuccess?: (key: string) => void;
}

/**
 * Lấy `message` cổng trả về, nếu có.
 *
 * TẠM THỜI: dạng phản hồi của `POST /tthc/loginLDAP` khi đăng nhập ĐÚNG và khi SAI chưa
 * chốt được — cổng trả 200 cho cả hai. Quy ước tạm: có `message` là cổng đang chê điều gì
 * đó, không có thì coi như xong. Có một lượt đăng nhập thật để đối chiếu là siết lại được
 * cả ở đây lẫn trong `gdt-dvc.service.ts`.
 */
function messageCuaCong(data: unknown): string | null {
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const status = String(obj.status ?? obj.code ?? "");
    const msg =
      (typeof obj.desc === "string" && obj.desc.trim()) ||
      (typeof obj.message === "string" && obj.message.trim()) ||
      (typeof obj.error === "string" && obj.error.trim()) ||
      null;

    const isSuccess =
      status === "0" ||
      status === "200" ||
      status.toUpperCase() === "SUCCESS" ||
      status.toUpperCase() === "OK" ||
      obj.success === true;

    if (!isSuccess || status === "999" || obj.status === "FAIL" || obj.status === "ERROR") {
      return msg || "Đăng nhập cổng Dịch vụ công không thành công.";
    }
  }
  if (typeof data === "string" && data.trim()) return data.trim();
  return null;
}

/**
 * Dialog đăng nhập cổng Dịch vụ công — giao diện dựng theo `dialogLoginHddt`.
 *
 * Captcha lấy qua `useQuery`, đăng nhập qua `useMutation`, đều đi vòng qua BE
 * (`/api/v1/dvc/*`) vì cổng không mở CORS và cookie phiên là `HttpOnly`.
 *
 * KHÔNG tự điền mã captcha như bản HĐĐT: captcha cổng này là ảnh PNG có nhiễu, không phải
 * SVG, nên mẹo đọc vân tay đường vẽ bên `features/hddt/captcha/` không áp dụng được.
 */
export default function DialogLoginDVC({
  open,
  onClose,
  initialUsername,
  onLoginSuccess,
}: Props) {
  const [username, setUsername] = useState(""); // = tên đăng nhập cổng DVC
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [captchaInput, setCaptchaInput] = useState("");
  const [error, setError] = useState("");
  // Đã điền sẵn tên đăng nhập thì con trỏ nhảy thẳng xuống ô mật khẩu.
  const daCoTenDangNhap = !!initialUsername;
  const [thanhCong, setThanhCong] = useState(false);

  // Mỗi lần mở dialog là một phiên captcha mới (staleTime 0 -> tự fetch khi `enabled` bật).
  // Khóa gắn id riêng từng instance để hai dialog mở cùng lúc không đè phiên của nhau.
  const captchaId = useId();
  const captchaQuery = useQuery({
    queryKey: ["dvcCaptcha", captchaId],
    queryFn: getDvcCaptcha,
    enabled: open,
    staleTime: 0,
    // Cổng chặn tần suất gắt — retry tự động chỉ làm dính 429 nhanh hơn.
    retry: false,
  });
  const captcha = captchaQuery.data;
  const loadingCaptcha = captchaQuery.isFetching;

  const loginMutation = useMutation({ mutationFn: loginDvc });
  const submitting = loginMutation.isPending;

  const displayError =
    error ||
    (captchaQuery.isError
      ? getErrorMessage(captchaQuery.error, "Không lấy được mã captcha. Vui lòng bấm tải lại.")
      : "");

  /** Lấy captcha mới + xóa ô nhập cũ. Dùng: nút refresh, và sau khi đăng nhập hỏng. */
  const refreshCaptcha = () => {
    setCaptchaInput("");
    void captchaQuery.refetch();
  };

  /*
   * Mở dialog -> reset form (giữ sẵn MST nếu được truyền vào).
   *
   * CỐ Ý không đụng tới `captchaInput` và không có `captcha` trong deps: ô đó do effect
   * bên dưới làm chủ. Trước đây effect này cũng ghi ô captcha nên phải kéo `captcha.answer`
   * vào deps, thành ra mỗi lần có captcha mới là cả thân effect chạy lại — nuốt luôn mật
   * khẩu người dùng đang gõ dở và xóa Alert lỗi vừa hiện, vì đường lấy captcha mới nào
   * cũng đi qua đây.
   */
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUsername(initialUsername ?? "");
    setPassword("");
    setError("");
    setThanhCong(false);
  }, [open, initialUsername]);

  // TỰ ĐIỀN MÃ CAPTCHA: mỗi khi backend trả về kết quả OCR (`captcha.answer`),
  // tự động điền vào ô nhập. Người dùng vẫn có thể sửa tay nếu thấy OCR đọc sai.
  useEffect(() => {
    if (!captcha?.answer) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCaptchaInput(captcha.answer);
  }, [captcha?.key, captcha?.answer]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setThanhCong(false);

    if (!username || !password || !captchaInput || !captcha?.key) {
      setError("Vui lòng nhập đầy đủ thông tin.");
      return;
    }

    loginMutation.mutate(
      {
        key: captcha.key,
        tenDN: username.trim(),
        matKhau: password,
        captcha: captchaInput.trim(),
      },
      {
        onSuccess: (res) => {
          // Chừng nào chưa chốt được dạng phản hồi, in nguyên body ra console để còn đối
          // chiếu — đây là thứ duy nhất còn thiếu để phân biệt đăng nhập đúng với sai.
          console.info("[DVC-LOGIN] cổng trả về:", res.data);

          const msg = messageCuaCong(res.data);
          if (msg) {
            // Cổng có nói gì đó -> nhiều khả năng là chê captcha/mật khẩu. Captcha đã bị
            // tiêu nên phải lấy mã mới bất kể đúng sai.
            setError(msg);
            refreshCaptcha();
            return;
          }

          setThanhCong(true);
          onLoginSuccess?.(res.key);
        },
        onError: (err) => {
          setError(getErrorMessage(err, "Đăng nhập cổng Dịch vụ công thất bại."));
          refreshCaptcha();
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
          alt="Dịch vụ công"
          sx={{ width: 36, height: 36, borderRadius: 1, objectFit: "contain" }}
        />
        <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>
          Đăng nhập dịch vụ công
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
              autoFocus={!daCoTenDangNhap}
              autoComplete="username"
            />

            <TextField
              label="Mật khẩu"
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              autoFocus={daCoTenDangNhap}
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
                  ) : captcha?.image && !captchaQuery.isError ? (
                    <Box
                      component="img"
                      src={captcha.image}
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
                  disabled={loadingCaptcha || submitting}
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
            sx={{ cursor: "pointer", mt: 2 }}
          >
            Quên mật khẩu
          </Typography>

          {displayError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {displayError}
            </Alert>
          )}
          {thanhCong && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Đã đăng nhập cổng Dịch vụ công.
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ justifyContent: "center", pb: 3 }}>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={submitting}
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
