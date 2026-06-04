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

// Custom legend renderer
function CustomLegend({ payload }: { payload?: Array<{ value: string; color: string }> }) {
  if (!payload) return null;
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2 px-2">
      {payload.map((entry) => (
        <span key={entry.value} className="inline-flex items-center gap-1.5 text-xs text-text-secondary whitespace-nowrap">
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          {entry.value}
        </span>
      ))}
    </div>
  );
}

const WRAPPER_COLORS = {
  ike: '#065F46',      // emerald-800
  ikze: '#0369a1',     // sky-700
  regular: '#115E59',  // teal-800
  inflation: '#475569', // slate-600
  counterfactual: '#991B1B', // red-800
} as const;

const WRAPPER_COLORS_DARK = {
  ike: '#6EE7B7',
  ikze: '#38bdf8',
  regular: '#67E8F9',
  inflation: '#A9B5BF',
  counterfactual: '#FCA5A5',
} as const;

function AccumulationChart({ data, milestones, isDark }: AccumulationChartProps) {
  const [viewMode, setViewMode] = useState<'stacked' | 'lines'>('stacked');
  const colors = isDark ? WRAPPER_COLORS_DARK : WRAPPER_COLORS;
  const gridColor = isDark ? '#334155' : '#F1F5F9';
  const tickColor = isDark ? '#A9B5BF' : '#475569';

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
    <div className="bg-bg-card rounded-xl border border-border shadow-sm p-5 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-base font-semibold text-text-primary">
          Wzrost portfela w czasie
        </h3>
        <div className="flex rounded-lg border border-border overflow-hidden text-xs" role="group" aria-label="Widok wykresu">
          <button
            type="button"
            onClick={() => setViewMode('stacked')}
            className={`px-2.5 py-1 transition-colors ${viewMode === 'stacked' ? 'bg-bg-hover font-semibold text-text-primary' : 'text-text-muted hover:bg-bg-hover'}`}
            aria-pressed={viewMode === 'stacked'}
          >
            Skumulowany
          </button>
          <button
            type="button"
            onClick={() => setViewMode('lines')}
            className={`px-2.5 py-1 transition-colors ${viewMode === 'lines' ? 'bg-bg-hover font-semibold text-text-primary' : 'text-text-muted hover:bg-bg-hover'}`}
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
              className="text-xs bg-bg-hover text-accent-primary-secondary border border-border px-2 py-0.5 rounded-full"
            >
              ★ {m.label} PLN — rok {m.year}
            </span>
          ))}
        </div>
      )}

      <ResponsiveContainer width="100%" height={420} debounce={32}>
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
                backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                borderColor: isDark ? '#334155' : '#CBD5E1',
                color: isDark ? '#F1F5F9' : '#0F172A',
              }}
            />
            <Legend content={<CustomLegend />} />
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
                backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                borderColor: isDark ? '#334155' : '#CBD5E1',
                color: isDark ? '#F1F5F9' : '#0F172A',
              }}
            />
            <Legend content={<CustomLegend />} />
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
