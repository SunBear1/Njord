import { useMemo, memo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { ScenarioResult } from '../types/scenario';
import { fmtTooltipPLN } from '../utils/formatting';

interface ComparisonChartProps {
  results: ScenarioResult[];
  isDark?: boolean;
}

function ComparisonChart({ results, isDark }: ComparisonChartProps) {
  const bmLabel = results[0]?.benchmarkLabel ?? 'Konto';
  const gridColor = isDark ? '#334155' : '#F1F5F9';
  const tickColor = isDark ? '#A9B5BF' : '#475569';

  const data = useMemo(() => [
    {
      name: 'Bear',
      'Akcje (netto)': Math.round(results[0]?.stockNetEndValuePLN ?? 0),
      [`${bmLabel} (netto)`]: Math.round(results[0]?.benchmarkEndValuePLN ?? 0),
    },
    {
      name: 'Base',
      'Akcje (netto)': Math.round(results[1]?.stockNetEndValuePLN ?? 0),
      [`${bmLabel} (netto)`]: Math.round(results[1]?.benchmarkEndValuePLN ?? 0),
    },
    {
      name: 'Bull',
      'Akcje (netto)': Math.round(results[2]?.stockNetEndValuePLN ?? 0),
      [`${bmLabel} (netto)`]: Math.round(results[2]?.benchmarkEndValuePLN ?? 0),
    },
  ], [results, bmLabel]);

  const bmKey = `${bmLabel} (netto)`;
  const currentValue = results[0]?.currentValuePLN ?? 0;

  return (
    <div className="bg-bg-card rounded-xl border border-border shadow-sm p-5 space-y-3">
      <h3 className="text-base font-semibold text-text-primary">Wartość końcowa — porównanie</h3>
      <ResponsiveContainer width="100%" height={300} debounce={32}>
        <BarChart data={data} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey="name" tick={{ fontSize: 13, fill: tickColor }} />
          <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: tickColor }} />
          <Tooltip
            formatter={fmtTooltipPLN}
            contentStyle={{
              backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
              borderColor: isDark ? '#334155' : '#CBD5E1',
              borderRadius: '8px',
              color: isDark ? '#F1F5F9' : '#0F172A',
            }}
          />
          <Legend />
          <ReferenceLine y={currentValue} stroke={isDark ? '#A9B5BF' : '#475569'} strokeDasharray="5 5" label={{ value: 'Wartość dziś', fontSize: 11, fill: isDark ? '#A9B5BF' : '#475569' }} />
          <Bar dataKey="Akcje (netto)" fill={isDark ? '#67E8F9' : '#115E59'} radius={[4, 4, 0, 0]} />
          <Bar dataKey={bmKey} fill={isDark ? '#C4B5FD' : '#5B21B6'} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default memo(ComparisonChart);
