/**
 * GET /api/auth/github
 *
 * Redirects the user to GitHub's OAuth authorization page.
 * Stores a random state token in a short-lived cookie for CSRF protection.
 */

import type { AuthEnv } from '../_utils/types';
import { errorResponse } from '../_utils/types';
import { setOAuthStateCookie } from '../_utils/cookie';

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';

export const onRequestGet: PagesFunction<AuthEnv> = async ({ request, env }) => {
  if (!env.GITHUB_CLIENT_ID) {
    return errorResponse('CONFIG_ERROR', 'Logowanie przez GitHub nie jest skonfigurowane.', 503);
  }

  const state = crypto.randomUUID();
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/api/auth/github/callback`;

  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'user:email',
    state,
  });

  const isSecure = url.protocol === 'https:';
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${GITHUB_AUTHORIZE_URL}?${params}`,
      'Set-Cookie': setOAuthStateCookie(state, isSecure),
    },
  });
};
