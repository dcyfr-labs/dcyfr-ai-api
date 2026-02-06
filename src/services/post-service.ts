/**
 * Post service - CRUD operations
 */
import { eq, and } from 'drizzle-orm';
import type { AppDb } from '../db/connection.js';
import { posts, type Post, type NewPost } from '../db/schema.js';
import { NotFoundError } from '../lib/errors.js';

export class PostService {
  constructor(private readonly db: AppDb) {}

  /** Get all published posts */
  async findPublished(): Promise<Post[]> {
    return this.db.select().from(posts).where(eq(posts.published, true)).all();
  }

  /** Get all posts by author */
  async findByAuthor(authorId: number): Promise<Post[]> {
    return this.db.select().from(posts).where(eq(posts.authorId, authorId)).all();
  }

  /** Get a post by ID */
  async findById(id: number): Promise<Post> {
    const result = this.db.select().from(posts).where(eq(posts.id, id)).get();
    if (!result) throw new NotFoundError('Post', id);
    return result;
  }

  /** Create a new post */
  async create(data: NewPost): Promise<Post> {
    const results = this.db.insert(posts).values(data).returning().all();
    return results[0]!;
  }

  /** Update a post (only by owner) */
  async update(
    id: number,
    authorId: number,
    data: Partial<Pick<Post, 'title' | 'content' | 'published'>>,
  ): Promise<Post> {
    const existing = await this.findById(id);
    if (existing.authorId !== authorId) {
      throw new NotFoundError('Post', id); // Don't reveal it exists
    }

    const results = this.db
      .update(posts)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(and(eq(posts.id, id), eq(posts.authorId, authorId)))
      .returning()
      .all();

    return results[0]!;
  }

  /** Delete a post (only by owner) */
  async delete(id: number, authorId: number): Promise<void> {
    const existing = await this.findById(id);
    if (existing.authorId !== authorId) {
      throw new NotFoundError('Post', id);
    }
    this.db.delete(posts).where(eq(posts.id, id)).run();
  }
}
