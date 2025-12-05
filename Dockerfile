# === ЭТАП 1: СБОРКА (Builder) ===
FROM node:22-alpine AS builder

# Устанавливаем системные зависимости, нужные для сборки (python, make, g++)
# libc6-compat нужен для некоторых библиотек (например, sharp для картинок)
RUN apk add --no-cache libc6-compat python3 make g++

# Устанавливаем pnpm
RUN npm install -g pnpm@9.15.0

WORKDIR /app

# 1. Сначала копируем ТОЛЬКО файлы зависимостей
# Это позволяет Docker закешировать этот шаг. Если ты поменял код, но не добавлял библиотек,
# этот шаг пропустится, и установка займет 0 секунд.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Если есть локальные конфиги npm
COPY .npmrc ./ 

# 2. Устанавливаем зависимости (строго по lock-файлу)
RUN pnpm install --frozen-lockfile

# 3. Теперь копируем весь исходный код
COPY . .

# 4. Собираем проект (Frontend + Backend)
# Увеличиваем память для сборки, чтобы не падало
ENV NODE_OPTIONS="--max-old-space-size=8192"

# Важный момент: Postiz требует .env при сборке фронтенда (иногда).
# Мы создаем заглушку .env для билда, реальные данные подставятся при запуске.
RUN touch .env 

RUN pnpm run build

# 5. Удаляем devDependencies (уменьшаем размер образа)
# (Если после этого что-то не запускается, закомментируй эту строку)
RUN pnpm prune --prod

# === ЭТАП 2: ЗАПУСК (Runner) ===
FROM node:22-alpine AS runner

# Устанавливаем Nginx и PM2 (для запуска процессов)
RUN apk add --no-cache nginx curl bash
RUN npm install -g pnpm@9.15.0 pm2

WORKDIR /app

# Создаем пользователя (безопасность)
RUN adduser -D -g 'www' www
RUN mkdir -p /var/lib/nginx /var/log/nginx /run/nginx
RUN chown -R www:www /var/lib/nginx /var/log/nginx /run/nginx

# Копируем собранные файлы из этапа builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps ./apps
COPY --from=builder /app/libraries ./libraries
COPY --from=builder /app/package.json ./
# Копируем конфиги PM2 и Nginx
COPY --from=builder /app/var/docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/ecosystem.config.js ./

# Создаем папку для загрузок и даем права
RUN mkdir -p /app/uploads && chown -R www:www /app/uploads

# Переключаемся на безопасного пользователя
USER www

# Открываем порт 5000 (внутренний порт Postiz)
EXPOSE 5000

# Запускаем Nginx и PM2
# pm2-runtime - специальная версия для Docker, которая не дает контейнеру закрыться
CMD ["sh", "-c", "nginx && pm2-runtime start ecosystem.config.js"]