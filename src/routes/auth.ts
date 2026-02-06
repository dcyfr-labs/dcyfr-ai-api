/**
 * Auth routes - register, login
 */
import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../schemas/index.js';
import { UserService } from '../services/user-service.js';
import { generateToken } from '../services/auth-service.js';
import { verifyPassword } from '../services/auth-service.js';
import { UnauthorizedError } from '../lib/errors.js';
import { db } from '../db/connection.js';

const router = Router();
const userService = new UserService(db);

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
  void _;

  res.json({
    user: safeUser,
    token,
  });
});

export default router;
