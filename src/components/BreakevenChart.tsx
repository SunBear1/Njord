import type { HeatmapCell } from '../utils/calculations';
import { fmtPLN } from '../utils/formatting';

interface BreakevenChartProps {
  cells: HeatmapCell[];
  benchmarkEndValuePLN: number;
  benchmarkLabel: string;
}

export function BreakevenChart({ cells, benchmarkEndValuePLN, benchmarkLabel }: BreakevenChartProps) {
  const deltaStockValues = [...new Set(cells.map((c) => c.deltaStock))].sort((a, b) => b - a);
  const deltaFxValues = [...new Set(cells.map((c) => c.deltaFx))].sort((a, b) => a - b);

  const cellMap = new Map(cells.map((c) => [`${c.deltaStock},${c.deltaFx}`, c]));

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
      <h3 className="text-base font-semibold text-gray-800">Break-even — mapa rentowności</h3>
      <p className="text-xs text-gray-500">
        Zielone komórki = akcje biją {benchmarkLabel.toLowerCase()} (netto). {benchmarkLabel} docelowe:{' '}
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
                <th key={df} className="p-1 font-medium text-gray-600 text-center min-w-[52px]">
                  {df > 0 ? '+' : ''}{df}%
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deltaStockValues.map((ds) => (
              <tr key={ds}>
                <td className="p-1 font-medium text-gray-600 text-right pr-2">
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
                          ? 'bg-green-100 text-green-800 font-medium'
                          : 'bg-red-100 text-red-800'
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
          <span className="inline-block w-4 h-4 rounded bg-green-100 border border-green-200" />
          Akcje lepsze (✓)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-4 rounded bg-red-100 border border-red-200" />
          {benchmarkLabel} lepsze (✗)
        </span>
        <span className="text-gray-400">Najedź kursorem na komórkę, by zobaczyć wartość</span>
      </div>
    </div>
  );
}
