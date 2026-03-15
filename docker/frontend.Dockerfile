# Frontend Dockerfile — monorepo-aware build
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build-time env vars so Vite can inline them
ARG VITE_API_URL
ARG VITE_WS_URL

# Copy root workspace manifests first (cache-friendly layer)
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY frontend/package.json ./frontend/

# Install all workspace deps needed for the build
RUN npm ci --workspace=shared --workspace=frontend

# Copy source for shared + frontend
COPY shared/ ./shared/
COPY frontend/ ./frontend/

# Build shared types first, then frontend
RUN npm run build -w shared && npm run build -w frontend

# ── Production image ──
FROM node:20-alpine

WORKDIR /app

# Copy root workspace manifests
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY frontend/package.json ./frontend/

# Install production deps only
RUN npm ci --workspace=shared --workspace=frontend --omit=dev

# Copy built artefacts
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY --from=builder /app/frontend/server ./frontend/server

EXPOSE 3000

CMD ["node", "frontend/server/index.js"]
