import { describe, expect, it } from 'vitest';
import { analyzeForSecurityIssues } from '../../../src/services/review/security-analyzer.js';
import { parseDiff } from '../../../src/services/review/diff-analyzer.js';

function makeDiff(filename: string, addedLine: string): string {
  return `diff --git a/${filename} b/${filename}
index abc..def 100644
--- a/${filename}
+++ b/${filename}
@@ -1,1 +1,2 @@
 const x = 1;
+${addedLine}
`;
}

describe('analyzeForSecurityIssues', () => {
  it('returns no findings for clean code', () => {
    const files = parseDiff(makeDiff('src/util.ts', 'const safe = db.run(params, values);'));
    const result = analyzeForSecurityIssues(files);
    expect(result.comments).toHaveLength(0);
    expect(result.filesAnalyzed).toBe(1);
    expect(result.rulesChecked).toBeGreaterThan(0);
  });

  it('detects SQL injection via template literal with inner quotes', () => {
    // Regression: pattern must tolerate single quotes inside `query = `...${var}`
    const files = parseDiff(
      makeDiff('src/db.ts', "const query = `SELECT * FROM users WHERE email = '${email}'`;"),
    );
    const result = analyzeForSecurityIssues(files);
    const sqlFindings = result.comments.filter((c) => c.body.includes('sql-injection'));
    expect(sqlFindings.length).toBeGreaterThan(0);
    expect(sqlFindings[0]?.severity).toBe('error');
  });

  it('detects SQL injection via string concatenation', () => {
    const files = parseDiff(makeDiff('src/db.ts', 'const result = db.execute + userInput;'));
    const result = analyzeForSecurityIssues(files);
    const sqlFindings = result.comments.filter((c) => c.body.includes('sql-injection'));
    expect(sqlFindings.length).toBeGreaterThan(0);
  });

  it('detects innerHTML assignment', () => {
    const files = parseDiff(makeDiff('src/ui.ts', 'el.innerHTML = userInput;'));
    const result = analyzeForSecurityIssues(files);
    expect(result.comments).toHaveLength(1);
    expect(result.comments[0]?.severity).toBe('error');
    expect(result.comments[0]?.body).toContain('xss-innerhtml');
  });

  it('detects eval usage', () => {
    const files = parseDiff(makeDiff('src/eval.ts', 'eval(userCode);'));
    const result = analyzeForSecurityIssues(files);
    const evalFindings = result.comments.filter((c) => c.body.includes('eval-usage'));
    expect(evalFindings.length).toBeGreaterThan(0);
    expect(evalFindings[0]?.severity).toBe('error');
  });

  it('detects hardcoded secret', () => {
    const files = parseDiff(makeDiff('src/config.ts', 'const password = "supersecretpassword123";'));
    const result = analyzeForSecurityIssues(files);
    const secretFindings = result.comments.filter((c) => c.body.includes('hardcoded-secret'));
    expect(secretFindings.length).toBeGreaterThan(0);
    expect(secretFindings[0]?.severity).toBe('error');
  });

  it('detects dangerouslySetInnerHTML in TypeScript files', () => {
    const files = parseDiff(makeDiff('src/Component.tsx', '<div dangerouslySetInnerHTML={{ __html: userHtml }} />'));
    const result = analyzeForSecurityIssues(files);
    const xssFindings = result.comments.filter((c) => c.body.includes('xss-dangerous-html'));
    expect(xssFindings.length).toBeGreaterThan(0);
    expect(xssFindings[0]?.severity).toBe('warning');
  });

  it('skips removed files', () => {
    const diff = `diff --git a/src/old.ts b/src/old.ts
deleted file mode 100644
index abc..000 100644
--- a/src/old.ts
+++ /dev/null
@@ -1,1 +0,0 @@
-eval(bad);
`;
    const files = parseDiff(diff);
    const result = analyzeForSecurityIssues(files);
    expect(result.comments).toHaveLength(0);
    expect(result.filesAnalyzed).toBe(0);
  });

  it('reports the correct line number for the finding', () => {
    const files = parseDiff(makeDiff('src/ui.ts', 'el.innerHTML = userInput;'));
    const result = analyzeForSecurityIssues(files);
    // The added line is line 2 in the new file (after the context line at line 1)
    expect(result.comments[0]?.line).toBe(2);
  });

  it('reports only one finding per line even if multiple rules match', () => {
    // eval + potentially other patterns on the same line
    const files = parseDiff(makeDiff('src/util.ts', 'eval(userCode); el.innerHTML = x;'));
    const result = analyzeForSecurityIssues(files);
    const lineFindings = result.comments.filter((c) => c.line === 2);
    expect(lineFindings).toHaveLength(1);
  });

  it('skips context and removed lines', () => {
    const diff = `diff --git a/src/ui.ts b/src/ui.ts
index abc..def 100644
--- a/src/ui.ts
+++ b/src/ui.ts
@@ -1,3 +1,3 @@
 const clean = 1;
-el.innerHTML = old;
+el.textContent = safe;
`;
    const files = parseDiff(diff);
    const result = analyzeForSecurityIssues(files);
    expect(result.comments).toHaveLength(0);
  });
});
