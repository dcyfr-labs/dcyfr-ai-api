# API Documentation

**Package:** @dcyfr/ai-api  
**Version:** 0.1.1  
**License:** MIT

A production-ready REST API template built with Express 5, TypeScript, Drizzle ORM, and JWT authentication. Features comprehensive error handling, request validation, database migrations, and OpenAPI documentation.

---

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Authentication](#authentication)
  - [JWT Authentication](#jwt-authentication)
  - [OAuth Integration](#oauth-integration)
  - [API Key Authentication](#api-key-authentication)
- [API Endpoints](#api-endpoints)
  - [Authentication Routes](#authentication-routes)
  - [User Routes](#user-routes)
  - [Post Routes](#post-routes)
  - [Health Check](#health-check)
- [OpenAPI Specification](#openapi-specification)
- [Database](#database)
- [Middleware](#middleware)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Deployment](#deployment)
- [TypeScript Types](#typescript-types)
- [SemVer Commitment](#semver-commitment)

---

## Overview

**@dcyfr/ai-api** is a production-ready REST API template that provides:

- **Express 5** - Fast, unopinionated web framework
- **TypeScript** - Type-safe development with strict mode
- **Drizzle ORM** - Type-safe SQL database toolkit
- **JWT Authentication** - Secure token-based authentication
- **Request Validation** - Zod-based schema validation
- **Error Handling** - Centralized error management
- **Database Migrations** - Automated schema management
- **OpenAPI/Swagger** - Interactive API documentation
- **Health Checks** - Comprehensive health monitoring
- **Logging** - Structured JSON logging with Pino
- **Testing** - 98.54% code coverage with Vitest

### Features

✅ **Production-Ready** - Battle-tested patterns and security best practices  
✅ **Type-Safe** - Full TypeScript coverage with strict mode  
✅ **Well-Tested** - 133 tests with 98.54% line coverage, 86.48% branch coverage  
✅ **Documented** - OpenAPI 3.0 specification with Swagger UI  
✅ **Secure** - CORS, helmet, rate limiting, JWT authentication  
✅ **Observable** - Request logging, error tracking, health checks  
✅ **Maintainable** - Clean architecture with separation of concerns  

---

## Installation

### Prerequisites

- Node.js 18+ or 20+
- npm 9+ or pnpm 8+

### Install Package

```bash
npm install @dcyfr/ai-api
```

### From Source

```bash
git clone https://github.com/dcyfr/dcyfr-ai-api.git
cd dcyfr-ai-api
npm install
npm run build
```

### Environment Variables

Create a `.env` file in the project root:

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=./data/dev.db

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# API Keys (comma-separated)
API_KEYS=dev-key-1,dev-key-2

# CORS
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

**Security Note:** Never commit `.env` files to version control. Use environment-specific configurations in production.

---

## Quick Start

### Start the Server

```typescript
import { createApp } from '@dcyfr/ai-api';

const app = createApp();
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📚 API docs: http://localhost:${PORT}/api/docs`);
});
```

### Run Migrations

```bash
npm run db:migrate
```

### Seed Database (Optional)

```bash
npm run db:seed
```

### Access API Documentation

Open your browser to `http://localhost:3000/api/docs` to explore the interactive Swagger UI.

### Make Your First Request

```bash
# Register a new user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "name": "Alice Smith",
    "password": "SecurePassword123!"
  }'

# Response:
# {
#   "user": {
#     "id": 1,
#     "email": "alice@example.com",
#     "name": "Alice Smith",
#     "role": "user",
#     "createdAt": "2026-02-08T10:30:00Z",
#     "updatedAt": "2026-02-08T10:30:00Z"
#   },
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
# }
```

---

## Authentication

### JWT Authentication

The API uses JSON Web Tokens (JWT) for stateless authentication. All protected routes require a valid JWT in the `Authorization` header.

#### Register a New User

```typescript
POST /api/auth/register

// Request Body
{
  "email": "bob@example.com",
  "name": "Bob Johnson",
  "password": "MySecurePass123!"
}

// Response (201 Created)
{
  "user": {
    "id": 2,
    "email": "bob@example.com",
    "name": "Bob Johnson",
    "role": "user",
    "createdAt": "2026-02-08T10:35:00Z",
    "updatedAt": "2026-02-08T10:35:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsImVtYWlsIjoiYm9iQGV4YW1wbGUuY29tIiwicm9sZSI6InVzZXIiLCJpYXQiOjE3NzA0OTE3MDAsImV4cCI6MTc3MTA5NjUwMH0..."
}
```

**Validation Rules:**
- Email: Must be valid email format
- Name: Required, non-empty string
- Password: Minimum 8 characters

**Password Hashing:** Passwords are hashed using bcrypt with 10 salt rounds.

#### Login

```typescript
POST /api/auth/login

// Request Body
{
  "email": "bob@example.com",
  "password": "MySecurePass123!"
}

// Response (200 OK)
{
  "user": {
    "id": 2,
    "email": "bob@example.com",
    "name": "Bob Johnson",
    "role": "user",
    "createdAt": "2026-02-08T10:35:00Z",
    "updatedAt": "2026-02-08T10:35:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid email or password
- `400 Bad Request` - Validation errors

#### Using JWT Tokens

Include the token in the `Authorization` header for protected routes:

```bash
curl -X GET http://localhost:3000/api/posts \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Token Structure:**

```javascript
// Decoded JWT Payload
{
  "userId": 2,
  "email": "bob@example.com",
  "role": "user",
  "iat": 1770491700,  // Issued at (Unix timestamp)
  "exp": 1771096500   // Expires at (Unix timestamp)
}
```

**Token Expiration:** Default 7 days (configurable via `JWT_EXPIRES_IN` environment variable)

**Token Refresh:** Implement token refresh by re-authenticating when token is near expiration.

### OAuth Integration

The API supports OAuth 2.0 integration for third-party authentication providers (Google, GitHub, etc.).

#### OAuth Flow Pattern

```typescript
import { generateToken } from '@dcyfr/ai-api';

// 1. Redirect user to OAuth provider
app.get('/auth/google', (req, res) => {
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
    `redirect_uri=${process.env.GOOGLE_REDIRECT_URI}&` +
    `response_type=code&` +
    `scope=openid email profile`;
  
  res.redirect(authUrl);
});

// 2. Handle OAuth callback
app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  
  // Exchange code for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  
  const { access_token } = await tokenResponse.json();
  
  // Get user profile
  const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  
  const profile = await profileResponse.json();
  
  // Find or create user in your database
  let user = await userService.findByEmail(profile.email);
  
  if (!user) {
    user = await userService.create({
      email: profile.email,
      name: profile.name,
      password: Math.random().toString(36), // Random password for OAuth users
    });
  }
  
  // Generate JWT token for your API
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });
  
  // Redirect to frontend with token
  res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
});
```

#### OAuth 2.0 Best Practices

1. **State Parameter:** Use CSRF protection with state parameter
2. **PKCE:** Implement Proof Key for Code Exchange for added security
3. **Token Storage:** Store OAuth refresh tokens securely (encrypted at rest)
4. **Scope Limitation:** Request minimum required OAuth scopes
5. **Error Handling:** Handle OAuth errors gracefully with user feedback

#### Supported OAuth Providers

- **Google OAuth 2.0** (recommended)
- **GitHub OAuth** (recommended)
- **Facebook Login**
- **Microsoft Azure AD**
- **Custom OAuth 2.0 providers**

### API Key Authentication

For server-to-server authentication, use API keys instead of JWT.

```typescript
// Configure API keys in .env
API_KEYS=prod-key-abc123,backup-key-xyz789

// Use API key in requests
curl -X GET http://localhost:3000/api/users \
  -H "X-API-Key: prod-key-abc123"
```

**API Key Middleware:**

```typescript
import { apiKeyAuth } from '@dcyfr/ai-api';

// Apply to specific routes
app.get('/api/internal/stats', apiKeyAuth, (req, res) => {
  res.json({ message: 'Internal statistics' });
});
```

**Security Notes:**
- Rotate API keys regularly
- Use different keys for different environments
- Revoke compromised keys immediately
- Never expose API keys in client-side code

---

## API Endpoints

### Authentication Routes

Base Path: `/api/auth`

#### POST /api/auth/register

Register a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "password": "SecurePass123!"
}
```

**Response (201 Created):**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "createdAt": "2026-02-08T10:00:00Z",
    "updatedAt": "2026-02-08T10:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors:**
- `400 Bad Request` - Validation errors
- `409 Conflict` - Email already registered

#### POST /api/auth/login

Authenticate and receive JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (200 OK):**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "createdAt": "2026-02-08T10:00:00Z",
    "updatedAt": "2026-02-08T10:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors:**
- `400 Bad Request` - Validation errors
- `401 Unauthorized` - Invalid credentials

### User Routes

Base Path: `/api/users`

**Authentication:** All routes require JWT authentication. Admin-only routes require `role: "admin"`.

#### GET /api/users

List all users (admin only).

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "email": "admin@example.com",
      "name": "Admin User",
      "role": "admin",
      "createdAt": "2026-02-08T09:00:00Z",
      "updatedAt": "2026-02-08T09:00:00Z"
    },
    {
      "id": 2,
      "email": "user@example.com",
      "name": "Regular User",
      "role": "user",
      "createdAt": "2026-02-08T10:00:00Z",
      "updatedAt": "2026-02-08T10:00:00Z"
    }
  ]
}
```

**Errors:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Non-admin user

#### GET /api/users/:id

Get user by ID (authenticated users).

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response (200 OK):**
```json
{
  "data": {
    "id": 2,
    "email": "user@example.com",
    "name": "Regular User",
    "role": "user",
    "createdAt": "2026-02-08T10:00:00Z",
    "updatedAt": "2026-02-08T10:00:00Z"
  }
}
```

**Errors:**
- `401 Unauthorized` - Missing or invalid token
- `404 Not Found` - User ID does not exist
- `400 Bad Request` - Invalid user ID format

#### PATCH /api/users/:id

Update user (admin only).

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Request:**
```json
{
  "name": "Updated Name",
  "email": "newemail@example.com",
  "role": "admin"
}
```

**Response (200 OK):**
```json
{
  "data": {
    "id": 2,
    "email": "newemail@example.com",
    "name": "Updated Name",
    "role": "admin",
    "createdAt": "2026-02-08T10:00:00Z",
    "updatedAt": "2026-02-08T11:30:00Z"
  }
}
```

**Errors:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Non-admin user
- `404 Not Found` - User ID does not exist
- `400 Bad Request` - Validation errors

#### DELETE /api/users/:id

Delete user (admin only).

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response (204 No Content):**
```
(empty response body)
```

**Errors:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Non-admin user
- `404 Not Found` - User ID does not exist

### Post Routes

Base Path: `/api/posts`

#### GET /api/posts

List posts (public: published only, authenticated: own posts + published).

**Headers (Optional):**
```
Authorization: Bearer <jwt-token>
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "title": "My First Post",
      "content": "This is the content of my first post.",
      "published": true,
      "authorId": 2,
      "createdAt": "2026-02-08T10:30:00Z",
      "updatedAt": "2026-02-08T10:30:00Z"
    },
    {
      "id": 2,
      "title": "Draft Post",
      "content": "This is a draft.",
      "published": false,
      "authorId": 2,
      "createdAt": "2026-02-08T11:00:00Z",
      "updatedAt": "2026-02-08T11:00:00Z"
    }
  ]
}
```

**Behavior:**
- **Unauthenticated:** Returns only published posts
- **Authenticated:** Returns user's own posts (published + drafts) + all published posts from others

#### GET /api/posts/:id

Get post by ID (public if published, owner if draft).

**Headers (Optional):**
```
Authorization: Bearer <jwt-token>
```

**Response (200 OK):**
```json
{
  "data": {
    "id": 1,
    "title": "My First Post",
    "content": "This is the content of my first post.",
    "published": true,
    "authorId": 2,
    "createdAt": "2026-02-08T10:30:00Z",
    "updatedAt": "2026-02-08T10:30:00Z"
  }
}
```

**Errors:**
- `404 Not Found` - Post does not exist or is draft (and not owned by requester)
- `400 Bad Request` - Invalid post ID format

#### POST /api/posts

Create a new post (authenticated users).

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Request:**
```json
{
  "title": "My New Post",
  "content": "Content goes here.",
  "published": false
}
```

**Response (201 Created):**
```json
{
  "data": {
    "id": 3,
    "title": "My New Post",
    "content": "Content goes here.",
    "published": false,
    "authorId": 2,
    "createdAt": "2026-02-08T12:00:00Z",
    "updatedAt": "2026-02-08T12:00:00Z"
  }
}
```

**Validation:**
- Title: Required, max 200 characters
- Content: Required
- Published: Optional boolean (defaults to `false`)

**Errors:**
- `401 Unauthorized` - Missing or invalid token
- `400 Bad Request` - Validation errors

#### PATCH /api/posts/:id

Update own post (authenticated, owner only).

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Request:**
```json
{
  "title": "Updated Title",
  "content": "Updated content.",
  "published": true
}
```

**Response (200 OK):**
```json
{
  "data": {
    "id": 3,
    "title": "Updated Title",
    "content": "Updated content.",
    "published": true,
    "authorId": 2,
    "createdAt": "2026-02-08T12:00:00Z",
    "updatedAt": "2026-02-08T12:30:00Z"
  }
}
```

**Errors:**
- `401 Unauthorized` - Missing or invalid token
- `404 Not Found` - Post does not exist or is owned by another user (security: don't reveal post exists)
- `400 Bad Request` - Validation errors

#### DELETE /api/posts/:id

Delete own post (authenticated, owner only).

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response (204 No Content):**
```
(empty response body)
```

**Errors:**
- `401 Unauthorized` - Missing or invalid token
- `404 Not Found` - Post does not exist or is owned by another user

### Health Check

#### GET /health

Health check endpoint (no authentication required).

**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2026-02-08T12:00:00.000Z",
  "uptime": 3600.5,
  "environment": "development",
  "services": {
    "database": "healthy"
  }
}
```

**Use Cases:**
- Load balancer health checks
- Monitoring systems
- Startup verification

---

## OpenAPI Specification

The API provides a complete OpenAPI 3.0 specification accessible at `/api/docs`.

### Access Swagger UI

```bash
# Start server
npm run dev

# Open browser to:
http://localhost:3000/api/docs
```

### OpenAPI Endpoint

```bash
# Get raw OpenAPI JSON
curl http://localhost:3000/api/docs/openapi.json
```

### Using the Specification

#### Code Generation

Generate TypeScript client:

```bash
npm install -g @openapitools/openapi-generator-cli

openapi-generator-cli generate \
  -i http://localhost:3000/api/docs/openapi.json \
  -g typescript-axios \
  -o ./generated-client
```

Generate Python client:

```bash
openapi-generator-cli generate \
  -i http://localhost:3000/api/docs/openapi.json \
  -g python \
  -o ./generated-client
```

#### API Testing

Import OpenAPI spec into:
- **Postman** - Import → Link or File → OpenAPI 3.0
- **Insomnia** - Import/Export → From URL
- **Bruno** - Import Collection

---

## Database

### Drizzle ORM

The API uses [Drizzle ORM](https://orm.drizzle.team/) for type-safe database operations.

#### Schema

```typescript
// src/db/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  published: integer('published', { mode: 'boolean' }).notNull().default(false),
  authorId: integer('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});
```

#### Migrations

Run migrations:

```bash
npm run db:migrate
```

Create new migration:

```bash
# 1. Modify schema in src/db/schema.ts
# 2. Generate migration
npm run db:generate

# 3. Review generated SQL in drizzle/migrations/
# 4. Apply migration
npm run db:migrate
```

#### Database Queries

```typescript
import { db } from '@dcyfr/ai-api';
import { users, posts } from '@dcyfr/ai-api/schema';
import { eq } from 'drizzle-orm';

// Query users
const allUsers = await db.select().from(users);
const userById = await db.select().from(users).where(eq(users.id, 1));

// Insert
await db.insert(users).values({
  email: 'new@example.com',
  name: 'New User',
  passwordHash: await hashPassword('password'),
});

// Update
await db.update(users)
  .set({ name: 'Updated Name' })
  .where(eq(users.id, 1));

// Delete
await db.delete(users).where(eq(users.id, 1));
```

#### Supported Databases

- **SQLite** (default, recommended for development)
- **PostgreSQL** (recommended for production)
- **MySQL** (supported)

Switch to PostgreSQL:

```typescript
// src/db/connection.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const client = postgres(process.env.DATABASE_URL);
export const db = drizzle(client);
```

---

## Middleware

### Authentication Middleware

```typescript
import { authenticate, authorize } from '@dcyfr/ai-api';

// Require authentication
app.get('/api/protected', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// Require specific role
app.get('/api/admin', authenticate, authorize('admin'), (req, res) => {
  res.json({ message: 'Admin only' });
});
```

### Request Validation

```typescript
import { validate } from '@dcyfr/ai-api';
import { z } from 'zod';

const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  published: z.boolean().optional(),
});

app.post('/api/posts', validate({ body: createPostSchema }), (req, res) => {
  // req.body is now type-safe and validated
  const { title, content, published } = req.body;
  // ...
});
```

### Request Logging

```typescript
import { requestLogger } from '@dcyfr/ai-api';

app.use(requestLogger);

// Logs:
// {"level":30,"time":1770491700,"method":"POST","url":"/api/auth/register","status":201,"duration":"95ms","msg":"request"}
```

---

## Error Handling

### Standard Error Response

All errors follow a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "path": "body.email",
        "message": "Invalid email"
      }
    ]
  }
}
```

### Error Types

#### 400 Bad Request - Validation Error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "path": "body.password",
        "message": "String must contain at least 8 character(s)"
      }
    ]
  }
}
```

#### 401 Unauthorized

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

#### 403 Forbidden

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions"
  }
}
```

#### 404 Not Found

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Post with id '123' not found"
  }
}
```

#### 409 Conflict

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "User with email 'user@example.com' already exists"
  }
}
```

#### 500 Internal Server Error

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred"
  }
}
```

### Custom Error Handling

```typescript
import { AppError, NotFoundError, ValidationError } from '@dcyfr/ai-api';

// Throw custom errors
throw new NotFoundError('Post', 123);
throw new ValidationError('Invalid input', { field: 'email' });
throw new AppError(418, "I'm a teapot", 'TEAPOT');
```

---

## Rate Limiting

**Coming Soon** - Rate limiting functionality is planned for v0.2.0.

Planned features:
- IP-based rate limiting
- User-based rate limiting (authenticated requests)
- Configurable limits per endpoint
- Redis-backed distributed rate limiting

---

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive deployment guides:

- Docker deployment
- Kubernetes deployment
- Cloud platforms (AWS, GCP, Azure)
- Database migrations in production
- Environment configuration
- Health checks and monitoring

---

## TypeScript Types

### Request Types

```typescript
import type { User, Post } from '@dcyfr/ai-api';

// User type (without password)
type SafeUser = {
  id: number;
  email: string;
  name: string;
  role: 'user' | 'admin';
  createdAt: string;
  updatedAt: string;
};

// Post type
type Post = {
  id: number;
  title: string;
  content: string;
  published: boolean;
  authorId: number;
  createdAt: string;
  updatedAt: string;
};
```

### JWT Payload

```typescript
interface JwtPayload {
  userId: number;
  email: string;
  role: string;
  iat: number;  // Issued at
  exp: number;  // Expires at
}
```

### Error Response

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
```

---

## SemVer Commitment

**@dcyfr/ai-api** follows [Semantic Versioning 2.0.0](https://semver.org/):

- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible functionality
- **PATCH** version for backwards-compatible bug fixes

### Stability Guarantees

**v1.x** (current: v0.1.1, targeting v1.0.0):
- ✅ Stable API endpoints
- ✅ Stable request/response formats
- ✅ Stable error responses
- ✅ Stable database schema (with migrations)
- ✅ No breaking changes in minor/patch versions

**Pre-1.0 (current):**
- Minor versions may include breaking changes
- Follow CHANGELOG.md for upgrade guides

---

## Support & Contributing

- **Documentation:** [GitHub Wiki](https://github.com/dcyfr/dcyfr-ai-api/wiki)
- **Issues:** [GitHub Issues](https://github.com/dcyfr/dcyfr-ai-api/issues)
- **Discussions:** [GitHub Discussions](https://github.com/dcyfr/dcyfr-ai-api/discussions)
- **Contributing:** See [CONTRIBUTING.md](../CONTRIBUTING.md)

---

**Last Updated:** February 8, 2026  
**Version:** 0.1.1  
**License:** MIT
