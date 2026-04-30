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

function TimelineChart({ data, currentValuePLN, benchmarkLabel, inflationRate }: TimelineChartProps) {
  const style = getComputedStyle(document.documentElement);
  const gridColor = style.getPropertyValue('--color-chart-grid').trim();
  const tickColor = style.getPropertyValue('--color-chart-tick').trim();
  const labelColor = tickColor;
  const bearColor = style.getPropertyValue('--color-bear').trim();
  const baseColor = style.getPropertyValue('--color-brand').trim();
  const bullColor = style.getPropertyValue('--color-bull').trim();
  const benchmarkColor = style.getPropertyValue('--color-chart-benchmark').trim();
  const referenceColor = style.getPropertyValue('--color-chart-reference').trim();
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
      <ResponsiveContainer width="100%" height={420}>
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
          />
          <Legend />
          <ReferenceLine y={currentValuePLN} stroke={referenceColor} strokeDasharray="4 4" />
          <Line type="monotone" dataKey="benchmark" name={benchmarkLabel}  stroke={benchmarkColor} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="bear"      name="Bear (pesymistyczny)" stroke={bearColor} strokeWidth={2} dot={false} strokeDasharray="5 3" />
          <Line type="monotone" dataKey="base"      name="Base (bez zmian)"    stroke={baseColor} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="bull"      name="Bull (optymistyczny)" stroke={bullColor} strokeWidth={2} dot={false} />
          {inflationRate > 0 && (
            <Line type="monotone" dataKey="purchasingPower" name="Siła nabywcza" stroke={referenceColor} strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default memo(TimelineChart);
