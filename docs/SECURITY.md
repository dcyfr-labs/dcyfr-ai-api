# Security Best Practices

This document outlines security best practices for the DCYFR AI API template.

## Authentication & Authorization

### JWT Security

**✅ DO:**
- Use strong secret keys (min 32 characters, random)
- Set reasonable token expiration (1-24 hours)
- Include user ID and minimal data in token payload
- Validate tokens on every protected route
- Use HTTPS in production

**❌ DON'T:**
- Store sensitive data in JWT payload (it's not encrypted)
- Use weak or predictable secrets
- Set tokens to never expire
- Share tokens across different applications

```typescript
// Good
const token = jwt.sign(
  { userId: user.id, email: user.email },
  process.env.JWT_SECRET!, // Strong random secret
  { expiresIn: '24h' }
);

// Bad
const token = jwt.sign(
  { userId: user.id, password: user.password }, // ❌ Don't include password!
  'secret123', // ❌ Weak secret!
  {} // ❌ No expiration!
);
```

### Password Hashing

Always use bcrypt (or argon2) with proper cost factor:

```typescript
import bcrypt from 'bcryptjs';

// Hashing (e.g., during registration)
const hashedPassword = await bcrypt.hash(password, 10); // Cost factor 10

// Verification (e.g., during login)
const isValid = await bcrypt.compare(password, user.hashedPassword);
```

**Cost Factor Guidelines:**
- Development: 10
- Production: 12-14 (higher = more secure but slower)

## Input Validation

### Use Zod for All Inputs

Never trust user input. Validate everything:

```typescript
import { z } from 'zod';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(100),
});

// Validate
const result = RegisterSchema.safeParse(req.body);
if (!result.success) {
  return res.status(400).json({ errors: result.error.errors });
}
```

### SQL Injection Prevention

Drizzle ORM automatically prevents SQL injection, but follow these rules:

**✅ DO:**
```typescript
// Parameterized queries (safe)
const users = await db
  .select()
  .from(usersTable)
  .where(eq(usersTable.email, email));
```

**❌ DON'T:**
```typescript
// Raw SQL with user input (dangerous!)
const users = await db.execute(
  `SELECT * FROM users WHERE email = '${email}'`
);
```

## Rate Limiting

Implement rate limiting to prevent abuse:

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many requests from this IP',
});

app.use('/api/', limiter);
```

**Recommended Limits:**
- Authentication endpoints: 5-10 requests per 15 minutes
- General API: 100-1000 requests per 15 minutes
- Public endpoints: 1000+ requests per 15 minutes

## CORS Configuration

Configure CORS properly:

```typescript
import cors from 'cors';

// Production
app.use(cors({
  origin: ['https://yourdomain.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

// Development (more permissive)
app.use(cors({
  origin: true,
  credentials: true,
}));
```

## Security Headers (Helmet)

Always use Helmet middleware:

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));
```

## Environment Variables

### Never Commit Secrets

**✅ DO:**
- Store secrets in `.env` (add to `.gitignore`)
- Use environment-specific files (`.env.development`, `.env.production`)
- Validate required env vars on startup

```typescript
// config/env.ts
const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'];

requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
});
```

**❌ DON'T:**
- Hardcode secrets in source code
- Commit `.env` files to git
- Use default/example secrets in production

## Error Handling

### Don't Leak Information

```typescript
// ✅ Good - Generic error message
app.use((error, req, res, next) => {
  logger.error(error); // Log detailed error
  res.status(500).json({ error: 'Internal server error' }); // Generic message
});

// ❌ Bad - Exposes stack trace
app.use((error, req, res, next) => {
  res.status(500).json({ error: error.message, stack: error.stack });
});
```

## Database Security

### Connection Security

```typescript
// ✅ Use connection pooling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Max connections
  idleTimeoutMillis: 30000,
});

// ✅ Close connections properly
process.on('SIGTERM', () => {
  pool.end(() => {
    process.exit(0);
  });
});
```

### Principle of Least Privilege

- Database user should only have necessary permissions
- Don't use root/admin accounts for application connections
- Separate read-only and write operations if possible

## Logging & Monitoring

### What to Log

**✅ Log:**
- Authentication attempts (success and failure)
- Authorization failures
- Input validation errors
- Rate limit violations
- Unhandled errors

**❌ Don't Log:**
- Passwords (plain or hashed)
- JWT tokens
- Credit card numbers
- Personal identifiable information (PII)

```typescript
// ✅ Good
logger.info({ userId: user.id, action: 'login' }, 'User logged in');

// ❌ Bad
logger.info({ password: user.password }, 'Login attempt');
```

## Checklist

Before deploying to production:

- [ ] All secrets in environment variables
- [ ] Strong JWT secret (32+ characters)
- [ ] Password hashing with bcrypt (cost 12-14)
- [ ] Input validation with Zod on all routes
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Helmet middleware enabled
- [ ] HTTPS enforced
- [ ] Error messages don't leak information
- [ ] Logging configured (no PII)
- [ ] Database connections use least privilege
- [ ] Dependencies updated (`npm audit`)

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Node.js Security Checklist](https://github.com/goldbergyoni/nodebestpractices#6-security-best-practices)
