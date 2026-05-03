/**
 * Client-side types for the /api/v1/finance/* API responses.
 * Mirrors the server-side types but without Cloudflare-specific dependencies.
 */

export interface Bond {
  id: string;
  name_pl: string;
  maturity_months: number;
  rate_type: string;
  first_year_rate_pct: number | null;
  margin_pct: number | null;
  coupon_frequency: number;
  early_redemption_allowed: boolean;
  early_redemption_penalty_pct: number | null;
  is_family: boolean;
  updated_at: string;
}

export interface CurrencyRate {
  source: string;
  pair: string;
  bid: number;
  ask: number;
  mid?: number;
  timestamp: string;
}

export interface InflationDataPoint {
  year: number;
  month: number;
  cpi_yoy_pct: number;
  cpi_mom_pct?: number;
  core_cpi_yoy_pct?: number;
}

export interface InflationForecast {
  report_date: string;
  forecast_year: number;
  forecast_quarter: number;
  central_path_pct: number;
  lower_50_pct?: number;
  upper_50_pct?: number;
  lower_90_pct?: number;
  upper_90_pct?: number;
}

export interface StockBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ApiMeta {
  source: string;
  last_updated_at?: string;
  next_expected_update?: string;
}

export interface StockMeta extends ApiMeta {
  currency?: string;
  currentPrice?: number;
  name?: string;
  type?: string;
}

export interface ApiResponse<T> {
  data: T;
  _meta: ApiMeta;
}

export interface StockBarsResponse {
  data: StockBar[];
  _meta: StockMeta;
}

export interface StockSearchResult {
  symbol: string;
  shortname: string;
  exchange: string;
  quoteType: string;
}
