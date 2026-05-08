import { Pencil } from 'lucide-react';
import type { ScenarioParams, ScenarioResult } from '../../types/scenario';
import type { CalcInputs } from '../../utils/calculations';
import { calcBreakevenStockPrice } from '../../utils/calculations';
import { fmtPLN, fmtUSD } from '../../utils/formatting';

interface ComparisonScenarioCardProps {
  label: 'Bear' | 'Bull';
  scenario: ScenarioParams;
  result: ScenarioResult;
  currentPriceUSD: number;
  currentFxRate: number;
  horizonMonths: number;
  calcInputs: CalcInputs;
  onEdit: () => void;
}

function formatFx(value: number): string {
  return new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value);
}

function winnerShortText(stockBeats: boolean, benchmarkLabel: string, differencePLN: number): string {
  const formatted = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(Math.abs(differencePLN));
  if (stockBeats) return `🏆 Akcje lepsze o ${formatted}`;
  if (benchmarkLabel === 'Konto') return `🏆 Konto oszczędnościowe lepsze o ${formatted}`;
  if (benchmarkLabel === 'Obligacje') return `🏆 Obligacje skarbowe lepsze o ${formatted}`;
  return `🏆 ETF lepszy o ${formatted}`;
}

function benchmarkFullName(label: string): string {
  if (label === 'Konto') return 'Konto oszcz.';
  if (label === 'Obligacje') return 'Obligacje';
  return label;
}

function horizonSummary(months: number): string {
  if (months % 12 === 0) {
    const years = months / 12;
    return `${years} ${years === 1 ? 'roku' : 'latach'}`;
  }
  if (months <= 11) return `${months} mies.`;
  return `${Math.floor(months / 12)} l. ${months % 12} mies.`;
}

export function ComparisonScenarioCard({
  label,
  scenario,
  result,
  currentPriceUSD,
  currentFxRate,
  horizonMonths,
  calcInputs,
  onEdit,
}: ComparisonScenarioCardProps) {
  const projectedPriceUSD = currentPriceUSD * (1 + scenario.deltaStock / 100);
  const projectedFxRate = currentFxRate * (1 + scenario.deltaFx / 100);
  const winnerText = winnerShortText(result.stockBeatsBenchmark, result.benchmarkLabel, result.differencePLN);
  const breakevenPrice = calcBreakevenStockPrice(calcInputs, result.benchmarkEndValuePLN, scenario.deltaFx);
  const toneClass = label === 'Bear'
    ? 'border-danger/30 bg-danger/5'
    : 'border-success/30 bg-success/5';

  return (
    <article
      data-testid={`comparison-scenario-${label.toLowerCase()}`}
      className={`rounded-2xl border p-5 shadow-sm space-y-4 ${toneClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Scenariusz {label.toLowerCase()}</p>
          <h3 className="text-lg font-semibold text-text-primary">
            {winnerText} ({Math.abs(result.differencePercent).toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)
          </h3>
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
        <div data-testid={`comparison-scenario-${label.toLowerCase()}-metric`} className="rounded-xl border border-border/70 bg-bg-card/70 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Cena akcji</p>
          <p className="mt-1 text-base font-semibold text-text-primary">{fmtUSD(projectedPriceUSD)}</p>
        </div>
        <div data-testid={`comparison-scenario-${label.toLowerCase()}-metric`} className="rounded-xl border border-border/70 bg-bg-card/70 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">USD/PLN</p>
          <p className="mt-1 text-base font-semibold text-text-primary">{formatFx(projectedFxRate)}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-bg-card/70 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Wartość akcji po {horizonSummary(horizonMonths)}
          </p>
          <p className="mt-1 text-base font-semibold text-text-primary">{fmtPLN(result.stockNetEndValuePLN)}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-bg-card/70 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Wartość {benchmarkFullName(result.benchmarkLabel)} po {horizonSummary(horizonMonths)}
          </p>
          <p className="mt-1 text-base font-semibold text-text-primary">{fmtPLN(result.benchmarkEndValuePLN)}</p>
        </div>
      </div>

      {breakevenPrice !== null && (
        <div className="rounded-xl border border-border/50 bg-bg-muted/30 px-3 py-2 text-xs text-text-secondary">
          <span className="font-medium text-text-primary">Próg rentowności: </span>
          akcje muszą kosztować co najmniej{' '}
          <span className="font-semibold text-text-primary">{fmtUSD(breakevenPrice)}</span>
          {' '}po {horizonSummary(horizonMonths)}, aby trzymanie ich opłacało się bardziej niż reinwestycja.
        </div>
      )}
    </article>
  );
}
