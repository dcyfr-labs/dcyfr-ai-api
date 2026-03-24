/**
 * APNS Token Manager
 *
 * Manages device token registration, refresh, and expiry for Apple Push
 * Notification Service. Tokens are stored in SQLite via better-sqlite3.
 *
 * Token lifecycle:
 *  - Registered when Moshi app first launches (POST /api/devices/register)
 *  - Refreshed automatically when APNS issues a new token
 *  - Marked inactive when APNS responds with 410 (DeviceTokenNoLongerActive)
 *  - Expired after DEVICE_TOKEN_TTL_DAYS (default 90)
 */
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.APNS_DB_PATH ?? path.join(__dirname, '../../../apns-tokens.db');
const DEVICE_TOKEN_TTL_DAYS = 90;
const APNS_ENABLED = process.env.APNS_ENABLED === 'true';

export interface ApnsToken {
  id: number;
  agentId: string;
  deviceToken: string;
  deviceFingerprint: string;
  createdAt: string;
  expiresAt: string;
  active: number; // 1 | 0
}

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export class ApnsTokenManager {
  private db: Database.Database;

  constructor() {
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS apns_tokens (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id         TEXT    NOT NULL,
        device_token     TEXT    NOT NULL UNIQUE,
        device_fingerprint TEXT  NOT NULL,
        created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
        expires_at       TEXT    NOT NULL,
        active           INTEGER NOT NULL DEFAULT 1
      );
      CREATE INDEX IF NOT EXISTS idx_apns_tokens_agent_active
        ON apns_tokens (agent_id, active);
    `);
  }

  /** Register or refresh a device token for an agent. */
  registerToken(agentId: string, deviceToken: string, deviceFingerprint: string): void {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + DEVICE_TOKEN_TTL_DAYS);

    this.db.prepare(`
      INSERT INTO apns_tokens (agent_id, device_token, device_fingerprint, expires_at, active)
      VALUES (?, ?, ?, ?, 1)
      ON CONFLICT (device_token) DO UPDATE SET
        agent_id = excluded.agent_id,
        device_fingerprint = excluded.device_fingerprint,
        expires_at = excluded.expires_at,
        active = 1
    `).run(agentId, deviceToken, deviceFingerprint, expiresAt.toISOString());
  }

  /** Mark a token inactive (called on APNS 410 response). */
  deactivateToken(deviceToken: string): void {
    this.db.prepare(`UPDATE apns_tokens SET active = 0 WHERE device_token = ?`).run(deviceToken);
  }

  /** Return all active, non-expired tokens for an agent. */
  getActiveTokens(agentId: string): Promise<string[]> {
    const rows = this.db.prepare(`
      SELECT device_token FROM apns_tokens
      WHERE agent_id = ?
        AND active = 1
        AND expires_at > datetime('now')
    `).all(agentId) as { device_token: string }[];

    return Promise.resolve(rows.map((r) => r.device_token));
  }

  /**
   * Send push notifications to a list of device tokens.
   *
   * In production this calls the APNS HTTP/2 API.
   * When APNS_ENABLED=false (local dev / staging without certs) it logs and no-ops.
   */
  async sendNotifications(tokens: string[], payload: NotificationPayload): Promise<void> {
    if (!APNS_ENABLED) {
      console.info('[apns] APNS_ENABLED=false — notifications suppressed (dev mode)');
      console.info('[apns] Would send to tokens:', tokens.map((t) => `${t.slice(0, 8)}…`));
      console.info('[apns] Payload:', JSON.stringify(payload));
      return;
    }

    // Production: send via APNS HTTP/2 API using JWT auth
    // Requires: APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_PRIVATE_KEY (base64 PEM)
    const apnsHost = process.env.APNS_SANDBOX === 'true'
      ? 'api.sandbox.push.apple.com'
      : 'api.push.apple.com';

    const jwtToken = this.buildApnsJwt();
    const bundleId = process.env.APNS_BUNDLE_ID!;

    const apnsPayload = JSON.stringify({
      aps: {
        alert: { title: payload.title, body: payload.body },
        sound: 'default',
        'content-available': 1,
      },
      ...payload.data,
    });

    await Promise.allSettled(
      tokens.map(async (token) => {
        const url = `https://${apnsHost}/3/device/${token}`;
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              authorization: `bearer ${jwtToken}`,
              'apns-topic': bundleId,
              'apns-push-type': 'alert',
              'content-type': 'application/json',
            },
            body: apnsPayload,
          });
          if (response.status === 410) {
            // DeviceTokenNoLongerActive — deactivate
            this.deactivateToken(token);
            console.warn(`[apns] Token deactivated (410): ${token.slice(0, 8)}…`);
          } else if (!response.ok) {
            const body = await response.text();
            console.error(`[apns] Delivery failed for token ${token.slice(0, 8)}… status=${response.status} body=${body}`);
          }
        } catch (err) {
          console.error(`[apns] Request error for token ${token.slice(0, 8)}…`, err);
        }
      }),
    );
  }

  private buildApnsJwt(): string {
    // APNS JWT: header.payload signed with ES256 using the APNS private key
    const keyId = process.env.APNS_KEY_ID!;
    const teamId = process.env.APNS_TEAM_ID!;
    const privateKeyB64 = process.env.APNS_PRIVATE_KEY!;
    const privateKey = Buffer.from(privateKeyB64, 'base64').toString('utf8');

    const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId })).toString('base64url');
    const issuedAt = Math.floor(Date.now() / 1000);
    const claims = Buffer.from(JSON.stringify({ iss: teamId, iat: issuedAt })).toString('base64url');
    const unsigned = `${header}.${claims}`;

    const sign = crypto.createSign('SHA256');
    sign.update(unsigned);
    const signature = sign.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' }, 'base64url');

    return `${unsigned}.${signature}`;
  }
}
