import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted mock backing — mutate per test to vary allowlist + env without
// touching real process.env or re-importing the module. isRepoAllowed reads
// config.{reviewAllowedRepos,env} at call time (not at import time), so a
// stable reference with mutable fields is enough.
const mockConfig = vi.hoisted(() => ({
  reviewAllowedRepos: [] as string[],
  env: 'test' as string,
}));

vi.mock('../../../src/config/index.js', () => ({
  config: mockConfig,
}));

vi.mock('../../../src/lib/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const { isRepoAllowed } = await import('../../../src/services/review/repo-allowlist.js');

beforeEach(() => {
  mockConfig.reviewAllowedRepos = [];
  mockConfig.env = 'test';
});

describe('isRepoAllowed — defense-in-depth identifier validation', () => {
  it('rejects owner with whitespace', () => {
    expect(isRepoAllowed('bad owner', 'repo')).toBe(false);
  });

  it('rejects owner with path traversal characters', () => {
    expect(isRepoAllowed('owner/..', 'repo')).toBe(false);
    expect(isRepoAllowed('../etc', 'repo')).toBe(false);
  });

  it('rejects repo with invalid characters', () => {
    expect(isRepoAllowed('owner', 'bad repo')).toBe(false);
    expect(isRepoAllowed('owner', 'repo?query=1')).toBe(false);
  });

  it('accepts valid alphanumeric + ._- identifiers', () => {
    mockConfig.reviewAllowedRepos = ['some-owner/some.repo_v2'];
    expect(isRepoAllowed('some-owner', 'some.repo_v2')).toBe(true);
  });
});

describe('isRepoAllowed — empty allowlist', () => {
  it('rejects all repos in production', () => {
    mockConfig.reviewAllowedRepos = [];
    mockConfig.env = 'production';
    expect(isRepoAllowed('dcyfr-labs', 'dcyfr-labs')).toBe(false);
    expect(isRepoAllowed('anyone', 'anything')).toBe(false);
  });

  it('permits any repo in development', () => {
    mockConfig.reviewAllowedRepos = [];
    mockConfig.env = 'development';
    expect(isRepoAllowed('any-owner', 'any-repo')).toBe(true);
  });

  it('permits any repo in test', () => {
    mockConfig.reviewAllowedRepos = [];
    mockConfig.env = 'test';
    expect(isRepoAllowed('any-owner', 'any-repo')).toBe(true);
  });
});

describe('isRepoAllowed — populated allowlist', () => {
  it('permits exact match', () => {
    mockConfig.reviewAllowedRepos = ['dcyfr-labs/dcyfr-labs'];
    mockConfig.env = 'production';
    expect(isRepoAllowed('dcyfr-labs', 'dcyfr-labs')).toBe(true);
  });

  it('rejects different repo under same owner without wildcard', () => {
    mockConfig.reviewAllowedRepos = ['dcyfr-labs/dcyfr-labs'];
    mockConfig.env = 'production';
    expect(isRepoAllowed('dcyfr-labs', 'other-repo')).toBe(false);
  });

  it('permits any repo under a matching owner wildcard', () => {
    mockConfig.reviewAllowedRepos = ['dcyfr-labs/*'];
    mockConfig.env = 'production';
    expect(isRepoAllowed('dcyfr-labs', 'dcyfr-ai')).toBe(true);
    expect(isRepoAllowed('dcyfr-labs', 'whatever')).toBe(true);
  });

  it('rejects unrelated owner even when wildcard for another owner exists', () => {
    mockConfig.reviewAllowedRepos = ['dcyfr-labs/*'];
    mockConfig.env = 'production';
    expect(isRepoAllowed('attacker-org', 'malicious-repo')).toBe(false);
  });

  it('checks each entry until a match is found', () => {
    mockConfig.reviewAllowedRepos = [
      'first-org/repo-a',
      'second-org/repo-b',
      'third-org/*',
    ];
    mockConfig.env = 'production';
    expect(isRepoAllowed('first-org', 'repo-a')).toBe(true);
    expect(isRepoAllowed('second-org', 'repo-b')).toBe(true);
    expect(isRepoAllowed('third-org', 'anything')).toBe(true);
    expect(isRepoAllowed('first-org', 'repo-b')).toBe(false);
  });
});
