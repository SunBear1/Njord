/**
 * Fetches the company/fund name for a given ticker symbol via /api/analyze.
 * The backend caches responses for 1 hour, so repeated lookups are cheap.
 */
export async function fetchTickerName(ticker: string): Promise<string> {
  const t = ticker.trim().toUpperCase();
  if (!t) throw new Error('Brak symbolu.');

  const res = await fetch(`/api/analyze?ticker=${encodeURIComponent(t)}`);

  if (res.status === 404) throw new Error(`Nie znaleziono spółki: ${t}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Błąd HTTP ${res.status}`);
  }

  const data = await res.json() as { assetData?: { asset?: { name?: string } } };
  const name = data?.assetData?.asset?.name;
  if (!name) throw new Error(`Brak nazwy dla ${t}`);
  return name;
}
