import type { ScenarioResult } from '../../types/scenario';
import { fmtDiff, fmtPLN, fmtUSD } from '../../utils/formatting';
import { getDecisionSummary, getScenarioConsistencyText } from '../../utils/comparisonDecision';

interface ComparisonDecisionMarkersProps {
  results: ScenarioResult[];
  avgCostUSD?: number;
}

interface MarkerCard {
  label: string;
  value: string;
  tone: 'default' | 'success' | 'danger';
  helper: string;
}

export function ComparisonDecisionMarkers({
  results,
  avgCostUSD,
}: ComparisonDecisionMarkersProps) {
  const summary = getDecisionSummary(results);
  if (!summary) return null;

  const { baseResult } = summary;
  const currentPositionCard: MarkerCard = avgCostUSD && avgCostUSD > 0 && baseResult.costBasisValuePLN != null
    ? {
        label: 'Twój wynik dziś',
        value: fmtDiff(baseResult.unrealizedGainPLN ?? 0),
        tone: (baseResult.unrealizedGainPLN ?? 0) >= 0 ? 'success' : 'danger',
        helper: `vs zakup ${fmtUSD(avgCostUSD)}/akcję`,
      }
    : {
        label: 'Kapitał do decyzji',
        value: fmtPLN(baseResult.currentValuePLN),
        tone: 'default',
        helper: 'Tyle dziś pracuje w aktualnej pozycji.',
      };

  const markers: MarkerCard[] = [
    {
      label: 'Przewaga zwycięzcy',
      value: fmtPLN(summary.winnerDiffPLN),
      tone: 'success',
      helper: `W bazowym scenariuszu (${summary.winnerDiffPct.toFixed(1)}%)`,
    },
      {
        label: 'Spójność werdyktu',
        value: `${summary.supportingScenarioCount}/${results.length}`,
        tone: summary.conflictingScenarioCount === 0 ? 'success' : 'default',
        helper: getScenarioConsistencyText(
          summary.supportingScenarioLabels,
          summary.conflictingScenarioLabels,
        ),
      },
    currentPositionCard,
    {
      label: 'Inflacja w tle',
      value: baseResult.inflationTotalPercent > 0
        ? `-${baseResult.inflationTotalPercent.toFixed(1)}%`
        : 'Nominalnie',
      tone: baseResult.inflationTotalPercent > 0 ? 'danger' : 'default',
      helper: baseResult.inflationTotalPercent > 0
        ? 'Szacowana utrata siły nabywczej w całym horyzoncie.'
        : 'Brak korekty o inflację w tym wyniku.',
    },
  ];

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Dlaczego taki werdykt?</h2>
          <p className="text-sm text-text-secondary">
            Najważniejsze markery, które prowadzą do rekomendacji.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {markers.map((marker) => {
          const toneClass = marker.tone === 'success'
            ? 'border-success/30 bg-success/5'
            : marker.tone === 'danger'
              ? 'border-danger/30 bg-danger/5'
              : 'border-border bg-bg-card';

          return (
            <article
              key={marker.label}
              className={`rounded-xl border p-4 space-y-2 shadow-sm ${toneClass}`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{marker.label}</p>
              <p className="text-xl font-bold text-text-primary tabular-nums">{marker.value}</p>
              <p className="text-sm text-text-secondary">{marker.helper}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
