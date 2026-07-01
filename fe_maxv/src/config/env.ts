// Dev: vite proxy '/api' -> http://localhost:4000 (xem vite.config.ts) nên cùng origin.
// Prod: đặt VITE_API_URL trong .env.production.
export const env = {
  apiUrl: import.meta.env.VITE_API_URL ?? '/api/v1',
};
