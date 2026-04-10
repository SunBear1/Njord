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
}

const HORIZON_PRESETS = [
  { days: 21, label: '1 mies.' },
  { days: 63, label: '1 kwartał' },
  { days: 126, label: '6 mies.' },
  { days: 252, label: '1 rok' },
] as const;

const MONTH_NAMES = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'] as const;

/** Approximate trading days from today to end of a given month/year. */
function tradingDaysUntil(year: number, month: number): number {
  const now = new Date();
  const target = new Date(year, month, 0); // last day of month (month is 1-indexed here)
  const diffMs = target.getTime() - now.getTime();
  const calendarDays = Math.max(1, Math.ceil(diffMs / 86_400_000));
  return Math.round(calendarDays * (252 / 365));
}

/** Generate next N months as selectable deadline options. */
function getMonthOptions(count: number): { label: string; year: number; month: number }[] {
  const now = new Date();
  const options: { label: string; year: number; month: number }[] = [];
  for (let i = 1; i <= count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const m = d.getMonth();     // 0-based
    const y = d.getFullYear();
    options.push({ label: `${MONTH_NAMES[m]} '${String(y).slice(2)}`, year: y, month: m + 1 });
  }
  return options;
}

export function SellAnalysisPanel({ analysis, isLoading, horizonDays, onHorizonChange, currentFxRate }: SellAnalysisPanelProps) {
  const [showTable, setShowTable] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const monthOptions = useMemo(() => getMonthOptions(6), []);

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
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Target size={20} className="text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Optymalna cena sprzedaży</h2>
        </div>

        {/* Unified horizon: duration presets | deadline months */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            {HORIZON_PRESETS.map((p) => (
              <button
                key={p.days}
                onClick={() => { onHorizonChange(p.days); setSelectedMonth(null); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  horizonDays === p.days && !selectedMonth
                    ? 'bg-white text-blue-700 shadow-sm border border-gray-200'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-gray-300 mx-1 hidden sm:block" aria-hidden="true" />

          <div className="flex items-center gap-1">
            <Calendar size={13} className="text-gray-400 shrink-0" />
            <div className="flex gap-1 flex-wrap">
              {monthOptions.map((mo) => {
                const key = `${mo.year}-${mo.month}`;
                const isActive = selectedMonth === key;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setSelectedMonth(key);
                      onHorizonChange(tradingDaysUntil(mo.year, mo.month));
                    }}
                    className={`px-2 py-1.5 text-[11px] font-medium rounded-md transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {mo.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Active horizon info */}
        <div className="mt-2 text-[11px] text-gray-400">
          ~{horizonDays} sesji giełdowych ({(horizonDays / 21).toFixed(1)} mies.)
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 mt-4 text-sm text-gray-500">
            <Loader2 size={16} className="animate-spin" />
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
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Reżim rynkowy</div>
              <div className={`text-lg font-bold ${analysis.regimeInfo.currentRegimeLabel === 'bull' ? 'text-green-700' : 'text-red-700'}`}>
                {analysis.regimeInfo.currentRegimeLabel === 'bull' ? '📈 Faza wzrostowa' : '📉 Faza spadkowa'}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Pewność: {Math.round(analysis.regimeInfo.posteriorProbability * 100)}%
                {' · ~'}{analysis.regimeInfo.expectedDurations[analysis.regimeInfo.currentState].toFixed(0)} sesji
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Mediana szczytowej ceny</div>
              <div className="text-lg font-bold text-gray-900">{fmtUSD(analysis.peakDistribution.p50)}</div>
              <div className="text-xs text-gray-500 mt-1">
                Zakres: {fmtUSD(analysis.peakDistribution.p10)} – {fmtUSD(analysis.peakDistribution.p90)}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Szczyt (dzień)</div>
              <div className="text-lg font-bold text-gray-900 flex items-center gap-1.5">
                <Calendar size={16} className="text-gray-400" />
                dzień {analysis.peakTimingDistribution.p50.toFixed(0)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Zakres: dzień {analysis.peakTimingDistribution.p10.toFixed(0)} – {analysis.peakTimingDistribution.p90.toFixed(0)}
              </div>
            </div>
          </div>

          {/* Fan Chart */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
            <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-500" />
              Wachlarz cenowy (10 000 symulacji)
            </h3>
            <p className="text-xs text-gray-500">
              Pasma pokazują zakres cen: ciemniejsze = bardziej prawdopodobne (p25–p75), jaśniejsze = ogon rozkładu (p10–p90).
              Linia niebieska przerywana = optymalna cena sprzedaży.
            </p>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={fanChartBands} margin={{ top: 10, right: 10, bottom: 24, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="day"
                  tickFormatter={(v) => `${v}d`}
                  tick={{ fontSize: 11 }}
                  label={{ value: 'Dzień handlowy', position: 'insideBottomRight', offset: 0, fontSize: 11, fill: '#9ca3af' }}
                />
                <YAxis
                  tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                  tick={{ fontSize: 11 }}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload as Record<string, number> | undefined;
                    if (!d) return null;
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-2 text-xs">
                        <div className="font-semibold mb-1">Dzień {label}</div>
                        <div className="text-gray-600">p90: {fmtUSD(d.p90)}</div>
                        <div className="text-gray-600">p75: {fmtUSD(d.p75)}</div>
                        <div className="text-blue-600 font-medium">p50: {fmtUSD(d.p50)}</div>
                        <div className="text-gray-600">p25: {fmtUSD(d.p25)}</div>
                        <div className="text-gray-600">p10: {fmtUSD(d.p10)}</div>
                      </div>
                    );
                  }}
                  labelFormatter={(v) => `Dzień ${v}`}
                />
                {/* Invisible base layer to offset stacking to p10 level */}
                <Area type="monotone" dataKey="base" stackId="fan" stroke="none" fill="transparent" name="base" />
                {/* p10–p25 band (lightest) */}
                <Area type="monotone" dataKey="band_p10_p25" stackId="fan" stroke="none" fill="#dbeafe" fillOpacity={0.6} name="band_p10_p25" />
                {/* p25–p50 band */}
                <Area type="monotone" dataKey="band_p25_p50" stackId="fan" stroke="none" fill="#93c5fd" fillOpacity={0.6} name="band_p25_p50" />
                {/* p50–p75 band */}
                <Area type="monotone" dataKey="band_p50_p75" stackId="fan" stroke="none" fill="#93c5fd" fillOpacity={0.6} name="band_p50_p75" />
                {/* p75–p90 band (lightest) */}
                <Area type="monotone" dataKey="band_p75_p90" stackId="fan" stroke="none" fill="#dbeafe" fillOpacity={0.6} name="band_p75_p90" />
                {/* Median line (non-stacked overlay) */}
                <Area type="monotone" dataKey="p50" stroke="#2563eb" strokeWidth={2} fill="none" name="Mediana" />
                {/* Reference lines */}
                <ReferenceLine y={analysis.currentPrice} stroke="#6b7280" strokeDasharray="4 4" label={{ value: `Dziś: ${fmtUSD(analysis.currentPrice)}`, position: 'right', fontSize: 10, fill: '#6b7280' }} />
                <ReferenceLine y={analysis.optimalTarget.target} stroke="#2563eb" strokeDasharray="6 3" strokeWidth={2} label={{ value: `Cel: ${fmtUSD(analysis.optimalTarget.target)}`, position: 'right', fontSize: 10, fill: '#2563eb' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Touch Probability Curve */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
            <h3 className="text-base font-semibold text-gray-800">Prawdopodobieństwo osiągnięcia ceny</h3>
            <p className="text-xs text-gray-500">
              Stromy spadek krzywej = „granica chciwości" — powyżej tego progu szansa realizacji gwałtownie maleje.
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={touchCurveData} margin={{ top: 10, right: 10, bottom: 24, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="target"
                  tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                  tick={{ fontSize: 11 }}
                  label={{ value: 'Cena docelowa (USD)', position: 'insideBottomRight', offset: 0, fontSize: 11, fill: '#9ca3af' }}
                />
                <YAxis
                  tickFormatter={(v: number) => `${v}%`}
                  tick={{ fontSize: 11 }}
                  domain={[0, 100]}
                />
                <Tooltip
                  formatter={(v: ValueType | undefined) => [`${Number(v ?? 0).toFixed(1)}%`, 'P(osiągnięcia)']}
                  labelFormatter={(v) => `Cel: ${fmtUSD(Number(v))}`}
                />
                <Line type="monotone" dataKey="pTouch" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} name="P(touch)" />
                <ReferenceLine x={analysis.optimalTarget.target} stroke="#16a34a" strokeDasharray="6 3" label={{ value: 'Optymalny', position: 'top', fontSize: 10, fill: '#16a34a' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Summary Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-800">Tabela celów sprzedaży</h3>
              <button
                onClick={() => setShowTable((v) => !v)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                {showTable ? 'Zwiń' : 'Rozwiń'}
              </button>
            </div>
            {showTable && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
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
                      return (
                        <tr
                          key={sp.target}
                          className={`border-b border-gray-100 ${isOptimal ? 'bg-blue-50 font-semibold' : ''}`}
                        >
                          <td className="py-2 pr-4">
                            {fmtUSD(sp.target)}
                            {isOptimal && <span className="ml-1.5 text-[10px] text-blue-600 font-bold">★ OPTYMALNY</span>}
                          </td>
                          <td className={`py-2 pr-4 ${changePct >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                            {changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%
                          </td>
                          <td className="py-2 pr-4">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${sp.pTouch > 0.5 ? 'bg-green-500' : sp.pTouch > 0.2 ? 'bg-amber-500' : 'bg-red-500'}`}
                                  style={{ width: `${sp.pTouch * 100}%` }}
                                />
                              </div>
                              <span>{(sp.pTouch * 100).toFixed(0)}%</span>
                            </div>
                          </td>
                          <td className="py-2 pr-4">{fmtUSD(sp.expectedValue)}</td>
                          <td className="py-2 text-gray-600">{(sp.expectedValue * currentFxRate).toFixed(0)} zł</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Disclaimer */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 space-y-1">
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
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-gray-400">
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
    blue: 'border-blue-200 bg-blue-50/50',
    green: 'border-green-200 bg-green-50/50',
    purple: 'border-purple-200 bg-purple-50/50',
    red: 'border-red-200 bg-red-50/50',
  };
  const textColors = {
    blue: 'text-blue-700',
    green: 'text-green-700',
    purple: 'text-purple-700',
    red: 'text-red-700',
  };
  return (
    <div className={`rounded-xl border shadow-sm p-4 ${colors[accent]}`}>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${textColors[accent]}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{subvalue}</div>
    </div>
  );
}
