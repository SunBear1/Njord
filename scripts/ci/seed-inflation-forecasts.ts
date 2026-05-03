/**
 * seed-inflation-forecasts — reads data/nbp-inflation-forecast.csv
 * and inserts new rows into the FINANCE_DB.inflation_forecasts D1 table.
 *
 * Flow:
 *   1. Calendar workflow (nbp-forecast-reminder.yaml) creates a GitHub Issue
 *      on the 12th of Mar/Jul/Nov reminding the user to update the CSV.
 *   2. User edits data/nbp-inflation-forecast.csv with new report data and pushes.
 *   3. update-finance-db workflow runs this script → new rows inserted to D1.
 *
 * Idempotent: INSERT OR IGNORE — existing (report_date, year, quarter) rows are skipped.
 * Env vars: CF_API_TOKEN, CF_ACCOUNT_ID, CF_D1_DATABASE_ID
 */

import { appendFileSync, readFileSync } from 'fs';
import { resolve } from 'path';

const CSV_PATH = resolve(process.cwd(), 'data/nbp-inflation-forecast.csv');

interface D1QueryResponse {
  success?: boolean;
  errors?: Array<{ message?: string }>;
  result?: Array<{
    success?: boolean;
    meta?: { changes?: number };
  }>;
}

interface ForecastRow {
  report_date: string;
  forecast_year: number;
  forecast_quarter: number;
  central_path_pct: number;
  lower_50_pct: number;
  upper_50_pct: number;
  lower_90_pct: number;
  upper_90_pct: number;
}

function loadCsvRows(): ForecastRow[] {
  const raw = readFileSync(CSV_PATH, 'utf-8');
  const lines = raw.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV file is empty or has no data rows');
  }

  const headers = lines[0].split(',').map((h) => h.trim());
  const expectedHeaders = [
    'report_date', 'forecast_year', 'forecast_quarter',
    'central_path_pct', 'lower_50_pct', 'upper_50_pct', 'lower_90_pct', 'upper_90_pct',
  ];
  for (const h of expectedHeaders) {
    if (!headers.includes(h)) {
      throw new Error(`Missing required CSV column: ${h}`);
    }
  }

  return lines.slice(1).filter((line) => line.trim().length > 0).map((line) => {
    const values = line.split(',').map((v) => v.trim());
    return {
      report_date: values[headers.indexOf('report_date')],
      forecast_year: Number(values[headers.indexOf('forecast_year')]),
      forecast_quarter: Number(values[headers.indexOf('forecast_quarter')]),
      central_path_pct: Number(values[headers.indexOf('central_path_pct')]),
      lower_50_pct: Number(values[headers.indexOf('lower_50_pct')]),
      upper_50_pct: Number(values[headers.indexOf('upper_50_pct')]),
      lower_90_pct: Number(values[headers.indexOf('lower_90_pct')]),
      upper_90_pct: Number(values[headers.indexOf('upper_90_pct')]),
    };
  });
}

function buildUpsertStatements(rows: ForecastRow[]): string[] {
  return rows.map((row) =>
    `INSERT OR IGNORE INTO inflation_forecasts ` +
    `(report_date, forecast_year, forecast_quarter, central_path_pct, lower_50_pct, upper_50_pct, lower_90_pct, upper_90_pct) ` +
    `VALUES ('${row.report_date}', ${row.forecast_year}, ${row.forecast_quarter}, ` +
    `${row.central_path_pct}, ${row.lower_50_pct}, ${row.upper_50_pct}, ${row.lower_90_pct}, ${row.upper_90_pct})`,
  );
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
    console.log('Loading NBP forecast CSV...');
    const rows = loadCsvRows();

    if (rows.length === 0) {
      throw new Error(`No data rows found in ${CSV_PATH}`);
    }

    const statements = buildUpsertStatements(rows);
    console.log(`Upserting ${rows.length} forecast row(s) to D1...`);
    const { executed, changedRows } = await executeStatements(statements);

    await writeSummary([
      '## 📈 NBP Forecast Upload Results',
      '',
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Source file | data/nbp-inflation-forecast.csv |`,
      `| CSV rows | ${rows.length} |`,
      `| Statements executed | ${executed} |`,
      `| Rows inserted | ${changedRows} |`,
      `| Rows skipped (existing) | ${rows.length - changedRows} |`,
    ].join('\n'));

    console.log('Done.');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await writeSummary(`## ❌ NBP Forecast Upload Failed\n\n${message}`);
    console.error(message);
    process.exit(1);
  }
}

main();
