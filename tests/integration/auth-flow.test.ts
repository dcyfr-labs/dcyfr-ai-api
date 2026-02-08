/**
 * Integration tests for authentication flows
 * Tests: POST /auth/register, POST /auth/login
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp, resetTestDb } from '../helpers.js';

describe('Authentication Flows', () => {
  const app = createTestApp();

  beforeEach(() => {
    resetTestDb();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'alice@example.com',
        name: 'Alice Smith',
        password: 'SecurePassword123!',
      });

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('alice@example.com');
      expect(res.body.user.name).toBe('Alice Smith');
      expect(res.body.user.role).toBe('user');
      expect(res.body.user.passwordHash).toBeUndefined(); // Should not expose hash
      expect(res.body.token).toBeDefined();
      expect(typeof res.body.token).toBe('string');
    });

    it('should reject duplicate email', async () => {
      // Register first user
      await request(app).post('/api/auth/register').send({
        email: 'bob@example.com',
        name: 'Bob',
        password: 'Password123!',
      });

      // Try to register with same email
      const res = await request(app).post('/api/auth/register').send({
        email: 'bob@example.com',
        name: 'Bob Duplicate',
        password: 'DifferentPass123!',
      });

      expect(res.status).toBe(409); // Conflict
      expect(res.body.error).toBeDefined();
    });

    it('should reject invalid email format', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'not-an-email',
        name: 'Charlie',
        password: 'Password123!',
      });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors.body).toBeDefined();
    });

    it('should reject password shorter than 8 characters', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'dave@example.com',
        name: 'Dave',
        password: 'Short1!',
      });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors.body).toBeDefined();
    });

    it('should reject missing required fields', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'eve@example.com',
        // Missing name and password
      });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    it('should reject empty name', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'frank@example.com',
        name: '',
        password: 'Password123!',
      });

      expect(res.status).toBe(400);
      expect(res.body.errors.body).toBeDefined();
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Register a test user before each login test
      await request(app).post('/api/auth/register').send({
        email: 'testuser@example.com',
        name: 'Test User',
        password: 'MySecurePassword123!',
      });
    });

    it('should login successfully with valid credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'testuser@example.com',
        password: 'MySecurePassword123!',
      });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('testuser@example.com');
      expect(res.body.user.name).toBe('Test User');
      expect(res.body.user.passwordHash).toBeUndefined(); // Should not expose hash
      expect(res.body.token).toBeDefined();
      expect(typeof res.body.token).toBe('string');
    });

    it('should reject login with incorrect password', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'testuser@example.com',
        password: 'WrongPassword123!',
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });

    it('should reject login with non-existent email', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'nonexistent@example.com',
        password: 'Password123!',
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });

    it('should reject login with invalid email format', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'not-an-email',
        password: 'Password123!',
      });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    it('should reject login with missing password', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'testuser@example.com',
        // Missing password
      });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe('Authentication Flow Integration', () => {
    it('should complete full register → login → access protected resource flow', async () => {
      // Step 1: Register
      const registerRes = await request(app).post('/api/auth/register').send({
        email: 'fullflow@example.com',
        name: 'Full Flow User',
        password: 'FlowPassword123!',
      });

      expect(registerRes.status).toBe(201);
      const registerToken = registerRes.body.token;

      // Step 2: Login
      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'fullflow@example.com',
        password: 'FlowPassword123!',
      });

      expect(loginRes.status).toBe(200);
      const loginToken = loginRes.body.token;
      expect(loginToken).toBeDefined();

      // Step 3: Access protected resource (create a post)
      const postRes = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${loginToken}`)
        .send({
          title: 'My First Post',
          content: 'This is the content of my first post.',
          published: true,
        });

      expect(postRes.status).toBe(201);
      expect(postRes.body.data.title).toBe('My First Post');
      expect(postRes.body.data.authorId).toBe(loginRes.body.user.id);

      // Verify both tokens work (register token and login token)
      const postRes2 = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${registerToken}`)
        .send({
          title: 'Second Post',
          content: 'Using register token.',
          published: false,
        });

      expect(postRes2.status).toBe(201);
    });
  });
});
