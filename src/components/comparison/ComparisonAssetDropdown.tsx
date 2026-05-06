import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, Loader2, RefreshCw } from 'lucide-react';
import type { AssetData } from '../../types/asset';
import { fmtNum, fmtUSD } from '../../utils/formatting';
import { Tooltip } from '../Tooltip';
import { ComparisonInputDropdown } from './ComparisonInputDropdown';

type PositionMode = 'shares' | 'value';

interface ComparisonAssetDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
  onFetchAsset: (ticker: string) => void;
  assetData: AssetData | null;
  assetLoading: boolean;
  assetError: string | null;
  ticker: string;
  shares: number;
  currentPriceUSD: number;
  currentFxRate: number;
  aliorRate: number | null;
  nbpMidRate: number | null;
  avgCostUSD: number;
  isRSU: boolean;
  onTickerChange: (value: string) => void;
  onSharesChange: (value: number) => void;
  onAvgCostUSDChange: (value: number) => void;
  onIsRSUChange: (value: boolean) => void;
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
}

function formatShares(value: number): string {
  return new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 4 }).format(value);
}

function parseDecimal(raw: string): number {
  const normalized = raw.replace(',', '.').replace(/\s+/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundShares(value: number): number {
  return Number.parseFloat(value.toFixed(4));
}

export function ComparisonAssetDropdown({
  isOpen,
  onToggle,
  onFetchAsset,
  assetData,
  assetLoading,
  assetError,
  ticker,
  shares,
  currentPriceUSD,
  currentFxRate,
  aliorRate,
  nbpMidRate,
  avgCostUSD,
  isRSU,
  onTickerChange,
  onSharesChange,
  onAvgCostUSDChange,
  onIsRSUChange,
}: ComparisonAssetDropdownProps) {
  const [positionMode, setPositionMode] = useState<PositionMode>('shares');
  const [valueInput, setValueInput] = useState('');
  const isFirstRender = useRef(true);

  const setRoundedShares = useCallback((value: number) => {
    onSharesChange(roundShares(value));
  }, [onSharesChange]);

  useEffect(() => {
    if (positionMode !== 'value') return;
    const parsedValue = parseDecimal(valueInput);
    if (parsedValue > 0 && currentPriceUSD > 0) {
      setRoundedShares(parsedValue / currentPriceUSD);
    }
  }, [currentPriceUSD, positionMode, setRoundedShares, valueInput]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const trimmedTicker = ticker.trim().toUpperCase();
    if (!trimmedTicker) return;

    const timer = window.setTimeout(() => {
      onTickerChange(trimmedTicker);
      onFetchAsset(trimmedTicker);
    }, 800);

    return () => window.clearTimeout(timer);
  }, [onFetchAsset, onTickerChange, ticker]);

  const positionValueUSD = shares > 0 && currentPriceUSD > 0 ? shares * currentPriceUSD : 0;
  const estimatedShares = currentPriceUSD > 0 ? parseDecimal(valueInput) / currentPriceUSD : 0;
  const hasSavedInput = Boolean(ticker) || shares > 0 || avgCostUSD > 0 || isRSU;
  const isComplete = Boolean(ticker.trim()) && shares > 0 && currentPriceUSD > 0 && currentFxRate > 0 && (avgCostUSD > 0 || isRSU);

  const summary = useMemo(() => {
    if (!hasSavedInput) {
      return 'Wybierz ticker, wielkość pozycji i cenę zakupu.';
    }

    const parts = [
      ticker || 'Bez tickera',
      shares > 0 ? `${formatShares(shares)} akcji` : 'Bez liczby akcji',
    ];

    if (currentPriceUSD > 0) {
      parts.push(fmtUSD(currentPriceUSD));
    }

    if (positionValueUSD > 0) {
      parts.push(`pozycja ${fmtUSD(positionValueUSD)}`);
    }

    return parts.join(' · ');
  }, [currentPriceUSD, hasSavedInput, positionValueUSD, shares, ticker]);

  const detail = hasSavedInput
    ? `Kurs sprzedaży USD ${currentFxRate > 0 ? fmtNum(currentFxRate) : '—'} PLN/USD${isRSU ? ' · RSU aktywne' : ''}`
    : 'Po zapisaniu zobaczysz tutaj skrót pozycji bez rozwijania formularza.';

  return (
    <ComparisonInputDropdown
      title="Twój portfel akcji"
      summary={summary}
      detail={detail}
      isOpen={isOpen}
      isComplete={isComplete}
      onToggle={onToggle}
      onDone={onToggle}
      wrapped
    >
      <div className="space-y-5">
        <div className="space-y-1">
          <label htmlFor="comparison-ticker" className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
            Ticker
            <Tooltip content="Wpisz ticker spółki. Dane rynkowe pobierzemy automatycznie po krótkiej chwili." />
          </label>
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <input
                id="comparison-ticker"
                type="text"
                value={ticker}
                onChange={(event) => onTickerChange(event.target.value.toUpperCase())}
                placeholder="np. AAPL"
                autoComplete="off"
                className="w-full border border-border rounded-lg bg-bg-card px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/30 pr-9"
              />
              {assetLoading && (
                <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin motion-reduce:animate-none text-accent-primary" aria-hidden="true" />
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                const trimmedTicker = ticker.trim().toUpperCase();
                if (!trimmedTicker) return;
                onTickerChange(trimmedTicker);
                onFetchAsset(trimmedTicker);
              }}
              disabled={assetLoading || !ticker.trim()}
              aria-label="Odśwież dane giełdowe"
              className="p-2 rounded-lg border border-border text-text-muted hover:bg-bg-muted disabled:opacity-40 transition-colors"
            >
              <RefreshCw size={16} aria-hidden="true" />
            </button>
          </div>
          {assetError && (
            <p className="flex items-start gap-1.5 text-xs text-danger">
              <AlertCircle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
              {assetError}
            </p>
          )}
          {assetData && !assetLoading && (
            <p className="flex items-center gap-1.5 text-xs text-success">
              <CheckCircle2 size={12} aria-hidden="true" />
              {assetData.asset.name} ({assetData.asset.currency}) · {fmtUSD(assetData.asset.currentPrice)}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <div className="space-y-3">
            <div className="flex rounded-xl border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setPositionMode('shares')}
                className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                  positionMode === 'shares'
                    ? 'bg-accent-interactive text-text-on-accent'
                    : 'bg-bg-card text-text-secondary hover:bg-bg-muted'
                }`}
              >
                Liczba akcji
              </button>
              <button
                type="button"
                onClick={() => {
                  if (shares > 0 && currentPriceUSD > 0) {
                    setValueInput((shares * currentPriceUSD).toFixed(2));
                  }
                  setPositionMode('value');
                }}
                className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                  positionMode === 'value'
                    ? 'bg-accent-interactive text-text-on-accent'
                    : 'bg-bg-card text-text-secondary hover:bg-bg-muted'
                }`}
              >
                Wartość pozycji (USD)
              </button>
            </div>

            {positionMode === 'shares' ? (
              <div className="space-y-1">
                <label htmlFor="comparison-shares" className="text-sm font-medium text-text-secondary">
                  Liczba akcji
                </label>
                <input
                  id="comparison-shares"
                  type="number"
                  min={0}
                  step={0.0001}
                  value={shares || ''}
                  onChange={(event) => setRoundedShares(Number(event.target.value))}
                  placeholder="np. 25"
                  className="w-full border border-border rounded-lg bg-bg-card px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/30"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <label htmlFor="comparison-position-value" className="text-sm font-medium text-text-secondary">
                  Wartość pozycji (USD)
                </label>
                <input
                  id="comparison-position-value"
                  type="text"
                  inputMode="decimal"
                  value={valueInput}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setValueInput(nextValue);
                    const parsed = parseDecimal(nextValue);
                    if (parsed > 0 && currentPriceUSD > 0) {
                      setRoundedShares(parsed / currentPriceUSD);
                    } else if (!nextValue.trim()) {
                      setRoundedShares(0);
                    }
                  }}
                  placeholder="np. 5000,50"
                  className="w-full border border-border rounded-lg bg-bg-card px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/30"
                />
              </div>
            )}

            <div className="rounded-xl border border-accent-primary/20 bg-accent-primary/5 px-3 py-2 text-sm text-text-secondary">
              <div className="flex items-start gap-2">
                <Info size={16} className="mt-0.5 shrink-0 text-accent-primary" aria-hidden="true" />
                <div className="space-y-1">
                  {positionMode === 'shares' ? (
                    <>
                      {shares > 0 && currentPriceUSD > 0 ? (
                        <p className="whitespace-nowrap">
                          <span className="font-medium text-text-primary">Łączna wartość pozycji</span>
                          {' '}— <span className="font-semibold text-text-primary">{fmtUSD(positionValueUSD)}</span>
                        </p>
                      ) : (
                        <p>Wpisz ticker i liczbę akcji, aby zobaczyć wartość pozycji.</p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-text-primary">Szacowana liczba akcji</p>
                      <p>
                        {parseDecimal(valueInput) > 0 && currentPriceUSD > 0
                          ? `${formatShares(estimatedShares)} akcji`
                          : 'Po pobraniu ceny akcji przeliczymy wartość pozycji na liczbę akcji.'}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="comparison-avg-cost" className="text-sm font-medium text-text-secondary">
            Cena zakupu (USD)
          </label>
          <input
            id="comparison-avg-cost"
            type="number"
            min={0}
            step={0.01}
            value={isRSU ? '' : (avgCostUSD || '')}
            onChange={(event) => onAvgCostUSDChange(Number(event.target.value))}
            placeholder={isRSU ? 'Pole zablokowane dla RSU' : 'np. 85,00'}
            disabled={isRSU}
            className={`w-full border border-border rounded-lg bg-bg-card px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/30 ${
              isRSU ? 'cursor-not-allowed opacity-60' : ''
            }`}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={isRSU}
            onChange={(event) => {
              onIsRSUChange(event.target.checked);
              if (event.target.checked) {
                onAvgCostUSDChange(0);
              }
            }}
            className="rounded border-border text-accent-primary focus:ring-accent-primary"
          />
          <span>Akcje przyznane (RSU)</span>
          <Tooltip content="Po zaznaczeniu koszt nabycia jest traktowany jako 0 USD, więc pole ceny zakupu zostaje zablokowane." />
        </label>

        <div className="space-y-1 rounded-xl border border-border bg-bg-muted/40 px-4 py-3 text-xs text-text-secondary">
          <p>
            Kurs sprzedaży akcji (Alior Kantor) -{' '}
            <strong className="text-text-primary">{aliorRate ? fmtNum(aliorRate) : 'brak danych'}</strong>
          </p>
          <p>
            Kurs kalkulacji podatku belki (NBP) -{' '}
            <strong className="text-text-primary">{nbpMidRate ? fmtNum(nbpMidRate) : 'brak danych'}</strong>
          </p>
        </div>

        {avgCostUSD > 0 && currentPriceUSD > 0 && !isRSU && (
          <div className="rounded-xl border border-border bg-bg-muted/40 px-4 py-3 text-sm text-text-secondary">
            Cena zakupu stanowi obecnie <strong className="text-text-primary">{formatPercent((avgCostUSD / currentPriceUSD) * 100)}%</strong> bieżącej ceny akcji.
          </div>
        )}
      </div>
    </ComparisonInputDropdown>
  );
}
