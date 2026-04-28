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

import { vi } from 'vitest';
import { LinearGraphqlIssueResolver, NoopLinearIssueResolver } from '../../src/services/correlation-service.js';

describe('NoopLinearIssueResolver', () => {
  it('always returns null', async () => {
    const resolver = new NoopLinearIssueResolver();
    expect(await resolver.findByIdentifier('DCYFR-1')).toBeNull();
    expect(await resolver.findByIdentifier('anything')).toBeNull();
  });
});

describe('LinearGraphqlIssueResolver', () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns null for an identifier that does not match TEAM-NUMBER format', async () => {
    const resolver = new LinearGraphqlIssueResolver('api-key');
    expect(await resolver.findByIdentifier('not-a-key')).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns null on non-200 HTTP response', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });
    const resolver = new LinearGraphqlIssueResolver('api-key');
    expect(await resolver.findByIdentifier('DCYFR-42')).toBeNull();
  });

  it('returns null when the response includes GraphQL errors', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ errors: [{ message: 'access denied' }] }),
    });
    const resolver = new LinearGraphqlIssueResolver('api-key');
    expect(await resolver.findByIdentifier('DCYFR-42')).toBeNull();
  });

  it('returns the first issue node on a successful match', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data: { issues: { nodes: [{ id: 'lin_1', identifier: 'DCYFR-42', title: 'Bug fix' }] } },
        }),
    });
    const resolver = new LinearGraphqlIssueResolver('api-key');
    const issue = await resolver.findByIdentifier('DCYFR-42');
    expect(issue).toEqual({ id: 'lin_1', identifier: 'DCYFR-42', title: 'Bug fix' });
  });

  it('returns null when no issue nodes are returned', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: { issues: { nodes: [] } } }),
    });
    const resolver = new LinearGraphqlIssueResolver('api-key');
    expect(await resolver.findByIdentifier('DCYFR-99')).toBeNull();
  });

  it('uses the provided endpoint override', async () => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: { issues: { nodes: [] } } }),
    });
    const resolver = new LinearGraphqlIssueResolver('api-key', 'https://custom.example/graphql');
    await resolver.findByIdentifier('DCYFR-1');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://custom.example/graphql',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
