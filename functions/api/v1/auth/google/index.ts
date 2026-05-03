/**
 * GET /api/v1/auth/google
 *
 * Redirects the user to Google's OAuth 2.0 authorization page.
 * Stores a random state token in a short-lived cookie for CSRF protection.
 */

import type { AuthEnv } from '../_utils/types';
import { errorResponse } from '../_utils/types';
import { setOAuthStateCookie } from '../_utils/cookie';

const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

export const onRequestGet: PagesFunction<AuthEnv> = async ({ request, env }) => {
  if (!env.GOOGLE_CLIENT_ID) {
    return errorResponse('CONFIG_ERROR', 'Logowanie przez Google nie jest skonfigurowane.', 503);
  }

  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  const stateValue = action === 'link' ? `${crypto.randomUUID()}:link` : crypto.randomUUID();
  const redirectUri = `${url.origin}/api/v1/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: stateValue,
    access_type: 'offline',
    prompt: 'consent',
  });

  const isSecure = url.protocol === 'https:';
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${GOOGLE_AUTHORIZE_URL}?${params}`,
      'Set-Cookie': setOAuthStateCookie(stateValue, isSecure),
    },
  });
};
