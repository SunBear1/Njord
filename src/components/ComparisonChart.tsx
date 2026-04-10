import { useMemo } from 'react';
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
}

export function ComparisonChart({ results }: ComparisonChartProps) {
  const bmLabel = results[0]?.benchmarkLabel ?? 'Konto';

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
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
      <h3 className="text-base font-semibold text-gray-800">Wartość końcowa — porównanie</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="name" tick={{ fontSize: 13 }} />
          <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
          <Tooltip formatter={fmtTooltipPLN} />
          <Legend />
          <ReferenceLine y={currentValue} stroke="#94a3b8" strokeDasharray="5 5" label={{ value: 'Wartość dziś', fontSize: 11, fill: '#94a3b8' }} />
          <Bar dataKey="Akcje (netto)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar dataKey={bmKey} fill="#8b5cf6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
