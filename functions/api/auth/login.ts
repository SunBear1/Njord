/**
 * POST /api/auth/login
 *
 * Authenticates a user with email + password.
 * Sets JWT HttpOnly cookie on success.
 */

import type { AuthEnv, UserRow, PublicUser } from './_utils/types';
import { errorResponse, jsonResponse } from './_utils/types';
import { verifyPassword } from './_utils/password';
import { signJwt } from './_utils/jwt';
import { setAuthCookie } from './_utils/cookie';

export const onRequestPost: PagesFunction<AuthEnv> = async ({ request, env }) => {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse('INVALID_INPUT', 'Nieprawidłowe dane wejściowe.', 400);
  }

  const { email, password } = body;
  if (!email || !password) {
    return errorResponse('INVALID_INPUT', 'Email i hasło są wymagane.', 400);
  }

  const user = await env.DB.prepare(
    'SELECT id, email, password_hash, name, avatar_url FROM users WHERE email = ?',
  ).bind(email.toLowerCase()).first<UserRow>();

  if (!user || !user.password_hash) {
    return errorResponse('INVALID_CREDENTIALS', 'Nieprawidłowy email lub hasło.', 401);
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return errorResponse('INVALID_CREDENTIALS', 'Nieprawidłowy email lub hasło.', 401);
  }

  const token = await signJwt(
    { sub: user.id, email: user.email, name: user.name },
    env.JWT_SECRET,
  );

  const isSecure = new URL(request.url).protocol === 'https:';
  const publicUser: PublicUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatar_url,
    hasPassword: true,
  };

  return jsonResponse(publicUser, 200, { 'Set-Cookie': setAuthCookie(token, isSecure) });
};
