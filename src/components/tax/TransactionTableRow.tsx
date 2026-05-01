import { useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  TrendingUp,
} from 'lucide-react';
import { calcTransactionResult } from '../../utils/taxCalculator';
import { fetchNbpTableARate } from '../../utils/fetchNbpTableARate';
import { fetchTickerName } from '../../utils/fetchTickerName';
import { fmtPLNGrosze } from '../../utils/formatting';
import type { TaxTransaction, TransactionTaxResult } from '../../types/tax';
import { subtractOneDay, fmtDatePL, fmtGain, INPUT_CLS, LABEL_CLS, CURRENCIES, COL_COUNT } from './taxHelpers';
import { PolishDateInput } from './PolishDateInput';

const DEBOUNCE_MS = 500;

export interface TransactionTableRowProps {
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
      <p className="text-[11px] text-border">PLN — brak przeliczenia</p>
    );
  }

  if (isLoading) {
    return (
      <p className="text-[11px] text-accent-primary flex items-center gap-1">
        <Loader2 size={10} className="animate-spin" aria-hidden="true" />
        Pobieranie kursu NBP…
      </p>
    );
  }

  if (error) {
    return (
      <div className="space-y-1">
        <p className="text-[11px] text-danger flex items-start gap-1">
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
          className="w-full border border-danger/30 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-danger/50"
        />
      </div>
    );
  }

  if (rate !== null && rate > 0) {
    return (
      <p className="text-[11px] text-success flex items-center gap-1 flex-wrap">
        <CheckCircle2 size={10} aria-hidden="true" className="flex-shrink-0" />
        <span>Kurs NBP: {rate.toFixed(4)}</span>
        {effectiveDate && (
          <span className="text-border">z {fmtDatePL(effectiveDate)}</span>
        )}
      </p>
    );
  }

  return null;
}

// ─── Result Cell ──────────────────────────────────────────────────────────────

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
      className={`flex-1 min-w-[90px] bg-bg-card px-3 py-2 text-center ${total ? 'ring-1 ring-inset ring-border rounded-sm' : ''}`}
    >
      <p className="text-[10px] text-border uppercase tracking-wide mb-0.5">
        {subtract && '− '}
        {label}
      </p>
      <p
        className={`text-sm font-semibold tabular-nums ${valueClass ?? 'text-text-primary'}`}
      >
        {value}
      </p>
    </div>
  );
}

// ─── Transaction Table Row ────────────────────────────────────────────────────

export function TransactionTableRow({
  tx,
  index,
  isExpanded,
  onToggle,
  onUpdate,
  onDelete,
}: TransactionTableRowProps) {
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

  // Auto-fetch NBP rates on mount when dates are set but rates are null (e.g., imported from Etrade file).
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
      }, 50); // small delay to stagger concurrent requests from batch import
    }
    if (tx.acquisitionDate && !tx.zeroCostFlag && tx.exchangeRateAcquisitionToPLN === null && !tx.isLoadingRateAcquisition) {
      acqTimerRef.current = setTimeout(() => {
        onUpdate({ isLoadingRateAcquisition: true, rateAcquisitionError: undefined });
        fetchNbpTableARate(tx.acquisitionDate!, tx.currency)
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
      acqTimerRef.current = setTimeout(() => triggerFetchAcq(date, tx.currency), DEBOUNCE_MS);
    },
    [onUpdate, tx.currency, triggerFetchAcq],
  );

  const handleCurrencyChange = useCallback(
    (currency: string) => {
      onUpdate({
        currency,
        exchangeRateSaleToPLN: null,
        exchangeRateAcquisitionToPLN: null,
        rateSaleEffectiveDate: undefined,
        rateAcquisitionEffectiveDate: undefined,
        rateSaleError: undefined,
        rateAcquisitionError: undefined,
      });
      if (tx.saleDate) {
        if (saleTimerRef.current) clearTimeout(saleTimerRef.current);
        saleTimerRef.current = setTimeout(() => triggerFetchSale(tx.saleDate, currency), DEBOUNCE_MS);
      }
      if (tx.acquisitionDate && !tx.zeroCostFlag) {
        if (acqTimerRef.current) clearTimeout(acqTimerRef.current);
        acqTimerRef.current = setTimeout(() => triggerFetchAcq(tx.acquisitionDate!, currency), DEBOUNCE_MS);
      }
    },
    [onUpdate, tx.saleDate, tx.acquisitionDate, tx.zeroCostFlag, triggerFetchSale, triggerFetchAcq],
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
    <>
      {/* Summary row */}
      <tr
        className={`border-b border-border cursor-pointer hover:bg-bg-card select-none transition-colors ${isExpanded ? 'bg-bg-card/50/30' : ''}`}
        onClick={onToggle}
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onToggle()}
        aria-expanded={isExpanded}
        aria-label={`Transakcja ${index}`}
      >
        <td className="px-3 py-2.5 text-center">
          <span className="w-6 h-6 rounded-full bg-bg-hover/40 text-accent-primary/80 text-xs font-bold inline-flex items-center justify-center">
            {index}
          </span>
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            {tx.ticker ? (
              <span className="inline-flex items-center gap-1 bg-accent-primary/10 text-accent-primary px-2 py-0.5 rounded font-semibold text-xs tracking-wide">
                <TrendingUp size={10} aria-hidden="true" />
                {tx.ticker}
              </span>
            ) : (
              <span className="text-text-muted">—</span>
            )}
            {tx.tickerName && (
              <span className="text-border text-xs truncate max-w-[120px] hidden lg:inline">
                {tx.tickerName}
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-2.5 text-text-secondary whitespace-nowrap">
          {tx.saleDate ? fmtDatePL(tx.saleDate) : <span className="text-border italic text-xs">Brak daty</span>}
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums text-text-secondary whitespace-nowrap">
          {tx.saleGrossAmount > 0
            ? `${tx.saleGrossAmount.toLocaleString('pl-PL', { maximumFractionDigits: 2 })} ${tx.currency}`
            : '—'}
        </td>
        <td className="hidden sm:table-cell px-3 py-2.5 text-right tabular-nums text-text-secondary whitespace-nowrap">
          {result ? fmtPLNGrosze(result.revenuePLN) : '—'}
        </td>
        <td className="hidden sm:table-cell px-3 py-2.5 text-right tabular-nums text-text-secondary whitespace-nowrap">
          {result ? fmtPLNGrosze(result.costPLN) : '—'}
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
          {gainInfo ? (
            <span className={`font-semibold ${gainInfo.cls}`}>{gainInfo.text}</span>
          ) : '—'}
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
          {result && !result.isLoss ? (
            <span className="text-danger font-medium">{fmtPLNGrosze(result.taxEstimatePLN)}</span>
          ) : result ? (
            <span className="text-border">—</span>
          ) : '—'}
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center justify-end gap-1">
            {tx.importSource && (
              <span className="inline-flex items-center bg-bg-hover/60 text-text-muted px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide">
                {tx.importSource}
              </span>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 text-border hover:text-danger rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-danger transition-colors"
              aria-label="Usuń transakcję"
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
            {isExpanded
              ? <ChevronUp size={14} className="text-border" aria-hidden="true" />
              : <ChevronDown size={14} className="text-border" aria-hidden="true" />
            }
          </div>
        </td>
      </tr>

      {/* Expanded edit form */}
      {isExpanded && (
        <tr>
          <td colSpan={COL_COUNT} className="border-b border-border bg-bg-card/50/50 px-4 py-4">
            <div className="space-y-4">

          {/* Row 0: Ticker (optional) */}
          <div className="space-y-1">
            <label htmlFor={`${tx.id}-ticker`} className={LABEL_CLS}>
              Ticker giełdowy
              <span className="ml-1 text-border font-normal">(opcjonalne)</span>
            </label>
            <div className="relative">
              <input
                id={`${tx.id}-ticker`}
                type="text"
                value={tx.ticker ?? ''}
                onChange={(e) => handleTickerChange(e.target.value)}
                placeholder="np. AAPL, NVDA, SPY"
                maxLength={12}
                autoCapitalize="characters"
                spellCheck={false}
                autoComplete="off"
                className={INPUT_CLS}
              />
              {tx.isLoadingTicker && (
                <Loader2
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-accent-primary"
                  aria-hidden="true"
                />
              )}
            </div>
            {tx.tickerName && !tx.isLoadingTicker && (
              <p className="text-[11px] text-accent-primary flex items-center gap-1">
                <CheckCircle2 size={10} aria-hidden="true" />
                {tx.tickerName}
              </p>
            )}
            {tx.tickerError && !tx.isLoadingTicker && (
              <p className="text-[11px] text-danger flex items-center gap-1">
                <AlertTriangle size={10} aria-hidden="true" />
                {tx.tickerError}
              </p>
            )}
          </div>

          {/* Row 1: Sale date, sale amount, currency */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label htmlFor={`${tx.id}-sale-date`} className={LABEL_CLS}>
                Data sprzedaży <span className="text-danger">*</span>
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
                Kwota sprzedaży brutto <span className="text-danger">*</span>
              </label>
              <input
                id={`${tx.id}-sale-amount`}
                type="number"
                min={0}
                step={0.01}
                value={tx.saleGrossAmount || ''}
                onChange={(e) => onUpdate({ saleGrossAmount: Number(e.target.value) })}
                placeholder="np. 19 500.00"
                className={INPUT_CLS}
              />
            </div>

            <div className="space-y-1 col-span-2 sm:col-span-1">
              <label htmlFor={`${tx.id}-currency`} className={LABEL_CLS}>
                Waluta <span className="text-danger">*</span>
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
                });
              }}
              className="rounded border-border text-accent-primary focus:ring-accent-primary"
            />
            <span className="text-text-secondary">
              Koszt nabycia = 0
              <span className="ml-1.5 text-border text-xs font-normal">
                (grant, RSU, akcje przyznane nieodpłatnie)
              </span>
            </span>
          </label>

          {/* Acquisition fields (conditional) */}
          {!tx.zeroCostFlag && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 pt-2 border-t border-dashed border-border">
              <div className="space-y-1">
                <label htmlFor={`${tx.id}-acq-date`} className={LABEL_CLS}>
                  Data nabycia <span className="text-danger">*</span>
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
                  currency={tx.currency}
                  onManualChange={(rate) =>
                    onUpdate({ exchangeRateAcquisitionToPLN: rate, rateAcquisitionError: undefined })
                  }
                />
              </div>

              <div className="space-y-1">
                <label htmlFor={`${tx.id}-acq-cost`} className={LABEL_CLS}>
                  Koszt nabycia <span className="text-danger">*</span>
                </label>
                <input
                  id={`${tx.id}-acq-cost`}
                  type="number"
                  min={0}
                  step={0.01}
                  value={tx.acquisitionCostAmount || ''}
                  onChange={(e) => onUpdate({ acquisitionCostAmount: Number(e.target.value) })}
                  placeholder="np. 15 000.00"
                  className={INPUT_CLS}
                />
              </div>
            </div>
          )}

          {/* Commissions (optional, collapsed by default) */}
          <div className="pt-1">
            {!showCommissions ? (
              <button
                type="button"
                onClick={() => onUpdate({ showCommissions: true })}
                className="text-xs text-border hover:text-accent-primary underline underline-offset-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-primary rounded"
              >
                + Dodaj prowizję brokera
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-secondary">Prowizje brokera</span>
                  {!hasCommissions && (
                    <button
                      type="button"
                      onClick={() => onUpdate({ showCommissions: false })}
                      className="text-[11px] text-border hover:text-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-primary rounded"
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
                      placeholder="np. 4.95"
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
                        placeholder="np. 4.95"
                        className={INPUT_CLS}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Result row */}
          {result && (
            <div className="flex flex-wrap items-stretch gap-px bg-bg-hover rounded-lg overflow-hidden border border-border mt-1">
              <ResultCell label="Przychód" value={fmtPLNGrosze(result.revenuePLN)} />
              <ResultCell label="Koszt" value={fmtPLNGrosze(result.costPLN)} subtract />
              <ResultCell
                label={result.isLoss ? 'Strata' : 'Zysk'}
                value={fmtGain(result.gainPLN).text}
                valueClass={fmtGain(result.gainPLN).cls}
                total
              />
              {!result.isLoss && (
                <ResultCell
                  label="Podatek"
                  value={fmtPLNGrosze(result.taxEstimatePLN)}
                  valueClass="text-danger"
                />
              )}
            </div>
          )}

          {/* Not-ready hint */}
          {!result && tx.saleGrossAmount > 0 && tx.saleDate && (
            <p className="text-xs text-border">
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
          </td>
        </tr>
      )}
    </>
  );
}

