import type { ScenarioResult } from '../types/scenario';
import { fmtPLN, fmtDiff, fmtDiffPct } from '../utils/formatting';
import { Trophy, Info, TrendingDown } from 'lucide-react';
import { NBP_TARGET } from '../utils/inflationProjection';

interface VerdictBannerProps {
  results: ScenarioResult[];
  /** Blended effective annual inflation rate used in calculations */
  inflationRate: number;
  /** Current observed monthly inflation rate (for display) */
  currentInflationRate: number;
  inflationSource?: string;
  cpiPeriod?: string;
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

export function VerdictBanner({ results, inflationRate, currentInflationRate, inflationSource, cpiPeriod, horizonMonths }: VerdictBannerProps) {
  const bmLabel = results[0]?.benchmarkLabel ?? 'Konto';
  const hasInflation = inflationRate > 0;
  const horizonYears = horizonMonths / 12;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-semibold text-gray-800">Wyniki — co się bardziej opłaca?</h2>
        {hasInflation && (
          <span className="inline-flex items-center gap-1 text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full">
            <TrendingDown size={11} aria-hidden="true" />
            inflacja {inflationRate.toFixed(1)}% śr./rok
          </span>
        )}
      </div>
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
                    {stockWins && <Trophy size={11} className="text-amber-400" aria-hidden="true" />}
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
                    {!stockWins && <Trophy size={11} className="text-amber-400" aria-hidden="true" />}
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

              {/* Per-card inflation note */}
              {hasInflation && (
                <p className="text-[10px] text-center text-orange-600/80 leading-snug">
                  Wartości nominalne · realnie po inflacji ({inflationRate.toFixed(1)}%) wyróżnione kolorem
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Inflation warning */}
      {hasInflation && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm text-orange-800">
          <div className="flex items-start gap-2">
            <TrendingDown size={16} className="mt-0.5 flex-shrink-0 text-orange-500" aria-hidden="true" />
            <div className="space-y-1">
              <p>
                <strong>Inflacja obniża realną wartość zysku.</strong>{' '}
                Aktualna: <strong>{currentInflationRate.toFixed(1)}% r/r</strong>
                {cpiPeriod ? ` (${inflationSource}, ${cpiPeriod})` : ''}.{' '}
                Prognoza dla Twojego horyzontu ({horizonYears.toFixed(horizonYears % 1 === 0 ? 0 : 1)} l.):{' '}
                <strong>{inflationRate.toFixed(1)}% śr. rocznie</strong>{' '}
                (zbieżność bieżącej stawki do celu NBP {NBP_TARGET}%).
              </p>
              <p className="text-orange-700/80 text-xs">
                Skumulowana inflacja w horyzoncie:{' '}
                <strong>{results[0]?.inflationTotalPercent.toFixed(1)}%</strong>.{' '}
                Model zakłada stopniowy powrót inflacji do celu NBP ({NBP_TARGET}%)
                — to standardowe przybliżenie makroekonomiczne, nie prognoza.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary note */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
        <div className="flex items-start gap-2">
          <Info size={16} className="mt-0.5 flex-shrink-0 text-gray-400" aria-hidden="true" />
          <p>
            Aktualnie posiadasz akcje o wartości{' '}
            <strong className="text-gray-900">{fmtPLN(results[0]?.currentValuePLN ?? 0)}</strong>.{' '}
            Porównanie uwzględnia podatek Belki (19%) od zysku zarówno z akcji, jak i z{' '}
            {bmLabel === 'Obligacje' ? 'obligacji' : 'konta oszczędnościowego'}.
            {hasInflation
              ? ` Inflacja uwzględniona: ${inflationRate.toFixed(1)}% śr. rocznie (bieżąca ${currentInflationRate.toFixed(1)}% → cel NBP ${NBP_TARGET}%). Wartości realne pokazane pomarańczowym drukiem.`
              : ' Dane o inflacji nie zostały jeszcze załadowane — wartości podane są nominalne.'}
          </p>
        </div>
      </div>
    </div>
  );
}
