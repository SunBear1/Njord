import { useMemo, useEffect, useRef, useCallback, useState } from 'react';
import {
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  TrendingUp,
  ArrowRightLeft,
} from 'lucide-react';
import { calcTransactionResult } from '../../utils/taxCalculator';
import { fetchNbpTableARate } from '../../utils/fetchNbpTableARate';
import { fetchTickerName } from '../../utils/fetchTickerName';
import { fmtPLNGrosze } from '../../utils/formatting';
import type { TaxTransaction, TransactionTaxResult } from '../../types/tax';
import { subtractOneDay, fmtDatePL, fmtGain, INPUT_CLS, LABEL_CLS, CURRENCIES } from './taxHelpers';
import { PolishDateInput } from './PolishDateInput';

const DEBOUNCE_MS = 500;

export interface TransactionCardProps {
  tx: TaxTransaction;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<TaxTransaction>) => void;
  onDelete: () => void;
}

// ─── Rate Status Badge ─────────────────────────────────────────────────────────

function RateStatusBadge({
  rate,
  effectiveDate,
  isLoading,
  error,
  currency,
  onManualChange,
}: {
  rate: number | null;
  effectiveDate?: string;
  isLoading?: boolean;
  error?: string;
  currency: string;
  onManualChange: (rate: number) => void;
}) {
  if (currency.toUpperCase() === 'PLN') {
    return (
      <p className="text-[11px] text-gray-400 dark:text-gray-500">PLN — brak przeliczenia</p>
    );
  }

  if (isLoading) {
    return (
      <p className="text-[11px] text-blue-500 dark:text-blue-400 flex items-center gap-1">
        <Loader2 size={10} className="animate-spin" aria-hidden="true" />
        Pobieranie kursu NBP…
      </p>
    );
  }

  if (error) {
    return (
      <div className="space-y-1">
        <p className="text-[11px] text-red-600 dark:text-red-400 flex items-start gap-1">
          <AlertTriangle size={10} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
        <input
          type="number"
          min={0}
          step={0.0001}
          defaultValue={rate ?? undefined}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (v > 0) onManualChange(v);
          }}
          placeholder="Kurs ręcznie (np. 3.9785)"
          className="w-full border border-red-300 dark:border-red-700 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 dark:bg-gray-700 dark:text-gray-100"
        />
      </div>
    );
  }

  if (rate !== null && rate > 0) {
    return (
      <p className="text-[11px] text-green-600 dark:text-green-400 flex items-center gap-1 flex-wrap">
        <CheckCircle2 size={10} aria-hidden="true" className="flex-shrink-0" />
        <span>Kurs NBP: {rate.toFixed(4)}</span>
        {effectiveDate && (
          <span className="text-gray-400 dark:text-gray-500">z {fmtDatePL(effectiveDate)}</span>
        )}
      </p>
    );
  }

  return null;
}

// ─── Result Bar ───────────────────────────────────────────────────────────────

function ResultBar({ result }: { result: TransactionTaxResult }) {
  const g = fmtGain(result.gainPLN);
  return (
    <div className="flex flex-wrap items-stretch gap-px bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
      <ResultCell label="Przychód" value={fmtPLNGrosze(result.revenuePLN)} />
      <ResultCell label="Koszt" value={fmtPLNGrosze(result.costPLN)} subtract />
      <ResultCell
        label={result.isLoss ? 'Strata' : 'Zysk'}
        value={g.text}
        valueClass={g.cls}
        total
      />
      {!result.isLoss && (
        <ResultCell
          label="Podatek"
          value={fmtPLNGrosze(result.taxEstimatePLN)}
          valueClass="text-amber-700 dark:text-amber-400"
        />
      )}
    </div>
  );
}

function ResultCell({
  label,
  value,
  valueClass,
  subtract,
  total,
}: {
  label: string;
  value: string;
  valueClass?: string;
  subtract?: boolean;
  total?: boolean;
}) {
  return (
    <div
      className={`flex-1 min-w-[90px] bg-white dark:bg-gray-800 px-3 py-2 text-center ${total ? 'ring-1 ring-inset ring-gray-300 dark:ring-gray-600 rounded-sm' : ''}`}
    >
      <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">
        {subtract && '− '}
        {label}
      </p>
      <p
        className={`text-sm font-semibold tabular-nums ${valueClass ?? 'text-gray-800 dark:text-gray-100'}`}
      >
        {value}
      </p>
    </div>
  );
}

// ─── Transaction Card ─────────────────────────────────────────────────────────

export function TransactionCard({
  tx,
  index,
  isExpanded,
  onToggle,
  onUpdate,
  onDelete,
}: TransactionCardProps) {
  const effectiveAcqCurrency = tx.acquisitionCurrency ?? tx.currency;
  const [showDualCurrency, setShowDualCurrency] = useState(
    () => !!tx.acquisitionCurrency && tx.acquisitionCurrency !== tx.currency,
  );

  const result: TransactionTaxResult | null = useMemo(
    () => calcTransactionResult(tx),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      tx.saleGrossAmount,
      tx.acquisitionCostAmount,
      tx.saleBrokerFee,
      tx.acquisitionBrokerFee,
      tx.zeroCostFlag,
      tx.exchangeRateSaleToPLN,
      tx.exchangeRateAcquisitionToPLN,
    ],
  );

  const saleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const acqTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saleAbortRef = useRef<AbortController | null>(null);
  const acqAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (saleTimerRef.current) clearTimeout(saleTimerRef.current);
      if (acqTimerRef.current) clearTimeout(acqTimerRef.current);
      if (tickerTimerRef.current) clearTimeout(tickerTimerRef.current);
      saleAbortRef.current?.abort();
      acqAbortRef.current?.abort();
    };
  }, []);

  // Auto-fetch NBP rates on mount when dates are set but rates are null.
  const mountFetchedRef = useRef(false);
  useEffect(() => {
    if (mountFetchedRef.current) return;
    mountFetchedRef.current = true;
    if (tx.saleDate && tx.exchangeRateSaleToPLN === null && !tx.isLoadingRateSale) {
      saleTimerRef.current = setTimeout(() => {
        onUpdate({ isLoadingRateSale: true, rateSaleError: undefined });
        fetchNbpTableARate(tx.saleDate, tx.currency)
          .then(({ rate, effectiveDate }) => {
            onUpdate({
              exchangeRateSaleToPLN: rate,
              rateSaleEffectiveDate: effectiveDate,
              isLoadingRateSale: false,
              rateSaleError: undefined,
            });
          })
          .catch((err: Error) => {
            onUpdate({ isLoadingRateSale: false, rateSaleError: err.message });
          });
      }, 50);
    }
    if (tx.acquisitionDate && !tx.zeroCostFlag && tx.exchangeRateAcquisitionToPLN === null && !tx.isLoadingRateAcquisition) {
      acqTimerRef.current = setTimeout(() => {
        onUpdate({ isLoadingRateAcquisition: true, rateAcquisitionError: undefined });
        fetchNbpTableARate(tx.acquisitionDate!, effectiveAcqCurrency)
          .then(({ rate, effectiveDate }) => {
            onUpdate({
              exchangeRateAcquisitionToPLN: rate,
              rateAcquisitionEffectiveDate: effectiveDate,
              isLoadingRateAcquisition: false,
              rateAcquisitionError: undefined,
            });
          })
          .catch((err: Error) => {
            onUpdate({ isLoadingRateAcquisition: false, rateAcquisitionError: err.message });
          });
      }, 100);
    }
    if (tx.ticker && !tx.tickerName && !tx.isLoadingTicker) {
      tickerTimerRef.current = setTimeout(() => {
        onUpdate({ isLoadingTicker: true, tickerError: undefined });
        fetchTickerName(tx.ticker!)
          .then((name) => onUpdate({ tickerName: name, isLoadingTicker: false, tickerError: undefined }))
          .catch((err: Error) => onUpdate({ isLoadingTicker: false, tickerError: err.message }));
      }, 150);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerFetchSale = useCallback(
    (date: string, currency: string) => {
      if (!date) return;
      if (currency.toUpperCase() === 'PLN') {
        onUpdate({ exchangeRateSaleToPLN: 1, rateSaleEffectiveDate: date, isLoadingRateSale: false });
        return;
      }
      saleAbortRef.current?.abort();
      const controller = new AbortController();
      saleAbortRef.current = controller;
      onUpdate({ isLoadingRateSale: true, rateSaleError: undefined });
      fetchNbpTableARate(date, currency, controller.signal)
        .then(({ rate, effectiveDate }) => {
          if (controller.signal.aborted) return;
          onUpdate({
            exchangeRateSaleToPLN: rate,
            rateSaleEffectiveDate: effectiveDate,
            isLoadingRateSale: false,
            rateSaleError: undefined,
          });
        })
        .catch((err: Error) => {
          if (controller.signal.aborted) return;
          onUpdate({ isLoadingRateSale: false, rateSaleError: err.message });
        });
    },
    [onUpdate],
  );

  const triggerFetchAcq = useCallback(
    (date: string, currency: string) => {
      if (!date || tx.zeroCostFlag) return;
      if (currency.toUpperCase() === 'PLN') {
        onUpdate({ exchangeRateAcquisitionToPLN: 1, rateAcquisitionEffectiveDate: date, isLoadingRateAcquisition: false });
        return;
      }
      acqAbortRef.current?.abort();
      const controller = new AbortController();
      acqAbortRef.current = controller;
      onUpdate({ isLoadingRateAcquisition: true, rateAcquisitionError: undefined });
      fetchNbpTableARate(date, currency, controller.signal)
        .then(({ rate, effectiveDate }) => {
          if (controller.signal.aborted) return;
          onUpdate({
            exchangeRateAcquisitionToPLN: rate,
            rateAcquisitionEffectiveDate: effectiveDate,
            isLoadingRateAcquisition: false,
            rateAcquisitionError: undefined,
          });
        })
        .catch((err: Error) => {
          if (controller.signal.aborted) return;
          onUpdate({ isLoadingRateAcquisition: false, rateAcquisitionError: err.message });
        });
    },
    [onUpdate, tx.zeroCostFlag],
  );

  const handleSaleDateChange = useCallback(
    (date: string) => {
      onUpdate({
        saleDate: date,
        exchangeRateSaleToPLN: null,
        rateSaleEffectiveDate: undefined,
        rateSaleError: undefined,
      });
      if (saleTimerRef.current) clearTimeout(saleTimerRef.current);
      saleTimerRef.current = setTimeout(() => triggerFetchSale(date, tx.currency), DEBOUNCE_MS);
    },
    [onUpdate, tx.currency, triggerFetchSale],
  );

  const handleAcqDateChange = useCallback(
    (date: string) => {
      onUpdate({
        acquisitionDate: date,
        exchangeRateAcquisitionToPLN: null,
        rateAcquisitionEffectiveDate: undefined,
        rateAcquisitionError: undefined,
      });
      if (acqTimerRef.current) clearTimeout(acqTimerRef.current);
      acqTimerRef.current = setTimeout(() => triggerFetchAcq(date, effectiveAcqCurrency), DEBOUNCE_MS);
    },
    [onUpdate, effectiveAcqCurrency, triggerFetchAcq],
  );

  const handleCurrencyChange = useCallback(
    (currency: string) => {
      const patch: Partial<TaxTransaction> = {
        currency,
        exchangeRateSaleToPLN: null,
        rateSaleEffectiveDate: undefined,
        rateSaleError: undefined,
      };
      // If not using dual currency, also reset acquisition rate
      if (!showDualCurrency) {
        patch.exchangeRateAcquisitionToPLN = null;
        patch.rateAcquisitionEffectiveDate = undefined;
        patch.rateAcquisitionError = undefined;
      }
      onUpdate(patch);
      if (tx.saleDate) {
        if (saleTimerRef.current) clearTimeout(saleTimerRef.current);
        saleTimerRef.current = setTimeout(() => triggerFetchSale(tx.saleDate, currency), DEBOUNCE_MS);
      }
      if (!showDualCurrency && tx.acquisitionDate && !tx.zeroCostFlag) {
        if (acqTimerRef.current) clearTimeout(acqTimerRef.current);
        acqTimerRef.current = setTimeout(() => triggerFetchAcq(tx.acquisitionDate!, currency), DEBOUNCE_MS);
      }
    },
    [onUpdate, tx.saleDate, tx.acquisitionDate, tx.zeroCostFlag, showDualCurrency, triggerFetchSale, triggerFetchAcq],
  );

  const handleAcqCurrencyChange = useCallback(
    (acqCurrency: string) => {
      const isSameAsSale = acqCurrency === tx.currency;
      onUpdate({
        acquisitionCurrency: isSameAsSale ? undefined : acqCurrency,
        exchangeRateAcquisitionToPLN: null,
        rateAcquisitionEffectiveDate: undefined,
        rateAcquisitionError: undefined,
      });
      if (tx.acquisitionDate && !tx.zeroCostFlag) {
        if (acqTimerRef.current) clearTimeout(acqTimerRef.current);
        acqTimerRef.current = setTimeout(() => triggerFetchAcq(tx.acquisitionDate!, acqCurrency), DEBOUNCE_MS);
      }
    },
    [onUpdate, tx.currency, tx.acquisitionDate, tx.zeroCostFlag, triggerFetchAcq],
  );

  const handleDualCurrencyToggle = useCallback(
    (enabled: boolean) => {
      setShowDualCurrency(enabled);
      if (!enabled) {
        // Reset to same currency as sale
        onUpdate({
          acquisitionCurrency: undefined,
          exchangeRateAcquisitionToPLN: null,
          rateAcquisitionEffectiveDate: undefined,
          rateAcquisitionError: undefined,
        });
        if (tx.acquisitionDate && !tx.zeroCostFlag) {
          if (acqTimerRef.current) clearTimeout(acqTimerRef.current);
          acqTimerRef.current = setTimeout(() => triggerFetchAcq(tx.acquisitionDate!, tx.currency), DEBOUNCE_MS);
        }
      }
    },
    [onUpdate, tx.acquisitionDate, tx.zeroCostFlag, tx.currency, triggerFetchAcq],
  );

  const handleTickerChange = useCallback(
    (ticker: string) => {
      const t = ticker.toUpperCase();
      onUpdate({ ticker: t, tickerName: undefined, tickerError: undefined, isLoadingTicker: false });
      if (tickerTimerRef.current) clearTimeout(tickerTimerRef.current);
      if (!t) return;
      tickerTimerRef.current = setTimeout(() => {
        onUpdate({ isLoadingTicker: true, tickerError: undefined });
        fetchTickerName(t)
          .then((name) => onUpdate({ tickerName: name, isLoadingTicker: false, tickerError: undefined }))
          .catch((err: Error) => onUpdate({ isLoadingTicker: false, tickerError: err.message }));
      }, DEBOUNCE_MS);
    },
    [onUpdate],
  );

  const gainInfo = result ? fmtGain(result.gainPLN) : null;
  const hasCommissions =
    (tx.saleBrokerFee ?? 0) > 0 || (tx.acquisitionBrokerFee ?? 0) > 0;
  const showCommissions = tx.showCommissions || hasCommissions;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden transition-shadow hover:shadow-md">
      {/* Collapsed summary bar */}
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3 text-left select-none transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label={`Transakcja ${index}`}
      >
        {/* Index badge */}
        <span className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold inline-flex items-center justify-center flex-shrink-0">
          {index}
        </span>

        {/* Ticker + name */}
        <div className="flex items-center gap-1.5 min-w-0 flex-shrink-0">
          {tx.ticker ? (
            <span className="inline-flex items-center gap-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded font-semibold text-xs tracking-wide">
              <TrendingUp size={10} aria-hidden="true" />
              {tx.ticker}
            </span>
          ) : (
            <span className="text-gray-300 dark:text-gray-600 text-sm">—</span>
          )}
          {tx.tickerName && (
            <span className="text-gray-400 dark:text-gray-500 text-xs truncate max-w-[120px] hidden lg:inline">
              {tx.tickerName}
            </span>
          )}
        </div>

        {/* Sale date */}
        <span className="text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap hidden sm:inline">
          {tx.saleDate ? fmtDatePL(tx.saleDate) : <span className="text-gray-400 italic text-xs">Brak daty</span>}
        </span>

        {/* Amount */}
        <span className="text-sm tabular-nums text-gray-500 dark:text-gray-400 whitespace-nowrap hidden md:inline ml-auto">
          {tx.saleGrossAmount > 0
            ? `${tx.saleGrossAmount.toLocaleString('pl-PL', { maximumFractionDigits: 2 })} ${tx.currency}`
            : ''}
        </span>

        {/* Gain/loss */}
        <span className={`text-sm tabular-nums font-semibold whitespace-nowrap ${gainInfo?.cls ?? 'text-gray-400'} ${tx.saleGrossAmount > 0 ? '' : 'md:ml-auto'}`}>
          {gainInfo ? gainInfo.text : '—'}
        </span>

        {/* Tax */}
        {result && !result.isLoss ? (
          <span className="text-xs tabular-nums text-amber-700 dark:text-amber-400 font-medium whitespace-nowrap hidden sm:inline">
            {fmtPLNGrosze(result.taxEstimatePLN)}
          </span>
        ) : null}

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0 ml-1">
          {tx.importSource && (
            <span className="inline-flex items-center bg-gray-100 dark:bg-gray-700/60 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide">
              {tx.importSource}
            </span>
          )}
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onDelete(); } }}
            className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-colors"
            aria-label="Usuń transakcję"
          >
            <Trash2 size={14} aria-hidden="true" />
          </span>
          {isExpanded
            ? <ChevronUp size={14} className="text-gray-400" aria-hidden="true" />
            : <ChevronDown size={14} className="text-gray-400" aria-hidden="true" />
          }
        </div>
      </button>

      {/* Expanded edit form */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 px-4 py-4 space-y-4">

          {/* Ticker (optional) */}
          <div className="space-y-1">
            <label htmlFor={`${tx.id}-ticker`} className={LABEL_CLS}>
              Ticker giełdowy
              <span className="ml-1 text-gray-400 dark:text-gray-500 font-normal">(opcjonalne)</span>
            </label>
            <div className="relative">
              <input
                id={`${tx.id}-ticker`}
                type="text"
                value={tx.ticker ?? ''}
                onChange={(e) => handleTickerChange(e.target.value)}
                placeholder="np. AAPL, NVDA, SPY…"
                maxLength={12}
                autoCapitalize="characters"
                spellCheck={false}
                autoComplete="off"
                className={INPUT_CLS}
              />
              {tx.isLoadingTicker && (
                <Loader2
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-400"
                  aria-hidden="true"
                />
              )}
            </div>
            {tx.tickerName && !tx.isLoadingTicker && (
              <p className="text-[11px] text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                <CheckCircle2 size={10} aria-hidden="true" />
                {tx.tickerName}
              </p>
            )}
            {tx.tickerError && !tx.isLoadingTicker && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle size={10} aria-hidden="true" />
                {tx.tickerError}
              </p>
            )}
          </div>

          {/* Sale: date, amount, currency */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label htmlFor={`${tx.id}-sale-date`} className={LABEL_CLS}>
                Data sprzedaży <span className="text-red-500">*</span>
              </label>
              <PolishDateInput
                id={`${tx.id}-sale-date`}
                value={tx.saleDate}
                onChange={handleSaleDateChange}
                maxDate={new Date().toISOString().split('T')[0]}
                maxDateMessage="Data sprzedaży nie może być w przyszłości"
                className={INPUT_CLS}
              />
              <RateStatusBadge
                rate={tx.exchangeRateSaleToPLN}
                effectiveDate={tx.rateSaleEffectiveDate}
                isLoading={tx.isLoadingRateSale}
                error={tx.rateSaleError}
                currency={tx.currency}
                onManualChange={(rate) =>
                  onUpdate({ exchangeRateSaleToPLN: rate, rateSaleError: undefined })
                }
              />
            </div>

            <div className="space-y-1">
              <label htmlFor={`${tx.id}-sale-amount`} className={LABEL_CLS}>
                Kwota sprzedaży brutto <span className="text-red-500">*</span>
              </label>
              <input
                id={`${tx.id}-sale-amount`}
                type="number"
                min={0}
                step={0.01}
                value={tx.saleGrossAmount || ''}
                onChange={(e) => onUpdate({ saleGrossAmount: Number(e.target.value) })}
                placeholder="np. 19 500.00…"
                className={INPUT_CLS}
              />
            </div>

            <div className="space-y-1 col-span-2 sm:col-span-1">
              <label htmlFor={`${tx.id}-currency`} className={LABEL_CLS}>
                Waluta sprzedaży <span className="text-red-500">*</span>
              </label>
              <select
                id={`${tx.id}-currency`}
                value={tx.currency}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                className={INPUT_CLS}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Zero cost toggle */}
          <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={tx.zeroCostFlag}
              onChange={(e) => {
                const zeroCostFlag = e.target.checked;
                onUpdate({
                  zeroCostFlag,
                  acquisitionMode: zeroCostFlag ? 'grant' : 'purchase',
                  acquisitionCostAmount: zeroCostFlag ? 0 : tx.acquisitionCostAmount,
                  acquisitionBrokerFee: zeroCostFlag ? 0 : tx.acquisitionBrokerFee,
                  acquisitionDate: zeroCostFlag ? undefined : tx.acquisitionDate,
                  exchangeRateAcquisitionToPLN: zeroCostFlag ? null : tx.exchangeRateAcquisitionToPLN,
                  acquisitionCurrency: zeroCostFlag ? undefined : tx.acquisitionCurrency,
                });
                if (zeroCostFlag) setShowDualCurrency(false);
              }}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-700 dark:text-gray-300">
              Koszt nabycia = 0
              <span className="ml-1.5 text-gray-400 dark:text-gray-500 text-xs font-normal">
                (grant, RSU, akcje przyznane nieodpłatnie)
              </span>
            </span>
          </label>

          {/* Acquisition fields */}
          {!tx.zeroCostFlag && (
            <div className="pt-2 border-t border-dashed border-gray-200 dark:border-gray-700 space-y-3">
              {/* Dual currency toggle */}
              <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showDualCurrency}
                  onChange={(e) => handleDualCurrencyToggle(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <ArrowRightLeft size={12} className="text-gray-400" aria-hidden="true" />
                <span className="text-gray-600 dark:text-gray-400">
                  Inna waluta nabycia niż sprzedaży
                </span>
              </label>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label htmlFor={`${tx.id}-acq-date`} className={LABEL_CLS}>
                    Data nabycia <span className="text-red-500">*</span>
                  </label>
                  <PolishDateInput
                    id={`${tx.id}-acq-date`}
                    value={tx.acquisitionDate ?? ''}
                    onChange={handleAcqDateChange}
                    maxDate={subtractOneDay(tx.saleDate)}
                    maxDateMessage="Data nabycia musi być wcześniejsza niż data sprzedaży"
                    className={INPUT_CLS}
                  />
                  <RateStatusBadge
                    rate={tx.exchangeRateAcquisitionToPLN ?? null}
                    effectiveDate={tx.rateAcquisitionEffectiveDate}
                    isLoading={tx.isLoadingRateAcquisition}
                    error={tx.rateAcquisitionError}
                    currency={effectiveAcqCurrency}
                    onManualChange={(rate) =>
                      onUpdate({ exchangeRateAcquisitionToPLN: rate, rateAcquisitionError: undefined })
                    }
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor={`${tx.id}-acq-cost`} className={LABEL_CLS}>
                    Koszt nabycia <span className="text-red-500">*</span>
                  </label>
                  <input
                    id={`${tx.id}-acq-cost`}
                    type="number"
                    min={0}
                    step={0.01}
                    value={tx.acquisitionCostAmount || ''}
                    onChange={(e) => onUpdate({ acquisitionCostAmount: Number(e.target.value) })}
                    placeholder="np. 15 000.00…"
                    className={INPUT_CLS}
                  />
                </div>

                {showDualCurrency && (
                  <div className="space-y-1 col-span-2 sm:col-span-1">
                    <label htmlFor={`${tx.id}-acq-currency`} className={LABEL_CLS}>
                      Waluta nabycia <span className="text-red-500">*</span>
                    </label>
                    <select
                      id={`${tx.id}-acq-currency`}
                      value={effectiveAcqCurrency}
                      onChange={(e) => handleAcqCurrencyChange(e.target.value)}
                      className={INPUT_CLS}
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Commissions (collapsed by default) */}
          <div className="pt-1">
            {!showCommissions ? (
              <button
                type="button"
                onClick={() => onUpdate({ showCommissions: true })}
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 underline underline-offset-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
              >
                + Dodaj prowizję brokera
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Prowizje brokera</span>
                  {!hasCommissions && (
                    <button
                      type="button"
                      onClick={() => onUpdate({ showCommissions: false })}
                      className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
                    >
                      Ukryj
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor={`${tx.id}-sale-fee`} className={LABEL_CLS}>Prowizja sprzedaży</label>
                    <input
                      id={`${tx.id}-sale-fee`}
                      type="number"
                      min={0}
                      step={0.01}
                      value={tx.saleBrokerFee || ''}
                      onChange={(e) => onUpdate({ saleBrokerFee: Number(e.target.value) })}
                      placeholder="np. 4.95…"
                      className={INPUT_CLS}
                    />
                  </div>
                  {!tx.zeroCostFlag && (
                    <div className="space-y-1">
                      <label htmlFor={`${tx.id}-acq-fee`} className={LABEL_CLS}>Prowizja zakupu</label>
                      <input
                        id={`${tx.id}-acq-fee`}
                        type="number"
                        min={0}
                        step={0.01}
                        value={tx.acquisitionBrokerFee || ''}
                        onChange={(e) => onUpdate({ acquisitionBrokerFee: Number(e.target.value) })}
                        placeholder="np. 4.95…"
                        className={INPUT_CLS}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Result bar */}
          {result && <ResultBar result={result} />}

          {/* Not-ready hint */}
          {!result && tx.saleGrossAmount > 0 && tx.saleDate && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {tx.isLoadingRateSale || tx.isLoadingRateAcquisition
                ? 'Pobieranie kursu NBP…'
                : !tx.exchangeRateSaleToPLN
                  ? 'Oczekiwanie na kurs NBP dla daty sprzedaży.'
                  : !tx.zeroCostFlag && !tx.acquisitionDate
                    ? 'Podaj datę nabycia, aby obliczyć wynik.'
                    : !tx.zeroCostFlag && !tx.exchangeRateAcquisitionToPLN
                      ? 'Oczekiwanie na kurs NBP dla daty nabycia.'
                      : 'Uzupełnij brakujące pola, aby zobaczyć wynik.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
