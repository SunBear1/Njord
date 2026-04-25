/**
 * POST /api/auth/logout
 *
 * Clears the auth JWT cookie.
 */

import type { AuthEnv } from './_utils/types';
import { jsonResponse } from './_utils/types';
import { clearAuthCookie } from './_utils/cookie';

export const onRequestPost: PagesFunction<AuthEnv> = async ({ request }) => {
  const isSecure = new URL(request.url).protocol === 'https:';
  return jsonResponse({ ok: true }, 200, { 'Set-Cookie': clearAuthCookie(isSecure) });
};
