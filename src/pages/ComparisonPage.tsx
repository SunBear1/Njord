import { useState, useCallback, useEffect, useMemo, useDeferredValue, lazy, Suspense } from 'react';
import { ArrowRightLeft, ChevronDown, ChevronUp, Settings2, Sparkles, Trash2 } from 'lucide-react';
import { InputModal } from '../components/InputModal';
import { ScenarioEditor } from '../components/ScenarioEditor';
import { VerdictBanner } from '../components/VerdictBanner';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Skeleton } from '../components/Skeleton';
import { ComparisonDecisionMarkers } from '../components/comparison/ComparisonDecisionMarkers';
import { ComparisonDecisionSummary } from '../components/comparison/ComparisonDecisionSummary';
import { useAssetData } from '../hooks/useAssetData';
import { useEtfData } from '../hooks/useEtfData';
import { useInflationData } from '../hooks/useInflationData';
import { useHistoricalVolatility } from '../hooks/useHistoricalVolatility';
import { useCurrencyRates } from '../hooks/useCurrencyRates';
import { useDarkMode } from '../hooks/useDarkMode';
import { useBondPresets } from '../hooks/useBondPresets';
import { usePortfolioState } from '../hooks/usePortfolioState';
import { calcAllScenarios, calcTimeline } from '../utils/calculations';
import { getDecisionSummary } from '../utils/comparisonDecision';
import { blendedInflationRate, blendedSavingsRate } from '../utils/inflationProjection';

const TimelineChartLazy = lazy(() => import('../components/TimelineChart'));
const ComparisonChartLazy = lazy(() => import('../components/ComparisonChart'));

const DEFAULT_SCENARIOS = {
  bear: { deltaStock: -10, deltaFx: -5 },
  base: { deltaStock: 0, deltaFx: 0 },
  bull: { deltaStock: 10, deltaFx: 5 },
};

export function ComparisonPage() {
  const [isDark] = useDarkMode();
  const { assetData, proxyFxData, isLoading: assetLoading, error: assetError, fetchData: fetchAsset, resetData: resetAssetData } = useAssetData();
  const { etfData, etfAnnualizedReturn, isLoading: etfLoading, error: etfError, fetchEtf, resetEtf } = useEtfData();
  const { presets: bondPresets, isLoading: bondPresetsLoading } = useBondPresets();
  const { data: inflationData, isLoading: inflationLoading } = useInflationData();
  const currencyRates = useCurrencyRates();

  const portfolio = usePortfolioState({
    aliorBuyRate: currencyRates.alior?.buy ?? null,
    proxyFxRate: proxyFxData?.currentRate ?? null,
    inflationCurrentRate: inflationData?.currentRate ?? null,
    etfAnnualizedReturn: etfAnnualizedReturn,
  });
  const {
    savedAt,
    ticker,
    setTicker,
    shares,
    setShares,
    currentPriceUSD,
    setCurrentPriceUSD,
    currentFxRate,
    setCurrentFxRate,
    wibor3m,
    setWibor3m,
    benchmarkType,
    horizonMonths,
    setHorizonMonths,
    userScenarios,
    scenarioEditKey,
    setScenarioEditKey,
    inflationRate,
    setInflationRate,
    etfAnnualReturnPercent,
    setEtfAnnualReturnPercent,
    etfTerPercent,
    setEtfTerPercent,
    etfTicker,
    setEtfTicker,
    avgCostUSD,
    setAvgCostUSD,
    isRSU,
    setIsRSU,
    brokerFeeUSD,
    setBrokerFeeUSD,
    dividendYieldPercent,
    setDividendYieldPercent,
    nbpRefRate,
    setNbpRefRate,
    bondSettings,
    setBondSettings,
    bondPresetId,
    setBondPresetId,
    resetForNewTicker,
    resetEtfAutofill,
    resetComparisonState,
    handleBenchmarkTypeChange,
    handleApplySuggested,
    handleApplyModelScenarios,
    handleScenarioChange,
  } = portfolio;

  const { suggestedScenarios, stats: volatilityStats } = useHistoricalVolatility(
    assetData?.historicalPrices ?? null,
    proxyFxData?.historicalRates ?? null,
    horizonMonths,
  );

  const fetchData = useCallback(async (tickerArg: string) => {
    resetForNewTicker();
    const data = await fetchAsset(tickerArg);
    if (data?.asset.currentPrice) {
      setCurrentPriceUSD(data.asset.currentPrice);
    }
  }, [fetchAsset, resetForNewTicker, setCurrentPriceUSD]);

  const handleFetchEtf = useCallback(async (tickerArg: string) => {
    resetEtfAutofill();
    await fetchEtf(tickerArg);
  }, [fetchEtf, resetEtfAutofill]);

  const [isInputOpen, setIsInputOpen] = useState(false);
  const [showDeepAnalysis, setShowDeepAnalysis] = useState(false);

  const handleClearData = useCallback(() => {
    const shouldClear = window.confirm('Wyczyścić zapisane dane porównania i zacząć od nowa?');
    if (!shouldClear) return;

    resetComparisonState();
    resetAssetData();
    resetEtf();
    setIsInputOpen(false);
    setShowDeepAnalysis(false);
  }, [resetComparisonState, resetAssetData, resetEtf]);

  const scenarios = userScenarios ?? suggestedScenarios ?? DEFAULT_SCENARIOS;
  const isModelApplied = userScenarios === null && suggestedScenarios !== null;

  const onApplySuggested = useCallback(
    () => handleApplySuggested(suggestedScenarios),
    [handleApplySuggested, suggestedScenarios],
  );

  useEffect(() => {
    if (suggestedScenarios && userScenarios === null) {
      setScenarioEditKey((key) => key + 1);
    }
  }, [suggestedScenarios, userScenarios, setScenarioEditKey]);

  const deferredHorizon = useDeferredValue(horizonMonths);

  const effectiveInflation = useMemo(
    () => (inflationRate > 0 ? blendedInflationRate(inflationRate, deferredHorizon) : 0),
    [inflationRate, deferredHorizon],
  );

  const effectiveSavingsRate = useMemo(
    () => (wibor3m > 0 ? blendedSavingsRate(wibor3m, deferredHorizon) : 0),
    [wibor3m, deferredHorizon],
  );

  const computedEffectiveRate = bondSettings.rateType === 'fixed'
    ? bondSettings.firstYearRate
    : bondSettings.rateType === 'reference'
      ? nbpRefRate + bondSettings.margin
      : effectiveInflation + bondSettings.margin;

  const proxyFxRate = proxyFxData?.currentRate ?? currentFxRate;

  const calcInputs = useMemo(() => ({
    shares,
    currentPriceUSD,
    currentFxRate,
    nbpMidRate: proxyFxRate,
    wibor3mPercent: benchmarkType === 'savings' ? effectiveSavingsRate : wibor3m,
    horizonMonths: deferredHorizon,
    benchmarkType,
    bondFirstYearRate: bondSettings.firstYearRate,
    bondEffectiveRate: computedEffectiveRate,
    bondPenaltyPercent: bondSettings.penalty,
    bondCouponFrequency: bondSettings.couponFrequency,
    bondMaturityMonths: bondSettings.maturityMonths,
    bondReinvestmentRate: effectiveSavingsRate,
    inflationRate: effectiveInflation,
    avgCostUSD,
    isRSU,
    brokerFeeUSD,
    dividendYieldPercent,
    etfAnnualReturnPercent,
    etfTerPercent,
  }), [
    shares,
    currentPriceUSD,
    currentFxRate,
    proxyFxRate,
    wibor3m,
    deferredHorizon,
    benchmarkType,
    bondSettings,
    computedEffectiveRate,
    effectiveInflation,
    effectiveSavingsRate,
    avgCostUSD,
    isRSU,
    brokerFeeUSD,
    dividendYieldPercent,
    etfAnnualReturnPercent,
    etfTerPercent,
  ]);

  const benchmarkReady = benchmarkType === 'savings'
    ? wibor3m > 0
    : benchmarkType === 'etf'
      ? true
      : bondSettings.firstYearRate > 0;
  const canCalc = shares > 0 && currentPriceUSD > 0 && currentFxRate > 0 && horizonMonths > 0 && benchmarkReady;

  const results = useMemo(() => (canCalc ? calcAllScenarios(calcInputs, scenarios) : null), [canCalc, calcInputs, scenarios]);
  const timeline = useMemo(() => (canCalc ? calcTimeline(calcInputs, scenarios) : null), [canCalc, calcInputs, scenarios]);

  const deferredResults = useDeferredValue(results);
  const deferredTimeline = useDeferredValue(timeline);

  const horizonLabel = horizonMonths <= 11
    ? `${horizonMonths} mies.`
    : horizonMonths % 12 === 0
      ? `${horizonMonths / 12} ${horizonMonths / 12 === 1 ? 'rok' : horizonMonths / 12 < 5 ? 'lata' : 'lat'}`
      : `${Math.floor(horizonMonths / 12)}l. ${horizonMonths % 12}m.`;
  const benchmarkLabel = benchmarkType === 'savings'
    ? `Konto ${wibor3m > 0 ? `${wibor3m.toFixed(1)}%` : '—'}`
    : benchmarkType === 'etf'
      ? etfTicker ? `ETF ${etfTicker}` : 'ETF'
      : `Obligacje ${bondSettings.firstYearRate.toFixed(1)}%`;
  const hasData = ticker && shares > 0 && currentPriceUSD > 0;
  const canClearData = useMemo(() => (
    Boolean(ticker)
    || shares > 0
    || currentPriceUSD > 0
    || currentFxRate > 0
    || wibor3m > 0
    || inflationRate > 0
    || nbpRefRate > 0
    || benchmarkType !== 'savings'
    || bondPresetId !== 'OTS'
    || avgCostUSD > 0
    || isRSU
    || brokerFeeUSD > 0
    || dividendYieldPercent > 0
    || etfAnnualReturnPercent !== 8
    || etfTerPercent !== 0.07
    || etfTicker !== 'IWDA.L'
    || userScenarios !== null
  ), [
    ticker,
    shares,
    currentPriceUSD,
    currentFxRate,
    wibor3m,
    inflationRate,
    nbpRefRate,
    benchmarkType,
    bondPresetId,
    avgCostUSD,
    isRSU,
    brokerFeeUSD,
    dividendYieldPercent,
    etfAnnualReturnPercent,
    etfTerPercent,
    etfTicker,
    userScenarios,
  ]);
  const decisionSummary = useMemo(
    () => (deferredResults ? getDecisionSummary(deferredResults) : null),
    [deferredResults],
  );

  const inputPanelProps = {
    onFetchAsset: fetchData,
    assetData,
    assetLoading,
    assetError,
    nbpMidRate: proxyFxData?.currentRate ?? 0,
    ticker,
    shares,
    currentPriceUSD,
    currentFxRate,
    wibor3m,
    effectiveSavingsRate,
    horizonMonths,
    benchmarkType,
    bondSettings,
    bondEffectiveRate: computedEffectiveRate,
    inflationRate,
    inflationData,
    inflationLoading,
    nbpRefRate,
    avgCostUSD,
    isRSU,
    brokerFeeUSD,
    dividendYieldPercent,
    etfAnnualReturnPercent,
    etfTerPercent,
    etfTicker,
    etfLoading,
    etfError,
    etfName: etfData?.asset.name ?? null,
    initialBondPresetId: bondPresetId,
    bondPresets,
    bondPresetsLoading,
    onTickerChange: setTicker,
    onSharesChange: setShares,
    onPriceChange: setCurrentPriceUSD,
    onFxRateChange: setCurrentFxRate,
    onWiborChange: setWibor3m,
    onHorizonChange: setHorizonMonths,
    onBenchmarkTypeChange: handleBenchmarkTypeChange,
    onBondSettingsChange: setBondSettings,
    onBondPresetChange: setBondPresetId,
    onAvgCostUSDChange: setAvgCostUSD,
    onIsRSUChange: setIsRSU,
    onBrokerFeeUSDChange: setBrokerFeeUSD,
    onDividendYieldChange: setDividendYieldPercent,
    onEtfAnnualReturnChange: setEtfAnnualReturnPercent,
    onEtfTerChange: setEtfTerPercent,
    onEtfTickerChange: setEtfTicker,
    onFetchEtf: handleFetchEtf,
    onInflationRateChange: setInflationRate,
    onNbpRefRateChange: setNbpRefRate,
  };

  const scenarioEditorProps = {
    key: scenarioEditKey,
    scenarios,
    onChange: handleScenarioChange,
    suggestedScenarios,
    onApplySuggested,
    onApplyModelScenarios: handleApplyModelScenarios,
    currentPriceUSD,
    currentFxRate,
    volatilityStats,
    isModelApplied,
  };

  return (
    <div className="space-y-6">
      <section className="bg-bg-card rounded-xl border border-border shadow-sm p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-3xl space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent-primary/30 bg-accent-primary/5 px-3 py-1 text-xs font-semibold text-accent-primary">
              <ArrowRightLeft size={14} aria-hidden="true" />
              Decyzja sprzedaży
            </span>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-text-primary">Sprzedać czy trzymać akcje?</h1>
              <p className="text-sm text-text-secondary">
                Porównaj sprzedaż akcji z reinwestycją w konto, obligacje lub ETF. Najpierw pokażemy
                rekomendację, potem markery prowadzące do decyzji, a pełną analizę otworzysz dopiero
                wtedy, gdy będzie potrzebna.
              </p>
            </div>
            {decisionSummary && (
              <div className="rounded-xl border border-success/30 bg-success/5 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-success">Aktualny werdykt</p>
                <p className="text-base font-semibold text-text-primary">{decisionSummary.actionTitle}</p>
                <p className="text-sm text-text-secondary">
                  {decisionSummary.winnerLabel} {decisionSummary.winnerVerb} w scenariuszu bazowym.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearData}
              disabled={!canClearData}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
            >
              <Trash2 size={16} aria-hidden="true" />
              Wyczyść dane
            </button>
            <button
              type="button"
              onClick={() => setIsInputOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-accent-interactive px-4 py-2.5 text-sm font-medium text-text-on-accent hover:bg-accent-interactive/90 transition-colors"
            >
              <Settings2 size={16} aria-hidden="true" />
              {hasData ? 'Edytuj dane wejściowe' : 'Ustaw dane wejściowe'}
            </button>
          </div>
        </div>

        {hasData ? (
          <button
            type="button"
            onClick={() => setIsInputOpen(true)}
            className="w-full flex items-center justify-between gap-3 rounded-xl border border-border bg-bg-muted/40 px-4 py-3 text-left hover:bg-bg-hover transition-colors"
          >
            <div className="flex items-center gap-2 flex-wrap min-w-0 text-sm text-text-secondary">
              <span className="font-semibold text-text-primary">{ticker}</span>
              <span className="text-text-muted">·</span>
              <span>{shares} akcji</span>
              <span className="text-text-muted">·</span>
              <span>${currentPriceUSD.toFixed(2)}</span>
              <span className="text-text-muted">·</span>
              <span>{benchmarkLabel}</span>
              <span className="text-text-muted">·</span>
              <span className="text-accent-primary font-medium">{horizonLabel}</span>
            </div>
            <span className="flex items-center gap-1.5 text-xs font-medium text-text-primary whitespace-nowrap shrink-0">
              {hasData ? 'Edytuj' : 'Dane wejściowe'}
              <Settings2 size={14} aria-hidden="true" />
            </span>
          </button>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              '1. Wybierz akcję i wielkość pozycji.',
              '2. Wskaż, w co reinwestujesz środki po sprzedaży.',
              '3. Odbierz werdykt i markery prowadzące do decyzji.',
            ].map((step) => (
              <div key={step} className="rounded-xl border border-border bg-bg-muted/40 px-4 py-3 text-sm text-text-secondary">
                {step}
              </div>
            ))}
          </div>
        )}
      </section>

      <InputModal
        isOpen={isInputOpen}
        onClose={() => setIsInputOpen(false)}
        savedAt={savedAt}
        {...inputPanelProps}
      />

      {!canCalc && !isInputOpen && (
        <section className="bg-bg-card rounded-xl border border-dashed border-border p-10 text-center text-text-muted space-y-4">
          <Sparkles size={32} className="mx-auto text-accent-primary/40" aria-hidden="true" />
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-text-primary">Najpierw ustaw pozycję i alternatywę reinwestycji</h2>
            <p className="text-sm">
              Podaj akcję, liczbę udziałów i to, z czym chcesz porównać sprzedaż. Gdy dane będą gotowe,
              strona pokaże najpierw rekomendację, a nie cały stos analiz naraz.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsInputOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-accent-primary/30 bg-accent-primary/5 px-4 py-2.5 text-sm font-medium text-accent-primary hover:bg-accent-primary/10 transition-colors"
          >
            <Settings2 size={16} aria-hidden="true" />
            Skonfiguruj pozycję
          </button>
        </section>
      )}

      {deferredResults && (
        <ComparisonDecisionSummary
          results={deferredResults}
          horizonLabel={horizonLabel}
        />
      )}

      {deferredResults && (
        <ComparisonDecisionMarkers
          results={deferredResults}
          avgCostUSD={avgCostUSD || undefined}
        />
      )}

      {deferredResults && (
        <section className="bg-bg-card rounded-xl border border-border shadow-sm p-5 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-text-primary">Pełna analiza i założenia</h2>
              <p className="text-sm text-text-secondary">
                Rozwiń ten blok, jeśli chcesz zobaczyć pełny werdykt scenariuszowy, wykresy i ręcznie
                zmienić założenia modelu.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDeepAnalysis((open) => !open)}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-hover transition-colors"
              aria-expanded={showDeepAnalysis}
            >
              {showDeepAnalysis ? 'Ukryj pełną analizę' : 'Pokaż pełną analizę'}
              {showDeepAnalysis ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
            </button>
          </div>

          {showDeepAnalysis ? (
            <div className="space-y-4 border-t border-border pt-4">
              <ErrorBoundary>
                <VerdictBanner
                  results={deferredResults}
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
                <Suspense fallback={<Skeleton.Chart height={260} />}>
                  <ComparisonChartLazy results={deferredResults} isDark={isDark} />
                </Suspense>
              </ErrorBoundary>

              {deferredTimeline && (
                <ErrorBoundary>
                  <Suspense fallback={<Skeleton.Chart height={220} />}>
                    <TimelineChartLazy
                      data={deferredTimeline}
                      currentValuePLN={deferredResults[0]?.currentValuePLN ?? 0}
                      benchmarkLabel={deferredResults[0]?.benchmarkLabel ?? 'Konto'}
                      inflationRate={effectiveInflation}
                      isDark={isDark}
                    />
                  </Suspense>
                </ErrorBoundary>
              )}

              <ScenarioEditor {...scenarioEditorProps} />
            </div>
          ) : (
            <p className="rounded-xl border border-border bg-bg-muted/40 px-4 py-3 text-sm text-text-secondary">
              Tutaj znajdziesz pełny werdykt bazowy, analizę wrażliwości, wykres końcowej wartości,
              timeline oraz ręczną edycję scenariuszy.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

export default ComparisonPage;
