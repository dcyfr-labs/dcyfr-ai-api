/**
 * PR diff parser — converts unified diff text into structured file hunks.
 * Pure function, no I/O.
 */

export interface DiffHunk {
  header: string;
  lines: string[];
  addedLineNumbers: number[];
  removedLineNumbers: number[];
}

export interface DiffFile {
  filename: string;
  language: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'binary';
  hunks: DiffHunk[];
  rawDiff: string;
}

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
  cs: 'csharp', cpp: 'cpp', c: 'c', h: 'c', php: 'php',
  swift: 'swift', kt: 'kotlin', sql: 'sql', sh: 'bash', bash: 'bash',
  yml: 'yaml', yaml: 'yaml', json: 'json', md: 'markdown',
  html: 'html', css: 'css', scss: 'scss',
};

function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_TO_LANGUAGE[ext] ?? 'text';
}

function parseHunk(hunkHeader: string, lines: string[]): DiffHunk {
  const addedLineNumbers: number[] = [];
  const removedLineNumbers: number[] = [];

  // Parse hunk header: @@ -old_start,old_count +new_start,new_count @@
  const match = hunkHeader.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
  let oldLine = match ? parseInt(match[1]!, 10) : 1;
  let newLine = match ? parseInt(match[2]!, 10) : 1;

  for (const line of lines) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      addedLineNumbers.push(newLine++);
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      removedLineNumbers.push(oldLine++);
    } else if (!line.startsWith('\\')) {
      oldLine++;
      newLine++;
    }
  }

  return { header: hunkHeader, lines, addedLineNumbers, removedLineNumbers };
}

function detectFileStatus(diffBlock: string): DiffFile['status'] {
  if (/^Binary files/m.test(diffBlock)) return 'binary';
  if (/^new file mode/m.test(diffBlock)) return 'added';
  if (/^deleted file mode/m.test(diffBlock)) return 'removed';
  if (/^rename from/m.test(diffBlock)) return 'renamed';
  return 'modified';
}

export function parseDiff(rawDiff: string): DiffFile[] {
  if (!rawDiff.trim()) return [];

  const files: DiffFile[] = [];

  // Split on `diff --git` boundaries
  const blocks = rawDiff.split(/^diff --git /m).filter(Boolean);

  for (const block of blocks) {
    const blockLines = block.split('\n');
    const headerLine = blockLines[0] ?? '';

    // Extract filename from "a/path b/path" header
    const filenameMatch = headerLine.match(/^a\/(.*?) b\/(.*?)$/);
    const filename = filenameMatch ? filenameMatch[2]! : headerLine.trim();

    const status = detectFileStatus(block);
    const language = detectLanguage(filename);

    if (status === 'binary') {
      files.push({ filename, language, status, hunks: [], rawDiff: block });
      continue;
    }

    // Split into hunks on @@ boundaries
    const hunks: DiffHunk[] = [];
    const hunkSplits = block.split(/^(@@ .*? @@.*)/m);

    for (let i = 1; i < hunkSplits.length; i += 2) {
      const header = hunkSplits[i]!;
      const body = hunkSplits[i + 1] ?? '';
      const lines = body.split('\n').filter((l) => l.length > 0 || i < hunkSplits.length - 2);
      hunks.push(parseHunk(header, lines));
    }

    files.push({ filename, language, status, hunks, rawDiff: block });
  }

  return files;
}
