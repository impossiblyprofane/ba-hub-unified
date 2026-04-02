# Database microservice Dockerfile — monorepo-aware build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace manifests first (cache-friendly layer)
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY database/package.json ./database/

# Install all workspace deps needed for the build
RUN npm ci --workspace=shared --workspace=database

# Copy source for shared + database
COPY shared/ ./shared/
COPY database/ ./database/

# Build shared types first, then database
RUN npm run build -w shared && npm run build -w database

# ── Production image ──
FROM node:20-alpine

WORKDIR /app

# Copy root workspace manifests
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY database/package.json ./database/

# Install production deps only
RUN npm ci --workspace=shared --workspace=database --omit=dev

# Copy built artefacts
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/database/dist ./database/dist

# Copy drizzle migrations
COPY --from=builder /app/database/drizzle ./database/drizzle

EXPOSE 3002

CMD ["node", "database/dist/index.js"]
