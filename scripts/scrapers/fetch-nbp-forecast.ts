/**
 * NBP Inflation Forecast loader — applies the manually curated seed file
 * (data/nbp-inflation-forecast.sql) to FINANCE_DB D1.
 *
 * NBP publishes projections 3x/year (Mar, Jul, Nov) as PDF reports.
 * A human reads the report, updates the seed file, and commits.
 * This script applies the seed to D1 via CI (idempotent — safe to re-run).
 *
 * Env vars: CF_API_TOKEN, CF_ACCOUNT_ID, CF_D1_DATABASE_ID
 */

import { appendFileSync, readFileSync } from 'fs';
import { resolve } from 'path';

const SEED_SQL_PATH = resolve(process.cwd(), 'data/nbp-inflation-forecast.sql');

interface D1QueryResponse {
  success?: boolean;
  errors?: Array<{ message?: string }>;
  result?: Array<{
    success?: boolean;
    meta?: { changes?: number };
  }>;
}

function loadSeedStatements(): string[] {
  const sql = readFileSync(SEED_SQL_PATH, 'utf-8');

  return sql
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('--'))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

async function executeStatements(
  statements: string[],
): Promise<{ executed: number; changedRows: number }> {
  const { CF_API_TOKEN, CF_ACCOUNT_ID, CF_D1_DATABASE_ID } = process.env;
  if (!CF_API_TOKEN || !CF_ACCOUNT_ID || !CF_D1_DATABASE_ID) {
    throw new Error('Missing required env vars: CF_API_TOKEN, CF_ACCOUNT_ID, CF_D1_DATABASE_ID');
  }

  const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_D1_DATABASE_ID}/query`;
  let executed = 0;
  let changedRows = 0;

  for (const statement of statements) {
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql: statement }),
    });

    if (!res.ok) {
      throw new Error(`D1 query failed with HTTP ${res.status}: ${await res.text()}`);
    }

    const result = (await res.json()) as D1QueryResponse;
    if (result.success === false) {
      const details = result.errors?.map((error) => error.message).filter(Boolean).join('; ');
      throw new Error(details || 'Cloudflare D1 returned an unsuccessful response');
    }

    const queryResult = result.result?.[0];
    if (queryResult?.success === false) {
      throw new Error('Cloudflare D1 reported a failed SQL statement');
    }

    executed++;
    changedRows += queryResult?.meta?.changes ?? 0;
  }

  return { executed, changedRows };
}

async function writeSummary(content: string): Promise<void> {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    appendFileSync(summaryPath, content + '\n');
  } else {
    console.log(content);
  }
}

async function main(): Promise<void> {
  try {
    console.log('Loading NBP forecast seed file...');
    const statements = loadSeedStatements();

    if (statements.length === 0) {
      throw new Error(`No SQL statements found in ${SEED_SQL_PATH}`);
    }

    console.log(`Applying ${statements.length} SQL statement(s) to D1...`);
    const { executed, changedRows } = await executeStatements(statements);

    await writeSummary([
      '## 📈 NBP Forecast Seed Results',
      '',
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Seed file | data/nbp-inflation-forecast.sql |`,
      `| Statements executed | ${executed} |`,
      `| Rows upserted | ${changedRows} |`,
    ].join('\n'));

    console.log('Done.');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await writeSummary(`## ❌ NBP Forecast Seed Failed\n\n${message}`);
    console.error(message);
    process.exit(1);
  }
}

main();
