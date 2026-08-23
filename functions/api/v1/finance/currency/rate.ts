/**
 * GET /api/v1/finance/currency/rate?date=YYYY-MM-DD&currency=USD
 *
 * Returns the NBP Table A mid rate for the last business day strictly before `date`.
 */

import { BAD_REQUEST, UPSTREAM_ERROR, errorResponse } from '../_shared/errors';
import { fetchNbpTableARate } from './_adapters/nbp';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;

export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);

  const date = url.searchParams.get('date');
  if (!date) {
    return errorResponse(BAD_REQUEST('Missing required param: date'));
  }
  if (!DATE_RE.test(date)) {
    return errorResponse(BAD_REQUEST('Invalid date format. Expected YYYY-MM-DD'));
  }

  const currency = (url.searchParams.get('currency') ?? '').toUpperCase();
  if (!currency) {
    return errorResponse(BAD_REQUEST('Missing required param: currency'));
  }
  if (!CURRENCY_RE.test(currency)) {
    return errorResponse(BAD_REQUEST('Invalid currency code. Expected 3-letter ISO code'));
  }

  try {
    const result = await fetchNbpTableARate(date, currency);

    return new Response(
      JSON.stringify({ ok: true, data: result }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=86400',
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(UPSTREAM_ERROR(message, 'nbp'));
  }
};
