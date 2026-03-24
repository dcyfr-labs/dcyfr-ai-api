/**
 * Device registration routes — APNS token lifecycle
 *
 * POST /api/devices/register   — register or refresh a device token
 * DELETE /api/devices/:token   — deactivate a token (e.g., on sign-out)
 */
import { Router, Request, Response } from 'express';
import { ApnsTokenManager } from '../services/apns-token-manager.js';

const router = Router();
const tokenManager = new ApnsTokenManager();

router.post('/register', (req: Request, res: Response) => {
  const { agentId, deviceToken, deviceFingerprint } = req.body as {
    agentId?: string;
    deviceToken?: string;
    deviceFingerprint?: string;
  };

  if (!agentId || !deviceToken || !deviceFingerprint) {
    res.status(400).json({ error: 'Missing required fields: agentId, deviceToken, deviceFingerprint' });
    return;
  }

  // Basic token format sanity check (APNS tokens are 64-char hex)
  if (!/^[0-9a-f]{64}$/i.test(deviceToken)) {
    res.status(400).json({ error: 'Invalid deviceToken format (expected 64-char hex)' });
    return;
  }

  tokenManager.registerToken(agentId, deviceToken, deviceFingerprint);
  res.status(201).json({ registered: true });
});

router.delete('/:token', (req: Request, res: Response) => {
  const token = Array.isArray(req.params['token']) ? req.params['token'][0] : req.params['token'];
  tokenManager.deactivateToken(token);
  res.status(200).json({ deactivated: true });
});

export default router;
