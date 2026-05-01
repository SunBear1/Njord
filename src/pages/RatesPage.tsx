import { RefreshCw } from 'lucide-react';
import { useMultiCurrencyRates, type CurrencyRateEntry } from '../hooks/useMultiCurrencyRates';

const CURRENCY_META: Record<string, { flag: string; name: string }> = {
  USD: { flag: '🇺🇸', name: 'Dolar amerykański' },
  EUR: { flag: '🇪🇺', name: 'Euro' },
  GBP: { flag: '🇬🇧', name: 'Funt szterling' },
};

function spreadPct(buy: number, sell: number): string {
  const avg = (sell + buy) / 2;
  if (!avg || !isFinite(avg)) return '—';
  return ((sell - buy) / avg * 100).toFixed(2);
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function RateCell({ value, direction }: { value: number; direction: 'buy' | 'sell' }) {
  const isSell = direction === 'sell';
  return (
    <td className="px-3 py-2 text-right font-mono tabular-nums">
      <span className={`font-medium ${isSell ? 'text-orange-600 dark:text-orange-400' : 'text-green-700 dark:text-green-400'}`}>
        {value.toFixed(4)}
      </span>
    </td>
  );
}

function SourceTable({ title, href, rates, getRate }: {
  title: string;
  href: string;
  rates: CurrencyRateEntry[];
  getRate: (r: CurrencyRateEntry) => { buy: number; sell: number } | null;
}) {
  const hasData = rates.some(r => getRate(r) !== null);
  if (!hasData) return null;

  return (
    <div className="bg-bg-card dark:bg-surface-alt border border-border dark:border-edge rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border dark:border-edge flex items-center justify-between">
        <h2 className="font-semibold text-heading dark:text-on-dark">{title}</h2>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted dark:text-muted hover:text-accent transition-colors"
        >
          Źródło ↗
        </a>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted dark:text-muted text-xs uppercase tracking-wider bg-surface-muted dark:bg-surface-dark">
              <th className="px-4 py-2 text-left font-medium">Waluta</th>
              <th className="px-3 py-2 text-right font-medium text-green-700 dark:text-green-400">Kupno</th>
              <th className="px-3 py-2 text-right font-medium text-orange-600 dark:text-orange-400">Sprzedaż</th>
              <th className="px-3 py-2 text-right font-medium">Spread</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border dark:divide-edge">
            {rates.map(entry => {
              const data = getRate(entry);
              if (!data) return null;
              const meta = CURRENCY_META[entry.currency];
              return (
                <tr key={entry.currency} className="hover:bg-surface-muted dark:hover:bg-surface-dark transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg" aria-hidden="true">{meta?.flag}</span>
                      <div>
                        <div className="font-semibold text-heading dark:text-on-dark">{entry.currency}/PLN</div>
                        <div className="text-xs text-muted dark:text-muted">{meta?.name}</div>
                      </div>
                    </div>
                  </td>
                  <RateCell value={data.buy} direction="buy" />
                  <RateCell value={data.sell} direction="sell" />
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-muted dark:text-muted text-xs">
                    {spreadPct(data.buy, data.sell)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RatesPage() {
  const { rates, isLoading, error, lastUpdated } = useMultiCurrencyRates();
  const hasData = rates.length > 0;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-heading dark:text-on-dark">Kursy walut</h1>
          <p className="text-sm text-muted dark:text-muted mt-0.5">Porównanie kursów kupna i sprzedaży z różnych źródeł</p>
        </div>
        {lastUpdated && (
          <div className="flex items-center gap-1.5 text-xs text-muted dark:text-muted">
            <span className="relative flex h-1.5 w-1.5">
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
            </span>
            <span>{fmtTime(lastUpdated)}</span>
            <RefreshCw size={10} className="opacity-50" aria-hidden="true" />
            <span className="opacity-50">60s</span>
          </div>
        )}
      </div>

      {isLoading && !hasData && (
        <div className="bg-surface dark:bg-surface-alt border border-edge dark:border-edge rounded-xl p-8 text-center text-muted dark:text-muted animate-pulse motion-reduce:animate-none">
          Pobieram kursy walut…
        </div>
      )}

      {error && !hasData && (
        <div className="bg-surface dark:bg-surface-alt border border-error/30 rounded-xl p-6 text-center text-error">
          {error}
        </div>
      )}

      {hasData && (
        <>
          <SourceTable
            title="Alior Kantor"
            href="https://kantor.aliorbank.pl"
            rates={rates}
            getRate={r => r.alior ? { buy: r.alior.buy, sell: r.alior.sell } : null}
          />
          <SourceTable
            title="NBP — Tabela C"
            href="https://www.nbp.pl/home.aspx?f=/kursy/kursyc.html"
            rates={rates}
            getRate={r => r.nbp ? { buy: r.nbp.buy, sell: r.nbp.sell } : null}
          />

          <div className="bg-surface-muted dark:bg-surface-alt border border-edge dark:border-edge rounded-xl px-4 py-3 text-xs text-muted dark:text-muted space-y-1">
            <p className="text-[11px] font-semibold text-muted dark:text-muted uppercase tracking-wider mb-1.5">Jak czytać tabelę — perspektywa banku/kantoru</p>
            <p>
              <strong className="text-green-700 dark:text-green-400">Kupno</strong> — bank kupuje walutę od Ciebie (dostajesz mniej PLN, niższy kurs).
            </p>
            <p>
              <strong className="text-orange-600 dark:text-orange-400">Sprzedaż</strong> — bank sprzedaje Ci walutę (płacisz więcej PLN, wyższy kurs).
            </p>
            <p>
              <strong className="text-body dark:text-on-dark-muted">Spread</strong> — różnica procentowa między sprzedażą a kupnem. Im mniejszy, tym korzystniejszy dla klienta.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default RatesPage;
