import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CandlestickChart, ChartColumnIncreasing, Scale } from 'lucide-react';
import type { VolatilityStats } from '../../hooks/useHistoricalVolatility';

interface ComparisonStockTraitsProps {
  ticker: string;
  stats: VolatilityStats | null;
}

interface TraitCardProps {
  title: string;
  value: string;
  helper: string;
  icon: ReactNode;
}

function TraitCard({ title, value, helper, icon }: TraitCardProps) {
  return (
    <article className="rounded-2xl border border-border bg-bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2 text-text-primary">
        {icon}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
      <p className="text-sm text-text-secondary">{helper}</p>
    </article>
  );
}

export function ComparisonStockTraits({
  ticker,
  stats,
}: ComparisonStockTraitsProps) {
  if (!ticker || !stats) return null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-text-primary">Cechy kursu spółki {ticker}</h2>
        <p className="text-sm text-text-secondary">
          Szybki podgląd cech historycznych, które pomagają interpretować scenariusze.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <TraitCard
          title="Zmienność akcji"
          value={`${stats.stockSigmaAnnual.toFixed(1)}%`}
          helper="Roczna zmienność historyczna kursu akcji."
          icon={<CandlestickChart size={18} aria-hidden="true" />}
        />
        <TraitCard
          title="Zmienność USD/PLN"
          value={`${stats.fxSigmaAnnual.toFixed(1)}%`}
          helper="Roczna zmienność kursu dolara wobec złotego."
          icon={<ChartColumnIncreasing size={18} aria-hidden="true" />}
        />
        <TraitCard
          title="Korelacja z USD"
          value={stats.correlation.toFixed(2)}
          helper="Zależność między ruchem akcji i USD/PLN."
          icon={<Scale size={18} aria-hidden="true" />}
        />

        <Link
          to={`/forecast?ticker=${encodeURIComponent(ticker)}`}
          className="rounded-2xl border border-accent-primary/30 bg-accent-primary/5 p-4 shadow-sm transition-colors hover:bg-accent-primary/10"
        >
          <div className="flex items-center gap-2 text-accent-primary">
            <ArrowRight size={18} aria-hidden="true" />
            <h3 className="text-sm font-semibold">Pełna prognoza ceny</h3>
          </div>
          <p className="mt-3 text-2xl font-bold text-text-primary">{ticker}</p>
          <p className="mt-2 text-sm text-text-secondary">
            Przejdź do podstrony prognozy z już wybranym tickerem.
          </p>
        </Link>
      </div>
    </section>
  );
}
