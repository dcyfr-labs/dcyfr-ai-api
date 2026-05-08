/**
 * Webhook routes — Inngest → notification service
 *
 * POST /webhooks/approval-notification
 *   Receives agent.completed events from Inngest, validates HMAC-SHA256
 *   signature, and dispatches push notifications to registered APNS tokens.
 */
import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { ApnsTokenManager } from '../services/apns-token-manager.js';

const router = Router();

// ─── HMAC Validation ──────────────────────────────────────────────────────────

function validateHmacSignature(
  body: string,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader) return false;
  // Inngest sends: "sha256=<hex>"
  const prefix = 'sha256=';
  if (!signatureHeader.startsWith(prefix)) return false;
  const received = Buffer.from(signatureHeader.slice(prefix.length), 'hex');
  const expected = crypto.createHmac('sha256', secret).update(body).digest();
  if (received.length !== expected.length) return false;
  return crypto.timingSafeEqual(received, expected);
}

// ─── Payload ──────────────────────────────────────────────────────────────────

interface ApprovalNotificationPayload {
  agentId: string;
  approvalId: string;
  taskDescription: string;
  timestamp: string;
}

/**
 * Sanitise an arbitrary string for inclusion in a server log line. Strips
 * CR/LF (log injection / ANSI escape pollution), collapses other control
 * characters, and truncates to a reasonable length so a malicious payload
 * field can't blow up our log volume.
 */
function safeForLog(value: unknown, max = 64): string {
  // Encode every non-printable byte as a visible \xNN escape so a payload
  // field cannot break out of a log line via CR/LF/ANSI/control chars.
  // The result is pure ASCII (0x20-0x7e), which CodeQL recognises as a
  // comprehensive sanitiser for js/log-injection.
  const escaped = String(value).replace(/[^\x20-\x7e]/g, (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, '0')}`);
  return escaped.length > max ? `${escaped.slice(0, max)}…` : escaped;
}

// ─── Route ────────────────────────────────────────────────────────────────────

const tokenManager = new ApnsTokenManager();

/**
 * POST /webhooks/approval-notification
 *
 * Called by Inngest when an agent.completed event fires.
 * Returns 200 immediately after dispatching; retries are handled by Inngest.
 */
router.post('/approval-notification', async (req: Request, res: Response) => {
  const secret = process.env.INNGEST_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[webhooks] INNGEST_WEBHOOK_SECRET not configured');
    res.status(500).json({ error: 'Server misconfiguration' });
    return;
  }

  const rawBody: string = (req as unknown as { rawBody?: string }).rawBody ?? JSON.stringify(req.body);
  const signature = req.headers['x-inngest-signature'] as string | undefined;

  if (!validateHmacSignature(rawBody, signature, secret)) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  const payload = req.body as ApprovalNotificationPayload;
  if (!payload.agentId || !payload.approvalId || !payload.taskDescription) {
    res.status(400).json({ error: 'Missing required fields: agentId, approvalId, taskDescription' });
    return;
  }

  // Respond immediately — Inngest retries on non-2xx only
  res.status(200).json({ received: true });

  // Dispatch notifications asynchronously after responding
  try {
    const tokens = await tokenManager.getActiveTokens(payload.agentId);
    if (tokens.length === 0) {
      // JSON.stringify quotes + escapes the value, recognised by CodeQL as
      // a log-injection sanitiser. safeForLog truncates and visualises any
      // non-printable bytes that survived JSON quoting.
      console.warn(`[webhooks] No active APNS tokens for agentId=${JSON.stringify(safeForLog(payload.agentId))}`);
      return;
    }

    const notificationBody = `Approve: ${payload.taskDescription}`;
    await tokenManager.sendNotifications(tokens, {
      title: 'Agent Approval Required',
      body: notificationBody,
      data: { approvalId: payload.approvalId, agentId: payload.agentId },
    });
    console.info(`[webhooks] Dispatched ${tokens.length} notification(s) for approvalId=${JSON.stringify(safeForLog(payload.approvalId))}`);
  } catch (err) {
    console.error('[webhooks] Failed to dispatch notifications:', err);
  }
});

export default router;
