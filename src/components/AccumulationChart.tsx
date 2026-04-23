import { useMemo, memo, useState } from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { CombinedYearSnapshot, Milestone } from '../types/accumulation';
import { fmtPLN } from '../utils/formatting';

interface AccumulationChartProps {
  data: CombinedYearSnapshot[];
  milestones: Milestone[];
  isDark?: boolean;
}

const WRAPPER_COLORS = {
  ike: '#16a34a',      // green-600
  ikze: '#7c3aed',     // violet-600
  regular: '#2563eb',  // blue-600
  inflation: '#6b7280', // gray-500
  counterfactual: '#ef4444', // red-500
} as const;

const WRAPPER_COLORS_DARK = {
  ike: '#22c55e',
  ikze: '#a78bfa',
  regular: '#60a5fa',
  inflation: '#9ca3af',
  counterfactual: '#f87171',
} as const;

function AccumulationChart({ data, milestones, isDark }: AccumulationChartProps) {
  const [viewMode, setViewMode] = useState<'stacked' | 'lines'>('stacked');
  const colors = isDark ? WRAPPER_COLORS_DARK : WRAPPER_COLORS;
  const gridColor = isDark ? '#374151' : '#f0f0f0';
  const tickColor = isDark ? '#9ca3af' : '#666666';

  const chartData = useMemo(() =>
    data.map(snap => ({
      year: snap.year,
      IKE: Math.round(snap.ikeValue),
      IKZE: Math.round(snap.ikzeValue),
      'Rachunek maklerski': Math.round(snap.regularValue),
      'Siła nabywcza': Math.round(snap.inflationErodedContributions),
      'Bez IKE/IKZE': Math.round(snap.counterfactualValue),
      total: Math.round(snap.totalNominal),
    })),
    [data],
  );

  // Find milestone annotations
  const milestoneAnnotations = useMemo(() =>
    milestones.map(m => ({
      year: m.year,
      label: m.threshold >= 1_000_000
        ? `${(m.threshold / 1_000_000).toFixed(0)}M`
        : `${(m.threshold / 1_000).toFixed(0)}k`,
    })),
    [milestones],
  );

  const formatTooltip = (value: unknown) => fmtPLN(Number(value ?? 0));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
          Wzrost portfela w czasie
        </h3>
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs" role="group" aria-label="Widok wykresu">
          <button
            type="button"
            onClick={() => setViewMode('stacked')}
            className={`px-2.5 py-1 transition-colors ${viewMode === 'stacked' ? 'bg-gray-100 dark:bg-gray-700 font-semibold text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
            aria-pressed={viewMode === 'stacked'}
          >
            Skumulowany
          </button>
          <button
            type="button"
            onClick={() => setViewMode('lines')}
            className={`px-2.5 py-1 transition-colors ${viewMode === 'lines' ? 'bg-gray-100 dark:bg-gray-700 font-semibold text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
            aria-pressed={viewMode === 'lines'}
          >
            Linie
          </button>
        </div>
      </div>

      {milestoneAnnotations.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {milestoneAnnotations.map(m => (
            <span
              key={m.year}
              className="text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full"
            >
              ★ {m.label} PLN — rok {m.year}
            </span>
          ))}
        </div>
      )}

      <ResponsiveContainer width="100%" height={420}>
        {viewMode === 'stacked' ? (
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 24, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 11, fill: tickColor }}
              label={{ value: 'Lata', position: 'insideBottom', offset: -15, style: { fontSize: 11, fill: tickColor } }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: tickColor }}
              tickFormatter={(v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${Math.round(v / 1_000)}k`}
            />
            <Tooltip
              formatter={formatTooltip}
              labelFormatter={(v) => `Rok ${v}`}
              contentStyle={{
                backgroundColor: isDark ? '#1e293b' : '#fff',
                borderColor: isDark ? '#334155' : '#e5e7eb',
                color: isDark ? '#f8fafc' : '#111827',
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="Rachunek maklerski" stackId="1" stroke={colors.regular} fill={colors.regular} fillOpacity={0.3} />
            <Area type="monotone" dataKey="IKZE" stackId="1" stroke={colors.ikze} fill={colors.ikze} fillOpacity={0.3} />
            <Area type="monotone" dataKey="IKE" stackId="1" stroke={colors.ike} fill={colors.ike} fillOpacity={0.3} />
            <Line type="monotone" dataKey="Siła nabywcza" stroke={colors.inflation} strokeDasharray="6 3" dot={false} strokeWidth={1.5} />
            <Line type="monotone" dataKey="Bez IKE/IKZE" stroke={colors.counterfactual} strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
          </AreaChart>
        ) : (
          <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 24, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 11, fill: tickColor }}
              label={{ value: 'Lata', position: 'insideBottom', offset: -15, style: { fontSize: 11, fill: tickColor } }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: tickColor }}
              tickFormatter={(v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${Math.round(v / 1_000)}k`}
            />
            <Tooltip
              formatter={formatTooltip}
              labelFormatter={(v) => `Rok ${v}`}
              contentStyle={{
                backgroundColor: isDark ? '#1e293b' : '#fff',
                borderColor: isDark ? '#334155' : '#e5e7eb',
                color: isDark ? '#f8fafc' : '#111827',
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="IKE" stroke={colors.ike} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="IKZE" stroke={colors.ikze} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Rachunek maklerski" stroke={colors.regular} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Siła nabywcza" stroke={colors.inflation} strokeDasharray="6 3" dot={false} strokeWidth={1.5} />
            <Line type="monotone" dataKey="Bez IKE/IKZE" stroke={colors.counterfactual} strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export default memo(AccumulationChart);
