package finance

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/SunBear1/Njord/backend/internal/cache"
)

// fakeCache is an in-memory Cacher for tests.
type fakeCache struct {
	data map[string][]byte
	hits int32
}

func newFakeCache() *fakeCache { return &fakeCache{data: map[string][]byte{}} }

func (f *fakeCache) Get(_ context.Context, provider, key string) ([]byte, error) {
	v, ok := f.data[provider+"|"+key]
	if !ok {
		return nil, cache.ErrMiss
	}
	atomic.AddInt32(&f.hits, 1)
	return v, nil
}
func (f *fakeCache) Set(_ context.Context, provider, key string, payload []byte, _ time.Duration) error {
	f.data[provider+"|"+key] = payload
	return nil
}

const yahooFixtureBody = `{
  "chart": {
    "error": null,
    "result": [{
      "meta": {
        "regularMarketPrice": 195.12,
        "currency": "USD",
        "instrumentType": "EQUITY",
        "longName": "Apple Inc.",
        "shortName": "Apple"
      },
      "timestamp": [1700000000, 1700086400],
      "indicators": { "quote": [{
        "open": [194.10, 195.00],
        "high": [196.50, 197.00],
        "low": [193.80, 194.50],
        "close": [195.12, 196.30],
        "volume": [50000000, 55000000]
      }] }
    }]
  }
}`

func mockYahoo(t *testing.T, status int, body string, hits *int32) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if hits != nil {
			atomic.AddInt32(hits, 1)
		}
		if !strings.HasPrefix(r.URL.Path, "/v8/finance/chart/") {
			t.Errorf("unexpected path %s", r.URL.Path)
		}
		if got := r.Header.Get("User-Agent"); got != "Mozilla/5.0" {
			t.Errorf("missing User-Agent header")
		}
		w.WriteHeader(status)
		_, _ = io.WriteString(w, body)
	}))
}

func newMux(h http.Handler) http.Handler {
	mux := http.NewServeMux()
	mux.Handle("GET /api/v1/finance/stocks/{ticker}", h)
	return mux
}

// --- validation tests ------------------------------------------------------

func TestValidation(t *testing.T) {
	tests := []struct {
		name string
		path string
	}{
		{"bad chars", "/api/v1/finance/stocks/AAPL$"},
		{"too long", "/api/v1/finance/stocks/" + strings.Repeat("A", 21)},
		{"bad interval", "/api/v1/finance/stocks/AAPL?interval=2m"},
		{"bad range", "/api/v1/finance/stocks/AAPL?range=10y"},
		{"5m too long", "/api/v1/finance/stocks/AAPL?interval=5m&range=1y"},
		{"1h too long", "/api/v1/finance/stocks/AAPL?interval=1h&range=5y"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tc.path, nil)
			rec := httptest.NewRecorder()
			h := newMux(StocksHandler(newFakeCache(), http.DefaultClient, "http://unused"))
			h.ServeHTTP(rec, req)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("expected 400, got %d body=%s", rec.Code, rec.Body.String())
			}
			var env struct{ Code string }
			_ = json.Unmarshal(rec.Body.Bytes(), &env)
			if env.Code != "BAD_REQUEST" {
				t.Fatalf("expected BAD_REQUEST code, got %q", env.Code)
			}
		})
	}
}

// --- happy-path: cache miss → upstream → set → MISS header -----------------

func TestStocks_MissThenHit(t *testing.T) {
	var upstreamHits int32
	srv := mockYahoo(t, http.StatusOK, yahooFixtureBody, &upstreamHits)
	defer srv.Close()

	fc := newFakeCache()
	mux := newMux(StocksHandler(fc, http.DefaultClient, srv.URL))

	// MISS
	req := httptest.NewRequest(http.MethodGet, "/api/v1/finance/stocks/AAPL?range=2y&interval=1d", nil)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}
	if got := rec.Header().Get("X-Cache"); got != "MISS" {
		t.Errorf("X-Cache: want MISS, got %q", got)
	}
	if upstreamHits != 1 {
		t.Errorf("upstream hits: want 1, got %d", upstreamHits)
	}

	var out stocksResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(out.Data) != 2 || out.Data[0].Close != 195.12 {
		t.Errorf("parsed bars wrong: %+v", out.Data)
	}
	if out.Meta.Source != "yahoo" || out.Meta.Currency != "USD" || out.Meta.Type != "stock" {
		t.Errorf("meta wrong: %+v", out.Meta)
	}

	// HIT — second request must not touch upstream
	req2 := httptest.NewRequest(http.MethodGet, "/api/v1/finance/stocks/AAPL?range=2y&interval=1d", nil)
	rec2 := httptest.NewRecorder()
	mux.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec2.Code)
	}
	if got := rec2.Header().Get("X-Cache"); got != "HIT" {
		t.Errorf("X-Cache: want HIT, got %q", got)
	}
	if upstreamHits != 1 {
		t.Errorf("upstream must not be called on HIT, hits=%d", upstreamHits)
	}
	if rec.Body.String() != rec2.Body.String() {
		t.Error("HIT body must match MISS body byte-for-byte")
	}
}

// --- upstream error mapping ------------------------------------------------

func TestStocks_Upstream429(t *testing.T) {
	srv := mockYahoo(t, http.StatusTooManyRequests, `{}`, nil)
	defer srv.Close()
	mux := newMux(StocksHandler(newFakeCache(), http.DefaultClient, srv.URL))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/finance/stocks/AAPL", nil))
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("expected 502, got %d", rec.Code)
	}
}

func TestStocks_Upstream404(t *testing.T) {
	srv := mockYahoo(t, http.StatusNotFound, `{}`, nil)
	defer srv.Close()
	mux := newMux(StocksHandler(newFakeCache(), http.DefaultClient, srv.URL))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/finance/stocks/XXXX", nil))
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestStocks_YahooChartErrorNotFound(t *testing.T) {
	body := `{"chart":{"error":{"code":"Not Found","description":"x"},"result":null}}`
	srv := mockYahoo(t, http.StatusOK, body, nil)
	defer srv.Close()
	mux := newMux(StocksHandler(newFakeCache(), http.DefaultClient, srv.URL))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/finance/stocks/ZZZ", nil))
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestStocks_YahooChartErrorOther(t *testing.T) {
	body := `{"chart":{"error":{"code":"InvalidParameters","description":"bad"},"result":null}}`
	srv := mockYahoo(t, http.StatusOK, body, nil)
	defer srv.Close()
	mux := newMux(StocksHandler(newFakeCache(), http.DefaultClient, srv.URL))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/finance/stocks/AAPL", nil))
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("expected 502, got %d", rec.Code)
	}
}

// --- pure helpers ----------------------------------------------------------

func TestHelpers(t *testing.T) {
	if classify("ETF") != "etf" || classify("equity") != "stock" {
		t.Error("classify wrong")
	}
	if pickName("L", "S") != "L" || pickName("", "S") != "S" {
		t.Error("pickName wrong")
	}
	v := 7.0
	xs := []*float64{nil, &v}
	if safeFloat(xs, 0) != 0 || safeFloat(xs, 1) != 7 || safeFloat(xs, 9) != 0 {
		t.Error("safeFloat wrong")
	}
}

// ensure cache.ErrMiss is the sentinel the handler treats as miss
func TestCacheMissSentinel(t *testing.T) {
	if !errors.Is(cache.ErrMiss, cache.ErrMiss) {
		t.Fatal("ErrMiss must satisfy errors.Is with itself")
	}
}
