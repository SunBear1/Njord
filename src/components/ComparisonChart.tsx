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

function ComparisonChart({ results }: ComparisonChartProps) {
  const bmLabel = results[0]?.benchmarkLabel ?? 'Konto';
  const style = getComputedStyle(document.documentElement);
  const gridColor = style.getPropertyValue('--color-chart-grid').trim();
  const tickColor = style.getPropertyValue('--color-chart-tick').trim();
  const referenceColor = style.getPropertyValue('--color-chart-reference').trim();
  const brandColor = style.getPropertyValue('--color-brand').trim();
  const benchmarkColor = style.getPropertyValue('--color-chart-benchmark').trim();

  const data = useMemo(() => [
    {
      name: 'Niedźwiedzi',
      'Akcje (netto)': Math.round(results[0]?.stockNetEndValuePLN ?? 0),
      [`${bmLabel} (netto)`]: Math.round(results[0]?.benchmarkEndValuePLN ?? 0),
    },
    {
      name: 'Bazowy',
      'Akcje (netto)': Math.round(results[1]?.stockNetEndValuePLN ?? 0),
      [`${bmLabel} (netto)`]: Math.round(results[1]?.benchmarkEndValuePLN ?? 0),
    },
    {
      name: 'Byczy',
      'Akcje (netto)': Math.round(results[2]?.stockNetEndValuePLN ?? 0),
      [`${bmLabel} (netto)`]: Math.round(results[2]?.benchmarkEndValuePLN ?? 0),
    },
  ], [results, bmLabel]);

  const bmKey = `${bmLabel} (netto)`;
  const currentValue = results[0]?.currentValuePLN ?? 0;

  return (
    <div className="bg-bg-card rounded-xl border border-border shadow-sm p-5 space-y-3">
      <h3 className="text-base font-semibold text-text-primary">Wartość końcowa — porównanie</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey="name" tick={{ fontSize: 13, fill: tickColor }} />
          <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: tickColor }} />
          <Tooltip formatter={fmtTooltipPLN} />
          <Legend />
          <ReferenceLine y={currentValue} stroke={referenceColor} strokeDasharray="5 5" label={{ value: 'Wartość dziś', fontSize: 11, fill: referenceColor }} />
          <Bar dataKey="Akcje (netto)" fill={brandColor} radius={[4, 4, 0, 0]} />
          <Bar dataKey={bmKey} fill={benchmarkColor} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default memo(ComparisonChart);
