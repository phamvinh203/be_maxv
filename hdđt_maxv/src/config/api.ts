// Base URL tới backend be_maxv.
// Dev: Vite proxy ánh xạ '/api' -> http://localhost:4000 (xem vite.config.ts),
// nên dùng đường dẫn tương đối '/api/v1' để tránh CORS.
// Prod: override qua biến môi trường VITE_API_URL nếu cần.
export const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1'

// API tra cứu người nộp thuế theo MST (dịch vụ ngoài, KHÔNG phải be_maxv).
// Bên họ trả 'Access-Control-Allow-Origin: *' nên FE gọi thẳng được, không cần BE proxy —
// và quan trọng hơn: rate limit của họ (10 lần/30s) tính theo IP, đi qua BE thì cả hệ thống
// dùng chung một hạn mức. Gọi bằng fetch trần, tuyệt đối không qua apiFetch (không gửi
// cookie phiên của app sang bên thứ 3).
export const TAX_PAYER_API_BASE =
  import.meta.env.VITE_TAX_PAYER_API_URL ?? 'https://api.xinvoice.vn/gdt-api'
