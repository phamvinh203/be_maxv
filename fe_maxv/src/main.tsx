import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import './index.css';
import AppRouter from './routes/AppRouter.tsx';
import { AuthProvider } from './features/auth/AuthProvider.tsx';
import { theme } from './theme/theme.ts';
import { queryClient } from './lib/queryClient.ts';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {/* Bọc ngoài router: guard nào cũng cần biết phiên (AuthProvider tự gọi /auth/me). */}
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
