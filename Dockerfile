# Stage 1: Frontend assets (placeholder for future build tooling)
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY public ./public
RUN mkdir -p /out/public \
  && cp -r public/. /out/public/

# Stage 2: Install backend dependencies
FROM node:20-alpine AS backend-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Stage 3: Final runtime image
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=backend-deps /app/node_modules ./node_modules
COPY --from=backend-deps /app/package.json ./package.json
COPY server ./server
COPY --from=frontend-builder /out/public ./public
EXPOSE 3000
CMD ["node", "server/index.js"]
