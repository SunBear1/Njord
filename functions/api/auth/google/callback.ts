/**
 * GET /api/auth/google/callback
 *
 * Handles the OAuth callback from Google:
 * 1. Verifies state (CSRF)
 * 2. Exchanges code for access token
 * 3. Fetches user profile from Google
 * 4. Creates or links user in D1
 * 5. Sets JWT cookie
 * 6. Redirects to frontend
 */

import type { AuthEnv, UserRow } from '../_utils/types';
import { signJwt } from '../_utils/jwt';
import { setAuthCookie, getOAuthStateCookie, clearOAuthStateCookie } from '../_utils/cookie';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

interface GoogleUser {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  picture: string;
}

export const onRequestGet: PagesFunction<AuthEnv> = async ({ request, env }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const storedState = getOAuthStateCookie(request);

  if (!code || !state || state !== storedState) {
    return redirectWithError(url.origin, 'Nieprawidłowy stan autoryzacji. Spróbuj ponownie.');
  }

  try {
    // Exchange code for access token
    const redirectUri = `${url.origin}/api/auth/google/callback`;
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenRes.json<{ access_token?: string; error?: string }>();
    if (!tokenData.access_token) {
      return redirectWithError(url.origin, 'Nie udało się uzyskać tokenu z Google.');
    }

    // Fetch user profile
    const userRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const gUser = await userRes.json<GoogleUser>();
    if (!gUser.email || !gUser.verified_email) {
      return redirectWithError(url.origin, 'Nie znaleziono zweryfikowanego emaila na koncie Google.');
    }

    // Find or create user
    const user = await findOrCreateOAuthUser(env.DB, {
      provider: 'google',
      providerUserId: gUser.id,
      email: gUser.email,
      name: gUser.name,
      avatarUrl: gUser.picture,
    });

    const token = await signJwt(
      { sub: user.id, email: user.email, name: user.name },
      env.JWT_SECRET,
    );

    const isSecure = url.protocol === 'https:';
    const headers = new Headers();
    headers.set('Location', `${url.origin}/?auth=success`);
    headers.append('Set-Cookie', setAuthCookie(token, isSecure));
    headers.append('Set-Cookie', clearOAuthStateCookie(isSecure));

    return new Response(null, { status: 302, headers });
  } catch {
    return redirectWithError(url.origin, 'Wystąpił błąd podczas logowania przez Google.');
  }
};

interface OAuthUserInput {
  provider: string;
  providerUserId: string;
  email: string;
  name: string;
  avatarUrl: string;
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
  const existingUser = await db.prepare('SELECT * FROM users WHERE email = ?').bind(input.email.toLowerCase()).first<UserRow>();

  if (existingUser) {
    await db.prepare(
      'INSERT OR IGNORE INTO oauth_accounts (id, user_id, provider, provider_user_id, provider_email) VALUES (?, ?, ?, ?, ?)',
    ).bind(crypto.randomUUID(), existingUser.id, input.provider, input.providerUserId, input.email).run();

    if (!existingUser.avatar_url) {
      await db.prepare('UPDATE users SET avatar_url = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .bind(input.avatarUrl, existingUser.id).run();
      existingUser.avatar_url = input.avatarUrl;
    }

    return existingUser;
  }

  // Create new user + OAuth account
  const userId = crypto.randomUUID();
  await db.batch([
    db.prepare('INSERT INTO users (id, email, name, avatar_url, email_verified) VALUES (?, ?, ?, ?, 1)')
      .bind(userId, input.email.toLowerCase(), input.name, input.avatarUrl),
    db.prepare('INSERT INTO oauth_accounts (id, user_id, provider, provider_user_id, provider_email) VALUES (?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), userId, input.provider, input.providerUserId, input.email),
  ]);

  return {
    id: userId,
    email: input.email.toLowerCase(),
    password_hash: null,
    name: input.name,
    avatar_url: input.avatarUrl,
    email_verified: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function redirectWithError(origin: string, message: string): Response {
  const params = new URLSearchParams({ auth: 'error', message });
  return new Response(null, {
    status: 302,
    headers: { Location: `${origin}/?${params}` },
  });
}
