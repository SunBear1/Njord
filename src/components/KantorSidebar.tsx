import { ArrowDownUp } from 'lucide-react';
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

function RateBlock({ label, href, buy, sell }: { label: string; href: string; buy: number; sell: number }) {
  return (
    <div className="space-y-1">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 uppercase tracking-wider"
      >
        {label}
      </a>
      <div className="grid grid-cols-2 gap-x-2 text-xs">
        <div className="text-gray-400 dark:text-gray-500">Kupno USD</div>
        <div className="text-right font-mono text-red-600 dark:text-red-400 font-medium">{sell.toFixed(4)}</div>
        <div className="text-gray-400 dark:text-gray-500">Sprzedaż USD</div>
        <div className="text-right font-mono text-green-700 dark:text-green-400 font-medium">{buy.toFixed(4)}</div>
        <div className="text-gray-400 dark:text-gray-500">Spread</div>
        <div className="text-right font-mono text-gray-500 dark:text-gray-400">{spreadPct(buy, sell)}%</div>
      </div>
    </div>
  );
}

export function KantorSidebar({ rates }: KantorSidebarProps) {
  const { alior, nbp, isLoading, error, lastUpdated } = rates;

  return (
    <div className="w-48 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
        <ArrowDownUp size={12} className="text-blue-600 dark:text-blue-400" />
        <span>USD / PLN</span>
      </div>

      {isLoading && !alior && !nbp ? (
        <div className="text-[11px] text-gray-400 dark:text-gray-500 animate-pulse motion-reduce:animate-none">Pobieram kursy…</div>
      ) : error && !alior && !nbp ? (
        <div className="text-[11px] text-red-400">{error}</div>
      ) : (
        <>
          {alior && (
            <RateBlock
              label="Alior Kantor"
              href="https://kantor.aliorbank.pl"
              buy={alior.buy}
              sell={alior.sell}
            />
          )}

          {alior && nbp && <hr className="border-gray-200 dark:border-gray-700" />}

          {nbp && (
            <RateBlock
              label="NBP (tabela C)"
              href="https://www.nbp.pl/home.aspx?f=/kursy/kursyc.html"
              buy={nbp.buy}
              sell={nbp.sell}
            />
          )}
        </>
      )}

      {/* Live indicator + timestamp */}
      <div className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500">
        {!error && (alior || nbp) ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span>
              {lastUpdated ? fmtTime(lastUpdated) : 'live'}
              <span className="text-gray-300 dark:text-gray-600"> · 60s</span>
            </span>
          </>
        ) : null}
      </div>

      <p className="text-[9px] text-gray-300 dark:text-gray-600 leading-tight">
        Aktualnie wspierany jest tylko Alior Kantor.
      </p>

      {/* Role explanation — which rate is used where */}
      {(alior || nbp) && !isLoading && (
        <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-md px-2.5 py-2 space-y-1">
          <div className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider">Jak liczymy?</div>
          {alior && (
            <div className="flex items-start gap-1.5 text-[10px] text-gray-600 dark:text-gray-400">
              <span className="text-green-600 mt-0.5">●</span>
              <span><strong className="text-gray-700 dark:text-gray-300">Kantor</strong> → wycena portfela w PLN</span>
            </div>
          )}
          {nbp && (
            <div className="flex items-start gap-1.5 text-[10px] text-gray-600 dark:text-gray-400">
              <span className="text-blue-500 mt-0.5">●</span>
              <span><strong className="text-gray-700 dark:text-gray-300">NBP</strong> → podstawa podatku Belki</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
