import type { Bond, InflationDataPoint, InflationForecast, Env } from './types';

export function getFinanceDb(env: Env): D1Database {
  return env.FINANCE_DB;
}

export async function queryBonds(
  db: D1Database,
  filters?: { type?: string; is_family?: boolean },
): Promise<Bond[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.type) {
    conditions.push('id LIKE ?');
    params.push(`${filters.type}%`);
  }
  if (filters?.is_family !== undefined) {
    conditions.push('is_family = ?');
    params.push(filters.is_family ? 1 : 0);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT * FROM bonds ${where} ORDER BY id`;

  const result = await db.prepare(sql).bind(...params).all<Record<string, unknown>>();

  return result.results.map((row) => ({
    id: row.id as string,
    name_pl: row.name_pl as string,
    maturity_months: row.maturity_months as number,
    rate_type: row.rate_type as string,
    first_year_rate_pct: row.first_year_rate_pct as number | null,
    margin_pct: row.margin_pct as number | null,
    coupon_frequency: row.coupon_frequency as number,
    early_redemption_allowed: (row.early_redemption_allowed as number) === 1,
    early_redemption_penalty_pct: row.early_redemption_penalty_pct as number | null,
    is_family: (row.is_family as number) === 1,
    updated_at: row.updated_at as string,
  }));
}

export async function queryInflation(
  db: D1Database,
  from?: string,
  to?: string,
): Promise<InflationDataPoint[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (from) {
    const [year, month] = from.split('-').map(Number);
    conditions.push('(year * 100 + month) >= ?');
    params.push(year * 100 + month);
  }
  if (to) {
    const [year, month] = to.split('-').map(Number);
    conditions.push('(year * 100 + month) <= ?');
    params.push(year * 100 + month);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT year, month, cpi_yoy_pct, cpi_mom_pct, core_cpi_yoy_pct FROM inflation_historical ${where} ORDER BY year, month`;

  const result = await db.prepare(sql).bind(...params).all<InflationDataPoint>();
  return result.results;
}

export async function queryForecasts(
  db: D1Database,
  report?: string,
): Promise<InflationForecast[]> {
  let sql: string;
  const params: unknown[] = [];

  if (report) {
    sql = `SELECT report_date, forecast_year, forecast_quarter, central_path_pct, lower_50_pct, upper_50_pct, lower_90_pct, upper_90_pct FROM inflation_forecasts WHERE report_date = ? ORDER BY forecast_year, forecast_quarter`;
    params.push(report);
  } else {
    sql = `SELECT report_date, forecast_year, forecast_quarter, central_path_pct, lower_50_pct, upper_50_pct, lower_90_pct, upper_90_pct FROM inflation_forecasts WHERE report_date = (SELECT report_date FROM inflation_forecasts ORDER BY report_date DESC LIMIT 1) ORDER BY forecast_year, forecast_quarter`;
  }

  const result = await db.prepare(sql).bind(...params).all<InflationForecast>();
  return result.results;
}
