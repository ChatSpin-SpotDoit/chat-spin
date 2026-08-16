# ChatSpin

Production-grade, scalable, real-time anonymous video chat platform built with modern WebRTC, Fastify, Next.js, Redis, and PostgreSQL.

## Architecture Highlights

- **Monorepo**: pnpm workspaces (`apps/web`, `apps/server`, `packages/protocol`, `packages/shared`, `packages/config`)
- **Stateless Backend**: Fastify server pods with horizontal auto-scaling support
- **State Management**: Ephemeral state in Redis 7 (sessions, queues, matches, presence); durable state in PostgreSQL 16 (Drizzle ORM)
- **WebRTC Stack**: Direct P2P with STUN; runtime-togglable `coturn` TURN relay fallback
- **Authentication**: Two-tier model — anonymous `deviceToken` (localStorage) + optional Google OAuth via NextAuth.js v5
- **Features**: Random video chat, 7-day text chat, auto-friendship threshold (5 min), online-only friend calling, direct messaging, safety reporting, blocking, and IP/fingerprint bans

## Prerequisites

- **Node.js**: `>= 20.0.0`
- **pnpm**: `>= 9.0.0`
- **Docker & Docker Compose**: For local PostgreSQL and Redis

## Quick Start (Local Development)

### 1. Clone & Install Dependencies

```bash
pnpm install
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env
```

### 3. Start Database & Redis via Docker

```bash
docker-compose up -d
```

### 4. Run Development Servers

```bash
pnpm run dev
```

- **Frontend**: `http://localhost:3000`
- **Backend HTTP/WS**: `http://localhost:3001`
- **Health check**: `http://localhost:3001/health`
- **Readiness check**: `http://localhost:3001/ready`

## Monorepo Commands

```bash
# Development (hot-reload for all packages & apps)
pnpm run dev

# Type check all packages
pnpm run typecheck

# Lint all packages
pnpm run lint

# Build production bundle
pnpm run build

# Format codebase
pnpm run format
```

## Health Checks

- `GET /health` — Liveness probe (verifies Node.js process is active)
- `GET /ready` — Readiness probe (verifies PostgreSQL and Redis connections)

## License

Private repository. All rights reserved.
