/**
 * GET /finance/bonds
 *
 * Reads bond presets from FINANCE_DB (D1).
 * Query params:
 *   - type: filter by bond id prefix (e.g., OTS, TOS, COI, EDO, ROS, ROD)
 *   - is_family: "true" or "false"
 */

import type { Env, ApiResponse, Bond } from '../_shared/types';
import { getFinanceDb, queryBonds } from '../_shared/db';
import { BAD_REQUEST, errorResponse } from '../_shared/errors';

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const type = url.searchParams.get('type')?.toUpperCase();
  const isFamilyParam = url.searchParams.get('is_family');

  let isFamily: boolean | undefined;
  if (isFamilyParam !== null) {
    if (isFamilyParam !== 'true' && isFamilyParam !== 'false') {
      return errorResponse(BAD_REQUEST('is_family must be "true" or "false"'));
    }
    isFamily = isFamilyParam === 'true';
  }

  const db = getFinanceDb(env);
  const bonds = await queryBonds(db, { type: type ?? undefined, is_family: isFamily });

  const lastUpdated = bonds.reduce(
    (max, b) => (b.updated_at > max ? b.updated_at : max),
    '',
  );

  const body: ApiResponse<Bond[]> = {
    data: bonds,
    _meta: {
      source: 'obligacjeskarbowe.pl',
      last_updated_at: lastUpdated || undefined,
    },
  };

  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'max-age=86400',
    },
  });
};
