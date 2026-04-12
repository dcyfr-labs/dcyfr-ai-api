/**
 * Mapping store service for Linear ↔ GitHub correlations.
 */
import { and, desc, eq } from 'drizzle-orm';
import type { AppDb } from '../db/connection.js';
import { issueMappings, type IssueMapping } from '../db/schema.js';
import { NotFoundError } from '../lib/errors.js';

export type MappingSource = 'branch' | 'title' | 'commit' | 'body' | 'manual';
export type MappingSyncStatus = 'pending' | 'synced' | 'failed';

export interface UpsertIssueMappingInput {
  linearIssueId: string;
  linearIdentifier: string;
  owner: string;
  repo: string;
  prNumber: number;
  prUrl?: string | null;
  source: MappingSource;
  confidence: number;
  syncStatus?: MappingSyncStatus;
}

export class MappingStore {
  constructor(private readonly db: AppDb) { }

  async upsert(input: UpsertIssueMappingInput): Promise<IssueMapping> {
    const existing = this.db
      .select()
      .from(issueMappings)
      .where(
        and(
          eq(issueMappings.linearIssueId, input.linearIssueId),
          eq(issueMappings.owner, input.owner),
          eq(issueMappings.repo, input.repo),
          eq(issueMappings.prNumber, input.prNumber),
        ),
      )
      .get();

    const now = new Date().toISOString();

    if (existing) {
      return this.db
        .update(issueMappings)
        .set({
          linearIdentifier: input.linearIdentifier,
          prUrl: input.prUrl ?? null,
          source: input.source,
          confidence: input.confidence,
          syncStatus: input.syncStatus ?? existing.syncStatus,
          updatedAt: now,
        })
        .where(eq(issueMappings.id, existing.id))
        .returning()
        .get();
    }

    return this.db
      .insert(issueMappings)
      .values({
        linearIssueId: input.linearIssueId,
        linearIdentifier: input.linearIdentifier,
        owner: input.owner,
        repo: input.repo,
        prNumber: input.prNumber,
        prUrl: input.prUrl ?? null,
        source: input.source,
        confidence: input.confidence,
        syncStatus: input.syncStatus ?? 'pending',
      })
      .returning()
      .get();
  }

  async getByKey(linearIdentifier: string): Promise<IssueMapping[]> {
    return this.db
      .select()
      .from(issueMappings)
      .where(eq(issueMappings.linearIdentifier, linearIdentifier))
      .all();
  }

  async getByPr(owner: string, repo: string, prNumber: number): Promise<IssueMapping | undefined> {
    return this.db
      .select()
      .from(issueMappings)
      .where(
        and(
          eq(issueMappings.owner, owner),
          eq(issueMappings.repo, repo),
          eq(issueMappings.prNumber, prNumber),
        ),
      )
      .get();
  }

  async getRecent(limit = 25): Promise<IssueMapping[]> {
    return this.db
      .select()
      .from(issueMappings)
      .orderBy(desc(issueMappings.createdAt), desc(issueMappings.id))
      .limit(limit)
      .all();
  }

  async updateSyncStatus(id: number, syncStatus: MappingSyncStatus): Promise<IssueMapping> {
    const now = new Date().toISOString();

    const updated = this.db
      .update(issueMappings)
      .set({
        syncStatus,
        lastSyncAt: now,
        updatedAt: now,
      })
      .where(eq(issueMappings.id, id))
      .returning()
      .get();

    if (!updated) {
      throw new NotFoundError('IssueMapping', id);
    }

    return updated;
  }
}
