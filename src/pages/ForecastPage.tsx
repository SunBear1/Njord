import { useState, useCallback, lazy, Suspense } from 'react';
import { Search, Loader2, AlertTriangle, TrendingUp } from 'lucide-react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useAssetData } from '../hooks/useAssetData';
import { useSellAnalysis } from '../hooks/useSellAnalysis';
import { useDarkMode } from '../hooks/useDarkMode';

const SellAnalysisPanel = lazy(() =>
  import('../components/SellAnalysisPanel').then(m => ({ default: m.SellAnalysisPanel })),
);

export function ForecastPage() {
  const [isDark] = useDarkMode();
  const [tickerInput, setTickerInput] = useState('');
  const [activeTicker, setActiveTicker] = useState('');
  const [sellHorizonDays, setSellHorizonDays] = useState(63);

  const { assetData, proxyFxData, isLoading: assetLoading, error: assetError, fetchData } = useAssetData();

  const { analysis: sellAnalysis, isLoading: sellLoading } = useSellAnalysis(
    assetData?.historicalPrices ?? null,
    assetData?.asset.currentPrice ?? 0,
    sellHorizonDays,
    !!assetData,
  );

  const currentFxRate = proxyFxData?.currentRate ?? 0;

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const t = tickerInput.trim().toUpperCase();
    if (!t) return;
    setActiveTicker(t);
    await fetchData(t);
  }, [tickerInput, fetchData]);

  return (
    <div className="space-y-6">
      {/* Hero / Ticker input */}
      <div className="bg-bg-card rounded-xl border border-border shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent-primary/10">
            <TrendingUp size={20} className="text-accent-primary" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary">Prognoza cenowa</h2>
            <p className="text-sm text-text-muted">Analiza probabilistyczna cen akcji i ETF</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex items-end gap-3">
          <div className="flex-1 max-w-sm">
            <label htmlFor="forecast-ticker" className="block text-sm font-medium text-text-secondary mb-1">
              Ticker
            </label>
            <input
              id="forecast-ticker"
              type="text"
              value={tickerInput}
              onChange={e => setTickerInput(e.target.value.toUpperCase())}
              placeholder="np. AAPL, MSFT, SPY…"
              className="w-full px-3 py-2.5 border border-border rounded-lg bg-bg-card text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary/40-primary text-sm transition-colors"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <button
            type="submit"
            disabled={assetLoading || !tickerInput.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent-primary text-white rounded-lg font-medium text-sm hover:bg-accent-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
          >
            {assetLoading ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Search size={16} aria-hidden="true" />
            )}
            Analizuj
          </button>
        </form>

        {assetError && (
          <div className="flex items-center gap-2 text-sm text-danger" role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{assetError}</span>
          </div>
        )}

        {assetData && (
          <div className="flex items-center gap-3 text-sm text-text-muted pt-1 border-t border-border">
            <span className="font-semibold text-text-primary">{assetData.asset.name}</span>
            <span className="text-text-muted">({activeTicker})</span>
            {currentFxRate > 0 && (
              <>
                <span className="text-border">·</span>
                <span className="font-mono tabular-nums">{(assetData.asset.currentPrice * currentFxRate).toFixed(2)} PLN</span>
              </>
            )}
          </div>
        )}
      </div>

      {assetData && (
        <ErrorBoundary>
          <Suspense fallback={<div className="text-center py-8 text-text-muted">Ładowanie modułu…</div>}>
            <SellAnalysisPanel
              analysis={sellAnalysis}
              isLoading={sellLoading}
              horizonDays={sellHorizonDays}
              onHorizonChange={setSellHorizonDays}
              currentFxRate={currentFxRate}
              isDark={isDark}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {!assetData && !assetLoading && !assetError && (
        <div className="bg-bg-card rounded-xl border border-dashed border-border p-12 text-center text-text-muted space-y-3">
          <TrendingUp size={32} className="mx-auto text-accent-primary/40" aria-hidden="true" />
          <p className="text-lg font-medium text-text-secondary">Wprowadź ticker, aby zobaczyć prognozę cenową</p>
          <p className="text-sm">Wpisz symbol spółki lub ETF (np. AAPL, MSFT, SPY) i kliknij „Analizuj".</p>
        </div>
      )}
    </div>
  );
}

export default ForecastPage;
