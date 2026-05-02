/**
 * Pages Function: GET /api/currency-rates
 *
 * Proxies Alior Kantor and NBP Table C exchange rates.
 *
 * Caching strategy:
 * - Alior: never cached — always fetched fresh (live forex rates change every few seconds).
 * - NBP Table C: cached at CF edge for 1 hour via Cache API (published once per banking day).
 * - Response: Cache-Control: no-store — browser must not cache; every poll gets a fresh response.
 *
 * Supports multi-currency via ?currencies=USD,EUR,GBP (default: USD only for backward compat).
 */

const ALIOR_BASE = 'https://klient.internetowykantor.pl/api/public/marketBrief';
const NBP_BASE = 'https://api.nbp.pl/api/exchangerates/rates/C';
const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP'] as const;
const NBP_CACHE_TTL_SECONDS = 3_600; // NBP Table C publishes once per banking day
const UPSTREAM_TIMEOUT_MS = 5_000;

interface AliorResponse {
  pair: string;
  ts: string;
  directExchangeOffers: {
    forexNow: number;
    sellNow: number;
    buyNow: number;
  };
}

interface NbpResponse {
  rates: Array<{ bid: number; ask: number; effectiveDate: string }>;
}

export interface RateData {
  buy: number;
  sell: number;
  mid: number;
}

export interface CurrencyRateEntry {
  currency: string;
  alior: (RateData & { ts: string }) | null;
  nbp: (RateData & { date: string }) | null;
}

// Legacy shape — kept for backward compatibility with useCurrencyRates hook
export interface CurrencyRatesProxyResponse {
  alior: { buy: number; sell: number; mid: number; ts: string } | null;
  nbp: { buy: number; sell: number; mid: number; date: string } | null;
}

/** Included in every response so clients can verify data freshness. */
export interface MultiCurrencyResponse {
  rates: CurrencyRateEntry[];
  fetchedAt: number;
}

export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const currenciesParam = url.searchParams.get('currencies');

  const noStore = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };

  // Multi-currency mode
  if (currenciesParam) {
    const requested = currenciesParam.split(',').map(c => c.trim().toUpperCase());
    const valid = requested.filter(c => (SUPPORTED_CURRENCIES as readonly string[]).includes(c));
    if (valid.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid currencies. Supported: USD, EUR, GBP' }), {
        status: 400,
        headers: noStore,
      });
    }

    const entries = await Promise.all(valid.map(c => fetchCurrencyPair(c)));
    const body: MultiCurrencyResponse = { rates: entries, fetchedAt: Date.now() };
    return new Response(JSON.stringify(body), { headers: noStore });
  }

  // Legacy single-currency mode (USD only)
  const entry = await fetchCurrencyPair('USD');
  const response: CurrencyRatesProxyResponse = {
    alior: entry.alior,
    nbp: entry.nbp,
  };

  if (!response.alior && !response.nbp) {
    return new Response(JSON.stringify({ error: 'All upstream rate sources failed' }), {
      status: 502,
      headers: noStore,
    });
  }

  return new Response(JSON.stringify(response), { headers: noStore });
};

async function fetchCurrencyPair(currency: string): Promise<CurrencyRateEntry> {
  const [aliorResult, nbpResult] = await Promise.allSettled([
    fetchAlior(currency),
    fetchNbpCached(currency),
  ]);

  return {
    currency,
    alior: aliorResult.status === 'fulfilled' ? aliorResult.value : null,
    nbp: nbpResult.status === 'fulfilled' ? nbpResult.value : null,
  };
}

async function fetchAlior(currency: string): Promise<CurrencyRateEntry['alior']> {
  const res = await fetch(`${ALIOR_BASE}/${currency}_PLN`, {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const data: AliorResponse = await res.json();
  const { buyNow, sellNow, forexNow } = data.directExchangeOffers;
  return { buy: buyNow, sell: sellNow, mid: forexNow, ts: data.ts };
}

/**
 * Fetches NBP Table C for a currency, using the CF Cache API to avoid hammering
 * the NBP API on every 1-second poll. NBP publishes once per banking day, so
 * a 1-hour edge cache is appropriate.
 */
async function fetchNbpCached(currency: string): Promise<CurrencyRateEntry['nbp']> {
  // caches.default is a Cloudflare Workers extension — not in the standard DOM lib
  const cfCaches = caches as unknown as { default: Cache };
  const cacheKey = new Request(`https://njord.internal/nbp-c/${currency}`);
  const cache = cfCaches.default;

  const cached = await cache.match(cacheKey);
  if (cached) {
    return await cached.json() as CurrencyRateEntry['nbp'];
  }

  const fresh = await fetchNbp(currency);
  if (fresh) {
    const toCache = new Response(JSON.stringify(fresh), {
      headers: { 'Cache-Control': `public, max-age=${NBP_CACHE_TTL_SECONDS}` },
    });
    // cache.put is fire-and-forget — don't await to avoid blocking response
    void cache.put(cacheKey, toCache);
  }
  return fresh;
}

async function fetchNbp(currency: string): Promise<CurrencyRateEntry['nbp']> {
  const res = await fetch(`${NBP_BASE}/${currency}/?format=json`, {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const data: NbpResponse = await res.json();
  const rate = data.rates[0];
  if (!rate) return null;
  return { buy: rate.bid, sell: rate.ask, mid: (rate.bid + rate.ask) / 2, date: rate.effectiveDate };
}
