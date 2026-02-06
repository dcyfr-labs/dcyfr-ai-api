/**
 * Tests for user service
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { UserService } from '../../src/services/user-service.js';
import { createDb, type AppDb } from '../../src/db/connection.js';
import { migrate } from '../../src/db/migrate.js';

describe('UserService', () => {
  let db: AppDb;
  let service: UserService;

  beforeEach(() => {
    const { orm, sqlite } = createDb(':memory:');
    migrate(sqlite);
    db = orm;
    service = new UserService(db);
  });

  it('should create a user', async () => {
    const user = await service.create({
      email: 'test@example.com',
      name: 'Test User',
      password: 'password123',
    });

    expect(user.email).toBe('test@example.com');
    expect(user.name).toBe('Test User');
    expect(user.role).toBe('user');
    expect('passwordHash' in user).toBe(false);
  });

  it('should find a user by id', async () => {
    const created = await service.create({
      email: 'find@example.com',
      name: 'Find Me',
      password: 'password123',
    });

    const found = await service.findById(created.id);
    expect(found.email).toBe('find@example.com');
  });

  it('should throw NotFoundError for missing user', async () => {
    await expect(service.findById(9999)).rejects.toThrow('not found');
  });

  it('should find user by email', async () => {
    await service.create({
      email: 'email@example.com',
      name: 'Email User',
      password: 'password123',
    });

    const found = await service.findByEmail('email@example.com');
    expect(found).toBeDefined();
    expect(found!.email).toBe('email@example.com');
  });

  it('should return undefined for missing email', async () => {
    const found = await service.findByEmail('nope@example.com');
    expect(found).toBeUndefined();
  });

  it('should list all users', async () => {
    await service.create({ email: 'a@test.com', name: 'A', password: 'password123' });
    await service.create({ email: 'b@test.com', name: 'B', password: 'password123' });

    const all = await service.findAll();
    expect(all.length).toBe(2);
    // No password hashes exposed
    expect(all.every((u) => !('passwordHash' in u))).toBe(true);
  });

  it('should reject duplicate email', async () => {
    await service.create({ email: 'dup@test.com', name: 'First', password: 'password123' });
    await expect(
      service.create({ email: 'dup@test.com', name: 'Second', password: 'password123' }),
    ).rejects.toThrow('already exists');
  });

  it('should update a user', async () => {
    const user = await service.create({
      email: 'up@test.com',
      name: 'Original',
      password: 'password123',
    });

    const updated = await service.update(user.id, { name: 'Updated' });
    expect(updated.name).toBe('Updated');
    expect(updated.email).toBe('up@test.com');
  });

  it('should delete a user', async () => {
    const user = await service.create({
      email: 'del@test.com',
      name: 'Delete Me',
      password: 'password123',
    });

    await service.delete(user.id);
    await expect(service.findById(user.id)).rejects.toThrow('not found');
  });
});
