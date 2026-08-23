/**
 * PATCH  /api/v1/portfolio/holdings/:id — update a holding's payload fields.
 * DELETE /api/v1/portfolio/holdings/:id — delete a holding.
 * Both scoped to the authenticated user — a holding owned by another user
 * returns 404, never leaking whether the id exists.
 */

import type { AuthEnv } from '../../auth/_utils/types';
import { errorResponse, jsonResponse } from '../../auth/_utils/types';
import { requireAuth } from '../_shared/auth';

interface HoldingRow {
  id: string;
  asset_class: 'bond' | 'savings' | 'stock';
  source: string | null;
  data: string;
}

export const onRequestPatch: PagesFunction<AuthEnv> = async ({ request, env, params }) => {
  const claims = await requireAuth(request, env);
  if (!claims) return errorResponse('NOT_AUTHENTICATED', 'Nie jesteś zalogowany.', 401);

  const id = params.id as string;
  const existing = await env.AUTH_DB.prepare(
    'SELECT id, asset_class, source, data FROM holdings WHERE id = ? AND user_id = ?',
  ).bind(id, claims.sub).first<HoldingRow>();
  if (!existing) return errorResponse('NOT_FOUND', 'Pozycja nie istnieje.', 404);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return errorResponse('INVALID_INPUT', 'Nieprawidłowe dane wejściowe.', 400);
  }

  const source = typeof body.source === 'string' ? body.source : existing.source;
  const merged = { ...JSON.parse(existing.data), ...body };
  delete merged.source;
  delete merged.assetClass;

  await env.AUTH_DB.prepare(
    "UPDATE holdings SET source = ?, data = ?, updated_at = datetime('now') WHERE id = ?",
  ).bind(source, JSON.stringify(merged), id).run();

  return jsonResponse({ id, assetClass: existing.asset_class, source, ...merged });
};

export const onRequestDelete: PagesFunction<AuthEnv> = async ({ request, env, params }) => {
  const claims = await requireAuth(request, env);
  if (!claims) return errorResponse('NOT_AUTHENTICATED', 'Nie jesteś zalogowany.', 401);

  const id = params.id as string;
  const result = await env.AUTH_DB.prepare(
    'DELETE FROM holdings WHERE id = ? AND user_id = ?',
  ).bind(id, claims.sub).run();

  if (result.meta.changes === 0) return errorResponse('NOT_FOUND', 'Pozycja nie istnieje.', 404);
  return jsonResponse({ ok: true });
};
