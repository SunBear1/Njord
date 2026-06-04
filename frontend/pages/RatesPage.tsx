import { useState, useEffect } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useMultiCurrencyRates, type CurrencyRateEntry, type RateChangeInfo } from '../hooks/useMultiCurrencyRates';
import { formatSpreadPct, getRateAnimationStyle, type RateDirection, toUserPerspectiveRate } from '../components/rates/ratePerspective';

const CURRENCY_META: Record<string, { symbol: string }> = {
  USD: { symbol: '$' },
  EUR: { symbol: '€' },
  GBP: { symbol: '£' },
};

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function DirectionIcon({ dir, animKey }: { dir: RateDirection; animKey: number }) {
  if (dir === 'up') return (
    <ArrowUp
      key={animKey}
      size={12}
      className="text-text-primary"
      style={getRateAnimationStyle(dir, 'flash-fade')}
      aria-label="wzrost"
    />
  );
  if (dir === 'down') return (
    <ArrowDown
      key={animKey}
      size={12}
      className="text-text-primary"
      style={getRateAnimationStyle(dir, 'flash-fade')}
      aria-label="spadek"
    />
  );
  return null;
}

function RateCell({ value, dir, animKey }: { value: number; dir: RateDirection; animKey: number }) {
  return (
    <td className="px-3 py-3 text-right font-mono tabular-nums">
      <span className="relative inline-flex items-center">
        <span
          key={dir !== null ? animKey : 0}
          className="font-semibold text-text-primary"
          style={getRateAnimationStyle(dir, 'value-pop')}
        >
          {value.toFixed(4)}
        </span>
        <span className="w-5 inline-flex justify-center">
          <DirectionIcon dir={dir} animKey={animKey} />
        </span>
      </span>
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
              <th className="px-3 py-2.5 text-right font-medium">Kupujesz</th>
              <th className="px-3 py-2.5 text-right font-medium">Sprzedajesz</th>
              <th className="px-3 py-2.5 text-right font-medium">Spread</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rates.map(entry => {
              const bankRate = getRate(entry);
              if (!bankRate) return null;
              const meta = CURRENCY_META[entry.currency];
              const userRate = toUserPerspectiveRate(bankRate);
              const bankDirs = changes[entry.currency] ? getDir(changes[entry.currency]) : { buy: null as RateDirection, sell: null as RateDirection };
              return (
                <tr key={entry.currency} className="hover:bg-bg-hover/50 transition-colors">
                  <td className="px-5 py-3">
                    <span className="font-semibold text-text-primary tabular-nums">
                      <span className="text-text-muted mr-1">{meta?.symbol}</span>{entry.currency}
                    </span>
                  </td>
                  <RateCell value={userRate.buyingRate} dir={bankDirs.sell} animKey={animKey} />
                  <RateCell value={userRate.sellingRate} dir={bankDirs.buy} animKey={animKey} />
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-text-muted text-xs">
                    {formatSpreadPct(userRate.buyingRate, userRate.sellingRate)}%
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
          <p className="text-sm text-text-muted mt-1">Porównanie kursów z perspektywy użytkownika</p>
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
          <div className="grid gap-5 lg:grid-cols-3">
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
            <SourceTable
              title="Walutomat"
              href="https://www.walutomat.pl"
              rates={rates}
              changes={changes}
              getRate={r => r.walutomat ? { buy: r.walutomat.buy, sell: r.walutomat.sell } : null}
              getDir={c => ({ buy: c.walutomatBuy, sell: c.walutomatSell })}
              animKey={animKey}
            />
          </div>

          <p className="text-xs text-text-muted px-1">
            <strong className="text-text-primary">Kupujesz</strong> — kupujesz walutę i płacisz więcej PLN, więc kurs jest wyższy.{' '}
            <strong className="text-text-primary">Sprzedajesz</strong> — sprzedajesz walutę i dostajesz mniej PLN, więc kurs jest niższy.
          </p>
        </>
      )}
    </div>
  );
}

export default RatesPage;
