import type { ScenarioResult } from '../types/scenario';
import { fmtPLN, fmtDiff, fmtDiffPct } from '../utils/formatting';
import { Trophy, Info } from 'lucide-react';

interface VerdictBannerProps {
  results: ScenarioResult[];
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

export function VerdictBanner({ results }: VerdictBannerProps) {
  const bmLabel = results[0]?.benchmarkLabel ?? 'Konto';

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-800">Wyniki — co się bardziej opłaca?</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {results.map((r) => {
          const style = SCENARIO_STYLE[r.key] ?? SCENARIO_STYLE.base;
          const stockWins = r.stockBeatsBenchmark;

          return (
            <div
              key={r.key}
              className={`${style.bg} ${style.border} border-2 rounded-2xl p-5 space-y-3`}
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
                    {stockWins && <Trophy size={11} className="text-amber-400" />}
                    Akcje
                  </div>
                  <div className="text-base font-bold text-gray-800">{fmtPLN(r.stockNetEndValuePLN)}</div>
                  <div className="text-xs font-medium text-blue-600">{fmtDiffPct(r.stockReturnNet)}</div>
                </div>

                {/* Benchmark column */}
                <div className={`rounded-xl p-3 text-center space-y-1 ${!stockWins ? 'bg-white shadow-sm ring-2 ring-amber-300' : 'bg-white/60'}`}>
                  <div className="flex items-center justify-center gap-1 text-xs font-bold text-purple-700 uppercase tracking-wide">
                    {!stockWins && <Trophy size={11} className="text-amber-400" />}
                    {bmLabel}
                  </div>
                  <div className="text-base font-bold text-gray-800">{fmtPLN(r.benchmarkEndValuePLN)}</div>
                  <div className="text-xs font-medium text-purple-600">
                    {r.benchmarkReturnNet >= 0 ? '+' : ''}{r.benchmarkReturnNet.toFixed(2)}%
                  </div>
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

      {/* Summary note */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
        <div className="flex items-start gap-2">
          <Info size={16} className="mt-0.5 flex-shrink-0 text-gray-400" />
          <p>
            Aktualnie posiadasz akcje o wartości{' '}
            <strong className="text-gray-900">{fmtPLN(results[0]?.currentValuePLN ?? 0)}</strong>.{' '}
            Porównanie uwzględnia podatek Belki (19%) od zysku zarówno z akcji, jak i z{' '}
            {bmLabel === 'Obligacje' ? 'obligacji' : 'konta oszczędnościowego'}.
          </p>
        </div>
      </div>
    </div>
  );
}
