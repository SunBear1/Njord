import { useState, useEffect, useRef } from 'react';
import { Loader2, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import type { AssetData } from '../types/asset';
import type { FxData } from '../providers/nbpProvider';
import { fmtUSD, fmtNum } from '../utils/formatting';

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
  onTickerChange: (v: string) => void;
  onSharesChange: (v: number) => void;
  onPriceChange: (v: number) => void;
  onFxRateChange: (v: number) => void;
  onWiborChange: (v: number) => void;
  onHorizonChange: (v: number) => void;
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
  onTickerChange,
  onSharesChange,
  onPriceChange,
  onFxRateChange,
  onWiborChange,
  onHorizonChange,
}: InputPanelProps) {
  const [localTicker, setLocalTicker] = useState(ticker);
  const [wiborStr, setWiborStr] = useState(wibor3m > 0 ? String(wibor3m) : '');
  const isFirstRender = useRef(true);

  // Auto-fetch with 800ms debounce
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const trimmed = localTicker.trim().toUpperCase();
    if (!trimmed) return;
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
      <h2 className="text-lg font-semibold text-gray-800">📊 Dane wejściowe</h2>

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

      {/* WIBOR 3M */}
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
