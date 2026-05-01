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
    <div className="space-y-1.5">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] font-semibold text-muted dark:text-muted hover:text-accent transition-colors uppercase tracking-wider"
      >
        {label}
      </a>
      <div className="space-y-0.5">
        <div className="flex justify-between items-baseline gap-1.5 text-xs">
          <span className="text-faint dark:text-muted">Kupno</span>
          <span className="font-mono font-medium text-green-700 dark:text-green-400">{buy.toFixed(4)}</span>
        </div>
        <div className="flex justify-between items-baseline gap-1.5 text-xs">
          <span className="text-faint dark:text-muted">Sprzedaż</span>
          <span className="font-mono font-medium text-orange-600 dark:text-orange-400">{sell.toFixed(4)}</span>
        </div>
        <div className="flex justify-between items-baseline gap-1.5 text-xs">
          <span className="text-faint dark:text-muted">Spread</span>
          <span className="font-mono text-muted dark:text-muted">{spreadPct(buy, sell)}%</span>
        </div>
      </div>
    </div>
  );
}

export function KantorSidebar({ rates }: KantorSidebarProps) {
  const { alior, nbp, isLoading, error, lastUpdated } = rates;

  return (
    <div className="w-52 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-body dark:text-on-dark-muted">
          <ArrowDownUp size={12} className="text-accent" />
          <span>USD / PLN</span>
        </div>
        {!error && lastUpdated && (
          <div className="flex items-center gap-1 text-[10px] text-muted dark:text-muted">
            <span className="inline-flex rounded-full h-1.5 w-1.5 bg-success" />
            <span>{fmtTime(lastUpdated)}</span>
          </div>
        )}
      </div>

      {/* Bank perspective note */}
      <p className="text-[10px] text-faint dark:text-muted leading-snug">
        Kupno/Sprzedaż z perspektywy banku.
      </p>

      {isLoading && !alior && !nbp ? (
        <div className="text-[11px] text-faint dark:text-muted animate-pulse motion-reduce:animate-none">Pobieram kursy…</div>
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

          {alior && nbp && <hr className="border-edge dark:border-edge-strong" />}

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

      {/* Role explanation — which rate is used where */}
      {(alior || nbp) && !isLoading && (
        <div className="bg-surface-muted dark:bg-surface-dark-alt rounded-md px-2.5 py-2 space-y-1">
          <div className="text-[10px] font-semibold text-muted dark:text-muted uppercase tracking-wider">Jak liczymy?</div>
          {alior && (
            <div className="flex items-start gap-1.5 text-[10px] text-body dark:text-on-dark-muted">
              <span className="text-green-600 dark:text-green-400 mt-0.5">●</span>
              <span><strong>Kantor</strong> → wycena portfela w PLN</span>
            </div>
          )}
          {nbp && (
            <div className="flex items-start gap-1.5 text-[10px] text-body dark:text-on-dark-muted">
              <span className="text-accent mt-0.5">●</span>
              <span><strong>NBP</strong> → podstawa podatku Belki</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
