import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CandlestickChart, ChartColumnIncreasing, Scale } from 'lucide-react';
import type { PersistedComparisonTraitStats } from '../../utils/persistedState';

interface ComparisonStockTraitsProps {
  ticker: string;
  assetLabel: string;
  stats: PersistedComparisonTraitStats | null;
}

interface TraitCardProps {
  title: string;
  value: string;
  helper: string;
  level: 'low' | 'medium' | 'high';
  icon: ReactNode;
}

function volatilityLevel(sigma: number): 'low' | 'medium' | 'high' {
  if (sigma < 20) return 'low';
  if (sigma <= 40) return 'medium';
  return 'high';
}

function correlationLevel(r: number): 'low' | 'medium' | 'high' {
  const abs = Math.abs(r);
  if (abs < 0.3) return 'low';
  if (abs <= 0.7) return 'medium';
  return 'high';
}

const LEVEL_LABEL: Record<'low' | 'medium' | 'high', string> = {
  low: 'Niska',
  medium: 'Średnia',
  high: 'Wysoka',
};

const LEVEL_CLASS: Record<'low' | 'medium' | 'high', string> = {
  low: 'bg-success/10 text-success',
  medium: 'bg-warning/10 text-warning',
  high: 'bg-danger/10 text-danger',
};

function TraitCard({ title, value, helper, level, icon }: TraitCardProps) {
  return (
    <article className="rounded-2xl border border-border bg-bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-text-primary">
          {icon}
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${LEVEL_CLASS[level]}`}>
          {LEVEL_LABEL[level]}
        </span>
      </div>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
      <p className="text-sm text-text-secondary">{helper}</p>
    </article>
  );
}

export function ComparisonStockTraits({
  ticker,
  assetLabel,
  stats,
}: ComparisonStockTraitsProps) {
  if (!ticker || !assetLabel || !stats) return null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-text-primary">
          Cechy kursu spółki <span className="text-accent-primary">{assetLabel}</span>
        </h2>
        <p className="text-sm text-text-secondary">
          Szybki podgląd cech historycznych, które pomagają interpretować scenariusze.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <TraitCard
          title="Zmienność akcji"
          value={`${new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(stats.stockSigmaAnnual)}%`}
          helper="Roczna zmienność historyczna kursu akcji."
          level={volatilityLevel(stats.stockSigmaAnnual)}
          icon={<CandlestickChart size={18} aria-hidden="true" />}
        />
        <TraitCard
          title="Zmienność USD/PLN"
          value={`${new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(stats.fxSigmaAnnual)}%`}
          helper="Roczna zmienność kursu dolara wobec złotego."
          level={volatilityLevel(stats.fxSigmaAnnual)}
          icon={<ChartColumnIncreasing size={18} aria-hidden="true" />}
        />
        <TraitCard
          title="Korelacja z USD"
          value={new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(stats.correlation)}
          helper="Zależność między ruchem akcji i USD/PLN."
          level={correlationLevel(stats.correlation)}
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
