import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import useMediaQuery from "@mui/material/useMediaQuery";
import {
  DisplaySettingsContext,
  buildTheme,
  loadDisplaySettings,
  saveDisplaySettings,
  type DisplaySettings,
} from "./displaySettings";

/**
 * Giữ cài đặt hiển thị (sáng/tối, màu, cỡ chữ, mật độ), dựng MUI theme động từ đó và
 * bọc `ThemeProvider` + `CssBaseline` cho toàn app. Lưu localStorage để sống qua F5.
 * Dùng: bọc `AppRouter` ở `main.tsx`; đọc/đổi qua hook `useDisplaySettings`.
 */
export function DisplaySettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<DisplaySettings>(loadDisplaySettings);

  useEffect(() => {
    saveDisplaySettings(settings);
  }, [settings]);

  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)", { noSsr: true });
  const theme = useMemo(() => buildTheme(settings, prefersDark), [settings, prefersDark]);

  const update = useCallback(
    (patch: Partial<DisplaySettings>) => setSettings((s) => ({ ...s, ...patch })),
    [],
  );
  const value = useMemo(() => ({ settings, update }), [settings, update]);

  return (
    <DisplaySettingsContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </DisplaySettingsContext.Provider>
  );
}
