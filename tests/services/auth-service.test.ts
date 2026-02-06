/**
 * Tests for auth service
 */
import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
} from '../../src/services/auth-service.js';

describe('hashPassword / verifyPassword', () => {
  it('should hash and verify a password', async () => {
    const hash = await hashPassword('mypassword');
    expect(hash).not.toBe('mypassword');
    expect(await verifyPassword('mypassword', hash)).toBe(true);
  });

  it('should reject wrong password', async () => {
    const hash = await hashPassword('correct');
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('should produce different hashes for same password', async () => {
    const hash1 = await hashPassword('same');
    const hash2 = await hashPassword('same');
    expect(hash1).not.toBe(hash2); // different salts
  });
});

describe('generateToken / verifyToken', () => {
  it('should generate and verify a JWT', () => {
    const payload = { userId: 1, email: 'test@example.com', role: 'user' };
    const token = generateToken(payload);
    expect(typeof token).toBe('string');

    const decoded = verifyToken(token);
    expect(decoded.userId).toBe(1);
    expect(decoded.email).toBe('test@example.com');
    expect(decoded.role).toBe('user');
  });

  it('should throw on invalid token', () => {
    expect(() => verifyToken('invalid.token.here')).toThrow();
  });
});
