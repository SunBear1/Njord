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
        <span key={entry.value} className="inline-flex items-center gap-1.5 text-xs text-text-muted whitespace-nowrap">
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

function getChartColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    ike: style.getPropertyValue('--color-chart-ike').trim(),
    ikze: style.getPropertyValue('--color-chart-ikze').trim(),
    regular: style.getPropertyValue('--color-chart-regular').trim(),
    inflation: style.getPropertyValue('--color-chart-inflation').trim(),
    counterfactual: style.getPropertyValue('--color-chart-counterfactual').trim(),
    grid: style.getPropertyValue('--color-chart-grid').trim(),
    tick: style.getPropertyValue('--color-chart-tick').trim(),
    tooltipBg: style.getPropertyValue('--color-chart-tooltip-bg').trim(),
    tooltipBorder: style.getPropertyValue('--color-chart-tooltip-border').trim(),
    tooltipText: style.getPropertyValue('--color-chart-tooltip-text').trim(),
  };
}

function AccumulationChart({ data, milestones }: AccumulationChartProps) {
  const [viewMode, setViewMode] = useState<'stacked' | 'lines'>('stacked');
  const chartColors = getChartColors();
  const { grid: gridColor, tick: tickColor } = chartColors;

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
            className={`px-2.5 py-1 transition-colors ${viewMode === 'stacked' ? 'bg-bg-muted font-semibold text-text-primary' : 'text-text-muted hover:bg-bg-muted/50'}`}
            aria-pressed={viewMode === 'stacked'}
          >
            Skumulowany
          </button>
          <button
            type="button"
            onClick={() => setViewMode('lines')}
            className={`px-2.5 py-1 transition-colors ${viewMode === 'lines' ? 'bg-bg-muted font-semibold text-text-primary' : 'text-text-muted hover:bg-bg-muted/50'}`}
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
                backgroundColor: chartColors.tooltipBg,
                borderColor: chartColors.tooltipBorder,
                color: chartColors.tooltipText,
              }}
            />
            <Legend content={<CustomLegend />} />
            <Area type="monotone" dataKey="Rachunek maklerski" stackId="1" stroke={chartColors.regular} fill={chartColors.regular} fillOpacity={0.3} />
            <Area type="monotone" dataKey="IKZE" stackId="1" stroke={chartColors.ikze} fill={chartColors.ikze} fillOpacity={0.3} />
            <Area type="monotone" dataKey="IKE" stackId="1" stroke={chartColors.ike} fill={chartColors.ike} fillOpacity={0.3} />
            <Line type="monotone" dataKey="Siła nabywcza" stroke={chartColors.inflation} strokeDasharray="6 3" dot={false} strokeWidth={1.5} />
            <Line type="monotone" dataKey="Bez IKE/IKZE" stroke={chartColors.counterfactual} strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
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
                backgroundColor: chartColors.tooltipBg,
                borderColor: chartColors.tooltipBorder,
                color: chartColors.tooltipText,
              }}
            />
            <Legend content={<CustomLegend />} />
            <Line type="monotone" dataKey="IKE" stroke={chartColors.ike} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="IKZE" stroke={chartColors.ikze} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Rachunek maklerski" stroke={chartColors.regular} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Siła nabywcza" stroke={chartColors.inflation} strokeDasharray="6 3" dot={false} strokeWidth={1.5} />
            <Line type="monotone" dataKey="Bez IKE/IKZE" stroke={chartColors.counterfactual} strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export default memo(AccumulationChart);
