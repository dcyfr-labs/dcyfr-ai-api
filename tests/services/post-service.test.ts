/**
 * Tests for post service
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PostService } from '../../src/services/post-service.js';
import { UserService } from '../../src/services/user-service.js';
import { createDb, type AppDb } from '../../src/db/connection.js';
import { migrate } from '../../src/db/migrate.js';

describe('PostService', () => {
  let db: AppDb;
  let postService: PostService;
  let authorId: number;

  beforeEach(async () => {
    const { orm, sqlite } = createDb(':memory:');
    migrate(sqlite);
    db = orm;
    postService = new PostService(db);

    // Create a test user
    const userService = new UserService(db);
    const user = await userService.create({
      email: 'author@test.com',
      name: 'Author',
      password: 'password123',
    });
    authorId = user.id;
  });

  it('should create a post', async () => {
    const post = await postService.create({
      title: 'Test Post',
      content: 'Test content',
      authorId,
    });

    expect(post.title).toBe('Test Post');
    expect(post.content).toBe('Test content');
    expect(post.published).toBe(false);
    expect(post.authorId).toBe(authorId);
  });

  it('should find a post by id', async () => {
    const created = await postService.create({
      title: 'Find Me',
      content: 'Content',
      authorId,
    });

    const found = await postService.findById(created.id);
    expect(found.title).toBe('Find Me');
  });

  it('should throw NotFoundError for missing post', async () => {
    await expect(postService.findById(9999)).rejects.toThrow('not found');
  });

  it('should find published posts', async () => {
    await postService.create({
      title: 'Published',
      content: 'Content',
      published: true,
      authorId,
    });
    await postService.create({
      title: 'Draft',
      content: 'Content',
      published: false,
      authorId,
    });

    const published = await postService.findPublished();
    expect(published.length).toBe(1);
    expect(published[0]!.title).toBe('Published');
  });

  it('should find posts by author', async () => {
    await postService.create({ title: 'Post 1', content: 'C1', authorId });
    await postService.create({ title: 'Post 2', content: 'C2', authorId });

    const authorPosts = await postService.findByAuthor(authorId);
    expect(authorPosts.length).toBe(2);
  });

  it('should update a post by owner', async () => {
    const post = await postService.create({
      title: 'Original',
      content: 'Content',
      authorId,
    });

    const updated = await postService.update(post.id, authorId, { title: 'Updated' });
    expect(updated.title).toBe('Updated');
  });

  it('should reject update by non-owner', async () => {
    const post = await postService.create({
      title: 'My Post',
      content: 'Content',
      authorId,
    });

    await expect(postService.update(post.id, 9999, { title: 'Hacked' })).rejects.toThrow(
      'not found',
    );
  });

  it('should delete a post by owner', async () => {
    const post = await postService.create({
      title: 'Delete Me',
      content: 'Content',
      authorId,
    });

    await postService.delete(post.id, authorId);
    await expect(postService.findById(post.id)).rejects.toThrow('not found');
  });

  it('should reject delete by non-owner', async () => {
    const post = await postService.create({
      title: 'My Post',
      content: 'Content',
      authorId,
    });

    await expect(postService.delete(post.id, 9999)).rejects.toThrow('not found');
  });
});
