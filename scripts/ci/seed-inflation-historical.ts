/**
 * seed-inflation-historical — retrieves Polish CPI YoY data from the GUS direct
 * JSON download and inserts new rows into the FINANCE_DB.inflation_historical D1 table.
 *
 * Idempotent: INSERT OR IGNORE — existing (year, month) rows are skipped.
 * Intended to run as a GitHub Actions scheduled job (not on CSV push).
 *
 * Env vars: CF_API_TOKEN, CF_ACCOUNT_ID, CF_D1_DATABASE_ID
 */

const GUS_CPI_URL =
  'https://stat.gov.pl/download/gfx/portalinformacyjny/pl/wykresy/1/inflacja.json';

const POLISH_MONTHS: Record<string, number> = {
  Styczeń: 1,
  Luty: 2,
  Marzec: 3,
  Kwiecień: 4,
  Maj: 5,
  Czerwiec: 6,
  Lipiec: 7,
  Sierpień: 8,
  Wrzesień: 9,
  Październik: 10,
  Listopad: 11,
  Grudzień: 12,
};

interface CpiRecord {
  year: number;
  month: number;
  cpi_yoy_pct: number;
}

interface GusCpiPayload {
  data?: Record<string, Record<string, string | null | undefined> | undefined>;
}

async function fetchLatestCpi(): Promise<CpiRecord[]> {
  const res = await fetch(GUS_CPI_URL, {
    headers: { 'User-Agent': 'Njord-Scraper/1.0', Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`GUS API returned HTTP ${res.status}`);
  }

  const payload = (await res.json()) as GusCpiPayload;
  const records: CpiRecord[] = [];

  for (const [monthName, yearValues] of Object.entries(payload.data ?? {})) {
    const month = POLISH_MONTHS[monthName];
    if (!month || !yearValues) continue;

    for (const [yearStr, value] of Object.entries(yearValues)) {
      if (value == null || value.trim() === '') continue;

      const year = Number.parseInt(yearStr, 10);
      const cpiYoy = Number.parseFloat(value.replace(',', '.'));

      if (Number.isNaN(year) || Number.isNaN(cpiYoy)) continue;

      records.push({ year, month, cpi_yoy_pct: cpiYoy });
    }
  }

  return records.sort((a, b) => a.year - b.year || a.month - b.month);
}

async function insertToD1(
  records: CpiRecord[],
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
