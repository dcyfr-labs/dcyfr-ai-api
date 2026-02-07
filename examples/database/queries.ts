/**
 * Database Query Examples
 * 
 * Demonstrates Drizzle ORM best practices
 */

import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { eq, and, or, like, gt, desc } from 'drizzle-orm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Example schema
const articles = sqliteTable('articles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  authorId: integer('author_id').notNull(),
  published: integer('published').default(0), // SQLite boolean (0/1)
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// Setup database connection
const sqlite = new Database(':memory:'); // Use file path in production
const db = drizzle(sqlite);

/**
 * Example 1: Simple queries
 */
async function basicQueries() {
  // Insert
  const newArticle = await db.insert(articles).values({
    title: 'Getting Started with Drizzle ORM',
    content: 'Drizzle is a TypeScript ORM...',
    authorId: 1,
    published: 1,
    createdAt: new Date(),
  }).returning();

  console.log('Created:', newArticle);

  // Select all
  const allArticles = await db.select().from(articles);
  console.log('All articles:', allArticles);

  // Select by ID
  const article = await db
    .select()
    .from(articles)
    .where(eq(articles.id, newArticle[0].id))
    .limit(1);

  console.log('Single article:', article[0]);

  // Update
  await db
    .update(articles)
    .set({ title: 'Updated Title' })
    .where(eq(articles.id, newArticle[0].id));

  // Delete
  await db
    .delete(articles)
    .where(eq(articles.id, newArticle[0].id));
}

/**
 * Example 2: Complex queries with conditions
 */
async function complexQueries() {
  // Multiple conditions with AND
  const publishedByAuthor = await db
    .select()
    .from(articles)
    .where(
      and(
        eq(articles.published, 1),
        eq(articles.authorId, 1)
      )
    );

  // Multiple conditions with OR
  const searchResults = await db
    .select()
    .from(articles)
    .where(
      or(
        like(articles.title, '%Drizzle%'),
        like(articles.content, '%Drizzle%')
      )
    );

  // Comparison operators
  const recentArticles = await db
    .select()
    .from(articles)
    .where(
      gt(articles.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    )
    .orderBy(desc(articles.createdAt))
    .limit(10);

  return { publishedByAuthor, searchResults, recentArticles };
}

/**
 * Example 3: Transactions
 */
async function transactionExample() {
  try {
    await db.transaction(async (tx) => {
      // Create article
      const article = await tx.insert(articles).values({
        title: 'Transactional Insert',
        content: 'This is done in a transaction',
        authorId: 1,
        published: 1,
        createdAt: new Date(),
      }).returning();

      // Simulate error - this will rollback the transaction
      // throw new Error('Oops!');

      // If we reach here, transaction commits
      return article;
    });
  } catch (error) {
    console.error('Transaction failed:', error);
    // Transaction automatically rolled back
  }
}

/**
 * Example 4: Prepared statements for better performance
 */
async function preparedStatements() {
  const getArticleById = db
    .select()
    .from(articles)
    .where(eq(articles.id, 1))
    .prepare();

  // Execute multiple times without re-parsing SQL
  const article1 = await getArticleById.execute();
  const article2 = await getArticleById.execute();

  return { article1, article2 };
}

/**
 * Example 5: Batch operations
 */
async function batchOperations() {
  // Batch insert
  const newArticles = await db.insert(articles).values([
    {
      title: 'Article 1',
      content: 'Content 1',
      authorId: 1,
      published: 1,
      createdAt: new Date(),
    },
    {
      title: 'Article 2',
      content: 'Content 2',
      authorId: 1,
      published: 0,
      createdAt: new Date(),
    },
  ]).returning();

  return newArticles;
}

/**
 * Best Practices:
 * 
 * 1. Always use parameterized queries (Drizzle does this automatically)
 * 2. Use transactions for related operations
 * 3. Use prepared statements for repeated queries
 * 4. Index frequently queried columns
 * 5. Use `.returning()` to get inserted/updated data
 * 6. Handle errors gracefully
 */

export {
  basicQueries,
  complexQueries,
  transactionExample,
  preparedStatements,
  batchOperations,
};
