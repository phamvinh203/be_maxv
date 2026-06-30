import { createTheme } from '@mui/material/styles';

// Bảng màu lấy theo logo maxv: xanh azure (wordmark) + xanh đậm (quả cầu).
const AZURE = '#1496d4'; // màu chủ đạo (nút, link, active)
const NAVY = '#0a2540'; // nền sidebar (tông xanh đậm của logo)

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: AZURE, dark: '#0e6fa6', light: '#46bdec', contrastText: '#fff' },
    secondary: { main: NAVY },
    background: { default: '#f4f7fa', paper: '#ffffff' },
    text: { primary: '#152033', secondary: '#5e6e87' },
    divider: '#e5e9f0',
    success: { main: '#129a6e' },
    warning: { main: '#d98a04' },
    error: { main: '#e02424' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '"Be Vietnam Pro", system-ui, -apple-system, sans-serif',
    h4: { fontWeight: 800, letterSpacing: '-0.02em' },
    h5: { fontWeight: 700, letterSpacing: '-0.01em' },
    h6: { fontWeight: 700 },
    button: { fontWeight: 600 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { textTransform: 'none', borderRadius: 10 } },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
  },
});
