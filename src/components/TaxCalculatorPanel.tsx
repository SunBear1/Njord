import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Receipt,
  Plus,
  Trash2,
  Info,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  TrendingUp,
} from 'lucide-react';
import { calcTransactionResult, calcMultiTaxSummary } from '../utils/taxCalculator';
import { fetchNbpTableARate } from '../utils/fetchNbpTableARate';
import { fetchTickerName } from '../utils/fetchTickerName';
import { fmtPLN } from '../utils/formatting';
import type { TaxTransaction, TransactionTaxResult, MultiTaxSummary } from '../types/tax';
import type { CurrencyRates } from '../hooks/useCurrencyRates';

export interface TaxCalculatorPanelProps {
  // Kept for backward compatibility with App.tsx — not used in the new multi-transaction UI.
  currencyRates?: CurrencyRates;
}

const STORAGE_KEY = 'njord_tax_transactions';
const INPUT_CLS =
  'w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 ' +
  'dark:placeholder-gray-400';
const LABEL_CLS = 'text-xs font-medium text-gray-600 dark:text-gray-400';
const DEBOUNCE_MS = 500;

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CHF', 'DKK', 'SEK', 'PLN'] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function newTransaction(): TaxTransaction {
  return {
    id: generateId(),
    tradeType: 'sale',
    acquisitionMode: 'purchase',
    zeroCostFlag: false,
    saleDate: '',
    currency: 'USD',
    saleGrossAmount: 0,
    acquisitionCostAmount: 0,
    saleBrokerFee: 0,
    acquisitionBrokerFee: 0,
    exchangeRateSaleToPLN: null,
    exchangeRateAcquisitionToPLN: null,
    showCommissions: false,
  };
}

function fmtGain(gain: number): { text: string; cls: string } {
  if (gain > 0) return { text: `+${fmtPLN(gain)}`, cls: 'text-green-700 dark:text-green-400' };
  if (gain < 0) return { text: fmtPLN(gain), cls: 'text-red-600 dark:text-red-400' };
  return { text: fmtPLN(0), cls: 'text-gray-600 dark:text-gray-300' };
}

/** Returns YYYY-MM-DD of (date − 1 day), or undefined if date is empty. */
function subtractOneDay(dateStr: string): string | undefined {
  if (!dateStr) return undefined;
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

// ─── Main Component ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function TaxCalculatorPanel(_props: TaxCalculatorPanelProps) {
  const [transactions, setTransactions] = useState<TaxTransaction[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as TaxTransaction[]) : [];
    } catch {
      return [];
    }
  });

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const txs = JSON.parse(stored) as TaxTransaction[];
        return new Set(txs.map((t) => t.id));
      }
    } catch { /* ignore */ }
    return new Set();
  });

  // Persist to localStorage on every change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    } catch { /* ignore quota errors */ }
  }, [transactions]);

  const summary: MultiTaxSummary = useMemo(
    () => calcMultiTaxSummary(transactions),
    [transactions],
  );

  const updateTransaction = useCallback((id: string, patch: Partial<TaxTransaction>) => {
    setTransactions((prev) => prev.map((tx) => (tx.id === id ? { ...tx, ...patch } : tx)));
  }, []);

  const addTransaction = useCallback(() => {
    const tx = newTransaction();
    setTransactions((prev) => [...prev, tx]);
    setExpandedIds((prev) => new Set([...prev, tx.id]));
  }, []);

  const removeTransaction = useCallback((id: string) => {
    setTransactions((prev) => prev.filter((tx) => tx.id !== id));
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const readyCount = transactions.filter((tx) => calcTransactionResult(tx) !== null).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <Receipt size={22} className="text-blue-600 dark:text-blue-400" aria-hidden="true" />
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Kalkulator podatku Belki
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Oblicz podatek 19% od zysku ze sprzedaży akcji, ETF i innych papierów wartościowych
          </p>
        </div>
      </div>

      {/* Transaction cards */}
      <div className="space-y-3">
        {transactions.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-10 text-center text-gray-400 dark:text-gray-500 space-y-2">
            <Receipt size={32} className="mx-auto opacity-30" aria-hidden="true" />
            <p className="text-sm">Nie masz jeszcze żadnych transakcji. Dodaj pierwszą transakcję sprzedaży.</p>
          </div>
        )}
        {transactions.map((tx, idx) => (
          <TaxTransactionCard
            key={tx.id}
            tx={tx}
            index={idx + 1}
            isExpanded={expandedIds.has(tx.id)}
            onToggle={() => toggleExpanded(tx.id)}
            onUpdate={(patch) => updateTransaction(tx.id, patch)}
            onDelete={() => removeTransaction(tx.id)}
          />
        ))}
      </div>

      {/* Add button */}
      <button
        type="button"
        onClick={addTransaction}
        className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg px-3 py-2 border border-dashed border-blue-300 dark:border-blue-700 hover:border-blue-500 dark:hover:border-blue-500 w-full justify-center transition-colors"
      >
        <Plus size={16} aria-hidden="true" />
        Dodaj transakcję
      </button>

      {/* Year summary */}
      {readyCount > 0 && <YearSummary summary={summary} transactions={transactions} />}

      {/* Disclaimer */}
      <p className="text-xs text-gray-400 dark:text-gray-500 text-center pb-1">
        Kalkulator uproszczony — służy do szacowania podatku Belki.
        Nie zastępuje doradztwa podatkowego ani pełnej ewidencji PIT-38.
      </p>
    </div>
  );
}

// ─── Transaction Card ─────────────────────────────────────────────────────────

interface TaxTransactionCardProps {
  tx: TaxTransaction;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<TaxTransaction>) => void;
  onDelete: () => void;
}

function TaxTransactionCard({
  tx,
  index,
  isExpanded,
  onToggle,
  onUpdate,
  onDelete,
}: TaxTransactionCardProps) {
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

  useEffect(() => {
    return () => {
      if (saleTimerRef.current) clearTimeout(saleTimerRef.current);
      if (acqTimerRef.current) clearTimeout(acqTimerRef.current);
      if (tickerTimerRef.current) clearTimeout(tickerTimerRef.current);
    };
  }, []);

  const triggerFetchSale = useCallback(
    (date: string, currency: string) => {
      if (!date) return;
      if (currency.toUpperCase() === 'PLN') {
        onUpdate({ exchangeRateSaleToPLN: 1, rateSaleEffectiveDate: date, isLoadingRateSale: false });
        return;
      }
      onUpdate({ isLoadingRateSale: true, rateSaleError: undefined });
      fetchNbpTableARate(date, currency)
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
      onUpdate({ isLoadingRateAcquisition: true, rateAcquisitionError: undefined });
      fetchNbpTableARate(date, currency)
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

  const acqDateError =
    tx.acquisitionDate && tx.saleDate && tx.acquisitionDate > tx.saleDate
      ? 'Data nabycia nie może być późniejsza niż data sprzedaży.'
      : undefined;

  const gainInfo = result ? fmtGain(result.gainPLN) : null;
  const hasCommissions =
    (tx.saleBrokerFee ?? 0) > 0 || (tx.acquisitionBrokerFee ?? 0) > 0;
  const showCommissions = tx.showCommissions || hasCommissions;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Card header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 select-none"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onToggle()}
        aria-expanded={isExpanded}
        aria-label={`Transakcja ${index}`}
      >
        <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center flex-shrink-0">
          {index}
        </span>

        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {/* Ticker badge */}
          {tx.ticker && (
            <span className="inline-flex items-center gap-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded font-semibold text-xs tracking-wide">
              <TrendingUp size={10} aria-hidden="true" />
              {tx.ticker}
            </span>
          )}
          {tx.tickerName && (
            <span className="text-gray-500 dark:text-gray-400 text-xs truncate max-w-[180px]">
              {tx.tickerName}
            </span>
          )}
          {tx.saleDate ? (
            <span className="text-gray-700 dark:text-gray-200 font-medium">{tx.saleDate}</span>
          ) : (
            <span className="text-gray-400 dark:text-gray-500 italic">Brak daty sprzedaży</span>
          )}
          {tx.saleGrossAmount > 0 && (
            <span className="text-gray-500 dark:text-gray-400 tabular-nums">
              {tx.saleGrossAmount.toLocaleString('pl-PL', { maximumFractionDigits: 2 })} {tx.currency}
            </span>
          )}
          {gainInfo && (
            <span className={`font-semibold tabular-nums ${gainInfo.cls}`}>
              {gainInfo.text}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-colors"
            aria-label="Usuń transakcję"
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
          {isExpanded
            ? <ChevronUp size={15} className="text-gray-400" aria-hidden="true" />
            : <ChevronDown size={15} className="text-gray-400" aria-hidden="true" />
          }
        </div>
      </div>

      {/* Card body */}
      {isExpanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-4 space-y-4">

          {/* Row 0: Ticker (optional) */}
          <div className="space-y-1">
            <label className={LABEL_CLS}>
              Ticker giełdowy
              <span className="ml-1 text-gray-400 dark:text-gray-500 font-normal">(opcjonalne)</span>
            </label>
            <div className="relative">
              <input
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

          {/* Row 1: Sale date, sale amount, currency */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className={LABEL_CLS}>
                Data sprzedaży <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={tx.saleDate}
                onChange={(e) => handleSaleDateChange(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
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
              <label className={LABEL_CLS}>
                Kwota sprzedaży brutto <span className="text-red-500">*</span>
              </label>
              <input
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
              <label className={LABEL_CLS}>
                Waluta <span className="text-red-500">*</span>
              </label>
              <select
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
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-700 dark:text-gray-300">
              Koszt nabycia = 0
              <span className="ml-1.5 text-gray-400 dark:text-gray-500 text-xs font-normal">
                (grant, RSU, akcje przyznane nieodpłatnie)
              </span>
            </span>
          </label>

          {/* Acquisition fields (conditional) */}
          {!tx.zeroCostFlag && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 pt-2 border-t border-dashed border-gray-200 dark:border-gray-700">
              <div className="space-y-1">
                <label className={LABEL_CLS}>
                  Data nabycia <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={tx.acquisitionDate ?? ''}
                  onChange={(e) => handleAcqDateChange(e.target.value)}
                  max={subtractOneDay(tx.saleDate)}
                  className={`${INPUT_CLS} ${acqDateError ? 'border-red-400 dark:border-red-500' : ''}`}
                />
                {acqDateError ? (
                  <p className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertTriangle size={10} aria-hidden="true" />
                    {acqDateError}
                  </p>
                ) : (
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
                )}
              </div>

              <div className="space-y-1">
                <label className={LABEL_CLS}>
                  Koszt nabycia <span className="text-red-500">*</span>
                </label>
                <input
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
                    <label className={LABEL_CLS}>Prowizja sprzedaży</label>
                    <input
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
                      <label className={LABEL_CLS}>Prowizja zakupu</label>
                      <input
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
          {result && !acqDateError && (
            <div className="flex flex-wrap items-stretch gap-px bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 mt-1">
              <ResultCell label="Przychód" value={fmtPLN(result.revenuePLN)} />
              <ResultCell label="Koszt" value={fmtPLN(result.costPLN)} subtract />
              <ResultCell
                label={result.isLoss ? 'Strata' : 'Zysk'}
                value={fmtGain(result.gainPLN).text}
                valueClass={fmtGain(result.gainPLN).cls}
                total
              />
              {!result.isLoss && (
                <ResultCell
                  label="Podatek (est.)"
                  value={fmtPLN(result.taxEstimatePLN)}
                  valueClass="text-amber-700 dark:text-amber-400"
                />
              )}
            </div>
          )}

          {/* Not-ready hint */}
          {!result && tx.saleGrossAmount > 0 && tx.saleDate && !acqDateError && (
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
      <p className="text-[11px] text-green-600 dark:text-green-400 flex items-center gap-1">
        <CheckCircle2 size={10} aria-hidden="true" />
        Kurs NBP: {rate.toFixed(4)}
        {effectiveDate && (
          <span className="text-gray-400 dark:text-gray-500"> z {effectiveDate}</span>
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

// ─── Year Summary ─────────────────────────────────────────────────────────────

function YearSummary({
  summary,
  transactions,
}: {
  summary: MultiTaxSummary;
  transactions: TaxTransaction[];
}) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
        <Info size={14} className="text-gray-400" aria-hidden="true" />
        Podsumowanie roczne (PIT-38)
      </h3>

      {/* Per-transaction summary rows */}
      {transactions.some((tx) => calcTransactionResult(tx) !== null) && (
        <div className="space-y-1.5">
          {transactions.map((tx, idx) => {
            const r = calcTransactionResult(tx);
            if (!r) return null;
            const g = fmtGain(r.gainPLN);
            return (
              <div
                key={tx.id}
                className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400"
              >
                <span className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                  {idx + 1}
                </span>
                {tx.ticker && (
                  <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide flex-shrink-0">
                    {tx.ticker}
                  </span>
                )}
                {tx.tickerName && (
                  <span className="truncate text-gray-500 dark:text-gray-500 hidden sm:block max-w-[140px]">
                    {tx.tickerName}
                  </span>
                )}
                <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">
                  {tx.saleDate || '—'}
                </span>
                <span className={`ml-auto font-semibold tabular-nums flex-shrink-0 ${g.cls}`}>
                  {g.text}
                </span>
                {!r.isLoss && (
                  <span className="text-amber-700 dark:text-amber-400 tabular-nums flex-shrink-0 font-medium">
                    {fmtPLN(r.taxEstimatePLN)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <hr className="border-gray-200 dark:border-gray-600" />

      {/* 4-cell totals grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCell label="Suma przychodów" value={fmtPLN(summary.totalRevenuePLN)} />
        <SummaryCell label="Suma kosztów" value={fmtPLN(summary.totalCostPLN)} />
        <SummaryCell
          label="Zyski"
          value={fmtPLN(summary.totalGainPLN)}
          cls="text-green-700 dark:text-green-400"
        />
        <SummaryCell
          label="Straty"
          value={summary.totalLossPLN > 0 ? `−${fmtPLN(summary.totalLossPLN)}` : fmtPLN(0)}
          cls={summary.totalLossPLN > 0 ? 'text-red-600 dark:text-red-400' : undefined}
        />
      </div>

      {/* Net income + tax due */}
      <div className="border-t border-gray-200 dark:border-gray-600 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Dochód netto (PIT-38)</p>
          <p
            className={`text-lg font-bold tabular-nums ${
              summary.netIncomePLN >= 0
                ? 'text-gray-800 dark:text-gray-100'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {summary.netIncomePLN >= 0 ? '+' : ''}
            {fmtPLN(summary.netIncomePLN)}
          </p>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl px-5 py-3 text-center min-w-[160px]">
          <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-1">
            Podatek należny
          </p>
          <p className="text-2xl font-bold text-amber-800 dark:text-amber-300 tabular-nums">
            {fmtPLN(summary.taxDuePLN)}
          </p>
          <p className="text-[11px] text-amber-600/70 dark:text-amber-500/70 mt-0.5">
            {summary.netIncomePLN > 0
              ? `19% od ${fmtPLN(summary.netIncomePLN)}`
              : 'brak podatku'}
          </p>
        </div>
      </div>

      {/* Loss carryforward note */}
      {summary.netIncomePLN < 0 && (
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-lg px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
          Łączna strata może być odliczona od zysków kapitałowych w PIT-38 przez kolejne 5 lat
          (maksymalnie 50% straty rocznie).
        </div>
      )}
    </div>
  );
}

function SummaryCell({
  label,
  value,
  cls,
}: {
  label: string;
  value: string;
  cls?: string;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${cls ?? 'text-gray-800 dark:text-gray-100'}`}>
        {value}
      </p>
    </div>
  );
}
