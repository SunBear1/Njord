import { useState, useEffect, useRef } from 'react';
import { Loader2, AlertCircle, CheckCircle2, RefreshCw, Calculator, Info } from 'lucide-react';
import type { AssetData } from '../types/asset';
import type { FxData } from '../providers/nbpProvider';
import type { InflationData } from '../hooks/useInflationData';
import type { BenchmarkType, BondPreset, BondRateType } from '../types/scenario';
import { fmtUSD, fmtNum } from '../utils/formatting';

const BOND_PRESETS: BondPreset[] = [
  { id: 'OTS', name: 'OTS (3-mies.)',     maturityMonths: 3,   rateType: 'fixed',     firstYearRate: 2.00, margin: 0,    earlyRedemptionPenalty: 0,    description: 'Stałoprocentowe, 3 miesiące' },
  { id: 'ROR', name: 'ROR (roczne)',       maturityMonths: 12,  rateType: 'reference', firstYearRate: 4.00, margin: 0,    earlyRedemptionPenalty: 0.50, description: 'Zmiennoprocentowe, stopa ref. NBP' },
  { id: 'DOR', name: 'DOR (2-letnie)',     maturityMonths: 24,  rateType: 'reference', firstYearRate: 4.15, margin: 0.15, earlyRedemptionPenalty: 0.70, description: 'Zmiennoprocentowe, stopa ref. NBP + 0,15%' },
  { id: 'TOS', name: 'TOS (3-letnie)',     maturityMonths: 36,  rateType: 'fixed',     firstYearRate: 4.40, margin: 0,    earlyRedemptionPenalty: 0.70, description: 'Stałoprocentowe, 3 lata' },
  { id: 'COI', name: 'COI (4-letnie)',     maturityMonths: 48,  rateType: 'inflation', firstYearRate: 4.75, margin: 1.50, earlyRedemptionPenalty: 0.70, description: 'Inflacja + 1,50% marży' },
  { id: 'EDO', name: 'EDO (10-letnie)',    maturityMonths: 120, rateType: 'inflation', firstYearRate: 5.35, margin: 2.00, earlyRedemptionPenalty: 2.00, description: 'Inflacja + 2,00% marży' },
  { id: 'ROS', name: 'ROS (6-letnie)',     maturityMonths: 72,  rateType: 'inflation', firstYearRate: 5.00, margin: 2.00, earlyRedemptionPenalty: 2.00, description: 'Rodzinne, inflacja + 2,00%', isFamily: true },
  { id: 'ROD', name: 'ROD (12-letnie)',    maturityMonths: 144, rateType: 'inflation', firstYearRate: 5.60, margin: 2.50, earlyRedemptionPenalty: 2.00, description: 'Rodzinne, inflacja + 2,50%', isFamily: true },
];

interface InputPanelProps {
  onFetchAsset: (ticker: string) => void;
  assetData: AssetData | null;
  assetLoading: boolean;
  assetError: string | null;
  fxData: FxData | null;
  fxLoading: boolean;
  ticker: string;
  apiKey: string;
  shares: number;
  currentPriceUSD: number;
  currentFxRate: number;
  wibor3m: number;
  horizonMonths: number;
  benchmarkType: BenchmarkType;
  bondFirstYearRate: number;
  bondEffectiveRate: number;
  bondPenalty: number;
  bondRateType: BondRateType;
  bondMargin: number;
  inflationRate: number;
  inflationData: InflationData | null;
  inflationLoading: boolean;
  nbpRefRate: number;
  onTickerChange: (v: string) => void;
  onApiKeyChange: (v: string) => void;
  onSharesChange: (v: number) => void;
  onPriceChange: (v: number) => void;
  onFxRateChange: (v: number) => void;
  onWiborChange: (v: number) => void;
  onHorizonChange: (v: number) => void;
  onBenchmarkTypeChange: (v: BenchmarkType) => void;
  onBondFirstYearRateChange: (v: number) => void;
  onBondPenaltyChange: (v: number) => void;
  onBondRateTypeChange: (v: BondRateType) => void;
  onBondMarginChange: (v: number) => void;
  onInflationRateChange: (v: number) => void;
  onNbpRefRateChange: (v: number) => void;
}

export function InputPanel({
  onFetchAsset,
  assetData,
  assetLoading,
  assetError,
  fxData,
  fxLoading,
  ticker,
  apiKey,
  shares,
  currentPriceUSD,
  currentFxRate,
  wibor3m,
  horizonMonths,
  benchmarkType,
  bondFirstYearRate,
  bondEffectiveRate,
  bondPenalty,
  bondMargin,
  inflationRate,
  inflationData,
  inflationLoading,
  nbpRefRate,
  onTickerChange,
  onApiKeyChange,
  onSharesChange,
  onPriceChange,
  onFxRateChange,
  onWiborChange,
  onHorizonChange,
  onBenchmarkTypeChange,
  onBondFirstYearRateChange,
  onBondPenaltyChange,
  onBondRateTypeChange,
  onBondMarginChange,
  onInflationRateChange,
  onNbpRefRateChange,
}: InputPanelProps) {
  const [localTicker, setLocalTicker] = useState(ticker);
  const [wiborStr, setWiborStr] = useState(wibor3m > 0 ? String(wibor3m) : '');
  const [showValueCalc, setShowValueCalc] = useState(false);
  const [totalValueStr, setTotalValueStr] = useState('');
  const [selectedBondId, setSelectedBondId] = useState(BOND_PRESETS[0].id);
  const [bondPenaltyStr, setBondPenaltyStr] = useState(String(bondPenalty));
  const isFirstRender = useRef(true);
  const rateLimited = assetError === 'RATE_LIMIT';

  // Apply bond preset
  const applyBondPreset = (preset: BondPreset) => {
    onBondFirstYearRateChange(preset.firstYearRate);
    onBondRateTypeChange(preset.rateType);
    onBondMarginChange(preset.margin);
    const earlyExit = horizonMonths < preset.maturityMonths;
    const penalty = earlyExit ? preset.earlyRedemptionPenalty : 0;
    onBondPenaltyChange(penalty);
    setBondPenaltyStr(String(penalty));
  };

  // Auto-fetch with 800ms debounce, requires ticker + API key
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const trimmed = localTicker.trim().toUpperCase();
    if (trimmed.length < 1 || !apiKey.trim()) return;
    const timer = setTimeout(() => {
      onTickerChange(trimmed);
      onFetchAsset(trimmed);
    }, 800);
    return () => clearTimeout(timer);
  }, [localTicker, apiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleManualRefetch = () => {
    const trimmed = localTicker.trim().toUpperCase();
    if (trimmed && apiKey.trim()) {
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

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-5">
      <h2 className="text-lg font-semibold text-gray-800">Dane wejściowe</h2>

      {/* Rate limit banner — only shown when API rate limit hit */}
      {rateLimited && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
          <p className="text-sm font-medium text-amber-800">
            Limit zapytań API wyczerpany (maks. 8 na minutę).
          </p>
          <p className="text-xs text-amber-700">
            Poczekaj minutę i spróbuj ponownie, lub podaj własny darmowy klucz API z{' '}
            <a
              href="https://twelvedata.com/pricing"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-800"
            >
              twelvedata.com/pricing
            </a>{' '}
            (800 zapytań/dzień, 8/min):
          </p>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value.trim())}
            placeholder="Wklej swój klucz API…"
            className="w-full border border-amber-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono bg-white"
          />
        </div>
      )}

      {/* Ticker — auto-fetch */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Ticker giełdowy</label>
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <input
              type="text"
              value={localTicker}
              onChange={(e) => setLocalTicker(e.target.value.toUpperCase())}
              placeholder="np. AAPL, NVDA, VOO"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-9"
            />
            {assetLoading && (
              <Loader2 size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-blue-500" />
            )}
          </div>
          <button
            onClick={handleManualRefetch}
            disabled={assetLoading || !localTicker.trim() || !apiKey.trim()}
            title="Odśwież dane"
            className="p-2 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            <RefreshCw size={15} />
          </button>
        </div>
        <p className="text-xs text-gray-400">Dane pobierają się automatycznie po wpisaniu tickera.</p>

        {assetError && !rateLimited && (
          <p className="flex items-start gap-1.5 text-xs text-red-600 mt-1">
            <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
            {assetError}
          </p>
        )}
        {assetData && !assetLoading && (
          <p className="flex items-center gap-1.5 text-xs text-green-600 mt-1">
            <CheckCircle2 size={13} />
            {assetData.asset.name} ({assetData.asset.currency}) · {fmtUSD(assetData.asset.currentPrice)}
          </p>
        )}
      </div>

      {/* Shares */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Liczba akcji</label>
        <input
          type="number"
          min={0}
          step={1}
          value={shares || ''}
          onChange={(e) => onSharesChange(Number(e.target.value))}
          placeholder="np. 50"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={() => setShowValueCalc((v) => !v)}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
        >
          <Calculator size={12} />
          {showValueCalc ? 'Ukryj kalkulator' : 'Nie wiesz ile masz akcji, ale znasz wartość?'}
        </button>
        {showValueCalc && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-2">
            <p className="text-xs text-blue-700">
              Wpisz całkowitą wartość portfela w USD — obliczymy liczbę akcji.
            </p>
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-blue-600">Wartość portfela (USD)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={totalValueStr}
                  onChange={(e) => setTotalValueStr(e.target.value)}
                  placeholder="np. 5000.00"
                  className="w-full border border-blue-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
                className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                Przelicz
              </button>
            </div>
            {currentPriceUSD > 0 && totalValueStr && parseFloat(totalValueStr) > 0 && (
              <p className="text-xs text-blue-600">
                {fmtUSD(parseFloat(totalValueStr))} ÷ {fmtUSD(currentPriceUSD)} ≈{' '}
                <strong>{Math.floor(parseFloat(totalValueStr) / currentPriceUSD)} akcji</strong>
                {' '}(zaokrąglone w dół)
              </p>
            )}
            {!currentPriceUSD && (
              <p className="text-xs text-amber-600">
                Najpierw wpisz ticker, aby pobrać cenę akcji.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Price USD */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">
          Aktualna cena akcji (USD)
          {assetData && <span className="ml-1 text-xs text-gray-400">· auto z Twelve Data</span>}
        </label>
        <input
          type="number"
          min={0}
          step={0.01}
          value={currentPriceUSD || ''}
          onChange={(e) => onPriceChange(Number(e.target.value))}
          placeholder="np. 185.00"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* FX Rate */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">
          Kurs USD/PLN
          {fxData && !fxLoading && <span className="ml-1 text-xs text-gray-400">· auto z NBP</span>}
          {fxLoading && <span className="ml-1 text-xs text-gray-400">· ładowanie NBP…</span>}
        </label>
        <input
          type="number"
          min={0}
          step={0.0001}
          value={currentFxRate || ''}
          onChange={(e) => onFxRateChange(Number(e.target.value))}
          placeholder="np. 4.1500"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {fxData && (
          <p className="text-xs text-gray-500">NBP: {fmtNum(fxData.currentRate)} PLN/USD</p>
        )}
      </div>

      {/* Benchmark selector */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-gray-700">Porównaj z:</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onBenchmarkTypeChange('savings')}
            className={`flex-1 px-3 py-2 text-sm rounded-lg border-2 font-medium transition-colors ${
              benchmarkType === 'savings'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            Konto oszczędnościowe
          </button>
          <button
            type="button"
            onClick={() => onBenchmarkTypeChange('bonds')}
            className={`flex-1 px-3 py-2 text-sm rounded-lg border-2 font-medium transition-colors ${
              benchmarkType === 'bonds'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            Obligacje skarbowe
          </button>
        </div>
      </div>

      {benchmarkType === 'savings' ? (
        /* WIBOR 3M — savings */
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">
            Oprocentowanie konta oszczędnościowego
            <span className="ml-1 text-xs font-normal text-gray-500">(% w skali roku)</span>
          </label>
          <input
            type="number"
            min={0}
            max={50}
            step={0.01}
            value={wiborStr}
            onChange={(e) => handleWiborChange(e.target.value)}
            placeholder="np. 5.82"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {monthlyRate !== null && (
            <p className="text-xs text-blue-600">
              ≈ {monthlyRate.toFixed(3)}% miesięcznie ({(monthlyRate / 100 + 1).toFixed(5)}× co miesiąc)
            </p>
          )}
          {!monthlyRate && (
            <p className="text-xs text-gray-400">
              Sprawdź aktualny WIBOR 3M — podaj oprocentowanie swojego konta w skali roku.
            </p>
          )}
        </div>
      ) : (
        /* Bonds — all 8 types */
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Typ obligacji</label>
            <select
              value={selectedBondId}
              onChange={(e) => {
                setSelectedBondId(e.target.value);
                const preset = BOND_PRESETS.find((b) => b.id === e.target.value);
                if (preset) applyBondPreset(preset);
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {BOND_PRESETS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} — {b.description}{b.isFamily ? ' (800+)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Bond rate details */}
          {(() => {
            const preset = BOND_PRESETS.find((b) => b.id === selectedBondId);
            if (!preset) return null;
            const earlyExit = horizonMonths < preset.maturityMonths;

            return (
              <div className="space-y-3">
                {/* Family bonds hint */}
                {preset.isFamily && (
                  <div className="flex items-start gap-1.5 bg-purple-50 border border-purple-200 text-purple-800 text-xs rounded-lg p-2.5">
                    <Info size={13} className="mt-0.5 flex-shrink-0" />
                    Obligacje rodzinne — dostępne tylko dla beneficjentów programu 800+.
                  </div>
                )}

                {/* Rate info card */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Oprocentowanie 1. roku:</span>
                    <span className="font-semibold text-gray-900">{bondFirstYearRate.toFixed(2)}%</span>
                  </div>

                  {preset.rateType === 'inflation' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Marża:</span>
                        <span className="font-medium">{bondMargin.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">
                          Inflacja (HICP)
                          {inflationData && (
                            <span className="ml-1 text-gray-400">· {inflationData.period}</span>
                          )}
                          {inflationLoading && (
                            <span className="ml-1 text-gray-400">· ładowanie…</span>
                          )}
                          :
                        </span>
                        <input
                          type="number"
                          min={-5}
                          max={30}
                          step={0.1}
                          value={inflationRate || ''}
                          onChange={(e) => onInflationRateChange(parseFloat(e.target.value) || 0)}
                          className="w-20 border border-gray-300 rounded px-2 py-0.5 text-right text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex justify-between border-t border-gray-200 pt-1.5">
                        <span className="text-gray-600 font-medium">Stopa efektywna (od 2. roku):</span>
                        <span className="font-bold text-blue-700">{bondEffectiveRate.toFixed(2)}%</span>
                      </div>
                    </>
                  )}

                  {preset.rateType === 'reference' && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Marża:</span>
                        <span className="font-medium">{bondMargin.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Stopa referencyjna NBP:</span>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          step={0.25}
                          value={nbpRefRate || ''}
                          onChange={(e) => onNbpRefRateChange(parseFloat(e.target.value) || 0)}
                          placeholder="np. 5.75"
                          className="w-20 border border-gray-300 rounded px-2 py-0.5 text-right text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex justify-between border-t border-gray-200 pt-1.5">
                        <span className="text-gray-600 font-medium">Stopa efektywna (od 2. okresu):</span>
                        <span className="font-bold text-blue-700">{bondEffectiveRate.toFixed(2)}%</span>
                      </div>
                    </>
                  )}

                  {preset.rateType === 'fixed' && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Typ:</span>
                      <span className="font-medium">Stała stopa przez cały okres</span>
                    </div>
                  )}
                </div>

                {/* Penalty */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">
                      Kara za wcz. wykup
                      <span className="ml-1 text-xs font-normal text-gray-500">(% kapitału)</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.01}
                      value={bondPenaltyStr}
                      onChange={(e) => {
                        setBondPenaltyStr(e.target.value);
                        onBondPenaltyChange(parseFloat(e.target.value) || 0);
                      }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">
                      Zapadalność
                    </label>
                    <div className="px-3 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg">
                      {preset.maturityMonths} mies.
                    </div>
                  </div>
                </div>

                {/* Early exit warning */}
                <div className={`text-xs rounded-lg p-2.5 ${earlyExit ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                  {earlyExit
                    ? `Horyzont (${horizonMonths} mies.) < zapadalność ${preset.name} (${preset.maturityMonths} mies.) — kara za wcześniejszy wykup: ${preset.earlyRedemptionPenalty}% kapitału.`
                    : `Horyzont pokrywa okres zapadalności obligacji — brak kary za wykup.`}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Horizon Slider */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          Horyzont czasowy:{' '}
          <span className="text-blue-600 font-semibold">
            {horizonMonths} {horizonMonths === 1 ? 'miesiąc' : horizonMonths < 5 ? 'miesiące' : 'miesięcy'}
          </span>
        </label>
        <input
          type="range"
          min={1}
          max={24}
          step={1}
          value={horizonMonths}
          onChange={(e) => onHorizonChange(Number(e.target.value))}
          className="w-full accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>1</span>
          <span>6</span>
          <span>12</span>
          <span>18</span>
          <span>24 mies.</span>
        </div>
      </div>
    </div>
  );
}
