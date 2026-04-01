/**
 * Scan Service
 *
 * Manages prompt security scan lifecycle in the database and coordinates
 * async execution via the background scan worker.
 *
 * State machine: queued → running → complete | failed
 */
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { AppDb } from '../db/connection.js';
import { securityScans, scanFindings, type SecurityScan, type ScanFinding } from '../db/schema.js';
import { NotFoundError } from '../lib/errors.js';
import type { SubmitScanInput } from '../schemas/index.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScanWithFindings extends SecurityScan {
  findings: ScanFinding[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class ScanService {
  constructor(private readonly db: AppDb) {}

  /**
   * Create a new scan record in `queued` state and kick off background execution.
   * Returns immediately with the new scan ID (202 Accepted pattern).
   */
  async submit(input: SubmitScanInput): Promise<SecurityScan> {
    const id = randomUUID();
    const optionsJson = input.options ? JSON.stringify(input.options) : null;

    const inserted = this.db
      .insert(securityScans)
      .values({
        id,
        prompt: input.prompt,
        context: input.context ?? null,
        options: optionsJson,
        state: 'queued',
        attempts: 0,
      })
      .returning()
      .get();

    // Kick off background execution without blocking the response
    setImmediate(() => {
      this.#runWorker(id, input).catch((err) => {
        console.error('[ScanService] Worker crashed for scan', id, err);
      });
    });

    return inserted;
  }

  /**
   * Retrieve a scan by ID with its findings.
   * Throws NotFoundError if not found.
   */
  async findById(id: string): Promise<ScanWithFindings> {
    const scan = this.db.select().from(securityScans).where(eq(securityScans.id, id)).get();
    if (!scan) throw new NotFoundError('SecurityScan', id);

    const findings = this.db
      .select()
      .from(scanFindings)
      .where(eq(scanFindings.scanId, id))
      .all();

    return { ...scan, findings };
  }

  /**
   * Background worker: runs analysis and persists results.
   * Always reaches a terminal state (complete or failed).
   */
  async #runWorker(scanId: string, input: SubmitScanInput): Promise<void> {
    // Lazily import to avoid circular deps and keep startup fast
    const { executePromptScan } = await import('@dcyfr/ai/security/prompt-scan-worker');

    this.db
      .update(securityScans)
      .set({ state: 'running', startedAt: new Date().toISOString() })
      .where(eq(securityScans.id, scanId))
      .run();

    const result = await executePromptScan(
      {
        scanId,
        prompt: input.prompt,
        context: input.context,
        options: input.options,
      },
      {
        onStateChange: (state: string, attempt: number) => {
          this.db
            .update(securityScans)
            .set({ state: state as 'queued' | 'running' | 'complete' | 'failed', attempts: attempt })
            .where(eq(securityScans.id, scanId))
            .run();
        },
      }
    );

    if (result.success) {
      const { output } = result;

      // Persist findings
      for (const finding of output.findings) {
        this.db
          .insert(scanFindings)
          .values({
            id: randomUUID(),
            scanId,
            pattern: finding.pattern,
            category: finding.category,
            severity: finding.severity,
            confidence: Math.round(finding.confidence * 100),
            source: finding.source,
            details: finding.details ?? null,
          })
          .run();
      }

      this.db
        .update(securityScans)
        .set({
          state: 'complete',
          riskScore: output.riskScore,
          severity: output.severity,
          safe: output.safe,
          remediationSummary: output.remediationSummary,
          attempts: output.attempts,
          completedAt: new Date().toISOString(),
        })
        .where(eq(securityScans.id, scanId))
        .run();
    } else {
      this.db
        .update(securityScans)
        .set({
          state: 'failed',
          errorMessage: result.error,
          attempts: result.finalAttempt,
          completedAt: new Date().toISOString(),
        })
        .where(eq(securityScans.id, scanId))
        .run();
    }
  }
}
