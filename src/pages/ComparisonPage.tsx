import { useState, useCallback, useEffect, useMemo, useDeferredValue, lazy, Suspense } from 'react';
import { InputPanel } from '../components/InputPanel';
import { ScenarioEditor } from '../components/ScenarioEditor';
import { VerdictBanner } from '../components/VerdictBanner';
import ComparisonChart from '../components/ComparisonChart';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Skeleton } from '../components/Skeleton';
import { useAssetData } from '../hooks/useAssetData';
import { useEtfData } from '../hooks/useEtfData';
import { useInflationData } from '../hooks/useInflationData';
import { useHistoricalVolatility } from '../hooks/useHistoricalVolatility';
import { useCurrencyRates } from '../hooks/useCurrencyRates';
import { useDarkMode } from '../hooks/useDarkMode';
import { useBondPresets } from '../hooks/useBondPresets';
import { usePortfolioState } from '../hooks/usePortfolioState';
import {
  calcAllScenarios,
  calcTimeline,
  calcHeatmap,
} from '../utils/calculations';
import { blendedInflationRate, blendedSavingsRate } from '../utils/inflationProjection';

const TimelineChartLazy = lazy(() => import('../components/TimelineChart'));
const BreakevenChartLazy = lazy(() => import('../components/BreakevenChart'));

const DEFAULT_SCENARIOS = {
  bear: { deltaStock: -10, deltaFx: -5 },
  base: { deltaStock: 0, deltaFx: 0 },
  bull: { deltaStock: 10, deltaFx: 5 },
};

export function ComparisonPage() {
  const [isDark] = useDarkMode();
  const { assetData, proxyFxData, isLoading: assetLoading, error: assetError, fetchData: fetchAsset } = useAssetData();
  const { etfData, etfAnnualizedReturn, isLoading: etfLoading, error: etfError, fetchEtf } = useEtfData();
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
    ticker, setTicker, shares, setShares, currentPriceUSD, setCurrentPriceUSD,
    currentFxRate, setCurrentFxRate, wibor3m, setWibor3m, benchmarkType, horizonMonths, setHorizonMonths,
    userScenarios, scenarioEditKey, setScenarioEditKey,
    inflationRate, setInflationRate, etfAnnualReturnPercent, setEtfAnnualReturnPercent,
    etfTerPercent, setEtfTerPercent, etfTicker, setEtfTicker,
    avgCostUSD, setAvgCostUSD, isRSU, setIsRSU, brokerFeeUSD, setBrokerFeeUSD,
    dividendYieldPercent, setDividendYieldPercent, nbpRefRate, setNbpRefRate,
    bondSettings, setBondSettings, bondPresetId, setBondPresetId,
    resetForNewTicker, resetEtfAutofill,
    handleBenchmarkTypeChange, handleApplySuggested, handleApplyModelScenarios,
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

  const scenarios = userScenarios ?? suggestedScenarios ?? DEFAULT_SCENARIOS;

  const onApplySuggested = useCallback(
    () => handleApplySuggested(suggestedScenarios),
    [handleApplySuggested, suggestedScenarios],
  );

  useEffect(() => {
    if (suggestedScenarios && userScenarios === null) {
      setScenarioEditKey((k) => k + 1);
    }
  }, [suggestedScenarios, userScenarios, setScenarioEditKey]);

  const deferredHorizon = useDeferredValue(horizonMonths);

  const effectiveInflation = useMemo(
    () => inflationRate > 0 ? blendedInflationRate(inflationRate, deferredHorizon) : 0,
    [inflationRate, deferredHorizon],
  );

  const effectiveSavingsRate = useMemo(
    () => wibor3m > 0 ? blendedSavingsRate(wibor3m, deferredHorizon) : 0,
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
  }), [shares, currentPriceUSD, currentFxRate, proxyFxRate, wibor3m, deferredHorizon, benchmarkType, bondSettings, computedEffectiveRate, effectiveInflation, effectiveSavingsRate, avgCostUSD, isRSU, brokerFeeUSD, dividendYieldPercent, etfAnnualReturnPercent, etfTerPercent]);

  const benchmarkReady = benchmarkType === 'savings'
    ? wibor3m > 0
    : benchmarkType === 'etf'
      ? true
      : bondSettings.firstYearRate > 0;
  const canCalc = shares > 0 && currentPriceUSD > 0 && currentFxRate > 0 && horizonMonths > 0 && benchmarkReady;

  const results = useMemo(() => canCalc ? calcAllScenarios(calcInputs, scenarios) : null, [canCalc, calcInputs, scenarios]);
  const timeline = useMemo(() => canCalc ? calcTimeline(calcInputs, scenarios) : null, [canCalc, calcInputs, scenarios]);
  const heatmap = useMemo(() => canCalc ? calcHeatmap(calcInputs) : null, [canCalc, calcInputs]);

  // Defer chart data to prevent Recharts' internal Redux store from being overwhelmed
  // by concurrent React 19 renders during rapid state updates (ticker load + model completion)
  const deferredResults = useDeferredValue(results);
  const deferredTimeline = useDeferredValue(timeline);
  const deferredHeatmap = useDeferredValue(heatmap);

  const [inputCollapsed, setInputCollapsed] = useState(false);

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
  };

  return (
    <div className="space-y-4">
        {inputCollapsed ? (
          <>
            <InputPanel {...inputPanelProps} collapsed onToggleCollapse={() => setInputCollapsed(false)} />
            <ScenarioEditor {...scenarioEditorProps} compact />
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <InputPanel {...inputPanelProps} onToggleCollapse={results ? () => setInputCollapsed(true) : undefined} />
              <ScenarioEditor {...scenarioEditorProps} />
            </div>

            {!canCalc && (
              <div className="bg-surface rounded-xl border border-dashed border-border-strong p-10 text-center text-muted dark:text-muted space-y-2">
                <p className="text-lg">Wprowadź ticker i dane portfela, aby zobaczyć wyniki</p>
                <p className="text-sm">Podaj ticker spółki lub ETF, liczbę akcji i parametry benchmarku.</p>
              </div>
            )}
          </>
        )}

        {deferredResults && (
          <>
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-surface-muted border border-border text-xs text-muted" role="note">
              <span aria-hidden="true">ℹ️</span>
              <span>
                <strong>Wartości szacunkowe</strong> — wyniki zależą od wybranych scenariuszy i nie uwzględniają wydarzeń fundamentalnych. Nie stanowią doradztwa inwestycyjnego ani podatkowego.
              </span>
            </div>
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
              <ComparisonChart results={deferredResults} isDark={isDark} />
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
            {deferredHeatmap && (
              <ErrorBoundary>
                <Suspense fallback={<Skeleton.Chart height={220} />}>
                  <BreakevenChartLazy
                    cells={deferredHeatmap}
                    benchmarkEndValuePLN={deferredResults[0]?.benchmarkEndValuePLN ?? 0}
                    benchmarkLabel={deferredResults[0]?.benchmarkLabel ?? 'Konto'}
                  />
                </Suspense>
              </ErrorBoundary>
            )}
          </>
        )}

    </div>
  );
}

export default ComparisonPage;
