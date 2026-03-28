/**
 * Security Scan routes
 *
 * Implements the Validate→Queue→Respond API pattern:
 *
 *   POST /api/security-scans        — validate input, enqueue scan, return 202
 *   GET  /api/security-scans/:id    — return scan state + findings
 */
import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { submitScanSchema, scanIdParamSchema } from '../schemas/index.js';
import { ScanService } from '../services/scan-service.js';
import { db } from '../db/connection.js';

const router = Router();
const scanService = new ScanService(db);

/**
 * POST /api/security-scans
 * Synchronously validate input, queue the scan, return 202 Accepted with scanId.
 *
 * Idempotency: each request creates a new scan record (no idempotency key).
 * Clients should use GET /api/security-scans/:id to poll for results.
 */
router.post(
  '/',
  validate({ body: submitScanSchema }),
  async (req, res) => {
    const scan = await scanService.submit(req.body);

    res.status(202).json({
      data: {
        id: scan.id,
        state: scan.state,
        queuedAt: scan.queuedAt,
      },
      meta: {
        message: 'Scan queued. Poll GET /api/security-scans/:id for status.',
        statusUrl: `/api/security-scans/${scan.id}`,
      },
    });
  }
);

/**
 * GET /api/security-scans/:id
 * Return current scan state and, once complete, findings + score + remediation.
 */
router.get(
  '/:id',
  validate({ params: scanIdParamSchema }),
  async (req, res) => {
    const scan = await scanService.findById(req.params.id as string);

    res.json({
      data: {
        id: scan.id,
        state: scan.state,
        queuedAt: scan.queuedAt,
        startedAt: scan.startedAt,
        completedAt: scan.completedAt,
        attempts: scan.attempts,
        // Result fields — present only when complete
        ...(scan.state === 'complete'
          ? {
              safe: scan.safe,
              riskScore: scan.riskScore,
              severity: scan.severity,
              remediationSummary: scan.remediationSummary,
              findings: scan.findings.map((f) => ({
                id: f.id,
                pattern: f.pattern,
                category: f.category,
                severity: f.severity,
                confidence: f.confidence / 100,
                source: f.source,
                details: f.details,
              })),
            }
          : {}),
        // Error — present only when failed
        ...(scan.state === 'failed' ? { error: scan.errorMessage } : {}),
      },
    });
  }
);

export default router;
