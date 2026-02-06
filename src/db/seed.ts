/**
 * Seed the database with sample data
 */
import { createDb } from './connection.js';
import { migrate } from './migrate.js';
import { users, posts } from './schema.js';
import { hashPassword } from '../services/auth-service.js';
import { logger } from '../lib/logger.js';

async function seed() {
  const { orm: db, sqlite: sqliteDb } = createDb();
  migrate(sqliteDb);

  logger.info('Seeding database...');

  // Create users
  const passwordHash = await hashPassword('password123');

  const adminResults = db
    .insert(users)
    .values({
      email: 'admin@example.com',
      name: 'Admin User',
      passwordHash,
      role: 'admin',
    })
    .returning()
    .all();
  const admin = adminResults[0];

  const userResults = db
    .insert(users)
    .values({
      email: 'user@example.com',
      name: 'Regular User',
      passwordHash,
      role: 'user',
    })
    .returning()
    .all();
  const user = userResults[0];

  // Create posts
  db.insert(posts)
    .values([
      {
        title: 'Getting Started with DCYFR AI',
        content: 'This is a guide to getting started with the DCYFR AI framework.',
        published: true,
        authorId: admin!.id,
      },
      {
        title: 'Draft Post',
        content: 'This post is still in draft.',
        published: false,
        authorId: user!.id,
      },
    ])
    .run();

  logger.info('Database seeded successfully');
}

seed().catch((err) => {
  logger.error(err, 'Seed failed');
  process.exit(1);
});
