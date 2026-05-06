import type { ScenarioResult } from '../../types/scenario';
import { fmtPLN } from '../../utils/formatting';
import { getDecisionSummary } from '../../utils/comparisonDecision';

interface ComparisonVerdictPanelProps {
  results: ScenarioResult[];
  assetLabel: string;
}

function benchmarkDisplayLabel(label: string): string {
  if (label === 'Konto') return 'Konto oszczędnościowe';
  if (label === 'Obligacje') return 'Obligacje skarbowe';
  return label;
}

export function ComparisonVerdictPanel({
  results,
  assetLabel,
}: ComparisonVerdictPanelProps) {
  const summary = getDecisionSummary(results);
  if (!summary) return null;

  const { baseResult } = summary;
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
          {' '}({Math.abs(baseResult.differencePercent).toFixed(1)}%). To jest najważniejsza informacja w wyniku.
        </p>
      </div>

      <article className="rounded-xl border border-accent-primary/20 bg-accent-primary/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-primary">Przewaga po podatku</p>
        <p className="mt-2 text-2xl font-semibold text-text-primary">{fmtPLN(Math.abs(baseResult.differencePLN))}</p>
        <p className="mt-1 text-sm text-text-secondary">
          O tyle więcej zostaje po podatku w scenariuszu bazowym przy zwycięskiej decyzji.
        </p>
      </article>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <article className="rounded-xl border border-border/70 bg-bg-muted/20 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Kapitał do decyzji</p>
          <p className="mt-2 text-base font-semibold text-text-primary">{fmtPLN(baseResult.currentValuePLN)}</p>
          <p className="mt-1 text-sm text-text-secondary">
            Tyle wynosi przewaga zwycięzcy po podatku w scenariuszu bazowym.
          </p>
        </article>

        <article className="rounded-xl border border-border/70 bg-bg-muted/20 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Inflacja w tle</p>
          <p className="mt-2 text-base font-semibold text-text-primary">
            {baseResult.inflationTotalPercent > 0 ? `${baseResult.inflationTotalPercent.toFixed(1)}%` : 'Brak korekty'}
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            Informacja pomocnicza: pokazuje, jak część nominalnego zysku zjada utrata siły nabywczej.
          </p>
        </article>
      </div>
    </section>
  );
}
