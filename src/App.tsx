import { useState, useCallback, useRef, useEffect, useMemo, useDeferredValue, lazy, Suspense } from 'react';
import { HowItWorks } from './components/HowItWorks';
import { InputPanel } from './components/InputPanel';
import { ScenarioEditor } from './components/ScenarioEditor';
import { VerdictBanner } from './components/VerdictBanner';
import { ComparisonChart } from './components/ComparisonChart';
import { TimelineChart } from './components/TimelineChart';
import { BreakevenChart } from './components/BreakevenChart';
import { MethodologyPanel } from './components/MethodologyPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAssetData } from './hooks/useAssetData';
import { useFxData } from './hooks/useFxData';
import { useInflationData } from './hooks/useInflationData';
import { useHistoricalVolatility } from './hooks/useHistoricalVolatility';
import { useKantorRates } from './hooks/useKantorRates';
import { useSellAnalysis } from './hooks/useSellAnalysis';
import { KantorSidebar } from './components/KantorSidebar';
import {
  calcAllScenarios,
  calcTimeline,
  calcHeatmap,
} from './utils/calculations';
import { blendedInflationRate, blendedSavingsRate } from './utils/inflationProjection';
import { DEFAULT_HORIZON_MONTHS } from './utils/assetConfig';
import { loadState, saveState } from './utils/persistedState';
import type { Scenarios, ScenarioKey, BenchmarkType, BondSettings } from './types/scenario';

const SellAnalysisPanel = lazy(() => import('./components/SellAnalysisPanel').then(m => ({ default: m.SellAnalysisPanel })));

const DEFAULT_SCENARIOS: Scenarios = {
  bear: { deltaStock: -10, deltaFx: -5 },
  base: { deltaStock: 0, deltaFx: 0 },
  bull: { deltaStock: 10, deltaFx: 5 },
};

const DEFAULT_BOND_SETTINGS: BondSettings = {
  firstYearRate: 2.00,
  penalty: 0,
  rateType: 'fixed',
  margin: 0,
  couponFrequency: 0,
};

const ROOT_STYLE = { backgroundColor: 'var(--color-bg-primary)' } as const;
const FOOTER_STYLE = { borderTop: '1px solid var(--color-border)', color: 'var(--color-text-faint)' } as const;

function App() {
  // Load persisted state once on mount (synchronous — runs before first render)
  const saved = loadState();

  const [ticker, setTicker] = useState(saved?.ticker ?? '');
  const [shares, setShares] = useState(saved?.shares ?? 0);
  const [currentPriceUSD, setCurrentPriceUSD] = useState(0);
  const [currentFxRate, setCurrentFxRate] = useState(0);
  const [wibor3m, setWibor3m] = useState(saved?.wibor3m ?? 0);
  const [benchmarkType, setBenchmarkType] = useState<BenchmarkType>(saved?.benchmarkType ?? 'savings');
  const [bondSettings, setBondSettings] = useState<BondSettings>(saved?.bondSettings ?? DEFAULT_BOND_SETTINGS);
  const [bondPresetId, setBondPresetId] = useState(saved?.bondPresetId ?? 'OTS');
  const [inflationRate, setInflationRate] = useState(0);
  const [nbpRefRate, setNbpRefRate] = useState(saved?.nbpRefRate ?? 0);
  const [horizonMonths, setHorizonMonths] = useState(saved?.horizonMonths ?? DEFAULT_HORIZON_MONTHS);
  const [avgCostUSD, setAvgCostUSD] = useState(saved?.avgCostUSD ?? 0);
  // null = use HMM suggestions when available; non-null = user has manually overridden
  const [userScenarios, setUserScenarios] = useState<Scenarios | null>(saved?.userScenarios ?? null);
  const [scenarioEditKey, setScenarioEditKey] = useState(0);
  const fxAutoFilled = useRef(false);
  const aliorAutoFilled = useRef(false);
  const inflationAutoFilled = useRef(false);

  const { assetData, proxyFxData, isLoading: assetLoading, error: assetError, fetchData: fetchAsset } = useAssetData();
  const { fxData, isLoading: fxLoading } = useFxData();
  const { data: inflationData, isLoading: inflationLoading } = useInflationData();
  const { suggestedScenarios, stats: volatilityStats } = useHistoricalVolatility(
    assetData?.historicalPrices ?? null,
    proxyFxData?.historicalRates ?? fxData?.historicalRates ?? null,
    horizonMonths,
  );
  const kantorRates = useKantorRates();

  // Primary FX source: Alior Kantor buy rate (actual conversion rate)
  useEffect(() => {
    if (kantorRates.alior && !aliorAutoFilled.current) {
      aliorAutoFilled.current = true;
      fxAutoFilled.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from async data source
      setCurrentFxRate(kantorRates.alior.buy);
    }
  }, [kantorRates.alior]);

  // Secondary FX source: NBP rate (fallback if Alior Kantor not yet available)
  useEffect(() => {
    if (fxData?.currentRate && !fxAutoFilled.current) {
      fxAutoFilled.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from async data source
      setCurrentFxRate(fxData.currentRate);
    }
  }, [fxData?.currentRate]);

  // Auto-fill inflation from ECB/NBP data
  useEffect(() => {
    if (inflationData?.currentRate && !inflationAutoFilled.current) {
      inflationAutoFilled.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from async data source
      setInflationRate(inflationData.currentRate);
    }
  }, [inflationData?.currentRate]);

  // Auto-save user inputs to localStorage (debounced 600ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      saveState({ ticker, shares, wibor3m, nbpRefRate, bondSettings, bondPresetId, horizonMonths, benchmarkType, userScenarios, avgCostUSD });
    }, 600);
    return () => clearTimeout(timer);
  }, [ticker, shares, wibor3m, nbpRefRate, bondSettings, bondPresetId, horizonMonths, benchmarkType, userScenarios, avgCostUSD]);

  const fetchData = useCallback(async (tickerArg: string) => {
    // Reset scenarios so HMM suggestions auto-apply for the new ticker
    setUserScenarios(null);
    setScenarioEditKey((k) => k + 1);

    const data = await fetchAsset(tickerArg);
    if (data?.asset.currentPrice) {
      setCurrentPriceUSD(data.asset.currentPrice);
    }
  }, [fetchAsset]);

  const handleScenarioChange = useCallback(
    (key: ScenarioKey, field: 'deltaStock' | 'deltaFx', value: number) => {
      setUserScenarios((prev) => {
        const base = prev ?? suggestedScenarios ?? DEFAULT_SCENARIOS;
        return { ...base, [key]: { ...base[key], [field]: value } };
      });
    },
    [suggestedScenarios],
  );

  const handleBenchmarkTypeChange = useCallback((v: BenchmarkType) => {
    setBenchmarkType(v);
    if (v === 'savings') {
      setHorizonMonths((prev) => Math.min(prev, 60));
    }
  }, []);

  const handleApplySuggested = useCallback(() => {
    if (suggestedScenarios) {
      setUserScenarios(suggestedScenarios);
      setScenarioEditKey((k) => k + 1);
    }
  }, [suggestedScenarios]);

  const handleApplyModelScenarios = useCallback((s: Scenarios) => {
    setUserScenarios(s);
    // No key increment — preserve ScenarioEditor local state (mode, activeModelId)
  }, []);

  // Derive active scenarios: user overrides take precedence over HMM suggestions
  const scenarios = userScenarios ?? suggestedScenarios ?? DEFAULT_SCENARIOS;

  // Auto-fill FX rate from proxy response when a new ticker is fetched
  useEffect(() => {
    if (proxyFxData?.currentRate && !fxAutoFilled.current) {
      fxAutoFilled.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from async data source
      setCurrentFxRate(proxyFxData.currentRate);
    }
  }, [proxyFxData]);

  // Auto-apply HMM suggestions when they arrive and user hasn't manually edited.
  // Clears when fetchData sets userScenarios to null for a new ticker.
  useEffect(() => {
    if (suggestedScenarios && userScenarios === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- remount ScenarioEditor for new suggestions
      setScenarioEditKey((k) => k + 1);
    }
  }, [suggestedScenarios, userScenarios]);

  // Defer horizonMonths for expensive calculations so slider stays smooth
  const deferredHorizon = useDeferredValue(horizonMonths);

  // Blended inflation rate: mean-reversion from current rate toward NBP target (2.5%)
  const effectiveInflation = useMemo(
    () => inflationRate > 0 ? blendedInflationRate(inflationRate, deferredHorizon) : 0,
    [inflationRate, deferredHorizon],
  );

  // Blended savings rate: mean-reversion toward long-run equilibrium (~3.0%)
  // Savings account rates track the NBP reference rate, which cycles over time.
  const effectiveSavingsRate = useMemo(
    () => wibor3m > 0 ? blendedSavingsRate(wibor3m, deferredHorizon) : 0,
    [wibor3m, deferredHorizon],
  );

  // Compute effective bond rate based on type + external data.
  // Inflation-linked bonds use the blended projected rate (not the raw current reading)
  // to stay consistent with how real returns are calculated.
  const computedEffectiveRate = bondSettings.rateType === 'fixed'
    ? bondSettings.firstYearRate
    : bondSettings.rateType === 'reference'
      ? nbpRefRate + bondSettings.margin
      : effectiveInflation + bondSettings.margin;

  const calcInputs = useMemo(() => ({
    shares,
    currentPriceUSD,
    currentFxRate,
    nbpMidRate: fxData?.currentRate ?? currentFxRate,
    wibor3mPercent: benchmarkType === 'savings' ? effectiveSavingsRate : wibor3m,
    horizonMonths: deferredHorizon,
    benchmarkType,
    bondFirstYearRate: bondSettings.firstYearRate,
    bondEffectiveRate: computedEffectiveRate,
    bondPenaltyPercent: bondSettings.penalty,
    bondCouponFrequency: bondSettings.couponFrequency,
    bondReinvestmentRate: effectiveSavingsRate,
    inflationRate: effectiveInflation,
    avgCostUSD,
  }), [shares, currentPriceUSD, currentFxRate, fxData, wibor3m, deferredHorizon, benchmarkType, bondSettings, computedEffectiveRate, effectiveInflation, effectiveSavingsRate, avgCostUSD]);

  const benchmarkReady = benchmarkType === 'savings' ? wibor3m > 0 : bondSettings.firstYearRate > 0;
  const canCalc = shares > 0 && currentPriceUSD > 0 && currentFxRate > 0 && horizonMonths > 0 && benchmarkReady;

  const results = useMemo(() => canCalc ? calcAllScenarios(calcInputs, scenarios) : null, [canCalc, calcInputs, scenarios]);
  const timeline = useMemo(() => canCalc ? calcTimeline(calcInputs, scenarios) : null, [canCalc, calcInputs, scenarios]);
  const heatmap = useMemo(() => canCalc ? calcHeatmap(calcInputs) : null, [canCalc, calcInputs]);

  // Sell analysis
  type ActiveView = 'comparison' | 'sellAnalysis';
  const [activeView, setActiveView] = useState<ActiveView>('comparison');
  const [sellHorizonDays, setSellHorizonDays] = useState(63);
  const { analysis: sellAnalysis, isLoading: sellAnalysisLoading } = useSellAnalysis(
    assetData?.historicalPrices ?? null,
    currentPriceUSD,
    sellHorizonDays,
    activeView === 'sellAnalysis',
  );

  // InputPanel collapse — user-initiated only (no auto-collapse)
  const [inputCollapsed, setInputCollapsed] = useState(false);

  return (
    <div className="min-h-screen" style={ROOT_STYLE}>
      <header className="bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-5 flex items-center gap-3">
          {/* Viking drakkar inline icon */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="36" height="36" aria-hidden="true">
            <rect x="30.5" y="10" width="2.5" height="22" rx="1" fill="#e2e8f0"/>
            <path d="M33 11 L46 20 L33 30 Z" fill="#3b82f6"/>
            <path d="M33 11 L39.5 15.5 L39.5 25.5 L33 30 Z" fill="#60a5fa"/>
            <path d="M10 34 Q18 30 33 30 Q48 30 52 34 Q48 43 33 45 Q18 43 10 34 Z" fill="#1d4ed8"/>
            <path d="M10 34 Q18 32 33 32 Q48 32 52 34" fill="none" stroke="#60a5fa" stroke-width="1.2"/>
            <path d="M52 34 L60 28 L58 33 L62 31 L58 37 L54 38 Z" fill="#3b82f6"/>
            <circle cx="60" cy="28" r="1.2" fill="#fbbf24"/>
            <path d="M10 34 C8 32 6 34 8 37 C9 39 11 38 10 36" fill="#3b82f6"/>
            <line x1="18" y1="39" x2="16" y2="48" stroke="#93c5fd" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="26" y1="41" x2="24" y2="50" stroke="#93c5fd" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="38" y1="41" x2="40" y2="50" stroke="#93c5fd" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="46" y1="39" x2="48" y2="48" stroke="#93c5fd" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M8 52 Q18 49 28 52 Q38 55 48 52 Q54 50 58 52" stroke="#60a5fa" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.7"/>
          </svg>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Njord</h1>
            <p className="text-sm text-slate-400">Kalkulator: akcje vs. konto oszczędnościowe / obligacje skarbowe</p>
          </div>
        </div>
      </header>

      <div className="flex justify-center">
        {/* Kantor rates sticky sidebar — xl+ only */}
        <aside className="hidden xl:block shrink-0 pt-6 pl-4">
          <div className="sticky top-4">
            <KantorSidebar rates={kantorRates} />
          </div>
        </aside>

      <main className="flex-1 min-w-0 max-w-7xl mx-auto px-4 py-4 space-y-4">
        {inputCollapsed ? (
          /* ── Collapsed layout: summary bar → ScenarioEditor (full-width) → Results ── */
          <>
            <InputPanel
              onFetchAsset={fetchData}
              assetData={assetData}
              assetLoading={assetLoading}
              assetError={assetError}
              fxData={fxData}
              fxLoading={fxLoading}
              ticker={ticker}
              shares={shares}
              currentPriceUSD={currentPriceUSD}
              currentFxRate={currentFxRate}
              wibor3m={wibor3m}
              effectiveSavingsRate={effectiveSavingsRate}
              horizonMonths={horizonMonths}
              benchmarkType={benchmarkType}
              bondSettings={bondSettings}
              bondEffectiveRate={computedEffectiveRate}
              inflationRate={inflationRate}
              inflationData={inflationData}
              inflationLoading={inflationLoading}
              nbpRefRate={nbpRefRate}
              avgCostUSD={avgCostUSD}
              initialBondPresetId={bondPresetId}
              collapsed
              onToggleCollapse={() => setInputCollapsed(false)}
              onTickerChange={setTicker}
              onSharesChange={setShares}
              onPriceChange={setCurrentPriceUSD}
              onFxRateChange={setCurrentFxRate}
              onWiborChange={setWibor3m}
              onHorizonChange={setHorizonMonths}
              onBenchmarkTypeChange={handleBenchmarkTypeChange}
              onBondSettingsChange={setBondSettings}
              onBondPresetChange={setBondPresetId}
              onAvgCostUSDChange={setAvgCostUSD}
              onInflationRateChange={setInflationRate}
              onNbpRefRateChange={setNbpRefRate}
            />
            <ScenarioEditor
              key={scenarioEditKey}
              scenarios={scenarios}
              onChange={handleScenarioChange}
              suggestedScenarios={suggestedScenarios}
              onApplySuggested={handleApplySuggested}
              onApplyModelScenarios={handleApplyModelScenarios}
              currentPriceUSD={currentPriceUSD}
              currentFxRate={currentFxRate}
              volatilityStats={volatilityStats}
              compact
            />
          </>
        ) : (
          /* ── Expanded layout: 2-column grid ── */
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <InputPanel
                onFetchAsset={fetchData}
                assetData={assetData}
                assetLoading={assetLoading}
                assetError={assetError}
                fxData={fxData}
                fxLoading={fxLoading}
                ticker={ticker}
                shares={shares}
                currentPriceUSD={currentPriceUSD}
                currentFxRate={currentFxRate}
                wibor3m={wibor3m}
                effectiveSavingsRate={effectiveSavingsRate}
                horizonMonths={horizonMonths}
                benchmarkType={benchmarkType}
                bondSettings={bondSettings}
                bondEffectiveRate={computedEffectiveRate}
                inflationRate={inflationRate}
                inflationData={inflationData}
                inflationLoading={inflationLoading}
                nbpRefRate={nbpRefRate}
                avgCostUSD={avgCostUSD}
                initialBondPresetId={bondPresetId}
                onToggleCollapse={results ? () => setInputCollapsed(true) : undefined}
                onTickerChange={setTicker}
                onSharesChange={setShares}
                onPriceChange={setCurrentPriceUSD}
                onFxRateChange={setCurrentFxRate}
                onWiborChange={setWibor3m}
                onHorizonChange={setHorizonMonths}
                onBenchmarkTypeChange={handleBenchmarkTypeChange}
                onBondSettingsChange={setBondSettings}
                onBondPresetChange={setBondPresetId}
                onAvgCostUSDChange={setAvgCostUSD}
                onInflationRateChange={setInflationRate}
                onNbpRefRateChange={setNbpRefRate}
              />
              <ScenarioEditor
                key={scenarioEditKey}
                scenarios={scenarios}
                onChange={handleScenarioChange}
                suggestedScenarios={suggestedScenarios}
                onApplySuggested={handleApplySuggested}
                onApplyModelScenarios={handleApplyModelScenarios}
                currentPriceUSD={currentPriceUSD}
                currentFxRate={currentFxRate}
                volatilityStats={volatilityStats}
              />
            </div>

            {!canCalc && (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-400 space-y-2">
                <p className="text-lg">Uzupełnij dane wejściowe, aby zobaczyć wyniki</p>
                <p className="text-sm">Wpisz ticker, liczbę akcji i oprocentowanie {benchmarkType === 'bonds' ? 'obligacji' : 'konta oszczędnościowego'}.</p>
              </div>
            )}
          </>
        )}

        {/* View toggle — only show when stock data is loaded */}
        {currentPriceUSD > 0 && assetData && (
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 w-fit">
            <button
              onClick={() => setActiveView('comparison')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeView === 'comparison'
                  ? 'bg-white text-blue-700 shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Porównanie z benchmarkiem
            </button>
            <button
              onClick={() => setActiveView('sellAnalysis')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeView === 'sellAnalysis'
                  ? 'bg-white text-blue-700 shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Optymalna cena sprzedaży
            </button>
          </div>
        )}

        {activeView === 'comparison' && results && (
          <>
            <ErrorBoundary>
              <VerdictBanner
                results={results}
                inflationRate={effectiveInflation}
                currentInflationRate={inflationRate}
                inflationSource={inflationData?.source}
                cpiPeriod={inflationData?.period}
                inflationStale={inflationData?.isStale}
                horizonMonths={horizonMonths}
                avgCostUSD={avgCostUSD || undefined}
              />
            </ErrorBoundary>
            <ErrorBoundary>
              <ComparisonChart results={results} />
            </ErrorBoundary>
            {timeline && (
              <ErrorBoundary>
                <TimelineChart
                  data={timeline}
                  currentValuePLN={results[0]?.currentValuePLN ?? 0}
                  benchmarkLabel={results[0]?.benchmarkLabel ?? 'Konto'}
                  inflationRate={effectiveInflation}
                />
              </ErrorBoundary>
            )}
            {heatmap && (
              <ErrorBoundary>
                <BreakevenChart
                  cells={heatmap}
                  benchmarkEndValuePLN={results[0]?.benchmarkEndValuePLN ?? 0}
                  benchmarkLabel={results[0]?.benchmarkLabel ?? 'Konto'}
                />
              </ErrorBoundary>
            )}
          </>
        )}

        {activeView === 'sellAnalysis' && (
          <ErrorBoundary>
            <Suspense fallback={<div className="text-center py-8 text-gray-400">Ładowanie modułu…</div>}>
              <SellAnalysisPanel
                analysis={sellAnalysis}
                isLoading={sellAnalysisLoading}
                horizonDays={sellHorizonDays}
                onHorizonChange={setSellHorizonDays}
                currentFxRate={currentFxRate}
              />
            </Suspense>
          </ErrorBoundary>
        )}

        <MethodologyPanel />
        <HowItWorks />
      </main>
      </div>

      <footer className="mt-10 py-5 text-center text-xs" style={FOOTER_STYLE}>
        Njord — wyłącznie do celów edukacyjnych. Nie stanowi doradztwa inwestycyjnego.
      </footer>
    </div>
  );
}

export default App;
