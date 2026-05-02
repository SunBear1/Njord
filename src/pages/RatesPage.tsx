import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useMultiCurrencyRates, type CurrencyRateEntry, type RateDirection, type RateChangeInfo } from '../hooks/useMultiCurrencyRates';

const CURRENCY_META: Record<string, { symbol: string }> = {
  USD: { symbol: '$' },
  EUR: { symbol: '€' },
  GBP: { symbol: '£' },
};

function spreadPct(buy: number, sell: number): string {
  const avg = (sell + buy) / 2;
  if (!avg || !isFinite(avg)) return '—';
  return ((sell - buy) / avg * 100).toFixed(2);
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function DirectionIcon({ dir, animKey }: { dir: RateDirection; animKey: number }) {
  if (dir === 'up') return (
    <TrendingUp
      key={animKey}
      size={12}
      className="inline-block ml-1 text-success"
      style={{ animation: 'flash-fade 1.5s ease-out' }}
      aria-label="wzrost"
    />
  );
  if (dir === 'down') return (
    <TrendingDown
      key={animKey}
      size={12}
      className="inline-block ml-1 text-danger"
      style={{ animation: 'flash-fade 1.5s ease-out' }}
      aria-label="spadek"
    />
  );
  return null;
}

function RateCell({ value, dir, colorClass, animKey }: { value: number; dir: RateDirection; colorClass: string; animKey: number }) {
  return (
    <td className="px-3 py-3 text-right font-mono tabular-nums">
      <span
        key={dir !== null ? animKey : 0}
        className={`font-semibold ${colorClass}`}
        style={dir !== null ? { animation: 'value-pop 1.5s ease-out' } : undefined}
      >
        {value.toFixed(4)}
      </span>
      <DirectionIcon dir={dir} animKey={animKey} />
    </td>
  );
}

function SourceTable({ title, href, rates, changes, getRate, getDir, animKey }: {
  title: string;
  href: string;
  rates: CurrencyRateEntry[];
  changes: Record<string, RateChangeInfo>;
  getRate: (r: CurrencyRateEntry) => { buy: number; sell: number } | null;
  getDir: (c: RateChangeInfo) => { buy: RateDirection; sell: RateDirection };
  animKey: number;
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
                    <span className="font-semibold text-text-primary tabular-nums">
                      <span className="text-text-muted mr-1">{meta?.symbol}</span>{entry.currency}
                    </span>
                  </td>
                  <RateCell value={data.buy} dir={dirs.buy} colorClass="text-success" animKey={animKey} />
                  <RateCell value={data.sell} dir={dirs.sell} colorClass="text-danger" animKey={animKey} />
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
  const animKey = lastUpdated?.getTime() ?? 0;

  // Live wall clock — ticks every second regardless of whether rates changed
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Kursy walut</h1>
          <p className="text-sm text-text-muted mt-1">Porównanie kursów kupna i sprzedaży</p>
        </div>
        {hasData && (
          <div className="flex items-center gap-2 text-xs text-text-muted bg-bg-hover/60 rounded-lg px-3 py-1.5 border border-border">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            <span className="font-mono">{fmtTime(now)}</span>
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
              animKey={animKey}
            />
            <SourceTable
              title="NBP — Tabela C"
              href="https://www.nbp.pl/home.aspx?f=/kursy/kursyc.html"
              rates={rates}
              changes={changes}
              getRate={r => r.nbp ? { buy: r.nbp.buy, sell: r.nbp.sell } : null}
              getDir={c => ({ buy: c.nbpBuy, sell: c.nbpSell })}
              animKey={animKey}
            />
          </div>

          <p className="text-xs text-text-muted px-1">
            <strong className="text-success">Kupno</strong> — bank kupuje walutę od Ciebie (dostajesz mniej PLN, niższy kurs).{' '}
            <strong className="text-danger">Sprzedaż</strong> — bank sprzedaje Ci walutę (płacisz więcej PLN, wyższy kurs).
          </p>
        </>
      )}
    </div>
  );
}

export default RatesPage;
