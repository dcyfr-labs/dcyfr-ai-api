import { beforeEach, describe, expect, it } from 'vitest';
import { DeadLetterService } from '../../src/services/dead-letter-service.js';
import { resetTestDb } from '../helpers.js';

let service: DeadLetterService;

beforeEach(() => {
  const db = resetTestDb();
  service = new DeadLetterService(db);
});

describe('DeadLetterService', () => {
  it('records and returns pending dead-letter events', async () => {
    await service.record({
      eventId: 'evt-100',
      payload: '{"action":"opened"}',
      error: 'sync failed',
      source: 'github',
      eventType: 'pull_request',
    });

    const pending = await service.getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.eventId).toBe('evt-100');
    expect(pending[0]?.processedAt).toBeNull();
  });

  it('marks an event processed for replay bookkeeping', async () => {
    await service.record({
      eventId: 'evt-101',
      payload: '{"action":"opened"}',
      error: 'temporary outage',
      source: 'github',
      eventType: 'pull_request',
    });

    const processed = await service.markProcessed('evt-101');
    expect(processed.processedAt).toBeTruthy();

    const pending = await service.getPending();
    expect(pending).toHaveLength(0);
  });
});
