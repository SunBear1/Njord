import { useMemo, memo } from 'react';
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
  isDark?: boolean;
}

function TimelineChart({ data, currentValuePLN, benchmarkLabel, inflationRate, isDark }: TimelineChartProps) {
  const gridColor = isDark ? '#374151' : '#f0f0f0';
  const tickColor = isDark ? '#9ca3af' : '#666666';
  const labelColor = isDark ? '#9ca3af' : '#9ca3af';
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
    <div className="bg-surface dark:bg-surface-dark rounded-xl border border-edge dark:border-edge-strong shadow-sm p-5 space-y-3">
      <h3 className="text-base font-semibold text-heading dark:text-on-dark">Wartość w czasie</h3>
      {inflationRate > 0 && (
        <p className="text-xs text-muted dark:text-faint">
          Szara linia przerywana „Siła nabywcza" — wartość wyjściowa skorygowana o inflację ({inflationRate.toFixed(1)}% śr./rok).
        </p>
      )}
      <ResponsiveContainer width="100%" height={420} debounce={32}>
        <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 24, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis
            dataKey="month"
            tickFormatter={(v) => `${v}m`}
            tick={{ fontSize: 12, fill: tickColor }}
            label={{ value: 'Miesiące', position: 'insideBottomRight', offset: 0, fontSize: 11, fill: labelColor }}
          />
          <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: tickColor }} />
          <Tooltip
            formatter={fmtTooltipPLN}
            labelFormatter={(v) => `Miesiąc ${v}`}
            contentStyle={{
              backgroundColor: isDark ? '#1e2130' : '#ffffff',
              borderColor: isDark ? '#3b4055' : '#e2e3e5',
              borderRadius: '8px',
              color: isDark ? '#ffffff' : '#2d3142',
            }}
          />
          <Legend />
          <ReferenceLine y={currentValuePLN} stroke="#94a3b8" strokeDasharray="4 4" />
          <Line type="monotone" dataKey="benchmark" name={benchmarkLabel}  stroke="#8b5cf6" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="bear"      name="Bear"  stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="5 3" />
          <Line type="monotone" dataKey="base"      name="Base"  stroke="#2563eb" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="bull"      name="Bull"  stroke="#16a34a" strokeWidth={2} dot={false} />
          {inflationRate > 0 && (
            <Line type="monotone" dataKey="purchasingPower" name="Siła nabywcza" stroke="#94a3b8" strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default memo(TimelineChart);
