/**
 * Auth routes - register, login
 */
import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { rateLimit, AUTH_RATE_LIMIT, ONE_MINUTE } from '../middleware/rate-limit.js';
import { registerSchema, loginSchema } from '../schemas/index.js';
import { UserService } from '../services/user-service.js';
import { generateToken } from '../services/auth-service.js';
import { verifyPassword } from '../services/auth-service.js';
import { UnauthorizedError } from '../lib/errors.js';
import { db } from '../db/connection.js';

const router = Router();
const userService = new UserService(db);

// Rate-limit all auth endpoints (login, register) — 60 req/min/IP by default.
// Closes CodeQL js/missing-rate-limiting on this router.
router.use(rateLimit(AUTH_RATE_LIMIT, ONE_MINUTE));

/**
 * POST /auth/register
 * Create a new user account
 */
router.post('/register', validate({ body: registerSchema }), async (req, res) => {
  const { email, name, password } = req.body;
  const user = await userService.create({ email, name, password });
  const token = generateToken({ userId: user.id, email: user.email, role: user.role });

  res.status(201).json({
    user,
    token,
  });
});

/**
 * POST /auth/login
 * Authenticate and receive a JWT
 */
router.post('/login', validate({ body: loginSchema }), async (req, res) => {
  const { email, password } = req.body;
  const user = await userService.findByEmail(email);

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const token = generateToken({ userId: user.id, email: user.email, role: user.role });
  const { passwordHash: _, ...safeUser } = user;

  res.json({
    user: safeUser,
    token,
  });
});

export default router;
