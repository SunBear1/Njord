import { useMemo, memo, useState } from 'react';
import type { HeatmapCell } from '../utils/calculations';
import { fmtPLN } from '../utils/formatting';

interface BreakevenChartProps {
  cells: HeatmapCell[];
  benchmarkEndValuePLN: number;
  benchmarkLabel: string;
}

function BreakevenChart({ cells, benchmarkEndValuePLN, benchmarkLabel }: BreakevenChartProps) {
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const deltaStockValues = useMemo(
    () => [...new Set(cells.map((c) => c.deltaStock))].sort((a, b) => b - a),
    [cells],
  );
  const deltaFxValues = useMemo(
    () => [...new Set(cells.map((c) => c.deltaFx))].sort((a, b) => a - b),
    [cells],
  );
  const cellMap = useMemo(
    () => new Map(cells.map((c) => [`${c.deltaStock},${c.deltaFx}`, c])),
    [cells],
  );

  // Cells that beat the benchmark, sorted best-first for list view
  const winnerCells = useMemo(
    () =>
      cells
        .filter((c) => c.beatsBenchmark)
        .sort((a, b) => b.stockNetEnd - a.stockNetEnd),
    [cells],
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">Break-even — mapa rentowności</h3>
        {/* View toggle — grid on desktop, list on mobile */}
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs" role="group" aria-label="Widok mapy">
          <button
            type="button"
            onClick={() => setView('grid')}
            className={`px-2.5 py-1 ${view === 'grid' ? 'bg-gray-100 dark:bg-gray-700 font-semibold text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
            aria-pressed={view === 'grid'}
          >
            Siatka
          </button>
          <button
            type="button"
            onClick={() => setView('list')}
            className={`px-2.5 py-1 border-l border-gray-200 dark:border-gray-700 ${view === 'list' ? 'bg-gray-100 dark:bg-gray-700 font-semibold text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
            aria-pressed={view === 'list'}
          >
            Lista
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Komórki oznaczają, w których kombinacjach zmian akcje biją {benchmarkLabel.toLowerCase()} (netto). {benchmarkLabel} docelowe:{' '}
        <strong>{fmtPLN(benchmarkEndValuePLN)}</strong>.
      </p>

      {view === 'grid' ? (
        <div className="overflow-x-auto -mx-2 px-2">
          <table className="text-xs border-collapse mx-auto">
            <thead>
              <tr>
                <th className="p-1 text-gray-400 dark:text-gray-500 font-normal text-right pr-2">
                  Akcje ↓ / USD/PLN →
                </th>
                {deltaFxValues.map((df) => (
                  <th key={df} className="p-1 font-medium text-gray-600 dark:text-gray-400 text-center min-w-[48px] tabular-nums">
                    {df > 0 ? '+' : ''}{df}%
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deltaStockValues.map((ds) => (
                <tr key={ds}>
                  <td className="p-1 font-medium text-gray-600 dark:text-gray-400 text-right pr-2 tabular-nums">
                    {ds > 0 ? '+' : ''}{ds}%
                  </td>
                  {deltaFxValues.map((df) => {
                    const cell = cellMap.get(`${ds},${df}`);
                    if (!cell) return <td key={df} className="p-1" />;
                    const { beatsBenchmark, stockNetEnd } = cell;
                    const diff = stockNetEnd - benchmarkEndValuePLN;
                    return (
                      <td
                        key={df}
                        className={`p-1 text-center rounded cursor-default transition-colors relative group/cell ${
                          beatsBenchmark
                            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 font-medium'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {beatsBenchmark ? '✓' : '✗'}
                        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded bg-gray-800 text-white text-[10px] whitespace-nowrap opacity-0 group-hover/cell:opacity-100 transition-opacity z-10 shadow-lg">
                          Akcje: {fmtPLN(stockNetEnd)}
                          <br />
                          Różnica: {diff >= 0 ? '+' : ''}{fmtPLN(diff)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* List view — mobile-friendly, shows winning combinations */
        <div className="space-y-1.5">
          {winnerCells.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
              W żadnym scenariuszu akcje nie biją benchmarku.
            </p>
          ) : (
            <>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {winnerCells.length} z {cells.length} kombinacji — akcje lepsze:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {winnerCells.slice(0, 20).map((cell) => {
                  const diff = cell.stockNetEnd - benchmarkEndValuePLN;
                  return (
                    <div
                      key={`${cell.deltaStock},${cell.deltaFx}`}
                      className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 text-xs"
                    >
                      <span className="text-blue-700 dark:text-blue-300 font-medium tabular-nums">
                        Akcje {cell.deltaStock > 0 ? '+' : ''}{cell.deltaStock}% / USD {cell.deltaFx > 0 ? '+' : ''}{cell.deltaFx}%
                      </span>
                      <span className="text-blue-600 dark:text-blue-400 tabular-nums font-semibold">
                        +{fmtPLN(diff)}
                      </span>
                    </div>
                  );
                })}
                {winnerCells.length > 20 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 col-span-full text-center pt-1">
                    …i {winnerCells.length - 20} więcej
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 pt-1 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-4 rounded bg-blue-100 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800" />
          Akcje lepsze (✓)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-4 rounded bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600" />
          {benchmarkLabel} lepsze (✗)
        </span>
        {view === 'grid' && (
          <span className="text-gray-400 dark:text-gray-500 hidden sm:inline">Najedź kursorem na komórkę, by zobaczyć wartość</span>
        )}
      </div>
    </div>
  );
}

export default memo(BreakevenChart);
