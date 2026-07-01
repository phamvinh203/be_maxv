import { createTheme } from '@mui/material/styles';

// Bổ sung token gradient vào theme để dùng qua sx: (theme) => theme.gradients.*
declare module '@mui/material/styles' {
  interface Theme {
    gradients: { button: string; hero: string };
  }
  interface ThemeOptions {
    gradients?: { button?: string; hero?: string };
  }
}

export const theme = createTheme({
  palette: {
    primary: { main: '#0067e8' },
    background: { default: '#ffffff' },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: ['system-ui', 'Segoe UI', 'Roboto', 'sans-serif'].join(','),
  },
  gradients: {
    button: 'linear-gradient(135deg,#0060d8,#0078ff)',
    hero: 'linear-gradient(135deg,#0a3d91 0%,#0055d4 45%,#0078ff 100%)',
  },
});
