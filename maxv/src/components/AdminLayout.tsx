import { useState, type JSX, type ReactNode } from 'react';
import {
  Link,
  Outlet,
  useLocation,
  useMatches,
  useNavigate,
} from '@tanstack/react-router';
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import SpaceDashboardRoundedIcon from '@mui/icons-material/SpaceDashboardRounded';
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import CreditCardRoundedIcon from '@mui/icons-material/CreditCardRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import BuildRoundedIcon from '@mui/icons-material/BuildRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import { getCurrentUser, useLogout } from '@/features/auth/hooks/useAuth';

const DRAWER_WIDTH = 264;

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

const NAV_GROUPS: { heading: string; items: NavItem[] }[] = [
  {
    heading: 'Quản lý',
    items: [
      { to: '/dashboard', label: 'Tổng quan', icon: <SpaceDashboardRoundedIcon /> },
      { to: '/companies', label: 'Đơn vị', icon: <ApartmentRoundedIcon /> },
      { to: '/invites', label: 'Nhân viên', icon: <GroupRoundedIcon /> },
      { to: '/subscriptions', label: 'Thuê bao', icon: <CreditCardRoundedIcon /> },
      { to: '/users', label: 'Người dùng', icon: <PeopleAltRoundedIcon /> },
    ],
  },
  {
    heading: 'Hệ thống',
    items: [
      { to: '/logs', label: 'Nhật ký', icon: <ReceiptLongRoundedIcon /> },
      { to: '/ops', label: 'Vận hành', icon: <BuildRoundedIcon /> },
    ],
  },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '');
}

export function AdminLayout(): JSX.Element {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const matches = useMatches();
  const user = getCurrentUser();
  const { mutate: logout } = useLogout();
  const [menuEl, setMenuEl] = useState<null | HTMLElement>(null);

  // Tiêu đề lấy từ staticData của route khớp sâu nhất (nguồn sự thật ở router).
  const title =
    [...matches].reverse().find((m) => m.staticData.title)?.staticData.title ??
    'Quản trị';

  function handleLogout(): void {
    setMenuEl(null);
    logout(undefined, { onSettled: () => navigate({ to: '/login' }) });
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* ============ SIDEBAR ============ */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            border: 'none',
            color: '#cbd5e1',
            bgcolor: '#0a2540',
            backgroundImage:
              'radial-gradient(120% 60% at 50% -10%, rgba(70,189,236,0.18), transparent 60%)',
          },
        }}
      >
        {/* Thương hiệu — logo thật */}
        <Stack
          spacing={0.75}
          sx={{ height: 76, px: 2.5, justifyContent: 'center' }}
        >
          <Box
            component="img"
            src="/Logo-Maxv.png"
            alt="maxv"
            sx={{ height: 30, width: 'auto', alignSelf: 'flex-start' }}
          />
          <Typography
            sx={{
              fontSize: 10.5,
              letterSpacing: '0.2em',
              color: '#5e7da0',
            }}
          >
            CONTROL PLANE
          </Typography>
        </Stack>

        <Box sx={{ px: 1.5, pt: 1 }}>
          {NAV_GROUPS.map((group) => (
            <Box key={group.heading} sx={{ mb: 1.5 }}>
              <Typography
                sx={{
                  px: 1.5,
                  py: 1,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  color: '#475569',
                }}
              >
                {group.heading.toUpperCase()}
              </Typography>
              <Stack spacing={0.5}>
                {group.items.map((item) => {
                  const active = pathname.startsWith(item.to);
                  return (
                    <ListItemButton
                      key={item.to}
                      component={Link}
                      to={item.to}
                      selected={active}
                      sx={{
                        borderRadius: 2,
                        px: 1.5,
                        py: 1,
                        color: '#94a3b8',
                        '& .MuiListItemIcon-root': {
                          minWidth: 36,
                          color: 'inherit',
                        },
                        '&:hover': {
                          bgcolor: 'rgba(255,255,255,0.05)',
                          color: '#e2e8f0',
                        },
                        '&.Mui-selected, &.Mui-selected:hover': {
                          bgcolor: 'rgba(70,189,236,0.18)',
                          color: '#fff',
                        },
                        '&.Mui-selected .MuiListItemIcon-root': {
                          color: '#46bdec',
                        },
                      }}
                    >
                      <ListItemIcon>{item.icon}</ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        slotProps={{
                          primary: {
                            sx: { fontSize: 14, fontWeight: active ? 700 : 500 },
                          },
                        }}
                      />
                    </ListItemButton>
                  );
                })}
              </Stack>
            </Box>
          ))}
        </Box>

        <Box sx={{ mt: 'auto', p: 2 }}>
          <Typography sx={{ fontSize: 11, color: '#475569' }}>
            maxv v0.1 • SaaS kế toán
          </Typography>
        </Box>
      </Drawer>

      {/* ============ HEADER + NỘI DUNG ============ */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            bgcolor: 'rgba(255,255,255,0.8)',
            backdropFilter: 'blur(8px)',
            color: 'text.primary',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Toolbar sx={{ gap: 1 }}>
            <Box sx={{ flexGrow: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 18, lineHeight: 1.2 }}>
                {title}
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                Bảng điều khiển quản trị hệ thống
              </Typography>
            </Box>

            <Tooltip title="Tìm kiếm">
              <IconButton color="inherit">
                <SearchRoundedIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Thông báo">
              <IconButton color="inherit">
                <Badge color="error" variant="dot">
                  <NotificationsRoundedIcon />
                </Badge>
              </IconButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ mx: 1, my: 1.5 }} />

            <IconButton
              onClick={(e) => setMenuEl(e.currentTarget)}
              sx={{ p: 0.5, borderRadius: 2 }}
            >
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  fontSize: 14,
                  fontWeight: 700,
                  bgcolor: 'secondary.main',
                }}
              >
                {initials(user?.hoTen ?? 'Admin')}
              </Avatar>
            </IconButton>

            <Menu
              anchorEl={menuEl}
              open={Boolean(menuEl)}
              onClose={() => setMenuEl(null)}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              slotProps={{ paper: { sx: { mt: 1, minWidth: 240, borderRadius: 2 } } }}
            >
              <Box sx={{ px: 2, py: 1.5 }}>
                <Typography sx={{ fontWeight: 700 }}>
                  {user?.hoTen ?? 'Quản trị viên'}
                </Typography>
                <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                  {user?.email ?? '—'}
                </Typography>
                <Chip
                  label={user?.role ?? 'ADMIN'}
                  size="small"
                  color="primary"
                  sx={{ mt: 1, height: 22 }}
                />
              </Box>
              <Divider />
              <MenuItem onClick={handleLogout} sx={{ py: 1.25, color: 'error.main' }}>
                <ListItemIcon sx={{ color: 'error.main' }}>
                  <LogoutRoundedIcon fontSize="small" />
                </ListItemIcon>
                Đăng xuất
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 3 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
