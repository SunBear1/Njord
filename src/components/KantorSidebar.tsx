import { ArrowDownUp } from 'lucide-react';
import type { KantorRates } from '../hooks/useKantorRates';

interface KantorSidebarProps {
  rates: KantorRates;
}

function spreadPct(buy: number, sell: number): string {
  return ((sell - buy) / ((sell + buy) / 2) * 100).toFixed(2);
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
        className="text-[11px] font-semibold text-gray-500 hover:text-blue-600 uppercase tracking-wider"
      >
        {label}
      </a>
      <div className="grid grid-cols-2 gap-x-2 text-xs">
        <div className="text-gray-400">Kupno</div>
        <div className="text-right font-mono text-green-700 font-medium">{buy.toFixed(4)}</div>
        <div className="text-gray-400">Sprzedaż</div>
        <div className="text-right font-mono text-red-600 font-medium">{sell.toFixed(4)}</div>
        <div className="text-gray-400">Spread</div>
        <div className="text-right font-mono text-gray-500">{spreadPct(buy, sell)}%</div>
      </div>
    </div>
  );
}

export function KantorSidebar({ rates }: KantorSidebarProps) {
  const { alior, nbp, isLoading, error, lastUpdated } = rates;

  return (
    <div className="w-48 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
        <ArrowDownUp size={13} className="text-blue-600" />
        <span>USD / PLN</span>
      </div>

      {isLoading && !alior && !nbp ? (
        <div className="text-[11px] text-gray-400 animate-pulse">Pobieram kursy…</div>
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

          {alior && nbp && <hr className="border-gray-200" />}

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
      <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
        {!error && (alior || nbp) ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span>
              {lastUpdated ? fmtTime(lastUpdated) : 'live'}
              <span className="text-gray-300"> · 60s</span>
            </span>
          </>
        ) : null}
      </div>

      <p className="text-[9px] text-gray-300 leading-tight">
        Kupno = ile PLN za 1 USD (sprzedajesz USD). Sprzedaż = ile PLN za 1 USD (kupujesz USD).
      </p>

      {/* Role explanation — which rate is used where */}
      {(alior || nbp) && !isLoading && (
        <div className="bg-blue-50/60 border border-blue-100 rounded-md px-2.5 py-2 space-y-1">
          <div className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider">Jak liczymy?</div>
          {alior && (
            <div className="flex items-start gap-1.5 text-[10px] text-gray-600">
              <span className="text-green-600 mt-0.5">●</span>
              <span><strong className="text-gray-700">Kantor</strong> → wycena portfela w PLN</span>
            </div>
          )}
          {nbp && (
            <div className="flex items-start gap-1.5 text-[10px] text-gray-600">
              <span className="text-blue-500 mt-0.5">●</span>
              <span><strong className="text-gray-700">NBP</strong> → podstawa podatku Belki</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
