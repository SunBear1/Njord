package finance

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	nbpTableABase = "https://api.nbp.pl/api/exchangerates/rates/a"
	nbpTableCBase = "https://api.nbp.pl/api/exchangerates/rates/c"
	nbpTimeout    = 8 * time.Second
)

// NBPClient is a tiny HTTP client over NBP's public API. Base URLs are
// injectable for tests.
type NBPClient struct {
	http      *http.Client
	tableABase string
	tableCBase string
}

// NewNBPClient wraps an *http.Client with NBP endpoints. Pass empty strings
// for production defaults.
func NewNBPClient(c *http.Client, tableA, tableC string) *NBPClient {
	if tableA == "" {
		tableA = nbpTableABase
	}
	if tableC == "" {
		tableC = nbpTableCBase
	}
	return &NBPClient{http: c, tableABase: tableA, tableCBase: tableC}
}

// NBPHistoricalRate is one row of the Table A history response.
type NBPHistoricalRate struct {
	Date string  `json:"date"`
	Mid  float64 `json:"mid"`
}

// NBPDailyResult is a single Table A mid rate for a given date.
type NBPDailyResult struct {
	Rate          float64 `json:"rate"`
	EffectiveDate string  `json:"effectiveDate"`
}

// NBPCurrencyRate matches the existing CurrencyRate JSON shape.
type NBPCurrencyRate struct {
	Source    string  `json:"source"`
	Pair      string  `json:"pair"`
	Bid       float64 `json:"bid"`
	Ask       float64 `json:"ask"`
	Mid       float64 `json:"mid,omitempty"`
	Timestamp string  `json:"timestamp"`
}

// TableARate returns the mid rate from the last business day strictly before
// `date` (YYYY-MM-DD). PLN is hard-coded to 1.
func (n *NBPClient) TableARate(ctx context.Context, date, currency string) (*NBPDailyResult, error) {
	currency = strings.ToUpper(currency)
	if currency == "PLN" {
		return &NBPDailyResult{Rate: 1, EffectiveDate: date}, nil
	}
	t, err := time.Parse("2006-01-02", date)
	if err != nil {
		return nil, fmt.Errorf("invalid date format")
	}
	end := t.AddDate(0, 0, -1)
	start := t.AddDate(0, 0, -7)
	url := fmt.Sprintf("%s/%s/%s/%s/?format=json",
		n.tableABase, strings.ToLower(currency), start.Format("2006-01-02"), end.Format("2006-01-02"))

	raw, status, err := n.get(ctx, url)
	if err != nil {
		return nil, err
	}
	if status == http.StatusNotFound {
		return nil, fmt.Errorf("No NBP rate for %s near date %s", currency, date)
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("NBP upstream error (HTTP %d)", status)
	}

	var resp struct {
		Rates []struct {
			Mid           float64 `json:"mid"`
			EffectiveDate string  `json:"effectiveDate"`
		} `json:"rates"`
	}
	if err := json.Unmarshal(raw, &resp); err != nil {
		return nil, err
	}
	if len(resp.Rates) == 0 {
		return nil, fmt.Errorf("No NBP rates returned for %s in this period", currency)
	}
	var last *struct {
		Mid           float64 `json:"mid"`
		EffectiveDate string  `json:"effectiveDate"`
	}
	for i := range resp.Rates {
		if resp.Rates[i].EffectiveDate < date {
			last = &resp.Rates[i]
		}
	}
	if last == nil {
		return nil, fmt.Errorf("No NBP rate before %s for %s", date, currency)
	}
	return &NBPDailyResult{Rate: last.Mid, EffectiveDate: last.EffectiveDate}, nil
}

// History returns up to `days` most recent Table A mid rates for `currency`.
func (n *NBPClient) History(ctx context.Context, currency string, days int) ([]NBPHistoricalRate, error) {
	url := fmt.Sprintf("%s/%s/last/%d/?format=json", n.tableABase, strings.ToLower(currency), days)
	raw, status, err := n.get(ctx, url)
	if err != nil {
		return []NBPHistoricalRate{}, nil
	}
	if status != http.StatusOK {
		return []NBPHistoricalRate{}, nil
	}
	var resp struct {
		Rates []struct {
			EffectiveDate string  `json:"effectiveDate"`
			Mid           float64 `json:"mid"`
		} `json:"rates"`
	}
	if err := json.Unmarshal(raw, &resp); err != nil {
		return []NBPHistoricalRate{}, nil
	}
	out := make([]NBPHistoricalRate, 0, len(resp.Rates))
	for _, r := range resp.Rates {
		out = append(out, NBPHistoricalRate{Date: r.EffectiveDate, Mid: r.Mid})
	}
	return out, nil
}

// TableCRates fetches buy/sell rates for USD, EUR, GBP. Failures are silently
// dropped so the aggregator can degrade gracefully.
func (n *NBPClient) TableCRates(ctx context.Context) []NBPCurrencyRate {
	pairs := []string{"USD", "EUR", "GBP"}
	out := make([]NBPCurrencyRate, 0, len(pairs))
	for _, code := range pairs {
		url := fmt.Sprintf("%s/%s/?format=json", n.tableCBase, strings.ToLower(code))
		raw, status, err := n.get(ctx, url)
		if err != nil || status != http.StatusOK {
			continue
		}
		var resp struct {
			Rates []struct {
				Bid           float64 `json:"bid"`
				Ask           float64 `json:"ask"`
				EffectiveDate string  `json:"effectiveDate"`
			} `json:"rates"`
		}
		if err := json.Unmarshal(raw, &resp); err != nil || len(resp.Rates) == 0 {
			continue
		}
		r := resp.Rates[0]
		out = append(out, NBPCurrencyRate{
			Source:    "nbp",
			Pair:      code + "/PLN",
			Bid:       r.Bid,
			Ask:       r.Ask,
			Mid:       (r.Bid + r.Ask) / 2,
			Timestamp: r.EffectiveDate,
		})
	}
	return out
}

func (n *NBPClient) get(ctx context.Context, url string) ([]byte, int, error) {
	reqCtx, cancel := context.WithTimeout(ctx, nbpTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, url, nil)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("User-Agent", "Njord/1.0")
	resp, err := n.http.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return nil, resp.StatusCode, err
	}
	return raw, resp.StatusCode, nil
}
