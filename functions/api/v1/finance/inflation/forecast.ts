/**
 * GET /finance/inflation/forecast
 *
 * Returns NBP inflation forecast data from FINANCE_DB (D1).
 * Query params:
 *   - report: YYYY-MM (default: latest available report)
 */

import type { Env, ApiResponse, InflationForecast } from '../_shared/types';
import { getFinanceDb, queryForecasts } from '../_shared/db';
import { BAD_REQUEST, errorResponse } from '../_shared/errors';

const DATE_PATTERN = /^\d{4}-\d{2}$/;

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const report = url.searchParams.get('report');

  if (report && !DATE_PATTERN.test(report)) {
    return errorResponse(BAD_REQUEST('report must be YYYY-MM format'));
  }

  const db = getFinanceDb(env);
  const data = await queryForecasts(db, report ?? undefined);

  const body: ApiResponse<InflationForecast[]> = {
    data,
    _meta: { source: 'nbp' },
  };

  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'max-age=86400',
    },
  });
};
