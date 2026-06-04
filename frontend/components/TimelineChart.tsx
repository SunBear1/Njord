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
} from 'recharts';
import type { TimelinePoint } from '../utils/calculations';
import { fmtTooltipPLN } from '../utils/formatting';

interface TimelineChartProps {
  data: TimelinePoint[];
  currentValuePLN: number;
  benchmarkLabel: string;
  inflationRate: number;
}

const chartColors = {
  grid: 'var(--color-border)',
  tick: 'var(--color-text-muted)',
  tooltipBackground: 'var(--color-bg-card)',
  tooltipBorder: 'var(--color-border)',
  tooltipText: 'var(--color-text-primary)',
  benchmark: 'var(--color-chart-comparison-benchmark)',
  bear: 'var(--color-chart-comparison-bear)',
  base: 'var(--color-chart-comparison-base)',
  bull: 'var(--color-chart-comparison-bull)',
  purchasingPower: 'var(--color-chart-comparison-purchasing-power)',
} as const;

function TimelineChart({ data, currentValuePLN, benchmarkLabel, inflationRate }: TimelineChartProps) {
  const chartData = useMemo(() =>
    inflationRate > 0
      ? data.map((point) => ({
          ...point,
          purchasingPower: currentValuePLN / Math.pow(1 + inflationRate / 100, point.month / 12),
        }))
      : data,
    [currentValuePLN, data, inflationRate],
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
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
          <XAxis
            dataKey="month"
            tickFormatter={(v) => `${v}m`}
            tick={{ fontSize: 12, fill: chartColors.tick }}
          />
          <YAxis
            tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
            tick={{ fontSize: 12, fill: chartColors.tick }}
          />
          <Tooltip
            formatter={fmtTooltipPLN}
            labelFormatter={(v) => `Miesiąc ${v}`}
            contentStyle={{
              backgroundColor: chartColors.tooltipBackground,
              borderColor: chartColors.tooltipBorder,
              borderRadius: '8px',
              color: chartColors.tooltipText,
            }}
          />
          <Legend />
          <Line type="monotone" dataKey="benchmark" name={benchmarkLabel} stroke={chartColors.benchmark} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="bear" name="Bear" stroke={chartColors.bear} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="base" name="Base" stroke={chartColors.base} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="bull" name="Bull" stroke={chartColors.bull} strokeWidth={2} dot={false} />
          {inflationRate > 0 && (
            <Line
              type="monotone"
              dataKey="purchasingPower"
              name="Siła nabywcza"
              stroke={chartColors.purchasingPower}
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="6 3"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default memo(TimelineChart);
