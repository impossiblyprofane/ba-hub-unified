# BA Hub Development Guide

## Quick Start

```bash
# Install all dependencies
npm install

# Start development (both frontend and backend)
npm run dev

# Or run separately
cd backend && npm run dev    # Port 3001
cd frontend && npm run dev   # Port 3000
```

## Project Structure

```
ba-hub-unified/
├── backend/          # Fastify + GraphQL (Mercurius) API
│   ├── src/
│   │   ├── index.ts              # Server entry
│   │   ├── graphql/              # GraphQL schema & resolvers
│   │   └── data/                 # Static JSON data files
│   └── package.json
│
├── frontend/         # Qwik SPA + Fastify SSR
│   ├── src/
│   │   ├── root.tsx              # App root
│   │   ├── routes/               # Qwik City routes
│   │   └── global.css            # Tailwind styles
│   ├── server/
│   │   └── index.ts              # Fastify SSR server
│   └── package.json
│
├── shared/           # Shared TypeScript types
│   ├── src/
│   │   ├── types.ts              # Core types
│   │   └── legacy/               # Place old type definitions here
│   └── package.json
│
├── docker/           # Production deployment
│   ├── docker-compose.yml
│   ├── backend.Dockerfile
│   └── frontend.Dockerfile
│
└── scripts/          # Build and setup scripts
```

## Tech Stack

- **Language**: TypeScript everywhere
- **Frontend**: Qwik + Fastify (metadata SSR) + Tailwind CSS
- **Backend**: Fastify + GraphQL (Mercurius) + WebSockets
- **Data**: Static JSON files
- **Monorepo**: npm workspaces

## Development Workflow

### Backend (Port 3001)
- GraphQL API at `/graphql`
- GraphiQL UI at `/graphiql`
- WebSocket subscriptions enabled

### Frontend (Port 3000)
- Qwik SPA with client-side routing
- Fastify SSR for metadata (Discord/social previews)
- Connects to backend GraphQL

### Shared Types
- TypeScript definitions used by both frontend and backend
- Place legacy types in `shared/src/legacy/`

## Building for Production

```bash
# Build all packages
npm run build

# Type check all packages
npm run type-check

# Docker deployment
npm run docker:build
npm run docker:up
```

## Environment Variables

### Backend (.env)
```
PORT=3001
LOG_LEVEL=info
FRONTEND_URL=http://localhost:3000
```

### Frontend (.env)
```
PORT=3000
VITE_API_URL=http://localhost:3001/graphql
VITE_WS_URL=ws://localhost:3001/graphql
```

## Features

- **Arsenal Browser** - Unit database with filtering
- **Deck Builder** - Interactive deck construction with drag & drop
- **Map Viewer** - Tactical map visualization
- **Statistics Dashboard** - Player rankings and match data

## GraphQL

The backend uses Mercurius for GraphQL. Schema and resolvers are in:
- `backend/src/graphql/schema.ts`
- `backend/src/graphql/resolvers.ts`

Example query:
```graphql
query {
  hello
}
```

## SSR Strategy

Frontend uses **metadata-only SSR**:
- Crawlers/bots get optimized metadata HTML
- Regular users get full Qwik SPA
- Route-specific metadata injection for link previews

## Data Management

Static JSON data goes in `backend/src/data/`:
- `units.json` - Unit definitions
- `maps.json` - Map data
- `statistics.json` - Player stats

Data is served via GraphQL with configurable results.

## Migration from Legacy

Place your existing TypeScript definitions in `shared/src/legacy/` and we'll integrate them into the new type system.
