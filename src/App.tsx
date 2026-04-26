import { useState, useCallback, useEffect, useMemo, useDeferredValue, lazy, Suspense } from 'react';
import { Moon, Sun, BarChart3, Receipt, Sprout } from 'lucide-react';
import { InputPanel } from './components/InputPanel';
import { ScenarioEditor } from './components/ScenarioEditor';
import { VerdictBanner } from './components/VerdictBanner';
import ComparisonChart from './components/ComparisonChart';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TaxCalculatorPanel } from './components/TaxCalculatorPanel';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { Skeleton } from './components/Skeleton';
import { useAssetData } from './hooks/useAssetData';
import { useEtfData } from './hooks/useEtfData';
import { useInflationData } from './hooks/useInflationData';
import { useHistoricalVolatility } from './hooks/useHistoricalVolatility';
import { useCurrencyRates } from './hooks/useCurrencyRates';
import { useSellAnalysis } from './hooks/useSellAnalysis';
import { useDarkMode } from './hooks/useDarkMode';
import { useBondPresets } from './hooks/useBondPresets';
import { usePortfolioState } from './hooks/usePortfolioState';
import { useAuth } from './hooks/useAuth';
import { KantorSidebar } from './components/KantorSidebar';
import { UserMenu } from './components/UserMenu';
import {
  calcAllScenarios,
  calcTimeline,
  calcHeatmap,
} from './utils/calculations';
import { blendedInflationRate, blendedSavingsRate } from './utils/inflationProjection';
import { loadState } from './utils/persistedState';

const PortfolioWizardLazy = lazy(() => import('./components/portfolio/PortfolioWizard').then(m => ({ default: m.PortfolioWizard })));
const SellAnalysisPanel = lazy(() => import('./components/SellAnalysisPanel').then(m => ({ default: m.SellAnalysisPanel })));
const MethodologyPanelLazy = lazy(() => import('./components/MethodologyPanel').then(m => ({ default: m.MethodologyPanel })));
const HowItWorksLazy = lazy(() => import('./components/HowItWorks').then(m => ({ default: m.HowItWorks })));
const TimelineChartLazy = lazy(() => import('./components/TimelineChart'));
const BreakevenChartLazy = lazy(() => import('./components/BreakevenChart'));
const AuthModalLazy = lazy(() => import('./components/AuthModal').then(m => ({ default: m.AuthModal })));
const AccountPanelLazy = lazy(() => import('./components/AccountPanel').then(m => ({ default: m.AccountPanel })));

const DEFAULT_SCENARIOS = {
  bear: { deltaStock: -10, deltaFx: -5 },
  base: { deltaStock: 0, deltaFx: 0 },
  bull: { deltaStock: 10, deltaFx: 5 },
};

const ROOT_STYLE = { backgroundColor: 'var(--color-bg-primary)' } as const;
const FOOTER_STYLE = { borderTop: '1px solid var(--color-border)', color: 'var(--color-text-faint)' } as const;

type AppSection = 'investment' | 'tax' | 'portfolio';
type ActiveView = 'comparison' | 'sellAnalysis';

function App() {
  const [isDark, toggleDarkMode] = useDarkMode();

  // Top-level section: investment comparison vs tax calculator vs portfolio wizard
  const [activeSection, setActiveSection] = useState<AppSection>(
    () => (loadState()?.activeSection as AppSection) ?? 'investment',
  );
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAccountPanel, setShowAccountPanel] = useState(false);

  const { user, isLoading: authLoading, login, register, logout, changePassword, deleteAccount, error: authError, clearError: clearAuthError } = useAuth();

  const { assetData, proxyFxData, isLoading: assetLoading, error: assetError, fetchData: fetchAsset } = useAssetData();
  const { etfData, etfAnnualizedReturn, isLoading: etfLoading, error: etfError, fetchEtf } = useEtfData();
  const { presets: bondPresets, isLoading: bondPresetsLoading } = useBondPresets();
  const { data: inflationData, isLoading: inflationLoading } = useInflationData();
  const currencyRates = useCurrencyRates();

  // All portfolio input state, persistence, autofill effects, and scenario handlers
  const portfolio = usePortfolioState(activeSection, {
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
    // Reset scenarios and FX autofill so model suggestions auto-apply for the new ticker
    resetForNewTicker();
    const data = await fetchAsset(tickerArg);
    if (data?.asset.currentPrice) {
      setCurrentPriceUSD(data.asset.currentPrice);
    }
  }, [fetchAsset, resetForNewTicker, setCurrentPriceUSD]);

  const handleFetchEtf = useCallback(async (tickerArg: string) => {
    resetEtfAutofill(); // allow autofill for the new ETF ticker
    await fetchEtf(tickerArg);
  }, [fetchEtf, resetEtfAutofill]);

  // Derive active scenarios: user overrides take precedence over model suggestions
  const scenarios = userScenarios ?? suggestedScenarios ?? DEFAULT_SCENARIOS;

  // Bound version of handleApplySuggested that closes over the current suggestedScenarios
  const onApplySuggested = useCallback(
    () => handleApplySuggested(suggestedScenarios),
    [handleApplySuggested, suggestedScenarios],
  );

  // Auto-apply model suggestions when they arrive and user hasn't manually edited.
  // Clears when resetForNewTicker sets userScenarios to null for a new ticker.
  useEffect(() => {
    if (suggestedScenarios && userScenarios === null) {
      setScenarioEditKey((k) => k + 1);
    }
  }, [suggestedScenarios, userScenarios, setScenarioEditKey]);

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

  // Sell analysis
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
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="36" height="36" className="shrink-0" aria-hidden="true">
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
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">Njord</h1>
            <p className="text-sm text-slate-400 truncate">Akcje · Obligacje · Konto oszczędnościowe · Podatek Belki · Kreator portfela</p>
          </div>
          <button
            type="button"
            onClick={toggleDarkMode}
            aria-label={isDark ? 'Włącz tryb jasny' : 'Włącz tryb ciemny'}
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <UserMenu
            user={user}
            isLoading={authLoading}
            onLoginClick={() => setShowAuthModal(true)}
            onLogout={logout}
            onAccountSettings={() => setShowAccountPanel(true)}
          />
        </div>
      </header>

      {/* Section toggle — investment comparison vs tax calculator */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 py-1.5">
          <button
            onClick={() => setActiveSection('investment')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeSection === 'investment'
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-sm border border-blue-200 dark:border-blue-800'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <BarChart3 size={16} aria-hidden="true" />
            Porównanie inwestycji
          </button>
          <button
            onClick={() => setActiveSection('tax')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeSection === 'tax'
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-sm border border-blue-200 dark:border-blue-800'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Receipt size={16} aria-hidden="true" />
            Podatek Belki
          </button>
          <button
            onClick={() => setActiveSection('portfolio')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeSection === 'portfolio'
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-sm border border-blue-200 dark:border-blue-800'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <Sprout size={16} aria-hidden="true" />
            Kreator portfela
          </button>
        </div>
      </nav>

      <div className="flex justify-center">
        {/* Kantor rates sticky sidebar — xl+ only, hidden in tax calculator and portfolio wizard */}
        {activeSection === 'investment' && (
          <aside className="hidden xl:block shrink-0 pt-6 pl-4">
            <div className="sticky top-4">
              <KantorSidebar rates={currencyRates} />
            </div>
          </aside>
        )}

      <main className="flex-1 min-w-0 max-w-7xl mx-auto px-4 py-4 space-y-4">
        {activeSection === 'tax' ? (
          /* ── Tax calculator section ── */
          <ErrorBoundary>
            <TaxCalculatorPanel currencyRates={currencyRates} />
          </ErrorBoundary>
        ) : activeSection === 'portfolio' ? (
          /* ── Portfolio wizard section ── */
          <ErrorBoundary>
            <Suspense fallback={<Skeleton className="h-96" />}>
              <PortfolioWizardLazy
                bondPresets={bondPresets}
                isDark={isDark}
              />
            </Suspense>
          </ErrorBoundary>
        ) : inputCollapsed ? (
          /* ── Collapsed layout: summary bar → ScenarioEditor (full-width) → Results ── */
          <>
            <InputPanel
              onFetchAsset={fetchData}
              assetData={assetData}
              assetLoading={assetLoading}
              assetError={assetError}
              nbpMidRate={proxyFxData?.currentRate ?? 0}
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
              isRSU={isRSU}
              brokerFeeUSD={brokerFeeUSD}
              dividendYieldPercent={dividendYieldPercent}
              etfAnnualReturnPercent={etfAnnualReturnPercent}
              etfTerPercent={etfTerPercent}
              etfTicker={etfTicker}
              etfLoading={etfLoading}
              etfError={etfError}
              etfName={etfData?.asset.name ?? null}
              initialBondPresetId={bondPresetId}
              collapsed
              onToggleCollapse={() => setInputCollapsed(false)}
              bondPresets={bondPresets}
              bondPresetsLoading={bondPresetsLoading}
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
              onIsRSUChange={setIsRSU}
              onBrokerFeeUSDChange={setBrokerFeeUSD}
              onDividendYieldChange={setDividendYieldPercent}
              onEtfAnnualReturnChange={setEtfAnnualReturnPercent}
              onEtfTerChange={setEtfTerPercent}
              onEtfTickerChange={setEtfTicker}
              onFetchEtf={handleFetchEtf}
              onInflationRateChange={setInflationRate}
              onNbpRefRateChange={setNbpRefRate}
            />
            <ScenarioEditor
              key={scenarioEditKey}
              scenarios={scenarios}
              onChange={handleScenarioChange}
              suggestedScenarios={suggestedScenarios}
              onApplySuggested={onApplySuggested}
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
                nbpMidRate={proxyFxData?.currentRate ?? 0}
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
                isRSU={isRSU}
                brokerFeeUSD={brokerFeeUSD}
                dividendYieldPercent={dividendYieldPercent}
                etfAnnualReturnPercent={etfAnnualReturnPercent}
                etfTerPercent={etfTerPercent}
                etfTicker={etfTicker}
                etfLoading={etfLoading}
                etfError={etfError}
                etfName={etfData?.asset.name ?? null}
                initialBondPresetId={bondPresetId}
                onToggleCollapse={results ? () => setInputCollapsed(true) : undefined}
                bondPresets={bondPresets}
                bondPresetsLoading={bondPresetsLoading}
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
                onIsRSUChange={setIsRSU}
                onBrokerFeeUSDChange={setBrokerFeeUSD}
                onDividendYieldChange={setDividendYieldPercent}
                onEtfAnnualReturnChange={setEtfAnnualReturnPercent}
                onEtfTerChange={setEtfTerPercent}
                onEtfTickerChange={setEtfTicker}
                onFetchEtf={handleFetchEtf}
                onInflationRateChange={setInflationRate}
                onNbpRefRateChange={setNbpRefRate}
              />
              <ScenarioEditor
                key={scenarioEditKey}
                scenarios={scenarios}
                onChange={handleScenarioChange}
                suggestedScenarios={suggestedScenarios}
                onApplySuggested={onApplySuggested}
                onApplyModelScenarios={handleApplyModelScenarios}
                currentPriceUSD={currentPriceUSD}
                currentFxRate={currentFxRate}
                volatilityStats={volatilityStats}
              />
            </div>

            {!canCalc && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-10 text-center text-gray-400 dark:text-gray-500 space-y-2">
                <p className="text-lg">Wprowadź ticker i dane portfela, aby zobaczyć wyniki</p>
                <p className="text-sm">Podaj ticker spółki lub ETF, liczbę akcji i parametry benchmarku.</p>
              </div>
            )}
          </>
        )}

        {/* View toggle — only show when stock data is loaded */}
        {activeSection === 'investment' && currentPriceUSD > 0 && assetData && (
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 w-fit">
            <button
              onClick={() => setActiveView('comparison')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeView === 'comparison'
                  ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-400 shadow-sm border border-gray-200 dark:border-gray-600'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              Porównanie z benchmarkiem
            </button>
            <button
              onClick={() => setActiveView('sellAnalysis')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeView === 'sellAnalysis'
                  ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-400 shadow-sm border border-gray-200 dark:border-gray-600'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              Optymalna cena sprzedaży
            </button>
          </div>
        )}

        {activeSection === 'investment' && activeView === 'comparison' && results && (
          <>
            {/* Disclaimer: scenario analysis, not investment advice */}
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400" role="note">
              <span aria-hidden="true">ℹ️</span>
              <span>
                <strong>Wartości szacunkowe</strong> — wyniki zależą od wybranych scenariuszy i nie uwzględniają wydarzeń fundamentalnych. Nie stanowią doradztwa inwestycyjnego ani podatkowego.
              </span>
            </div>
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
              <ComparisonChart results={results} isDark={isDark} />
            </ErrorBoundary>
            {timeline && (
              <ErrorBoundary>
                <Suspense fallback={<Skeleton.Chart height={220} />}>
                  <TimelineChartLazy
                    data={timeline}
                    currentValuePLN={results[0]?.currentValuePLN ?? 0}
                    benchmarkLabel={results[0]?.benchmarkLabel ?? 'Konto'}
                    inflationRate={effectiveInflation}
                    isDark={isDark}
                  />
                </Suspense>
              </ErrorBoundary>
            )}
            {heatmap && (
              <ErrorBoundary>
                <Suspense fallback={<Skeleton.Chart height={220} />}>
                  <BreakevenChartLazy
                    cells={heatmap}
                    benchmarkEndValuePLN={results[0]?.benchmarkEndValuePLN ?? 0}
                    benchmarkLabel={results[0]?.benchmarkLabel ?? 'Konto'}
                  />
                </Suspense>
              </ErrorBoundary>
            )}
          </>
        )}

        {activeSection === 'investment' && activeView === 'sellAnalysis' && (
          <ErrorBoundary>
            <Suspense fallback={<div className="text-center py-8 text-text-faint">Ładowanie modułu…</div>}>
              <SellAnalysisPanel
                analysis={sellAnalysis}
                isLoading={sellAnalysisLoading}
                horizonDays={sellHorizonDays}
                onHorizonChange={setSellHorizonDays}
                currentFxRate={currentFxRate}
                isDark={isDark}
              />
            </Suspense>
          </ErrorBoundary>
        )}

        {activeSection === 'investment' && (
          <>
            <Suspense fallback={null}>
              <MethodologyPanelLazy />
            </Suspense>
            <Suspense fallback={null}>
              <HowItWorksLazy />
            </Suspense>
          </>
        )}
      </main>
      </div>

      <footer className="mt-10 py-5 text-center text-xs" style={FOOTER_STYLE}>
        <p>Dane informacyjne — nie stanowią doradztwa inwestycyjnego ani podatkowego.</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <button
            onClick={() => setShowPrivacy(true)}
            className="underline hover:no-underline focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
          >
            Polityka prywatności
          </button>
          {!showClearConfirm ? (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="underline hover:no-underline focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
            >
              Wyczyść wszystkie dane
            </button>
          ) : (
            <span className="inline-flex items-center gap-2">
              <span>Na pewno? Wszystkie dane zostaną usunięte.</span>
              <button
                onClick={() => {
                  try { localStorage.clear(); } catch { /* ignore */ }
                  window.location.reload();
                }}
                className="font-semibold text-red-600 dark:text-red-400 underline"
              >
                Tak, usuń
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="underline"
              >
                Anuluj
              </button>
            </span>
          )}
        </div>
      </footer>

      {showPrivacy && <PrivacyPolicy onClose={() => setShowPrivacy(false)} />}
      {showAuthModal && (
        <Suspense fallback={null}>
          <AuthModalLazy
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            onLogin={login}
            onRegister={register}
            error={authError}
            onClearError={clearAuthError}
          />
        </Suspense>
      )}
      {showAccountPanel && user && (
        <Suspense fallback={null}>
          <AccountPanelLazy
            user={user}
            isOpen={showAccountPanel}
            onClose={() => { setShowAccountPanel(false); clearAuthError(); }}
            onChangePassword={changePassword}
            onDeleteAccount={deleteAccount}
            hasPassword={user.hasPassword}
            error={authError}
            onClearError={clearAuthError}
          />
        </Suspense>
      )}
    </div>
  );
}

export default App;
