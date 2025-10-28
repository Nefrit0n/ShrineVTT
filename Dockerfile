# syntax=docker/dockerfile:1
FROM node:20-alpine AS deps

WORKDIR /app

# Устанавливаем зависимости backend
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

# Устанавливаем зависимости shared
COPY shared/package*.json ./shared/
RUN cd shared && npm install --omit=dev

# Устанавливаем зависимости frontend
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install --omit=dev

###########################################################
# Build frontend
###########################################################
FROM deps AS frontend-build

COPY frontend ./frontend
RUN cd frontend && npm run build

###########################################################
# Production runner
###########################################################
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Копируем backend + собраный frontend + shared
COPY --from=deps /app/backend ./backend
COPY --from=deps /app/shared ./shared
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Удаляем dev-зависимости Node и сборочные пакеты Alpine
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
    && cd backend && npm install --omit=dev \
    && cd ../shared && npm install --omit=dev \
    && npm cache clean --force \
    && apk del .build-deps

USER node
EXPOSE 8080
CMD ["node", "./backend/src/server.js"]
