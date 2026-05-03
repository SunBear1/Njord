/**
 * GET /api/auth/me
 *
 * Returns the currently authenticated user from the JWT cookie.
 * Returns 401 if not authenticated or token is invalid/expired.
 */

import type { AuthEnv, UserRow, PublicUser } from './_utils/types';
import { errorResponse, jsonResponse } from './_utils/types';
import { verifyJwt } from './_utils/jwt';
import { getAuthCookie } from './_utils/cookie';

export const onRequestGet: PagesFunction<AuthEnv> = async ({ request, env }) => {
  const token = getAuthCookie(request);
  if (!token) {
    return errorResponse('NOT_AUTHENTICATED', 'Nie jesteś zalogowany.', 401);
  }

  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload) {
    return errorResponse('NOT_AUTHENTICATED', 'Sesja wygasła. Zaloguj się ponownie.', 401);
  }

  // Fetch fresh user data + linked OAuth providers
  const [user, oauthRows] = await Promise.all([
    env.DB.prepare(
      'SELECT id, email, password_hash, name FROM users WHERE id = ?',
    ).bind(payload.sub).first<UserRow>(),
    env.DB.prepare(
      'SELECT provider FROM oauth_accounts WHERE user_id = ?',
    ).bind(payload.sub).all<{ provider: string }>(),
  ]);

  if (!user) {
    return errorResponse('NOT_AUTHENTICATED', 'Konto nie istnieje.', 401);
  }

  const publicUser: PublicUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    hasPassword: user.password_hash !== null,
    linkedProviders: oauthRows.results.map((r) => r.provider),
  };

  return jsonResponse(publicUser);
};
