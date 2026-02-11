# BA Hub Unified - Broken Arrow Stats Platform

> Modern stats tracking and community platform for Broken Arrow RTS game

## 🏗️ Architecture

This is a unified monorepo containing both frontend and backend for the BA Hub platform.

### 📁 Structure

```
ba-hub-unified/
├── frontend/     # Qwik SPA + Fastify SSR (metadata only)
├── backend/      # Fastify + GraphQL (Mercurius)
├── shared/       # Shared TypeScript types and utilities
├── docs/         # Documentation
├── docker/       # Docker configs (production)
└── scripts/      # Build scripts
```

## 🚀 Tech Stack

### Frontend
- **Framework**: Qwik (SPA with metadata SSR)
- **SSR Layer**: Fastify (link preview metadata)
- **Styling**: Tailwind CSS
- **State**: Qwik Signals + GraphQL client
- **Language**: TypeScript

### Backend
- **Server**: Fastify
- **API**: GraphQL (Mercurius)
- **Data**: Static JSON files
- **Real-time**: WebSockets
- **Language**: TypeScript

### Shared
- **Types**: TypeScript definitions
- **Schemas**: GraphQL schemas

## 🎯 About

Lightweight third-party stats viewer for Broken Arrow. Migrating from React + Express to a simplified Qwik + Fastify architecture.

### Key Features
- ✅ Metadata-only SSR (Discord/social media previews)
- ✅ TypeScript everywhere
- ✅ GraphQL for flexible querying
- ✅ Static JSON data source
- ✅ WebSocket support for real-time updates
- ✅ Configurable data output

## 📊 Features

- **Arsenal Browser**: Unit database with filtering
- **Deck Builder**: Interactive deck construction
- **Map Viewer**: Tactical map analysis
- **Statistics Dashboard**: Player rankings and match data

## 🛠️ Development

```bash
# Install dependencies
npm install

# Run frontend and backend
npm run dev
```

## 🐳 Deployment

```bash
# Build Docker images
docker-compose up --build
```

## 📝 Documentation

See `/docs` for detailed documentation on:
- API schemas and endpoints
- Component architecture  
- Deployment procedures
- Contributing guidelines

---

**Note**: This is an active migration project. Frontend and backend implementations are in progress.