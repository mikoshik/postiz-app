# === ЭТАП 1: СБОРКА (Builder) ===
FROM node:22-alpine AS builder

# Устанавливаем системные зависимости
RUN apk add --no-cache libc6-compat python3 make g++

# Устанавливаем pnpm
RUN npm install -g pnpm@9.15.0

WORKDIR /app

# 1. Копируем файлы зависимостей
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Если есть .npmrc, копируем (не критично, если нет)
COPY .npmrc ./ 

# 2. !!! КРИТИЧНО: Копируем библиотеки ПЕРЕД установкой !!!
# Без этого pnpm install упадет на postinstall скриптах
COPY libraries ./libraries 

# 3. Устанавливаем зависимости
RUN pnpm install --frozen-lockfile

# 4. Копируем весь исходный код
COPY . .

# 5. Собираем проект
# Ограничиваем память, чтобы сервер не упал
ENV NODE_OPTIONS="--max-old-space-size=3072"

# Создаем заглушку .env для билда фронтенда
RUN touch .env 

# Запускаем сборку (тут создается папка dist)
RUN pnpm exec nx build backend
RUN pnpm exec nx build workers
RUN pnpm exec nx build cron
RUN pnpm exec nx build frontend

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

# --- КОПИРОВАНИЕ ФАЙЛОВ (САМОЕ ВАЖНОЕ) ---

# 1. Зависимости
COPY --from=builder /app/node_modules ./node_modules

# 2. Исходный код (нужен для Next.js и скриптов)
COPY --from=builder /app/apps ./apps
COPY --from=builder /app/libraries ./libraries
COPY --from=builder /app/package.json ./

# 3. !!! СКОМПИЛИРОВАННЫЙ БЭКЕНД (Этого не хватало!) !!!
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/apps/frontend/.next ./apps/frontend/.next
# 4. Конфиг Nginx (из папки проекта)
COPY --from=builder /app/var/docker/nginx.conf /etc/nginx/nginx.conf

# 5. Конфиг PM2 (берем из текущей папки, так надежнее)
COPY ecosystem.config.js ./

# -----------------------------------------

# Создаем папку для загрузок
RUN mkdir -p /app/uploads && chown -R www:www /app/uploads

# Переключаемся на пользователя
USER www

EXPOSE 5000

# Запускаем Nginx и PM2
CMD ["sh", "-c", "nginx && pm2-runtime start ecosystem.config.js"]