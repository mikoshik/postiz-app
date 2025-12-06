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


# 8. Чистим dev зависимости
RUN pnpm prune --prod

# === ЭТАП 2: ЗАПУСК ===
FROM node:22-alpine AS runner

RUN apk add --no-cache nginx curl bash
RUN npm install -g pnpm@9.15.0 pm2

WORKDIR /app

# Nginx директории
RUN mkdir -p /var/lib/nginx /var/log/nginx /run/nginx

# --- КОПИРОВАНИЕ ---
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./ 
COPY --from=builder /app/apps ./apps
COPY --from=builder /app/libraries ./libraries

# Конфиги
COPY --from=builder /app/var/docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/ecosystem.config.js ./

# Папка загрузок
RUN mkdir -p /uploads /app/uploads

# НЕ переключаемся на www — остаёмся root
EXPOSE 5000

CMD ["sh", "-c", "nginx && pm2-runtime start ecosystem.config.js"]