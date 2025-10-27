# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production

FROM base AS backend
WORKDIR /app/backend
COPY backend ./

FROM base AS frontend
WORKDIR /app/frontend
COPY frontend/dist ./dist

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=backend /app/backend ./backend
COPY --from=frontend /app/frontend ./frontend
WORKDIR /app/backend
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
    && npm ci --omit=dev \
    && npm cache clean --force \
    && apk del .build-deps
WORKDIR /app
USER node
EXPOSE 8080
CMD ["node", "./backend/src/server.js"]
