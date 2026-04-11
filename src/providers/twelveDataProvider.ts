import type { ProxyResponse, ProxyErrorResponse, ErrorCode } from '../types/analyze';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

/**
 * Calls the Cloudflare Pages Function at /api/analyze which fetches stock/ETF
 * data from Yahoo Finance (primary) or Twelve Data (fallback on rate limit).
 * FX rates come from NBP. API key is never exposed to the browser.
 * All heavy computation runs client-side.
 */

/** Translate structured backend error codes to Polish UI messages. */
function translateError(code: ErrorCode | undefined, raw: string, ticker?: string): string {
  switch (code) {
    case 'TICKER_NOT_FOUND':
      return ticker
        ? `Nie znaleziono tickera: ${ticker}`
        : raw.replace('Ticker not found', 'Nie znaleziono tickera')
             .replace('No data found for ticker', 'Nie znaleziono danych dla');
    case 'RATE_LIMITED':
      return 'Przekroczono limit zapytań API. Spróbuj ponownie za minutę.';
    case 'INVALID_TICKER':
      return 'Nieprawidłowy lub brakujący ticker.';
    case 'UPSTREAM_ERROR':
      if (raw.includes('USD/PLN') || raw.includes('NBP')) {
        return 'Błąd pobierania kursu USD/PLN z NBP.';
      }
      return 'Błąd pobierania danych. Spróbuj ponownie.';
    default:
      return raw;
  }
}

export async function fetchAssetData(
  ticker: string,
  signal?: AbortSignal,
): Promise<ProxyResponse> {
  const url = `/api/analyze?ticker=${encodeURIComponent(ticker)}`;

  const res = await fetchWithTimeout(url, signal);

  const data = await res.json() as ProxyResponse & ProxyErrorResponse;

  if (!res.ok || data.error) {
    throw new Error(translateError(data.code, data.error ?? `HTTP ${res.status}`, ticker));
  }

  return data;
}

