# Deploy be_maxv + hddt_maxv lên Windows Server

> Tài liệu triển khai. Windows Server tự cài PostgreSQL → mô hình **1 DB/công ty** (DB-per-tenant) chạy được (app tự `CREATE DATABASE db_<MST>`), khác hẳn Render managed Postgres (chỉ 1 DB, không tạo thêm được).

## ⚠️ 3 điểm DỄ SẬP nhất — đọc trước

1. **PHẢI cài cả devDependencies trên server** (dùng `npm ci`, KHÔNG `--omit=dev` / `--production`). Vì:
   - Lúc **tạo công ty**, app chạy `npx prisma db push` ở runtime để dựng schema cho DB tenant mới ([provisioning.service.ts](../be_maxv/src/services/shared/provisioning.service.ts)). `prisma` (CLI) là **devDependency** → prune mất là **tạo công ty lỗi**.
2. **Postgres user phải có quyền tạo DB + vào được DB `postgres`.** App kết nối `.../postgres` để `CREATE/DROP DATABASE`. Dùng superuser `postgres` là chắc nhất.
3. **HTTPS + cùng domain** cho FE & BE. Cookie phiên đặt `SameSite=Strict` + `Secure` (khi `NODE_ENV=production`) → nếu FE/BE khác origin hoặc chạy HTTP thì **đăng nhập xong bị 401**. Giải: reverse proxy `/api/v1` → be_maxv dưới **cùng 1 domain HTTPS**.

---

## 0. Cài đặt trên Windows Server

| Phần mềm | Ghi chú |
|---|---|
| **Node.js LTS** (≥ 20) | Bản MSI cho Windows. |
| **PostgreSQL** (15/16) | Bản EDB installer. Nhớ mật khẩu superuser `postgres`. |
| **Git** (tùy chọn) | Để kéo code / cập nhật. |
| **IIS** + **URL Rewrite** + **ARR** (Application Request Routing) | Làm reverse proxy + serve FE tĩnh + HTTPS. (Hoặc dùng **nginx for Windows** — cấu hình gọn hơn.) |
| **PM2** (`npm i -g pm2`) + `pm2-windows-startup` | Chạy Node nền + tự bật lại khi reboot/crash. (Hoặc **nssm** đăng ký Windows Service.) |

---

## 1. PostgreSQL

1. Cài Postgres, đặt mật khẩu cho `postgres`.
2. Tạo **DB control-plane** (sys) — app KHÔNG tự tạo cái này:
   ```sql
   -- chạy bằng psql/pgAdmin với user postgres
   CREATE DATABASE maxv2_sys;
   ```
   (DB tenant `db_<MST>` thì app **tự tạo** khi thêm công ty — không tạo tay.)
3. App + DB cùng máy → để `listen_addresses = localhost` là đủ; **không** mở cổng 5432 ra ngoài.
4. Dùng user `postgres` (superuser) cho `APP_DB_*` để chắc chắn có `CREATEDB` + vào được DB `postgres`.

---

## 2. Triển khai be_maxv

```powershell
cd C:\deploy\be_maxv          # nơi đặt code
npm ci                        # cài CẢ devDeps (đừng --production — xem điểm sập #1)
```

**Tạo `be_maxv\.env.local`** (app đọc file này, KHÔNG phải `.env`) — giá trị PRODUCTION:
```dotenv
NODE_ENV=production
PORT=4000
TRUST_PROXY=true                       # chạy sau IIS/nginx
ALLOWED_ORIGINS=https://hddt.tencongty.com   # domain FE (bắt buộc ở production)

# DB control-plane (sys) — localhost
DB_SYS_URL=postgresql://postgres:MAT_KHAU_MANH@localhost:5432/maxv2_sys?schema=public
DATABASE_URL=postgresql://postgres:MAT_KHAU_MANH@localhost:5432/maxv2_sys?schema=public  # cho prisma CLI (migrate:sys)

# Server gốc để tạo DB tenant (cùng Postgres) — user PHẢI có CREATEDB + vào DB postgres
APP_DB_HOST=localhost
APP_DB_PORT=5432
APP_DB_USER=postgres
APP_DB_PASSWORD=MAT_KHAU_MANH

# Auth — ĐỔI thành chuỗi ngẫu nhiên DÀI (openssl rand -hex 64), mỗi cái khác nhau
JWT_ACCESS_SECRET=<random-64-hex>
JWT_REFRESH_SECRET=<random-64-hex-khac>
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_SEC=604800

TRIAL_DAYS=7

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASSWORD=<app-password>
SMTP_FROM=noreply@tencongty.com

# Khóa mã hóa mật khẩu HĐĐT (AES-256-GCM) — GIỮ nguyên khóa cũ nếu đã có data mã hóa,
# nếu deploy mới thì sinh khóa 32 byte hex mới: openssl rand -hex 32
HDDT_ENC_KEY=<32-byte-hex>
```
> ⚠️ File `.env.local` hiện tại của bạn đang là secret **dev yếu** (`123456`, `doi_thanh_chuoi_ngau_nhien_dai`) — **phải đổi hết** khi lên production.
> ⚠️ `DEV_TENANT_DB` chỉ dùng cho dev — production **xóa/để trống**.

**Dựng client + DB + build + chạy:**
```powershell
npm run generate              # prisma generate (sys + tenant) — src/generated bị gitignore nên bắt buộc
npm run migrate:sys:deploy    # tạo bảng trong maxv2_sys (có sẵn migration files)
npm run build                 # tsc -> dist/
pm2 start dist/server.js --name be_maxv
pm2 save                      # lưu để tự bật lại sau reboot
```
(Không cần chạy `sync:tenants` lúc mới deploy — chưa có tenant. Chỉ chạy khi **đổi schema tenant** sau này để đẩy sang các DB công ty đã tạo.)

---

## 3. Triển khai hddt_maxv (SPA tĩnh)

```powershell
cd C:\deploy\hdđt_maxv
npm ci
```
**Tạo `hdđt_maxv\.env.production`:**
```dotenv
# Cùng domain + reverse proxy /api/v1 -> để /api/v1 (khuyên dùng, cần cho cookie SameSite=Strict)
VITE_API_URL=/api/v1
```
```powershell
npm run build                 # -> dist/  (file tĩnh)
```
→ Copy nội dung `dist/` vào thư mục web (vd `C:\inetpub\hddt`). **Lưu ý SPA:** app dùng `BrowserRouter` → web server phải **fallback mọi route không phải file tĩnh về `index.html`** (nếu không, F5 ở `/settings` sẽ 404).

---

## 4. Reverse proxy + HTTPS (IIS)

Mục tiêu: **1 domain** `https://hddt.tencongty.com`
- `/api/v1/*` → `http://localhost:4000` (be_maxv)
- còn lại → file tĩnh hddt (`dist/`), fallback `index.html`

**Cài:** IIS + module **URL Rewrite** + **ARR**. Trong ARR bật *Enable proxy*.

**`web.config`** đặt trong thư mục hddt (`C:\inetpub\hddt\web.config`):
```xml
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <!-- 1) Proxy API sang backend -->
        <rule name="api-proxy" stopProcessing="true">
          <match url="^api/v1/(.*)" />
          <action type="Rewrite" url="http://localhost:4000/api/v1/{R:1}" />
        </rule>
        <!-- 2) SPA fallback: request không phải file/thư mục thật -> index.html -->
        <rule name="spa" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```
**HTTPS:** gắn chứng chỉ SSL cho site (Let's Encrypt qua **win-acme**, hoặc cert mua). Bind cổng 443. → nhờ cùng origin + HTTPS mà cookie `Secure` + `SameSite=Strict` hoạt động.

> **nginx for Windows** (thay IIS) — `nginx.conf` gọn hơn:
> ```nginx
> server {
>   listen 443 ssl;
>   server_name hddt.tencongty.com;
>   ssl_certificate     C:/certs/fullchain.pem;
>   ssl_certificate_key C:/certs/privkey.pem;
>   root C:/deploy/hddt-dist;
>   location /api/v1/ { proxy_pass http://127.0.0.1:4000; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $remote_addr; }
>   location / { try_files $uri /index.html; }   # SPA fallback
> }
> ```

---

## 5. Checklist bảo mật production

- [ ] Đổi **JWT_ACCESS_SECRET / JWT_REFRESH_SECRET** thành chuỗi ngẫu nhiên dài (không dùng giá trị dev).
- [ ] Đổi **mật khẩu Postgres** mạnh (không `123456`).
- [ ] `NODE_ENV=production` + `ALLOWED_ORIGINS` = đúng domain FE.
- [ ] `TRUST_PROXY=true` (đứng sau IIS/nginx).
- [ ] **HTTPS** bật (bắt buộc cho cookie `Secure`).
- [ ] Firewall: mở **443** (và 80 để lấy cert). **KHÔNG** mở 4000 và 5432 ra ngoài.
- [ ] `.env.local` **không commit** git (đã có trong .gitignore).
- [ ] Backup định kỳ Postgres (`pg_dump` maxv2_sys + các db_<MST>).

## 6. Chạy nền / tự khởi động

- **PM2:** `pm2 start dist/server.js --name be_maxv` → `pm2 save` → `pm2-startup install` (tự bật khi reboot). Xem log: `pm2 logs be_maxv`.
- Hoặc **nssm**: `nssm install be_maxv "C:\Program Files\nodejs\node.exe" "C:\deploy\be_maxv\dist\server.js"` → đăng ký thành Windows Service.
- IIS/nginx tự chạy như service của Windows.

## 7. Kiểm thử sau deploy

1. Mở `https://hddt.tencongty.com` → ra màn đăng nhập.
2. Đăng ký → đăng nhập (kiểm cookie `accessToken` có cờ `HttpOnly` + `Secure` trong DevTools).
3. **Tạo công ty** (nhập MST) → app tạo DB `db_<MST>` thành công (đây là bước Render làm không được, Windows Server làm được).
4. Đăng nhập GDT → Cập nhật hóa đơn → xuất Excel.
