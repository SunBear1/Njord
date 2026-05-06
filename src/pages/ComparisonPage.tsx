import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { ArrowRightLeft, Loader2, Sparkles, Trash2 } from 'lucide-react';
import type { ScenarioKey, Scenarios } from '../types/scenario';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Skeleton } from '../components/Skeleton';
import { ComparisonAssetDropdown } from '../components/comparison/ComparisonAssetDropdown';
import { ComparisonBenchmarkDropdown } from '../components/comparison/ComparisonBenchmarkDropdown';
import { ComparisonScenarioCard } from '../components/comparison/ComparisonScenarioCard';
import { ComparisonScenarioEditModal } from '../components/comparison/ComparisonScenarioEditModal';
import { ComparisonStockTraits } from '../components/comparison/ComparisonStockTraits';
import { ComparisonVerdictPanel } from '../components/comparison/ComparisonVerdictPanel';
import { useAssetData } from '../hooks/useAssetData';
import { useEtfData } from '../hooks/useEtfData';
import { useInflationData } from '../hooks/useInflationData';
import type { VolatilityStats } from '../hooks/useHistoricalVolatility';
import { useHistoricalVolatility } from '../hooks/useHistoricalVolatility';
import { useCurrencyRates } from '../hooks/useCurrencyRates';
import { useDarkMode } from '../hooks/useDarkMode';
import { useBondPresets } from '../hooks/useBondPresets';
import { usePortfolioState } from '../hooks/usePortfolioState';
import { calcAllScenarios, calcTimeline } from '../utils/calculations';
import { blendedInflationRate, blendedSavingsRate } from '../utils/inflationProjection';
import {
  clearComparisonAnalysis,
  loadComparisonAnalysis,
  saveComparisonAnalysis,
  type PersistedComparisonAnalysis,
  type PersistedComparisonTraitStats,
} from '../utils/persistedState';

const TimelineChartLazy = lazy(() => import('../components/TimelineChart'));

const DEFAULT_SCENARIOS: Scenarios = {
  bear: { deltaStock: -10, deltaFx: -5 },
  base: { deltaStock: 0, deltaFx: 0 },
  bull: { deltaStock: 10, deltaFx: 5 },
};

type AnalysisSnapshot = PersistedComparisonAnalysis;

function benchmarkFullLabel(label: string): string {
  if (label === 'Konto') return 'Konto oszczędnościowe';
  if (label === 'Obligacje') return 'Obligacje skarbowe';
  return label;
}

function toTraitStats(stats: VolatilityStats | null): PersistedComparisonTraitStats | null {
  if (!stats) return null;

  return {
    stockSigmaAnnual: stats.stockSigmaAnnual,
    fxSigmaAnnual: stats.fxSigmaAnnual,
    correlation: stats.correlation,
  };
}

function hasNumericValue(value: number): boolean {
  return value > 0 || value < 0;
}

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
    etfAnnualizedReturn,
  });

  const {
    ticker,
    setTicker,
    shares,
    setShares,
    currentPriceUSD,
    setCurrentPriceUSD,
    currentFxRate,
    wibor3m,
    setWibor3m,
    benchmarkType,
    horizonMonths,
    setHorizonMonths,
    userScenarios,
    setUserScenarios,
    inflationRate,
    setInflationRate,
    etfAnnualReturnPercent,
    setEtfAnnualReturnPercent,
    etfTicker,
    setEtfTicker,
    avgCostUSD,
    setAvgCostUSD,
    isRSU,
    setIsRSU,
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
  } = portfolio;

  const [openSection, setOpenSection] = useState<'asset' | 'benchmark' | null>('asset');
  const [analysis, setAnalysis] = useState<AnalysisSnapshot | null>(() => loadComparisonAnalysis());
  const [editingScenario, setEditingScenario] = useState<ScenarioKey | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const analyzeTimerRef = useRef<number | null>(null);

  const suggested = useHistoricalVolatility(
    assetData?.historicalPrices ?? null,
    proxyFxData?.historicalRates ?? null,
    horizonMonths,
  );

  const { suggestedScenarios, stats: volatilityStats } = suggested;
  const currentScenarios = userScenarios ?? suggestedScenarios ?? DEFAULT_SCENARIOS;
  const persistAnalysis = useCallback((nextAnalysis: AnalysisSnapshot | null) => {
    setAnalysis(nextAnalysis);

    if (nextAnalysis) {
      saveComparisonAnalysis(nextAnalysis);
      return;
    }

    clearComparisonAnalysis();
  }, []);

  const handleFetchAsset = useCallback(async (nextTicker: string) => {
    resetForNewTicker();
    const data = await fetchAsset(nextTicker);
    if (data?.asset.currentPrice) {
      setCurrentPriceUSD(data.asset.currentPrice);
    }
  }, [fetchAsset, resetForNewTicker, setCurrentPriceUSD]);

  const handleFetchEtf = useCallback(async (nextTicker: string) => {
    resetEtfAutofill();
    await fetchEtf(nextTicker);
  }, [fetchEtf, resetEtfAutofill]);

  const handleSelectBondPreset = useCallback((id: string, preset: (typeof bondPresets)[number]) => {
    setBondPresetId(id);
    const penalty = horizonMonths < preset.maturityMonths && preset.earlyRedemptionAllowed
      ? preset.earlyRedemptionPenalty
      : 0;
    setBondSettings({
      firstYearRate: preset.firstYearRate,
      rateType: preset.rateType,
      margin: preset.margin,
      couponFrequency: preset.couponFrequency,
      maturityMonths: preset.maturityMonths,
      penalty,
    });
  }, [horizonMonths, setBondPresetId, setBondSettings]);

  const effectiveInflation = inflationRate > 0
    ? blendedInflationRate(inflationRate, horizonMonths)
    : 0;
  const effectiveSavingsRate = wibor3m > 0
    ? blendedSavingsRate(wibor3m, horizonMonths)
    : 0;
  const computedBondEffectiveRate = bondSettings.rateType === 'fixed'
    ? bondSettings.firstYearRate
    : bondSettings.rateType === 'reference'
      ? nbpRefRate + bondSettings.margin
      : effectiveInflation + bondSettings.margin;
  const selectedBondPreset = bondPresets.find((preset) => preset.id === bondPresetId) ?? null;

  const calcInputs = useMemo(() => ({
    shares,
    currentPriceUSD,
    currentFxRate,
    nbpMidRate: currencyRates.nbp?.mid ?? proxyFxData?.currentRate ?? currentFxRate,
    wibor3mPercent: benchmarkType === 'savings' ? effectiveSavingsRate : wibor3m,
    horizonMonths,
    benchmarkType,
    bondFirstYearRate: bondSettings.firstYearRate,
    bondEffectiveRate: computedBondEffectiveRate,
    bondPenaltyPercent: bondSettings.penalty,
    bondCouponFrequency: bondSettings.couponFrequency,
    bondMaturityMonths: bondSettings.maturityMonths,
    bondReinvestmentRate: effectiveSavingsRate,
    inflationRate,
    avgCostUSD,
    isRSU,
    brokerFeeUSD: 0,
    dividendYieldPercent: 0,
    etfAnnualReturnPercent,
    etfTerPercent: 0,
  }), [
    avgCostUSD,
    benchmarkType,
    bondSettings,
    computedBondEffectiveRate,
    currentFxRate,
    currentPriceUSD,
    currencyRates.nbp?.mid,
    effectiveSavingsRate,
    etfAnnualReturnPercent,
    horizonMonths,
    inflationRate,
    isRSU,
    proxyFxData?.currentRate,
    shares,
    wibor3m,
  ]);

  const isAssetFormComplete = Boolean(ticker.trim()) && shares > 0 && currentPriceUSD > 0 && currentFxRate > 0 && (avgCostUSD > 0 || isRSU);
  const isBenchmarkFormComplete = benchmarkType === 'savings'
    ? wibor3m > 0 && horizonMonths > 0
    : benchmarkType === 'etf'
      ? Boolean(etfTicker.trim()) && hasNumericValue(etfAnnualReturnPercent) && horizonMonths > 0
      : Boolean(selectedBondPreset) && horizonMonths > 0 && (
        selectedBondPreset?.rateType === 'fixed'
          || (selectedBondPreset?.rateType === 'reference' ? nbpRefRate > 0 : hasNumericValue(inflationRate))
      );
  const canAnalyze = isAssetFormComplete && isBenchmarkFormComplete;
  const draftSignature = JSON.stringify({
    ticker,
    shares,
    currentPriceUSD,
    currentFxRate,
    wibor3m,
    benchmarkType,
    horizonMonths,
    bondSettings,
    inflationRate,
    nbpRefRate,
    avgCostUSD,
    isRSU,
    etfAnnualReturnPercent,
    etfTicker,
  });

  useEffect(() => () => {
    if (analyzeTimerRef.current !== null) {
      window.clearTimeout(analyzeTimerRef.current);
    }
  }, []);

  const handleAnalyze = useCallback(() => {
    if (!canAnalyze || isAnalyzing) return;

    setIsAnalyzing(true);
    if (analyzeTimerRef.current !== null) {
      window.clearTimeout(analyzeTimerRef.current);
    }

    analyzeTimerRef.current = window.setTimeout(() => {
      persistAnalysis({
        inputs: calcInputs,
        scenarios: currentScenarios,
        signature: draftSignature,
        assetLabel: assetData?.asset.name ?? ticker,
        ticker,
        traitStats: toTraitStats(volatilityStats),
      });
      setOpenSection(null);
      setIsAnalyzing(false);
      analyzeTimerRef.current = null;
    }, 500);
  }, [assetData?.asset.name, calcInputs, canAnalyze, currentScenarios, draftSignature, isAnalyzing, persistAnalysis, ticker, volatilityStats]);

  const analysisResults = useMemo(
    () => (analysis ? calcAllScenarios(analysis.inputs, analysis.scenarios) : null),
    [analysis],
  );
  const analysisTimeline = useMemo(
    () => (analysis ? calcTimeline(analysis.inputs, analysis.scenarios) : null),
    [analysis],
  );

  const isAnalysisStale = analysis !== null && analysis.signature !== draftSignature;
  const bearResult = analysisResults?.find((result) => result.key === 'bear') ?? null;
  const bullResult = analysisResults?.find((result) => result.key === 'bull') ?? null;
  const benchmarkLabel = analysisResults?.[0]?.benchmarkLabel ? benchmarkFullLabel(analysisResults[0].benchmarkLabel) : '';

  const handleClearData = useCallback(() => {
    const shouldClear = window.confirm('Wyczyścić zapisane dane porównania i zacząć od nowa?');
    if (!shouldClear) return;
    persistAnalysis(null);
    setEditingScenario(null);
    resetComparisonState();
    resetAssetData();
    resetEtf();
    setOpenSection('asset');
  }, [persistAnalysis, resetAssetData, resetComparisonState, resetEtf]);

  const handleScenarioSave = useCallback((scenarioKey: ScenarioKey, stockPrice: number, fxRate: number) => {
    if (!analysis) return;

    const nextScenarios: Scenarios = {
      ...analysis.scenarios,
      [scenarioKey]: {
        deltaStock: ((stockPrice / analysis.inputs.currentPriceUSD) - 1) * 100,
        deltaFx: ((fxRate / analysis.inputs.currentFxRate) - 1) * 100,
      },
    };

    persistAnalysis({ ...analysis, scenarios: nextScenarios });
    setUserScenarios(nextScenarios);
  }, [analysis, persistAnalysis, setUserScenarios]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-bg-card shadow-sm p-6 space-y-4">
        <div className="space-y-3">
          <span className="inline-flex items-start gap-2 rounded-full border border-accent-primary/30 bg-accent-primary/5 px-3 py-1 text-xs font-semibold text-accent-primary">
            <ArrowRightLeft size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span data-testid="comparison-decision-chip-text" className="flex flex-col leading-tight">
              <span>Decyzja</span>
              <span>sprzedaży</span>
            </span>
          </span>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-text-primary">Sprzedać czy trzymać akcje?</h1>
            <p className="max-w-3xl text-sm text-text-secondary">
              Najpierw ustaw akcje i alternatywę reinwestycji, potem kliknij <strong>Analizuj scenariusze</strong>.
              Wynik pokaże najpierw werdykt bazowy, a niżej scenariusze bear i bull oraz cechy historyczne spółki.
            </p>
          </div>
        </div>

        <ComparisonAssetDropdown
          isOpen={openSection === 'asset'}
          onToggle={() => setOpenSection((current) => current === 'asset' ? null : 'asset')}
          onFetchAsset={handleFetchAsset}
          assetData={assetData}
          assetLoading={assetLoading}
          assetError={assetError}
          ticker={ticker}
          shares={shares}
          currentPriceUSD={currentPriceUSD}
          currentFxRate={currentFxRate}
          aliorRate={currencyRates.alior?.buy ?? null}
          nbpMidRate={currencyRates.nbp?.mid ?? null}
          avgCostUSD={avgCostUSD}
          isRSU={isRSU}
          onTickerChange={setTicker}
          onSharesChange={setShares}
          onAvgCostUSDChange={setAvgCostUSD}
          onIsRSUChange={setIsRSU}
        />

        <ComparisonBenchmarkDropdown
          isOpen={openSection === 'benchmark'}
          onToggle={() => setOpenSection((current) => current === 'benchmark' ? null : 'benchmark')}
          benchmarkType={benchmarkType}
          wibor3m={wibor3m}
          effectiveSavingsRate={effectiveSavingsRate}
          horizonMonths={horizonMonths}
          bondSettings={bondSettings}
          bondEffectiveRate={computedBondEffectiveRate}
          inflationRate={inflationRate}
          inflationData={inflationData}
          inflationLoading={inflationLoading}
          nbpRefRate={nbpRefRate}
          etfAnnualReturnPercent={etfAnnualReturnPercent}
          etfTicker={etfTicker}
          etfLoading={etfLoading}
          etfError={etfError}
          etfName={etfData?.asset.name ?? null}
          bondPresetId={bondPresetId}
          bondPresets={bondPresets}
          bondPresetsLoading={bondPresetsLoading}
          onBenchmarkTypeChange={handleBenchmarkTypeChange}
          onWiborChange={setWibor3m}
          onHorizonChange={setHorizonMonths}
          onBondSettingsChange={setBondSettings}
          onBondPresetChange={handleSelectBondPreset}
          onInflationRateChange={setInflationRate}
          onNbpRefRateChange={setNbpRefRate}
          onEtfAnnualReturnChange={setEtfAnnualReturnPercent}
          onEtfTickerChange={setEtfTicker}
          onFetchEtf={handleFetchEtf}
        />

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={!canAnalyze || isAnalyzing}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-interactive px-4 py-2.5 text-sm font-medium text-text-on-accent hover:bg-accent-interactive/90 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
          >
            {isAnalyzing && <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {isAnalyzing ? 'Analizowanie…' : 'Analizuj scenariusze'}
          </button>
          <button
            type="button"
            onClick={handleClearData}
            className="flex items-center justify-center p-2 text-text-muted hover:text-danger rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-danger"
            aria-label="Wyczyść dane porównania"
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      </section>

      {!analysis && (
        <section className="rounded-2xl border border-dashed border-border bg-bg-card p-10 text-center text-text-muted space-y-4">
          <Sparkles size={32} className="mx-auto text-accent-primary/40" aria-hidden="true" />
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-text-primary">Najpierw ustaw dane i uruchom analizę</h2>
            <p className="text-sm">
              Dane zapisują się automatycznie w obu dropdownach. Wynik pojawi się dopiero po kliknięciu
              {' '}<strong>Analizuj scenariusze</strong>.
            </p>
          </div>
        </section>
      )}

      {analysis && isAnalysisStale && (
        <section className="rounded-2xl border border-accent-primary/30 bg-accent-primary/5 px-4 py-3 text-sm text-text-secondary">
          Zmieniłeś dane wejściowe po ostatniej analizie. Kliknij <strong className="text-text-primary">Analizuj scenariusze</strong>,
          {' '}aby odświeżyć werdykt.
        </section>
      )}

      {analysis && analysisResults && (
        <ComparisonVerdictPanel
          results={analysisResults}
          assetLabel={analysis.assetLabel}
          horizonMonths={analysis.inputs.horizonMonths}
          inflationRate={analysis.inputs.inflationRate}
        />
      )}

      {analysis && bearResult && bullResult && (
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">Scenariusze skrajne</h2>
            <p className="text-sm text-text-secondary">
              Tu porównasz bear i bull oraz ręcznie zmienisz cenę akcji i kurs dolara.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ComparisonScenarioCard
              label="Bear"
              scenario={analysis.scenarios.bear}
              result={bearResult}
              currentPriceUSD={analysis.inputs.currentPriceUSD}
              currentFxRate={analysis.inputs.currentFxRate}
              benchmarkLabel={benchmarkLabel}
              onEdit={() => setEditingScenario('bear')}
            />
            <ComparisonScenarioCard
              label="Bull"
              scenario={analysis.scenarios.bull}
              result={bullResult}
              currentPriceUSD={analysis.inputs.currentPriceUSD}
              currentFxRate={analysis.inputs.currentFxRate}
              benchmarkLabel={benchmarkLabel}
              onEdit={() => setEditingScenario('bull')}
            />
          </div>
        </section>
      )}

      {analysis && (
        <ComparisonStockTraits
          ticker={analysis.ticker}
          assetLabel={analysis.assetLabel}
          stats={analysis.traitStats}
        />
      )}

      {analysis && analysisTimeline && (
        <ErrorBoundary>
          <Suspense fallback={<Skeleton.Chart height={220} />}>
            <TimelineChartLazy
              data={analysisTimeline}
              currentValuePLN={analysisResults?.[0]?.currentValuePLN ?? 0}
              benchmarkLabel={analysisResults?.[0]?.benchmarkLabel ?? 'Konto'}
              inflationRate={analysis.inputs.inflationRate}
              isDark={isDark}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {analysis && editingScenario && (
        <ComparisonScenarioEditModal
          key={`${editingScenario}-${analysis.scenarios[editingScenario].deltaStock}-${analysis.scenarios[editingScenario].deltaFx}`}
          isOpen={editingScenario !== null}
          scenarioLabel={editingScenario === 'bear' ? 'Bear' : 'Bull'}
          initialStockPrice={analysis.inputs.currentPriceUSD * (1 + analysis.scenarios[editingScenario].deltaStock / 100)}
          initialFxRate={analysis.inputs.currentFxRate * (1 + analysis.scenarios[editingScenario].deltaFx / 100)}
          onClose={() => setEditingScenario(null)}
          onSave={(stockPrice, fxRate) => handleScenarioSave(editingScenario, stockPrice, fxRate)}
        />
      )}
    </div>
  );
}

export default ComparisonPage;
