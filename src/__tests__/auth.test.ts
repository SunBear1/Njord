/**
 * Unit tests for auth utilities (JWT, password hashing).
 *
 * These test the functions in functions/api/auth/_utils/ which use
 * Web Crypto API — available in Node.js 22+ (global crypto.subtle).
 */

import { describe, it, expect } from 'vitest';
import { signJwt, verifyJwt } from '../../functions/api/auth/_utils/jwt';
import { hashPassword, verifyPassword } from '../../functions/api/auth/_utils/password';

const TEST_SECRET = 'test-secret-key-at-least-32-characters-long';

describe('JWT utilities', () => {
  it('sign and verify roundtrip returns correct payload', async () => {
    const payload = { sub: 'user-123', email: 'test@example.com', name: 'Test User' };
    const token = await signJwt(payload, TEST_SECRET);

    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const decoded = await verifyJwt(token, TEST_SECRET);
    expect(decoded).not.toBeNull();
    expect(decoded!.sub).toBe('user-123');
    expect(decoded!.email).toBe('test@example.com');
    expect(decoded!.name).toBe('Test User');
    expect(decoded!.iat).toBeTypeOf('number');
    expect(decoded!.exp).toBeTypeOf('number');
    expect(decoded!.exp).toBeGreaterThan(decoded!.iat);
  });

  it('rejects token signed with different secret', async () => {
    const payload = { sub: 'user-123', email: 'test@example.com', name: null };
    const token = await signJwt(payload, TEST_SECRET);

    const decoded = await verifyJwt(token, 'wrong-secret-wrong-secret-wrong-secret');
    expect(decoded).toBeNull();
  });

  it('rejects malformed tokens', async () => {
    expect(await verifyJwt('', TEST_SECRET)).toBeNull();
    expect(await verifyJwt('a.b', TEST_SECRET)).toBeNull();
    expect(await verifyJwt('not-a-jwt', TEST_SECRET)).toBeNull();
    expect(await verifyJwt('a.b.c.d', TEST_SECRET)).toBeNull();
  });

  it('rejects tampered payload', async () => {
    const payload = { sub: 'user-123', email: 'test@example.com', name: null };
    const token = await signJwt(payload, TEST_SECRET);

    // Tamper with the payload (middle part)
    const parts = token.split('.');
    parts[1] = parts[1] + 'X';
    const tampered = parts.join('.');

    const decoded = await verifyJwt(tampered, TEST_SECRET);
    expect(decoded).toBeNull();
  });

  it('sets exp to 7 days from iat', async () => {
    const payload = { sub: 'user-123', email: 'test@example.com', name: null };
    const token = await signJwt(payload, TEST_SECRET);
    const decoded = await verifyJwt(token, TEST_SECRET);

    expect(decoded).not.toBeNull();
    const diff = decoded!.exp - decoded!.iat;
    expect(diff).toBe(7 * 24 * 60 * 60); // 7 days in seconds
  });

  it('handles null name in payload', async () => {
    const payload = { sub: 'user-456', email: 'noname@test.com', name: null };
    const token = await signJwt(payload, TEST_SECRET);
    const decoded = await verifyJwt(token, TEST_SECRET);

    expect(decoded).not.toBeNull();
    expect(decoded!.name).toBeNull();
  });
});

describe('Password hashing (PBKDF2)', () => {
  it('hash and verify roundtrip succeeds', async () => {
    const password = 'mySecureP@ss123';
    const hash = await hashPassword(password);

    expect(typeof hash).toBe('string');
    expect(hash).toContain(':'); // salt:hash format

    const valid = await verifyPassword(password, hash);
    expect(valid).toBe(true);
  });

  it('rejects wrong password', async () => {
    const hash = await hashPassword('correctPassword');
    const valid = await verifyPassword('wrongPassword', hash);
    expect(valid).toBe(false);
  });

  it('produces different hashes for same password (random salt)', async () => {
    const password = 'samePassword';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2);

    // Both should verify
    expect(await verifyPassword(password, hash1)).toBe(true);
    expect(await verifyPassword(password, hash2)).toBe(true);
  });

  it('rejects malformed hash string', async () => {
    expect(await verifyPassword('test', '')).toBe(false);
    expect(await verifyPassword('test', 'nocolon')).toBe(false);
  });

  it('hash has correct format (hex salt : hex hash)', async () => {
    const hash = await hashPassword('test');
    const [salt, hashPart] = hash.split(':');

    // 16-byte salt = 32 hex chars, 32-byte hash = 64 hex chars
    expect(salt).toHaveLength(32);
    expect(hashPart).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(salt)).toBe(true);
    expect(/^[0-9a-f]+$/.test(hashPart)).toBe(true);
  });
});
