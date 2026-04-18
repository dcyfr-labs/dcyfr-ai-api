/**
 * Rule-based security analyzer for PR diffs.
 * Checks added lines for common vulnerability patterns.
 * Pure function, no I/O.
 */
import { type DiffFile } from './diff-analyzer.js';
import { type ReviewComment } from './github-review-service.js';

interface SecurityRule {
  id: string;
  pattern: RegExp;
  severity: ReviewComment['severity'];
  message: string;
  languages?: string[];
}

const RULES: SecurityRule[] = [
  {
    id: 'sql-injection',
    // Match template literals: query/sql = `...${...}` — [^`]* allows inner quotes (e.g. '${email}')
    // Also match string concatenation: query/exec/execute + ...
    pattern: /(?:query|sql)\s*[+=]\s*`[^`]*\$\{|(?:query|exec|execute)\s*\+\s*/i,
    severity: 'error',
    message: 'Possible SQL injection: user input may be interpolated into SQL. Use parameterized queries.',
  },
  {
    id: 'xss-innerhtml',
    pattern: /\.innerHTML\s*=(?!=)|\.outerHTML\s*=(?!=)/,
    severity: 'error',
    message: 'Possible XSS: innerHTML assignment. Use textContent or a sanitization library.',
  },
  {
    id: 'xss-dangerous-html',
    pattern: /dangerouslySetInnerHTML/,
    severity: 'warning',
    message: 'dangerouslySetInnerHTML bypasses React XSS protections. Ensure the value is sanitized.',
    languages: ['typescript', 'javascript'],
  },
  {
    id: 'eval-usage',
    pattern: /\beval\s*\(/,
    severity: 'error',
    message: 'eval() executes arbitrary code and is a security risk. Avoid eval().',
  },
  {
    id: 'hardcoded-secret',
    pattern: /(?:password|passwd|secret|api_?key|auth_?token|access_?token)\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/i,
    severity: 'error',
    message: 'Possible hardcoded credential. Use environment variables or a secrets manager.',
  },
  {
    id: 'shell-injection',
    pattern: /(?:execSync|spawnSync|exec|spawn)\s*\([`'"][^`'"]*\$\{/,
    severity: 'error',
    message: 'Possible command injection: interpolated value passed to shell execution. Validate and sanitize inputs.',
    languages: ['typescript', 'javascript'],
  },
  {
    id: 'insecure-random',
    pattern: /Math\.random\(\)/,
    severity: 'info',
    message: 'Math.random() is not cryptographically secure. Use crypto.randomBytes() or crypto.randomUUID() for security-sensitive values.',
    languages: ['typescript', 'javascript'],
  },
];

export interface AnalysisResult {
  comments: ReviewComment[];
  rulesChecked: number;
  filesAnalyzed: number;
}

export function analyzeForSecurityIssues(files: DiffFile[]): AnalysisResult {
  const comments: ReviewComment[] = [];
  let filesAnalyzed = 0;

  for (const file of files) {
    if (file.status === 'removed' || file.status === 'binary') continue;
    filesAnalyzed++;

    const applicableRules = RULES.filter(
      (rule) => !rule.languages || rule.languages.includes(file.language),
    );

    for (const hunk of file.hunks) {
      let addedIndex = 0;

      for (const line of hunk.lines) {
        if (!line.startsWith('+') || line.startsWith('+++')) continue;

        const lineNumber = hunk.addedLineNumbers[addedIndex];
        const content = line.slice(1); // strip the '+' prefix

        for (const rule of applicableRules) {
          if (rule.pattern.test(content) && typeof lineNumber === 'number') {
            comments.push({
              path: file.filename,
              line: lineNumber,
              body: `**[${rule.id}]** ${rule.message}`,
              severity: rule.severity,
              ruleId: rule.id,
            });
            break; // one finding per line to reduce noise
          }
        }

        addedIndex++;
      }
    }
  }

  return { comments, rulesChecked: RULES.length, filesAnalyzed };
}
