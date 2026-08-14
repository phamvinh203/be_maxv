import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Module Kế toán (port từ fe_maxv) dùng import "@/..." — giữ đúng alias gốc.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    proxy: {
      // Proxy /api -> backend be_maxv (port 4000) để tránh CORS khi dev
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
