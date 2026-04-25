/**
 * POST /api/auth/register
 *
 * Creates a new user with email + password.
 * Sets JWT HttpOnly cookie on success.
 */

import type { AuthEnv, UserRow, PublicUser } from './_utils/types';
import { errorResponse, jsonResponse } from './_utils/types';
import { hashPassword } from './_utils/password';
import { signJwt } from './_utils/jwt';
import { setAuthCookie } from './_utils/cookie';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export const onRequestPost: PagesFunction<AuthEnv> = async ({ request, env }) => {
  let body: { email?: string; password?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse('INVALID_INPUT', 'Nieprawidłowe dane wejściowe.', 400);
  }

  const { email, password, name } = body;

  if (!email || !EMAIL_REGEX.test(email)) {
    return errorResponse('INVALID_EMAIL', 'Podaj prawidłowy adres email.', 400);
  }

  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return errorResponse('WEAK_PASSWORD', `Hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków.`, 400);
  }

  // Check for existing user
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase()).first<UserRow>();
  if (existing) {
    return errorResponse('EMAIL_EXISTS', 'Konto z tym adresem email już istnieje.', 409);
  }

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  await env.DB.prepare(
    'INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)',
  ).bind(userId, email.toLowerCase(), passwordHash, name ?? null).run();

  const token = await signJwt(
    { sub: userId, email: email.toLowerCase(), name: name ?? null },
    env.JWT_SECRET,
  );

  const isSecure = new URL(request.url).protocol === 'https:';
  const user: PublicUser = { id: userId, email: email.toLowerCase(), name: name ?? null, avatarUrl: null };

  return jsonResponse(user, 201, { 'Set-Cookie': setAuthCookie(token, isSecure) });
};
