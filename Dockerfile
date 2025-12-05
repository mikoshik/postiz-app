# === ЭТАП 1: СБОРКА ===
FROM node:22-alpine AS builder

# 1. Ставим системные утилиты
RUN apk add --no-cache libc6-compat python3 make g++

# 2. Ставим pnpm
RUN npm install -g pnpm@9.15.0

WORKDIR /app

# 3. !!! ГЛАВНОЕ: КОПИРУЕМ ВООБЩЕ ВСЁ !!!
# Мы не выбираем файлы. Мы просто копируем всё, что есть в папке проекта.
COPY . .

# 4. Устанавливаем зависимости
# Теперь pnpm точно найдет pnpm-lock.yaml и libraries, потому что мы скопировали всё
RUN pnpm install --frozen-lockfile

# 5. Память и ENV
ENV NODE_OPTIONS="--max-old-space-size=3072"
RUN touch .env 

# 6. СБОРКА
# Используем pnpm exec, чтобы он сам нашел нужный бинарник nx
RUN pnpm exec nx build backend
RUN pnpm exec nx build workers
RUN pnpm exec nx build cron
RUN pnpm exec nx build frontend

# 7. Чистим мусор
RUN pnpm prune --prod

# === ЭТАП 2: ЗАПУСК ===
FROM node:22-alpine AS runner

RUN apk add --no-cache nginx curl bash
RUN npm install -g pnpm@9.15.0 pm2

WORKDIR /app

RUN adduser -D -g 'www' www
RUN mkdir -p /var/lib/nginx /var/log/nginx /run/nginx
RUN chown -R www:www /var/lib/nginx /var/log/nginx /run/nginx

# --- КОПИРОВАНИЕ ГОТОВОГО ---

# Мы просто копируем результаты из папки /app (где всё лежало)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps ./apps
COPY --from=builder /app/libraries ./libraries
COPY --from=builder /app/package.json ./

# Скомпилированные папки
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/apps/frontend/.next ./apps/frontend/.next

# Конфиги
COPY --from=builder /app/var/docker/nginx.conf /etc/nginx/nginx.conf
# Берем ecosystem, который мы скопировали в самом начале шагом "COPY . ."
COPY --from=builder /app/ecosystem.config.js ./

# Папка загрузок
RUN mkdir -p /app/uploads && chown -R www:www /app/uploads

USER www
EXPOSE 5000

CMD ["sh", "-c", "nginx && pm2-runtime start ecosystem.config.js"]