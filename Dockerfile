# syntax=docker/dockerfile:1

#############################################
# Backend deps build (native modules)
#############################################
FROM node:20-alpine AS deps

WORKDIR /app

# Ставим зависимости для сборки native модулей
RUN apk add --no-cache python3 make g++ bash

# Backend deps
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

#############################################
# Frontend build
#############################################
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend

RUN apk add --no-cache python3 make g++
COPY frontend/package*.json ./
RUN npm install --omit=dev

COPY frontend .
RUN npm run build

#############################################
# Runtime container (мини)
#############################################
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production \
    DATA_DIR="/app/data"

# Копируем код
COPY backend ./backend
COPY shared ./shared

# node_modules только для backend
COPY --from=deps /app/backend/node_modules ./backend/node_modules

# Копируем собранный фронт
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Создаём каталог под БД (volume потом заменит, но структура нужна)
RUN mkdir -p /app/data \
    && chown -R node:node /app/data

USER node
WORKDIR /app/backend

EXPOSE 8080
CMD ["node", "src/server.js"]
