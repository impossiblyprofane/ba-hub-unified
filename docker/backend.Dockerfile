# Backend Dockerfile — monorepo-aware build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace manifests first (cache-friendly layer)
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/

# Install all workspace deps needed for the build
RUN npm ci --workspace=shared --workspace=backend

# Copy source for shared + backend
COPY shared/ ./shared/
COPY backend/ ./backend/

# Build shared types first, then backend
RUN npm run build -w shared && npm run build -w backend

# ── Production image ──
FROM node:20-alpine

WORKDIR /app

# Copy root workspace manifests
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/

# Install production deps only
RUN npm ci --workspace=shared --workspace=backend --omit=dev

# Copy built artefacts
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/backend/dist ./backend/dist

# Copy static data files
COPY backend/src/data/static ./backend/dist/data/static

EXPOSE 3001

CMD ["node", "backend/dist/index.js"]
