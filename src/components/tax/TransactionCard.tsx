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
      <p className="text-[11px] text-text-muted">PLN — brak przeliczenia</p>
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
          <span className="text-text-muted">z {fmtDatePL(effectiveDate)}</span>
        )}
      </p>
    );
  }

  return null;
}

// ─── Calculation Breakdown ───────────────────────────────────────────────────────

const fmtAmt = (n: number, decimals = 2) =>
  n.toLocaleString('pl-PL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

function CalculationBreakdown({ tx, result }: { tx: TaxTransaction; result: TransactionTaxResult }) {
  const g = fmtGain(result.gainPLN);
  const sellRate = tx.exchangeRateSaleToPLN ?? 0;
  const buyRate = tx.zeroCostFlag ? sellRate : (tx.exchangeRateAcquisitionToPLN ?? sellRate);
  const isPLNSale = tx.currency.toUpperCase() === 'PLN';
  const effectiveAcqCurrency = tx.acquisitionCurrency ?? tx.currency;
  const isPLNAcq = effectiveAcqCurrency.toUpperCase() === 'PLN';
  const saleFee = tx.saleBrokerFee ?? 0;
  const acqFee = tx.acquisitionBrokerFee ?? 0;
  const hasAnyFee = saleFee > 0 || acqFee > 0;

  return (
    <div className="rounded-lg border border-border bg-bg-card overflow-hidden">
      <div className="px-3.5 py-3 space-y-1.5 text-xs tabular-nums">
        {/* Revenue */}
        <CalcLine
          label="Przychód"
          amount={tx.saleGrossAmount}
          currency={tx.currency}
          rate={sellRate}
          isPLN={isPLNSale}
          resultPLN={result.revenuePLN}
        />

        {/* Acquisition cost */}
        {!tx.zeroCostFlag && (
          <CalcLine
            label="Koszt nabycia"
            amount={tx.acquisitionCostAmount ?? 0}
            currency={effectiveAcqCurrency}
            rate={buyRate}
            isPLN={isPLNAcq}
            resultPLN={(tx.acquisitionCostAmount ?? 0) * buyRate}
            subtract
          />
        )}

        {/* Commissions */}
        {hasAnyFee && (
          <>
            {saleFee > 0 && (
              <CalcLine
                label="Prowizja sprzedaży"
                amount={saleFee}
                currency={tx.currency}
                rate={sellRate}
                isPLN={isPLNSale}
                resultPLN={saleFee * sellRate}
                subtract
                minor
              />
            )}
            {acqFee > 0 && !tx.zeroCostFlag && (
              <CalcLine
                label="Prowizja zakupu"
                amount={acqFee}
                currency={effectiveAcqCurrency}
                rate={buyRate}
                isPLN={isPLNAcq}
                resultPLN={acqFee * buyRate}
                subtract
                minor
              />
            )}
          </>
        )}

        <div className="border-t border-dashed border-border my-1" />

        {/* Gain/loss */}
        <div className="flex items-center justify-between pt-0.5">
          <span className={`font-semibold ${g.cls}`}>
            {result.isLoss ? 'Strata' : 'Dochód'}
          </span>
          <span className={`font-bold ${g.cls}`}>
            {g.text}
          </span>
        </div>

        {/* Tax */}
        {!result.isLoss ? (
          <div className="flex items-center justify-between">
            <span className="text-danger font-medium">
              Podatek 19%
              <span className="ml-1.5 text-text-muted font-normal">
                {fmtPLNGrosze(result.gainPLN)} × 0,19
              </span>
            </span>
            <span className="font-bold text-danger">
              {fmtPLNGrosze(result.taxEstimatePLN)}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-text-muted">Podatek</span>
            <span className="text-text-muted font-medium">brak (strata)</span>
          </div>
        )}
      </div>
    </div>
  );
}

function CalcLine({
  label,
  amount,
  currency,
  rate,
  isPLN,
  resultPLN,
  subtract,
  minor,
}: {
  label: string;
  amount: number;
  currency: string;
  rate: number;
  isPLN: boolean;
  resultPLN: number;
  subtract?: boolean;
  minor?: boolean;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-2 ${minor ? 'text-[11px] text-text-muted' : ''}`}>
      <div className="flex items-baseline gap-1 min-w-0">
        <span className={`flex-shrink-0 ${minor ? '' : 'font-medium text-text-secondary'}`}>
          {subtract && <span className="text-danger  mr-0.5">−</span>}
          {label}
        </span>
        <span className="text-text-muted truncate">
          {fmtAmt(amount)} {currency}
          {!isPLN && ` × ${rate.toFixed(4)}`}
        </span>
      </div>
      <span className={`flex-shrink-0 font-semibold whitespace-nowrap ${subtract ? 'text-text-secondary' : 'text-text-primary'}`}>
        {subtract ? `−${fmtPLNGrosze(resultPLN)}` : fmtPLNGrosze(resultPLN)}
      </span>
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
    <div className="rounded-xl border border-border bg-bg-card shadow-sm overflow-hidden transition-shadow hover:shadow-md">
      {/* Collapsed summary bar */}
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3 text-left select-none transition-colors hover:bg-bg-card/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-primary"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-label={`Transakcja ${index}`}
      >
        {/* Index badge */}
        <span className="w-7 h-7 rounded-full bg-bg-hover/40 text-accent-primary/80 text-xs font-bold inline-flex items-center justify-center flex-shrink-0">
          {index}
        </span>

        {/* Ticker + name */}
        <div className="flex items-center gap-1.5 min-w-0 flex-shrink-0">
          {tx.ticker ? (
            <span className="inline-flex items-center gap-1 bg-accent-primary/10 text-accent-primary px-2 py-0.5 rounded font-semibold text-xs tracking-wide">
              <TrendingUp size={10} aria-hidden="true" />
              {tx.ticker}
            </span>
          ) : (
            <span className="text-text-muted text-sm">—</span>
          )}
          {tx.tickerName && (
            <span className="text-text-muted text-xs truncate max-w-[120px] hidden lg:inline">
              {tx.tickerName}
            </span>
          )}
        </div>

        {/* Sale date */}
        <span className="text-sm text-text-secondary whitespace-nowrap hidden sm:inline">
          {tx.saleDate ? fmtDatePL(tx.saleDate) : <span className="text-text-muted italic text-xs">Brak daty</span>}
        </span>

        {/* Amount */}
        <span className="text-sm tabular-nums text-text-muted whitespace-nowrap hidden md:inline ml-auto">
          {tx.saleGrossAmount > 0
            ? `${tx.saleGrossAmount.toLocaleString('pl-PL', { maximumFractionDigits: 2 })} ${tx.currency}`
            : ''}
        </span>

        {/* Gain/loss */}
        <span className={`text-sm tabular-nums font-semibold whitespace-nowrap ${gainInfo?.cls ?? 'text-text-muted'} ${tx.saleGrossAmount > 0 ? '' : 'md:ml-auto'}`}>
          {gainInfo ? gainInfo.text : '—'}
        </span>

        {/* Tax */}
        {result && !result.isLoss ? (
          <span className="text-xs tabular-nums text-danger font-medium whitespace-nowrap hidden sm:inline">
            {fmtPLNGrosze(result.taxEstimatePLN)}
          </span>
        ) : null}

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0 ml-1">
          {tx.importSource && (
            <span className="inline-flex items-center bg-bg-hover/60 text-text-muted px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide">
              {tx.importSource}
            </span>
          )}
          {tx.notes && (
            <span className="inline-flex items-center text-text-muted text-[10px] italic truncate max-w-[80px] hidden sm:inline-flex" title={tx.notes}>
              {tx.notes}
            </span>
          )}
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onDelete(); } }}
            className="p-1.5 text-text-muted hover:text-danger rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-danger transition-colors"
            aria-label="Usuń transakcję"
          >
            <Trash2 size={14} aria-hidden="true" />
          </span>
          {isExpanded
            ? <ChevronUp size={14} className="text-text-muted" aria-hidden="true" />
            : <ChevronDown size={14} className="text-text-muted" aria-hidden="true" />
          }
        </div>
      </button>

      {/* Expanded edit form */}
      {isExpanded && (
        <div className="border-t border-border bg-bg-card/50 px-4 py-4 space-y-4">

          {/* Ticker (optional) */}
          <div className="space-y-1">
            <label htmlFor={`${tx.id}-ticker`} className={LABEL_CLS}>
              Ticker giełdowy
              <span className="ml-1 text-text-muted font-normal">(opcjonalne)</span>
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

          {/* Sale: date, amount, currency */}
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
                placeholder="np. 19 500.00…"
                className={INPUT_CLS}
              />
            </div>

            <div className="space-y-1 col-span-2 sm:col-span-1">
              <label htmlFor={`${tx.id}-currency`} className={LABEL_CLS}>
                Waluta sprzedaży <span className="text-danger">*</span>
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
              className="rounded border-border text-accent-primary focus:ring-accent-primary"
            />
            <span className="text-text-secondary">
              Koszt nabycia = 0
              <span className="ml-1.5 text-text-muted text-xs font-normal">
                (grant, RSU, akcje przyznane nieodpłatnie)
              </span>
            </span>
          </label>

          {/* Acquisition fields */}
          {!tx.zeroCostFlag && (
            <div className="pt-2 border-t border-dashed border-border space-y-3">
              {/* Dual currency toggle */}
              <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showDualCurrency}
                  onChange={(e) => handleDualCurrencyToggle(e.target.checked)}
                  className="rounded border-border text-accent-primary focus:ring-accent-primary"
                />
                <ArrowRightLeft size={12} className="text-text-muted" aria-hidden="true" />
                <span className="text-text-secondary">
                  Inna waluta nabycia niż sprzedaży
                </span>
              </label>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                    currency={effectiveAcqCurrency}
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
                    placeholder="np. 15 000.00…"
                    className={INPUT_CLS}
                  />
                </div>

                {showDualCurrency && (
                  <div className="space-y-1 col-span-2 sm:col-span-1">
                    <label htmlFor={`${tx.id}-acq-currency`} className={LABEL_CLS}>
                      Waluta nabycia <span className="text-danger">*</span>
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
                className="text-xs text-text-muted hover:text-accent-primary underline underline-offset-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-primary rounded"
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
                      className="text-[11px] text-text-muted hover:text-text-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-primary rounded"
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

          {/* Notes */}
          <div className="space-y-1 pt-1">
            <label htmlFor={`${tx.id}-notes`} className={LABEL_CLS}>
              Notatka
              <span className="ml-1 text-text-muted font-normal">(opcjonalne)</span>
            </label>
            <textarea
              id={`${tx.id}-notes`}
              value={tx.notes ?? ''}
              onChange={(e) => onUpdate({ notes: e.target.value || undefined })}
              placeholder="np. RS, ESPP, SO — typ planu, zlecenie, numer umowy…"
              maxLength={500}
              rows={2}
              spellCheck={false}
              className={`${INPUT_CLS} resize-none`}
            />
          </div>

          {/* Result bar */}
          {result && <CalculationBreakdown tx={tx} result={result} />}
          {!result && tx.saleGrossAmount > 0 && tx.saleDate && (
            <p className="text-xs text-text-muted">
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
