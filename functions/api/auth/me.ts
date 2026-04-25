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

  // Fetch fresh user data from DB (name/avatar might have changed)
  const user = await env.DB.prepare(
    'SELECT id, email, name, avatar_url FROM users WHERE id = ?',
  ).bind(payload.sub).first<UserRow>();

  if (!user) {
    return errorResponse('NOT_AUTHENTICATED', 'Konto nie istnieje.', 401);
  }

  const publicUser: PublicUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatar_url,
  };

  return jsonResponse(publicUser);
};
