/**
 * Pages Function: GET /api/bonds
 *
 * Serves Polish treasury bond presets parsed from the CSV source of truth.
 * The CSV is bundled at build time — no runtime HTTP request needed.
 *
 * Response is cached at the CF edge for 24 hours.
 * Bond rates change at most monthly (at new issuance), so long caching is safe.
 */

import rawCsv from '../../data/polish_treasury_bonds.csv';
import { parseBondPresetsFromCsv } from '../../src/utils/parseBondPresets';

export const onRequestGet: PagesFunction = () => {
  const presets = parseBondPresetsFromCsv(rawCsv as unknown as string);
  return new Response(JSON.stringify(presets), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'max-age=86400',
    },
  });
};
