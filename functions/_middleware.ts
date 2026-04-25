/**
 * Pages Functions middleware — applied to all /api/* routes.
 *
 * Handles CORS preflight (OPTIONS) and injects CORS + Content-Type headers
 * on every response, so individual handlers don't have to manage them.
 */

function getCorsHeaders(request: Request): Record<string, string> {
  // credentials: 'include' requires a specific origin, not '*'
  const origin = request.headers.get('Origin') ?? '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
  };
}

export const onRequest: PagesFunction = async ({ request, next }) => {
  const corsHeaders = getCorsHeaders(request);

  // Preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const response = await next();

  // Clone to mutate headers
  const newResponse = new Response(response.body, response);
  for (const [key, value] of Object.entries(corsHeaders)) {
    newResponse.headers.set(key, value);
  }
  if (!newResponse.headers.has('Content-Type')) {
    newResponse.headers.set('Content-Type', 'application/json');
  }

  return newResponse;
};
