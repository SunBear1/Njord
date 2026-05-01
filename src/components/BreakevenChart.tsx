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
    <div className="bg-bg-card rounded-xl border border-border shadow-sm p-5 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-base font-semibold text-text-primary">Break-even — mapa rentowności</h3>
        {/* View toggle — grid on desktop, list on mobile */}
        <div className="flex rounded-lg border border-border overflow-hidden text-xs" role="group" aria-label="Widok mapy">
          <button
            type="button"
            onClick={() => setView('grid')}
            className={`px-2.5 py-1 ${view === 'grid' ? 'bg-bg-hover font-semibold text-text-primary' : 'text-text-muted hover:bg-bg-card'}`}
            aria-pressed={view === 'grid'}
          >
            Siatka
          </button>
          <button
            type="button"
            onClick={() => setView('list')}
            className={`px-2.5 py-1 border-l border-border ${view === 'list' ? 'bg-bg-hover font-semibold text-text-primary' : 'text-text-muted hover:bg-bg-card'}`}
            aria-pressed={view === 'list'}
          >
            Lista
          </button>
        </div>
      </div>
      <p className="text-xs text-text-muted">
        Komórki oznaczają, w których kombinacjach zmian akcje biją {benchmarkLabel.toLowerCase()} (netto). {benchmarkLabel} docelowe:{' '}
        <strong>{fmtPLN(benchmarkEndValuePLN)}</strong>.
      </p>

      {view === 'grid' ? (
        <div className="overflow-x-auto -mx-2 px-2">
          <table className="text-xs border-collapse mx-auto">
            <thead>
              <tr>
                <th className="p-1 text-border font-normal text-right pr-2">
                  Akcje ↓ / USD/PLN →
                </th>
                {deltaFxValues.map((df) => (
                  <th key={df} className="p-1 font-medium text-text-secondary text-center min-w-[48px] tabular-nums">
                    {df > 0 ? '+' : ''}{df}%
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deltaStockValues.map((ds) => (
                <tr key={ds}>
                  <td className="p-1 font-medium text-text-secondary text-right pr-2 tabular-nums">
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
                            ? 'bg-bg-hover/40 text-accent-primary-hover font-medium'
                            : 'bg-bg-hover text-text-muted'
                        }`}
                      >
                        {beatsBenchmark ? '✓' : '✗'}
                        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded bg-bg-card text-white text-[10px] whitespace-nowrap opacity-0 group-hover/cell:opacity-100 transition-opacity z-10 shadow-lg">
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
            <p className="text-xs text-text-muted text-center py-4">
              W żadnym scenariuszu akcje nie biją benchmarku.
            </p>
          ) : (
            <>
              <p className="text-xs text-border">
                {winnerCells.length} z {cells.length} kombinacji — akcje lepsze:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {winnerCells.slice(0, 20).map((cell) => {
                  const diff = cell.stockNetEnd - benchmarkEndValuePLN;
                  return (
                    <div
                      key={`${cell.deltaStock},${cell.deltaFx}`}
                      className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-bg-hover/20 border border-accent/40 text-xs"
                    >
                      <span className="text-accent-primary-hover font-medium tabular-nums">
                        Akcje {cell.deltaStock > 0 ? '+' : ''}{cell.deltaStock}% / USD {cell.deltaFx > 0 ? '+' : ''}{cell.deltaFx}%
                      </span>
                      <span className="text-accent-primary tabular-nums font-semibold">
                        +{fmtPLN(diff)}
                      </span>
                    </div>
                  );
                })}
                {winnerCells.length > 20 && (
                  <p className="text-xs text-border col-span-full text-center pt-1">
                    …i {winnerCells.length - 20} więcej
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-text-muted pt-1 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-4 rounded bg-bg-hover/40 border border-accent" />
          Akcje lepsze (✓)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-4 rounded bg-bg-hover border border-border" />
          {benchmarkLabel} lepsze (✗)
        </span>
        {view === 'grid' && (
          <span className="text-border hidden sm:inline">Najedź kursorem na komórkę, by zobaczyć wartość</span>
        )}
      </div>
    </div>
  );
}

export default memo(BreakevenChart);
