/**
 * Pages Functions middleware — applied to all /api/* routes.
 *
 * Handles CORS preflight (OPTIONS) and injects CORS + Content-Type headers
 * on every response, so individual handlers don't have to manage them.
 */

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const onRequest: PagesFunction = async ({ request, next }) => {
  // Preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const response = await next();

  // Clone to mutate headers
  const newResponse = new Response(response.body, response);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    newResponse.headers.set(key, value);
  }
  if (!newResponse.headers.has('Content-Type')) {
    newResponse.headers.set('Content-Type', 'application/json');
  }

  return newResponse;
};
