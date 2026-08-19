import { useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Badge from "@mui/material/Badge";
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import ApartmentRounded from "@mui/icons-material/ApartmentRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import LoginRounded from "@mui/icons-material/LoginRounded";
import HowToRegRounded from "@mui/icons-material/HowToRegRounded";
import MenuBookRounded from "@mui/icons-material/MenuBookRounded";
import { useAuth } from "../features/auth/useAuth";
import { useActiveCompanyMst } from "../features/auth/useActiveCompanyMst";
import { useGdtSession } from "../features/hddt/gdtSession/useGdtSession";
import { useCompanySwitch } from "../features/company/hooks/useCompanySwitch";
import DialogLoginHddt from "./dialogLoginHddt";
import logoMaxv from "../assets/Logo_Maxv.png";

const HUONG_DAN_SU_DUNG_URL = "https://youtu.be/sVQpgkOtsyo?si=SIJmznWNTZg5ufVG";

export default function AppHeader() {
  const { user, logout, companies, currentCompanyId, modules } = useAuth();
  // MST công ty đang chọn — 1 định nghĩa duy nhất (dùng chung với luồng chọn token GDT).
  const currentMst = useActiveCompanyMst();
  const { clearGdtSession, getGdtToken, setGdtToken } = useGdtSession();
  const { switchingId, error: switchError, switchTo, clearError } = useCompanySwitch();
  const navigate = useNavigate();
  const [userMenuEl, setUserMenuEl] = useState<HTMLElement | null>(null);
  const [companyMenuEl, setCompanyMenuEl] = useState<HTMLElement | null>(null);
  const [gdtLoginOpen, setGdtLoginOpen] = useState(false);

  if (!user) return null;

  const initial = user.hoTen.trim().charAt(0).toUpperCase();
  const currentCompany = companies.find((c) => c.id === currentCompanyId);
  const switching = switchingId !== null;
  // Chỉ hiện nút đăng nhập HĐĐT khi công ty đang chọn đã có MST (không có MST thì không login GDT được).
  const gdtLoggedIn = !!currentMst && !!getGdtToken(currentMst);

  const handleSelectCompany = (id: string) => {
    setCompanyMenuEl(null);
    if (id === currentCompanyId) return;
    switchTo(id);
  };

  return (
    <AppBar position="static" color="primary" enableColorOnDark>
      <Toolbar sx={{ justifyContent: "space-between", gap: 2 }}>
        <Stack direction="row" spacing={3} sx={{ alignItems: "center" }}>
          <Box
            component="img"
            src={logoMaxv}
            alt="MAXV"
            sx={{ height: 32, width: "auto", display: "block", cursor: "pointer" }}
            onClick={() => navigate("/hoa-don-dien-tu")}
          />
          <Button
            color="inherit"
            onClick={() => navigate("/hoa-don-dien-tu")}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Hóa đơn điện tử
          </Button>

          <Button
            color="inherit"
            onClick={() => navigate("/dich-vu-cong")}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Dịch vụ công
          </Button>

          {/* Chỉ hiện khi admin đã bật module HRM cho tài khoản này. */}
          {modules.hrm && (
            <Button
              color="inherit"
              onClick={() => navigate("/hrm")}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              HRM
            </Button>
          )}

          {/* Chỉ hiện khi admin đã bật module Kế toán cho tài khoản này. */}
          {modules.accounting && (
            <Button
              color="inherit"
              onClick={() => navigate("/accounting")}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              Kế toán
            </Button>
          )}
          <Button
            color="inherit"
            component="a"
            href={HUONG_DAN_SU_DUNG_URL || undefined}
            target="_blank"
            rel="noopener noreferrer"
            startIcon={<MenuBookRounded fontSize="small" />}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Hướng dẫn sử dụng
          </Button>
        </Stack>

        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          {currentCompany && (
            <>
              <Button
                color="inherit"
                onClick={(e: MouseEvent<HTMLElement>) => setCompanyMenuEl(e.currentTarget)}
                startIcon={
                  switching ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : currentMst ? (
                    // Chấm trạng thái phiên HĐĐT của công ty đang chọn (xanh = đã đăng nhập trong tab này).
                    <Badge
                      variant="dot"
                      overlap="circular"
                      color={gdtLoggedIn ? "success" : "warning"}
                    >
                      <ApartmentRounded fontSize="small" />
                    </Badge>
                  ) : (
                    <ApartmentRounded fontSize="small" />
                  )
                }
                endIcon={<ExpandMoreRounded />}
                disabled={switching}
                sx={{ textTransform: "none" }}
              >
                {currentCompany.tenDonVi}
              </Button>
              <Menu
                anchorEl={companyMenuEl}
                open={!!companyMenuEl}
                onClose={() => setCompanyMenuEl(null)}
              >
                {companies.map((company) => (
                  <MenuItem
                    key={company.id}
                    selected={company.id === currentCompanyId}
                    onClick={() => handleSelectCompany(company.id)}
                  >
                    <ListItemIcon>
                      {company.id === currentCompanyId && (
                        <CheckRounded fontSize="small" color="primary" />
                      )}
                    </ListItemIcon>
                    <ListItemText primary={company.tenDonVi} secondary={company.maSoThue} />
                  </MenuItem>
                ))}
                <Divider />
                {/* Chỉ mở được khi công ty đang chọn đã có MST — không có MST thì không login GDT được. */}
                {currentMst && (
                  <MenuItem
                    onClick={() => {
                      setCompanyMenuEl(null);
                      setGdtLoginOpen(true);
                    }}
                  >
                    <ListItemIcon>
                      {gdtLoggedIn ? (
                        <HowToRegRounded fontSize="small" color="success" />
                      ) : (
                        <LoginRounded fontSize="small" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary="Đăng nhập hóa đơn điện tử"
                      secondary={
                        gdtLoggedIn
                          ? `Đã đăng nhập ${currentMst}`
                          : `MST ${currentMst}`
                      }
                    />
                  </MenuItem>
                )}
                <MenuItem
                  onClick={() => {
                    setCompanyMenuEl(null);
                    navigate("/settings");
                  }}
                >
                  Quản lý công ty/Hộ kinh doanh
                </MenuItem>
              </Menu>
            </>
          )}

          <IconButton
            onClick={(e: MouseEvent<HTMLElement>) => setUserMenuEl(e.currentTarget)}
            size="small"
          >
            <Avatar sx={{ width: 32, height: 32 }}>{initial}</Avatar>
          </IconButton>
          <Menu
            anchorEl={userMenuEl}
            open={!!userMenuEl}
            onClose={() => setUserMenuEl(null)}
          >
            <MenuItem disabled>
              <ListItemText primary={user.hoTen} secondary={user.email} />
            </MenuItem>
            <Divider />
            <MenuItem
              onClick={() => {
                setUserMenuEl(null);
                navigate("/settings");
              }}
            >
              <ListItemIcon>
                <SettingsRounded fontSize="small" />
              </ListItemIcon>
              Cài đặt
            </MenuItem>
            <MenuItem
              onClick={() => {
                setUserMenuEl(null);
                logout();
                clearGdtSession();
              }}
            >
              Đăng xuất
            </MenuItem>
          </Menu>
        </Stack>
      </Toolbar>

      <DialogLoginHddt
        open={gdtLoginOpen}
        onClose={() => setGdtLoginOpen(false)}
        initialUsername={currentMst}
        onLoginSuccess={(token, mst) => setGdtToken(mst, token)}
      />

      <Snackbar open={!!switchError} autoHideDuration={4000} onClose={clearError}>
        <Alert severity="error" onClose={clearError}>
          {switchError}
        </Alert>
      </Snackbar>
    </AppBar>
  );
}
