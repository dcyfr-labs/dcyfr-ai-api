/**
 * Integration tests for post API endpoints
 * Tests: GET /posts, GET /posts/:id, POST /posts, PATCH /posts/:id, DELETE /posts/:id
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp, resetTestDb } from '../helpers.js';

describe('Post API Endpoints', () => {
  const app = createTestApp();
  let user1Token: string;
  let user1Id: number;
  let user2Token: string;
  let user2Id: number;
  let post1Id: number;
  let post2Id: number;

  beforeEach(async () => {
    resetTestDb();

    // Create two users
    const user1Res = await request(app).post('/api/auth/register').send({
      email: 'alice@example.com',
      name: 'Alice',
      password: 'AlicePassword123!',
    });
    user1Token = user1Res.body.token;
    user1Id = user1Res.body.user.id;

    const user2Res = await request(app).post('/api/auth/register').send({
      email: 'bob@example.com',
      name: 'Bob',
      password: 'BobPassword123!',
    });
    user2Token = user2Res.body.token;
    user2Id = user2Res.body.user.id;

    // Create posts for user1
    const post1Res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        title: 'Alice First Post',
        content: 'Content of Alice first post.',
        published: true,
      });
    post1Id = post1Res.body.data.id;

    const post2Res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        title: 'Alice Draft Post',
        content: 'This is a draft.',
        published: false,
      });
    post2Id = post2Res.body.data.id;
  });

  describe('GET /posts', () => {
    it('should list published posts for unauthenticated users', async () => {
      const res = await request(app).get('/api/posts');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      
      // Should only include published posts
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const titles = res.body.data.map((p: any) => p.title);
      expect(titles).toContain('Alice First Post');
      expect(titles).not.toContain('Alice Draft Post'); // Draft should not be visible
    });

    it('should list author posts for authenticated user', async () => {
      const res = await request(app)
        .get('/api/posts')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      
      // Authenticated user sees their own posts (published and drafts)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const titles = res.body.data.map((p: any) => p.title);
      expect(titles).toContain('Alice First Post');
      expect(titles).toContain('Alice Draft Post');
      
      // All posts should belong to user1
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res.body.data.forEach((post: any) => {
        expect(post.authorId).toBe(user1Id);
      });
    });

    it('should return empty array when user has no posts', async () => {
      const res = await request(app)
        .get('/api/posts')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(0);
    });
  });

  describe('GET /posts/:id', () => {
    it('should get a published post by ID', async () => {
      const res = await request(app).get(`/api/posts/${post1Id}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBe(post1Id);
      expect(res.body.data.title).toBe('Alice First Post');
      expect(res.body.data.content).toBe('Content of Alice first post.');
      expect(res.body.data.published).toBe(true);
      expect(res.body.data.authorId).toBe(user1Id);
    });

    it('should return 404 for non-existent post ID', async () => {
      const res = await request(app).get('/api/posts/999999');

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });

    it('should reject invalid post ID format', async () => {
      const res = await request(app).get('/api/posts/not-a-number');

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject negative post ID', async () => {
      const res = await request(app).get('/api/posts/-1');

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('POST /posts', () => {
    it('should create a new post when authenticated', async () => {
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          title: 'Bob First Post',
          content: 'This is Bob content.',
          published: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.title).toBe('Bob First Post');
      expect(res.body.data.content).toBe('This is Bob content.');
      expect(res.body.data.published).toBe(true);
      expect(res.body.data.authorId).toBe(user2Id);
    });

    it('should create draft post with published=false', async () => {
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          title: 'Bob Draft',
          content: 'Draft content.',
          published: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.published).toBe(false);
    });

    it('should default to published=false when not specified', async () => {
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          title: 'Auto Draft',
          content: 'No published field.',
          // published not specified
        });

      expect(res.status).toBe(201);
      expect(res.body.data.published).toBe(false);
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app).post('/api/posts').send({
        title: 'Unauthorized Post',
        content: 'This should fail.',
        published: true,
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('should reject missing title', async () => {
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          content: 'Content without title.',
          published: true,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject missing content', async () => {
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Title without content',
          published: true,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject empty title', async () => {
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: '',
          content: 'Content here.',
          published: true,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject title longer than 200 characters', async () => {
      const res = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'A'.repeat(201),
          content: 'Content here.',
          published: true,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('PATCH /posts/:id', () => {
    it('should update own post', async () => {
      const res = await request(app)
        .patch(`/api/posts/${post1Id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Updated Title',
          content: 'Updated content.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(post1Id);
      expect(res.body.data.title).toBe('Updated Title');
      expect(res.body.data.content).toBe('Updated content.');
    });

    it('should publish a draft post', async () => {
      const res = await request(app)
        .patch(`/api/posts/${post2Id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          published: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.published).toBe(true);
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app).patch(`/api/posts/${post1Id}`).send({
        title: 'Hack Title',
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('should reject updating another user post', async () => {
      const res = await request(app)
        .patch(`/api/posts/${post1Id}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          title: 'Bob Trying to Update Alice Post',
        });

      // API returns 404 for posts user doesn't own (security: don't reveal post exists)
      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });

    it('should return 404 for non-existent post ID', async () => {
      const res = await request(app)
        .patch('/api/posts/999999')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Ghost Post',
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });

    it('should reject invalid title in update', async () => {
      const res = await request(app)
        .patch(`/api/posts/${post1Id}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: '',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('DELETE /posts/:id', () => {
    it('should delete own post', async () => {
      const res = await request(app)
        .delete(`/api/posts/${post1Id}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(204);

      // Verify deletion
      const getRes = await request(app).get(`/api/posts/${post1Id}`);
      expect(getRes.status).toBe(404);
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app).delete(`/api/posts/${post1Id}`);

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('should reject deleting another user post', async () => {
      const res = await request(app)
        .delete(`/api/posts/${post1Id}`)
        .set('Authorization', `Bearer ${user2Token}`);

      // API returns 404 for posts user doesn't own (security: don't reveal post exists)
      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });

    it('should return 404 for non-existent post ID', async () => {
      const res = await request(app)
        .delete('/api/posts/999999')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });

    it('should reject invalid post ID format', async () => {
      const res = await request(app)
        .delete('/api/posts/not-a-number')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });
});
