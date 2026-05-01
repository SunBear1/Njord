import { RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useMultiCurrencyRates, type CurrencyRateEntry, type RateDirection, type RateChangeInfo } from '../hooks/useMultiCurrencyRates';

const CURRENCY_META: Record<string, { name: string; symbol: string }> = {
  USD: { name: 'Dolar amerykański', symbol: '$' },
  EUR: { name: 'Euro', symbol: '€' },
  GBP: { name: 'Funt szterling', symbol: '£' },
};

function spreadPct(buy: number, sell: number): string {
  const avg = (sell + buy) / 2;
  if (!avg || !isFinite(avg)) return '—';
  return ((sell - buy) / avg * 100).toFixed(2);
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function DirectionIcon({ dir }: { dir: RateDirection }) {
  if (dir === 'up') return <TrendingUp size={12} className="text-success inline-block ml-1" aria-label="wzrost" />;
  if (dir === 'down') return <TrendingDown size={12} className="text-danger inline-block ml-1" aria-label="spadek" />;
  return <Minus size={10} className="text-text-muted/40 inline-block ml-1" aria-hidden="true" />;
}

function RateCell({ value, dir, colorClass }: { value: number; dir: RateDirection; colorClass: string }) {
  return (
    <td className="px-3 py-3 text-right font-mono tabular-nums">
      <span className={`font-semibold ${colorClass}`}>
        {value.toFixed(4)}
      </span>
      <DirectionIcon dir={dir} />
    </td>
  );
}

function SourceTable({ title, href, rates, changes, getRate, getDir }: {
  title: string;
  href: string;
  rates: CurrencyRateEntry[];
  changes: Record<string, RateChangeInfo>;
  getRate: (r: CurrencyRateEntry) => { buy: number; sell: number } | null;
  getDir: (c: RateChangeInfo) => { buy: RateDirection; sell: RateDirection };
}) {
  const hasData = rates.some(r => getRate(r) !== null);
  if (!hasData) return null;

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden shadow-sm">
      <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-bg-hover/40">
        <h2 className="font-semibold text-text-primary text-base">{title}</h2>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-accent-primary hover:underline transition-colors"
        >
          Źródło ↗
        </a>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-muted text-xs uppercase tracking-wider">
              <th className="px-5 py-2.5 text-left font-medium">Waluta</th>
              <th className="px-3 py-2.5 text-right font-medium">Kupno</th>
              <th className="px-3 py-2.5 text-right font-medium">Sprzedaż</th>
              <th className="px-3 py-2.5 text-right font-medium">Spread</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rates.map(entry => {
              const data = getRate(entry);
              if (!data) return null;
              const meta = CURRENCY_META[entry.currency];
              const dirs = changes[entry.currency] ? getDir(changes[entry.currency]) : { buy: null as RateDirection, sell: null as RateDirection };
              return (
                <tr key={entry.currency} className="hover:bg-bg-hover/50 transition-colors">
                  <td className="px-5 py-3">
                    <div>
                      <span className="font-semibold text-text-primary">{meta?.symbol} {entry.currency}/PLN</span>
                      <span className="text-xs text-text-muted ml-2">{meta?.name}</span>
                    </div>
                  </td>
                  <RateCell value={data.buy} dir={dirs.buy} colorClass="text-success" />
                  <RateCell value={data.sell} dir={dirs.sell} colorClass="text-danger" />
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-text-muted text-xs">
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
  const { rates, changes, isLoading, error, lastUpdated } = useMultiCurrencyRates();
  const hasData = rates.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Kursy walut</h1>
          <p className="text-sm text-text-muted mt-1">Porównanie kursów kupna i sprzedaży — odświeżanie co 15 s</p>
        </div>
        {lastUpdated && (
          <div className="flex items-center gap-2 text-xs text-text-muted bg-bg-hover/60 rounded-lg px-3 py-1.5 border border-border">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            <span className="font-mono">{fmtTime(lastUpdated)}</span>
            <RefreshCw size={11} className={`opacity-60 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </div>
        )}
      </div>

      {isLoading && !hasData && (
        <div className="bg-bg-card border border-border rounded-xl p-12 text-center text-text-muted animate-pulse motion-reduce:animate-none">
          Pobieram kursy walut…
        </div>
      )}

      {error && !hasData && (
        <div className="bg-bg-card border border-error/30 rounded-xl p-8 text-center text-error">
          {error}
        </div>
      )}

      {hasData && (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <SourceTable
              title="Alior Kantor"
              href="https://kantor.aliorbank.pl"
              rates={rates}
              changes={changes}
              getRate={r => r.alior ? { buy: r.alior.buy, sell: r.alior.sell } : null}
              getDir={c => ({ buy: c.aliorBuy, sell: c.aliorSell })}
            />
            <SourceTable
              title="NBP — Tabela C"
              href="https://www.nbp.pl/home.aspx?f=/kursy/kursyc.html"
              rates={rates}
              changes={changes}
              getRate={r => r.nbp ? { buy: r.nbp.buy, sell: r.nbp.sell } : null}
              getDir={c => ({ buy: c.nbpBuy, sell: c.nbpSell })}
            />
          </div>

          <div className="bg-bg-hover/50 border border-border rounded-xl px-5 py-4 text-xs text-text-muted space-y-1.5">
            <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-2">Jak czytać tabelę — perspektywa banku/kantoru</p>
            <p>
              <strong className="text-success">Kupno</strong> — bank kupuje walutę od Ciebie (dostajesz mniej PLN, niższy kurs).
            </p>
            <p>
              <strong className="text-danger">Sprzedaż</strong> — bank sprzedaje Ci walutę (płacisz więcej PLN, wyższy kurs).
            </p>
            <p>
              <strong className="text-text-secondary">Spread</strong> — różnica procentowa między sprzedażą a kupnem. Im mniejszy, tym korzystniejszy dla klienta.
            </p>
            <p>
              <TrendingUp size={11} className="text-success inline-block mr-0.5" aria-hidden="true" />
              <TrendingDown size={11} className="text-danger inline-block mr-1" aria-hidden="true" />
              Strzałki pokazują zmianę kursu od ostatniego odświeżenia.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default RatesPage;
