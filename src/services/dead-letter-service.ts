/**
 * Dead-letter queue service for failed Linear ↔ GitHub sync events.
 */
import { eq, isNull } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { AppDb } from '../db/connection.js';
import { deadLetterEvents, type DeadLetterEvent } from '../db/schema.js';
import { NotFoundError } from '../lib/errors.js';

export type DeadLetterSource = 'github' | 'linear';

export interface RecordDeadLetterInput {
  eventId: string;
  payload: string;
  error: string;
  source: DeadLetterSource;
  eventType: string;
}

export class DeadLetterService {
  constructor(private readonly db: AppDb) { }

  async record(input: RecordDeadLetterInput): Promise<DeadLetterEvent> {
    return this.db
      .insert(deadLetterEvents)
      .values({
        id: randomUUID(),
        eventId: input.eventId,
        payload: input.payload,
        error: input.error,
        source: input.source,
        eventType: input.eventType,
      })
      .returning()
      .get();
  }

  async getPending(): Promise<DeadLetterEvent[]> {
    return this.db
      .select()
      .from(deadLetterEvents)
      .where(isNull(deadLetterEvents.processedAt))
      .all();
  }

  async getByEventId(eventId: string): Promise<DeadLetterEvent | undefined> {
    return this.db
      .select()
      .from(deadLetterEvents)
      .where(eq(deadLetterEvents.eventId, eventId))
      .get();
  }

  async markProcessed(eventId: string): Promise<DeadLetterEvent> {
    const processedAt = new Date().toISOString();

    const updated = this.db
      .update(deadLetterEvents)
      .set({ processedAt })
      .where(eq(deadLetterEvents.eventId, eventId))
      .returning()
      .get();

    if (!updated) {
      throw new NotFoundError('DeadLetterEvent', eventId);
    }

    return updated;
  }
}
