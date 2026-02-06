/**
 * Post routes - CRUD
 */
import { Router } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createPostSchema, updatePostSchema, postIdParamSchema } from '../schemas/index.js';
import { PostService } from '../services/post-service.js';
import { db } from '../db/connection.js';
import { UnauthorizedError } from '../lib/errors.js';

const router = Router();
const postService = new PostService(db);

/**
 * GET /posts
 * List published posts (public) or all posts for authenticated author
 */
router.get('/', optionalAuth, async (req, res) => {
  if (req.user) {
    const posts = await postService.findByAuthor(req.user.userId);
    res.json({ data: posts });
  } else {
    const posts = await postService.findPublished();
    res.json({ data: posts });
  }
});

/**
 * GET /posts/:id
 * Get a single post
 */
router.get('/:id', validate({ params: postIdParamSchema }), async (req, res) => {
  const post = await postService.findById(req.params.id as unknown as number);
  res.json({ data: post });
});

/**
 * POST /posts
 * Create a new post (authenticated)
 */
router.post('/', authenticate, validate({ body: createPostSchema }), async (req, res) => {
  if (!req.user) throw new UnauthorizedError();
  const post = await postService.create({
    ...req.body,
    authorId: req.user.userId,
  });
  res.status(201).json({ data: post });
});

/**
 * PATCH /posts/:id
 * Update a post (owner only)
 */
router.patch(
  '/:id',
  authenticate,
  validate({ params: postIdParamSchema, body: updatePostSchema }),
  async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    const post = await postService.update(
      req.params.id as unknown as number,
      req.user.userId,
      req.body,
    );
    res.json({ data: post });
  },
);

/**
 * DELETE /posts/:id
 * Delete a post (owner only)
 */
router.delete(
  '/:id',
  authenticate,
  validate({ params: postIdParamSchema }),
  async (req, res) => {
    if (!req.user) throw new UnauthorizedError();
    await postService.delete(req.params.id as unknown as number, req.user.userId);
    res.status(204).send();
  },
);

export default router;
