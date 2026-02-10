# Migration Plan: React → Qwik + REST → GraphQL

## 📋 Overview

Migrating BA Hub from React Express SSR to Qwik + FastAPI GraphQL while preserving the excellent metadata-only SSR approach.

## 🎯 Migration Strategy

### Phase 1: Project Setup ✅
- [x] Create unified repo structure
- [x] Document current architecture analysis
- [x] Plan folder-based monorepo (vs branches)

### Phase 2: Backend Migration (Next)
- [ ] Set up FastAPI project structure
- [ ] Design GraphQL schema based on existing REST endpoints  
- [ ] Implement database models (PostgreSQL)
- [ ] Create GraphQL resolvers
- [ ] Add authentication/authorization
- [ ] Set up testing framework

### Phase 3: Frontend Migration
- [ ] Initialize Qwik project
- [ ] Set up Tailwind CSS and design system
- [ ] Migrate shared types to `/shared`
- [ ] Create base components (Button, Input, etc.)
- [ ] Implement routing and layout

### Phase 4: Feature Migration
- [ ] Arsenal browser (unit database)
- [ ] Deck builder (drag & drop)
- [ ] Map viewer (canvas/Konva replacement)
- [ ] Statistics dashboard
- [ ] Tournament system

### Phase 5: Advanced Features  
- [ ] Real-time collaboration (WebSocket)
- [ ] Metadata-only SSR for Qwik
- [ ] Progressive enhancement
- [ ] Performance optimization

## 🏗️ Architecture Decisions

### Why Qwik over React?
- **Resumability**: No hydration waterfall
- **Performance**: Better Core Web Vitals
- **Bundle size**: Automatic code splitting
- **SEO**: Can preserve metadata-only SSR approach

### Why GraphQL over REST?
- **Flexibility**: Clients fetch exactly what they need
- **Type safety**: Generated TypeScript types
- **Tooling**: Great dev experience with GraphiQL
- **Real-time**: Built-in subscription support

### Why FastAPI over Express?
- **Performance**: Async/await by default
- **Types**: Built-in type validation with Pydantic
- **Documentation**: Auto-generated OpenAPI docs
- **GraphQL**: Excellent integration with Strawberry

## 📊 Current Analysis

### Strengths to Preserve
- Metadata-only SSR approach (brilliant!)
- Comprehensive TypeScript integration
- Game data models and validation
- Modular component architecture

### Areas for Improvement
- Better client-side data management (GraphQL + caching)
- Performance optimization (Qwik resumability)
- Unified codebase (monorepo structure)
- Enhanced developer experience

## 🔄 Migration Workflow

1. **Analyze current**: Document existing patterns and APIs
2. **Design new**: Plan GraphQL schema and Qwik structure
3. **Build backend**: FastAPI + GraphQL foundation
4. **Build frontend**: Qwik + TanStack Query
5. **Migrate features**: One-by-one with testing
6. **Preserve SEO**: Maintain metadata-only SSR benefits

## 🎯 Success Criteria

- [ ] Feature parity with existing React app
- [ ] Better Core Web Vitals scores
- [ ] Preserved SEO benefits
- [ ] Improved developer experience
- [ ] Type-safe API layer