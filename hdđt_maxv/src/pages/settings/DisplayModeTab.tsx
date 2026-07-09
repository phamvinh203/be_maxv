import { useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import LightModeRounded from "@mui/icons-material/LightModeRounded";
import DarkModeRounded from "@mui/icons-material/DarkModeRounded";
import SettingsBrightnessRounded from "@mui/icons-material/SettingsBrightnessRounded";
import DensitySmallRounded from "@mui/icons-material/DensitySmallRounded";
import DensityMediumRounded from "@mui/icons-material/DensityMediumRounded";
import DensityLargeRounded from "@mui/icons-material/DensityLargeRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";

type ThemeMode = "light" | "dark" | "system";
type TableDensity = "compact" | "standard" | "comfortable";
type FontSize = "small" | "medium" | "large";

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Sáng", icon: <LightModeRounded fontSize="small" /> },
  { value: "dark", label: "Tối", icon: <DarkModeRounded fontSize="small" /> },
  { value: "system", label: "Theo hệ thống", icon: <SettingsBrightnessRounded fontSize="small" /> },
];

const DENSITY_OPTIONS: { value: TableDensity; label: string; icon: React.ReactNode }[] = [
  { value: "compact", label: "Gọn", icon: <DensitySmallRounded fontSize="small" /> },
  { value: "standard", label: "Vừa", icon: <DensityMediumRounded fontSize="small" /> },
  { value: "comfortable", label: "Thoải mái", icon: <DensityLargeRounded fontSize="small" /> },
];

const FONT_SIZE_OPTIONS: { value: FontSize; label: string }[] = [
  { value: "small", label: "Nhỏ" },
  { value: "medium", label: "Vừa" },
  { value: "large", label: "Lớn" },
];

const ACCENT_COLORS = [
  { key: "blue", value: "#1565c0" },
  { key: "teal", value: "#00897b" },
  { key: "purple", value: "#6a1b9a" },
  { key: "orange", value: "#ef6c00" },
  { key: "red", value: "#c62828" },
  { key: "green", value: "#2e7d32" },
];

export default function DisplayModeTab() {
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [density, setDensity] = useState<TableDensity>("standard");
  const [fontSize, setFontSize] = useState<FontSize>("medium");
  const [accentColor, setAccentColor] = useState(ACCENT_COLORS[0].key);
  const [language, setLanguage] = useState("vi");

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        Chế độ hiển thị
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Tùy chỉnh giao diện hiển thị theo ý thích. (Giao diện minh họa — chưa áp dụng thật lên toàn
        ứng dụng.)
      </Typography>

      {/* Giao diện sáng/tối */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
          Giao diện
        </Typography>
        <ToggleButtonGroup
          value={themeMode}
          exclusive
          onChange={(_e, value: ThemeMode | null) => value && setThemeMode(value)}
          size="small"
        >
          {THEME_OPTIONS.map((opt) => (
            <ToggleButton key={opt.value} value={opt.value} sx={{ textTransform: "none", px: 2, gap: 1 }}>
              {opt.icon}
              {opt.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Paper>

      {/* Màu chủ đạo */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
          Màu chủ đạo
        </Typography>
        <Stack direction="row" spacing={1.5}>
          {ACCENT_COLORS.map((c) => {
            const selected = accentColor === c.key;
            return (
              <Box
                key={c.key}
                onClick={() => setAccentColor(c.key)}
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  bgcolor: c.value,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  outline: selected ? "2px solid" : "none",
                  outlineColor: c.value,
                  outlineOffset: "2px",
                }}
              >
                {selected && <CheckRounded fontSize="small" sx={{ color: "#fff" }} />}
              </Box>
            );
          })}
        </Stack>
      </Paper>

      {/* Mật độ hiển thị bảng */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
          Mật độ hiển thị bảng
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Áp dụng cho các bảng danh sách hóa đơn nhiều cột.
        </Typography>
        <ToggleButtonGroup
          value={density}
          exclusive
          onChange={(_e, value: TableDensity | null) => value && setDensity(value)}
          size="small"
        >
          {DENSITY_OPTIONS.map((opt) => (
            <ToggleButton key={opt.value} value={opt.value} sx={{ textTransform: "none", px: 2, gap: 1 }}>
              {opt.icon}
              {opt.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Paper>

      {/* Cỡ chữ */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
          Cỡ chữ
        </Typography>
        <ToggleButtonGroup
          value={fontSize}
          exclusive
          onChange={(_e, value: FontSize | null) => value && setFontSize(value)}
          size="small"
        >
          {FONT_SIZE_OPTIONS.map((opt) => (
            <ToggleButton key={opt.value} value={opt.value} sx={{ textTransform: "none", px: 3 }}>
              {opt.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Paper>

      {/* Ngôn ngữ */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
          Ngôn ngữ
        </Typography>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="language-label">Ngôn ngữ hiển thị</InputLabel>
          <Select
            labelId="language-label"
            label="Ngôn ngữ hiển thị"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <MenuItem value="vi">Tiếng Việt</MenuItem>
            <MenuItem value="en">English</MenuItem>
          </Select>
        </FormControl>
      </Paper>
    </Box>
  );
}
