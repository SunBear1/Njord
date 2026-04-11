import type { ProxyResponse } from '../types/analyze';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

/**
 * Calls the Cloudflare Pages Function at /api/analyze which fetches stock data
 * from Twelve Data and FX rates from NBP server-side (API key never exposed to
 * the browser).  All heavy computation runs client-side.
 */

/** Translate English backend errors to Polish for the UI. */
function translateError(msg: string): string {
  if (msg === 'RATE_LIMIT') return 'Przekroczono limit zapytań API. Spróbuj ponownie za minutę.';
  if (msg.startsWith('Ticker not found')) return msg.replace('Ticker not found', 'Nie znaleziono tickera');
  if (msg.startsWith('No data found for ticker')) return msg.replace('No data found for ticker', 'Nie znaleziono danych dla');
  if (msg.startsWith('No market price for')) return msg.replace('No market price for', 'Brak ceny rynkowej dla');
  if (msg.includes('Invalid Twelve Data API key')) return 'Nieprawidłowy klucz API.';
  if (msg.includes('Failed to fetch USD/PLN')) return 'Błąd pobierania kursu USD/PLN z NBP.';
  if (msg.includes('Missing required parameter')) return 'Brak wymaganego parametru ticker.';
  return msg;
}

export async function fetchAssetData(
  ticker: string,
  signal?: AbortSignal,
): Promise<ProxyResponse> {
  const url = `/api/analyze?ticker=${encodeURIComponent(ticker)}`;

  const res = await fetchWithTimeout(url, signal);

  if (res.status === 429) throw new Error(translateError('RATE_LIMIT'));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json() as ProxyResponse & { error?: string };

  if (data.error) {
    throw new Error(translateError(data.error));
  }

  return data;
}

