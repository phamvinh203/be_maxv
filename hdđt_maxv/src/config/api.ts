// Base URL tới backend be_maxv.
// Dev: Vite proxy ánh xạ '/api' -> http://localhost:4000 (xem vite.config.ts),
// nên dùng đường dẫn tương đối '/api/v1' để tránh CORS.
// Prod: override qua biến môi trường VITE_API_URL nếu cần.
export const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1'
