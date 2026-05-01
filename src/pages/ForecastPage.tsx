import { useState, useCallback, lazy, Suspense } from 'react';
import { Search, Loader2, AlertTriangle } from 'lucide-react';
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
    <div className="space-y-4">
      {/* Ticker input */}
      <div className="bg-bg-card rounded-xl border border-border shadow-sm p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Prognoza cenowa</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex items-end gap-3">
          <div className="flex-1 max-w-xs">
            <label htmlFor="forecast-ticker" className="block text-sm font-medium text-text-secondary mb-1">
              Ticker
            </label>
            <input
              id="forecast-ticker"
              type="text"
              value={tickerInput}
              onChange={e => setTickerInput(e.target.value.toUpperCase())}
              placeholder="np. AAPL, MSFT, SPY…"
              className="w-full px-3 py-2 border border-border-strong rounded-lg bg-white dark:bg-surface-dark text-text-primary dark:text-on-dark placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-surface-dark/30 text-sm"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <button
            type="submit"
            disabled={assetLoading || !tickerInput.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-on-dark rounded-lg font-medium text-sm hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400" role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{assetError}</span>
          </div>
        )}

        {assetData && (
          <div className="flex items-center gap-3 text-sm text-text-secondary">
            <span className="font-medium text-text-primary">{assetData.asset.name}</span>
            <span>({activeTicker})</span>
            <span className="text-faint">·</span>
            {currentFxRate > 0 && (
              <>
                <span className="text-faint">·</span>
                <span>{(assetData.asset.currentPrice * currentFxRate).toFixed(2)} PLN</span>
              </>
            )}
          </div>
        )}
      </div>

      {assetData && (
        <ErrorBoundary>
          <Suspense fallback={<div className="text-center py-8 text-muted dark:text-muted">Ładowanie modułu…</div>}>
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
        <div className="bg-bg-card rounded-xl border border-dashed border-border-strong p-10 text-center text-muted dark:text-muted space-y-2">
          <p className="text-lg">Wprowadź ticker, aby zobaczyć prognozę cenową</p>
          <p className="text-sm">Wpisz symbol spółki lub ETF (np. AAPL, MSFT, SPY) i kliknij „Analizuj".</p>
        </div>
      )}
    </div>
  );
}

export default ForecastPage;
