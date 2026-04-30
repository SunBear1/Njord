import type { ProxyResponse, ProxyErrorResponse, ErrorCode } from '../types/marketData';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

/**
 * Calls the Cloudflare Pages Function at /api/market-data which fetches stock/ETF
 * data from Yahoo Finance (primary) or Twelve Data (fallback on rate limit).
 * FX rates come from NBP. API key is never exposed to the browser.
 * All heavy computation runs client-side.
 */

/** Translate structured backend error codes to Polish UI messages. */
function translateError(code: ErrorCode | undefined, raw: string, ticker?: string): string {
  switch (code) {
    case 'TICKER_NOT_FOUND':
      return `Nie znaleziono tickera: ${ticker ?? ''}`;
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
  const url = `/api/market-data?ticker=${encodeURIComponent(ticker)}`;

  const res = await fetchWithTimeout(url, signal);

  const body = await res.json().catch(() => null) as (ProxyResponse & ProxyErrorResponse) | null;

  if (!res.ok || body?.error) {
    throw new Error(translateError(body?.code, body?.error ?? `HTTP ${res.status}`, ticker));
  }

  return body!;
}

