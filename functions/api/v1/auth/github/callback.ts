/**
 * GET /api/v1/auth/github/callback
 *
 * Handles the OAuth callback from GitHub:
 * 1. Verifies state (CSRF)
 * 2. Exchanges code for access token
 * 3. Fetches user profile + email from GitHub
 * 4. Creates or links user in D1
 * 5. Sets JWT cookie
 * 6. Redirects to frontend
 */

import type { AuthEnv, UserRow } from '../_utils/types';
import { signJwt } from '../_utils/jwt';
import { verifyJwt } from '../_utils/jwt';
import { setAuthCookie, getAuthCookie, getOAuthStateCookie, clearOAuthStateCookie } from '../_utils/cookie';

const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';
const GITHUB_EMAILS_URL = 'https://api.github.com/user/emails';

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

export const onRequestGet: PagesFunction<AuthEnv> = async ({ request, env }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const storedState = getOAuthStateCookie(request);

  if (!code || !state || state !== storedState) {
    return redirectWithError(url.origin, 'Nieprawidłowy stan autoryzacji. Spróbuj ponownie.');
  }

  // Check if this is a "link" action (state ends with ":link")
  const isLinkAction = state.endsWith(':link');

  try {
    // Exchange code for access token
    const tokenRes = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenRes.json<{ access_token?: string; error?: string }>();
    if (!tokenData.access_token) {
      return redirectWithError(url.origin, 'Nie udało się uzyskać tokenu z GitHub.');
    }

    const authHeaders = { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'Njord' };

    // Fetch user profile and emails in parallel
    const [userRes, emailsRes] = await Promise.all([
      fetch(GITHUB_USER_URL, { headers: authHeaders }),
      fetch(GITHUB_EMAILS_URL, { headers: authHeaders }),
    ]);

    const ghUser = await userRes.json<GitHubUser>();
    const ghEmails = await emailsRes.json<GitHubEmail[]>();

    const primaryEmail = ghEmails.find((e) => e.primary && e.verified)?.email
      ?? ghEmails.find((e) => e.verified)?.email;

    if (!primaryEmail) {
      return redirectWithError(url.origin, 'Nie znaleziono zweryfikowanego emaila na koncie GitHub.');
    }

    const isSecure = url.protocol === 'https:';

    // Link mode: attach OAuth to current logged-in user
    if (isLinkAction) {
      const existingToken = getAuthCookie(request);
      const payload = existingToken ? await verifyJwt(existingToken, env.JWT_SECRET) : null;
      if (!payload) {
        return redirectWithError(url.origin, 'Musisz być zalogowany, aby połączyć konto.');
      }

      // Check if this GitHub account is already linked to another user
      const existingOAuth = await env.AUTH_DB.prepare(
        'SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_user_id = ?',
      ).bind('github', String(ghUser.id)).first<{ user_id: string }>();

      if (existingOAuth && existingOAuth.user_id !== payload.sub) {
        return redirectWithError(url.origin, 'To konto GitHub jest już połączone z innym użytkownikiem.');
      }

      if (!existingOAuth) {
        await env.AUTH_DB.prepare(
          'INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id, provider_email) VALUES (?, ?, ?, ?, ?)',
        ).bind(crypto.randomUUID(), payload.sub, 'github', String(ghUser.id), primaryEmail).run();
      }

      const headers = new Headers();
      headers.set('Location', `${url.origin}/?auth=linked`);
      headers.append('Set-Cookie', clearOAuthStateCookie(isSecure));
      return new Response(null, { status: 302, headers });
    }

    // Normal login/register flow
    const user = await findOrCreateOAuthUser(env.AUTH_DB, {
      provider: 'github',
      providerUserId: String(ghUser.id),
      email: primaryEmail,
      name: ghUser.name ?? ghUser.login,
    });

    const token = await signJwt(
      { sub: user.id, email: user.email, name: user.name },
      env.JWT_SECRET,
    );

    const headers = new Headers();
    headers.set('Location', `${url.origin}/?auth=success`);
    headers.append('Set-Cookie', setAuthCookie(token, isSecure));
    headers.append('Set-Cookie', clearOAuthStateCookie(isSecure));

    return new Response(null, { status: 302, headers });
  } catch {
    return redirectWithError(url.origin, 'Wystąpił błąd podczas logowania przez GitHub.');
  }
};

interface OAuthUserInput {
  provider: string;
  providerUserId: string;
  email: string;
  name: string;
}

async function findOrCreateOAuthUser(db: D1Database, input: OAuthUserInput): Promise<UserRow> {
  // Check if OAuth account already exists
  const existing = await db.prepare(
    'SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_user_id = ?',
  ).bind(input.provider, input.providerUserId).first<{ user_id: string }>();

  if (existing) {
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(existing.user_id).first<UserRow>();
    if (user) return user;
  }

  // Check if a user with this email already exists (link accounts)
  // Only auto-link if the existing account has verified email to prevent account takeover
  const existingUser = await db.prepare('SELECT * FROM users WHERE email = ?').bind(input.email.toLowerCase()).first<UserRow>();

  if (existingUser && existingUser.email_verified === 1) {
    // Link OAuth account to existing user
    await db.prepare(
      'INSERT OR IGNORE INTO oauth_accounts (id, user_id, provider, provider_user_id, provider_email) VALUES (?, ?, ?, ?, ?)',
    ).bind(crypto.randomUUID(), existingUser.id, input.provider, input.providerUserId, input.email).run();

    return existingUser;
  }

  // Create new user + OAuth account
  const userId = crypto.randomUUID();
  await db.batch([
    db.prepare('INSERT INTO users (id, email, name, email_verified) VALUES (?, ?, ?, 1)')
      .bind(userId, input.email.toLowerCase(), input.name),
    db.prepare('INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id, provider_email) VALUES (?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), userId, input.provider, input.providerUserId, input.email),
  ]);

  return {
    id: userId,
    email: input.email.toLowerCase(),
    password_hash: null,
    name: input.name,
    avatar_url: null,
    email_verified: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function redirectWithError(origin: string, message: string): Response {
  const params = new URLSearchParams({ auth: 'error', message });
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${origin}/?${params}`,
      'Set-Cookie': clearOAuthStateCookie(origin.startsWith('https')),
    },
  });
}
