CREATE TABLE IF NOT EXISTS bonds (
  id                          TEXT PRIMARY KEY,
  name_pl                     TEXT NOT NULL,
  maturity_months             INTEGER NOT NULL,
  rate_type                   TEXT NOT NULL,
  first_year_rate_pct         REAL,
  margin_pct                  REAL,
  coupon_frequency            INTEGER NOT NULL,
  early_redemption_allowed    INTEGER NOT NULL DEFAULT 1,
  early_redemption_penalty_pct REAL,
  is_family                   INTEGER NOT NULL DEFAULT 0,
  updated_at                  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inflation_historical (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  year            INTEGER NOT NULL,
  month           INTEGER NOT NULL,
  cpi_yoy_pct     REAL NOT NULL,
  cpi_mom_pct     REAL,
  core_cpi_yoy_pct REAL,
  source          TEXT NOT NULL DEFAULT 'gus',
  fetched_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(year, month, source)
);

CREATE INDEX IF NOT EXISTS idx_inflation_date
  ON inflation_historical(year, month);

CREATE TABLE IF NOT EXISTS inflation_forecasts (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  report_date       TEXT NOT NULL,
  forecast_year     INTEGER NOT NULL,
  forecast_quarter  INTEGER NOT NULL,
  central_path_pct  REAL NOT NULL,
  lower_50_pct      REAL,
  upper_50_pct      REAL,
  lower_90_pct      REAL,
  upper_90_pct      REAL,
  fetched_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(report_date, forecast_year, forecast_quarter)
);

CREATE INDEX IF NOT EXISTS idx_forecast_report
  ON inflation_forecasts(report_date);
