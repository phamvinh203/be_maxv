import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClientProvider } from "@tanstack/react-query";
import { theme } from "./theme";
import { queryClient } from "./lib/queryClient";
import { AuthProvider } from "./features/auth/AuthContext";
import { GdtSessionProvider } from "./features/hddt/gdtSession/GdtSessionProvider";
import "./index.css";
import AppRouter from "./routes/AppRouter.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <GdtSessionProvider>
            <AppRouter />
          </GdtSessionProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
