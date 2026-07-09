import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { theme } from "./theme";
import { AuthProvider } from "./features/auth/AuthContext";
import { GdtSessionProvider } from "./features/hddt/gdtSession/GdtSessionProvider";
import "./index.css";
import AppRouter from "./routes/AppRouter.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <GdtSessionProvider>
          <AppRouter />
        </GdtSessionProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
