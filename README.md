# @dcyfr/ai-api

<!-- README-META
  tlp_clearance: GREEN
  status: active
  name: dcyfr-ai-api
  description: Production-ready REST API starter template with Express 5, Drizzle ORM, JWT, and OpenAPI
  last_validated: 2026-07-11
-->

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/dcyfr-labs/dcyfr-ai-api)

[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.0-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![Drizzle](https://img.shields.io/badge/Drizzle-ORM-C5F74F?style=flat-square&logo=drizzle&logoColor=black)](https://orm.drizzle.team/)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-3.0-6BA539?style=flat-square&logo=openapiinitiative&logoColor=white)](https://swagger.io/specification/)
[![Template](https://img.shields.io/badge/Template-Starter-blue?style=flat-square&logo=github)](https://github.com/dcyfr-labs)
[![Sponsor](https://img.shields.io/badge/sponsor-30363D?style=flat-square&logo=GitHub-Sponsors&logoColor=EA4AAA)](https://github.com/sponsors/dcyfr)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

Production-ready REST API starter template built with Express 5, Drizzle ORM, JWT authentication, and OpenAPI documentation.

> **📦 Starter Template** — This is a **starter template** for cloning, not an npm package. Use `git clone` or download the source to create your own REST API application. This package is marked `private: true` and is not published to npm.

## About DCYFR

`@dcyfr/ai-api` is maintained by **DCYFR Labs** as part of the DCYFR starter template portfolio.

- **DCYFR** is a registered trademark of DCYFR Labs.
- Primary domain: [www.dcyfr.ai](https://www.dcyfr.ai)
- Licensing details: [LICENSE](./LICENSE)

---

## ⚡ 30-Second Quick Start

```bash
# Clone template
npx degit dcyfr-labs/dcyfr-ai-api my-api
cd my-api

# Install and start
npm install
npm run dev
# ✅ API running at http://localhost:3001
# 📖 Docs at http://localhost:3001/docs
```

---

## 🧭 Related Packages

| Package                                                            | Purpose                  | Type        |
| ------------------------------------------------------------------ | ------------------------ | ----------- |
| [@dcyfr/ai](https://github.com/dcyfr-labs/dcyfr-ai)                 | Core AI framework        | npm package |
| [@dcyfr/ai-nodejs](https://github.com/dcyfr-labs/dcyfr-ai-nodejs)   | Node.js starter template | Template    |
| [@dcyfr/ai-graphql](https://github.com/dcyfr-labs/dcyfr-ai-graphql) | GraphQL API template     | Template    |
| [dcyfr-labs](https://github.com/dcyfr-labs/dcyfr-labs)              | Production Next.js app   | Application |

---

## Tech Stack

| Category       | Technology               | Version   |
| -------------- | ------------------------ | --------- |
| **Framework**  | Express                  | 5.x       |
| **Language**   | TypeScript               | 6.0+      |
| **ORM**        | Drizzle ORM              | 0.45+     |
| **Database**   | SQLite (better-sqlite3)  | —         |
| **Auth**       | JWT (jsonwebtoken)       | 9.x       |
| **Validation** | Zod                      | 4.4+      |
| **Docs**       | Swagger UI (OpenAPI 3.0) | —         |
| **Logging**    | Pino                     | 10.x      |
| **Security**   | Helmet + CORS            | —         |
| **Testing**    | Vitest + Supertest       | 4.x / 7.x |

## Quick Start

```bash
# Install dependencies
npm install

# If Node 24 cannot load better-sqlite3 on your machine
npm run native:sqlite:ensure

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

## Examples

See [`examples/README.md`](examples/README.md) for runnable examples, prerequisites, and type-check commands.

## API Endpoints

| Method   | Path                 | Auth        | Description         |
| -------- | -------------------- | ----------- | ------------------- |
| `GET`    | `/health`            | —           | Health check        |
| `POST`   | `/api/auth/register` | —           | Register new user   |
| `POST`   | `/api/auth/login`    | —           | Login (returns JWT) |
| `GET`    | `/api/users`         | JWT (admin) | List all users      |
| `GET`    | `/api/users/:id`     | JWT         | Get user by ID      |
| `PATCH`  | `/api/users/:id`     | JWT (admin) | Update user         |
| `DELETE` | `/api/users/:id`     | JWT (admin) | Delete user         |
| `GET`    | `/api/posts`         | Optional    | List posts          |
| `GET`    | `/api/posts/:id`     | —           | Get post by ID      |
| `POST`   | `/api/posts`         | JWT         | Create post         |
| `PATCH`  | `/api/posts/:id`     | JWT (owner) | Update post         |
| `DELETE` | `/api/posts/:id`     | JWT (owner) | Delete post         |

### Optional modules

These route families ship with the template and are wired in `src/app.ts`; they power APNS push notifications, security scanning, and the Linear/GitHub webhook integrations:

| Method   | Path                              | Auth              | Description                              |
| -------- | --------------------------------- | ----------------- | ---------------------------------------- |
| `POST`   | `/api/devices/register`           | —                 | Register APNS device token               |
| `DELETE` | `/api/devices/:token`             | —                 | Remove APNS device token                 |
| `POST`   | `/api/security-scans`             | —                 | Queue a security scan (202 + scanId)     |
| `GET`    | `/api/security-scans/:id`         | —                 | Poll scan state / results                |
| `POST`   | `/webhooks/approval-notification` | HMAC (Inngest)    | Inngest agent.completed → APNS push      |
| `POST`   | `/api/linear-sync/github-webhook` | HMAC (GitHub)     | Linear ↔ GitHub issue sync webhook       |
| `GET`    | `/api/linear-sync/dead-letter`    | —                 | List dead-lettered sync events           |
| `POST`   | `/api/linear-sync/replay/:eventId`| —                 | Replay a dead-lettered sync event        |
| `POST`   | `/api/review/github-webhook`      | HMAC (GitHub)     | PR security-review webhook               |

API documentation available at [http://localhost:3001/docs](http://localhost:3001/docs) (Swagger UI).

## Project Structure

```text
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
│   │   ├── migrations/       # SQL migration files
│   │   └── seed.ts           # Seed data
│   ├── lib/
│   │   ├── errors.ts         # Error classes (AppError, NotFound, etc.)
│   │   ├── logger.ts         # Pino logger
│   │   └── metrics.ts        # Prometheus metrics (prom-client)
│   ├── middleware/
│   │   ├── auth.ts           # JWT + API key auth
│   │   ├── error-handler.ts  # Global error handler
│   │   ├── rate-limit.ts     # Rate limiting (express-rate-limit)
│   │   ├── request-logger.ts # Request logging
│   │   └── validate.ts       # Zod validation
│   ├── routes/
│   │   ├── auth.ts           # Auth routes
│   │   ├── devices.ts        # APNS device registration
│   │   ├── health.ts         # Health check
│   │   ├── linear/           # Linear ↔ GitHub sync webhook
│   │   ├── posts.ts          # Post CRUD
│   │   ├── review/           # PR security-review webhook
│   │   ├── security-scans.ts # Security scan queue/poll
│   │   ├── users.ts          # User CRUD
│   │   └── webhooks.ts       # Inngest → APNS notifications
│   ├── schemas/
│   │   └── index.ts          # Zod validation schemas
│   ├── services/
│   │   ├── auth-service.ts   # JWT + bcrypt
│   │   ├── post-service.ts   # Post CRUD logic
│   │   ├── user-service.ts   # User CRUD logic
│   │   ├── review/           # Diff/security analysis for PR reviews
│   │   └── ...               # APNS, Linear sync, scans, dead-letter
│   └── types/                # Ambient type declarations
├── tests/
│   ├── setup.ts
│   ├── helpers.ts
│   ├── lib/errors.test.ts
│   ├── middleware/
│   ├── routes/
│   ├── schemas/
│   └── services/
├── docs/                     # API.md, DEPLOYMENT.md, SECURITY.md
├── examples/                 # basic-usage, custom-route, database, middleware
├── scripts/                  # native sqlite rebuild, webhook setup helpers
├── Dockerfile
├── docker-compose.yml
└── drizzle.config.ts
```

## Key Patterns

### Request Validation (Zod + Middleware)

```typescript
import { validate } from "../middleware/validate.js";
import { z } from "zod";

const schema = z.object({ email: z.string().email(), name: z.string() });

router.post("/", validate({ body: schema }), async (req, res) => {
  // req.body is typed and validated
  res.json(req.body);
});
```

### Authentication

```typescript
import { authenticate, authorize } from "../middleware/auth.js";

// JWT required
router.get("/profile", authenticate, handler);

// JWT + admin role required
router.delete("/:id", authenticate, authorize("admin"), handler);
```

### Error Handling

```typescript
import { NotFoundError, ValidationError } from "../lib/errors.js";

// Throw structured errors - caught by global error handler
throw new NotFoundError("User", 42);
// → 404 { error: { code: 'NOT_FOUND', message: "User with id '42' not found" } }
```

### Database (Drizzle ORM)

```typescript
import { db } from "../db/connection.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

const user = db.select().from(users).where(eq(users.id, 1)).get();
```

## Environment Variables

### Core

| Variable         | Description                                        | Default                 |
| ---------------- | -------------------------------------------------- | ----------------------- |
| `NODE_ENV`       | Environment                                        | `development`           |
| `PORT`           | Server port                                        | `3001`                  |
| `DATABASE_URL`   | SQLite database path                               | `./data/dev.db`         |
| `JWT_SECRET`     | JWT signing secret (required in production)        | dev-only fallback       |
| `JWT_EXPIRES_IN` | Token expiry                                       | `7d`                    |
| `API_KEYS`       | Comma-separated API keys                           | —                       |
| `CORS_ORIGIN`    | Comma-separated allowed origins (no wildcards)     | `http://localhost:3000` |
| `LOG_LEVEL`      | Pino log level                                     | `info`                  |

### Rate limiting (optional overrides)

| Variable               | Description                    | Default |
| ---------------------- | ------------------------------ | ------- |
| `RATE_LIMIT_AUTH_MAX`  | Auth requests per minute       | `60`    |
| `RATE_LIMIT_READ_MAX`  | Read requests per minute       | `300`   |
| `RATE_LIMIT_WRITE_MAX` | Write requests per minute      | `60`    |

### Optional modules

| Variable                                                       | Used by                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------- |
| `GITHUB_WEBHOOK_SECRET`, `LINEAR_API_KEY`, `DRY_RUN`            | Linear ↔ GitHub sync (`/api/linear-sync/*`)                    |
| `LINEAR_WEBHOOK_RATE_LIMIT_MAX`, `LINEAR_WEBHOOK_RATE_LIMIT_WINDOW_MS` | Linear webhook rate limiting                            |
| `REVIEW_WEBHOOK_SECRET`, `REVIEW_ALLOWED_REPOS`, `GITHUB_TOKEN` | PR security-review webhook (`/api/review/*`)                   |
| `REVIEW_WEBHOOK_RATE_LIMIT_MAX`, `REVIEW_WEBHOOK_RATE_LIMIT_WINDOW_MS` | Review webhook rate limiting                            |
| `INNGEST_WEBHOOK_SECRET`                                        | Inngest approval-notification webhook (`/webhooks/*`)          |
| `APNS_ENABLED`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`, `APNS_PRIVATE_KEY`, `APNS_SANDBOX`, `APNS_DB_PATH` | APNS push notifications |
| `GITHUB_OWNER`, `GITHUB_REPO`, `WEBHOOK_URL`, `WEBHOOK_EVENTS`  | `npm run linear:webhook:setup` helper script                   |

`REVIEW_ALLOWED_REPOS` is fail-closed in production: an empty allowlist rejects all review webhooks (in dev/test it permits any repo with a startup warning).

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

### Native SQLite note

On some Node 24 Linux/macOS environments, `better-sqlite3` may need a native rebuild before tests or database tasks can run. Use:

```bash
npm run native:sqlite:ensure
```

The script automatically prefers `clang`/`clang++` when available, which avoids the GCC 13 internal compiler error we have seen while compiling bundled SQLite sources.

The suite spans 30 test files covering errors, schemas, middleware, services, and routes.

## Documentation

- [docs/API.md](docs/API.md) — endpoint reference
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — deployment guide
- [docs/SECURITY.md](docs/SECURITY.md) — security notes
- [examples/README.md](examples/README.md) — runnable examples

## License

MIT - See [LICENSE](LICENSE) for details.
