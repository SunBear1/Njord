import { useState, useMemo, useEffect, useRef } from 'react';
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
import { TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import type { HistoricalPrice } from '../types/asset';
import {
  SPANS,
  filterBySpan,
  calcPeriodChange,
  formatXAxisDate,
  formatIntradayTime,
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

const SPAN_TO_PARAMS: Record<SpanKey, { interval: string; range: string } | null> = {
  '1D': { interval: '5m', range: '1d' },
  '1T': { interval: '30m', range: '5d' },
  '1M': null,
  '3M': null,
  '6M': null,
  '1Y': null,
  '2Y': null,
  '5Y': null,
};

function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOL[currency] ?? currency;
}

function barToHistoricalPrice(bar: { timestamp: number; close: number }): HistoricalPrice {
  const date = new Date(bar.timestamp * 1000).toISOString().slice(0, 16).replace('T', ' ');
  return { date, close: bar.close };
}

export function StockPriceChart({
  ticker,
  currentPrice,
  historicalPrices,
  currency,
  isDark,
}: StockPriceChartProps) {
  const [activeSpan, setActiveSpan] = useState<SpanKey>('1Y');
  // Intraday data fetched on demand; derive loading from span mismatch
  const [intradayState, setIntradayState] = useState<{
    span: SpanKey | null;
    prices: HistoricalPrice[];
  }>({ span: null, prices: [] });
  const abortRef = useRef<AbortController | null>(null);

  const isIntraday = SPANS.find((span) => span.key === activeSpan)?.intraday ?? false;
  const intradayLoading = isIntraday && intradayState.span !== activeSpan;

  useEffect(() => {
    if (!isIntraday) return;

    const params = SPAN_TO_PARAMS[activeSpan];
    if (!params) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    fetch(
      `/api/v1/finance/stocks/${encodeURIComponent(ticker)}?interval=${params.interval}&range=${params.range}`,
      { signal: controller.signal },
    )
      .then((response) => response.json() as Promise<{ data?: Array<{ timestamp: number; close: number }> }>)
      .then((data) => {
        if (!controller.signal.aborted) {
          const prices = (data.data ?? []).map(barToHistoricalPrice);
          setIntradayState({ span: activeSpan, prices });
        }
      })
      .catch(() => {
        // Silently ignore — abort errors expected on span change
      });

    return () => { controller.abort(); };
  }, [ticker, activeSpan, isIntraday]);

  const sym = currencySymbol(currency);
  const gridColor = isDark ? '#334155' : '#F1F5F9';
  const tickColor = isDark ? '#A9B5BF' : '#475569';
  const lineColor = isDark ? '#38bdf8' : '#0369a1';
  const gradientStart = isDark ? 'rgba(56,189,248,0.25)' : 'rgba(3,105,161,0.15)';
  const gradientEnd = 'rgba(0,0,0,0)';
  const tooltipBg = isDark ? '#1E293B' : '#FFFFFF';
  const tooltipBorder = isDark ? '#334155' : '#CBD5E1';
  const tooltipText = isDark ? '#F1F5F9' : '#0F172A';

  const sliced = useMemo(() => {
    if (isIntraday) return intradayState.prices;
    return filterBySpan(historicalPrices, activeSpan);
  }, [isIntraday, intradayState.prices, historicalPrices, activeSpan]);

  const periodChange = useMemo(() => calcPeriodChange(sliced), [sliced]);
  const isPositive = periodChange >= 0;

  const yDomain = useMemo((): [number, number] => {
    if (sliced.length === 0) return [0, 1];
    const closes = sliced.map((price) => price.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const pad = (max - min) * 0.05 || max * 0.05;
    return [min - pad, max + pad];
  }, [sliced]);

  // Evenly spaced ticks across the filtered dataset
  const xTicks = useMemo(() => {
    if (sliced.length === 0) return [];
    const n = tickCount(activeSpan);
    if (sliced.length <= n) return sliced.map((price) => price.date);
    const step = Math.floor(sliced.length / (n - 1));
    const ticks: string[] = [];
    for (let i = 0; i < n - 1; i++) ticks.push(sliced[i * step].date);
    ticks.push(sliced[sliced.length - 1].date);
    return ticks;
  }, [sliced, activeSpan]);

  const formatXTick = (value: string) =>
    isIntraday ? formatIntradayTime(value) : formatXAxisDate(value, activeSpan);

  return (
    <div className="bg-bg-card rounded-xl border border-border shadow-sm p-5 space-y-4">
      {/* Header row */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-text-primary">{ticker}</span>
            {!intradayLoading && sliced.length >= 2 ? (
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
            ) : null}
          </div>
          <div className="text-2xl font-bold text-text-primary mt-0.5">
            {sym}
            {currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* Span selector */}
        <div className="flex items-center gap-1 flex-wrap">
          {SPANS.map((span) => (
            <button
              key={span.key}
              type="button"
              onClick={() => setActiveSpan(span.key)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                activeSpan === span.key
                  ? 'bg-accent-interactive text-text-on-accent'
                  : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              {span.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {intradayLoading ? (
        <div className="h-60 flex items-center justify-center text-text-muted text-sm gap-2">
          <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />
          Wczytywanie danych intraday…
        </div>
      ) : sliced.length > 1 ? (
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
              tickFormatter={formatXTick}
              tick={{ fontSize: 11, fill: tickColor }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />

            <YAxis
              domain={yDomain}
              tickFormatter={(value: number) =>
                `${sym}${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
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
                const displayLabel = isIntraday
                  ? formatIntradayTime(label as string)
                  : (label as string);
                return (
                  <div
                    style={{
                      backgroundColor: tooltipBg,
                      borderColor: tooltipBorder,
                      color: tooltipText,
                    }}
                    className="border rounded-lg shadow-sm px-3 py-2 text-xs"
                  >
                    <div className="font-semibold mb-0.5">{displayLabel}</div>
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
