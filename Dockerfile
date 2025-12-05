# === ЭТАП 1: СБОРКА (Builder) ===
FROM node:22-alpine AS builder

# Устанавливаем системные зависимости
RUN apk add --no-cache libc6-compat python3 make g++

# !!! ИСПРАВЛЕНИЕ: Устанавливаем pnpm И nx глобально !!!
RUN npm install -g pnpm@9.15.0 nx

WORKDIR /app

# 1. Копируем зависимости
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY .npmrc ./ 

# 2. Копируем библиотеки (нужно для postinstall)
COPY libraries ./libraries 

# 3. Устанавливаем зависимости
RUN pnpm install --frozen-lockfile

# 4. Копируем исходный код
COPY . .

# 5. Настраиваем память
ENV NODE_OPTIONS="--max-old-space-size=3072"
RUN touch .env 

# !!! СБОРКА ПО ОЧЕРЕДИ (Через глобальный nx) !!!
# Теперь команда 'nx' точно будет найдена
RUN nx build backend
RUN nx build workers
RUN nx build cron
RUN nx build frontend

# Чистим мусор
RUN pnpm prune --prod

# === ЭТАП 2: ЗАПУСК (Runner) ===
FROM node:22-alpine AS runner

# Устанавливаем Nginx и PM2
RUN apk add --no-cache nginx curl bash
RUN npm install -g pnpm@9.15.0 pm2

WORKDIR /app

# Создаем пользователя
RUN adduser -D -g 'www' www
RUN mkdir -p /var/lib/nginx /var/log/nginx /run/nginx
RUN chown -R www:www /var/lib/nginx /var/log/nginx /run/nginx

# --- КОПИРОВАНИЕ ---

# Зависимости
COPY --from=builder /app/node_modules ./node_modules

# Исходники
COPY --from=builder /app/apps ./apps
COPY --from=builder /app/libraries ./libraries
COPY --from=builder /app/package.json ./

# Скомпилированные бэкенды (dist)
COPY --from=builder /app/dist ./dist

# Скомпилированный фронтенд (.next) - ВАЖНО
COPY --from=builder /app/apps/frontend/.next ./apps/frontend/.next

# Конфиги
COPY --from=builder /app/var/docker/nginx.conf /etc/nginx/nginx.conf
# Берем ecosystem.config.js с сервера (где лежит Dockerfile)
COPY ecosystem.config.js ./

# -------------------

# Папка загрузок
RUN mkdir -p /app/uploads && chown -R www:www /app/uploads

USER www
EXPOSE 5000

CMD ["sh", "-c", "nginx && pm2-runtime start ecosystem.config.js"]