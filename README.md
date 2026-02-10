# BA Hub Unified - Broken Arrow Stats Platform

> Modern stats tracking and community platform for Broken Arrow RTS game

## 🏗️ Architecture

This is a unified monorepo containing both frontend and backend for the BA Hub platform.

### 📁 Structure

```
ba-hub-unified/
├── frontend/     # Qwik-based frontend application
├── backend/      # FastAPI + GraphQL backend
├── shared/       # Shared types, schemas, and utilities
├── docs/         # Documentation and guides  
├── docker/       # Docker configurations
└── scripts/      # Build and deployment scripts
```

## 🚀 Tech Stack

### Frontend (Planned)
- **Framework**: Qwik (high performance, resumable)
- **Styling**: Tailwind CSS
- **State**: Qwik Signals + TanStack Query
- **Build**: Vite
- **Language**: TypeScript

### Backend (Planned)  
- **API**: FastAPI (Python)
- **Schema**: GraphQL with Strawberry
- **Database**: PostgreSQL
- **Cache**: Redis
- **Language**: Python 3.11+

### Shared
- **Types**: TypeScript definitions
- **Schemas**: GraphQL schemas
- **Utils**: Common utilities

## 🎯 Migration From Legacy

This project migrates from a React + Express SSR setup to a modern Qwik + FastAPI architecture while preserving the excellent metadata-only SSR approach for SEO.

### Legacy Strengths to Preserve
- ✅ Metadata-only SSR (no complex hydration)
- ✅ Comprehensive TypeScript integration  
- ✅ Modular component architecture
- ✅ Game data models and validation

### Improvements
- 🚀 Better performance with Qwik resumability
- 🔗 GraphQL for flexible data fetching
- 📦 Unified monorepo structure
- 🧪 Enhanced testing and development experience

## 📊 Game Features

- **Arsenal Browser**: Unit database with advanced filtering
- **Deck Builder**: Interactive deck construction
- **Map Viewer**: Tactical map analysis
- **Statistics**: Player rankings and match data
- **Tournaments**: Bracket management
- **Collaboration**: Real-time shared editing

## 🛠️ Development

*Setup instructions coming soon...*

## 📝 Documentation

See `/docs` for detailed documentation on:
- API schemas and endpoints
- Component architecture  
- Deployment procedures
- Contributing guidelines

---

**Note**: This is an active migration project. Frontend and backend implementations are in progress.