/**
 * Pages Function: GET /api/bonds
 *
 * Serves Polish treasury bond presets parsed from the CSV source of truth.
 * The CSV lives in public/ and is fetched as a static asset from the same origin.
 *
 * Response is cached at the CF edge for 24 hours.
 * Bond rates change at most monthly (at new issuance), so long caching is safe.
 */

import { parseBondPresetsFromCsv } from '../../src/utils/parseBondPresets';

export const onRequestGet: PagesFunction = async (context) => {
  const csvUrl = new URL('/polish_treasury_bonds.csv', context.request.url);
  const res = await fetch(csvUrl.toString());
  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'Failed to load bond data' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const raw = await res.text();
  const presets = parseBondPresetsFromCsv(raw);
  return new Response(JSON.stringify(presets), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'max-age=86400',
    },
  });
};
