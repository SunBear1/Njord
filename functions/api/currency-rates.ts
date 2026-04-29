/**
 * Pages Function: GET /api/currency-rates
 *
 * Proxies Alior Kantor and NBP Table C exchange rates with 1-minute edge cache.
 * Supports multi-currency via ?currencies=USD,EUR,GBP,CHF (default: USD only for backward compat).
 */

const ALIOR_BASE = 'https://klient.internetowykantor.pl/api/public/marketBrief';
const NBP_BASE = 'https://api.nbp.pl/api/exchangerates/rates/C';
const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CHF'] as const;

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

export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const currenciesParam = url.searchParams.get('currencies');

  // Multi-currency mode
  if (currenciesParam) {
    const requested = currenciesParam.split(',').map(c => c.trim().toUpperCase());
    const valid = requested.filter(c => (SUPPORTED_CURRENCIES as readonly string[]).includes(c));
    if (valid.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid currencies. Supported: USD, EUR, GBP, CHF' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const entries = await Promise.all(valid.map(fetchCurrencyPair));
    return new Response(JSON.stringify({ rates: entries }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=60',
      },
    });
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
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(response), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'max-age=60',
    },
  });
};

async function fetchCurrencyPair(currency: string): Promise<CurrencyRateEntry> {
  const [aliorResult, nbpResult] = await Promise.allSettled([
    fetchAlior(currency),
    fetchNbp(currency),
  ]);

  return {
    currency,
    alior: aliorResult.status === 'fulfilled' ? aliorResult.value : null,
    nbp: nbpResult.status === 'fulfilled' ? nbpResult.value : null,
  };
}

async function fetchAlior(currency: string): Promise<CurrencyRateEntry['alior']> {
  const res = await fetch(`${ALIOR_BASE}/${currency}_PLN`);
  if (!res.ok) return null;
  const data: AliorResponse = await res.json();
  const { buyNow, sellNow, forexNow } = data.directExchangeOffers;
  return { buy: buyNow, sell: sellNow, mid: forexNow, ts: data.ts };
}

async function fetchNbp(currency: string): Promise<CurrencyRateEntry['nbp']> {
  const res = await fetch(`${NBP_BASE}/${currency}/?format=json`);
  if (!res.ok) return null;
  const data: NbpResponse = await res.json();
  const rate = data.rates[0];
  if (!rate) return null;
  return { buy: rate.bid, sell: rate.ask, mid: (rate.bid + rate.ask) / 2, date: rate.effectiveDate };
}
