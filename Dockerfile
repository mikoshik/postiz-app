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

# 5. Память и ENV
# ENV NODE_OPTIONS="--max-old-space-size=3072"
RUN touch .env 

# 6. СБОРКА
# RUN pnpm run build
RUN pnpm run build:backend
RUN pnpm run build:workers
RUN pnpm run build:cron
RUN pnpm run build:frontend

# 7. Проверка что создалось (ПОСЛЕ сборки!)
# 8. ОСТАНОВКА ДЛЯ ДИАГНОСТИКИ - закомментируй после проверки
# Временно не идём дальше, чтобы увидеть логи
CMD ["echo", "Builder finished - check logs above"]

# === ЗАКОММЕНТИРОВАНО ДЛЯ ДИАГНОСТИКИ ===
# 9. Чистим мусор
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

# Скомпилированные файлы (билдятся внутри apps/)
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/workers/dist ./apps/workers/dist
COPY --from=builder /app/apps/cron/dist ./apps/cron/dist

# Next.js build
COPY --from=builder /app/apps/frontend/.next ./apps/frontend/.next

# Конфиги
COPY --from=builder /app/var/docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/ecosystem.config.js ./

# Папка загрузок
RUN mkdir -p /app/uploads && chown -R www:www /app/uploads

USER www
EXPOSE 5000

CMD ["sh", "-c", "nginx && pm2-runtime start ecosystem.config.js"]