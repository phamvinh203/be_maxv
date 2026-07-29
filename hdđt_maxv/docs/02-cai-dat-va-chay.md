# 02 — Cài đặt & chạy dự án

## 2.1. Yêu cầu môi trường

| | Phiên bản | Ghi chú |
|---|---|---|
| Node.js | ≥ 20 | Vite 8 và `@types/node` 24 yêu cầu Node hiện đại |
| npm | đi kèm Node | |
| Trình duyệt | **Chrome hoặc Edge** | Bắt buộc để thử tính năng xuất file (File System Access API) |
| `be_maxv` | chạy ở `localhost:4000` | Không có backend thì FE chỉ hiện được màn hình đăng nhập |

## 2.2. Thư viện chính

```json
"dependencies": {
  "@mui/material": "^9.1.2",          // hệ thống giao diện
  "@mui/icons-material": "^9.1.1",
  "@emotion/react": "^11.14.0",       // engine CSS-in-JS của MUI
  "@emotion/styled": "^11.14.1",
  "@tanstack/react-query": "^5.101.2",// quản lý dữ liệu máy chủ
  "react": "^19.2.7",
  "react-dom": "^19.2.7",
  "react-router-dom": "^7.18.1",      // định tuyến
  "react-toastify": "^11.1.0",        // thông báo sự kiện
  "exceljs": "^4.4.0"                 // sinh file Excel trong trình duyệt
}
```

Ba lưu ý về phiên bản, vì chúng khác với đa số ví dụ tìm được trên mạng:

**MUI v9** — API prop đã đổi. Không còn `InputProps`, `PaperProps`, `inputProps`. Tất cả gom vào `slotProps`:

```tsx
// ĐÚNG (v9)
<TextField
  slotProps={{
    inputLabel: { shrink: true },
    input: { endAdornment: <InputAdornment position="end">…</InputAdornment> },
    htmlInput: { inputMode: "numeric", maxLength: 6 },
  }}
/>

// SAI (v5/v6, sẽ bị bỏ qua im lặng)
<TextField InputLabelProps={{ shrink: true }} inputProps={{ maxLength: 6 }} />
```

**React 19 + `eslint-plugin-react-hooks` v7** — có thêm luật `set-state-in-effect` và luật về tính thuần khiết khi render. Nhiều đoạn code hợp lệ ở React 18 nay bị cảnh báo. Xem cách xử lý ở [chương 12](12-quy-uoc-lap-trinh.md).

**TypeScript 6** — `lib.dom` chưa chắc khai báo `showDirectoryPicker`, nên dự án tự khai báo type tối thiểu trong `src/lib/fileSystemAccess.ts`.

## 2.3. Các lệnh

```bash
npm install        # cài phụ thuộc
npm run dev        # chạy dev server Vite (mặc định cổng 5173)
npm run build      # tsc -b && vite build  -> thư mục dist/
npm run lint       # eslint .
npm run preview    # phục vụ thử thư mục dist/
```

Lưu ý `build` chạy `tsc -b` **trước** `vite build`. Vite không kiểm tra kiểu khi build, nên lỗi TypeScript chỉ lộ ra ở bước này. Chạy `npm run build` trước khi tạo pull request.

> ⚠️ **Không tự khởi động hay tắt dev server của người khác.** Nếu cần xem kết quả, hãy nhờ người đang giữ máy chạy.

## 2.4. Cấu hình endpoint API

Toàn bộ nằm trong `src/config/api.ts`:

```ts
// Base URL tới backend be_maxv.
// Dev: Vite proxy ánh xạ '/api' -> http://localhost:4000 (xem vite.config.ts),
// nên dùng đường dẫn tương đối '/api/v1' để tránh CORS.
// Prod: override qua biến môi trường VITE_API_URL nếu cần.
export const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1'
```

Và proxy trong `vite.config.ts`:

```ts
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
```

**Vì sao dùng đường dẫn tương đối thay vì URL tuyệt đối?** Phiên đăng nhập nằm ở cookie httpOnly. Cookie chỉ được gửi kèm nếu request đi tới cùng origin, hoặc phải cấu hình CORS `credentials` cực kỳ cẩn thận ở cả hai phía. Dùng proxy khi dev + chung origin khi chạy thật thì trình duyệt coi đó là same-origin, cookie tự gửi, không phải đụng gì tới CORS.

### Biến môi trường

| Biến | Mặc định | Khi nào cần đặt |
|---|---|---|
| `VITE_API_URL` | `/api/v1` | Khi backend không cùng origin với frontend |
| `VITE_TAX_PAYER_API_URL` | `https://api.xinvoice.vn/gdt-api` | Khi đổi nhà cung cấp dịch vụ tra cứu MST |

Đặt trong file `.env.local` ở thư mục gốc dự án (Vite chỉ đọc biến có tiền tố `VITE_`).

## 2.5. Quy trình chạy lần đầu

```bash
# 1. Khởi động backend (ở thư mục be_maxv)
npm run dev          # lắng nghe cổng 4000

# 2. Khởi động frontend (ở thư mục hdđt_maxv)
npm install
npm run dev          # mở http://localhost:5173
```

Có sẵn `dev-all.bat` ở thư mục gốc `maxv_v2` để chạy cả hai cùng lúc.

**Kiểm tra nhanh xem đã thông chưa:** mở trình duyệt, vào tab Network, tải lại trang. Bạn phải thấy một request `GET /api/v1/auth/me`:

- Trả **401** — bình thường, nghĩa là chưa đăng nhập. Kết nối tới BE đã thông.
- Trả **404** hoặc lỗi mạng — proxy chưa chạy, kiểm tra `be_maxv` có đang chạy ở cổng 4000 không.

Request này đến từ đoạn bootstrap phiên trong `AuthProvider`:

```tsx
// Bootstrap phiên từ cookie khi tải trang: 200 -> khôi phục; lỗi/401 -> coi như chưa đăng nhập.
useEffect(() => {
  let alive = true;
  getMe()
    .then((data) => {
      if (!alive) return;
      setUser(data.user);
      setCompanies(data.companies);
      setCurrentCompanyId(data.activeDonViId);
    })
    .catch(() => {
      /* chưa đăng nhập — giữ state rỗng */
    })
    .finally(() => {
      if (alive) setHydrating(false);
    });
  return () => { alive = false; };
}, []);
```

Chi tiết cơ chế này ở [chương 6](06-context-toan-cuc.md).

## 2.6. Tài khoản để thử

Không có tài khoản mặc định. Tự đăng ký qua `/register`, sau đó thêm một công ty với **MST thật 10 số** — form sẽ tự tra cứu tên và địa chỉ từ `api.xinvoice.vn`.

Để thử các luồng lấy dữ liệu từ GDT, bạn cần **tài khoản Thuế điện tử thật** của MST đó. Không có cách giả lập.

## 2.7. Cấu trúc cấu hình TypeScript

Dự án dùng **project references** (3 file `tsconfig`):

| File | Phạm vi |
|---|---|
| `tsconfig.json` | File gốc, chỉ trỏ tới 2 file dưới |
| `tsconfig.app.json` | Code ứng dụng trong `src/` |
| `tsconfig.node.json` | File cấu hình chạy bằng Node (`vite.config.ts`) |

Tách ra vì hai môi trường có `lib` khác nhau: code ứng dụng chạy trong trình duyệt (`DOM`), còn `vite.config.ts` chạy trong Node. Gộp chung thì hoặc là `document` lọt vào file cấu hình, hoặc là `process` lọt vào code ứng dụng.

---

**Trước:** [01 — Tổng quan](01-tong-quan.md) · **Tiếp theo:** [03 — Kiến trúc & quy ước thư mục](03-kien-truc-va-thu-muc.md)
