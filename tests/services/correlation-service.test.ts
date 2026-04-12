import { beforeEach, describe, expect, it } from 'vitest';
import { CorrelationService, type LinearIssueResolver } from '../../src/services/correlation-service.js';
import { MappingStore } from '../../src/services/mapping-store.js';
import { resetTestDb } from '../helpers.js';

class FakeResolver implements LinearIssueResolver {
  constructor(private readonly map: Record<string, { id: string; identifier: string }>) { }

  async findByIdentifier(identifier: string) {
    return this.map[identifier] ?? null;
  }
}

describe('CorrelationService', () => {
  let mappingStore: MappingStore;

  beforeEach(() => {
    mappingStore = new MappingStore(resetTestDb());
  });

  it('matches from branch and stores mapping', async () => {
    const resolver = new FakeResolver({
      'DCYFR-321': { id: 'lin_321', identifier: 'DCYFR-321' },
    });

    const service = new CorrelationService(mappingStore, resolver);

    const result = await service.correlatePullRequest({
      eventId: 'evt-1',
      action: 'opened',
      owner: 'dcyfr',
      repo: 'dcyfr-ai',
      prNumber: 321,
      branch: 'feature/DCYFR-321-add-sync',
      title: 'feat: add sync',
      body: 'desc',
      commits: ['chore: prep'],
    });

    expect(result.matched).toBe(true);
    expect(result.identifier).toBe('DCYFR-321');
    expect(result.source).toBe('branch');

    const mapping = await mappingStore.getByPr('dcyfr', 'dcyfr-ai', 321);
    expect(mapping).toBeDefined();
    expect(mapping?.linearIssueId).toBe('lin_321');
  });

  it('falls back to title when branch has no key', async () => {
    const resolver = new FakeResolver({
      'DCYFR-654': { id: 'lin_654', identifier: 'DCYFR-654' },
    });

    const service = new CorrelationService(mappingStore, resolver);

    const result = await service.correlatePullRequest({
      eventId: 'evt-2',
      action: 'opened',
      owner: 'dcyfr',
      repo: 'dcyfr-ai-api',
      prNumber: 654,
      branch: 'feature/no-ticket',
      title: '[DCYFR-654] Add endpoint',
      body: '',
      commits: [],
    });

    expect(result.matched).toBe(true);
    expect(result.source).toBe('title');
  });

  it('returns no_identifier when no issue key is found', async () => {
    const service = new CorrelationService(mappingStore, new FakeResolver({}));

    const result = await service.correlatePullRequest({
      eventId: 'evt-3',
      action: 'opened',
      owner: 'dcyfr',
      repo: 'dcyfr-labs',
      prNumber: 1,
      title: 'Refactor router',
      branch: 'feature/refactor-router',
      body: 'no key',
      commits: ['cleanup'],
    });

    expect(result).toMatchObject({ matched: false, reason: 'no_identifier' });
  });
});
