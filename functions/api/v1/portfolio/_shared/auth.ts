/**
 * Shared JWT-cookie auth guard for portfolio routes.
 * Mirrors the check every functions/api/v1/auth/*.ts handler inlines.
 */

import type { AuthEnv, JwtPayload } from '../../auth/_utils/types';
import { verifyJwt } from '../../auth/_utils/jwt';
import { getAuthCookie } from '../../auth/_utils/cookie';

export async function requireAuth(request: Request, env: AuthEnv): Promise<JwtPayload | null> {
  const token = getAuthCookie(request);
  if (!token) return null;
  return verifyJwt(token, env.JWT_SECRET);
}
