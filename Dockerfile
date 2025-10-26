# Stage 1: build frontend assets
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend ./
RUN npm run build

# Stage 2: install backend production dependencies
FROM node:18-alpine AS backend-deps
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

# Stage 3: final runtime image
FROM node:18-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY --from=backend-deps /app/node_modules ./node_modules
COPY --from=backend-deps /app/package.json ./package.json
COPY backend ./backend
COPY --from=frontend-builder /app/frontend/dist ./backend/static

VOLUME ["/app/data"]
EXPOSE 8080

CMD ["node", "backend/src/server.js"]
