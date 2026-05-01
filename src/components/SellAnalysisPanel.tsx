import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { Target, TrendingUp, AlertTriangle, Loader2, Calendar } from 'lucide-react';
import type { SellAnalysisResult } from '../types/sellAnalysis';
import { fmtUSD } from '../utils/formatting';

interface SellAnalysisPanelProps {
  analysis: SellAnalysisResult | null;
  isLoading: boolean;
  horizonDays: number;
  onHorizonChange: (days: number) => void;
  currentFxRate: number;
  isDark?: boolean;
}

const UNIFIED_PRESETS = [
  { days: 21,  label: '1 miesiąc' },
  { days: 63,  label: '1 kwartał' },
  { days: 126, label: '6 miesięcy' },
  { days: 252, label: '1 rok' },
] as const;

const MONTH_NAMES = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'] as const;

/** Approximate trading days from today to end of a given month/year. */
function tradingDaysUntil(year: number, month: number): number {
  const now = new Date();
  const target = new Date(year, month, 0); // last day of month
  const diffMs = target.getTime() - now.getTime();
  const calendarDays = Math.max(1, Math.ceil(diffMs / 86_400_000));
  return Math.round(calendarDays * (252 / 365));
}

/** Month name label for N trading days from today. */
function targetMonthLabel(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + Math.round(days * 365 / 252));
  return `${MONTH_NAMES[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
}

/** Next N calendar months with approx trading-day counts. */
function getMonthOptions(count: number): { label: string; year: number; month: number; days: number }[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
    const m = d.getMonth();
    const y = d.getFullYear();
    const days = tradingDaysUntil(y, m + 1);
    return { label: `${MONTH_NAMES[m]} '${String(y).slice(2)}`, year: y, month: m + 1, days };
  });
}

export function SellAnalysisPanel({ analysis, isLoading, horizonDays, onHorizonChange, currentFxRate, isDark }: SellAnalysisPanelProps) {
  const gridColor = isDark ? '#334155' : '#F1F5F9';
  const tickColor = isDark ? '#A9B5BF' : '#475569';
  const labelColor = isDark ? '#A9B5BF' : '#475569';
  const [showTable, setShowTable] = useState(true);
  const [isCustomActive, setIsCustomActive] = useState(false);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const monthOptions = useMemo(() => getMonthOptions(8), []);

  // Transform fan chart data into stackable bands
  const fanChartBands = useMemo(() => {
    if (!analysis) return [];
    return analysis.fanChart.map((pt) => ({
      day: pt.day,
      // Bottom band: p10 (base offset, invisible)
      base: pt.p10,
      // Band heights for stacking
      band_p10_p25: pt.p25 - pt.p10,
      band_p25_p50: pt.p50 - pt.p25,
      band_p50_p75: pt.p75 - pt.p50,
      band_p75_p90: pt.p90 - pt.p75,
      // Keep absolute values for tooltip
      p10: pt.p10,
      p25: pt.p25,
      p50: pt.p50,
      p75: pt.p75,
      p90: pt.p90,
    }));
  }, [analysis]);

  // Prepare touch probability curve data
  const touchCurveData = useMemo(() => {
    if (!analysis) return [];
    return analysis.touchProbabilities.map((tp) => ({
      target: tp.target,
      pTouch: Math.round(tp.pTouch * 1000) / 10, // as %
    }));
  }, [analysis]);

  return (
    <div className="space-y-5">
      {/* Header with unified horizon selector */}
      <div className="bg-bg-card rounded-xl border border-border shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Target size={20} className="text-accent-primary" />
          <h2 className="text-lg font-semibold text-text-primary">Optymalna cena sprzedaży</h2>
        </div>

        {/* Unified horizon chips — each shows duration + dynamically computed target month */}
        <div className="flex gap-2 flex-wrap items-start">
          {UNIFIED_PRESETS.map((p) => {
            const isActive = !isCustomActive && horizonDays === p.days;
            return (
              <button
                type="button"
                key={p.days}
                onClick={() => { onHorizonChange(p.days); setIsCustomActive(false); setShowCustomPicker(false); }}
                className={`flex flex-col items-center px-4 py-2 rounded-xl border transition-colors ${
                  isActive
                    ? 'bg-accent-interactive border-accent-interactive/40 text-text-on-accent shadow-sm'
                    : 'bg-bg-card border-border text-text-secondary hover:border-accent-primary/40 hover:bg-bg-hover/30'
                }`}
              >
                <span className="text-sm font-semibold leading-snug">{p.label}</span>
                <span className={`text-[11px] leading-snug ${isActive ? 'text-text-secondary' : 'text-text-muted'}`}>
                  {targetMonthLabel(p.days)}
                </span>
              </button>
            );
          })}

          {/* Custom deadline chip */}
          <button
            type="button"
            onClick={() => setShowCustomPicker((v) => !v)}
            className={`flex flex-col items-center px-4 py-2 rounded-xl border transition-colors ${
              isCustomActive || showCustomPicker
                ? 'bg-accent-interactive border-accent-interactive/40 text-text-on-accent shadow-sm'
                : 'bg-bg-card border-border text-text-secondary hover:border-accent-primary/40 hover:bg-bg-hover/30'
            }`}
          >
            <span className="text-sm font-semibold leading-snug">Własny</span>
            <span className={`text-[11px] leading-snug ${isCustomActive || showCustomPicker ? 'text-text-secondary' : 'text-text-muted'}`}>
              {isCustomActive ? targetMonthLabel(horizonDays) : '↓ wybierz'}
            </span>
          </button>
        </div>

        {/* Custom month picker — expands inline below chip row */}
        {showCustomPicker && (
          <div className="flex gap-1.5 flex-wrap pt-1">
            {monthOptions.map((mo) => (
              <button
                type="button"
                key={`${mo.year}-${mo.month}`}
                onClick={() => {
                  onHorizonChange(tradingDaysUntil(mo.year, mo.month));
                  setIsCustomActive(true);
                  setShowCustomPicker(false);
                }}
                className="flex flex-col items-center px-3 py-1.5 rounded-lg border border-border bg-bg-card hover:border-accent-primary/40 hover:bg-bg-hover transition-colors"
              >
                <span className="text-xs font-medium text-text-primary">{mo.label}</span>
                <span className="text-[10px] text-text-muted">~{Math.round(mo.days / 21)} mies.</span>
              </button>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 mt-4 text-sm text-text-muted">
            <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />
            Symulacja Monte Carlo (10 000 ścieżek)…
          </div>
        )}
      </div>

      {analysis && !isLoading ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <SummaryCard
              label="Optymalna cena"
              value={fmtUSD(analysis.optimalTarget.target)}
              subvalue={`${((analysis.optimalTarget.target / analysis.currentPrice - 1) * 100).toFixed(1)}% od bieżącej`}
              accent="blue"
            />
            <SummaryCard
              label="P(realizacja)"
              value={`${(analysis.optimalTarget.pTouch * 100).toFixed(0)}%`}
              subvalue="szansa osiągnięcia ceny"
              accent="green"
            />
            <SummaryCard
              label="Oczekiwana wartość"
              value={fmtUSD(analysis.optimalTarget.expectedValue)}
              subvalue={`PLN: ${(analysis.optimalTarget.expectedValue * currentFxRate).toFixed(0)} zł`}
              accent="purple"
            />
            <SummaryCard
              label="Ryzyko spadku"
              value={`${(analysis.riskOfForcedSale * 100).toFixed(0)}%`}
              subvalue="P(cena końcowa < dziś)"
              accent="red"
            />
          </div>

          {/* Regime + peak info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-bg-card rounded-xl border border-border shadow-sm p-4">
              <div className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">Reżim rynkowy</div>
              <div className={`text-lg font-bold ${analysis.regimeInfo.currentRegimeLabel === 'bull' ? 'text-success' : 'text-danger '}`}>
                {analysis.regimeInfo.currentRegimeLabel === 'bull' ? '📈 Faza wzrostowa' : '📉 Faza spadkowa'}
              </div>
              <div className="text-xs text-text-muted mt-1">
                Pewność: {Math.round(analysis.regimeInfo.posteriorProbability * 100)}%
                {' · ~'}{analysis.regimeInfo.expectedDurations[analysis.regimeInfo.currentState].toFixed(0)} sesji
              </div>
            </div>
            <div className="bg-bg-card rounded-xl border border-border shadow-sm p-4">
              <div className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">Mediana szczytowej ceny</div>
              <div className="text-lg font-bold text-text-primary">{fmtUSD(analysis.peakDistribution.p50)}</div>
              <div className="text-xs text-text-muted mt-1">
                Zakres: {fmtUSD(analysis.peakDistribution.p10)} – {fmtUSD(analysis.peakDistribution.p90)}
              </div>
            </div>
            <div className="bg-bg-card rounded-xl border border-border shadow-sm p-4">
              <div className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">Szczyt (dzień)</div>
              <div className="text-lg font-bold text-text-primary flex items-center gap-1.5">
                <Calendar size={16} className="text-text-muted" />
                dzień {analysis.peakTimingDistribution.p50.toFixed(0)}
              </div>
              <div className="text-xs text-text-muted mt-1">
                Zakres: dzień {analysis.peakTimingDistribution.p10.toFixed(0)} – {analysis.peakTimingDistribution.p90.toFixed(0)}
              </div>
            </div>
          </div>

          {/* Fan Chart */}
          <div className="bg-bg-card rounded-xl border border-border shadow-sm p-5 space-y-3">
            <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
              <TrendingUp size={16} className="text-accent-primary" />
              Wachlarz cenowy (10 000 symulacji)
            </h3>
            <p className="text-xs text-text-muted">
              Pasma pokazują zakres cen: ciemniejsze = bardziej prawdopodobne (p25–p75), jaśniejsze = ogon rozkładu (p10–p90).
              Linia niebieska przerywana = optymalna cena sprzedaży.
            </p>
            <ResponsiveContainer width="100%" height={400} debounce={32}>
              <AreaChart data={fanChartBands} margin={{ top: 10, right: 10, bottom: 24, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis
                  dataKey="day"
                  tickFormatter={(v) => `${v}d`}
                  tick={{ fontSize: 11, fill: tickColor }}
                  label={{ value: 'Dzień handlowy', position: 'insideBottomRight', offset: 0, fontSize: 11, fill: labelColor }}
                />
                <YAxis
                  tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                  tick={{ fontSize: 11, fill: tickColor }}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload as Record<string, number> | undefined;
                    if (!d) return null;
                    return (
                      <div className="bg-bg-card border border-border rounded-lg shadow-sm p-2 text-xs">
                        <div className="font-semibold text-text-primary mb-1">Dzień {label}</div>
                        <div className="text-text-secondary">p90: {fmtUSD(d.p90)}</div>
                        <div className="text-text-secondary">p75: {fmtUSD(d.p75)}</div>
                        <div className="text-accent-primary font-medium">p50: {fmtUSD(d.p50)}</div>
                        <div className="text-text-secondary">p25: {fmtUSD(d.p25)}</div>
                        <div className="text-text-secondary">p10: {fmtUSD(d.p10)}</div>
                      </div>
                    );
                  }}
                  labelFormatter={(v) => `Dzień ${v}`}
                />
                {/* Invisible base layer to offset stacking to p10 level */}
                <Area type="monotone" dataKey="base" stackId="fan" stroke="none" fill="transparent" name="base" />
                {/* p10–p25 band (lightest) */}
                <Area type="monotone" dataKey="band_p10_p25" stackId="fan" stroke="none" fill={isDark ? '#334155' : '#F1F5F9'} fillOpacity={0.6} name="band_p10_p25" />
                {/* p25–p50 band */}
                <Area type="monotone" dataKey="band_p25_p50" stackId="fan" stroke="none" fill={isDark ? '#7dd3fc' : '#0369a1'} fillOpacity={0.3} name="band_p25_p50" />
                {/* p50–p75 band */}
                <Area type="monotone" dataKey="band_p50_p75" stackId="fan" stroke="none" fill={isDark ? '#7dd3fc' : '#0369a1'} fillOpacity={0.3} name="band_p50_p75" />
                {/* p75–p90 band (lightest) */}
                <Area type="monotone" dataKey="band_p75_p90" stackId="fan" stroke="none" fill={isDark ? '#334155' : '#F1F5F9'} fillOpacity={0.6} name="band_p75_p90" />
                {/* Median line (non-stacked overlay) */}
                <Area type="monotone" dataKey="p50" stroke={isDark ? '#7dd3fc' : '#0369a1'} strokeWidth={2} fill="none" name="Mediana" />
                {/* Reference lines */}
                <ReferenceLine y={analysis.currentPrice} stroke={isDark ? '#A9B5BF' : '#475569'} strokeDasharray="4 4" label={{ value: `Dziś: ${fmtUSD(analysis.currentPrice)}`, position: 'right', fontSize: 10, fill: isDark ? '#A9B5BF' : '#475569' }} />
                <ReferenceLine y={analysis.optimalTarget.target} stroke={isDark ? '#7dd3fc' : '#0369a1'} strokeDasharray="6 3" strokeWidth={2} label={{ value: `Cel: ${fmtUSD(analysis.optimalTarget.target)}`, position: 'right', fontSize: 10, fill: isDark ? '#7dd3fc' : '#0369a1' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Touch Probability Curve */}
          <div className="bg-bg-card rounded-xl border border-border shadow-sm p-5 space-y-3">
            <h3 className="text-base font-semibold text-text-primary">Prawdopodobieństwo osiągnięcia ceny</h3>
            <p className="text-xs text-text-muted">
              Stromy spadek krzywej = „granica chciwości" — powyżej tego progu szansa realizacji gwałtownie maleje.
            </p>
            <ResponsiveContainer width="100%" height={300} debounce={32}>
              <LineChart data={touchCurveData} margin={{ top: 10, right: 10, bottom: 24, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis
                  dataKey="target"
                  tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                  tick={{ fontSize: 11, fill: tickColor }}
                  label={{ value: 'Cena docelowa (USD)', position: 'insideBottomRight', offset: 0, fontSize: 11, fill: labelColor }}
                />
                <YAxis
                  tickFormatter={(v: number) => `${v}%`}
                  tick={{ fontSize: 11, fill: tickColor }}
                  domain={[0, 100]}
                />
                <Tooltip
                  formatter={(v: ValueType | undefined) => [`${Number(v ?? 0).toFixed(1)}%`, 'P(osiągnięcia)']}
                  labelFormatter={(v) => `Cel: ${fmtUSD(Number(v))}`}
                  contentStyle={{
                    backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                    borderColor: isDark ? '#334155' : '#CBD5E1',
                    borderRadius: '8px',
                    color: isDark ? '#F1F5F9' : '#0F172A',
                  }}
                />
                <Line type="monotone" dataKey="pTouch" stroke={isDark ? '#7dd3fc' : '#0369a1'} strokeWidth={2.5} dot={{ r: 3 }} name="P(touch)" />
                <ReferenceLine x={analysis.optimalTarget.target} stroke={isDark ? '#6EE7B7' : '#065F46'} strokeDasharray="6 3" label={{ value: 'Optymalny', position: 'top', fontSize: 10, fill: isDark ? '#6EE7B7' : '#065F46' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Summary Table */}
          <div className="bg-bg-card rounded-xl border border-border shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-text-primary">Tabela celów sprzedaży</h3>
              <button
                type="button"
                onClick={() => setShowTable((v) => !v)}
                className="text-xs text-accent-primary hover:text-accent-primary/80"
              >
                {showTable ? 'Zwiń' : 'Rozwiń'}
              </button>
            </div>
            {showTable && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-text-muted uppercase tracking-wide">
                      <th className="pb-2 pr-4">Cel (USD)</th>
                      <th className="pb-2 pr-4">Zmiana</th>
                      <th className="pb-2 pr-4">P(realizacja)</th>
                      <th className="pb-2 pr-4">Oczek. wartość</th>
                      <th className="pb-2">PLN (kantor)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.expectedSellPrices.map((sp) => {
                      const isOptimal = sp.target === analysis.optimalTarget.target;
                      const changePct = ((sp.target / analysis.currentPrice - 1) * 100);
                      const isDownside = sp.type === 'downside';
                      return (
                        <tr
                          key={sp.target}
                          className={`border-b border-border ${isOptimal ? 'bg-bg-hover/30 font-semibold' : isDownside ? 'bg-bg-hover/40 bg-danger/5' : ''}`}
                        >
                          <td className="py-2 pr-4">
                            {fmtUSD(sp.target)}
                            {isOptimal && <span className="ml-1.5 text-[10px] text-accent-primary font-bold">★ OPTYMALNY</span>}
                            {isDownside && <span className="ml-1.5 text-[10px] text-danger font-medium">↓ drawdown</span>}
                          </td>
                          <td className={`py-2 pr-4 ${changePct >= 0 ? 'text-success' : 'text-danger'}`}>
                            {changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%
                          </td>
                          <td className="py-2 pr-4">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-bg-hover rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${isDownside ? 'bg-bg-hover' : sp.pTouch > 0.5 ? 'bg-bg-hover' : sp.pTouch > 0.2 ? 'bg-danger/50' : 'bg-bg-hover'}`}
                                  style={{ width: `${sp.pTouch * 100}%` }}
                                />
                              </div>
                              <span>{(sp.pTouch * 100).toFixed(0)}%</span>
                            </div>
                          </td>
                          <td className="py-2 pr-4">{fmtUSD(sp.expectedValue)}</td>
                          <td className="py-2 text-text-secondary">{(sp.expectedValue * currentFxRate).toFixed(0)} zł</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Disclaimer */}
          <div className="bg-danger/5 border border-danger/30 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle size={16} className="text-danger shrink-0 mt-0.5" />
            <div className="text-xs text-danger space-y-1">
              <p className="font-semibold">Ograniczenia modelu</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Model nie przewiduje wydarzeń jednorazowych (wyniki kwartalne, przejęcia, regulacje)</li>
                <li>Bazuje na historycznych rozkładach zwrotów (~2 lata) — przeszłość nie gwarantuje przyszłości</li>
                <li>HMM wykrywa reżimy historyczne, ale ma ograniczoną moc predykcyjną</li>
                <li>Kurs USD/PLN założony jako stały — zmiana kursu wpłynie na wynik w PLN</li>
                <li>To narzędzie analityczne, nie rekomendacja inwestycyjna</li>
              </ul>
            </div>
          </div>
        </>
      ) : !isLoading ? (
        <div className="bg-bg-card rounded-xl border border-border shadow-sm p-8 text-center text-text-muted">
          <Target size={32} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">Wczytaj dane akcji, aby uruchomić analizę optymalnej ceny sprzedaży.</p>
          <p className="text-xs mt-1">Wymaga minimum 30 sesji danych historycznych.</p>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponent
// ---------------------------------------------------------------------------

function SummaryCard({ label, value, subvalue, accent }: { label: string; value: string; subvalue: string; accent: 'blue' | 'green' | 'purple' | 'red' }) {
  const colors = {
    blue: 'border-accent-primary/40 bg-bg-hover/30',
    green: 'border-success/30 bg-success/5',
    purple: 'border-accent-primary/30 bg-accent-primary/5',
    red: 'border-danger/30 bg-danger/5',
  };
  const textColors = {
    blue: 'text-accent-primary/80',
    green: 'text-success',
    purple: 'text-accent-primary',
    red: 'text-danger ',
  };
  return (
    <div className={`rounded-xl border shadow-sm p-4 ${colors[accent]}`}>
      <div className="text-xs font-semibold text-text-muted uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${textColors[accent]}`}>{value}</div>
      <div className="text-xs text-text-muted mt-0.5">{subvalue}</div>
    </div>
  );
}
