package finance

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/SunBear1/Njord/backend/internal/cache"
)

var (
	monthPattern    = regexp.MustCompile(`^\d{4}-\d{2}$`)
	gusCPISourceURL = "https://stat.gov.pl/download/gfx/portalinformacyjny/pl/wykresy/1/inflacja.json"
	gusCPITTL       = 24 * time.Hour
)

// InflationHandler returns GET /api/v1/finance/inflation.
//
// On the first request after startup (or whenever the GUS cache entry has
// expired) it pulls the live JSON from stat.gov.pl, normalises the CPI YoY
// percentages into inflation_historical, caches the raw upstream payload
// under provider=gus for 24h, then queries the table.
func InflationHandler(pool *pgxpool.Pool, c Cacher, httpClient *http.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		from := r.URL.Query().Get("from")
		to := r.URL.Query().Get("to")
		if from != "" && !monthPattern.MatchString(from) {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "from must be YYYY-MM format", "")
			return
		}
		if to != "" && !monthPattern.MatchString(to) {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "to must be YYYY-MM format", "")
			return
		}
		now := time.Now().UTC()
		if from == "" {
			from = fmt.Sprintf("%04d-%02d", now.Year()-1, now.Month())
		}
		if to == "" {
			to = fmt.Sprintf("%04d-%02d", now.Year(), now.Month())
		}

		ctx := r.Context()
		if err := refreshGusIfStale(ctx, pool, c, httpClient); err != nil {
			slog.Warn("inflation refresh failed", "err", err)
		}

		points, err := queryInflation(ctx, pool, from, to)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error(), "")
			return
		}
		writePayload(w, map[string]any{
			"data":  points,
			"_meta": map[string]string{"source": "gus"},
		}, "max-age=86400")
	}
}

// InflationForecastHandler returns GET /api/v1/finance/inflation/forecast.
//
// Reads from the inflation_forecasts table seeded from the embedded NBP CSV
// at startup. Optional `report` query param picks a specific report month;
// defaults to the latest known report.
func InflationForecastHandler(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		report := r.URL.Query().Get("report")
		if report != "" && !monthPattern.MatchString(report) {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "report must be YYYY-MM format", "")
			return
		}

		forecasts, err := queryForecasts(r.Context(), pool, report)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "DB_ERROR", err.Error(), "")
			return
		}
		writePayload(w, map[string]any{
			"data":  forecasts,
			"_meta": map[string]string{"source": "nbp"},
		}, "max-age=86400")
	}
}

// --- DB queries ---

type inflationDataPoint struct {
	Year          int      `json:"year"`
	Month         int      `json:"month"`
	CPIYoYPct     float64  `json:"cpi_yoy_pct"`
	CPIMoMPct     *float64 `json:"cpi_mom_pct,omitempty"`
	CoreCPIYoYPct *float64 `json:"core_cpi_yoy_pct,omitempty"`
}

type inflationForecast struct {
	ReportDate      string   `json:"report_date"`
	ForecastYear    int      `json:"forecast_year"`
	ForecastQuarter int      `json:"forecast_quarter"`
	CentralPathPct  float64  `json:"central_path_pct"`
	Lower50Pct      *float64 `json:"lower_50_pct,omitempty"`
	Upper50Pct      *float64 `json:"upper_50_pct,omitempty"`
	Lower90Pct      *float64 `json:"lower_90_pct,omitempty"`
	Upper90Pct      *float64 `json:"upper_90_pct,omitempty"`
}

func queryInflation(ctx context.Context, pool *pgxpool.Pool, from, to string) ([]inflationDataPoint, error) {
	fromKey := monthKey(from)
	toKey := monthKey(to)
	rows, err := pool.Query(ctx, `
SELECT year, month, cpi_yoy_pct, cpi_mom_pct, core_cpi_yoy_pct
  FROM inflation_historical
 WHERE (year * 100 + month) BETWEEN $1 AND $2
 ORDER BY year, month
`, fromKey, toKey)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]inflationDataPoint, 0, 16)
	for rows.Next() {
		var p inflationDataPoint
		if err := rows.Scan(&p.Year, &p.Month, &p.CPIYoYPct, &p.CPIMoMPct, &p.CoreCPIYoYPct); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func queryForecasts(ctx context.Context, pool *pgxpool.Pool, report string) ([]inflationForecast, error) {
	var (
		rows pgx.Rows
		err  error
	)
	if report != "" {
		rows, err = pool.Query(ctx, `
SELECT report_date, forecast_year, forecast_quarter, central_path_pct,
       lower_50_pct, upper_50_pct, lower_90_pct, upper_90_pct
  FROM inflation_forecasts
 WHERE report_date = $1
 ORDER BY forecast_year, forecast_quarter
`, report)
	} else {
		rows, err = pool.Query(ctx, `
SELECT report_date, forecast_year, forecast_quarter, central_path_pct,
       lower_50_pct, upper_50_pct, lower_90_pct, upper_90_pct
  FROM inflation_forecasts
 WHERE report_date = (SELECT report_date FROM inflation_forecasts
                      ORDER BY report_date DESC LIMIT 1)
 ORDER BY forecast_year, forecast_quarter
`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]inflationForecast, 0, 16)
	for rows.Next() {
		var f inflationForecast
		if err := rows.Scan(&f.ReportDate, &f.ForecastYear, &f.ForecastQuarter,
			&f.CentralPathPct, &f.Lower50Pct, &f.Upper50Pct, &f.Lower90Pct, &f.Upper90Pct); err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

func monthKey(ym string) int {
	parts := strings.Split(ym, "-")
	if len(parts) != 2 {
		return 0
	}
	y, _ := strconv.Atoi(parts[0])
	m, _ := strconv.Atoi(parts[1])
	return y*100 + m
}

// --- GUS refresh ----------------------------------------------------------

// gusCPIPayload is the shape of the live stat.gov.pl/.../inflacja.json document.
// It is intentionally lenient — extra keys are ignored.
type gusCPIPayload struct {
	Data map[string]map[string]any `json:"data"`
}

var polishMonths = map[string]int{
	"Styczeń": 1, "Luty": 2, "Marzec": 3, "Kwiecień": 4,
	"Maj": 5, "Czerwiec": 6, "Lipiec": 7, "Sierpień": 8,
	"Wrzesień": 9, "Październik": 10, "Listopad": 11, "Grudzień": 12,
}

func refreshGusIfStale(ctx context.Context, pool *pgxpool.Pool, c Cacher, httpClient *http.Client) error {
	if _, err := c.Get(ctx, "gus", "cpi_historical"); err == nil {
		return nil // fresh enough
	} else if !errors.Is(err, cache.ErrMiss) {
		return err
	}

	reqCtx, cancel := context.WithTimeout(ctx, upstreamTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, gusCPISourceURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "Njord/1.0")
	req.Header.Set("Accept", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("gus fetch: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("gus HTTP %d", resp.StatusCode)
	}
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return err
	}

	var payload gusCPIPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return fmt.Errorf("decode gus: %w", err)
	}

	count := 0
	for monthName, yearMap := range payload.Data {
		month, ok := polishMonths[monthName]
		if !ok {
			continue
		}
		for yearStr, raw := range yearMap {
			year, err := strconv.Atoi(yearStr)
			if err != nil {
				continue
			}
			val := coerceFloat(raw)
			if val == 0 {
				continue
			}
			// GUS already exposes the value as YoY % (e.g. 4.9 = 4.9%).
			if _, err := pool.Exec(ctx, `
INSERT INTO inflation_historical (year, month, cpi_yoy_pct)
VALUES ($1, $2, $3)
ON CONFLICT (year, month, source) DO UPDATE SET cpi_yoy_pct = EXCLUDED.cpi_yoy_pct
`, year, month, val); err != nil {
				return fmt.Errorf("upsert cpi %d-%02d: %w", year, month, err)
			}
			count++
		}
	}

	if err := c.Set(ctx, "gus", "cpi_historical", []byte(fmt.Sprintf(`{"rows":%d}`, count)), gusCPITTL); err != nil {
		return err
	}
	return nil
}

func coerceFloat(v any) float64 {
	switch x := v.(type) {
	case float64:
		return x
	case string:
		f, _ := strconv.ParseFloat(strings.ReplaceAll(x, ",", "."), 64)
		return f
	}
	return 0
}
