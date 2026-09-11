import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { DisplaySettingsProvider } from "./theme/DisplaySettingsProvider";
import { AuthProvider } from "./features/auth/AuthContext";
import { GdtSessionProvider } from "./features/hddt/gdtSession/GdtSessionProvider";
import "./index.css";
import AppRouter from "./routes/AppRouter.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <DisplaySettingsProvider>
        {/* RVW-C02: GdtSessionProvider bọc NGOÀI AuthProvider — AuthContext cần gọi
            clearGdtSession() bên trong resetSession() (xem AuthContext.tsx), nên phải nằm
            trong cây của GdtSessionProvider để dùng được hook useGdtSession(). */}
        <GdtSessionProvider>
          <AuthProvider>
            <AppRouter />
          </AuthProvider>
        </GdtSessionProvider>
      </DisplaySettingsProvider>
    </QueryClientProvider>
  </StrictMode>,
);
