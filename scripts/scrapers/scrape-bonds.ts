/**
 * Bond scraper — fetches current bond parameters from obligacjeskarbowe.pl
 * and upserts them into the FINANCE_DB D1 database via Cloudflare REST API.
 *
 * Intended to run as a GitHub Actions cron job.
 * Env vars required: CF_API_TOKEN, CF_ACCOUNT_ID, CF_D1_DATABASE_ID
 */

const BONDS_URL = 'https://www.obligacjeskarbowe.pl/oferta-obligacji/';

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

// Known bond type configurations — used to map scraped data
const BOND_CONFIG: Record<string, Partial<BondRow>> = {
  OTS: { maturity_months: 3, rate_type: 'fixed', coupon_frequency: 1, early_redemption_allowed: 0 },
  DOS: { maturity_months: 24, rate_type: 'fixed', coupon_frequency: 1, early_redemption_allowed: 1 },
  TOS: { maturity_months: 36, rate_type: 'floating_wibor', coupon_frequency: 2, early_redemption_allowed: 1 },
  COI: { maturity_months: 48, rate_type: 'inflation_indexed', coupon_frequency: 1, early_redemption_allowed: 1 },
  EDO: { maturity_months: 120, rate_type: 'inflation_indexed', coupon_frequency: 1, early_redemption_allowed: 1 },
  ROR: { maturity_months: 12, rate_type: 'floating_reference', coupon_frequency: 12, early_redemption_allowed: 1 },
  DOR: { maturity_months: 24, rate_type: 'floating_reference', coupon_frequency: 12, early_redemption_allowed: 1 },
  ROS: { maturity_months: 72, rate_type: 'inflation_indexed', coupon_frequency: 1, early_redemption_allowed: 1, is_family: 1 },
  ROD: { maturity_months: 144, rate_type: 'inflation_indexed', coupon_frequency: 1, early_redemption_allowed: 1, is_family: 1 },
};

async function scrape(): Promise<BondRow[]> {
  const res = await fetch(BONDS_URL, {
    headers: { 'User-Agent': 'Njord-Scraper/1.0' },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch obligacjeskarbowe.pl: HTTP ${res.status}`);
  }

  const html = await res.text();
  const bonds: BondRow[] = [];

  // Parse bond offers from HTML — match patterns like "OTS0325" with rate info
  for (const [prefix, config] of Object.entries(BOND_CONFIG)) {
    // Match bond IDs like OTS0325, COI0428, EDO0135
    const idPattern = new RegExp(`(${prefix}\\d{4})`, 'g');
    const ids = [...new Set([...html.matchAll(idPattern)].map((m) => m[1]))];

    // Extract rate from context around the bond mentions
    const ratePattern = new RegExp(`${prefix}[^]*?(\\d+[.,]\\d+)\\s*%`, 'i');
    const rateMatch = html.match(ratePattern);
    const rate = rateMatch ? parseFloat(rateMatch[1].replace(',', '.')) : null;

    for (const id of ids) {
      bonds.push({
        id,
        name_pl: `Obligacje ${prefix} (${config.maturity_months}M)`,
        maturity_months: config.maturity_months!,
        rate_type: config.rate_type!,
        first_year_rate_pct: config.rate_type === 'fixed' || config.rate_type === 'inflation_indexed' ? rate : null,
        margin_pct: config.rate_type === 'inflation_indexed' ? rate : null,
        coupon_frequency: config.coupon_frequency!,
        early_redemption_allowed: config.early_redemption_allowed ?? 1,
        early_redemption_penalty_pct: config.early_redemption_allowed === 1 ? 0.7 : null,
        is_family: config.is_family ?? 0,
      });
    }
  }

  return bonds;
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
          bond.id, bond.name_pl, bond.maturity_months, bond.rate_type,
          bond.first_year_rate_pct, bond.margin_pct, bond.coupon_frequency,
          bond.early_redemption_allowed, bond.early_redemption_penalty_pct, bond.is_family,
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`Failed to upsert ${bond.id}: ${err}`);
      continue;
    }

    const result = await res.json() as { result: Array<{ meta: { changes: number } }> };
    if (result.result[0]?.meta.changes > 0) {
      updated++;
    } else {
      inserted++;
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
    console.log('Scraping bond data from obligacjeskarbowe.pl...');
    const bonds = await scrape();
    console.log(`Found ${bonds.length} bonds`);

    if (bonds.length === 0) {
      await writeSummary('⚠️ No bonds found during scrape — page structure may have changed.');
      process.exit(1);
    }

    const { inserted, updated } = await upsertToD1(bonds);

    const summary = [
      '## 🏦 Bond Scraper Results',
      '',
      `| Metric | Count |`,
      `|--------|-------|`,
      `| Bonds found | ${bonds.length} |`,
      `| Inserted | ${inserted} |`,
      `| Updated | ${updated} |`,
      '',
      '### Bonds',
      '',
      '| ID | Rate Type | First Year Rate | Margin |',
      '|----|-----------|-----------------|--------|',
      ...bonds.map((b) => `| ${b.id} | ${b.rate_type} | ${b.first_year_rate_pct ?? '-'}% | ${b.margin_pct ?? '-'}% |`),
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
