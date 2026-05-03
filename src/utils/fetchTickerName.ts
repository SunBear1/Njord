export async function fetchTickerName(ticker: string): Promise<string> {
  const t = ticker.trim().toUpperCase();
  if (!t) throw new Error('Brak symbolu.');

  const res = await fetch(`/api/v1/finance/stocks/search?q=${encodeURIComponent(t)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json() as { data?: Array<{ symbol: string; shortname: string }> };
  const results = data.data ?? [];
  const match = results.find((result) => result.symbol === t) ?? results[0];
  if (!match?.shortname) throw new Error(`Brak nazwy dla ${t}`);
  return match.shortname;
}
