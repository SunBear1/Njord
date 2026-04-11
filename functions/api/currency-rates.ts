/**
 * Pages Function: GET /api/currency-rates
 *
 * Proxies Alior Kantor and NBP Table C exchange rates with 1-minute edge cache.
 * Keeps third-party API traffic server-side for resilience.
 */

const ALIOR_URL = 'https://klient.internetowykantor.pl/api/public/marketBrief/USD_PLN';
const NBP_URL = 'https://api.nbp.pl/api/exchangerates/rates/C/USD/?format=json';

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

export interface CurrencyRatesProxyResponse {
  alior: { buy: number; sell: number; mid: number; ts: string } | null;
  nbp: { buy: number; sell: number; mid: number; date: string } | null;
}

export const onRequestGet: PagesFunction = async () => {
  const [aliorResult, nbpResult] = await Promise.allSettled([
    fetchAlior(),
    fetchNbp(),
  ]);

  const response: CurrencyRatesProxyResponse = {
    alior: aliorResult.status === 'fulfilled' ? aliorResult.value : null,
    nbp: nbpResult.status === 'fulfilled' ? nbpResult.value : null,
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
      'Cache-Control': 'max-age=60', // 1 minute
    },
  });
};

async function fetchAlior(): Promise<CurrencyRatesProxyResponse['alior']> {
  const res = await fetch(ALIOR_URL);
  if (!res.ok) return null;
  const data: AliorResponse = await res.json();
  const { buyNow, sellNow, forexNow } = data.directExchangeOffers;
  return { buy: buyNow, sell: sellNow, mid: forexNow, ts: data.ts };
}

async function fetchNbp(): Promise<CurrencyRatesProxyResponse['nbp']> {
  const res = await fetch(NBP_URL);
  if (!res.ok) return null;
  const data: NbpResponse = await res.json();
  const rate = data.rates[0];
  if (!rate) return null;
  return { buy: rate.bid, sell: rate.ask, mid: (rate.bid + rate.ask) / 2, date: rate.effectiveDate };
}
