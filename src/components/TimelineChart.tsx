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
  const gridColor = isDark ? '#334155' : '#F1F5F9';
  const tickColor = isDark ? '#A9B5BF' : '#475569';
  const labelColor = isDark ? '#A9B5BF' : '#475569';
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
    <div className="bg-bg-card rounded-xl border border-border shadow-sm p-5 space-y-3">
      <h3 className="text-base font-semibold text-text-primary">Wartość w czasie</h3>
      {inflationRate > 0 && (
        <p className="text-xs text-text-muted">
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
              backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
              borderColor: isDark ? '#334155' : '#CBD5E1',
              borderRadius: '8px',
              color: isDark ? '#F1F5F9' : '#0F172A',
            }}
          />
          <Legend />
          <ReferenceLine y={currentValuePLN} stroke={isDark ? '#A9B5BF' : '#475569'} strokeDasharray="4 4" />
          <Line type="monotone" dataKey="benchmark" name={benchmarkLabel}  stroke={isDark ? '#7dd3fc' : '#0369a1'} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="bear"      name="Bear"  stroke={isDark ? '#FCA5A5' : '#991B1B'} strokeWidth={2} dot={false} strokeDasharray="5 3" />
          <Line type="monotone" dataKey="base"      name="Base"  stroke={isDark ? '#67E8F9' : '#115E59'} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="bull"      name="Bull"  stroke={isDark ? '#6EE7B7' : '#065F46'} strokeWidth={2} dot={false} />
          {inflationRate > 0 && (
            <Line type="monotone" dataKey="purchasingPower" name="Siła nabywcza" stroke={isDark ? '#A9B5BF' : '#475569'} strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default memo(TimelineChart);
