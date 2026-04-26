/**
 * Pages Function: GET /api/inflation
 *
 * Proxies ECB HICP (Polish CPI) data with 24-hour edge cache.
 * Shields the browser from potential CORS/rate-limit changes on ECB's API.
 */

const ECB_URL =
  'https://data-api.ecb.europa.eu/service/data/ICP/M.PL.N.000000.4.ANR?format=csvdata&lastNObservations=1';

export const onRequestGet: PagesFunction = async () => {
  try {
    const res = await fetch(ECB_URL);
    if (!res.ok) throw new Error(`ECB HTTP ${res.status}`);

    const csv = await res.text();

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Cache-Control': 'max-age=86400', // 24 hours
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
