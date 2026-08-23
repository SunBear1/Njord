/**
 * HttpOnly cookie helpers for auth JWT.
 */

const COOKIE_NAME = 'njord_auth';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Build a Set-Cookie header value that stores the JWT token.
 * HttpOnly + Secure + SameSite=Lax — not accessible from JavaScript.
 */
export function setAuthCookie(token: string, isSecure = true): string {
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    `Max-Age=${COOKIE_MAX_AGE}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (isSecure) parts.push('Secure');
  return parts.join('; ');
}

/**
 * Build a Set-Cookie header value that clears the auth cookie.
 */
export function clearAuthCookie(isSecure = true): string {
  const parts = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (isSecure) parts.push('Secure');
  return parts.join('; ');
}

/**
 * Parse the auth JWT from the Cookie header. Returns null if not present.
 */
export function getAuthCookie(request: Request): string | null {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map((c) => c.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith(`${COOKIE_NAME}=`)) {
      return cookie.substring(COOKIE_NAME.length + 1);
    }
  }
  return null;
}
