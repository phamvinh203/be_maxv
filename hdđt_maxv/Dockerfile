# ============================================================
#  hddt_maxv — Vite SPA build tĩnh, serve bằng nginx (kèm proxy /api/v1 -> be_maxv)
# ============================================================

# ---- Stage build ----
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# VITE_API_URL nhúng lúc build. Mặc định /api/v1 (cùng origin qua nginx -> cookie SameSite=Strict OK).
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---- Stage serve ----
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
