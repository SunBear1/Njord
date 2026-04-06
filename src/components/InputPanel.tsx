import { useState, useEffect } from 'react';
import { Search, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { AssetData } from '../types/asset';
import type { FxData } from '../providers/nbpProvider';
import { fmtUSD, fmtNum } from '../utils/formatting';
import { DEFAULT_WIBOR_3M, DEFAULT_HORIZON_MONTHS } from '../utils/assetConfig';

interface InputPanelProps {
  onFetchAsset: (ticker: string) => void;
  assetData: AssetData | null;
  assetLoading: boolean;
  assetError: string | null;
  fxData: FxData | null;
  fxLoading: boolean;
  // Controlled values
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

  useEffect(() => {
    setLocalTicker(ticker);
  }, [ticker]);

  const handleFetch = () => {
    if (localTicker.trim()) {
      onTickerChange(localTicker.trim().toUpperCase());
      onFetchAsset(localTicker.trim().toUpperCase());
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-5">
      <h2 className="text-lg font-semibold text-gray-800">📊 Dane wejściowe</h2>

      {/* Ticker */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Ticker giełdowy</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={localTicker}
            onChange={(e) => setLocalTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
            placeholder="np. AAPL, NVDA, VOO"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleFetch}
            disabled={assetLoading || !localTicker.trim()}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {assetLoading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            Pobierz
          </button>
        </div>

        {assetError && (
          <p className="flex items-center gap-1.5 text-xs text-red-600 mt-1">
            <AlertCircle size={13} />
            {assetError} — możesz wpisać dane ręcznie poniżej.
          </p>
        )}
        {assetData && (
          <p className="flex items-center gap-1.5 text-xs text-green-600 mt-1">
            <CheckCircle2 size={13} />
            {assetData.asset.name} ({assetData.asset.currency}) — {fmtUSD(assetData.asset.currentPrice)}
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
          <p className="text-xs text-gray-500">
            NBP: {fmtNum(fxData.currentRate)} PLN/USD
          </p>
        )}
      </div>

      {/* WIBOR 3M */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">
          Oprocentowanie konta oszczędnościowego (%)
        </label>
        <input
          type="number"
          min={0}
          max={50}
          step={0.01}
          value={wibor3m}
          onChange={(e) => onWiborChange(Number(e.target.value))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-500">
          Domyślna wartość oparta na WIBOR 3M ({DEFAULT_WIBOR_3M}%). Sprawdź aktualną wartość.
        </p>
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
          <span>1 mies.</span>
          <span>6 mies.</span>
          <span>12 mies.</span>
          <span>18 mies.</span>
          <span>24 mies.</span>
        </div>
      </div>

      <div className="text-xs text-gray-400 pt-1 border-t border-gray-100">
        Domyślna wartość horyzontu: {DEFAULT_HORIZON_MONTHS} miesięcy
      </div>
    </div>
  );
}
