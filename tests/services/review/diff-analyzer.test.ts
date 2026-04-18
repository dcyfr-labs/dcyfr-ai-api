import { describe, expect, it } from 'vitest';
import { parseDiff } from '../../../src/services/review/diff-analyzer.js';

const SAMPLE_DIFF = `diff --git a/src/app.ts b/src/app.ts
index abc1234..def5678 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,5 @@
 import express from 'express';
+import cors from 'cors';
+import helmet from 'helmet';

 export function createApp() {
`;

describe('parseDiff', () => {
  it('returns empty array for empty diff', () => {
    expect(parseDiff('')).toEqual([]);
  });

  it('parses a single modified file', () => {
    const files = parseDiff(SAMPLE_DIFF);
    expect(files).toHaveLength(1);
    expect(files[0]?.filename).toBe('src/app.ts');
    expect(files[0]?.status).toBe('modified');
    expect(files[0]?.language).toBe('typescript');
  });

  it('tracks added line numbers correctly', () => {
    const files = parseDiff(SAMPLE_DIFF);
    const hunk = files[0]?.hunks[0];
    expect(hunk).toBeDefined();
    expect(hunk?.addedLineNumbers).toContain(2);
    expect(hunk?.addedLineNumbers).toContain(3);
  });

  it('detects added file status', () => {
    const diff = `diff --git a/src/new-file.ts b/src/new-file.ts
new file mode 100644
index 0000000..abc1234
--- /dev/null
+++ b/src/new-file.ts
@@ -0,0 +1,2 @@
+export const value = 1;
+export const other = 2;
`;
    const files = parseDiff(diff);
    expect(files[0]?.status).toBe('added');
  });

  it('detects binary file status', () => {
    const diff = `diff --git a/image.png b/image.png
Binary files a/image.png and b/image.png differ
`;
    const files = parseDiff(diff);
    expect(files[0]?.status).toBe('binary');
    expect(files[0]?.hunks).toHaveLength(0);
  });

  it('detects removed file status', () => {
    const diff = `diff --git a/src/old.ts b/src/old.ts
deleted file mode 100644
index abc1234..0000000
--- a/src/old.ts
+++ /dev/null
@@ -1,1 +0,0 @@
-const x = 1;
`;
    const files = parseDiff(diff);
    expect(files[0]?.status).toBe('removed');
  });

  it('detects language from extension', () => {
    const diff = `diff --git a/main.py b/main.py
index abc..def 100644
--- a/main.py
+++ b/main.py
@@ -1,1 +1,2 @@
 x = 1
+y = 2
`;
    const files = parseDiff(diff);
    expect(files[0]?.language).toBe('python');
  });
});
