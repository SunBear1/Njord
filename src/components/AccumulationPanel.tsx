import { useState, useMemo, useCallback, useEffect, lazy, Suspense } from 'react';
import {
  Sprout,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Landmark,
  BookOpen,
  Search,
  Loader2,
  Shield,
  PiggyBank,
  ArrowRight,
} from 'lucide-react';
import { calcAccumulationResult } from '../utils/accumulationCalculator';
import { fmtPLN } from '../utils/formatting';
import { Tooltip } from './Tooltip';
import type {
  AccumulationInputs,
  AccumulationResult,
  BucketConfig,
  PitBracket,
  InstrumentType,
  AllocationPreset,
} from '../types/accumulation';
import {
  IKE_LIMIT_2026,
  IKZE_LIMIT_2026,
  ALLOCATION_PRESETS,
} from '../types/accumulation';
import type { BondPreset } from '../types/scenario';
import type { InflationData } from '../hooks/useInflationData';
import { useTickerReturn } from '../hooks/useTickerReturn';

const AccumulationChart = lazy(() => import('./AccumulationChart'));

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'njord_accumulation';

interface PersistedState {
  version: 1;
  totalMonthlyPLN: number;
  horizonYears: number;
  pitBracket: PitBracket;
  presetId: string;
  ikeInstrument: InstrumentType;
  ikzeInstrument: InstrumentType;
  regularInstrument: InstrumentType;
  ikeEnabled: boolean;
  ikzeEnabled: boolean;
  stockReturnPercent: number;
  dividendYieldPercent: number;
  fxSpreadPercent: number;
  bondPresetId: string;
  ikeAnnualLimit: number;
  ikzeAnnualLimit: number;
}

function loadPersistedState(): Partial<PersistedState> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    if (parsed?.version === 1) return parsed;
  } catch { /* ignore */ }
  return {};
}

function savePersistedState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_STOCK_RETURN = 8.0;
const DEFAULT_DIVIDEND_YIELD = 1.5;
const DEFAULT_FX_SPREAD = 0.35;
const DEFAULT_BOND_PRESET_ID = 'EDO';
const DEFAULT_SAVINGS_RATE = 5.0;

function makeBucketConfig(
  wrapper: 'ike' | 'ikze' | 'regular',
  instrument: InstrumentType,
  enabled: boolean,
  stockReturn: number,
  divYield: number,
  fxSpread: number,
  bondPreset: BondPreset | undefined,
  inflationRate: number,
  nbpRefRate: number,
): BucketConfig {
  const effectiveRate = bondPreset
    ? bondPreset.rateType === 'fixed'
      ? bondPreset.firstYearRate
      : bondPreset.rateType === 'reference'
        ? nbpRefRate + bondPreset.margin
        : inflationRate + bondPreset.margin
    : 0;

  return {
    wrapper,
    instrument,
    enabled,
    stockReturnPercent: stockReturn,
    dividendYieldPercent: divYield,
    fxSpreadPercent: fxSpread,
    bondPresetId: bondPreset?.id ?? DEFAULT_BOND_PRESET_ID,
    bondFirstYearRate: bondPreset?.firstYearRate ?? 6.2,
    bondEffectiveRate: effectiveRate,
    bondRateType: bondPreset?.rateType ?? 'inflation',
    bondMargin: bondPreset?.margin ?? 2.0,
    bondCouponFrequency: bondPreset?.couponFrequency ?? 0,
  };
}

// ─── Component Props ──────────────────────────────────────────────────────────

export interface AccumulationPanelProps {
  bondPresets: BondPreset[];
  inflationData: InflationData | null;
  inflationLoading: boolean;
  isDark?: boolean;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AccumulationPanel({
  bondPresets,
  inflationData,
  inflationLoading,
  isDark,
}: AccumulationPanelProps) {
  const persisted = useMemo(() => loadPersistedState(), []);

  // Global inputs
  const [totalMonthlyPLN, setTotalMonthlyPLN] = useState(persisted.totalMonthlyPLN ?? 2000);
  const [horizonYears, setHorizonYears] = useState(persisted.horizonYears ?? 20);
  const [pitBracket, setPitBracket] = useState<PitBracket>(persisted.pitBracket ?? 12);
  const [presetId, setPresetId] = useState(persisted.presetId ?? 'balanced');
  const [ikeAnnualLimit, setIkeAnnualLimit] = useState(persisted.ikeAnnualLimit ?? IKE_LIMIT_2026);
  const [ikzeAnnualLimit, setIkzeAnnualLimit] = useState(persisted.ikzeAnnualLimit ?? IKZE_LIMIT_2026);

  // Per-bucket instrument
  const [ikeInstrument, setIkeInstrument] = useState<InstrumentType>(persisted.ikeInstrument ?? 'stocks');
  const [ikzeInstrument, setIkzeInstrument] = useState<InstrumentType>(persisted.ikzeInstrument ?? 'bonds');
  const [regularInstrument, setRegularInstrument] = useState<InstrumentType>(persisted.regularInstrument ?? 'stocks');
  const [ikeEnabled, setIkeEnabled] = useState(persisted.ikeEnabled ?? true);
  const [ikzeEnabled, setIkzeEnabled] = useState(persisted.ikzeEnabled ?? true);

  // Shared stock/bond params
  const [stockReturnPercent, setStockReturnPercent] = useState(persisted.stockReturnPercent ?? DEFAULT_STOCK_RETURN);
  const [dividendYieldPercent, setDividendYieldPercent] = useState(persisted.dividendYieldPercent ?? DEFAULT_DIVIDEND_YIELD);
  const [fxSpreadPercent, setFxSpreadPercent] = useState(persisted.fxSpreadPercent ?? DEFAULT_FX_SPREAD);
  const [bondPresetId, setBondPresetId] = useState(persisted.bondPresetId ?? DEFAULT_BOND_PRESET_ID);

  // Ticker return auto-suggest
  const { suggestedReturn, tickerName, isLoading: tickerLoading, error: tickerError, fetchReturn } = useTickerReturn();
  const [tickerInput, setTickerInput] = useState('');

  // Inflation rate
  const inflationRate = inflationData?.currentRate ?? 3.0;
  const nbpRefRate = 5.75; // Default NBP reference rate

  // Methodology accordion
  const [showMethodology, setShowMethodology] = useState(false);

  // Persist state
  useEffect(() => {
    savePersistedState({
      version: 1,
      totalMonthlyPLN,
      horizonYears,
      pitBracket,
      presetId,
      ikeInstrument,
      ikzeInstrument,
      regularInstrument,
      ikeEnabled,
      ikzeEnabled,
      stockReturnPercent,
      dividendYieldPercent,
      fxSpreadPercent,
      bondPresetId,
      ikeAnnualLimit,
      ikzeAnnualLimit,
    });
  }, [totalMonthlyPLN, horizonYears, pitBracket, presetId, ikeInstrument, ikzeInstrument, regularInstrument, ikeEnabled, ikzeEnabled, stockReturnPercent, dividendYieldPercent, fxSpreadPercent, bondPresetId, ikeAnnualLimit, ikzeAnnualLimit]);

  // Apply preset
  const applyPreset = useCallback((preset: AllocationPreset) => {
    setPresetId(preset.id);
    const [ike, ikze, regular] = preset.buckets;
    setIkeEnabled(ike.enabled);
    setIkeInstrument(ike.instrument);
    setIkzeEnabled(ikze.enabled);
    setIkzeInstrument(ikze.instrument);
    setRegularInstrument(regular.instrument);
  }, []);

  // Bond preset lookup
  const selectedBondPreset = useMemo(
    () => bondPresets.find(p => p.id === bondPresetId) ?? bondPresets[0],
    [bondPresets, bondPresetId],
  );

  // Build inputs
  const inputs = useMemo((): AccumulationInputs => ({
    totalMonthlyPLN,
    horizonYears,
    pitBracket,
    inflationRate,
    ikeAnnualLimit,
    ikzeAnnualLimit,
    savingsRate: DEFAULT_SAVINGS_RATE,
    buckets: [
      makeBucketConfig('ike', ikeInstrument, ikeEnabled, stockReturnPercent, dividendYieldPercent, fxSpreadPercent, selectedBondPreset, inflationRate, nbpRefRate),
      makeBucketConfig('ikze', ikzeInstrument, ikzeEnabled, stockReturnPercent, dividendYieldPercent, fxSpreadPercent, selectedBondPreset, inflationRate, nbpRefRate),
      makeBucketConfig('regular', regularInstrument, true, stockReturnPercent, dividendYieldPercent, fxSpreadPercent, selectedBondPreset, inflationRate, nbpRefRate),
    ],
  }), [totalMonthlyPLN, horizonYears, pitBracket, inflationRate, ikeAnnualLimit, ikzeAnnualLimit, ikeInstrument, ikzeInstrument, regularInstrument, ikeEnabled, ikzeEnabled, stockReturnPercent, dividendYieldPercent, fxSpreadPercent, selectedBondPreset, nbpRefRate]);

  // Compute result
  const result: AccumulationResult | null = useMemo(
    () => totalMonthlyPLN > 0 && horizonYears > 0 ? calcAccumulationResult(inputs) : null,
    [inputs, totalMonthlyPLN, horizonYears],
  );

  // Allocation bar values
  const allocationBar = useMemo(() => {
    if (!result) return null;
    return result.buckets.map(b => ({
      wrapper: b.wrapper,
      monthly: b.monthlyPLN,
      enabled: b.enabled,
    }));
  }, [result]);

  const handleTickerSearch = useCallback(() => {
    if (tickerInput.trim()) {
      fetchReturn(tickerInput.trim());
    }
  }, [tickerInput, fetchReturn]);

  const applySuggestedReturn = useCallback(() => {
    if (suggestedReturn !== null) {
      setStockReturnPercent(suggestedReturn);
    }
  }, [suggestedReturn]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sprout size={20} className="text-green-600 dark:text-green-400" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Kalkulator akumulacji</h2>
        <Tooltip content="Symulacja systematycznego inwestowania — porównaj rachunek maklerski, IKE i IKZE z uwzględnieniem podatków i inflacji.">
          <span className="text-gray-400 dark:text-gray-500 cursor-help text-sm">ⓘ</span>
        </Tooltip>
      </div>

      {/* Input Panel */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 space-y-5">

        {/* Row 1: Monthly amount + Horizon */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="acc-monthly" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Miesięczna wpłata (PLN)
            </label>
            <input
              id="acc-monthly"
              type="number"
              min={100}
              max={50000}
              step={100}
              value={totalMonthlyPLN}
              onChange={e => setTotalMonthlyPLN(Math.max(0, Number(e.target.value)))}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="acc-horizon" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Horyzont: {horizonYears} lat
            </label>
            <input
              id="acc-horizon"
              type="range"
              min={5}
              max={40}
              step={1}
              value={horizonYears}
              onChange={e => setHorizonYears(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1">
              <span>5 lat</span><span>20 lat</span><span>40 lat</span>
            </div>
          </div>
        </div>

        {/* Row 2: Preset + PIT bracket */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="acc-preset" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Strategia alokacji
            </label>
            <select
              id="acc-preset"
              value={presetId}
              onChange={e => {
                const preset = ALLOCATION_PRESETS.find(p => p.id === e.target.value);
                if (preset) applyPreset(preset);
              }}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ALLOCATION_PRESETS.map(p => (
                <option key={p.id} value={p.id}>{p.name} — {p.description}</option>
              ))}
            </select>
          </div>
          <div>
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Próg PIT (dla odliczenia IKZE)
            </span>
            <div className="flex gap-3" role="radiogroup" aria-label="Próg PIT">
              {([12, 32] as PitBracket[]).map(bracket => (
                <label key={bracket} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="pit-bracket"
                    value={bracket}
                    checked={pitBracket === bracket}
                    onChange={() => setPitBracket(bracket)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{bracket}%</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Wpływa na wartość odliczenia IKZE od PIT
            </p>
          </div>
        </div>

        {/* Row 3: Bucket cards */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Alokacja po kontach</h3>

          {/* Allocation bar */}
          {allocationBar && totalMonthlyPLN > 0 && (
            <div className="flex h-6 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 text-xs font-medium">
              {allocationBar.filter(b => b.enabled && b.monthly > 0).map(b => {
                const pct = (b.monthly / totalMonthlyPLN) * 100;
                const bg = b.wrapper === 'ike' ? 'bg-green-500' : b.wrapper === 'ikze' ? 'bg-violet-500' : 'bg-blue-500';
                return (
                  <div
                    key={b.wrapper}
                    className={`${bg} text-white flex items-center justify-center transition-all`}
                    style={{ width: `${pct}%` }}
                    title={`${b.wrapper.toUpperCase()}: ${Math.round(b.monthly)} PLN/mies.`}
                  >
                    {pct > 15 ? `${b.wrapper.toUpperCase()}: ${Math.round(b.monthly)}` : ''}
                  </div>
                );
              })}
            </div>
          )}

          {/* Bucket cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* IKE */}
            <BucketCard
              wrapper="ike"
              label="IKE"
              icon={<Shield size={14} />}
              color="green"
              enabled={ikeEnabled}
              onEnabledChange={setIkeEnabled}
              instrument={ikeInstrument}
              onInstrumentChange={setIkeInstrument}
              annualLimit={ikeAnnualLimit}
              onLimitChange={setIkeAnnualLimit}
              taxBenefit="0% podatku po 60. roku życia"
              bondPresets={bondPresets}
              bondPresetId={bondPresetId}
              onBondPresetChange={setBondPresetId}
            />

            {/* IKZE */}
            <BucketCard
              wrapper="ikze"
              label="IKZE"
              icon={<PiggyBank size={14} />}
              color="violet"
              enabled={ikzeEnabled}
              onEnabledChange={setIkzeEnabled}
              instrument={ikzeInstrument}
              onInstrumentChange={setIkzeInstrument}
              annualLimit={ikzeAnnualLimit}
              onLimitChange={setIkzeAnnualLimit}
              taxBenefit={`Odliczenie ${pitBracket}% od PIT · 10% ryczałt`}
              bondPresets={bondPresets}
              bondPresetId={bondPresetId}
              onBondPresetChange={setBondPresetId}
            />

            {/* Regular */}
            <BucketCard
              wrapper="regular"
              label="Rachunek maklerski"
              icon={<Landmark size={14} />}
              color="blue"
              enabled={true}
              instrument={regularInstrument}
              onInstrumentChange={setRegularInstrument}
              taxBenefit="19% Belka od zysków i dywidend"
              isRegular
              bondPresets={bondPresets}
              bondPresetId={bondPresetId}
              onBondPresetChange={setBondPresetId}
            />
          </div>
        </div>

        {/* Row 4: Shared stock/bond parameters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="acc-return" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Oczekiwana stopa zwrotu (% rocznie)
            </label>
            <div className="flex gap-2">
              <input
                id="acc-return"
                type="number"
                min={0}
                max={30}
                step={0.1}
                value={stockReturnPercent}
                onChange={e => setStockReturnPercent(Number(e.target.value))}
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {/* Ticker-based return suggestion */}
            <div className="flex gap-1 mt-1.5">
              <input
                type="text"
                placeholder="Ticker (np. SPY)…"
                value={tickerInput}
                onChange={e => setTickerInput(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleTickerSearch()}
                className="flex-1 rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-2 py-1 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400"
                aria-label="Ticker do kalibracji zwrotu"
              />
              <button
                type="button"
                onClick={handleTickerSearch}
                disabled={tickerLoading || !tickerInput.trim()}
                className="px-2 py-1 rounded border border-gray-200 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
                aria-label="Szukaj tickera"
              >
                {tickerLoading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
              </button>
            </div>
            {suggestedReturn !== null && tickerName && (
              <button
                type="button"
                onClick={applySuggestedReturn}
                className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Zastosuj {suggestedReturn}% z {tickerName}
              </button>
            )}
            {tickerError && <p className="text-xs text-red-500 mt-1">{tickerError}</p>}
          </div>
          <div>
            <label htmlFor="acc-div" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Dywidenda (% rocznie)
            </label>
            <input
              id="acc-div"
              type="number"
              min={0}
              max={15}
              step={0.1}
              value={dividendYieldPercent}
              onChange={e => setDividendYieldPercent(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="acc-fx" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Spread kantorowy (%)
            </label>
            <input
              id="acc-fx"
              type="number"
              min={0}
              max={3}
              step={0.05}
              value={fxSpreadPercent}
              onChange={e => setFxSpreadPercent(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Koszt przewalutowania PLN→USD</p>
          </div>
        </div>

        {/* Inflation display */}
        {inflationData && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Inflacja CPI (Polska): <strong>{inflationRate.toFixed(1)}%</strong>
            {inflationData.period ? ` (${inflationData.period})` : ''}
            {inflationLoading ? ' · odświeżam…' : ''}
          </p>
        )}
      </div>

      {/* Results */}
      {result && result.totalContributed > 0 ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Card 1: Total Portfolio */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300">
                <TrendingUp size={14} className="text-blue-600 dark:text-blue-400" aria-hidden="true" />
                Łączny portfel
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-50 tabular-nums">
                {fmtPLN(result.totalTerminalNet)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                <div>Wpłacono łącznie: {fmtPLN(result.totalContributed)}</div>
                <div>
                  Zysk netto: <span className="text-green-600 dark:text-green-400 font-medium">
                    {fmtPLN(result.totalTerminalNet - result.totalContributed)}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Tax Savings */}
            <div className="bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-900 shadow-sm p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-green-700 dark:text-green-300">
                <Shield size={14} aria-hidden="true" />
                Oszczędność podatkowa
              </div>
              <div className="text-2xl font-bold text-green-800 dark:text-green-200 tabular-nums">
                {result.taxSavings > 0 ? '+' : ''}{fmtPLN(result.taxSavings)}
              </div>
              <div className="text-xs text-green-600 dark:text-green-400 space-y-0.5">
                <div>
                  vs. wszystko na rachunku maklerskim
                  {result.taxSavingsPercent > 0 && (
                    <span className="font-semibold"> (+{result.taxSavingsPercent.toFixed(1)}%)</span>
                  )}
                </div>
                {result.ikzePitDeductionValue > 0 && (
                  <div>w tym odliczenie IKZE: {fmtPLN(result.ikzePitDeductionValue)}</div>
                )}
              </div>
            </div>

            {/* Card 3: Per-Bucket Breakdown */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 space-y-2">
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">Rozkład po kontach</div>
              <div className="space-y-1.5">
                {result.buckets.filter(b => b.enabled && b.terminalNetValue > 0).map(b => (
                  <div key={b.wrapper} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${
                        b.wrapper === 'ike' ? 'bg-green-500' : b.wrapper === 'ikze' ? 'bg-violet-500' : 'bg-blue-500'
                      }`} />
                      <span className="text-gray-600 dark:text-gray-400">{b.wrapper.toUpperCase()}</span>
                      <span className="text-gray-400 dark:text-gray-500">({b.instrument === 'stocks' ? 'akcje' : 'obligacje'})</span>
                    </div>
                    <span className="font-mono font-medium text-gray-800 dark:text-gray-200 tabular-nums">
                      {fmtPLN(b.terminalNetValue)}
                    </span>
                  </div>
                ))}
              </div>
              {result.totalTaxPaid > 0 && (
                <div className="text-xs text-gray-400 dark:text-gray-500 pt-1 border-t border-gray-100 dark:border-gray-700">
                  Podatek łącznie: {fmtPLN(result.totalTaxPaid)}
                </div>
              )}
            </div>
          </div>

          {/* Chart */}
          <Suspense fallback={<div className="h-[420px] bg-gray-50 dark:bg-gray-900 rounded-xl animate-pulse motion-reduce:animate-none" />}>
            <AccumulationChart
              data={result.combinedSnapshots}
              milestones={result.milestones}
              isDark={isDark}
            />
          </Suspense>

          {/* Counterfactual comparison */}
          {result.taxSavings > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-200">
              <p className="font-medium">
                💡 Korzystając z IKE i IKZE zamiast zwykłego rachunku maklerskiego, po {horizonYears} latach masz
                o <strong>{fmtPLN(result.taxSavings)}</strong> więcej
                ({result.taxSavingsPercent > 0 ? `+${result.taxSavingsPercent.toFixed(1)}%` : ''}).
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Rachunek maklerski: {fmtPLN(result.counterfactualNet)} <ArrowRight size={10} className="inline" /> IKE + IKZE + maklerski: {fmtPLN(result.totalTerminalNet)}
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-400 dark:text-gray-500">
          <Sprout size={32} className="mx-auto mb-2 opacity-50" aria-hidden="true" />
          <p>Ustaw miesięczną wpłatę i horyzont, aby zobaczyć projekcję</p>
        </div>
      )}

      {/* Methodology */}
      <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowMethodology(o => !o)}
          className="w-full flex items-center justify-between px-5 py-3 text-gray-800 dark:text-gray-100 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <span className="flex items-center gap-2">
            <BookOpen size={16} aria-hidden="true" />
            Metodologia i zasady IKE/IKZE
          </span>
          {showMethodology ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
        </button>

        {showMethodology && (
          <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-100 space-y-4">
            <section>
              <h4 className="font-semibold">IKE — Indywidualne Konto Emerytalne</h4>
              <ul className="list-disc list-inside text-xs text-gray-600 dark:text-gray-400 space-y-1 mt-1">
                <li>Roczny limit wpłat: 3× przeciętne wynagrodzenie ({fmtPLN(ikeAnnualLimit)} w 2026)</li>
                <li>Wypłata po 60. roku życia (przy wpłatach w 5+ latach): <strong>0% podatku</strong> od zysków</li>
                <li>Wcześniejsza wypłata: standardowe 19% Belki od zysków</li>
                <li>Można inwestować w: akcje, obligacje, ETF, fundusze, lokaty</li>
              </ul>
            </section>

            <section>
              <h4 className="font-semibold">IKZE — Indywidualne Konto Zabezpieczenia Emerytalnego</h4>
              <ul className="list-disc list-inside text-xs text-gray-600 dark:text-gray-400 space-y-1 mt-1">
                <li>Roczny limit wpłat: 1.2× przeciętne wynagrodzenie ({fmtPLN(ikzeAnnualLimit)} w 2026)</li>
                <li>Wpłaty odliczane od PIT ({pitBracket}% — oszczędzasz {fmtPLN(ikzeAnnualLimit * pitBracket / 100)} rocznie)</li>
                <li>Wypłata po 65. roku życia: <strong>10% ryczałt</strong> od całej kwoty</li>
                <li>Wcześniejsza wypłata: opodatkowana na skali PIT (12% lub 32%)</li>
              </ul>
            </section>

            <section>
              <h4 className="font-semibold">Rachunek maklerski (standardowy)</h4>
              <ul className="list-disc list-inside text-xs text-gray-600 dark:text-gray-400 space-y-1 mt-1">
                <li>Brak limitów wpłat</li>
                <li>19% Belka od zysków kapitałowych i dywidend</li>
                <li>Straty rozliczane w PIT-38 (5 lat, max 50%/rok)</li>
              </ul>
            </section>

            <section>
              <h4 className="font-semibold">Założenia symulacji</h4>
              <ul className="list-disc list-inside text-xs text-gray-600 dark:text-gray-400 space-y-1 mt-1">
                <li>Stała stopa zwrotu (brak zmienności rocznej)</li>
                <li>Stały spread kantorowy na każdej wpłacie (akcje/ETF)</li>
                <li>Obligacje: złożone odsetki w cyklu miesięcznym</li>
                <li>Dywidendy reinwestowane (po podatku w rachunku maklerskim)</li>
                <li>Odliczenie PIT z IKZE reinwestowane na koncie oszczędnościowym</li>
                <li>Inflacja: bieżąca stawka CPI z ECB ({inflationRate.toFixed(1)}%)</li>
              </ul>
            </section>

            <p className="text-xs text-gray-400 dark:text-gray-500 italic">
              ⚠️ To jest projekcja, nie prognoza. Rzeczywiste wyniki mogą się znacząco różnić.
              Stopy zwrotu, inflacja i kursy walut są nieprzewidywalne.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Bucket Card Sub-Component ────────────────────────────────────────────────

interface BucketCardProps {
  wrapper: 'ike' | 'ikze' | 'regular';
  label: string;
  icon: React.ReactNode;
  color: 'green' | 'violet' | 'blue';
  enabled: boolean;
  onEnabledChange?: (v: boolean) => void;
  instrument: InstrumentType;
  onInstrumentChange: (v: InstrumentType) => void;
  annualLimit?: number;
  onLimitChange?: (v: number) => void;
  taxBenefit: string;
  isRegular?: boolean;
  bondPresets: BondPreset[];
  bondPresetId: string;
  onBondPresetChange: (id: string) => void;
}

const COLOR_MAP = {
  green: {
    border: 'border-green-200 dark:border-green-900',
    bg: 'bg-green-50/50 dark:bg-green-950/20',
    badge: 'text-green-700 dark:text-green-300',
  },
  violet: {
    border: 'border-violet-200 dark:border-violet-900',
    bg: 'bg-violet-50/50 dark:bg-violet-950/20',
    badge: 'text-violet-700 dark:text-violet-300',
  },
  blue: {
    border: 'border-blue-200 dark:border-blue-900',
    bg: 'bg-blue-50/50 dark:bg-blue-950/20',
    badge: 'text-blue-700 dark:text-blue-300',
  },
} as const;

function BucketCard({
  wrapper,
  label,
  icon,
  color,
  enabled,
  onEnabledChange,
  instrument,
  onInstrumentChange,
  annualLimit,
  onLimitChange,
  taxBenefit,
  isRegular,
  bondPresets,
  bondPresetId,
  onBondPresetChange,
}: BucketCardProps) {
  const c = COLOR_MAP[color];

  return (
    <div className={`rounded-lg border ${c.border} ${enabled ? c.bg : 'bg-gray-50 dark:bg-gray-900 opacity-60'} p-3 space-y-2 transition-opacity`}>
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-1.5 text-sm font-semibold ${c.badge}`}>
          {icon}
          {label}
        </div>
        {!isRegular && onEnabledChange && (
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => onEnabledChange(e.target.checked)}
              className="accent-blue-600 rounded"
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">aktywne</span>
          </label>
        )}
      </div>

      {enabled && (
        <>
          <p className="text-xs text-gray-500 dark:text-gray-400">{taxBenefit}</p>

          {/* Instrument selector */}
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs" role="group" aria-label={`Instrument ${wrapper}`}>
            <button
              type="button"
              onClick={() => onInstrumentChange('stocks')}
              className={`flex-1 px-2 py-1 transition-colors ${instrument === 'stocks' ? 'bg-gray-100 dark:bg-gray-700 font-semibold text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}
              aria-pressed={instrument === 'stocks'}
            >
              Akcje/ETF
            </button>
            <button
              type="button"
              onClick={() => onInstrumentChange('bonds')}
              className={`flex-1 px-2 py-1 transition-colors ${instrument === 'bonds' ? 'bg-gray-100 dark:bg-gray-700 font-semibold text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}
              aria-pressed={instrument === 'bonds'}
            >
              Obligacje
            </button>
          </div>

          {/* Bond preset selector */}
          {instrument === 'bonds' && bondPresets.length > 0 && (
            <select
              value={bondPresetId}
              onChange={e => onBondPresetChange(e.target.value)}
              className="w-full rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400"
              aria-label={`Obligacja ${wrapper}`}
            >
              {bondPresets.filter(p => !p.isFamily).map(p => (
                <option key={p.id} value={p.id}>{p.id} — {p.name} ({p.firstYearRate}%)</option>
              ))}
            </select>
          )}

          {/* Annual limit (IKE/IKZE only) */}
          {annualLimit !== undefined && onLimitChange && (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-gray-500 dark:text-gray-400">Limit roczny:</span>
              <input
                type="number"
                value={annualLimit}
                onChange={e => onLimitChange(Math.max(0, Number(e.target.value)))}
                className="w-20 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-1.5 py-0.5 text-xs font-mono text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400"
                aria-label={`Limit roczny ${wrapper}`}
              />
              <span className="text-gray-400 dark:text-gray-500">PLN</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
