import type { ScenarioResult } from '../types/scenario';
import { fmtPLN, fmtUSD, fmtDiff, fmtDiffPct } from '../utils/formatting';
import { Trophy, Info, TrendingDown, TrendingUp, Minus } from 'lucide-react';
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
  avgCostUSD?: number;
}

const SCENARIO_ICON = {
  bear: <TrendingDown size={12} aria-hidden="true" />,
  base: <Minus size={12} aria-hidden="true" />,
  bull: <TrendingUp size={12} aria-hidden="true" />,
} as const;

const SCENARIO_STYLE = {
  bear: {
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    border: 'border-orange-200 dark:border-orange-900',
    badge: 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200 border border-orange-200 dark:border-orange-800',
  },
  base: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-900',
    badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
  },
  bull: {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-900',
    badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
  },
};

export function VerdictBanner({ results, inflationRate, currentInflationRate, inflationSource, cpiPeriod, inflationStale, horizonMonths, avgCostUSD }: VerdictBannerProps) {
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
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Wyniki — co się bardziej opłaca?</h2>
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-2 py-0.5 rounded-full">
          Podatek Belki 19% od zysku{hasInflation ? ` · inflacja ${inflationRate.toFixed(1)}%` : ''}
          <Tooltip
            content={disclaimerTooltip}
            width="w-72"
          />
        </span>
      </div>

      {/* Current value — above cards */}
      <div className="flex items-center gap-2 px-1">
        <Info size={16} className="text-gray-400 dark:text-gray-500 flex-shrink-0" aria-hidden="true" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Aktualnie posiadasz akcje o wartości{' '}
          <strong className="text-gray-900 dark:text-gray-100 tabular-nums">{fmtPLN(results[0]?.currentValuePLN ?? 0)}</strong>.{' '}
          Wyniki pokazują wartość po wybranym horyzoncie czasowym.
        </p>
      </div>

      {/* Cost basis P&L — shown only when avgCostUSD is set */}
      {avgCostUSD && avgCostUSD > 0 && results[0]?.costBasisValuePLN != null && (
        (() => {
          const r = results[1] ?? results[0]; // use base scenario
          const isProfit = (r.unrealizedGainPLN ?? 0) >= 0;
          const gain = r.unrealizedGainPLN ?? 0;
          const gainPct = r.unrealizedGainPercent ?? 0;
          return (
            <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border text-sm ${isProfit ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300' : 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-200'}`}>
              <span className="text-lg leading-tight flex-shrink-0" aria-hidden="true">{isProfit ? '▲' : '▼'}</span>
              <div className="flex-1">
                <span className="font-semibold">
                  {isProfit ? 'Jesteś na plusie' : 'Jesteś pod wodą'}
                </span>
                {' '}względem ceny zakupu {fmtUSD(avgCostUSD)}/akcję.{' '}
                Niezrealizowany {isProfit ? 'zysk' : 'strata'}:{' '}
                <strong>{fmtDiff(gain)}</strong>{' '}
                (<strong>{gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%</strong>).
                {!isProfit && (
                  <span className="block mt-1 text-xs opacity-80">
                    Scenariusze gdzie cena sprzedaży nie przekracza {fmtUSD(avgCostUSD)} nie są obciążone podatkiem Belki.
                  </span>
                )}
              </div>
            </div>
          );
        })()
      )}

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
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${style.badge}`}>
                {SCENARIO_ICON[r.key]}
                {r.key.charAt(0).toUpperCase() + r.key.slice(1)}
              </span>

              {/* Two-column comparison */}
              <div className="grid grid-cols-2 gap-2">
                {/* Akcje column */}
                <div className={`rounded-xl p-3 text-center space-y-1 ${stockWins ? 'bg-white dark:bg-gray-800 shadow-sm ring-2 ring-amber-300' : 'bg-white/60 dark:bg-gray-800/60'}`}>
                  <div className="flex items-center justify-center gap-1 text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                    {stockWins && <Trophy size={12} className="text-amber-400" aria-hidden="true" />}
                    Akcje
                  </div>
                  <div className="text-base font-bold text-gray-800 dark:text-gray-100 tabular-nums">{fmtPLN(r.stockNetEndValuePLN)}</div>
                  <div className="text-xs font-medium text-blue-600 dark:text-blue-400 tabular-nums">{fmtDiffPct(r.stockReturnNet)}</div>
                  {hasInflation && (
                    <div className="text-[10px] text-orange-600 dark:text-orange-400 font-medium">
                      realnie {r.stockRealReturnNet >= 0 ? '+' : ''}{r.stockRealReturnNet.toFixed(2)}%
                    </div>
                  )}
                  {r.dividendsNetPLN > 0 && (
                    <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                      w tym dyw. {fmtPLN(r.dividendsNetPLN)}
                    </div>
                  )}
                </div>

                {/* Benchmark column */}
                <div className={`rounded-xl p-3 text-center space-y-1 ${!stockWins ? 'bg-white dark:bg-gray-800 shadow-sm ring-2 ring-amber-300' : 'bg-white/60 dark:bg-gray-800/60'}`}>
                  <div className="flex items-center justify-center gap-1 text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wide">
                    {!stockWins && <Trophy size={12} className="text-amber-400" aria-hidden="true" />}
                    {bmLabel}
                  </div>
                  <div className="text-base font-bold text-gray-800 dark:text-gray-100 tabular-nums">{fmtPLN(r.benchmarkEndValuePLN)}</div>
                  <div className="text-xs font-medium text-purple-600 dark:text-purple-400 tabular-nums">
                    {r.benchmarkReturnNet >= 0 ? '+' : ''}{r.benchmarkReturnNet.toFixed(2)}%
                  </div>
                  {hasInflation && (
                    <div className="text-[10px] text-orange-600 dark:text-orange-400 font-medium">
                      realnie {r.benchmarkRealReturnNet >= 0 ? '+' : ''}{r.benchmarkRealReturnNet.toFixed(2)}%
                    </div>
                  )}
                </div>
              </div>

              {/* Difference callout */}
              <div className="text-xs font-medium rounded-lg px-3 py-2 text-center bg-white/70 dark:bg-gray-800/70 border border-white dark:border-gray-700 text-gray-700 dark:text-gray-300">
                Różnica: <strong>{fmtDiff(r.differencePLN)}</strong> ({fmtDiffPct(r.differencePercent)})
              </div>
            </div>
          );
        })}
      </div>

      {/* Inflation projection note */}
      {hasInflation && (
        <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-xl px-4 py-3 text-xs text-orange-800 dark:text-orange-300 flex items-start gap-2">
          <TrendingDown size={16} className="mt-0.5 flex-shrink-0 text-orange-500 dark:text-orange-400" aria-hidden="true" />
          <p>
            <strong>Inflacja {currentInflationRate.toFixed(1)}%</strong>
            {cpiPeriod ? ` (${inflationSource ?? 'Eurostat'}, ${cpiPeriod})` : ''}.{' '}
            Prognoza na {horizonYears.toFixed(horizonYears % 1 === 0 ? 0 : 1)} l.: <strong>{inflationRate.toFixed(1)}% śr./rok</strong>{' '}
            (model: zbieżność do celu NBP {NBP_TARGET}%).{' '}
            Skumulowana: <strong>{results[0]?.inflationTotalPercent.toFixed(1)}%</strong>.
            {inflationStale && (
              <span className="ml-1.5 text-amber-700 dark:text-amber-400 font-medium">
                ⚠ Dane mogą być nieaktualne — sprawdź Eurostat lub NBP.
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

