/**
 * Custom Route Example
 * 
 * Demonstrates how to add custom routes to the API
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

const router = Router();

// Zod schema for validation
const CreatePostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  published: z.boolean().optional().default(false),
});

type CreatePostRequest = z.infer<typeof CreatePostSchema>;

// In-memory storage (in production, use database)
const posts: Array<{ id: string; title: string; content: string; published: boolean }> = [];

/**
 * GET /api/posts - List all posts
 */
router.get('/posts', (_req: Request, res: Response) => {
  res.json({
    posts: posts.filter((p) => p.published),
    total: posts.filter((p) => p.published).length,
  });
});

/**
 * GET /api/posts/:id - Get single post
 */
router.get('/posts/:id', (req: Request, res: Response) => {
  const post = posts.find((p) => p.id === req.params.id);

  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  res.json(post);
});

/**
 * POST /api/posts - Create new post
 */
router.post('/posts', (req: Request, res: Response) => {
  try {
    // Validate request body
    const data: CreatePostRequest = CreatePostSchema.parse(req.body);

    // Create post
    const post = {
      id: `post_${Date.now()}`,
      ...data,
    };

    posts.push(post);

    res.status(201).json(post);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/posts/:id - Update post
 */
router.put('/posts/:id', (req: Request, res: Response) => {
  const index = posts.findIndex((p) => p.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Post not found' });
  }

  try {
    const data: CreatePostRequest = CreatePostSchema.parse(req.body);
    posts[index] = { ...posts[index], ...data };

    res.json(posts[index]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/posts/:id - Delete post
 */
router.delete('/posts/:id', (req: Request, res: Response) => {
  const index = posts.findIndex((p) => p.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Post not found' });
  }

  posts.splice(index, 1);
  res.status(204).send();
});

export default router;

/**
 * How to integrate this router into your app:
 * 
 * ```typescript
 * import customRoutes from './examples/custom-route';
 * app.use('/api', customRoutes);
 * ```
 */
