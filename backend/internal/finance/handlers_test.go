package finance

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
)

// --- NBP client unit tests -------------------------------------------------

func TestNBPClient_TableARate_PLN(t *testing.T) {
	n := NewNBPClient(http.DefaultClient, "http://unused", "http://unused")
	got, err := n.TableARate(context.Background(), "2025-04-10", "PLN")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if got.Rate != 1 || got.EffectiveDate != "2025-04-10" {
		t.Errorf("PLN must be 1: %+v", got)
	}
}

func TestNBPClient_TableARate_BadDate(t *testing.T) {
	n := NewNBPClient(http.DefaultClient, "http://unused", "http://unused")
	if _, err := n.TableARate(context.Background(), "not-a-date", "USD"); err == nil {
		t.Fatal("expected error")
	}
}

func TestNBPClient_TableARate_LastBusinessDay(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, `{"rates":[
		  {"mid": 4.00, "effectiveDate": "2025-04-07"},
		  {"mid": 4.05, "effectiveDate": "2025-04-08"},
		  {"mid": 4.10, "effectiveDate": "2025-04-09"},
		  {"mid": 4.15, "effectiveDate": "2025-04-10"}
		]}`)
	}))
	defer srv.Close()

	n := NewNBPClient(http.DefaultClient, srv.URL, "http://unused")
	got, err := n.TableARate(context.Background(), "2025-04-10", "USD")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	// Must pick last rate strictly BEFORE 2025-04-10 = 2025-04-09.
	if got.EffectiveDate != "2025-04-09" || got.Rate != 4.10 {
		t.Errorf("want 2025-04-09 / 4.10, got %+v", got)
	}
}

func TestNBPClient_TableARate_404(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()
	n := NewNBPClient(http.DefaultClient, srv.URL, "http://unused")
	if _, err := n.TableARate(context.Background(), "2025-04-10", "USD"); err == nil {
		t.Fatal("expected 404 error")
	}
}

func TestNBPClient_History(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, `{"rates":[
		  {"effectiveDate":"2025-04-08","mid":4.05},
		  {"effectiveDate":"2025-04-09","mid":4.10}
		]}`)
	}))
	defer srv.Close()
	n := NewNBPClient(http.DefaultClient, srv.URL, "http://unused")
	rates, _ := n.History(context.Background(), "USD", 7)
	if len(rates) != 2 || rates[1].Mid != 4.10 {
		t.Errorf("history wrong: %+v", rates)
	}
}

func TestNBPClient_History_GracefulFailure(t *testing.T) {
	n := NewNBPClient(http.DefaultClient, "http://127.0.0.1:0", "http://unused")
	rates, _ := n.History(context.Background(), "USD", 7)
	if rates == nil || len(rates) != 0 {
		t.Errorf("expected empty slice, got %v", rates)
	}
}

func TestNBPClient_TableCRates(t *testing.T) {
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		if strings.Contains(r.URL.Path, "/gbp/") {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		_, _ = io.WriteString(w, `{"rates":[{"bid":4.0,"ask":4.1,"effectiveDate":"2025-04-09"}]}`)
	}))
	defer srv.Close()

	n := NewNBPClient(http.DefaultClient, "http://unused", srv.URL)
	rates := n.TableCRates(context.Background())
	if len(rates) != 2 { // USD + EUR succeed; GBP fails
		t.Fatalf("expected 2 rates, got %d", len(rates))
	}
	for _, r := range rates {
		if r.Source != "nbp" || r.Mid == 0 {
			t.Errorf("bad row %+v", r)
		}
	}
}

// --- Currency handlers -----------------------------------------------------

func TestCurrencyHandler_BadSource(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/finance/currency?source=bogus", nil)
	CurrencyHandler(NewNBPClient(http.DefaultClient, "http://x", "http://x"))(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400, got %d", rec.Code)
	}
}

func TestCurrencyHandler_NoValidPairs(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/finance/currency?pairs=XAU/PLN", nil)
	CurrencyHandler(NewNBPClient(http.DefaultClient, "http://x", "http://x"))(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400, got %d", rec.Code)
	}
}

func TestCurrencyHandler_NBPSuccess(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, `{"rates":[{"bid":4.0,"ask":4.1,"effectiveDate":"2025-04-09"}]}`)
	}))
	defer srv.Close()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/finance/currency?source=nbp&pairs=USD/PLN", nil)
	CurrencyHandler(NewNBPClient(http.DefaultClient, "http://unused", srv.URL))(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d body=%s", rec.Code, rec.Body.String())
	}
	var out struct {
		Data []NBPCurrencyRate `json:"data"`
		Meta map[string]string `json:"_meta"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	if len(out.Data) != 1 || out.Data[0].Pair != "USD/PLN" || out.Meta["source"] != "nbp" {
		t.Errorf("unexpected body: %+v", out)
	}
}

func TestCurrencyRateHandler_Validation(t *testing.T) {
	cases := []string{
		"/api/v1/finance/currency/rate",
		"/api/v1/finance/currency/rate?date=2025-04-10",
		"/api/v1/finance/currency/rate?date=bad&currency=USD",
		"/api/v1/finance/currency/rate?date=2025-04-10&currency=us",
	}
	for _, p := range cases {
		t.Run(p, func(t *testing.T) {
			rec := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, p, nil)
			CurrencyRateHandler(NewNBPClient(http.DefaultClient, "http://x", "http://x"), newFakeCache())(rec, req)
			if rec.Code != http.StatusBadRequest {
				t.Errorf("want 400, got %d", rec.Code)
			}
		})
	}
}

func TestCurrencyRateHandler_MissThenHit(t *testing.T) {
	var hits int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		atomic.AddInt32(&hits, 1)
		_, _ = io.WriteString(w, `{"rates":[{"mid":4.10,"effectiveDate":"2025-04-09"}]}`)
	}))
	defer srv.Close()

	fc := newFakeCache()
	h := CurrencyRateHandler(NewNBPClient(http.DefaultClient, srv.URL, "http://unused"), fc)

	rec := httptest.NewRecorder()
	h(rec, httptest.NewRequest(http.MethodGet, "/api/v1/finance/currency/rate?date=2025-04-10&currency=USD", nil))
	if rec.Code != http.StatusOK || rec.Header().Get("X-Cache") != "MISS" {
		t.Fatalf("first call: code=%d cache=%q body=%s", rec.Code, rec.Header().Get("X-Cache"), rec.Body.String())
	}

	rec2 := httptest.NewRecorder()
	h(rec2, httptest.NewRequest(http.MethodGet, "/api/v1/finance/currency/rate?date=2025-04-10&currency=USD", nil))
	if rec2.Header().Get("X-Cache") != "HIT" {
		t.Fatalf("second call not a hit: %q", rec2.Header().Get("X-Cache"))
	}
	if hits != 1 {
		t.Errorf("upstream must be called once, got %d", hits)
	}
}

func TestCurrencyHistoryHandler_Validation(t *testing.T) {
	rec := httptest.NewRecorder()
	h := CurrencyHistoryHandler(NewNBPClient(http.DefaultClient, "http://x", "http://x"), newFakeCache())
	h(rec, httptest.NewRequest(http.MethodGet, "/api/v1/finance/currency/history?currency=JPY", nil))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400 for bad currency, got %d", rec.Code)
	}
	rec = httptest.NewRecorder()
	h(rec, httptest.NewRequest(http.MethodGet, "/api/v1/finance/currency/history?currency=USD&days=999", nil))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400 for bad days, got %d", rec.Code)
	}
}

// --- Inflation handlers (pure validation, no DB) --------------------------

func TestInflationHandler_ValidationBadFrom(t *testing.T) {
	rec := httptest.NewRecorder()
	// Pass nil pool — request must fail validation BEFORE touching DB.
	InflationHandler(nil, newFakeCache(), http.DefaultClient)(rec,
		httptest.NewRequest(http.MethodGet, "/api/v1/finance/inflation?from=bad", nil))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400, got %d", rec.Code)
	}
}

func TestInflationForecastHandler_ValidationBadReport(t *testing.T) {
	rec := httptest.NewRecorder()
	InflationForecastHandler(nil)(rec,
		httptest.NewRequest(http.MethodGet, "/api/v1/finance/inflation/forecast?report=2025", nil))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400, got %d", rec.Code)
	}
}

// --- Bonds handler validation ---------------------------------------------

func TestBondsHandler_ValidationBadIsFamily(t *testing.T) {
	rec := httptest.NewRecorder()
	BondsHandler(nil)(rec,
		httptest.NewRequest(http.MethodGet, "/api/v1/finance/bonds?is_family=maybe", nil))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400, got %d", rec.Code)
	}
}

// --- monthKey helper -------------------------------------------------------

func TestMonthKey(t *testing.T) {
	if monthKey("2025-04") != 202504 {
		t.Error("monthKey 2025-04")
	}
	if monthKey("bad") != 0 {
		t.Error("monthKey bad")
	}
}

// --- coerceFloat -----------------------------------------------------------

func TestCoerceFloat(t *testing.T) {
	if coerceFloat(1.5) != 1.5 {
		t.Error("float64")
	}
	if coerceFloat("1,5") != 1.5 {
		t.Error("string with comma")
	}
	if coerceFloat(nil) != 0 {
		t.Error("nil")
	}
}
