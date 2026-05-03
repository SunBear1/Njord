/**
 * Pages Functions middleware — applied to all /api/* routes.
 *
 * Handles CORS preflight (OPTIONS) and injects CORS + Content-Type headers
 * on every response, so individual handlers don't have to manage them.
 */

const ALLOWED_ORIGINS = new Set([
  'https://njord.pages.dev',
  'http://localhost:5173',
  'http://localhost:8788',
]);

function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin');
  // Only reflect origin if it's in our allowlist; otherwise omit credentials
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true',
    };
  }
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export const onRequest: PagesFunction = async ({ request, next }) => {
  const corsHeaders = getCorsHeaders(request);

  // Preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  let response: Response;
  try {
    response = await next();
  } catch {
    // Function crashed — return a proper JSON error with CORS headers
    // instead of letting CF serve an HTML error page
    return new Response(JSON.stringify({ error: 'Wewnętrzny błąd serwera.', code: 'INTERNAL_ERROR' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  // Clone to mutate headers
  const newResponse = new Response(response.body, response);
  for (const [key, value] of Object.entries(corsHeaders)) {
    newResponse.headers.set(key, value);
  }
  if (!newResponse.headers.has('Content-Type')) {
    newResponse.headers.set('Content-Type', 'application/json');
  }

  // Auth routes must never be cached — prevent proxy/CDN from serving one user's data to another
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/v1/auth/')) {
    newResponse.headers.set('Cache-Control', 'no-store');
  }

  return newResponse;
};
