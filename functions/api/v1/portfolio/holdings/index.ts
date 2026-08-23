/**
 * GET  /api/v1/portfolio/holdings — list the authenticated user's holdings.
 * POST /api/v1/portfolio/holdings — create a new holding (bond | savings).
 */

import type { AuthEnv } from '../../auth/_utils/types';
import { errorResponse, jsonResponse } from '../../auth/_utils/types';
import { requireAuth } from '../_shared/auth';

interface HoldingRow {
  id: string;
  asset_class: 'bond' | 'savings' | 'stock';
  source: string | null;
  data: string;
  added_at: string;
  updated_at: string;
}

function toHolding(row: HoldingRow) {
  return {
    id: row.id,
    assetClass: row.asset_class,
    source: row.source,
    addedAt: row.added_at,
    updatedAt: row.updated_at,
    ...JSON.parse(row.data),
  };
}

interface BondPayload { bondPresetId: string; principal: number; purchaseDate: string }
interface SavingsPayload { bankName: string; principal: number; interestRatePercent: number; asOfDate: string }
interface StockPayload { ticker: string; quantity: number; avgPrice: number; currency: string }

const STOCK_CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'PLN']);

function validatePayload(assetClass: unknown, body: Record<string, unknown>): string | null {
  if (assetClass === 'bond') {
    const p = body as unknown as BondPayload;
    if (!p.bondPresetId || typeof p.bondPresetId !== 'string') return 'bondPresetId jest wymagany.';
    if (typeof p.principal !== 'number' || p.principal <= 0) return 'principal musi być liczbą dodatnią.';
    if (!p.purchaseDate || typeof p.purchaseDate !== 'string') return 'purchaseDate jest wymagany.';
    return null;
  }
  if (assetClass === 'savings') {
    const p = body as unknown as SavingsPayload;
    if (!p.bankName || typeof p.bankName !== 'string') return 'bankName jest wymagany.';
    if (typeof p.principal !== 'number' || p.principal <= 0) return 'principal musi być liczbą dodatnią.';
    if (typeof p.interestRatePercent !== 'number' || p.interestRatePercent < 0) return 'interestRatePercent musi być liczbą nieujemną.';
    if (!p.asOfDate || typeof p.asOfDate !== 'string') return 'asOfDate jest wymagany.';
    return null;
  }
  if (assetClass === 'stock') {
    const p = body as unknown as StockPayload;
    if (!p.ticker || typeof p.ticker !== 'string') return 'ticker jest wymagany.';
    if (typeof p.quantity !== 'number' || p.quantity <= 0) return 'quantity musi być liczbą dodatnią.';
    if (typeof p.avgPrice !== 'number' || p.avgPrice <= 0) return 'avgPrice musi być liczbą dodatnią.';
    if (typeof p.currency !== 'string' || !STOCK_CURRENCIES.has(p.currency)) return 'currency musi być jedną z: USD, EUR, GBP, PLN.';
    return null;
  }
  return 'assetClass musi być "stock", "bond" albo "savings".';
}

export const onRequestGet: PagesFunction<AuthEnv> = async ({ request, env }) => {
  const claims = await requireAuth(request, env);
  if (!claims) return errorResponse('NOT_AUTHENTICATED', 'Nie jesteś zalogowany.', 401);

  const rows = await env.AUTH_DB.prepare(
    'SELECT id, asset_class, source, data, added_at, updated_at FROM holdings WHERE user_id = ? ORDER BY added_at DESC',
  ).bind(claims.sub).all<HoldingRow>();

  return jsonResponse({ holdings: rows.results.map(toHolding) });
};

export const onRequestPost: PagesFunction<AuthEnv> = async ({ request, env }) => {
  const claims = await requireAuth(request, env);
  if (!claims) return errorResponse('NOT_AUTHENTICATED', 'Nie jesteś zalogowany.', 401);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return errorResponse('INVALID_INPUT', 'Nieprawidłowe dane wejściowe.', 400);
  }

  const assetClass = body.assetClass;
  const validationError = validatePayload(assetClass, body);
  if (validationError) return errorResponse('INVALID_INPUT', validationError, 400);

  const source = typeof body.source === 'string' ? body.source : null;
  const payload: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (key !== 'assetClass' && key !== 'source') payload[key] = body[key];
  }

  const id = crypto.randomUUID();
  await env.AUTH_DB.prepare(
    'INSERT INTO holdings (id, user_id, asset_class, source, data) VALUES (?, ?, ?, ?, ?)',
  ).bind(id, claims.sub, assetClass as string, source, JSON.stringify(payload)).run();

  return jsonResponse(
    { id, assetClass, source, ...payload },
    201,
  );
};
