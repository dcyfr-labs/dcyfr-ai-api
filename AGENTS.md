# AGENTS.md - @dcyfr/ai-api

## Project Overview

REST API starter template using Express 5, TypeScript, Drizzle ORM (SQLite), JWT auth, Zod validation, and Swagger UI.

## Architecture

- **Entry:** `src/index.ts` → runs migrations → starts Express app
- **App:** `src/app.ts` configures middleware (helmet, cors, json, logging) and mounts routes
- **Routes:** `src/routes/` — auth, users, posts, health
- **Services:** Business logic in `src/services/` — auth, user, post
- **Middleware:** `src/middleware/` — error handler, JWT/API key auth, Zod validation, request logger
- **Database:** Drizzle ORM with better-sqlite3 in `src/db/`
- **Schemas:** Zod validation schemas in `src/schemas/`
- **OpenAPI:** Spec in `src/openapi.ts`, served at `/docs`

## Conventions

- All async errors caught by global error handler middleware
- Structured error classes in `src/lib/errors.ts`
- Barrel exports from each directory via `index.ts`
- Services handle business logic; routes handle HTTP
- Pino for structured JSON logging

## Commands

```bash
npm run dev          # Start with hot reload (port 3001)
npm run build        # Compile TypeScript
npm run test:run     # Run all tests
npm run typecheck    # TypeScript check
npm run db:seed      # Seed database
```

## Testing

- Framework: Vitest 2.1 + Supertest 7
- 75 tests across 9 test files
- In-memory SQLite for test isolation

## Quality Gates
- TypeScript: 0 errors (`npm run typecheck`)
- Tests: ≥99% pass rate (`npm run test`)
- Lint: 0 errors (`npm run lint`)
