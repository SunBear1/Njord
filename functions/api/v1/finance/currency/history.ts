/**
 * GET /api/v1/finance/currency/history
 *
 * Returns historical NBP Table A mid rates for a given currency.
 * Query params:
 *   - currency: USD | EUR | GBP (default: USD)
 *   - days: 1-365 (default: 90)
 */

import { BAD_REQUEST, errorResponse } from '../_shared/errors';
import { fetchNbpFxHistory } from './_adapters/nbp';

const ALLOWED_CURRENCIES = new Set(['USD', 'EUR', 'GBP']);
const DEFAULT_DAYS = 90;
const MIN_DAYS = 1;
const MAX_DAYS = 365;

export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);

  const currency = (url.searchParams.get('currency') ?? 'USD').toUpperCase();
  const daysParam = url.searchParams.get('days') ?? String(DEFAULT_DAYS);

  if (!ALLOWED_CURRENCIES.has(currency)) {
    return errorResponse(
      BAD_REQUEST(`Invalid currency. Allowed: ${[...ALLOWED_CURRENCIES].join(', ')}`),
    );
  }

  const days = Number(daysParam);
  if (!Number.isFinite(days) || !Number.isInteger(days) || days < MIN_DAYS || days > MAX_DAYS) {
    return errorResponse(BAD_REQUEST(`days must be an integer between ${MIN_DAYS} and ${MAX_DAYS}`));
  }

  const rates = await fetchNbpFxHistory(currency, days);

  const body = {
    ok: true,
    data: {
      currency,
      rates,
    },
  };

  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
