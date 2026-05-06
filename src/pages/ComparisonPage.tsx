import { useCallback, useMemo, useState, lazy, Suspense } from 'react';
import { ArrowRightLeft, Sparkles, Trash2 } from 'lucide-react';
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

const TimelineChartLazy = lazy(() => import('../components/TimelineChart'));

const DEFAULT_SCENARIOS: Scenarios = {
  bear: { deltaStock: -10, deltaFx: -5 },
  base: { deltaStock: 0, deltaFx: 0 },
  bull: { deltaStock: 10, deltaFx: 5 },
};

interface AnalysisSnapshot {
  inputs: Parameters<typeof calcAllScenarios>[0];
  scenarios: Scenarios;
  signature: string;
  assetLabel: string;
  ticker: string;
  horizonLabel: string;
  volatilityStats: VolatilityStats | null;
}

function benchmarkFullLabel(label: string): string {
  if (label === 'Konto') return 'Konto oszczędnościowe';
  if (label === 'Obligacje') return 'Obligacje skarbowe';
  return label;
}

function formatHorizonLabel(value: number): string {
  if (value <= 11) {
    return `${value} ${value === 1 ? 'miesiąc' : value < 5 ? 'miesiące' : 'miesięcy'}`;
  }
  if (value % 12 === 0) {
    const years = value / 12;
    return `${years} ${years === 1 ? 'rok' : years < 5 ? 'lata' : 'lat'}`;
  }
  return `${Math.floor(value / 12)} l. ${value % 12} mies.`;
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
  } = portfolio;

  const [openSection, setOpenSection] = useState<'asset' | 'benchmark' | null>('asset');
  const [analysis, setAnalysis] = useState<AnalysisSnapshot | null>(null);
  const [editingScenario, setEditingScenario] = useState<ScenarioKey | null>(null);

  const suggested = useHistoricalVolatility(
    assetData?.historicalPrices ?? null,
    proxyFxData?.historicalRates ?? null,
    horizonMonths,
  );

  const { suggestedScenarios, stats: volatilityStats } = suggested;
  const currentScenarios = userScenarios ?? suggestedScenarios ?? DEFAULT_SCENARIOS;

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
    brokerFeeUSD,
    dividendYieldPercent,
    etfAnnualReturnPercent,
    etfTerPercent: 0,
  }), [
    avgCostUSD,
    benchmarkType,
    bondSettings,
    brokerFeeUSD,
    computedBondEffectiveRate,
    currentFxRate,
    currentPriceUSD,
    currencyRates.nbp?.mid,
    dividendYieldPercent,
    effectiveSavingsRate,
    etfAnnualReturnPercent,
    horizonMonths,
    inflationRate,
    isRSU,
    proxyFxData?.currentRate,
    shares,
    wibor3m,
  ]);

  const benchmarkReady = benchmarkType === 'savings'
    ? wibor3m > 0
    : benchmarkType === 'etf'
      ? etfAnnualReturnPercent > 0 && Boolean(etfTicker)
      : bondPresets.some((preset) => preset.id === bondPresetId);
  const canAnalyze = Boolean(ticker) && shares > 0 && currentPriceUSD > 0 && currentFxRate > 0 && horizonMonths > 0 && benchmarkReady;
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
    brokerFeeUSD,
    dividendYieldPercent,
    etfAnnualReturnPercent,
    etfTicker,
  });

  const handleAnalyze = useCallback(() => {
    if (!canAnalyze) return;
    setAnalysis({
      inputs: calcInputs,
      scenarios: currentScenarios,
      signature: draftSignature,
      assetLabel: assetData?.asset.name ?? ticker,
      ticker,
      horizonLabel: formatHorizonLabel(horizonMonths),
      volatilityStats,
    });
    setOpenSection(null);
  }, [assetData?.asset.name, calcInputs, canAnalyze, currentScenarios, draftSignature, horizonMonths, ticker, volatilityStats]);

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
    setAnalysis(null);
    setEditingScenario(null);
    resetComparisonState();
    resetAssetData();
    resetEtf();
    setOpenSection('asset');
  }, [resetAssetData, resetComparisonState, resetEtf]);

  const handleScenarioSave = useCallback((scenarioKey: ScenarioKey, stockPrice: number, fxRate: number) => {
    if (!analysis) return;

    const nextScenarios: Scenarios = {
      ...analysis.scenarios,
      [scenarioKey]: {
        deltaStock: ((stockPrice / analysis.inputs.currentPriceUSD) - 1) * 100,
        deltaFx: ((fxRate / analysis.inputs.currentFxRate) - 1) * 100,
      },
    };

    setAnalysis({ ...analysis, scenarios: nextScenarios });
    setUserScenarios(nextScenarios);
  }, [analysis, setUserScenarios]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-bg-card shadow-sm p-6 space-y-4">
        <div className="space-y-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent-primary/30 bg-accent-primary/5 px-3 py-1 text-xs font-semibold text-accent-primary">
            <ArrowRightLeft size={14} aria-hidden="true" />
            Decyzja sprzedaży
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
          brokerFeeUSD={brokerFeeUSD}
          dividendYieldPercent={dividendYieldPercent}
          onTickerChange={setTicker}
          onSharesChange={setShares}
          onAvgCostUSDChange={setAvgCostUSD}
          onIsRSUChange={setIsRSU}
          onBrokerFeeUSDChange={setBrokerFeeUSD}
          onDividendYieldChange={setDividendYieldPercent}
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
            disabled={!canAnalyze}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-interactive px-4 py-2.5 text-sm font-medium text-text-on-accent hover:bg-accent-interactive/90 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
          >
            Analizuj scenariusze
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
          horizonLabel={analysis.horizonLabel}
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

      {analysis && (
        <ComparisonStockTraits
          ticker={analysis.ticker}
          stats={analysis.volatilityStats}
        />
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
