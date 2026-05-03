/**
 * Unit tests for auth utilities (JWT, password hashing, cookies, UI helpers).
 *
 * These test the functions in functions/api/v1/auth/_utils/ which use
 * Web Crypto API — available in Node.js 22+ (global crypto.subtle).
 */

import { describe, it, expect } from 'vitest';
import { signJwt, verifyJwt } from '../../functions/api/v1/auth/_utils/jwt';
import { hashPassword, verifyPassword } from '../../functions/api/v1/auth/_utils/password';
import {
  setAuthCookie,
  clearAuthCookie,
  getAuthCookie,
  setOAuthStateCookie,
  getOAuthStateCookie,
  clearOAuthStateCookie,
} from '../../functions/api/v1/auth/_utils/cookie';
import { getInitials } from '../utils/userDisplayHelpers';

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

describe('Cookie utilities', () => {
  describe('setAuthCookie', () => {
    it('builds correct cookie string with Secure flag', () => {
      const cookie = setAuthCookie('my-jwt-token', true);
      expect(cookie).toContain('njord_auth=my-jwt-token');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('Max-Age=');
    });

    it('omits Secure flag when isSecure is false', () => {
      const cookie = setAuthCookie('my-jwt-token', false);
      expect(cookie).not.toContain('Secure');
      expect(cookie).toContain('njord_auth=my-jwt-token');
    });
  });

  describe('clearAuthCookie', () => {
    it('sets Max-Age=0 to clear cookie', () => {
      const cookie = clearAuthCookie(true);
      expect(cookie).toContain('njord_auth=');
      expect(cookie).toContain('Max-Age=0');
    });
  });

  describe('getAuthCookie', () => {
    it('extracts auth token from Cookie header', () => {
      const request = new Request('http://localhost/', {
        headers: { Cookie: 'njord_auth=abc123; other=value' },
      });
      expect(getAuthCookie(request)).toBe('abc123');
    });

    it('returns null when no auth cookie', () => {
      const request = new Request('http://localhost/', {
        headers: { Cookie: 'other=value' },
      });
      expect(getAuthCookie(request)).toBeNull();
    });

    it('returns null when no Cookie header at all', () => {
      const request = new Request('http://localhost/');
      expect(getAuthCookie(request)).toBeNull();
    });
  });

  describe('OAuth state cookie', () => {
    it('builds state cookie with short Max-Age', () => {
      const cookie = setOAuthStateCookie('my-state', true);
      expect(cookie).toContain('njord_oauth_state=my-state');
      expect(cookie).toContain('Max-Age=300');
      expect(cookie).toContain('HttpOnly');
    });

    it('extracts state from Cookie header', () => {
      const request = new Request('http://localhost/', {
        headers: { Cookie: 'njord_oauth_state=state123; njord_auth=jwt456' },
      });
      expect(getOAuthStateCookie(request)).toBe('state123');
    });

    it('returns null when no state cookie', () => {
      const request = new Request('http://localhost/', {
        headers: { Cookie: 'njord_auth=jwt456' },
      });
      expect(getOAuthStateCookie(request)).toBeNull();
    });

    it('clears state cookie with Max-Age=0', () => {
      const cookie = clearOAuthStateCookie(true);
      expect(cookie).toContain('njord_oauth_state=');
      expect(cookie).toContain('Max-Age=0');
    });
  });
});

describe('getInitials', () => {
  it('returns two initials for multi-word name', () => {
    expect(getInitials('John Doe', 'john@example.com')).toBe('JD');
  });

  it('returns first and last initials for three-word name', () => {
    expect(getInitials('Jan Kowalski Nowak', 'jan@example.com')).toBe('JN');
  });

  it('returns single initial for single-word name', () => {
    expect(getInitials('Łukasz', 'lukasz@example.com')).toBe('Ł');
  });

  it('returns email initial when name is null', () => {
    expect(getInitials(null, 'admin@example.com')).toBe('A');
  });

  it('handles long multi-word names', () => {
    expect(getInitials('Aleksander Bardzo Długie Imię Nazwisko', 'a@b.com')).toBe('AN');
  });

  it('handles name with extra whitespace', () => {
    expect(getInitials('  Anna   Kowalska  ', 'anna@test.com')).toBe('AK');
  });

  it('uppercases lowercase names', () => {
    expect(getInitials('jan nowak', 'jan@test.com')).toBe('JN');
  });
});

describe('OAuth state action encoding', () => {
  it('state without :link suffix is a normal login', () => {
    const state = crypto.randomUUID();
    expect(state.endsWith(':link')).toBe(false);
  });

  it('state with :link suffix indicates account linking', () => {
    const state = `${crypto.randomUUID()}:link`;
    expect(state.endsWith(':link')).toBe(true);
  });

  it('UUID part can be extracted from link state', () => {
    const uuid = crypto.randomUUID();
    const state = `${uuid}:link`;
    const uuidPart = state.replace(/:link$/, '');
    expect(uuidPart).toBe(uuid);
  });
});
