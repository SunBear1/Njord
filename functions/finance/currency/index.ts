/**
 * GET /finance/currency
 *
 * Aggregates FX rates from multiple sources (NBP, Alior, Walutomat, Kantor.pl).
 * Query params:
 *   - pairs: comma-separated (default "USD/PLN,EUR/PLN,GBP/PLN")
 *   - source: "all" | "nbp" | "alior" | "walutomat" | "kantor_pl" (default "all")
 */

import type { CurrencyRate, ApiResponse } from '../_shared/types';
import { BAD_REQUEST, errorResponse } from '../_shared/errors';
import { fetchNbpRates } from './_adapters/nbp';
import { fetchAliorRates } from './_adapters/alior';
import { fetchWalutomatRates } from './_adapters/walutomat';
import { fetchKantorPlRates } from './_adapters/kantor-pl';

const ALLOWED_PAIRS = new Set(['USD/PLN', 'EUR/PLN', 'GBP/PLN']);
const ALLOWED_SOURCES = new Set(['all', 'nbp', 'alior', 'walutomat', 'kantor_pl']);

type FetchFn = () => Promise<CurrencyRate[]>;

const SOURCE_MAP: Record<string, FetchFn> = {
  nbp: fetchNbpRates,
  alior: fetchAliorRates,
  walutomat: fetchWalutomatRates,
  kantor_pl: fetchKantorPlRates,
};

export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);

  const pairsParam = url.searchParams.get('pairs') ?? 'USD/PLN,EUR/PLN,GBP/PLN';
  const sourceParam = url.searchParams.get('source') ?? 'all';

  if (!ALLOWED_SOURCES.has(sourceParam)) {
    return errorResponse(BAD_REQUEST(`Invalid source. Allowed: ${[...ALLOWED_SOURCES].join(', ')}`));
  }

  const requestedPairs = pairsParam.split(',').map((p) => p.trim().toUpperCase());
  const validPairs = requestedPairs.filter((p) => ALLOWED_PAIRS.has(p));
  if (validPairs.length === 0) {
    return errorResponse(BAD_REQUEST(`No valid pairs. Allowed: ${[...ALLOWED_PAIRS].join(', ')}`));
  }

  let allRates: CurrencyRate[] = [];

  if (sourceParam === 'all') {
    const fetchers = Object.values(SOURCE_MAP);
    const results = await Promise.allSettled(fetchers.map((fn) => fn()));
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allRates.push(...result.value);
      }
    }
  } else {
    const fetcher = SOURCE_MAP[sourceParam];
    allRates = await fetcher();
  }

  const filtered = allRates.filter((r) => validPairs.includes(r.pair));

  const body: ApiResponse<CurrencyRate[]> = {
    data: filtered,
    _meta: { source: sourceParam === 'all' ? 'aggregated' : sourceParam },
  };

  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
};
