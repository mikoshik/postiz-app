# === ЭТАП 1: СБОРКА (Builder) ===
FROM node:22-alpine AS builder

# Устанавливаем системные зависимости
RUN apk add --no-cache libc6-compat python3 make g++

# Устанавливаем pnpm
RUN npm install -g pnpm@9.15.0

WORKDIR /app

# 1. Копируем файлы зависимостей
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Если есть локальный конфиг npm (обычно не обязателен, но оставим)
COPY .npmrc ./ 

# !!! ВАЖНОЕ ИСПРАВЛЕНИЕ: Копируем библиотеки ПЕРЕД установкой !!!
# Без этого prisma generate не найдет схему и упадет
COPY libraries ./libraries 

# 2. Устанавливаем зависимости
RUN pnpm install --frozen-lockfile

# 3. Теперь копируем весь остальной код (apps и прочее)
COPY . .

# 4. Собираем проект
# 3 ГБ памяти (3072) обычно достаточно, если есть swap
ENV NODE_OPTIONS="--max-old-space-size=3072"

# Создаем заглушку .env для билда
RUN touch .env 

# Запускаем сборку
RUN pnpm run build

# 5. Удаляем лишнее для уменьшения размера
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

# Копируем собранное из builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps ./apps
COPY --from=builder /app/libraries ./libraries
COPY --from=builder /app/package.json ./
COPY --from=builder /app/var/docker/nginx.conf /etc/nginx/nginx.conf

# Копируем конфиг PM2 (он теперь лежит рядом с Dockerfile)
COPY ecosystem.config.js ./

# Папка загрузок
RUN mkdir -p /app/uploads && chown -R www:www /app/uploads

# Переключаемся на пользователя
USER www

EXPOSE 5000

# Запускаем
CMD ["sh", "-c", "nginx && pm2-runtime start ecosystem.config.js"]