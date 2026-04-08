import { useMemo } from 'react';
import type { HeatmapCell } from '../utils/calculations';
import { fmtPLN } from '../utils/formatting';

interface BreakevenChartProps {
  cells: HeatmapCell[];
  benchmarkEndValuePLN: number;
  benchmarkLabel: string;
}

export function BreakevenChart({ cells, benchmarkEndValuePLN, benchmarkLabel }: BreakevenChartProps) {
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

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
      <h3 className="text-base font-semibold text-gray-800">Break-even — mapa rentowności</h3>
      <p className="text-xs text-gray-500">
        Komórki oznaczają, w których kombinacjach zmian akcje biją {benchmarkLabel.toLowerCase()} (netto). {benchmarkLabel} docelowe:{' '}
        <strong>{fmtPLN(benchmarkEndValuePLN)}</strong>.
      </p>

      <div className="overflow-x-auto">
        <table className="text-xs border-collapse mx-auto">
          <thead>
            <tr>
              <th className="p-1 text-gray-400 font-normal text-right pr-2">
                Akcje ↓ / USD/PLN →
              </th>
              {deltaFxValues.map((df) => (
                <th key={df} className="p-1 font-medium text-gray-600 text-center min-w-[52px] tabular-nums">
                  {df > 0 ? '+' : ''}{df}%
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deltaStockValues.map((ds) => (
              <tr key={ds}>
                <td className="p-1 font-medium text-gray-600 text-right pr-2 tabular-nums">
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
                      title={`Akcje: ${fmtPLN(stockNetEnd)} | Różnica: ${diff >= 0 ? '+' : ''}${fmtPLN(diff)}`}
                      className={`p-1 text-center rounded cursor-default transition-colors ${
                        beatsBenchmark
                          ? 'bg-blue-100 text-blue-800 font-medium'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {beatsBenchmark ? '✓' : '✗'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500 pt-1">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-4 rounded bg-blue-100 border border-blue-200" />
          Akcje lepsze (✓)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-4 rounded bg-slate-100 border border-slate-200" />
          {benchmarkLabel} lepsze (✗)
        </span>
        <span className="text-gray-400">Najedź kursorem na komórkę, by zobaczyć wartość</span>
      </div>
    </div>
  );
}
