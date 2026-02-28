# DCYFR API Custom Security Scan Instructions

<!-- TLP:AMBER -->
<!-- Referenced by .github/workflows/security-review.yml via custom-security-scan-instructions -->
<!-- Provides stack context and focus areas so analysis is precise rather than generic. -->

## Tech Stack Context

- **Framework**: Express.js on Node.js. All routes are TypeScript.
- **Database ORM**: Drizzle ORM over PostgreSQL. Parameterised queries are the
  default. Raw SQL via `db.execute(sql\`...\`)` exists in some migration scripts
  — scrutinise these carefully.
- **Authentication**: Bearer token (JWT or API key) on all non-public endpoints.
  Verify the auth middleware is applied to every router that contains sensitive
  operations.
- **Input validation**: Zod schemas or express-validator are the expected
  validation layer. Flag any route handler that reads `req.body`, `req.params`,
  or `req.query` without validated types.
- **External HTTP calls**: Made via native `fetch` or `axios`. Any URL
  constructed with user-supplied input is a potential SSRF — always flag this.
- **File uploads**: If any route accepts multipart uploads, verify MIME type
  validation and file size limits are enforced.
- **Logging**: Structured JSON logs via a logger utility. Check that PII (names,
  emails, tokens) is never logged at INFO level or below.
- **Error handling**: Express error middleware catches uncaught errors. Ensure
  error responses never leak stack traces or internal paths in production.

## High-Priority Areas to Focus On

1. **Route handlers with database writes** (`src/routes/`, `src/controllers/`):
   Look for IDOR (insecure direct object references) — verify that user-scoped
   queries include an ownership check (e.g., `WHERE id = ? AND user_id = ?`).

2. **Authentication middleware** (`src/middleware/auth.ts` or equivalent):
   Verify JWT signature validation, expiration checks, and that the middleware
   is actually applied at the appropriate router level (not just on some routes).

3. **Input deserialization** (`req.body`, `req.params`, `req.query`):
   Flag any use of unsanitized user input in: SQL calls, file paths, `eval()`,
   `child_process`, or URL construction for downstream fetch calls.

4. **Admin/internal endpoints**: Verify every admin endpoint enforces role
   checks beyond simple authentication (authn vs authz distinction).

5. **Drizzle raw SQL escape hatches**: Any `db.execute(sql\`...\`)` call that
   interpolates a variable is a potential injection point. Verify the variable
   is from a trusted source or is cast to a safe type by Drizzle.

6. **Credential and secret leakage**: Check that no endpoint returns full DB
   connection strings, internal API tokens, or password hashes in responses,
   even in error paths.

## Severity Calibration Guidance

- **Critical**: RCE, hardcoded secrets, SQL/NoSQL injection, SSRF with full
  network access, auth bypass on any protected route.
- **High**: IDOR allowing cross-user data access, broken role-based access
  control, SSRF with limited scope, path traversal, mass assignment.
- **Medium**: Information disclosure (stack traces, internal paths), missing
  rate limiting on sensitive operations (login, password reset), insecure
  deserialization in non-critical paths.
- **Low / Informational**: Missing security headers, verbose error messages,
  best-practice deviations without a direct exploitability path.

## Out of Scope

- `node_modules/` — dependency scanning handled by Dependabot and `npm audit`.
- `coverage/` — generated test coverage artifacts.
- `dist/` — compiled output.
- `data/` — seed data files.
- Migration scripts in `src/db/migrations/` — reviewed separately during
  schema review; flag critical issues but note lower expected polish.
