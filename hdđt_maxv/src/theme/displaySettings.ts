import { createContext, useContext } from "react";
import { createTheme, type Theme } from "@mui/material/styles";

export type ThemeMode = "light" | "dark" | "system";
export type TableDensity = "compact" | "standard" | "comfortable";
export type FontSize = "small" | "medium" | "large";

/** Cài đặt hiển thị người dùng chọn (tab Cài đặt › Chế độ hiển thị) — lưu localStorage. */
export interface DisplaySettings {
  mode: ThemeMode;
  /** key trong ACCENT_COLORS */
  accent: string;
  density: TableDensity;
  fontSize: FontSize;
}

export const ACCENT_COLORS: { key: string; value: string }[] = [
  { key: "blue", value: "#0067e8" }, // giữ nguyên màu mặc định cũ của app
  { key: "teal", value: "#00897b" },
  { key: "purple", value: "#6a1b9a" },
  { key: "orange", value: "#ef6c00" },
  { key: "red", value: "#c62828" },
  { key: "green", value: "#2e7d32" },
];

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  mode: "light",
  accent: "blue",
  density: "standard",
  fontSize: "medium",
};

const STORAGE_KEY = "hddt_display_settings";

/** Đọc cài đặt hiển thị từ localStorage (merge với mặc định để không thiếu field khi thêm mới). */
export function loadDisplaySettings(): DisplaySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DISPLAY_SETTINGS;
    return { ...DEFAULT_DISPLAY_SETTINGS, ...(JSON.parse(raw) as Partial<DisplaySettings>) };
  } catch {
    return DEFAULT_DISPLAY_SETTINGS;
  }
}

export function saveDisplaySettings(settings: DisplaySettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

const FONT_BASE: Record<FontSize, number> = { small: 13, medium: 14, large: 15 };
const DENSITY_PAD: Record<TableDensity, string> = {
  compact: "4px 8px",
  standard: "6px 12px",
  comfortable: "12px 20px",
};

/**
 * Dựng MUI theme từ cài đặt hiển thị + trạng thái dark của hệ thống (cho mode "system").
 * Áp: mode sáng/tối, màu primary (accent), cỡ chữ gốc, và padding ô bảng theo mật độ.
 */
export function buildTheme(settings: DisplaySettings, prefersDark: boolean): Theme {
  const mode = settings.mode === "system" ? (prefersDark ? "dark" : "light") : settings.mode;
  const accent =
    ACCENT_COLORS.find((c) => c.key === settings.accent)?.value ?? ACCENT_COLORS[0].value;
  const cellPad = DENSITY_PAD[settings.density];

  return createTheme({
    palette: { mode, primary: { main: accent } },
    typography: {
      fontFamily:
        'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      fontSize: FONT_BASE[settings.fontSize],
    },
    components: {
      // Mật độ hiển thị bảng — áp cho cả cell thường lẫn size="small" (bảng hóa đơn dùng small).
      MuiTableCell: {
        styleOverrides: { root: { padding: cellPad }, sizeSmall: { padding: cellPad } },
      },
    },
  });
}

export interface DisplaySettingsContextValue {
  settings: DisplaySettings;
  /** Cập nhật 1 phần cài đặt (vd `update({ mode: "dark" })`). */
  update: (patch: Partial<DisplaySettings>) => void;
}

export const DisplaySettingsContext = createContext<DisplaySettingsContextValue | null>(null);

/** Hook đọc/đổi cài đặt hiển thị. Dùng: `DisplayModeTab`. */
export function useDisplaySettings(): DisplaySettingsContextValue {
  const ctx = useContext(DisplaySettingsContext);
  if (!ctx) throw new Error("useDisplaySettings phải dùng bên trong DisplaySettingsProvider");
  return ctx;
}
