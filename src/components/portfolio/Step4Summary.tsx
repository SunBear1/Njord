import { useState, useMemo, memo } from 'react';
import {
  TrendingUp,
  Wallet,
  Shield,
  PiggyBank,
  ChevronDown,
  ChevronUp,
  Edit3,
  AlertCircle,
  Calculator,
  Percent,
  Target,
  Award,
} from 'lucide-react';
import type { WizardStep, WizardState } from '../../types/portfolio';
import { TAX_RATES } from '../../types/portfolio';
import type { PortfolioCalcResult } from '../../utils/accumulationCalculator';
import AccumulationChart from '../AccumulationChart';
import { fmtPLN } from '../../utils/formatting';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Step4Props {
  result: PortfolioCalcResult;
  wizardState: WizardState;
  goToStep: (step: WizardStep) => void;
  isDark?: boolean;
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  colorClass?: string;
  emphasized?: boolean;
}

function MetricCard({ icon, label, value, colorClass = 'text-body dark:text-on-dark-muted', emphasized = false }: MetricCardProps) {
  return (
    <div className="bg-surface dark:bg-surface-dark rounded-xl border border-edge dark:border-edge-strong shadow-sm p-5 flex items-start gap-3">
      <div className={`mt-0.5 ${colorClass}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted dark:text-muted leading-tight">{label}</p>
        <p className={`font-semibold tabular-nums truncate ${emphasized ? 'text-lg' : 'text-base'} ${colorClass}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

// ─── Edit Button ──────────────────────────────────────────────────────────────

function EditButton({ step, goToStep }: { step: WizardStep; goToStep: (s: WizardStep) => void }) {
  return (
    <button
      type="button"
      onClick={() => goToStep(step)}
      className="inline-flex items-center gap-1 text-xs text-accent dark:text-accent hover:text-accent-hover dark:hover:text-accent transition-colors"
      aria-label={`Edytuj krok ${step}`}
    >
      <Edit3 size={12} />
      Edytuj
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function Step4Summary({ result, wizardState, goToStep, isDark }: Step4Props) {
  const [tableOpen, setTableOpen] = useState(false);

  const { horizonYears, inflationRate } = wizardState.personalData;

  const derived = useMemo(() => {
    const grossValue = result.buckets.reduce((sum, b) => sum + b.terminalGrossValue, 0);

    // IKE savings: tax the user doesn't pay (IKE exit tax is 0%)
    const ikeBucket = result.buckets.find(b => b.wrapper === 'ike' && b.enabled);
    const ikeSavings = ikeBucket
      ? Math.max(0, ikeBucket.terminalGrossValue - ikeBucket.totalContributed) * TAX_RATES.belka
      : 0;

    // IKZE ryczałt 10% tax paid
    const ikzeBucket = result.buckets.find(b => b.wrapper === 'ikze' && b.enabled);
    const ikzeExitTax = ikzeBucket?.exitTaxPaid ?? 0;

    // Regular bucket taxes (Belka on gains + dividend tax)
    const regularBucket = result.buckets.find(b => b.wrapper === 'regular' && b.enabled);
    const regularTax = (regularBucket?.exitTaxPaid ?? 0) + (regularBucket?.dividendTaxPaid ?? 0);

    // Real value after inflation
    const realValue = result.totalTerminalNet / Math.pow(1 + inflationRate / 100, horizonYears);

    // Effective net CAGR
    const cagr =
      result.totalContributed > 0 && horizonYears > 0
        ? (Math.pow(result.totalTerminalNet / result.totalContributed, 1 / horizonYears) - 1) * 100
        : 0;

    return { grossValue, ikeSavings, ikzeExitTax, regularTax, realValue, cagr };
  }, [result, horizonYears, inflationRate]);

  return (
    <div className="space-y-6">
      {/* ── Section: Key Metrics ────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-heading dark:text-on-dark">
          Podsumowanie portfela
        </h2>
        <EditButton step={1} goToStep={goToStep} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <MetricCard
          icon={<Wallet size={18} />}
          label="Suma wpłat"
          value={fmtPLN(result.totalContributed)}
        />
        <MetricCard
          icon={<TrendingUp size={18} />}
          label="Wartość portfela (brutto)"
          value={fmtPLN(derived.grossValue)}
          colorClass="text-accent dark:text-accent"
        />
        <MetricCard
          icon={<Shield size={18} />}
          label="Oszczędność IKE (brak Belki)"
          value={fmtPLN(derived.ikeSavings)}
          colorClass="text-green-600 dark:text-green-400"
        />
        <MetricCard
          icon={<PiggyBank size={18} />}
          label="Łączna ulga IKZE (PIT)"
          value={fmtPLN(result.ikzePitDeductionValue)}
          colorClass="text-violet-600 dark:text-violet-400"
        />
        <MetricCard
          icon={<AlertCircle size={18} />}
          label="Podatek IKZE (ryczałt 10%)"
          value={fmtPLN(derived.ikzeExitTax)}
          colorClass="text-orange-600 dark:text-orange-400"
        />
        <MetricCard
          icon={<Calculator size={18} />}
          label="Podatek Belki (nadwyżka)"
          value={fmtPLN(derived.regularTax)}
          colorClass="text-red-600 dark:text-red-400"
        />
        <MetricCard
          icon={<Award size={18} />}
          label="Wartość NETTO"
          value={fmtPLN(result.totalTerminalNet)}
          colorClass="text-green-700 dark:text-green-300"
          emphasized
        />
        <MetricCard
          icon={<Target size={18} />}
          label="Wartość realna (po inflacji)"
          value={fmtPLN(derived.realValue)}
          colorClass="text-amber-600 dark:text-amber-400"
        />
        <MetricCard
          icon={<Percent size={18} />}
          label="Efektywna CAGR netto"
          value={`${derived.cagr.toFixed(2)}%`}
          colorClass="text-accent dark:text-accent"
        />
      </div>

      {/* ── Section: Counterfactual ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-heading dark:text-on-dark">
          Porównanie: z IKE/IKZE vs bez
        </h3>
        <EditButton step={2} goToStep={goToStep} />
      </div>

      <div className="bg-surface dark:bg-surface-dark rounded-xl border border-edge dark:border-edge-strong shadow-sm p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-xs text-muted dark:text-muted mb-1">Z IKE/IKZE</p>
            <p className="text-xl font-bold text-green-700 dark:text-green-300 tabular-nums">
              {fmtPLN(result.totalTerminalNet)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted dark:text-muted mb-1">Bez (zwykły rachunek)</p>
            <p className="text-xl font-bold text-body dark:text-on-dark-muted tabular-nums">
              {fmtPLN(result.counterfactualNet)}
            </p>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-edge dark:border-edge-strong flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm">
          <span className={result.taxSavings >= 0 ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-red-600 dark:text-red-400 font-semibold'}>
            {result.taxSavings >= 0 ? '+' : ''}{fmtPLN(result.taxSavings)}
          </span>
          <span className={result.taxSavingsPercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
            ({result.taxSavingsPercent >= 0 ? '+' : ''}{result.taxSavingsPercent.toFixed(2)}%)
          </span>
        </div>
      </div>

      {/* ── Section: Chart ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-heading dark:text-on-dark">
          Projekcja wzrostu
        </h3>
        <EditButton step={3} goToStep={goToStep} />
      </div>

      <AccumulationChart
        data={result.combinedSnapshots}
        milestones={result.milestones}
        isDark={isDark}
      />

      {/* ── Section: Annual Table (collapsible) ────────────────────────── */}
      <div className="bg-surface dark:bg-surface-dark rounded-xl border border-edge dark:border-edge-strong shadow-sm">
        <button
          type="button"
          onClick={() => setTableOpen(prev => !prev)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-heading dark:text-on-dark hover:bg-surface-alt dark:hover:bg-surface-dark-alt/50 transition-colors rounded-xl"
          aria-expanded={tableOpen}
        >
          <span>Szczegóły roczne</span>
          {tableOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {tableOpen && (
          <div className="overflow-x-auto px-2 pb-4">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-edge dark:border-edge-strong text-muted dark:text-muted sticky top-0 bg-surface dark:bg-surface-dark">
                  <th className="px-2 py-2 font-medium">Rok</th>
                  <th className="px-2 py-2 font-medium text-right">Wpłaty IKE</th>
                  <th className="px-2 py-2 font-medium text-right">Wartość IKE</th>
                  <th className="px-2 py-2 font-medium text-right">Wpłaty IKZE</th>
                  <th className="px-2 py-2 font-medium text-right">Wartość IKZE</th>
                  <th className="px-2 py-2 font-medium text-right">Ulga PIT</th>
                  <th className="px-2 py-2 font-medium text-right">Wpłaty nadw.</th>
                  <th className="px-2 py-2 font-medium text-right">Wartość nadw.</th>
                  <th className="px-2 py-2 font-medium text-right">Suma wpłat</th>
                  <th className="px-2 py-2 font-medium text-right">Suma wartość</th>
                  <th className="px-2 py-2 font-medium text-right">Zysk</th>
                </tr>
              </thead>
              <tbody>
                {result.annualTable.map((row, i) => (
                  <tr
                    key={row.year}
                    className={`border-b border-edge dark:border-edge-strong/50 ${i % 2 === 0 ? 'bg-surface-alt/50 dark:bg-surface-dark/50' : ''}`}
                  >
                    <td className="px-2 py-1.5 font-medium text-body dark:text-on-dark-muted">{row.year}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-body dark:text-on-dark-muted">{fmtPLN(row.ikeContributed)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-body dark:text-on-dark-muted">{fmtPLN(row.ikeValue)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-body dark:text-on-dark-muted">{fmtPLN(row.ikzeContributed)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-body dark:text-on-dark-muted">{fmtPLN(row.ikzeValue)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-violet-600 dark:text-violet-400">{fmtPLN(row.ikzePitDeduction)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-body dark:text-on-dark-muted">{fmtPLN(row.regularContributed)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-body dark:text-on-dark-muted">{fmtPLN(row.regularValue)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-medium text-body dark:text-on-dark-muted">{fmtPLN(row.totalContributed)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-medium text-body dark:text-on-dark-muted">{fmtPLN(row.totalValue)}</td>
                    <td className={`px-2 py-1.5 text-right tabular-nums font-medium ${row.cumulativeGain >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {fmtPLN(row.cumulativeGain)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const MemoizedStep4Summary = memo(Step4Summary);

export { MemoizedStep4Summary as Step4Summary };
