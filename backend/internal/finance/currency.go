package finance

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/SunBear1/Njord/backend/internal/cache"
)

const (
	oneHour         = time.Hour
	twentyFourHours = 24 * time.Hour
)

func jsonMarshal(v any) ([]byte, error) { return json.Marshal(v) }

var (
	allowedFXPairs   = map[string]struct{}{"USD/PLN": {}, "EUR/PLN": {}, "GBP/PLN": {}}
	allowedFXSources = map[string]struct{}{"all": {}, "nbp": {}, "alior": {}, "walutomat": {}}
	datePattern      = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
	currencyPattern  = regexp.MustCompile(`^[A-Z]{3}$`)
)

// CurrencyHandler returns GET /api/v1/finance/currency — aggregated Table C
// buy/sell rates. Alior/Walutomat scrapers are not yet ported; when those
// sources are requested specifically they degrade to an empty array, matching
// the existing CF function's `Promise.allSettled` behaviour.
func CurrencyHandler(nbp *NBPClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		pairsParam := defaultIfEmpty(r.URL.Query().Get("pairs"), "USD/PLN,EUR/PLN,GBP/PLN")
		sourceParam := defaultIfEmpty(r.URL.Query().Get("source"), "all")

		if _, ok := allowedFXSources[sourceParam]; !ok {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "Invalid source. Allowed: all, nbp, alior, walutomat", "")
			return
		}

		validPairs := make(map[string]struct{})
		for _, raw := range strings.Split(pairsParam, ",") {
			p := strings.ToUpper(strings.TrimSpace(raw))
			if _, ok := allowedFXPairs[p]; ok {
				validPairs[p] = struct{}{}
			}
		}
		if len(validPairs) == 0 {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "No valid pairs. Allowed: USD/PLN, EUR/PLN, GBP/PLN", "")
			return
		}

		var rates []NBPCurrencyRate
		if sourceParam == "all" || sourceParam == "nbp" {
			rates = append(rates, nbp.TableCRates(r.Context())...)
		}
		// alior + walutomat: scrapers not yet ported (Story 0.7 scope decision).
		// They return nothing for now; frontend treats partial responses as OK.

		filtered := rates[:0]
		for _, rt := range rates {
			if _, ok := validPairs[rt.Pair]; ok {
				filtered = append(filtered, rt)
			}
		}

		metaSource := sourceParam
		if sourceParam == "all" {
			metaSource = "aggregated"
		}
		writePayload(w, map[string]any{
			"data":  filtered,
			"_meta": map[string]string{"source": metaSource},
		}, "no-store")
	}
}

// CurrencyRateHandler returns GET /api/v1/finance/currency/rate — the Table A
// mid rate for the last business day strictly before `date`. Used by the
// Belka tax flow.
func CurrencyRateHandler(nbp *NBPClient, c Cacher) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		date := r.URL.Query().Get("date")
		currency := strings.ToUpper(r.URL.Query().Get("currency"))
		if date == "" {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "Missing required param: date", "")
			return
		}
		if !datePattern.MatchString(date) {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "Invalid date format. Expected YYYY-MM-DD", "")
			return
		}
		if currency == "" {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "Missing required param: currency", "")
			return
		}
		if !currencyPattern.MatchString(currency) {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "Invalid currency code. Expected 3-letter ISO code", "")
			return
		}

		cacheKey := "rate:" + date + ":" + currency
		ctx := r.Context()
		if payload, err := c.Get(ctx, "nbp", cacheKey); err == nil {
			writeCached(w, payload, "HIT")
			return
		} else if !errors.Is(err, cache.ErrMiss) {
			// log and proceed
		}

		result, err := nbp.TableARate(ctx, date, currency)
		if err != nil {
			writeError(w, http.StatusBadGateway, "UPSTREAM_ERROR", err.Error(), "nbp")
			return
		}
		body, _ := jsonMarshal(map[string]any{
			"ok":   true,
			"data": result,
		})
		_ = c.Set(ctx, "nbp", cacheKey, body, twentyFourHours)
		writeCached(w, body, "MISS")
	}
}

// CurrencyHistoryHandler returns GET /api/v1/finance/currency/history — the
// last N Table A mid rates for `currency`. Cached 1h.
func CurrencyHistoryHandler(nbp *NBPClient, c Cacher) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		currency := strings.ToUpper(defaultIfEmpty(r.URL.Query().Get("currency"), "USD"))
		if _, ok := map[string]struct{}{"USD": {}, "EUR": {}, "GBP": {}}[currency]; !ok {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "Invalid currency. Allowed: USD, EUR, GBP", "")
			return
		}
		daysStr := defaultIfEmpty(r.URL.Query().Get("days"), "90")
		days, err := strconv.Atoi(daysStr)
		if err != nil || days < 1 || days > 365 {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "days must be an integer between 1 and 365", "")
			return
		}

		cacheKey := "history:" + currency + ":" + daysStr
		ctx := r.Context()
		if payload, err := c.Get(ctx, "nbp", cacheKey); err == nil {
			writeCached(w, payload, "HIT")
			return
		} else if !errors.Is(err, cache.ErrMiss) {
			// log and proceed
		}

		rates, _ := nbp.History(ctx, currency, days)
		body, _ := jsonMarshal(map[string]any{
			"ok": true,
			"data": map[string]any{
				"currency": currency,
				"rates":    rates,
			},
		})
		_ = c.Set(ctx, "nbp", cacheKey, body, oneHour)
		writeCached(w, body, "MISS")
	}
}
