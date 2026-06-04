import { ArrowRightLeft } from 'lucide-react';
import type { ScenarioResult } from '../../types/scenario';
import { fmtPLN } from '../../utils/formatting';
import { getDecisionSummary, getScenarioConsistencyText } from '../../utils/comparisonDecision';

interface ComparisonDecisionSummaryProps {
  results: ScenarioResult[];
  horizonLabel: string;
}

function winnerDisplayLabel(label: string): string {
  if (label === 'Konto') return 'Konto oszczędnościowe';
  if (label === 'Obligacje') return 'Obligacje skarbowe';
  return label;
}

interface ComparisonDecisionSummaryProps {
  results: ScenarioResult[];
  horizonLabel: string;
}

export function ComparisonDecisionSummary({
  results,
  horizonLabel,
}: ComparisonDecisionSummaryProps) {
  const summary = getDecisionSummary(results);
  if (!summary) return null;

  const supportLabel = getScenarioConsistencyText(
    summary.supportingScenarioLabels,
    summary.conflictingScenarioLabels,
  );

  return (
    <section className="bg-bg-card rounded-xl border border-border shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="inline-flex items-center gap-2 rounded-full border border-accent-primary/30 bg-accent-primary/5 px-3 py-1 text-xs font-semibold text-accent-primary">
          <ArrowRightLeft size={14} aria-hidden="true" />
          Wynik porównania
        </span>
        <span className="text-xs font-medium text-text-muted">
          {summary.supportingScenarioCount}/{results.length} scenariuszy wspiera ten kierunek
        </span>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-text-primary">{summary.actionTitle}</h2>
        <p className="max-w-3xl text-sm text-text-secondary">{summary.actionSubtitle}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-bg-muted/40 p-4 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Scenariusz bazowy</p>
          <p className="text-base font-semibold text-text-primary">
            {winnerDisplayLabel(summary.winnerLabel)} {summary.winnerVerb}
          </p>
          <p className="text-sm text-text-secondary">
            o <strong className="text-text-primary tabular-nums">{fmtPLN(summary.winnerDiffPLN)}</strong>
            {' '}({summary.winnerDiffPct.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)
          </p>
        </div>

        <div className="rounded-xl border border-border bg-bg-muted/40 p-4 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Horyzont decyzji</p>
          <p className="text-base font-semibold text-text-primary">{horizonLabel}</p>
          <p className="text-sm text-text-secondary">
            Najpierw szybka odpowiedź, potem wskaźniki prowadzące do decyzji.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-bg-muted/40 p-4 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Jak czytać dalej wynik</p>
          <p className="text-base font-semibold text-text-primary">Najpierw sprawdź markery poniżej</p>
          <p className="text-sm text-text-secondary">
            {supportLabel} Jeśli scenariusze nie są zgodne, rozwiń pełną analizę.
          </p>
        </div>
      </div>
    </section>
  );
}
