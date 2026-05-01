import { useState, useEffect, useRef } from 'react';
import { Loader2, AlertCircle, CheckCircle2, RefreshCw, Calculator, ChevronDown, ChevronUp } from 'lucide-react';
import type { AssetData } from '../types/asset';
import type { InflationData } from '../hooks/useInflationData';
import type { BenchmarkType, BondPreset, BondSettings } from '../types/scenario';
import { fmtUSD, fmtNum } from '../utils/formatting';
import { Tooltip } from './Tooltip';
import { BondBenchmarkSection } from './inputs/BondBenchmarkSection';
import { EtfBenchmarkSection } from './inputs/EtfBenchmarkSection';

interface InputPanelProps {
  onFetchAsset: (ticker: string) => void;
  assetData: AssetData | null;
  assetLoading: boolean;
  assetError: string | null;
  /** NBP Table A mid rate for Belka tax basis display (0 if not yet loaded) */
  nbpMidRate: number;
  ticker: string;
  shares: number;
  currentPriceUSD: number;
  currentFxRate: number;
  wibor3m: number;
  /** Blended savings rate after mean-reversion over the horizon */
  effectiveSavingsRate: number;
  horizonMonths: number;
  benchmarkType: BenchmarkType;
  bondSettings: BondSettings;
  bondEffectiveRate: number;
  inflationRate: number;
  inflationData: InflationData | null;
  inflationLoading: boolean;
  nbpRefRate: number;
  avgCostUSD: number;
  isRSU: boolean;
  brokerFeeUSD: number;
  dividendYieldPercent: number;
  etfAnnualReturnPercent: number;
  etfTerPercent: number;
  etfTicker: string;
  etfLoading: boolean;
  etfError: string | null;
  etfName: string | null;
  /** Saved bond preset ID for UI restoration on page reload */
  initialBondPresetId?: string;
  /** Bond presets loaded from the API */
  bondPresets: BondPreset[];
  /** True while bond presets are being fetched */
  bondPresetsLoading?: boolean;
  /** Collapsed summary mode */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onTickerChange: (v: string) => void;
  onSharesChange: (v: number) => void;
  onPriceChange: (v: number) => void;
  onFxRateChange: (v: number) => void;
  onWiborChange: (v: number) => void;
  onHorizonChange: (v: number) => void;
  onBenchmarkTypeChange: (v: BenchmarkType) => void;
  onBondSettingsChange: (s: BondSettings) => void;
  onBondPresetChange: (id: string) => void;
  onAvgCostUSDChange: (v: number) => void;
  onIsRSUChange: (v: boolean) => void;
  onBrokerFeeUSDChange: (v: number) => void;
  onDividendYieldChange: (v: number) => void;
  onEtfAnnualReturnChange: (v: number) => void;
  onEtfTerChange: (v: number) => void;
  onEtfTickerChange: (v: string) => void;
  onFetchEtf: (ticker: string) => void;
  onInflationRateChange: (v: number) => void;
  onNbpRefRateChange: (v: number) => void;
}

export function InputPanel({
  onFetchAsset,
  assetData,
  assetLoading,
  assetError,
  nbpMidRate,
  ticker,
  shares,
  currentPriceUSD,
  currentFxRate,
  wibor3m,
  effectiveSavingsRate,
  horizonMonths,
  benchmarkType,
  bondSettings,
  bondEffectiveRate,
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
  etfName,
  initialBondPresetId,
  bondPresets,
  bondPresetsLoading,
  collapsed,
  onToggleCollapse,
  onTickerChange,
  onSharesChange,
  onPriceChange,
  onFxRateChange,
  onWiborChange,
  onHorizonChange,
  onBenchmarkTypeChange,
  onBondSettingsChange,
  onBondPresetChange,
  onAvgCostUSDChange,
  onIsRSUChange,
  onBrokerFeeUSDChange,
  onDividendYieldChange,
  onEtfAnnualReturnChange,
  onEtfTerChange,
  onEtfTickerChange,
  onFetchEtf,
  onInflationRateChange,
  onNbpRefRateChange,
}: InputPanelProps) {
  const [localTicker, setLocalTicker] = useState(ticker);
  const [localEtfTicker, setLocalEtfTicker] = useState(etfTicker);
  const [wiborStr, setWiborStr] = useState(wibor3m > 0 ? String(wibor3m) : '');
  const [showValueCalc, setShowValueCalc] = useState(false);
  const [totalValueStr, setTotalValueStr] = useState('');
  const [selectedBondId, setSelectedBondId] = useState(initialBondPresetId ?? 'OTS');
  const [showAdvanced, setShowAdvanced] = useState(
    () => (avgCostUSD > 0 || isRSU || brokerFeeUSD > 0 || dividendYieldPercent > 0),
  );

  const handleSelectBondPreset = (id: string, preset: BondPreset) => {
    setSelectedBondId(id);
    onBondPresetChange(id);
    applyBondPreset(preset);
  };
  const isFirstRender = useRef(true);
  const rateLimited = assetError?.includes('Przekroczono limit') ?? false;

  // Apply bond preset
  const applyBondPreset = (preset: BondPreset) => {
    const earlyExit = horizonMonths < preset.maturityMonths;
    const penalty = earlyExit && preset.earlyRedemptionAllowed ? preset.earlyRedemptionPenalty : 0;
    onBondSettingsChange({
      firstYearRate: preset.firstYearRate,
      rateType: preset.rateType,
      margin: preset.margin,
      couponFrequency: preset.couponFrequency,
      penalty,
      maturityMonths: preset.maturityMonths,
    });
  };

  // Re-evaluate penalty whenever horizon or presets change
  useEffect(() => {
    if (benchmarkType !== 'bonds') return;
    const preset = bondPresets.find((b) => b.id === selectedBondId);
    if (!preset) return;
    const earlyExit = horizonMonths < preset.maturityMonths;
    const penalty = earlyExit && preset.earlyRedemptionAllowed ? preset.earlyRedemptionPenalty : 0;
    onBondSettingsChange({ ...bondSettings, penalty });
  }, [horizonMonths, selectedBondId, benchmarkType, bondPresets, bondSettings, onBondSettingsChange]);

  // Auto-fetch with 800ms debounce, requires ticker + API key
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const trimmed = localTicker.trim().toUpperCase();
    if (trimmed.length < 1) return;
    const timer = setTimeout(() => {
      onTickerChange(trimmed);
      onFetchAsset(trimmed);
    }, 800);
    return () => clearTimeout(timer);
  }, [localTicker]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleManualRefetch = () => {
    const trimmed = localTicker.trim().toUpperCase();
    if (trimmed) {
      onTickerChange(trimmed);
      onFetchAsset(trimmed);
    }
  };

  const handleWiborChange = (raw: string) => {
    setWiborStr(raw);
    const num = parseFloat(raw);
    onWiborChange(isNaN(num) ? 0 : num);
  };

  const monthlyRate = wibor3m > 0 ? (wibor3m / 12) : null;

  // Horizon label for summary bar
  const horizonLabel = horizonMonths <= 11
    ? `${horizonMonths} mies.`
    : horizonMonths % 12 === 0
      ? `${horizonMonths / 12} ${horizonMonths / 12 === 1 ? 'rok' : horizonMonths / 12 < 5 ? 'lata' : 'lat'}`
      : `${Math.floor(horizonMonths / 12)}l. ${horizonMonths % 12}m.`;

  const bmSummary = benchmarkType === 'savings'
    ? `Konto ${wibor3m > 0 ? wibor3m.toFixed(1) + '%' : '—'}`
    : benchmarkType === 'etf'
      ? etfTicker
        ? `ETF ${etfTicker} ${etfAnnualReturnPercent > 0 ? etfAnnualReturnPercent.toFixed(1) + '%' : '—'}`
        : `ETF ${etfAnnualReturnPercent > 0 ? etfAnnualReturnPercent.toFixed(1) + '%' : '—'}`
      : `Obligacje ${bondSettings.firstYearRate.toFixed(1)}%`;

  /* ────── Animated layout: both summary + form always in DOM ────── */
  return (
    <div className="bg-bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Summary bar — visible when collapsed */}
      <div
        className="grid"
        style={{
          gridTemplateRows: collapsed ? '1fr' : '0fr',
          transition: 'grid-template-rows 500ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="overflow-hidden min-h-0">
          <div
            className="transition-opacity duration-500"
            style={{ opacity: collapsed ? 1 : 0 }}
          >
          <button
            type="button"
            onClick={onToggleCollapse}
            className="w-full flex items-center justify-between gap-3 px-5 py-3"
          >
            <div className="flex items-center gap-2 flex-wrap min-w-0 text-sm text-text-secondary">
              <span className="font-semibold text-text-primary">{ticker || '—'}</span>
              <span className="text-text-muted">·</span>
              <span>{shares} akcji</span>
              <span className="text-text-muted">·</span>
              <span>${currentPriceUSD.toFixed(2)}</span>
              <span className="text-text-muted">·</span>
              <span>PLN/USD {currentFxRate.toFixed(2)}</span>
              <span className="text-text-muted">·</span>
              <span>{bmSummary}</span>
              <span className="text-text-muted">·</span>
              <span className="text-accent-primary font-medium">{horizonLabel}</span>
            </div>
            <span className="flex items-center gap-1 text-xs text-text-primary font-medium whitespace-nowrap shrink-0">
              Rozwiń <ChevronDown size={16} />
            </span>
          </button>
          </div>
        </div>
      </div>

      {/* Full form — visible when expanded */}
      <div
        className="grid"
        style={{
          gridTemplateRows: collapsed ? '0fr' : '1fr',
          transition: 'grid-template-rows 500ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="overflow-hidden min-h-0">
          <div
            className="p-5 space-y-5 transition-opacity duration-500"
            style={{ opacity: collapsed ? 0 : 1 }}
          >

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Dane wejściowe</h2>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex items-center gap-1 text-xs text-text-primary hover:text-text-primary font-medium transition-colors"
          >
            Zwiń <ChevronUp size={16} />
          </button>
        )}
      </div>

      {/* Rate limit banner */}
      {rateLimited && (
        <div className="bg-danger/5 border border-danger/30 rounded-lg p-3">
          <p className="text-sm font-medium text-danger">
            Limit zapytań API wyczerpany (maks. 8 na minutę).
          </p>
          <p className="text-xs text-danger mt-1">
            Poczekaj minutę i spróbuj ponownie.
          </p>
        </div>
      )}

      {/* Ticker — auto-fetch */}
      <div className="space-y-1">
        <label htmlFor="ticker-input" className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
          Ticker giełdowy <span className="text-danger">*</span>
          <Tooltip content="Wpisz symbol giełdowy (np. AAPL, NVDA, VOO). Cena i kurs USD/PLN pobiorą się automatycznie." />
        </label>
        <p className="text-xs text-text-muted">Zacznij pisać — dane pobiorą się automatycznie.</p>
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <input
              id="ticker-input"
              name="ticker"
              autoComplete="off"
              type="text"
              value={localTicker}
              onChange={(e) => setLocalTicker(e.target.value.toUpperCase())}
              placeholder="np. AAPL, NVDA, VOO"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/30 pr-9"
            />
            {assetLoading && (
              <Loader2 size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin motion-reduce:animate-none text-accent-primary" aria-hidden="true" />
            )}
          </div>
          <button
            type="button"
            onClick={handleManualRefetch}
            disabled={assetLoading || !localTicker.trim()}
            aria-label="Odśwież dane giełdowe"
            className="p-2 rounded-lg border border-border text-text-muted hover:bg-bg-card disabled:opacity-40 transition-colors"
          >
            <RefreshCw size={16} aria-hidden="true" />
          </button>
        </div>

        {assetError && !rateLimited && (
          <p className="flex items-start gap-1.5 text-xs text-danger mt-1">
            <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
            {assetError}
          </p>
        )}
        {assetData && !assetLoading && (
          <p className="flex items-center gap-1.5 text-xs text-success mt-1">
            <CheckCircle2 size={12} />
            {assetData.asset.name} ({assetData.asset.currency}) · {fmtUSD(assetData.asset.currentPrice)}
          </p>
        )}
      </div>

      {/* Shares */}
      <div className="space-y-1">
        <label htmlFor="shares-input" className="text-sm font-medium text-text-secondary">
          Liczba akcji <span className="text-danger">*</span>
        </label>
        <input
          id="shares-input"
          name="shares"
          autoComplete="off"
          type="number"
          min={0}
          step={1}
          value={shares || ''}
          onChange={(e) => onSharesChange(Number(e.target.value))}
          placeholder="np. 50"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/30"
        />
        <button
          type="button"
          onClick={() => setShowValueCalc((v) => !v)}
          className="flex items-center gap-1 text-xs text-accent-primary hover:text-accent-primary/80 transition-colors"
        >
          <Calculator size={12} />
          {showValueCalc ? 'Ukryj kalkulator' : 'Nie wiesz ile masz akcji, ale znasz wartość?'}
        </button>
        {showValueCalc && (
          <div className="bg-bg-card border border-border rounded-lg p-3 space-y-2">
            <p className="text-xs text-text-secondary">
              Wpisz całkowitą wartość portfela w USD — obliczymy liczbę akcji.
            </p>
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-text-primary font-medium">Wartość portfela (USD)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={totalValueStr}
                  onChange={(e) => setTotalValueStr(e.target.value)}
                  placeholder="np. 5000.00"
                  className="w-full border border-border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/30 bg-bg-card"
                />
              </div>
              <button
                type="button"
                disabled={!currentPriceUSD || !totalValueStr}
                onClick={() => {
                  const val = parseFloat(totalValueStr);
                  if (val > 0 && currentPriceUSD > 0) {
                    const computed = Math.floor(val / currentPriceUSD);
                    onSharesChange(computed);
                    setShowValueCalc(false);
                    setTotalValueStr('');
                  }
                }}
                className="px-3 py-1.5 text-xs font-medium bg-accent-interactive text-text-on-accent rounded-md hover:bg-accent-interactive/80 disabled:opacity-40 transition-colors"
              >
                Przelicz
              </button>
            </div>
            {currentPriceUSD > 0 && totalValueStr && parseFloat(totalValueStr) > 0 && (
              <p className="text-xs text-text-secondary">
                {fmtUSD(parseFloat(totalValueStr))} ÷ {fmtUSD(currentPriceUSD)} ≈{' '}
                <strong>{Math.floor(parseFloat(totalValueStr) / currentPriceUSD)} akcji</strong>
                {' '}(zaokrąglone w dół)
              </p>
            )}
            {!currentPriceUSD && (
              <p className="text-xs text-danger">
                Najpierw wpisz ticker, aby pobrać cenę akcji.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Price USD */}
      <div className="space-y-1">
        <label htmlFor="price-usd" className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
          Aktualna cena akcji (USD) <span className="text-danger">*</span>
          {assetData && (
            <Tooltip content="Cena pobrana automatycznie z Twelve Data. Możesz ją edytować ręcznie." />
          )}
        </label>
        <input
          id="price-usd"
          name="priceUsd"
          autoComplete="off"
          type="number"
          min={0}
          step={0.01}
          value={currentPriceUSD || ''}
          onChange={(e) => onPriceChange(Number(e.target.value))}
          placeholder="np. 185.00"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/30"
        />
      </div>

      {/* Advanced settings (collapsible) */}
      <div className="border border-border rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-text-secondary hover:bg-bg-card transition-colors"
          aria-expanded={showAdvanced}
        >
          <span className="flex items-center gap-1.5">
            Ustawienia zaawansowane
            {(avgCostUSD > 0 || isRSU || brokerFeeUSD > 0 || dividendYieldPercent > 0) && (
              <span className="w-1.5 h-1.5 rounded-full bg-accent-primary" />
            )}
          </span>
          <ChevronDown size={14} className={`transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        <div
          className="grid transition-[grid-template-rows] duration-300 ease-in-out"
          style={{ gridTemplateRows: showAdvanced ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden min-h-0">
            <div className="px-3 pb-3 space-y-4">

      {/* Average cost (optional) */}
      <div className="space-y-1">
        <label htmlFor="avg-cost-usd" className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
          Cena zakupu (USD)
          <span className="text-xs font-normal text-text-muted">(opcjonalnie)</span>
          <Tooltip content="Średnia cena zakupu za akcję. Używana do obliczenia rzeczywistego zysku/straty oraz prawidłowej podstawy podatku Belki — podatek nalicza się od zysku względem ceny zakupu, nie dzisiejszej ceny." />
        </label>
        <input
          id="avg-cost-usd"
          name="avgCostUsd"
          autoComplete="off"
          type="number"
          min={0}
          step={0.01}
          value={isRSU ? '' : (avgCostUSD || '')}
          onChange={(e) => onAvgCostUSDChange(Number(e.target.value))}
          placeholder={isRSU ? 'RSU: $0' : 'np. 50.00'}
          disabled={isRSU}
          className={`w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/30 ${isRSU ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
        {/* RSU toggle */}
        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer mt-1">
          <input
            type="checkbox"
            checked={isRSU}
            onChange={(e) => {
              onIsRSUChange(e.target.checked);
              if (e.target.checked) onAvgCostUSDChange(0);
            }}
            className="rounded border-border text-accent-primary focus:ring-accent-primary"
          />
          <span>RSU / akcje przyznane (koszt nabycia = $0)</span>
          <Tooltip content="Restricted Stock Units — akcje przyznane przez pracodawcę. Cena nabycia wynosi $0, więc cały przychód ze sprzedaży podlega opodatkowaniu podatkiem Belki." />
        </label>
        {/* Inline P&L indicator */}
        {isRSU && currentPriceUSD > 0 && (
          <div className="flex items-center gap-2 text-xs px-2 py-1 rounded-md bg-danger/5 text-danger">
            <span>RSU — cały przychód ({fmtUSD(currentPriceUSD * (shares || 0))}) podlega Belce 19%</span>
          </div>
        )}
        {!isRSU && avgCostUSD > 0 && currentPriceUSD > 0 && (
          <div className={`flex items-center gap-2 text-xs px-2 py-1 rounded-md ${currentPriceUSD >= avgCostUSD ? 'bg-success/5 text-success' : 'bg-danger/5 text-danger '}`}>
            {currentPriceUSD >= avgCostUSD ? '▲' : '▼'}
            <span>
              {fmtUSD(currentPriceUSD)} vs. zakup {fmtUSD(avgCostUSD)}
              {' · '}
              <strong>{currentPriceUSD >= avgCostUSD ? '+' : ''}{(((currentPriceUSD - avgCostUSD) / avgCostUSD) * 100).toFixed(1)}%</strong>
              {' '}({currentPriceUSD >= avgCostUSD ? '+' : ''}{fmtUSD((currentPriceUSD - avgCostUSD) * (shares || 0))}/akcję×{shares || 0})
            </span>
          </div>
        )}
      </div>

      {/* Broker fee (optional) */}
      <div className="space-y-1">
        <label htmlFor="broker-fee" className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
          Prowizja brokera (USD)
          <span className="text-xs font-normal text-text-muted">(opcjonalnie)</span>
          <Tooltip content="Łączna prowizja za transakcję sprzedaży w USD. Odejmowana od wartości sprzedaży i zaliczana jako koszt uzyskania przychodu — pomniejsza podstawę podatku Belki. Przykład: IBKR min $1, Exante ~0.02 USD/akcję." />
        </label>
        <input
          id="broker-fee"
          name="brokerFeeUsd"
          autoComplete="off"
          type="number"
          min={0}
          step={0.01}
          value={brokerFeeUSD || ''}
          onChange={(e) => onBrokerFeeUSDChange(Number(e.target.value))}
          placeholder="np. 1.00"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/30"
        />
      </div>

      {/* Dividend yield (optional) */}
      <div className="space-y-1">
        <label htmlFor="dividend-yield" className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
          Stopa dywidendy (% rocznie)
          <span className="text-xs font-normal text-text-muted">(opcjonalnie)</span>
          <Tooltip content="Roczna stopa dywidendy akcji (np. 1.5 dla 1.5%). Dywidendy akumulowane jako gotówka PLN w ciągu horyzontu. Podatek 19% od całości (pokrywa 15% WHT USA + 4% dopłata do polskiego PIT-38). Spółki wzrostowe zazwyczaj nie wypłacają dywidend (0)." />
        </label>
        <input
          id="dividend-yield"
          name="dividendYield"
          autoComplete="off"
          type="number"
          min={0}
          max={20}
          step={0.1}
          value={dividendYieldPercent || ''}
          onChange={(e) => onDividendYieldChange(Number(e.target.value))}
          placeholder="np. 1.5"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/30"
        />
        {dividendYieldPercent > 0 && (
          <p className="text-xs text-text-muted">
            Szacowane dywidendy netto (base): ok.{' '}
            <strong>
              {new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(
                (shares || 0) * (currentPriceUSD || 0) * (dividendYieldPercent / 100) * (horizonMonths / 12) * 0.81 * (currentFxRate || 1)
              )}
            </strong>
            {' '}przez {horizonMonths} mies.
          </p>
        )}
      </div>

            </div>
          </div>
        </div>
      </div>

      {/* FX Rate */}
      <div className="space-y-1">
        <label htmlFor="fx-rate" className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
          Kurs sprzedaży USD <span className="text-danger">*</span>
          {nbpMidRate > 0 && (
            <Tooltip content={`Kurs z Alior Kantor — tyle PLN dostaniesz sprzedając dolary. Podatek Belki po kursie NBP (${fmtNum(nbpMidRate)} PLN/USD).`} />
          )}
        </label>
        <input
          id="fx-rate"
          name="fxRate"
          autoComplete="off"
          type="number"
          min={0}
          step={0.0001}
          value={currentFxRate || ''}
          onChange={(e) => onFxRateChange(Number(e.target.value))}
          placeholder="np. 4.1500"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/30"
        />
      </div>

      {/* Benchmark selector */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-text-secondary">Porównaj z:</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onBenchmarkTypeChange('savings')}
            className={`flex-1 px-3 py-2 text-sm rounded-lg border-2 font-medium transition-colors ${
              benchmarkType === 'savings'
                ? 'border-accent-interactive bg-accent-interactive text-text-on-accent'
                : 'border-border bg-bg-card text-text-muted hover:border-accent-primary/50 hover:text-accent-primary'
            }`}
          >
            Konto oszczędnościowe
          </button>
          <button
            type="button"
            onClick={() => onBenchmarkTypeChange('bonds')}
            className={`flex-1 px-3 py-2 text-sm rounded-lg border-2 font-medium transition-colors ${
              benchmarkType === 'bonds'
                ? 'border-accent-interactive bg-accent-interactive text-text-on-accent'
                : 'border-border bg-bg-card text-text-muted hover:border-accent-primary/50 hover:text-accent-primary'
            }`}
          >
            Obligacje skarbowe
          </button>
          <button
            type="button"
            onClick={() => onBenchmarkTypeChange('etf')}
            className={`flex-1 px-3 py-2 text-sm rounded-lg border-2 font-medium transition-colors ${
              benchmarkType === 'etf'
                ? 'border-accent-interactive bg-accent-interactive text-text-on-accent'
                : 'border-border bg-bg-card text-text-muted hover:border-accent-primary/50 hover:text-accent-primary'
            }`}
          >
            ETF
          </button>
        </div>
      </div>

      {benchmarkType === 'savings' ? (
        /* Savings account rate */
        <div className="space-y-1">
          <label htmlFor="savings-rate" className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
            Oprocentowanie konta oszczędnościowego <span className="text-danger">*</span>
            <span className="text-xs font-normal text-text-muted">(% rocznie)</span>
            <Tooltip
              content={
                <span className="space-y-1 block">
                  {monthlyRate !== null && (
                    <span className="block">{'\u2248'} {monthlyRate.toFixed(3)}% miesięcznie (mnożnik {'\u00d7'}{(monthlyRate / 100 + 1).toFixed(5)}). Założono kapitalizację miesięczną.</span>
                  )}
                  {effectiveSavingsRate > 0 && wibor3m > 0 && Math.abs(effectiveSavingsRate - wibor3m) > 0.05 ? (
                    <span className="block">Konta oszczędnościowe śledzą stopy NBP. Kalkulator zakłada stopniowy spadek z {wibor3m.toFixed(2)}% do ok. 3,0% w ciągu {Math.round(horizonMonths / 12 * 10) / 10} {horizonMonths >= 24 ? 'lat' : 'roku'}. Efektywna stopa: {effectiveSavingsRate.toFixed(2)}%.</span>
                  ) : (
                    <span className="block">Podaj wartość rocznego oprocentowania z regulaminu banku.</span>
                  )}
                </span>
              }
              width="w-72"
            />
          </label>
          <input
            id="savings-rate"
            name="savingsRate"
            autoComplete="off"
            type="number"
            min={0}
            max={50}
            step={0.01}
            value={wiborStr}
            onChange={(e) => handleWiborChange(e.target.value)}
            placeholder="np. 5.82"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/30"
          />
          {!monthlyRate && (
            <p className="text-xs text-text-muted">
              Podaj oprocentowanie z regulaminu banku w skali roku.
            </p>
          )}
          {inflationRate > 0 && wibor3m > 0 && inflationRate >= wibor3m && (
            <p className="text-xs text-danger font-medium">
              ⚠ Oprocentowanie ({wibor3m.toFixed(2)}%) niższe od inflacji — realna stopa ujemna.
            </p>
          )}
        </div>
      ) : benchmarkType === 'etf' ? (
        <EtfBenchmarkSection
          localEtfTicker={localEtfTicker}
          onLocalEtfTickerChange={setLocalEtfTicker}
          etfLoading={etfLoading}
          etfError={etfError}
          etfName={etfName}
          etfAnnualReturnPercent={etfAnnualReturnPercent}
          etfTerPercent={etfTerPercent}
          onEtfAnnualReturnChange={onEtfAnnualReturnChange}
          onEtfTerChange={onEtfTerChange}
          onEtfTickerChange={onEtfTickerChange}
          onFetchEtf={onFetchEtf}
        />
      ) : (
        <BondBenchmarkSection
          selectedBondId={selectedBondId}
          bondPresets={bondPresets}
          bondPresetsLoading={bondPresetsLoading}
          bondSettings={bondSettings}
          bondEffectiveRate={bondEffectiveRate}
          horizonMonths={horizonMonths}
          inflationRate={inflationRate}
          inflationData={inflationData}
          inflationLoading={inflationLoading}
          nbpRefRate={nbpRefRate}
          onSelectPreset={handleSelectBondPreset}
          onBondSettingsChange={onBondSettingsChange}
          onInflationRateChange={onInflationRateChange}
          onNbpRefRateChange={onNbpRefRateChange}
        />
      )}

      {/* Horizon Slider */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-text-secondary">
          Horyzont czasowy:{' '}
          <span className="text-accent-primary font-semibold">
            {horizonMonths <= 11
              ? `${horizonMonths} ${horizonMonths === 1 ? 'miesiąc' : horizonMonths < 5 ? 'miesiące' : 'miesięcy'}`
              : horizonMonths % 12 === 0
                ? `${horizonMonths / 12} ${horizonMonths / 12 === 1 ? 'rok' : horizonMonths / 12 < 5 ? 'lata' : 'lat'}`
                : `${Math.floor(horizonMonths / 12)} l. ${horizonMonths % 12} mies.`}
          </span>
        </label>
        <input
          type="range"
          min={1}
          max={benchmarkType === 'savings' ? 60 : 144}
          step={1}
          value={horizonMonths}
          onChange={(e) => onHorizonChange(Number(e.target.value))}
          className="w-full"
        />
        {(() => {
          const sliderMin = 1;
          const sliderMax = benchmarkType === 'savings' ? 60 : 144;
          const ticks = benchmarkType === 'savings'
            ? [
                { label: '1m',  months: 1 },
                { label: '6m',  months: 6 },
                { label: '1r',  months: 12 },
                { label: '2r',  months: 24 },
                { label: '3r',  months: 36 },
                { label: '5r',  months: 60 },
              ]
            : [
                { label: '1m',  months: 1 },
                { label: '1r',  months: 12 },
                { label: '2r',  months: 24 },
                { label: '3r',  months: 36 },
                { label: '5r',  months: 60 },
                { label: '10r', months: 120 },
                { label: '12r', months: 144 },
              ];
          return (
            <div className="relative h-4">
              {ticks.map(({ label, months }, i) => {
                const pct = ((months - sliderMin) / (sliderMax - sliderMin)) * 100;
                const isFirst = i === 0;
                const isLast = i === ticks.length - 1;
                return (
                  <span
                    key={label}
                    className="absolute text-xs text-text-muted"
                    style={{
                      left: `${pct}%`,
                      transform: isFirst ? 'none' : isLast ? 'translateX(-100%)' : 'translateX(-50%)',
                    }}
                  >
                    {label}
                  </span>
                );
              })}
            </div>
          );
        })()}
      </div>
          </div>
        </div>
      </div>
    </div>
  );
}
