import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { TimelinePoint } from '../utils/calculations';
import { fmtTooltipPLN } from '../utils/formatting';

interface TimelineChartProps {
  data: TimelinePoint[];
  currentValuePLN: number;
  benchmarkLabel: string;
  inflationRate: number;
}

export function TimelineChart({ data, currentValuePLN, benchmarkLabel, inflationRate }: TimelineChartProps) {
  const chartData = useMemo(() =>
    inflationRate > 0
      ? data.map((point) => ({
          ...point,
          purchasingPower: currentValuePLN / Math.pow(1 + inflationRate / 100, point.month / 12),
        }))
      : data,
    [data, inflationRate, currentValuePLN],
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
      <h3 className="text-base font-semibold text-gray-800">Wartość w czasie</h3>
      {inflationRate > 0 && (
        <p className="text-xs text-gray-500">
          Szara linia przerywana „Siła nabywcza" — wartość wyjściowa skorygowana o inflację ({inflationRate.toFixed(1)}% śr./rok).
        </p>
      )}
      <ResponsiveContainer width="100%" height={420}>
        <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 24, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="month"
            tickFormatter={(v) => `${v}m`}
            tick={{ fontSize: 12 }}
            label={{ value: 'Miesiące', position: 'insideBottomRight', offset: 0, fontSize: 11, fill: '#9ca3af' }}
          />
          <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={fmtTooltipPLN}
            labelFormatter={(v) => `Miesiąc ${v}`}
          />
          <Legend />
          <ReferenceLine y={currentValuePLN} stroke="#94a3b8" strokeDasharray="4 4" />
          <Line type="monotone" dataKey="benchmark" name={benchmarkLabel}  stroke="#8b5cf6" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="bear"      name="Bear (pesymistyczny)" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="5 3" />
          <Line type="monotone" dataKey="base"      name="Base (bez zmian)"    stroke="#2563eb" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="bull"      name="Bull (optymistyczny)" stroke="#16a34a" strokeWidth={2} dot={false} />
          {inflationRate > 0 && (
            <Line type="monotone" dataKey="purchasingPower" name="Siła nabywcza" stroke="#94a3b8" strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
