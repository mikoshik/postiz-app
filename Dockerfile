# === ЭТАП 1: СБОРКА ===
FROM node:22-alpine AS builder
ENV NODE_OPTIONS="--max-old-space-size=8192"

# 1. Ставим системные утилиты
RUN apk add --no-cache libc6-compat python3 make g++

# 2. Ставим pnpm
RUN npm install -g pnpm@9.15.0

WORKDIR /app

# 3. Копируем всё
COPY . .

# 4. Устанавливаем зависимости
RUN pnpm install --frozen-lockfile

# 5. ENV
RUN touch .env 

# 6. СБОРКА ПО ЧАСТЯМ
RUN pnpm run build:backend
RUN pnpm run build:workers
RUN pnpm run build:cron
RUN pnpm run build:frontend

# 7. Проверка что создалось - ВЫВЕДЕТ ОШИБКУ ЕСЛИ НЕ НАЙДЁТ
RUN echo "=== CHECKING DIST FILES ===" && \
    ls -la /app/apps/backend/dist/ && \
    ls -la /app/apps/workers/dist/ && \
    ls -la /app/apps/cron/dist/ && \
    ls -la /app/apps/frontend/.next/ && \
    echo "=== ALL DIST FOUND ==="

# Если хочешь остановить сборку и посмотреть — раскомментируй:
# RUN exit 1

# 8. Чистим dev зависимости
RUN pnpm prune --prod

# === ЭТАП 2: ЗАПУСК ===
FROM node:22-alpine AS runner

RUN apk add --no-cache nginx curl bash
RUN npm install -g pnpm@9.15.0 pm2

WORKDIR /app

RUN adduser -D -g 'www' www
RUN mkdir -p /var/lib/nginx /var/log/nginx /run/nginx
RUN chown -R www:www /var/lib/nginx /var/log/nginx /run/nginx

# --- КОПИРОВАНИЕ ---
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./ 
COPY --from=builder /app/apps ./apps
COPY --from=builder /app/libraries ./libraries

# Конфиги
COPY --from=builder /app/var/docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/ecosystem.config.js ./

# Папка загрузок - создаём И /uploads И /app/uploads с правами www
RUN mkdir -p /uploads /app/uploads && chown -R www:www /uploads /app/uploads

USER www
EXPOSE 5000

CMD ["sh", "-c", "nginx && pm2-runtime start ecosystem.config.js"]