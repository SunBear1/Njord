// Package finance hosts HTTP handlers that proxy and cache financial market
// data for the Njord frontend.
package finance

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/SunBear1/Njord/backend/internal/cache"
)

const (
	YahooBaseDefault = "https://query2.finance.yahoo.com"
	yahooProvider    = "yahoo"
	stocksTTL        = time.Hour
	upstreamTimeout  = 10 * time.Second
)

// Cacher is the subset of *cache.Cache the handlers need; declared here so
// tests can swap in an in-memory fake.
type Cacher interface {
	Get(ctx context.Context, provider, key string) ([]byte, error)
	Set(ctx context.Context, provider, key string, payload []byte, ttl time.Duration) error
}

// Validation tables mirror functions/api/v1/finance/stocks/[ticker].ts.
var (
	allowedIntervals = map[string]struct{}{
		"5m": {}, "15m": {}, "30m": {}, "1h": {}, "1d": {}, "1wk": {}, "1mo": {},
	}
	allowedRanges = []string{"1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y"}
	rangeIndex    = func() map[string]int {
		m := make(map[string]int, len(allowedRanges))
		for i, r := range allowedRanges {
			m[r] = i
		}
		return m
	}()
	tickerPattern = regexp.MustCompile(`^[A-Z0-9.\-^=]+$`)
)

// StocksHandler returns GET /api/v1/finance/stocks/{ticker}.
//
// yahooBase is injectable so tests can point at httptest. Pass YahooBaseDefault
// in production.
func StocksHandler(c Cacher, httpClient *http.Client, yahooBase string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ticker := strings.ToUpper(r.PathValue("ticker"))
		if ticker == "" || len(ticker) > 20 || !tickerPattern.MatchString(ticker) {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "Invalid or missing ticker", "")
			return
		}

		interval := defaultIfEmpty(r.URL.Query().Get("interval"), "1d")
		rangeP := defaultIfEmpty(r.URL.Query().Get("range"), "1mo")

		if _, ok := allowedIntervals[interval]; !ok {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST",
				"Invalid interval. Allowed: 5m, 15m, 30m, 1h, 1d, 1wk, 1mo", "")
			return
		}
		rIdx, ok := rangeIndex[rangeP]
		if !ok {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST",
				"Invalid range. Allowed: "+strings.Join(allowedRanges, ", "), "")
			return
		}
		if interval == "5m" && rIdx > rangeIndex["1mo"] {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "5m interval supports max 1mo range", "")
			return
		}
		if interval == "1h" && rIdx > rangeIndex["2y"] {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "1h interval supports max 2y range", "")
			return
		}

		key := fmt.Sprintf("stocks:%s:%s:%s", ticker, interval, rangeP)
		ctx := r.Context()

		if payload, err := c.Get(ctx, yahooProvider, key); err == nil {
			writeCached(w, payload, "HIT")
			return
		} else if !errors.Is(err, cache.ErrMiss) {
			slog.Warn("cache get failed", "err", err, "key", key)
		}

		body, status, err := fetchYahooBars(ctx, httpClient, yahooBase, ticker, interval, rangeP)
		if err != nil {
			slog.Warn("yahoo upstream", "ticker", ticker, "err", err, "status", status)
			switch status {
			case http.StatusNotFound:
				writeError(w, http.StatusNotFound, "NOT_FOUND", err.Error(), "")
			case http.StatusTooManyRequests:
				writeError(w, http.StatusBadGateway, "UPSTREAM_ERROR", "Rate limited by Yahoo Finance", yahooProvider)
			default:
				writeError(w, http.StatusBadGateway, "UPSTREAM_ERROR", err.Error(), yahooProvider)
			}
			return
		}

		if err := c.Set(ctx, yahooProvider, key, body, stocksTTL); err != nil {
			slog.Warn("cache set failed", "err", err, "key", key)
		}

		writeCached(w, body, "MISS")
	}
}

func writeCached(w http.ResponseWriter, body []byte, cacheState string) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "max-age=300")
	w.Header().Set("X-Cache", cacheState)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(body)
}

// fetchYahooBars calls the Yahoo chart endpoint and returns a JSON payload
// that matches the CF Pages handler output for parity.
func fetchYahooBars(ctx context.Context, httpClient *http.Client, baseURL, ticker, interval, rangeP string) ([]byte, int, error) {
	endpoint := fmt.Sprintf("%s/v8/finance/chart/%s?interval=%s&range=%s",
		baseURL, url.PathEscape(ticker), interval, rangeP)

	reqCtx, cancel := context.WithTimeout(ctx, upstreamTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, 0, fmt.Errorf("build yahoo request: %w", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("yahoo fetch: %w", err)
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusOK:
	case http.StatusTooManyRequests:
		return nil, resp.StatusCode, fmt.Errorf("rate limited")
	case http.StatusNotFound:
		return nil, resp.StatusCode, fmt.Errorf("ticker not found: %s", ticker)
	default:
		return nil, resp.StatusCode, fmt.Errorf("yahoo HTTP %d", resp.StatusCode)
	}

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("read yahoo body: %w", err)
	}

	var parsed yahooChartResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, resp.StatusCode, fmt.Errorf("decode yahoo body: %w", err)
	}
	if parsed.Chart.Error != nil {
		if parsed.Chart.Error.Code == "Not Found" {
			return nil, http.StatusNotFound, fmt.Errorf("ticker not found: %s", ticker)
		}
		return nil, http.StatusBadGateway, fmt.Errorf("%s", parsed.Chart.Error.Description)
	}
	if len(parsed.Chart.Result) == 0 || len(parsed.Chart.Result[0].Timestamp) == 0 {
		return nil, http.StatusNotFound, fmt.Errorf("no data for ticker: %s", ticker)
	}

	result := parsed.Chart.Result[0]
	if len(result.Indicators.Quote) == 0 {
		return nil, http.StatusNotFound, fmt.Errorf("no quote data for ticker: %s", ticker)
	}
	q := result.Indicators.Quote[0]

	bars := make([]stockBar, 0, len(result.Timestamp))
	for i, ts := range result.Timestamp {
		closeV := safeFloat(q.Close, i)
		if closeV == 0 {
			continue
		}
		bars = append(bars, stockBar{
			Timestamp: ts,
			Open:      safeFloat(q.Open, i),
			High:      safeFloat(q.High, i),
			Low:       safeFloat(q.Low, i),
			Close:     closeV,
			Volume:    safeFloat(q.Volume, i),
		})
	}

	out := stocksResponse{
		Data: bars,
		Meta: stockMeta{
			Source:       yahooProvider,
			Currency:     result.Meta.Currency,
			CurrentPrice: result.Meta.RegularMarketPrice,
			Name:         pickName(result.Meta.LongName, result.Meta.ShortName),
			Type:         classify(result.Meta.InstrumentType),
		},
	}
	body, err := json.Marshal(out)
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("encode response: %w", err)
	}
	return body, http.StatusOK, nil
}

func defaultIfEmpty(v, fallback string) string {
	if v == "" {
		return fallback
	}
	return v
}

func safeFloat(xs []*float64, i int) float64 {
	if i < 0 || i >= len(xs) || xs[i] == nil {
		return 0
	}
	return *xs[i]
}

func pickName(long, short string) string {
	if long != "" {
		return long
	}
	return short
}

func classify(instrumentType string) string {
	if strings.EqualFold(instrumentType, "ETF") {
		return "etf"
	}
	return "stock"
}

// --- wire types --------------------------------------------------------------

type yahooChartResponse struct {
	Chart struct {
		Result []yahooChartResult `json:"result"`
		Error  *yahooChartError   `json:"error"`
	} `json:"chart"`
}

type yahooChartError struct {
	Code        string `json:"code"`
	Description string `json:"description"`
}

type yahooChartResult struct {
	Meta       yahooMeta       `json:"meta"`
	Timestamp  []int64         `json:"timestamp"`
	Indicators yahooIndicators `json:"indicators"`
}

type yahooMeta struct {
	RegularMarketPrice float64 `json:"regularMarketPrice"`
	Currency           string  `json:"currency"`
	InstrumentType     string  `json:"instrumentType"`
	LongName           string  `json:"longName"`
	ShortName          string  `json:"shortName"`
}

type yahooIndicators struct {
	Quote []yahooQuote `json:"quote"`
}

type yahooQuote struct {
	Open   []*float64 `json:"open"`
	High   []*float64 `json:"high"`
	Low    []*float64 `json:"low"`
	Close  []*float64 `json:"close"`
	Volume []*float64 `json:"volume"`
}

// --- public response types (parity with frontend ProxyResponse) -------------

type stockBar struct {
	Timestamp int64   `json:"timestamp"`
	Open      float64 `json:"open"`
	High      float64 `json:"high"`
	Low       float64 `json:"low"`
	Close     float64 `json:"close"`
	Volume    float64 `json:"volume"`
}

type stockMeta struct {
	Source       string  `json:"source"`
	Currency     string  `json:"currency,omitempty"`
	CurrentPrice float64 `json:"currentPrice,omitempty"`
	Name         string  `json:"name,omitempty"`
	Type         string  `json:"type,omitempty"`
}

type stocksResponse struct {
	Data []stockBar `json:"data"`
	Meta stockMeta  `json:"_meta"`
}

func writeError(w http.ResponseWriter, status int, code, message, upstream string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	type body struct {
		Error    string `json:"error"`
		Code     string `json:"code"`
		Upstream string `json:"upstream,omitempty"`
	}
	_ = json.NewEncoder(w).Encode(body{Error: message, Code: code, Upstream: upstream})
}
