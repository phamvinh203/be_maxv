# Deploy maxv_v2 bằng Docker

> 3 container: **db** (Postgres) · **api** (be_maxv) · **web** (hddt_maxv qua nginx, kèm proxy `/api/v1`).
> Docker giải quyết được DB-per-tenant: postgres container dùng superuser `postgres` → app tự `CREATE DATABASE db_<MST>` khi tạo công ty (khác Render).

## Điều kiện

- **Docker + Docker Compose v2** (đã có: `docker compose ...`). Container là **Linux** (node:bookworm, nginx:alpine) → chạy trên Linux host, hoặc Windows Server bật **WSL2 + Docker**.

## File đã tạo trong repo

| File | Vai trò |
|---|---|
| `docker-compose.yml` | Ghép 3 service + volume DB |
| `.env.example` (root) | Mẫu biến bí mật cho compose → copy thành `.env` |
| `be_maxv/Dockerfile` + `docker-entrypoint.sh` + `.dockerignore` | Build + chạy backend (giữ prisma CLI cho provisioning) |
| `hdđt_maxv/Dockerfile` + `nginx.conf` + `.dockerignore` | Build SPA + nginx serve/proxy |

## Chạy

```bash
cd maxv_v2
cp .env.example .env          # rồi ĐIỀN giá trị thật (POSTGRES_PASSWORD, JWT secrets, SMTP, HDDT_ENC_KEY, ALLOWED_ORIGINS)
docker compose up -d --build
docker compose logs -f api    # theo dõi migrate sys + khởi động
```

**Điều gì xảy ra khi `up`:**
1. **db**: lần đầu tạo sẵn DB `maxv2_sys` (biến `POSTGRES_DB`). Data nằm ở volume `pgdata` (bền qua restart).
2. **api**: chờ db healthy → `prisma migrate deploy` (tạo bảng sys) → `node dist/server.js`.
3. **web**: nginx serve SPA + proxy `/api/v1` → `api:4000` (cùng origin → cookie `SameSite=Strict` chạy).

Truy cập: `http://<server>` (cổng 80). Đăng ký → đăng nhập → **tạo công ty** (app tạo DB `db_<MST>` — bước Render làm không được, Docker làm được).

## ⚠️ HTTPS (bắt buộc cho production)

`NODE_ENV=production` đặt cookie **`Secure`** → **phải có HTTPS**, nếu không đăng nhập xong bị 401 (cookie không gửi qua HTTP). 3 cách:

**Cách 1 — thêm Caddy tự động Let's Encrypt (khuyên dùng, gọn nhất).** Thêm vào `docker-compose.yml`:
```yaml
  caddy:
    image: caddy:2
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    depends_on: [web]
    restart: unless-stopped
# và thêm `caddy_data:` vào volumes; BỎ `ports` của service web (để Caddy đứng trước)
```
`Caddyfile`:
```
hddt.tencongty.com {
    reverse_proxy web:80
}
```
(Caddy tự xin + gia hạn SSL. Cần domain trỏ về IP server + mở cổng 80/443.)

**Cách 2 — mount cert vào nginx `web`**: bật `443:443`, thêm `ssl_certificate` vào `nginx.conf`, mount thư mục cert.

**Cách 3 — reverse proxy TLS bên ngoài** (nginx/Traefik/LB của hạ tầng) đứng trước container `web:80`.

## Cập nhật khi ĐỔI schema tenant

Khi thay đổi `prisma/tenant/schema.prisma` (như đợt thêm cột `detail`/`tt_tai`), sau khi build lại image phải đẩy schema mới cho các DB công ty đã có:
```bash
docker compose up -d --build api
docker compose exec api node dist/scripts/sync-tenants.js
```
(Đổi schema **sys** thì không cần — entrypoint đã `migrate deploy` mỗi lần start.)

## Vận hành

- **Backup DB:** `docker compose exec db pg_dumpall -U postgres > backup.sql` (gồm maxv2_sys + tất cả db_<MST>).
- **Xem log:** `docker compose logs -f api` / `web` / `db`.
- **Restart:** `docker compose restart api`.
- **Cập nhật code:** `git pull && docker compose up -d --build`.
- **Dừng (giữ data):** `docker compose down` (volume `pgdata` vẫn còn). **Xóa cả data:** `docker compose down -v` (⚠️ mất DB).

## Vì sao image api "nặng" (giữ devDeps)

Runtime **cố ý giữ `node_modules` đầy đủ + `prisma/` + prisma CLI** vì app chạy `npx prisma db push` lúc **tạo công ty** ([provisioning.service.ts](../be_maxv/src/services/shared/provisioning.service.ts)). Prune devDeps sẽ làm tạo công ty lỗi — đây là đặc thù kiến trúc DB-per-tenant, không phải thừa.

## Ghi chú build

`be_maxv` build đã sửa để **copy `src/generated` → `dist/generated`** (Prisma client), nếu không `node dist/server.js` sẽ lỗi import client. Fix này áp dụng cho cả deploy Docker lẫn chạy `dist` trực tiếp (Windows Server).
