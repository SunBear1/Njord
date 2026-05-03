/**
 * Pages Function: GET /api/bonds
 *
 * Serves Polish treasury bond presets queried from FINANCE_DB D1.
 * Bond data is seeded via the collect-finance-data and seed-finance-data workflows.
 *
 * Response is cached at the CF edge for 24 hours.
 * Bond rates change at most monthly (at new issuance), so long caching is safe.
 */

import { mapDbRowToBondPreset, type BondDbRow } from '../../src/utils/parseBondPresets';

interface Env {
  FINANCE_DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { results } = await context.env.FINANCE_DB.prepare('SELECT * FROM bonds ORDER BY maturity_months ASC').all<BondDbRow>();

  if (!results || results.length === 0) {
    return new Response(JSON.stringify({ error: 'No bond data available' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const presets = results.map(mapDbRowToBondPreset);
  return new Response(JSON.stringify(presets), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'max-age=86400',
    },
  });
};
