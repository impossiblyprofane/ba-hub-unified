# Frontend Dockerfile — monorepo-aware build with Qwik SSR
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build-time env vars so Vite can inline them
ARG VITE_API_URL
ARG VITE_WS_URL
ARG VITE_ENCRYPTION_KEY
ARG VITE_ENCRYPTION_IV

# Copy root workspace manifests first (cache-friendly layer)
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY frontend/package.json ./frontend/

# Install all workspace deps needed for the build
RUN npm ci --workspace=shared --workspace=frontend

# Copy source for shared + frontend (including server/ for SSR build)
COPY shared/ ./shared/
COPY frontend/ ./frontend/

# Build shared types first, then frontend (client + SSR server)
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

# Copy built artefacts — client bundle + SSR server bundle
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/frontend/dist ./frontend/dist

# Copy static assets (images, maps, etc.)
COPY frontend/public ./frontend/dist

EXPOSE 3000

CMD ["node", "frontend/dist/server/entry.fastify.js"]
