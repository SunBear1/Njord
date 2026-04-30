import { useState, useRef, useEffect } from 'react';
import { ArrowDownUp, ChevronLeft, ChevronRight, ArrowDown, ArrowUp } from 'lucide-react';
import type { CurrencyRates } from '../hooks/useCurrencyRates';

interface KantorSidebarProps {
  rates: CurrencyRates;
}

function spreadPct(buy: number, sell: number): string {
  const avg = (sell + buy) / 2;
  if (!avg || !isFinite(avg)) return '—';
  return ((sell - buy) / avg * 100).toFixed(2);
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function RateRow({ label, value, direction }: { label: string; value: number; direction: 'buy' | 'sell' | 'spread' }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-text-muted flex items-center gap-1">
        {direction === 'sell' && <ArrowDown size={10} className="text-orange-600 dark:text-orange-400" aria-hidden="true" />}
        {direction === 'buy' && <ArrowUp size={10} className="text-blue-600 dark:text-blue-400" aria-hidden="true" />}
        {label}
      </span>
      <span className={`font-mono font-medium tabular-nums ${
        direction === 'sell' ? 'text-orange-600 dark:text-orange-400' :
        direction === 'buy' ? 'text-blue-600 dark:text-blue-400' :
        'text-text-muted'
      }`}>
        {direction === 'spread' ? `${value}%` : value.toFixed(4)}
      </span>
    </div>
  );
}

function RateBlock({ label, href, buy, sell }: { label: string; href: string; buy: number; sell: number }) {
  return (
    <div className="space-y-1.5">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] font-semibold text-text-muted hover:text-accent-info uppercase tracking-wider"
      >
        {label} ↗
      </a>
      <div className="space-y-0.5">
        <RateRow label="Kupno USD" value={sell} direction="sell" />
        <RateRow label="Sprzedaż USD" value={buy} direction="buy" />
        <RateRow label="Spread" value={parseFloat(spreadPct(buy, sell))} direction="spread" />
      </div>
    </div>
  );
}

export function KantorSidebar({ rates }: KantorSidebarProps) {
  const { alior, nbp, isLoading, error, lastUpdated } = rates;
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!expanded) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [expanded]);

  // Close on Escape
  useEffect(() => {
    if (!expanded) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setExpanded(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [expanded]);

  const primaryRate = alior?.sell ?? nbp?.sell ?? 0;
  const hasData = !!(alior || nbp);

  return (
    <div ref={panelRef} className="fixed right-0 top-1/3 z-40" style={{ maxHeight: 'calc(100vh - 200px)' }}>
      {/* Collapsed pill */}
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-2 bg-bg-card border border-r-0 border-border-strong rounded-l-lg shadow-md hover:shadow-lg transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          aria-label="Pokaż kursy walut"
        >
          <ArrowDownUp size={12} className="text-accent-info shrink-0" aria-hidden="true" />
          <div className="text-xs">
            <div className="font-semibold text-text-primary tabular-nums whitespace-nowrap">
              {isLoading && !hasData ? '…' : primaryRate > 0 ? primaryRate.toFixed(2) : '—'}
            </div>
            <div className="text-[9px] text-text-faint leading-none">USD/PLN</div>
          </div>
          <ChevronLeft size={12} className="text-text-faint" aria-hidden="true" />
        </button>
      )}

      {/* Expanded card */}
      {expanded && (
        <div className="w-56 bg-bg-card border border-r-0 border-border-strong rounded-l-xl shadow-xl overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          <div className="p-3 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
                <ArrowDownUp size={13} className="text-accent-info" aria-hidden="true" />
                USD / PLN
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="p-0.5 rounded text-text-faint hover:text-text-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                aria-label="Zwiń kursy walut"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {isLoading && !hasData ? (
              <div className="text-xs text-text-faint animate-pulse motion-reduce:animate-none">Pobieram kursy…</div>
            ) : error && !hasData ? (
              <div className="text-xs text-accent-error">{error}</div>
            ) : (
              <>
                {alior && (
                  <RateBlock label="Alior Kantor" href="https://kantor.aliorbank.pl" buy={alior.buy} sell={alior.sell} />
                )}
                {alior && nbp && <hr className="border-border" />}
                {nbp && (
                  <RateBlock label="NBP (tabela C)" href="https://www.nbp.pl/home.aspx?f=/kursy/kursyc.html" buy={nbp.buy} sell={nbp.sell} />
                )}
              </>
            )}

            {/* Live indicator */}
            {!error && hasData && (
              <div className="flex items-center gap-1.5 text-[10px] text-text-faint">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-accent-success opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-success" />
                </span>
                <span>
                  {lastUpdated ? fmtTime(lastUpdated) : 'live'}
                  <span className="text-text-faint opacity-60"> · 60s</span>
                </span>
              </div>
            )}

            {/* How rates are used */}
            {hasData && !isLoading && (
              <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 rounded-md px-2.5 py-2 space-y-0.5">
                <div className="text-[10px] font-semibold text-accent-info uppercase tracking-wider">Jak liczymy?</div>
                {alior && (
                  <div className="text-[10px] text-text-secondary">
                    <strong className="text-text-primary">Kantor</strong> → wycena w PLN
                  </div>
                )}
                {nbp && (
                  <div className="text-[10px] text-text-secondary">
                    <strong className="text-text-primary">NBP</strong> → podatek Belki
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
