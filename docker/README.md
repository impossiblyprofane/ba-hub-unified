# Docker Configuration

## Development

For local development, just use `npm run dev` in both frontend and backend directories.

## Production Deployment

Build and run both services with Docker Compose:

```bash
cd docker
docker-compose up --build
```

Or build individually:

```bash
# Backend
docker build -f docker/backend.Dockerfile -t ba-hub-backend ./backend

# Frontend
docker build -f docker/frontend.Dockerfile -t ba-hub-frontend ./frontend
```

## Access

- Frontend: http://localhost:3000
- Backend GraphQL: http://localhost:3001/graphql
- GraphiQL: http://localhost:3001/graphiql
