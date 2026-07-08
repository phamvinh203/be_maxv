import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
