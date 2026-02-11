# Migration Plan: React → Qwik + REST → GraphQL

## 📋 Overview

Lightweight migration of BA Hub to Qwik + Fastify GraphQL. This is a third-party stats viewer - keeping it simple.

## 🎯 Migration Strategy

### Phase 1: Project Setup ✅
- [x] Create unified repo structure
- [x] Simplify scope for lightweight viewer

### Phase 2: Backend (Fastify + GraphQL)
- [ ] Set up Fastify + GraphQL server
- [ ] Design GraphQL schema
- [ ] Static JSON data source
- [ ] WebSocket support for real-time

### Phase 3: Frontend (Qwik SPA + SSR)
- [ ] Initialize Qwik project  
- [ ] Fastify SSR layer (metadata only)
- [ ] Tailwind CSS setup
- [ ] Base components
- [ ] GraphQL client

### Phase 4: Features
- [ ] Arsenal browser (unit database)
- [ ] Deck builder (drag & drop)
- [ ] Map viewer
- [ ] Statistics dashboard

### Phase 5: Polish
- [ ] WebSocket integration
- [ ] Performance optimization
- [ ] Docker deployment

## 🏗️ Architecture (Simplified)

### Stack
- **Frontend**: Qwik SPA + Fastify (metadata SSR only)
- **Backend**: Fastify + GraphQL (Mercurius)
- **Language**: TypeScript everywhere
- **Data**: Static JSON files
- **Real-time**: WebSockets
- **Styling**: Tailwind CSS

### Why This Stack?
- **Qwik**: Resumability, performance, SEO-friendly
- **GraphQL**: Flexible querying, type-safe
- **Fastify**: Fast, TypeScript-friendly, simple
- **Monorepo**: Shared types between frontend/backend

## 📊 Key Points

- **Static data source**: JSON files, served via GraphQL
- **Configurable results**: Data output changes based on configurations
- **Metadata SSR**: Only for link sharing (Discord, etc.)
- **SPA after load**: Client-side navigation post-initial render
- **Type safety**: Shared TypeScript types across stack

## 🎯 Goals

- [ ] Lightweight, fast stats viewer
- [ ] Metadata SSR for social media previews
- [ ] GraphQL for flexible data querying
- [ ] WebSocket for real-time updates
- [ ] Easy local dev (`npm run dev`)
- [ ] Docker-ready for deployment