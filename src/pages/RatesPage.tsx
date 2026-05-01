import { RefreshCw } from 'lucide-react';
import { useMultiCurrencyRates, type CurrencyRateEntry } from '../hooks/useMultiCurrencyRates';

const CURRENCY_META: Record<string, { flag: string; name: string; symbol: string }> = {
  USD: { flag: '🇺🇸', name: 'Dolar amerykański', symbol: '$' },
  EUR: { flag: '🇪🇺', name: 'Euro', symbol: '€' },
  GBP: { flag: '🇬🇧', name: 'Funt szterling', symbol: '£' },
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
    <td className="px-3 py-2 text-right font-mono tabular-nums transition-colors duration-500">
      <span className={`font-medium ${isSell ? 'text-danger' : 'text-success'}`}>
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
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 className="font-semibold text-text-primary">{title}</h2>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-text-muted hover:text-accent-primary transition-colors"
        >
          Źródło ↗
        </a>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-muted text-xs uppercase tracking-wider bg-bg-hover">
              <th className="px-4 py-2 text-left font-medium">Waluta</th>
              <th className="px-3 py-2 text-right font-medium text-success">Kupno</th>
              <th className="px-3 py-2 text-right font-medium text-danger">Sprzedaż</th>
              <th className="px-3 py-2 text-right font-medium">Spread</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rates.map(entry => {
              const data = getRate(entry);
              if (!data) return null;
              const meta = CURRENCY_META[entry.currency];
              return (
                <tr key={entry.currency} className="hover:bg-bg-hover transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg" aria-hidden="true">{meta?.flag}</span>
                      <div>
                        <div className="font-semibold text-text-primary">{meta?.symbol} {entry.currency}/PLN</div>
                        <div className="text-xs text-text-muted">{meta?.name}</div>
                      </div>
                    </div>
                  </td>
                  <RateCell value={data.buy} direction="buy" />
                  <RateCell value={data.sell} direction="sell" />
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-text-muted text-xs">
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
          <h1 className="text-xl font-bold text-text-primary">Kursy walut</h1>
          <p className="text-sm text-text-muted mt-0.5">Porównanie kursów kupna i sprzedaży z różnych źródeł</p>
        </div>
        {lastUpdated && (
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            <span>{fmtTime(lastUpdated)}</span>
            <RefreshCw size={10} className={`opacity-50 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span className="opacity-50">auto</span>
          </div>
        )}
      </div>

      {isLoading && !hasData && (
        <div className="bg-bg-card border border-border rounded-xl p-8 text-center text-text-muted animate-pulse motion-reduce:animate-none">
          Pobieram kursy walut…
        </div>
      )}

      {error && !hasData && (
        <div className="bg-bg-card border border-error/30 rounded-xl p-6 text-center text-error">
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

          <div className="bg-bg-hover border border-border rounded-xl px-4 py-3 text-xs text-text-muted space-y-1">
            <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Jak czytać tabelę — perspektywa banku/kantoru</p>
            <p>
              <strong className="text-success">Kupno</strong> — bank kupuje walutę od Ciebie (dostajesz mniej PLN, niższy kurs).
            </p>
            <p>
              <strong className="text-danger">Sprzedaż</strong> — bank sprzedaje Ci walutę (płacisz więcej PLN, wyższy kurs).
            </p>
            <p>
              <strong className="text-text-secondary">Spread</strong> — różnica procentowa między sprzedażą a kupnem. Im mniejszy, tym korzystniejszy dla klienta.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default RatesPage;
