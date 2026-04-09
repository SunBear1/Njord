import type { ProxyResponse } from '../types/analyze';

/**
 * Calls the Cloudflare Pages Function at /api/analyze which fetches stock data
 * from Twelve Data and FX rates from NBP server-side (API key never exposed to
 * the browser).  All heavy computation runs client-side.
 */
export async function fetchAssetData(
  ticker: string,
  signal?: AbortSignal,
): Promise<ProxyResponse> {
  const url = `/api/analyze?ticker=${encodeURIComponent(ticker)}`;

  const res = await fetch(url, { signal });

  if (res.status === 429) throw new Error('RATE_LIMIT');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json() as ProxyResponse & { error?: string };

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

