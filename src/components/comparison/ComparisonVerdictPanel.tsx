import type { ScenarioResult } from '../../types/scenario';
import { fmtPLN } from '../../utils/formatting';
import { getDecisionSummary } from '../../utils/comparisonDecision';

interface ComparisonVerdictPanelProps {
  results: ScenarioResult[];
  assetLabel: string;
  horizonMonths: number;
  inflationRate: number;
}

function benchmarkDisplayLabel(label: string): string {
  if (label === 'Konto') return 'Konto oszczędnościowe';
  if (label === 'Obligacje') return 'Obligacje skarbowe';
  return label;
}

function benchmarkInstrumentLabel(label: string): string {
  if (label === 'Konto') return 'konto oszczędnościowe';
  if (label === 'Obligacje') return 'obligacje skarbowe';
  return 'ETF';
}

function horizonSummary(value: number): string {
  if (value <= 11) {
    return `${value} ${value === 1 ? 'miesiącu' : 'miesiącach'}`;
  }
  if (value % 12 === 0) {
    const years = value / 12;
    return `${years} ${years === 1 ? 'roku' : 'latach'}`;
  }
  return `${Math.floor(value / 12)} l. ${value % 12} mies.`;
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(value);
}

export function ComparisonVerdictPanel({
  results,
  assetLabel,
  horizonMonths,
  inflationRate,
}: ComparisonVerdictPanelProps) {
  const summary = getDecisionSummary(results);
  if (!summary) return null;

  const { baseResult } = summary;
  const capitalLabel = summary.winnerLabel === 'Akcje'
    ? `akcje ${assetLabel}`
    : benchmarkInstrumentLabel(baseResult.benchmarkLabel);
  const decisionCapital = summary.winnerLabel === 'Akcje'
    ? baseResult.stockNetEndValuePLN
    : baseResult.benchmarkEndValuePLN;

  return (
    <section className="rounded-2xl border border-border bg-bg-card shadow-sm p-6 space-y-5">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-primary">Werdykt</p>
        <h2 className="text-2xl font-bold text-text-primary">
          {summary.winnerLabel === 'Akcje' ? (
            <>
              Akcje <span className="text-accent-primary">{assetLabel}</span> {summary.winnerVerb} w scenariuszu bazowym
            </>
          ) : (
            `${benchmarkDisplayLabel(summary.winnerLabel)} ${summary.winnerVerb} w scenariuszu bazowym`
          )}
        </h2>
        <p className="max-w-3xl text-sm text-text-secondary">
          W tym horyzoncie przewaga nad{' '}
          {summary.winnerLabel === 'Akcje' ? (
            benchmarkDisplayLabel(baseResult.benchmarkLabel)
          ) : (
            <>
              akcjami <span className="font-semibold text-accent-primary">{assetLabel}</span>
            </>
          )}{' '}
          wynosi{' '}
          <strong className="text-text-primary">{fmtPLN(Math.abs(baseResult.differencePLN))}</strong>
          {' '}({Math.abs(baseResult.differencePercent).toFixed(1)}%).
        </p>
      </div>

      <article className="rounded-xl border border-accent-primary/20 bg-accent-primary/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-primary">Przewaga netto</p>
        <p className="mt-2 text-2xl font-semibold text-text-primary">{fmtPLN(Math.abs(baseResult.differencePLN))}</p>
      </article>

      <div className="grid grid-cols-1 gap-3">
        <article className="rounded-xl border border-border/70 bg-bg-muted/20 p-4">
          <p className="text-sm font-medium text-text-secondary">
            Wartość inwestycji w {capitalLabel} po {horizonSummary(horizonMonths)}
          </p>
          <p className="mt-2 text-base font-semibold text-text-primary">{fmtPLN(decisionCapital)}</p>
        </article>
      </div>

      {inflationRate > 0 && (
        <p className="text-xs text-text-muted">
          <span className="font-semibold text-text-secondary">Inflacja w tle {formatPercent(inflationRate)}%</span>
        </p>
      )}
    </section>
  );
}
