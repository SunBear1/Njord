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
    bg: 'bg-danger/5',
    border: 'border-danger/30',
    badge: 'bg-danger/10 text-danger border border-danger/30',
  },
  base: {
    bg: 'bg-bg-hover/30',
    border: 'border-border',
    badge: 'bg-bg-hover text-text-secondary border border-border',
  },
  bull: {
    bg: 'bg-success/5',
    border: 'border-success/30',
    badge: 'bg-success/10 text-success border border-success/30',
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

  const baseResult = results[1] ?? results[0];
  const stockWinsBase = baseResult?.stockBeatsBenchmark ?? false;
  const heroDiff = Math.abs(baseResult?.differencePLN ?? 0);
  const heroDiffPct = Math.abs(baseResult?.differencePercent ?? 0);
  const heroWinner = stockWinsBase ? 'Akcje' : bmLabel;
  const heroIsPositive = stockWinsBase;

  return (
    <div className="space-y-3">
      {/* Hero verdict */}
      <div className={`rounded-xl border-2 px-5 py-4 flex items-center gap-4 flex-wrap ${heroIsPositive ? 'bg-success/5 border-success/30' : 'bg-bg-hover border-border'}`}>
        <div className={`text-2xl font-bold ${heroIsPositive ? 'text-success' : 'text-text-primary'}`}>
          {heroWinner} {heroIsPositive ? 'wygrywają' : 'wygrywa'}
        </div>
        <div className="text-sm text-text-secondary">
          W scenariuszu bazowym — o{' '}
          <strong className={`tabular-nums ${heroIsPositive ? 'text-success' : 'text-text-primary'}`}>{fmtPLN(heroDiff)}</strong>
          {' '}(<strong>{heroDiffPct >= 0 ? '+' : ''}{heroDiffPct.toFixed(1)}%</strong>)
        </div>
      </div>

      {/* Header row: title + single disclaimer badge */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-semibold text-text-primary">Wyniki — co się bardziej opłaca?</h2>
        <span className="inline-flex items-center gap-1.5 text-xs text-text-muted bg-bg-hover border border-border px-2 py-0.5 rounded-full">
          Podatek Belki 19% od zysku{hasInflation ? ` · inflacja ${inflationRate.toFixed(1)}%` : ''}
          <Tooltip
            content={disclaimerTooltip}
            width="w-72"
          />
        </span>
      </div>

      {/* Current value — above cards */}
      <div className="flex items-center gap-2 px-1">
        <Info size={16} className="text-text-muted flex-shrink-0" aria-hidden="true" />
        <p className="text-sm text-text-secondary">
          Aktualnie posiadasz akcje o wartości{' '}
          <strong className="text-text-primary tabular-nums">{fmtPLN(results[0]?.currentValuePLN ?? 0)}</strong>.{' '}
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
            <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border text-sm ${isProfit ? 'bg-bg-hover/20 border-accent-primary/40 text-accent-primary/80' : 'bg-danger/5 border-danger/30 text-danger'}`}>
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
                <div className={`rounded-xl p-3 text-center space-y-1 ${stockWins ? 'bg-bg-card shadow-sm ring-2 ring-accent-primary/50' : 'bg-bg-card/60'}`}>
                  <div className="flex items-center justify-center gap-1 text-xs font-bold text-accent-primary/80 uppercase tracking-wide">
                    {stockWins && <Trophy size={12} className="text-accent-primary" aria-hidden="true" />}
                    Akcje
                  </div>
                  <div className="text-base font-bold text-text-primary tabular-nums">{fmtPLN(r.stockNetEndValuePLN)}</div>
                  <div className="text-xs font-medium text-accent-primary tabular-nums">{fmtDiffPct(r.stockReturnNet)}</div>
                  {hasInflation && (
                    <div className="text-[10px] text-danger font-medium">
                      realnie {r.stockRealReturnNet >= 0 ? '+' : ''}{r.stockRealReturnNet.toFixed(2)}%
                    </div>
                  )}
                  {r.dividendsNetPLN > 0 && (
                    <div className="text-[10px] text-success font-medium">
                      w tym dyw. {fmtPLN(r.dividendsNetPLN)}
                    </div>
                  )}
                </div>

                {/* Benchmark column */}
                <div className={`rounded-xl p-3 text-center space-y-1 ${!stockWins ? 'bg-bg-card shadow-sm ring-2 ring-accent-primary/50' : 'bg-bg-card/60'}`}>
                  <div className="flex items-center justify-center gap-1 text-xs font-bold text-accent-primary uppercase tracking-wide">
                    {!stockWins && <Trophy size={12} className="text-accent-primary" aria-hidden="true" />}
                    {bmLabel}
                  </div>
                  <div className="text-base font-bold text-text-primary tabular-nums">{fmtPLN(r.benchmarkEndValuePLN)}</div>
                  <div className="text-xs font-medium text-accent-primary tabular-nums">
                    {r.benchmarkReturnNet >= 0 ? '+' : ''}{r.benchmarkReturnNet.toFixed(2)}%
                  </div>
                  {hasInflation && (
                    <div className="text-[10px] text-danger font-medium">
                      realnie {r.benchmarkRealReturnNet >= 0 ? '+' : ''}{r.benchmarkRealReturnNet.toFixed(2)}%
                    </div>
                  )}
                </div>
              </div>

              {/* Difference callout */}
              <div className="text-xs font-medium rounded-lg px-3 py-2 text-center bg-bg-card/70 border border-border text-text-secondary">
                Różnica: <strong>{fmtDiff(r.differencePLN)}</strong> ({fmtDiffPct(r.differencePercent)})
              </div>
            </div>
          );
        })}
      </div>

      {/* Inflation projection note */}
      {hasInflation && (
        <div className="bg-danger/5 border border-danger/30 rounded-xl px-4 py-3 text-xs text-danger flex items-start gap-2">
          <TrendingDown size={16} className="mt-0.5 flex-shrink-0 text-danger" aria-hidden="true" />
          <p>
            <strong>Inflacja {currentInflationRate.toFixed(1)}%</strong>
            {cpiPeriod ? ` (${inflationSource ?? 'Eurostat'}, ${cpiPeriod})` : ''}.{' '}
            Prognoza na {horizonYears.toFixed(horizonYears % 1 === 0 ? 0 : 1)} l.: <strong>{inflationRate.toFixed(1)}% śr./rok</strong>{' '}
            (model: zbieżność do celu NBP {NBP_TARGET}%).{' '}
            Skumulowana: <strong>{results[0]?.inflationTotalPercent.toFixed(1)}%</strong>.
            {inflationStale && (
              <span className="ml-1.5 text-danger font-medium">
                ⚠ Dane mogą być nieaktualne — sprawdź Eurostat lub NBP.
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

