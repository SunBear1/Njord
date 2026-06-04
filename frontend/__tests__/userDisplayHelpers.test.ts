/**
 * Frontend-only unit tests that survive the Story 0.8 cutover from
 * Cloudflare Pages Functions to the Go backend. JWT/password/cookie
 * helpers now live in backend/internal/auth and are covered by Go tests.
 */

import { describe, it, expect } from 'vitest';
import { getInitials } from '../utils/userDisplayHelpers';

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
