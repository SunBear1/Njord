import type { AnalyzeResponse } from '../types/analyze';

/**
 * Calls the Cloudflare Pages Function at /api/analyze which fetches stock data
 * from Twelve Data server-side (API key never exposed to the browser) and runs
 * the full HMM/GARCH/Bootstrap analysis pipeline.
 */
export async function fetchAssetData(
  ticker: string,
  horizonMonths: number,
  signal?: AbortSignal,
): Promise<AnalyzeResponse> {
  const url = `/api/analyze?ticker=${encodeURIComponent(ticker)}&horizonMonths=${horizonMonths}`;

  const res = await fetch(url, { signal });

  if (res.status === 429) throw new Error('RATE_LIMIT');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json() as AnalyzeResponse & { error?: string };

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

