import { useState, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
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
import SettingsRounded from "@mui/icons-material/SettingsRounded";
import ExpandMoreRounded from "@mui/icons-material/ExpandMoreRounded";
import ApartmentRounded from "@mui/icons-material/ApartmentRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import { useAuth } from "../features/auth/useAuth";
import { useGdtSession } from "../features/hddt/gdtSession/useGdtSession";

export default function AppHeader() {
  const { user, logout, companies, currentCompanyId, switchCompany } = useAuth();
  const { clearGdtSession } = useGdtSession();
  const navigate = useNavigate();
  const [userMenuEl, setUserMenuEl] = useState<HTMLElement | null>(null);
  const [companyMenuEl, setCompanyMenuEl] = useState<HTMLElement | null>(null);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState("");

  if (!user) return null;

  const initial = user.hoTen.trim().charAt(0).toUpperCase();
  const currentCompany = companies.find((c) => c.id === currentCompanyId);

  const handleSelectCompany = async (id: string) => {
    setCompanyMenuEl(null);
    if (id === currentCompanyId) return;

    setSwitching(true);
    try {
      await switchCompany(id);
    } catch (e) {
      setSwitchError(e instanceof Error ? e.message : "Không đổi được công ty.");
    } finally {
      setSwitching(false);
    }
  };

  return (
    <AppBar position="static" color="primary" enableColorOnDark>
      <Toolbar sx={{ justifyContent: "space-between", gap: 2 }}>
        <Stack direction="row" spacing={3} sx={{ alignItems: "center" }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            MAXV
          </Typography>
          <Button
            color="inherit"
            onClick={() => navigate("/")}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Hóa đơn và tờ khai
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

      <Snackbar
        open={!!switchError}
        autoHideDuration={4000}
        onClose={() => setSwitchError("")}
      >
        <Alert severity="error" onClose={() => setSwitchError("")}>
          {switchError}
        </Alert>
      </Snackbar>
    </AppBar>
  );
}
