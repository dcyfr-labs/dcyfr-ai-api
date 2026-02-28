# DCYFR API False-Positive Filtering Instructions

<!-- TLP:AMBER -->
<!-- Referenced by .github/workflows/security-review.yml via false-positive-filtering-instructions -->
<!-- Plain English instructions telling Claude which findings to suppress or downgrade. -->

## Suppress These Categories Entirely

- **Generic "use parameterised queries" warnings on ORM calls**: We use Drizzle
  ORM. Findings that correctly identify a Drizzle query builder call as
  "concatenated string" when it is in fact a parameterised ORM method are
  false positives.

- **Environment variable presence checks**: Calls to `process.env.SOME_SECRET`
  are a configuration pattern, not a hardcoded secret. Only report when an
  actual secret value is hardcoded in source.

- **Missing CSRF protection on REST API endpoints**: These endpoints use bearer
  token authentication, not cookie-based sessions. CSRF does not apply to
  token-authenticated APIs.

- **Denial of Service / rate limiting on public endpoints**: We apply
  express-rate-limit middleware at the router level deliberately. Any finding
  about "missing rate limiting" on individual handler functions is a false
  positive if the route group has middleware applied.

- **Memory / CPU exhaustion**: Infrastructure-level concerns are handled by the
  deployment environment. Application-level unbounded loops are still
  reportable.

## Lower Severity (Report as Low / Informational Only)

- Test files (`*.test.ts`, `*.spec.ts`) — security issues in test
  infrastructure are noted but should not block PRs.
- Internal admin/health endpoints that are protected by network policy (not
  exposed publicly) — note access control but mark as informational.
- Swagger/OpenAPI spec files and generated clients — not application code.

## Always Report (Do Not Suppress Even If Matching Above)

- Any hardcoded API key, token, or credential string (even in comments).
- SQL injection in any context, including raw query fallbacks.
- Remote Code Execution in any form.
- Path traversal in file-serving routes.
- SSRF in any URL-fetching code.
- Broken authentication or privilege escalation on API routes.
- PII logged without redaction.
- Missing input validation on POST/PUT/PATCH bodies allowing schema bypass.
