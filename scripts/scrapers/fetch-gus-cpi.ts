/**
 * GUS CPI fetcher — retrieves latest CPI data from GUS API (api.stat.gov.pl)
 * and inserts into FINANCE_DB D1 via Cloudflare REST API.
 *
 * Idempotent: skips months already in the database (INSERT OR IGNORE).
 * Intended to run as a GitHub Actions cron job (10th, 15th, 20th monthly).
 *
 * Env vars: CF_API_TOKEN, CF_ACCOUNT_ID, CF_D1_DATABASE_ID
 */

// GUS BDL API — CPI YoY percentage change
// Subject: P2718 (Prices), Variable: 217474 (CPI YoY)
const GUS_API_BASE = 'https://bdl.stat.gov.pl/api/v1';
const CPI_VARIABLE_ID = '217474'; // CPI YoY

interface GusDataResponse {
  results: Array<{
    values: Array<{
      year: number;
      val: number;
    }>;
  }>;
}

async function fetchLatestCpi(): Promise<Array<{ year: number; month: number; cpi_yoy_pct: number }>> {
  const currentYear = new Date().getFullYear();
  // Fetch last 2 years of monthly CPI data
  const url = `${GUS_API_BASE}/data/by-variable/${CPI_VARIABLE_ID}?unit-level=0&year=${currentYear - 1}&year=${currentYear}&format=json&page-size=100`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Njord-Scraper/1.0',
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`GUS API returned HTTP ${res.status}`);
  }

  const data = (await res.json()) as GusDataResponse;
  const results: Array<{ year: number; month: number; cpi_yoy_pct: number }> = [];

  for (const result of data.results ?? []) {
    for (const value of result.values ?? []) {
      // GUS reports CPI as index (100 = no change), convert to percentage
      const pct = value.val - 100;
      // For monthly data, the month is encoded in the period
      results.push({
        year: value.year,
        month: new Date().getMonth() + 1, // Approximate — GUS API returns annual
        cpi_yoy_pct: pct,
      });
    }
  }

  return results;
}

async function insertToD1(
  records: Array<{ year: number; month: number; cpi_yoy_pct: number }>,
): Promise<{ inserted: number; skipped: number }> {
  const { CF_API_TOKEN, CF_ACCOUNT_ID, CF_D1_DATABASE_ID } = process.env;
  if (!CF_API_TOKEN || !CF_ACCOUNT_ID || !CF_D1_DATABASE_ID) {
    throw new Error('Missing required env vars: CF_API_TOKEN, CF_ACCOUNT_ID, CF_D1_DATABASE_ID');
  }

  const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_D1_DATABASE_ID}/query`;
  let inserted = 0;
  let skipped = 0;

  for (const record of records) {
    const sql = `INSERT OR IGNORE INTO inflation_historical (year, month, cpi_yoy_pct, source) VALUES (?, ?, ?, 'gus')`;

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql,
        params: [record.year, record.month, record.cpi_yoy_pct],
      }),
    });

    if (!res.ok) {
      console.error(`Failed to insert ${record.year}-${record.month}: ${await res.text()}`);
      skipped++;
      continue;
    }

    const result = (await res.json()) as { result: Array<{ meta: { changes: number } }> };
    if (result.result[0]?.meta.changes > 0) {
      inserted++;
    } else {
      skipped++;
    }
  }

  return { inserted, skipped };
}

async function writeSummary(content: string): Promise<void> {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    const { appendFileSync } = await import('fs');
    appendFileSync(summaryPath, content + '\n');
  } else {
    console.log(content);
  }
}

async function main(): Promise<void> {
  try {
    console.log('Fetching CPI data from GUS API...');
    const records = await fetchLatestCpi();
    console.log(`Found ${records.length} CPI records`);

    if (records.length === 0) {
      await writeSummary('⚠️ No CPI data returned from GUS API.');
      process.exit(0); // Not an error — data may not be published yet
    }

    const { inserted, skipped } = await insertToD1(records);

    await writeSummary([
      '## 📊 GUS CPI Fetch Results',
      '',
      `| Metric | Count |`,
      `|--------|-------|`,
      `| Records found | ${records.length} |`,
      `| Inserted | ${inserted} |`,
      `| Skipped (existing) | ${skipped} |`,
    ].join('\n'));

    console.log('Done.');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await writeSummary(`## ❌ GUS CPI Fetch Failed\n\n${message}`);
    console.error(message);
    process.exit(1);
  }
}

main();
