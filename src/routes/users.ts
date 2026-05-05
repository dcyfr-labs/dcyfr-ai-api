/**
 * User routes - CRUD
 */
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { rateLimit, READ_RATE_LIMIT, WRITE_RATE_LIMIT, ONE_MINUTE } from '../middleware/rate-limit.js';
import { updateUserSchema, userIdParamSchema } from '../schemas/index.js';
import { UserService } from '../services/user-service.js';
import { db } from '../db/connection.js';

const router = Router();
const userService = new UserService(db);

// Rate-limiters: reads (GET) more permissive than writes (PATCH/DELETE).
// Closes CodeQL js/missing-rate-limiting on this router.
const readLimit = rateLimit(READ_RATE_LIMIT, ONE_MINUTE);
const writeLimit = rateLimit(WRITE_RATE_LIMIT, ONE_MINUTE);

/**
 * GET /users
 * List all users (admin only)
 */
router.get('/', readLimit, authenticate, authorize('admin'), async (_req, res) => {
  const users = await userService.findAll();
  res.json({ data: users });
});

/**
 * GET /users/:id
 * Get a user by ID
 */
router.get('/:id', readLimit, authenticate, validate({ params: userIdParamSchema }), async (req, res) => {
  const user = await userService.findById(req.params.id as unknown as number);
  res.json({ data: user });
});

/**
 * PATCH /users/:id
 * Update a user (admin only)
 */
router.patch(
  '/:id',
  writeLimit,
  authenticate,
  authorize('admin'),
  validate({ params: userIdParamSchema, body: updateUserSchema }),
  async (req, res) => {
    const user = await userService.update(req.params.id as unknown as number, req.body);
    res.json({ data: user });
  },
);

/**
 * DELETE /users/:id
 * Delete a user (admin only)
 */
router.delete(
  '/:id',
  writeLimit,
  authenticate,
  authorize('admin'),
  validate({ params: userIdParamSchema }),
  async (req, res) => {
    await userService.delete(req.params.id as unknown as number);
    res.status(204).send();
  },
);

export default router;
