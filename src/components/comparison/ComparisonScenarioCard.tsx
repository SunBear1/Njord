import { Pencil } from 'lucide-react';
import type { ScenarioParams, ScenarioResult } from '../../types/scenario';
import { fmtPLN, fmtUSD } from '../../utils/formatting';

interface ComparisonScenarioCardProps {
  label: 'Bear' | 'Bull';
  scenario: ScenarioParams;
  result: ScenarioResult;
  currentPriceUSD: number;
  currentFxRate: number;
  benchmarkLabel: string;
  onEdit: () => void;
}

function formatFx(value: number): string {
  return new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value);
}

function benchmarkDisplayLabel(label: string): string {
  if (label === 'Konto') return 'Konto oszczędnościowe';
  if (label === 'Obligacje') return 'Obligacje skarbowe';
  return label;
}

export function ComparisonScenarioCard({
  label,
  scenario,
  result,
  currentPriceUSD,
  currentFxRate,
  benchmarkLabel,
  onEdit,
}: ComparisonScenarioCardProps) {
  const projectedPriceUSD = currentPriceUSD * (1 + scenario.deltaStock / 100);
  const projectedFxRate = currentFxRate * (1 + scenario.deltaFx / 100);
  const winnerText = result.stockBeatsBenchmark
    ? 'Akcje wygrywają'
    : `${benchmarkDisplayLabel(benchmarkLabel)} wygrywa`;
  const toneClass = label === 'Bear'
    ? 'border-danger/30 bg-danger/5'
    : 'border-success/30 bg-success/5';

  return (
    <article className={`rounded-2xl border p-5 shadow-sm space-y-4 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Scenariusz {label.toLowerCase()}</p>
          <h3 className="text-lg font-semibold text-text-primary">{winnerText}</h3>
          <p className="text-sm text-text-secondary">
            Przewaga: <strong className="text-text-primary">{fmtPLN(Math.abs(result.differencePLN))}</strong>
            {' '}({Math.abs(result.differencePercent).toFixed(1)}%).
          </p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg-card px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-muted transition-colors"
          aria-label={`Edytuj scenariusz ${label}`}
        >
          <Pencil size={14} aria-hidden="true" />
          Edytuj
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border/70 bg-bg-card/70 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Cena akcji</p>
          <p className="mt-1 text-base font-semibold text-text-primary">{fmtUSD(projectedPriceUSD)}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-bg-card/70 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">USD/PLN</p>
          <p className="mt-1 text-base font-semibold text-text-primary">{formatFx(projectedFxRate)}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-bg-card/70 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Akcje netto</p>
          <p className="mt-1 text-base font-semibold text-text-primary">{fmtPLN(result.stockNetEndValuePLN)}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-bg-card/70 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{benchmarkDisplayLabel(benchmarkLabel)}</p>
          <p className="mt-1 text-base font-semibold text-text-primary">{fmtPLN(result.benchmarkEndValuePLN)}</p>
        </div>
      </div>
    </article>
  );
}
