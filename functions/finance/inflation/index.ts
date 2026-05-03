/**
 * GET /finance/inflation
 *
 * Returns historical CPI data from FINANCE_DB (D1).
 * Query params:
 *   - from: YYYY-MM (default 12 months ago)
 *   - to: YYYY-MM (default current month)
 */

import type { Env, ApiResponse, InflationDataPoint } from '../_shared/types';
import { getFinanceDb, queryInflation } from '../_shared/db';
import { BAD_REQUEST, errorResponse } from '../_shared/errors';

const DATE_PATTERN = /^\d{4}-\d{2}$/;

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  if (from && !DATE_PATTERN.test(from)) {
    return errorResponse(BAD_REQUEST('from must be YYYY-MM format'));
  }
  if (to && !DATE_PATTERN.test(to)) {
    return errorResponse(BAD_REQUEST('to must be YYYY-MM format'));
  }

  // Default: last 12 months
  const now = new Date();
  const defaultFrom = `${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const defaultTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const db = getFinanceDb(env);
  const data = await queryInflation(db, from ?? defaultFrom, to ?? defaultTo);

  const body: ApiResponse<InflationDataPoint[]> = {
    data,
    _meta: { source: 'gus' },
  };

  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'max-age=86400',
    },
  });
};
