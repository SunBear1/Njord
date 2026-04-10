import type { ScenarioResult } from '../types/scenario';
import { fmtPLN, fmtDiff, fmtDiffPct } from '../utils/formatting';
import { Trophy, Info, TrendingDown } from 'lucide-react';
import { NBP_TARGET } from '../utils/inflationProjection';
import { Tooltip } from './Tooltip';

interface VerdictBannerProps {
  results: ScenarioResult[];
  /** Blended effective annual inflation rate used in calculations */
  inflationRate: number;
  /** Current observed monthly inflation rate (for display) */
  currentInflationRate: number;
  inflationSource?: string;
  cpiPeriod?: string;
  inflationStale?: boolean;
  horizonMonths: number;
}

const SCENARIO_STYLE = {
  bear: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-700 border border-red-200',
  },
  base: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700 border border-amber-200',
  },
  bull: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    badge: 'bg-green-100 text-green-700 border border-green-200',
  },
};

export function VerdictBanner({ results, inflationRate, currentInflationRate, inflationSource, cpiPeriod, inflationStale, horizonMonths }: VerdictBannerProps) {
  const bmLabel = results[0]?.benchmarkLabel ?? 'Konto';
  if (results.length === 0) return null;
  const hasInflation = inflationRate > 0;
  const horizonYears = horizonMonths / 12;

  const disclaimerTooltip = hasInflation
    ? `Podatek Belki 19% od zysku z akcji i ${bmLabel === 'Obligacje' ? 'obligacji' : 'konta oszczędnościowego'}. Inflacja ${inflationRate.toFixed(1)}% śr./rok (bieżąca ${currentInflationRate.toFixed(1)}% → cel NBP ${NBP_TARGET}%). Wartości realne zaznaczone kolorem.`
    : 'Podatek Belki 19% od zysku z akcji i konta/obligacji. Dane inflacyjne nieładowane — wartości nominalne.';

  return (
    <div className="space-y-3">
      {/* Header row: title + single disclaimer badge */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-semibold text-gray-800">Wyniki — co się bardziej opłaca?</h2>
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
          Podatek Belki 19% od zysku{hasInflation ? ` · inflacja ${inflationRate.toFixed(1)}%` : ''}
          <Tooltip
            content={disclaimerTooltip}
            width="w-72"
          />
        </span>
      </div>

      {/* Current value — above cards */}
      <div className="flex items-center gap-2 px-1">
        <Info size={16} className="text-gray-400 flex-shrink-0" aria-hidden="true" />
        <p className="text-sm text-gray-600">
          Aktualnie posiadasz akcje o wartości{' '}
          <strong className="text-gray-900">{fmtPLN(results[0]?.currentValuePLN ?? 0)}</strong>.{' '}
          Wyniki pokazują wartość po wybranym horyzoncie czasowym.
        </p>
      </div>

      {/* Scenario cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {results.map((r) => {
          const style = SCENARIO_STYLE[r.key] ?? SCENARIO_STYLE.base;
          const stockWins = r.stockBeatsBenchmark;

          return (
            <div
              key={r.key}
              className={`${style.bg} ${style.border} border-2 rounded-xl p-5 space-y-3`}
            >
              {/* Scenario badge */}
              <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${style.badge}`}>
                {r.key.charAt(0).toUpperCase() + r.key.slice(1)}
              </span>

              {/* Two-column comparison */}
              <div className="grid grid-cols-2 gap-2">
                {/* Akcje column */}
                <div className={`rounded-xl p-3 text-center space-y-1 ${stockWins ? 'bg-white shadow-sm ring-2 ring-amber-300' : 'bg-white/60'}`}>
                  <div className="flex items-center justify-center gap-1 text-xs font-bold text-blue-700 uppercase tracking-wide">
                    {stockWins && <Trophy size={12} className="text-amber-400" aria-hidden="true" />}
                    Akcje
                  </div>
                  <div className="text-base font-bold text-gray-800">{fmtPLN(r.stockNetEndValuePLN)}</div>
                  <div className="text-xs font-medium text-blue-600">{fmtDiffPct(r.stockReturnNet)}</div>
                  {hasInflation && (
                    <div className="text-[10px] text-orange-600 font-medium">
                      realnie {r.stockRealReturnNet >= 0 ? '+' : ''}{r.stockRealReturnNet.toFixed(2)}%
                    </div>
                  )}
                </div>

                {/* Benchmark column */}
                <div className={`rounded-xl p-3 text-center space-y-1 ${!stockWins ? 'bg-white shadow-sm ring-2 ring-amber-300' : 'bg-white/60'}`}>
                  <div className="flex items-center justify-center gap-1 text-xs font-bold text-purple-700 uppercase tracking-wide">
                    {!stockWins && <Trophy size={12} className="text-amber-400" aria-hidden="true" />}
                    {bmLabel}
                  </div>
                  <div className="text-base font-bold text-gray-800">{fmtPLN(r.benchmarkEndValuePLN)}</div>
                  <div className="text-xs font-medium text-purple-600">
                    {r.benchmarkReturnNet >= 0 ? '+' : ''}{r.benchmarkReturnNet.toFixed(2)}%
                  </div>
                  {hasInflation && (
                    <div className="text-[10px] text-orange-600 font-medium">
                      realnie {r.benchmarkRealReturnNet >= 0 ? '+' : ''}{r.benchmarkRealReturnNet.toFixed(2)}%
                    </div>
                  )}
                </div>
              </div>

              {/* Difference callout */}
              <div className="text-xs font-medium rounded-lg px-3 py-2 text-center bg-white/70 border border-white text-gray-700">
                Różnica: <strong>{fmtDiff(r.differencePLN)}</strong> ({fmtDiffPct(r.differencePercent)})
              </div>
            </div>
          );
        })}
      </div>

      {/* Inflation projection note */}
      {hasInflation && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-xs text-orange-800 flex items-start gap-2">
          <TrendingDown size={16} className="mt-0.5 flex-shrink-0 text-orange-500" aria-hidden="true" />
          <p>
            <strong>Inflacja {currentInflationRate.toFixed(1)}%</strong>
            {cpiPeriod ? ` (${inflationSource ?? 'Eurostat'}, ${cpiPeriod})` : ''}.{' '}
            Prognoza na {horizonYears.toFixed(horizonYears % 1 === 0 ? 0 : 1)} l.: <strong>{inflationRate.toFixed(1)}% śr./rok</strong>{' '}
            (model: zbieżność do celu NBP {NBP_TARGET}%).{' '}
            Skumulowana: <strong>{results[0]?.inflationTotalPercent.toFixed(1)}%</strong>.
            {inflationStale && (
              <span className="ml-1.5 text-amber-700 font-medium">
                ⚠ Dane mogą być nieaktualne — sprawdź Eurostat lub NBP.
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

