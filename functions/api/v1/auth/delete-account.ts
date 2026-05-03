/**
 * POST /api/auth/delete-account
 *
 * Permanently deletes the user's account. Requires JWT auth.
 * For users with a password: requires password confirmation.
 * For OAuth-only users: no password needed (they don't have one).
 * Deletes oauth_accounts rows (CASCADE) and the user row.
 * Clears the auth cookie.
 */

import type { AuthEnv, UserRow } from './_utils/types';
import { errorResponse, jsonResponse } from './_utils/types';
import { verifyJwt } from './_utils/jwt';
import { getAuthCookie, clearAuthCookie } from './_utils/cookie';
import { verifyPassword } from './_utils/password';

export const onRequestPost: PagesFunction<AuthEnv> = async ({ request, env }) => {
  const token = getAuthCookie(request);
  if (!token) {
    return errorResponse('NOT_AUTHENTICATED', 'Nie jesteś zalogowany.', 401);
  }

  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload) {
    return errorResponse('NOT_AUTHENTICATED', 'Sesja wygasła. Zaloguj się ponownie.', 401);
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const user = await env.DB.prepare('SELECT id, password_hash FROM users WHERE id = ?')
    .bind(payload.sub).first<UserRow>();

  if (!user) {
    return errorResponse('NOT_FOUND', 'Konto nie istnieje.', 404);
  }

  // If user has a password, require password confirmation
  if (user.password_hash) {
    if (!body.password) {
      return errorResponse('INVALID_INPUT', 'Podaj hasło, aby potwierdzić usunięcie konta.', 400);
    }
    const valid = await verifyPassword(body.password, user.password_hash);
    if (!valid) {
      return errorResponse('WRONG_PASSWORD', 'Hasło jest nieprawidłowe.', 403);
    }
  }

  // Delete OAuth accounts first, then user (CASCADE should handle this, but be explicit)
  await env.DB.batch([
    env.DB.prepare('DELETE FROM oauth_accounts WHERE user_id = ?').bind(user.id),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id),
  ]);

  const isSecure = new URL(request.url).protocol === 'https:';
  return jsonResponse({ ok: true }, 200, { 'Set-Cookie': clearAuthCookie(isSecure) });
};
