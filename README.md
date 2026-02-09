# @dcyfr/ai-api

Production-ready REST API starter template built with Express 5, Drizzle ORM, JWT authentication, and OpenAPI documentation.

> **📦 Starter Template** — This is a **starter template** for cloning, not an npm package. Use `git clone` or download the source to create your own REST API application. This package is marked `private: true` and is not published to npm.

## Tech Stack

| Category | Technology | Version |
|----------|-----------|---------|
| **Framework** | Express | 5.x |
| **Language** | TypeScript | 5.7+ |
| **ORM** | Drizzle ORM | 0.38+ |
| **Database** | SQLite (better-sqlite3) | — |
| **Auth** | JWT (jsonwebtoken) | 9.x |
| **Validation** | Zod | 3.24+ |
| **Docs** | Swagger UI (OpenAPI 3.0) | — |
| **Logging** | Pino | 9.x |
| **Security** | Helmet + CORS | — |
| **Testing** | Vitest + Supertest | 2.1 / 7.x |

## Quick Start

```bash
# Install dependencies
npm install

# Start development server (with hot reload)
npm run dev

# Run tests
npm run test:run

# Type check
npm run typecheck

# Build for production
npm run build

# Seed the database
npm run db:seed
```

The API server starts at [http://localhost:3001](http://localhost:3001).

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | — | Health check |
| `POST` | `/api/auth/register` | — | Register new user |
| `POST` | `/api/auth/login` | — | Login (returns JWT) |
| `GET` | `/api/users` | JWT (admin) | List all users |
| `GET` | `/api/users/:id` | JWT | Get user by ID |
| `PATCH` | `/api/users/:id` | JWT (admin) | Update user |
| `DELETE` | `/api/users/:id` | JWT (admin) | Delete user |
| `GET` | `/api/posts` | Optional | List posts |
| `GET` | `/api/posts/:id` | — | Get post by ID |
| `POST` | `/api/posts` | JWT | Create post |
| `PATCH` | `/api/posts/:id` | JWT (owner) | Update post |
| `DELETE` | `/api/posts/:id` | JWT (owner) | Delete post |

API documentation available at [http://localhost:3001/docs](http://localhost:3001/docs) (Swagger UI).

## Project Structure

```
dcyfr-ai-api/
├── src/
│   ├── index.ts              # Server entry point
│   ├── app.ts                # Express app setup
│   ├── openapi.ts            # OpenAPI 3.0 spec
│   ├── config/
│   │   └── index.ts          # Environment configuration
│   ├── db/
│   │   ├── connection.ts     # Database connection
│   │   ├── schema.ts         # Drizzle schema (users, posts)
│   │   ├── migrate.ts        # SQL migrations
│   │   └── seed.ts           # Seed data
│   ├── lib/
│   │   ├── errors.ts         # Error classes (AppError, NotFound, etc.)
│   │   └── logger.ts         # Pino logger
│   ├── middleware/
│   │   ├── auth.ts           # JWT + API key auth
│   │   ├── error-handler.ts  # Global error handler
│   │   ├── request-logger.ts # Request logging
│   │   └── validate.ts       # Zod validation
│   ├── routes/
│   │   ├── auth.ts           # Auth routes
│   │   ├── health.ts         # Health check
│   │   ├── posts.ts          # Post CRUD
│   │   └── users.ts          # User CRUD
│   ├── schemas/
│   │   └── index.ts          # Zod validation schemas
│   └── services/
│       ├── auth-service.ts   # JWT + bcrypt
│       ├── post-service.ts   # Post CRUD logic
│       └── user-service.ts   # User CRUD logic
├── tests/
│   ├── setup.ts
│   ├── helpers.ts
│   ├── lib/errors.test.ts
│   ├── middleware/
│   ├── routes/
│   ├── schemas/
│   └── services/
├── Dockerfile
├── docker-compose.yml
└── drizzle.config.ts
```

## Key Patterns

### Request Validation (Zod + Middleware)

```typescript
import { validate } from '../middleware/validate.js';
import { z } from 'zod';

const schema = z.object({ email: z.string().email(), name: z.string() });

router.post('/', validate({ body: schema }), async (req, res) => {
  // req.body is typed and validated
  res.json(req.body);
});
```

### Authentication

```typescript
import { authenticate, authorize } from '../middleware/auth.js';

// JWT required
router.get('/profile', authenticate, handler);

// JWT + admin role required
router.delete('/:id', authenticate, authorize('admin'), handler);
```

### Error Handling

```typescript
import { NotFoundError, ValidationError } from '../lib/errors.js';

// Throw structured errors - caught by global error handler
throw new NotFoundError('User', 42);
// → 404 { error: { code: 'NOT_FOUND', message: "User with id '42' not found" } }
```

### Database (Drizzle ORM)

```typescript
import { db } from '../db/connection.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const user = db.select().from(users).where(eq(users.id, 1)).get();
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `development` |
| `PORT` | Server port | `3001` |
| `DATABASE_URL` | SQLite database path | `./data/dev.db` |
| `JWT_SECRET` | JWT signing secret | — |
| `JWT_EXPIRES_IN` | Token expiry | `7d` |
| `API_KEYS` | Comma-separated API keys | — |
| `CORS_ORIGIN` | Allowed CORS origin | `*` |
| `LOG_LEVEL` | Pino log level | `info` |

Copy `.env.example` to `.env` and configure.

## Docker

```bash
# Build and run
docker compose up -d

# Or build image directly
docker build -t dcyfr-api .
docker run -p 3001:3001 dcyfr-api
```

## Testing

```bash
npm run test:run      # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

75 tests across 9 test files covering errors, schemas, middleware, services, and routes.

## License

MIT - See [LICENSE](LICENSE) for details.
