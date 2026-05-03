import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { HistoricalPrice } from '../types/asset';
import {
  SPANS,
  filterBySpan,
  calcPeriodChange,
  formatXAxisDate,
  tickCount,
  type SpanKey,
} from '../utils/stockChartUtils';

interface StockPriceChartProps {
  ticker: string;
  currentPrice: number;
  historicalPrices: HistoricalPrice[];
  currency: string;
  isDark?: boolean;
}

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  PLN: 'zł',
};

function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOL[currency] ?? currency;
}

export function StockPriceChart({
  ticker,
  currentPrice,
  historicalPrices,
  currency,
  isDark,
}: StockPriceChartProps) {
  const [activeSpan, setActiveSpan] = useState<SpanKey>('1Y');

  const sym = currencySymbol(currency);
  const gridColor = isDark ? '#334155' : '#F1F5F9';
  const tickColor = isDark ? '#A9B5BF' : '#475569';
  const lineColor = isDark ? '#38bdf8' : '#0369a1';
  const gradientStart = isDark ? 'rgba(56,189,248,0.25)' : 'rgba(3,105,161,0.15)';
  const gradientEnd = 'rgba(0,0,0,0)';
  const tooltipBg = isDark ? '#1E293B' : '#FFFFFF';
  const tooltipBorder = isDark ? '#334155' : '#CBD5E1';
  const tooltipText = isDark ? '#F1F5F9' : '#0F172A';

  const sliced = useMemo(
    () => filterBySpan(historicalPrices, activeSpan),
    [historicalPrices, activeSpan],
  );

  const periodChange = useMemo(() => calcPeriodChange(sliced), [sliced]);
  const isPositive = periodChange >= 0;

  const yDomain = useMemo((): [number, number] => {
    if (sliced.length === 0) return [0, 1];
    const closes = sliced.map((p) => p.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const pad = (max - min) * 0.05 || max * 0.05;
    return [min - pad, max + pad];
  }, [sliced]);

  // Evenly spaced ticks across the filtered dataset
  const xTicks = useMemo(() => {
    if (sliced.length === 0) return [];
    const n = tickCount(activeSpan);
    if (sliced.length <= n) return sliced.map((p) => p.date);
    const step = Math.floor(sliced.length / (n - 1));
    const ticks: string[] = [];
    for (let i = 0; i < n - 1; i++) ticks.push(sliced[i * step].date);
    ticks.push(sliced[sliced.length - 1].date);
    return ticks;
  }, [sliced, activeSpan]);

  return (
    <div className="bg-bg-card rounded-xl border border-border shadow-sm p-5 space-y-4">
      {/* Header row */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-text-primary">{ticker}</span>
            <span
              className={`flex items-center gap-1 text-sm font-medium ${
                isPositive ? 'text-success' : 'text-danger'
              }`}
            >
              {isPositive ? (
                <TrendingUp size={14} aria-hidden="true" />
              ) : (
                <TrendingDown size={14} aria-hidden="true" />
              )}
              {isPositive ? '+' : ''}
              {periodChange.toFixed(2)}%
            </span>
          </div>
          <div className="text-2xl font-bold text-text-primary mt-0.5">
            {sym}
            {currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* Span selector */}
        <div className="flex items-center gap-1 flex-wrap">
          {SPANS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setActiveSpan(s.key)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                activeSpan === s.key
                  ? 'bg-accent-interactive text-text-on-accent'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {sliced.length > 1 ? (
        <ResponsiveContainer width="100%" height={240} debounce={32}>
          <AreaChart data={sliced} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={gradientStart} />
                <stop offset="100%" stopColor={gradientEnd} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />

            <XAxis
              dataKey="date"
              ticks={xTicks}
              tickFormatter={(v) => formatXAxisDate(v as string, activeSpan)}
              tick={{ fontSize: 11, fill: tickColor }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />

            <YAxis
              domain={yDomain}
              tickFormatter={(v: number) =>
                `${sym}${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
              }
              tick={{ fontSize: 11, fill: tickColor }}
              axisLine={false}
              tickLine={false}
              width={60}
              tickCount={5}
            />

            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const price = payload[0]?.value as number | undefined;
                return (
                  <div
                    style={{
                      backgroundColor: tooltipBg,
                      borderColor: tooltipBorder,
                      color: tooltipText,
                    }}
                    className="border rounded-lg shadow-sm px-3 py-2 text-xs"
                  >
                    <div className="font-semibold mb-0.5">{label as string}</div>
                    <div>
                      {sym}
                      {(price ?? 0).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                );
              }}
            />

            <Area
              type="monotone"
              dataKey="close"
              stroke={lineColor}
              strokeWidth={1.5}
              fill="url(#priceGradient)"
              dot={false}
              activeDot={{ r: 3, fill: lineColor, stroke: 'none' }}
              name="Cena"
            />

            <ReferenceLine
              y={currentPrice}
              stroke={tickColor}
              strokeDasharray="4 3"
              strokeWidth={1}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-60 flex items-center justify-center text-text-muted text-sm">
          Za mało danych dla tego zakresu.
        </div>
      )}
    </div>
  );
}
