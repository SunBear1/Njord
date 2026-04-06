import type { ScenarioResult } from '../types/scenario';
import { fmtPLN, fmtDiff, fmtDiffPct } from '../utils/formatting';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface VerdictBannerProps {
  results: ScenarioResult[];
}

const SCENARIO_STYLE = {
  bear: { bg: 'bg-red-50', border: 'border-red-200', badgeColor: 'bg-red-100 text-red-700' },
  base: { bg: 'bg-amber-50', border: 'border-amber-200', badgeColor: 'bg-amber-100 text-amber-700' },
  bull: { bg: 'bg-green-50', border: 'border-green-200', badgeColor: 'bg-green-100 text-green-700' },
};

export function VerdictBanner({ results }: VerdictBannerProps) {
  const bmLabel = results[0]?.benchmarkLabel ?? 'Konto';

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-800">Wyniki — co się bardziej opłaca?</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {results.map((r) => {
          const style = SCENARIO_STYLE[r.key];
          const stockWins = r.stockBeatsBenchmark;
          const diff = Math.abs(r.differencePLN);

          return (
            <div
              key={r.key}
              className={`${style.bg} ${style.border} border-2 rounded-2xl p-5 space-y-3`}
            >
              <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${style.badgeColor}`}>
                {r.label}
              </span>

              {/* Main verdict */}
              <div className="space-y-1">
                <div
                  className={`text-2xl font-bold flex items-center gap-2 ${
                    stockWins ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  {stockWins ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                  {stockWins ? 'Akcje lepsze' : `${bmLabel} lepsze`}
                </div>
                <div className={`text-xl font-semibold ${stockWins ? 'text-green-600' : 'text-red-600'}`}>
                  o {fmtPLN(diff)}
                </div>
                <div className={`text-sm ${stockWins ? 'text-green-600' : 'text-red-600'}`}>
                  ({fmtDiffPct(Math.abs(r.differencePercent))})
                </div>
              </div>

              {/* Mini comparison */}
              <div className="space-y-1.5 pt-2 border-t border-current border-opacity-10">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Akcje (netto)</span>
                  <span className="font-medium">{fmtPLN(r.stockNetEndValuePLN)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{bmLabel} (netto)</span>
                  <span className="font-medium">{fmtPLN(r.benchmarkEndValuePLN)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 pt-1">
                  <span>Zysk akcje</span>
                  <span className={r.stockReturnNet >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {fmtDiffPct(r.stockReturnNet)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Zysk {bmLabel.toLowerCase()}</span>
                  <span className={r.benchmarkReturnNet >= 0 ? 'text-blue-600' : 'text-red-600'}>
                    {r.benchmarkReturnNet >= 0 ? '+' : ''}{r.benchmarkReturnNet.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Difference emphasis */}
              <div
                className={`text-xs font-medium rounded-lg px-3 py-2 text-center ${
                  stockWins
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                Różnica netto: {fmtDiff(r.differencePLN)} ({fmtDiffPct(r.differencePercent)})
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall summary */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
        <div className="flex items-start gap-2">
          <Minus size={16} className="mt-0.5 flex-shrink-0 text-gray-400" />
          <p>
            Aktualnie posiadasz akcje o wartości{' '}
            <strong className="text-gray-900">{fmtPLN(results[0]?.currentValuePLN ?? 0)}</strong>.{' '}
            Powyższe porównanie uwzględnia podatek Belki (19%) od zysku zarówno z akcji, jak i z {bmLabel === 'Obligacje' ? 'obligacji' : 'konta oszczędnościowego'}.
          </p>
        </div>
      </div>
    </div>
  );
}
