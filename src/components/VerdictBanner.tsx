import type { ScenarioResult } from '../types/scenario';
import { fmtPLN, fmtDiff, fmtDiffPct } from '../utils/formatting';
import { Trophy, Info } from 'lucide-react';

interface VerdictBannerProps {
  results: ScenarioResult[];
}

const SCENARIO_LABEL: Record<string, string> = { bear: 'Bear', base: 'Base', bull: 'Bull' };

export function VerdictBanner({ results }: VerdictBannerProps) {
  const bmLabel = results[0]?.benchmarkLabel ?? 'Konto';

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-800">Wyniki — co się bardziej opłaca?</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {results.map((r) => {
          const stockWins = r.stockBeatsBenchmark;
          const winnerLabel = stockWins ? 'Akcje' : bmLabel;
          const loserLabel = stockWins ? bmLabel : 'Akcje';
          const winnerValue = stockWins ? r.stockNetEndValuePLN : r.benchmarkEndValuePLN;
          const loserValue = stockWins ? r.benchmarkEndValuePLN : r.stockNetEndValuePLN;

          return (
            <div
              key={r.key}
              className="bg-white border-2 border-gray-200 rounded-2xl p-5 space-y-3"
            >
              <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                {SCENARIO_LABEL[r.key] ?? r.label}
              </span>

              {/* Winner */}
              <div className="flex items-center gap-2">
                <Trophy size={22} className="text-amber-400 shrink-0" />
                <span className="text-xl font-bold text-gray-800">{winnerLabel} wygrywa</span>
              </div>
              <div className="text-base font-semibold text-gray-700">
                o {fmtPLN(Math.abs(r.differencePLN))}
              </div>

              {/* Comparison rows */}
              <div className="space-y-1.5 pt-2 border-t border-gray-100">
                <div className="flex justify-between text-sm font-semibold text-gray-800">
                  <span className="flex items-center gap-1">
                    <Trophy size={11} className="text-amber-400" />
                    {winnerLabel} (netto)
                  </span>
                  <span>{fmtPLN(winnerValue)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>{loserLabel} (netto)</span>
                  <span>{fmtPLN(loserValue)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400 pt-1 border-t border-gray-50">
                  <span>Zysk akcje</span>
                  <span className="font-medium text-blue-600">{fmtDiffPct(r.stockReturnNet)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Zysk {bmLabel.toLowerCase()}</span>
                  <span className="font-medium text-purple-600">
                    {r.benchmarkReturnNet >= 0 ? '+' : ''}{r.benchmarkReturnNet.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Difference callout */}
              <div className="text-xs font-medium rounded-lg px-3 py-2 text-center bg-gray-50 border border-gray-100 text-gray-700">
                Różnica: {fmtDiff(r.differencePLN)} ({fmtDiffPct(r.differencePercent)})
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
