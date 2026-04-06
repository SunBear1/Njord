import { useState, useEffect, useRef } from 'react';
import { Loader2, AlertCircle, CheckCircle2, RefreshCw, Calculator } from 'lucide-react';
import type { AssetData } from '../types/asset';
import type { FxData } from '../providers/nbpProvider';
import type { BenchmarkType, BondPreset } from '../types/scenario';
import { fmtUSD, fmtNum } from '../utils/formatting';

const BOND_PRESETS: BondPreset[] = [
  { id: 'OTS', name: 'OTS (3-miesięczne)', maturityMonths: 3, annualRate: 5.75, earlyRedemptionPenalty: 0, description: 'Stała stopa, 3 miesiące' },
  { id: 'DOS', name: 'DOS (2-letnie)', maturityMonths: 24, annualRate: 5.50, earlyRedemptionPenalty: 0.7, description: 'Stała stopa, 2 lata' },
  { id: 'TOZ', name: 'TOZ (3-letnie)', maturityMonths: 36, annualRate: 5.80, earlyRedemptionPenalty: 0.7, description: 'Zmiennoprocentowe (WIBOR 6M), 3 lata' },
  { id: 'COI', name: 'COI (4-letnie)', maturityMonths: 48, annualRate: 6.55, earlyRedemptionPenalty: 0.7, description: 'Indeksowane inflacją, 4 lata' },
  { id: 'EDO', name: 'EDO (10-letnie)', maturityMonths: 120, annualRate: 6.80, earlyRedemptionPenalty: 2.0, description: 'Indeksowane inflacją, 10 lat' },
];

interface InputPanelProps {
  onFetchAsset: (ticker: string) => void;
  assetData: AssetData | null;
  assetLoading: boolean;
  assetError: string | null;
  fxData: FxData | null;
  fxLoading: boolean;
  ticker: string;
  shares: number;
  currentPriceUSD: number;
  currentFxRate: number;
  wibor3m: number;
  horizonMonths: number;
  benchmarkType: BenchmarkType;
  bondRate: number;
  bondPenalty: number;
  onTickerChange: (v: string) => void;
  onSharesChange: (v: number) => void;
  onPriceChange: (v: number) => void;
  onFxRateChange: (v: number) => void;
  onWiborChange: (v: number) => void;
  onHorizonChange: (v: number) => void;
  onBenchmarkTypeChange: (v: BenchmarkType) => void;
  onBondRateChange: (v: number) => void;
  onBondPenaltyChange: (v: number) => void;
}

export function InputPanel({
  onFetchAsset,
  assetData,
  assetLoading,
  assetError,
  fxData,
  fxLoading,
  ticker,
  shares,
  currentPriceUSD,
  currentFxRate,
  wibor3m,
  horizonMonths,
  benchmarkType,
  bondRate,
  bondPenalty,
  onTickerChange,
  onSharesChange,
  onPriceChange,
  onFxRateChange,
  onWiborChange,
  onHorizonChange,
  onBenchmarkTypeChange,
  onBondRateChange,
  onBondPenaltyChange,
}: InputPanelProps) {
  const [localTicker, setLocalTicker] = useState(ticker);
  const [wiborStr, setWiborStr] = useState(wibor3m > 0 ? String(wibor3m) : '');
  const [showValueCalc, setShowValueCalc] = useState(false);
  const [totalValueStr, setTotalValueStr] = useState('');
  const [selectedBondId, setSelectedBondId] = useState(BOND_PRESETS[0].id);
  const [bondRateStr, setBondRateStr] = useState(bondRate > 0 ? String(bondRate) : String(BOND_PRESETS[0].annualRate));
  const [bondPenaltyStr, setBondPenaltyStr] = useState(String(bondPenalty));
  const isFirstRender = useRef(true);

  // Auto-fetch with 800ms debounce, minimum 1 character
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

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-5">
      <h2 className="text-lg font-semibold text-gray-800">Dane wejściowe</h2>

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
            disabled={assetLoading || !localTicker.trim()}
            title="Odśwież dane"
            className="p-2 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            <RefreshCw size={15} />
          </button>
        </div>
        <p className="text-xs text-gray-400">Dane pobierają się automatycznie po wpisaniu tickera.</p>

        {assetError && (
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
          {assetData && <span className="ml-1 text-xs text-gray-400">· auto z Yahoo Finance</span>}
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
        /* Bonds */
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Typ obligacji</label>
            <select
              value={selectedBondId}
              onChange={(e) => {
                setSelectedBondId(e.target.value);
                const preset = BOND_PRESETS.find((b) => b.id === e.target.value);
                if (preset) {
                  onBondRateChange(preset.annualRate);
                  onBondPenaltyChange(
                    horizonMonths < preset.maturityMonths ? preset.earlyRedemptionPenalty : 0,
                  );
                  setBondRateStr(String(preset.annualRate));
                  setBondPenaltyStr(
                    horizonMonths < preset.maturityMonths ? String(preset.earlyRedemptionPenalty) : '0',
                  );
                }
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {BOND_PRESETS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} — {b.annualRate}% · {b.description}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Oprocentowanie
                <span className="ml-1 text-xs font-normal text-gray-500">(% rocznie)</span>
              </label>
              <input
                type="number"
                min={0}
                max={50}
                step={0.01}
                value={bondRateStr}
                onChange={(e) => {
                  setBondRateStr(e.target.value);
                  onBondRateChange(parseFloat(e.target.value) || 0);
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
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
          </div>

          {(() => {
            const preset = BOND_PRESETS.find((b) => b.id === selectedBondId);
            if (!preset) return null;
            const earlyExit = horizonMonths < preset.maturityMonths;
            return (
              <div className={`text-xs rounded-lg p-2.5 ${earlyExit ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                {earlyExit
                  ? `Horyzont (${horizonMonths} mies.) < zapadalność ${preset.name} (${preset.maturityMonths} mies.) — kara za wcześniejszy wykup: ${preset.earlyRedemptionPenalty}% kapitału.`
                  : `Horyzont pokrywa okres zapadalności obligacji — brak kary za wykup.`}
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
