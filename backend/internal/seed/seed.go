// Package seed bundles static CSV fixtures (bond presets, NBP inflation
// forecasts) into the binary and idempotently upserts them into Postgres on
// startup.
//
// We intentionally do NOT bring inflation_historical here — that table is
// populated lazily on first request from the live GUS endpoint and cached via
// internal/cache.
package seed

import (
	"context"
	"embed"
	"encoding/csv"
	"fmt"
	"io"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed data/bonds.csv data/inflation_forecasts.csv
var fixtures embed.FS

// Apply creates the finance tables (if missing) and seeds them from the
// embedded CSV fixtures. Safe to call repeatedly.
func Apply(ctx context.Context, pool *pgxpool.Pool) error {
	if err := createSchema(ctx, pool); err != nil {
		return err
	}
	if err := seedBonds(ctx, pool); err != nil {
		return fmt.Errorf("seed bonds: %w", err)
	}
	if err := seedInflationForecasts(ctx, pool); err != nil {
		return fmt.Errorf("seed inflation_forecasts: %w", err)
	}
	return nil
}

const schemaDDL = `
CREATE TABLE IF NOT EXISTS bonds (
    id                            TEXT        PRIMARY KEY,
    name_pl                       TEXT        NOT NULL,
    maturity_months               INTEGER     NOT NULL,
    rate_type                     TEXT        NOT NULL,
    first_year_rate_pct           DOUBLE PRECISION,
    margin_pct                    DOUBLE PRECISION,
    coupon_frequency              INTEGER     NOT NULL,
    early_redemption_allowed      BOOLEAN     NOT NULL DEFAULT TRUE,
    early_redemption_penalty_pct  DOUBLE PRECISION,
    is_family                     BOOLEAN     NOT NULL DEFAULT FALSE,
    updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inflation_historical (
    year             INTEGER          NOT NULL,
    month            INTEGER          NOT NULL,
    cpi_yoy_pct      DOUBLE PRECISION NOT NULL,
    cpi_mom_pct      DOUBLE PRECISION,
    core_cpi_yoy_pct DOUBLE PRECISION,
    source           TEXT             NOT NULL DEFAULT 'gus',
    fetched_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    PRIMARY KEY (year, month, source)
);
CREATE INDEX IF NOT EXISTS idx_inflation_date ON inflation_historical (year, month);

CREATE TABLE IF NOT EXISTS inflation_forecasts (
    report_date      TEXT             NOT NULL,
    forecast_year    INTEGER          NOT NULL,
    forecast_quarter INTEGER          NOT NULL,
    central_path_pct DOUBLE PRECISION NOT NULL,
    lower_50_pct     DOUBLE PRECISION,
    upper_50_pct     DOUBLE PRECISION,
    lower_90_pct     DOUBLE PRECISION,
    upper_90_pct     DOUBLE PRECISION,
    fetched_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    PRIMARY KEY (report_date, forecast_year, forecast_quarter)
);
CREATE INDEX IF NOT EXISTS idx_forecast_report ON inflation_forecasts (report_date);
`

func createSchema(ctx context.Context, pool *pgxpool.Pool) error {
	if _, err := pool.Exec(ctx, schemaDDL); err != nil {
		return fmt.Errorf("create finance schema: %w", err)
	}
	return nil
}

func seedBonds(ctx context.Context, pool *pgxpool.Pool) error {
	rows, err := readCSV("data/bonds.csv")
	if err != nil {
		return err
	}
	for _, row := range rows {
		_, err := pool.Exec(ctx, `
INSERT INTO bonds (
    id, name_pl, maturity_months, rate_type, first_year_rate_pct,
    margin_pct, coupon_frequency, early_redemption_allowed,
    early_redemption_penalty_pct, is_family
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
ON CONFLICT (id) DO UPDATE SET
    name_pl = EXCLUDED.name_pl,
    maturity_months = EXCLUDED.maturity_months,
    rate_type = EXCLUDED.rate_type,
    first_year_rate_pct = EXCLUDED.first_year_rate_pct,
    margin_pct = EXCLUDED.margin_pct,
    coupon_frequency = EXCLUDED.coupon_frequency,
    early_redemption_allowed = EXCLUDED.early_redemption_allowed,
    early_redemption_penalty_pct = EXCLUDED.early_redemption_penalty_pct,
    is_family = EXCLUDED.is_family,
    updated_at = NOW()
`,
			row["id"],
			row["name_pl"],
			mustInt(row["maturity_months"]),
			row["rate_type"],
			mustFloatPtr(row["first_year_rate_pct"]),
			mustFloatPtr(row["margin_pct"]),
			mustInt(row["coupon_frequency"]),
			mustBool(row["early_redemption_allowed"]),
			mustFloatPtr(row["early_redemption_penalty_pct"]),
			mustBool(row["is_family"]),
		)
		if err != nil {
			return fmt.Errorf("upsert bond %s: %w", row["id"], err)
		}
	}
	return nil
}

func seedInflationForecasts(ctx context.Context, pool *pgxpool.Pool) error {
	rows, err := readCSV("data/inflation_forecasts.csv")
	if err != nil {
		return err
	}
	for _, row := range rows {
		_, err := pool.Exec(ctx, `
INSERT INTO inflation_forecasts (
    report_date, forecast_year, forecast_quarter, central_path_pct,
    lower_50_pct, upper_50_pct, lower_90_pct, upper_90_pct
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (report_date, forecast_year, forecast_quarter) DO UPDATE SET
    central_path_pct = EXCLUDED.central_path_pct,
    lower_50_pct = EXCLUDED.lower_50_pct,
    upper_50_pct = EXCLUDED.upper_50_pct,
    lower_90_pct = EXCLUDED.lower_90_pct,
    upper_90_pct = EXCLUDED.upper_90_pct,
    fetched_at = NOW()
`,
			row["report_date"],
			mustInt(row["forecast_year"]),
			mustInt(row["forecast_quarter"]),
			mustFloat(row["central_path_pct"]),
			mustFloatPtr(row["lower_50_pct"]),
			mustFloatPtr(row["upper_50_pct"]),
			mustFloatPtr(row["lower_90_pct"]),
			mustFloatPtr(row["upper_90_pct"]),
		)
		if err != nil {
			return fmt.Errorf("upsert forecast %s/%s/%s: %w", row["report_date"], row["forecast_year"], row["forecast_quarter"], err)
		}
	}
	return nil
}

func readCSV(path string) ([]map[string]string, error) {
	f, err := fixtures.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open %s: %w", path, err)
	}
	defer f.Close()

	r := csv.NewReader(f)
	header, err := r.Read()
	if err != nil {
		return nil, fmt.Errorf("read header %s: %w", path, err)
	}

	var out []map[string]string
	for {
		rec, err := r.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("read row %s: %w", path, err)
		}
		m := make(map[string]string, len(header))
		for i, h := range header {
			m[h] = rec[i]
		}
		out = append(out, m)
	}
	return out, nil
}

func mustInt(s string) int {
	n, _ := strconv.Atoi(strings.TrimSpace(s))
	return n
}

func mustFloat(s string) float64 {
	f, _ := strconv.ParseFloat(strings.TrimSpace(s), 64)
	return f
}

func mustFloatPtr(s string) *float64 {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return nil
	}
	return &f
}

func mustBool(s string) bool {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "true", "1", "yes":
		return true
	}
	return false
}
