/**
 * POST /api/auth/change-password
 *
 * Changes the user's password. Requires JWT auth.
 * For users who registered with email+password: requires current password.
 * For OAuth-only users: sets a password (no current password needed).
 */

import type { AuthEnv, UserRow } from './_utils/types';
import { errorResponse, jsonResponse } from './_utils/types';
import { verifyJwt } from './_utils/jwt';
import { getAuthCookie } from './_utils/cookie';
import { hashPassword, verifyPassword } from './_utils/password';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export const onRequestPost: PagesFunction<AuthEnv> = async ({ request, env }) => {
  const token = getAuthCookie(request);
  if (!token) {
    return errorResponse('NOT_AUTHENTICATED', 'Nie jesteś zalogowany.', 401);
  }

  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload) {
    return errorResponse('NOT_AUTHENTICATED', 'Sesja wygasła. Zaloguj się ponownie.', 401);
  }

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse('INVALID_INPUT', 'Nieprawidłowe dane wejściowe.', 400);
  }

  const { currentPassword, newPassword } = body;

  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    return errorResponse('WEAK_PASSWORD', `Nowe hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków.`, 400);
  }

  if (newPassword.length > MAX_PASSWORD_LENGTH) {
    return errorResponse('WEAK_PASSWORD', `Hasło nie może przekraczać ${MAX_PASSWORD_LENGTH} znaków.`, 400);
  }

  const user = await env.AUTH_DB.prepare('SELECT id, password_hash FROM users WHERE id = ?')
    .bind(payload.sub).first<UserRow>();

  if (!user) {
    return errorResponse('NOT_FOUND', 'Konto nie istnieje.', 404);
  }

  // If user has a password, require current password verification
  if (user.password_hash) {
    if (!currentPassword) {
      return errorResponse('INVALID_INPUT', 'Podaj aktualne hasło.', 400);
    }
    const valid = await verifyPassword(currentPassword, user.password_hash);
    if (!valid) {
      return errorResponse('WRONG_PASSWORD', 'Aktualne hasło jest nieprawidłowe.', 403);
    }
  }

  const newHash = await hashPassword(newPassword);
  await env.AUTH_DB.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .bind(newHash, payload.sub).run();

  return jsonResponse({ ok: true });
};
