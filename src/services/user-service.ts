/**
 * User service - CRUD operations
 */
import { eq } from 'drizzle-orm';
import type { AppDb } from '../db/connection.js';
import { users, type User, type NewUser } from '../db/schema.js';
import { NotFoundError, ConflictError } from '../lib/errors.js';
import { hashPassword } from './auth-service.js';

export class UserService {
  constructor(private readonly db: AppDb) {}

  /** Get all users (without password hashes) */
  async findAll(): Promise<Omit<User, 'passwordHash'>[]> {
    const result = this.db.select().from(users).all();
    return result.map(({ passwordHash: _, ...user }) => user);
  }

  /** Get a user by ID */
  async findById(id: number): Promise<Omit<User, 'passwordHash'>> {
    const result = this.db.select().from(users).where(eq(users.id, id)).get();
    if (!result) throw new NotFoundError('User', id);
     
    const { passwordHash: _, ...user } = result;
    return user;
  }

  /** Get a user by email (includes passwordHash for auth) */
  async findByEmail(email: string): Promise<User | undefined> {
    return this.db.select().from(users).where(eq(users.email, email)).get();
  }

  /** Create a new user */
  async create(data: Omit<NewUser, 'passwordHash'> & { password: string }): Promise<Omit<User, 'passwordHash'>> {
    // Check for existing email
    const existing = await this.findByEmail(data.email);
    if (existing) throw new ConflictError(`User with email '${data.email}' already exists`);

    const passwordHash = await hashPassword(data.password);
    const { password: _, ...rest } = data;

    const results = this.db
      .insert(users)
      .values({ ...rest, passwordHash })
      .returning()
      .all();

    const { passwordHash: _ph, ...user } = results[0]!;
    return user;
  }

  /** Update a user */
  async update(id: number, data: Partial<Pick<User, 'name' | 'email' | 'role'>>): Promise<Omit<User, 'passwordHash'>> {
    await this.findById(id); // throws if not found

    const results = this.db
      .update(users)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(users.id, id))
      .returning()
      .all();

    const { passwordHash: _, ...user } = results[0]!;
    return user;
  }

  /** Delete a user */
  async delete(id: number): Promise<void> {
    await this.findById(id); // throws if not found
    this.db.delete(users).where(eq(users.id, id)).run();
  }
}
