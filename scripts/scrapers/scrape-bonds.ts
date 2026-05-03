/**
 * Bond scraper — loads stable bond parameters from the curated CSV file,
 * scrapes current first-year rates from obligacjeskarbowe.pl, merges both
 * datasets, and upserts the result into FINANCE_DB D1 via the Cloudflare
 * REST API.
 *
 * Intended to run as a GitHub Actions cron job.
 * Env vars required: CF_API_TOKEN, CF_ACCOUNT_ID, CF_D1_DATABASE_ID
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const BONDS_URL = 'https://www.obligacjeskarbowe.pl/oferta/';
const EXPECTED_BOND_TYPES = 8;

interface BondRow {
  id: string;
  name_pl: string;
  maturity_months: number;
  rate_type: string;
  first_year_rate_pct: number | null;
  margin_pct: number | null;
  coupon_frequency: number;
  early_redemption_allowed: number;
  early_redemption_penalty_pct: number | null;
  is_family: number;
}

interface ScrapedBondRate {
  id: string;
  seriesCode: string | null;
  firstYearRatePct: number | null;
  source: 'scraped' | 'csv';
}

function loadBondsFromCsv(): BondRow[] {
  const csvPath = resolve(process.cwd(), 'data/polish_treasury_bonds.csv');
  const raw = readFileSync(csvPath, 'utf-8');
  const lines = raw.trim().split('\n');
  const headers = lines[0].split(',');

  return lines.slice(1).map((line) => {
    const values = line.split(',');
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index];
    });

    return {
      id: row.id,
      name_pl: row.name_pl,
      maturity_months: Number.parseInt(row.maturity_months, 10),
      rate_type: row.rate_type,
      first_year_rate_pct: row.first_year_rate_pct ? Number.parseFloat(row.first_year_rate_pct) : null,
      margin_pct: row.margin_pct ? Number.parseFloat(row.margin_pct) : null,
      coupon_frequency: Number.parseInt(row.coupon_frequency, 10),
      early_redemption_allowed: row.early_redemption_allowed === 'true' ? 1 : 0,
      early_redemption_penalty_pct: row.early_redemption_penalty_pct ? Number.parseFloat(row.early_redemption_penalty_pct) : null,
      is_family: row.is_family === 'true' ? 1 : 0,
    };
  });
}

async function scrapeLiveRates(): Promise<Map<string, ScrapedBondRate>> {
  const response = await fetch(BONDS_URL, {
    headers: {
      'User-Agent': 'Njord-Scraper/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${BONDS_URL}: HTTP ${response.status}`);
  }

  const html = await response.text();
  const seriesMatches = [...html.matchAll(/Seria:<\/strong>\s*([A-Z]{3}\d{4})/g)].map((match) => match[1]);
  const rateMatches = [...html.matchAll(/<h2 class="product-box__value">[\s\S]*?(\d+,\d+)<sub>%<\/sub>[\s\S]*?<\/h2>/g)].map((match) => match[1]);
  const pairCount = Math.min(seriesMatches.length, rateMatches.length);
  const scrapedRates = new Map<string, ScrapedBondRate>();

  if (seriesMatches.length !== rateMatches.length) {
    console.warn(`Warning: found ${seriesMatches.length} series codes but ${rateMatches.length} rate values; pairing ${pairCount}.`);
  }

  for (let index = 0; index < pairCount; index += 1) {
    const seriesCode = seriesMatches[index];
    const id = seriesCode.slice(0, 3);

    if (scrapedRates.has(id)) {
      continue;
    }

    scrapedRates.set(id, {
      id,
      seriesCode,
      firstYearRatePct: Number.parseFloat(rateMatches[index].replace(',', '.')),
      source: 'scraped',
    });
  }

  return scrapedRates;
}

function mergeBonds(bonds: BondRow[], scrapedRates: Map<string, ScrapedBondRate>): {
  mergedBonds: BondRow[];
  summaryRows: ScrapedBondRate[];
} {
  const summaryRows = bonds.map((bond) => {
    const scrapedRate = scrapedRates.get(bond.id);

    return {
      id: bond.id,
      seriesCode: scrapedRate?.seriesCode ?? null,
      firstYearRatePct: scrapedRate?.firstYearRatePct ?? bond.first_year_rate_pct,
      source: scrapedRate ? 'scraped' : 'csv',
    } satisfies ScrapedBondRate;
  });

  const mergedBonds = bonds.map((bond, index) => ({
    ...bond,
    first_year_rate_pct: summaryRows[index].firstYearRatePct,
  }));

  return { mergedBonds, summaryRows };
}

async function upsertToD1(bonds: BondRow[]): Promise<{ inserted: number; updated: number }> {
  const { CF_API_TOKEN, CF_ACCOUNT_ID, CF_D1_DATABASE_ID } = process.env;
  if (!CF_API_TOKEN || !CF_ACCOUNT_ID || !CF_D1_DATABASE_ID) {
    throw new Error('Missing required env vars: CF_API_TOKEN, CF_ACCOUNT_ID, CF_D1_DATABASE_ID');
  }

  const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_D1_DATABASE_ID}/query`;

  let inserted = 0;
  let updated = 0;

  for (const bond of bonds) {
    const sql = `INSERT OR REPLACE INTO bonds (id, name_pl, maturity_months, rate_type, first_year_rate_pct, margin_pct, coupon_frequency, early_redemption_allowed, early_redemption_penalty_pct, is_family, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`;

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql,
        params: [
          bond.id,
          bond.name_pl,
          bond.maturity_months,
          bond.rate_type,
          bond.first_year_rate_pct,
          bond.margin_pct,
          bond.coupon_frequency,
          bond.early_redemption_allowed,
          bond.early_redemption_penalty_pct,
          bond.is_family,
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`Failed to upsert ${bond.id}: ${err}`);
      continue;
    }

    const result = (await res.json()) as { result: Array<{ meta: { changes: number } }> };
    if (result.result[0]?.meta.changes > 0) {
      updated += 1;
    } else {
      inserted += 1;
    }
  }

  return { inserted, updated };
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
    console.log('Loading bond data from CSV...');
    const bonds = loadBondsFromCsv();
    console.log(`Found ${bonds.length} bonds in CSV`);

    if (bonds.length === 0) {
      await writeSummary('⚠️ No bonds found in CSV — file may be empty or malformed.');
      process.exit(1);
    }

    let scrapedRates = new Map<string, ScrapedBondRate>();
    let scrapeWarning: string | null = null;

    try {
      console.log(`Scraping current bond rates from ${BONDS_URL}...`);
      scrapedRates = await scrapeLiveRates();
      console.log(`Found ${scrapedRates.size} unique bond types from live page`);

      if (scrapedRates.size < EXPECTED_BOND_TYPES) {
        scrapeWarning = `⚠️ Only found ${scrapedRates.size} unique bond types on ${BONDS_URL}; using CSV fallback for missing rates.`;
        console.warn(scrapeWarning);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      scrapeWarning = `⚠️ Failed to scrape live rates (${message}); using CSV fallback for all rates.`;
      console.warn(scrapeWarning);
    }

    const { mergedBonds, summaryRows } = mergeBonds(bonds, scrapedRates);
    const { inserted, updated } = await upsertToD1(mergedBonds);

    const summary = [
      '## 🏦 Bond Scraper Results',
      '',
      '| Metric | Count |',
      '|--------|-------|',
      `| Bonds in CSV | ${bonds.length} |`,
      `| Unique live rates | ${scrapedRates.size} |`,
      `| Inserted | ${inserted} |`,
      `| Updated | ${updated} |`,
      ...(scrapeWarning ? ['', scrapeWarning] : []),
      '',
      '### Bonds',
      '',
      '| ID | Series | Rate Type | First Year Rate | Rate Source | Margin |',
      '|----|--------|-----------|-----------------|-------------|--------|',
      ...mergedBonds.map((bond, index) => {
        const summaryRow = summaryRows[index];
        return `| ${bond.id} | ${summaryRow.seriesCode ?? '-'} | ${bond.rate_type} | ${bond.first_year_rate_pct ?? '-'}% | ${summaryRow.source} | ${bond.margin_pct ?? '-'}% |`;
      }),
    ].join('\n');

    await writeSummary(summary);
    console.log('Done.');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await writeSummary(`## ❌ Bond Scraper Failed\n\n${message}`);
    console.error(message);
    process.exit(1);
  }
}

main();
