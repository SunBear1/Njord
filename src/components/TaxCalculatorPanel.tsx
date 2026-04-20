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
  Upload,
  Shield,
  HelpCircle,
  Undo2,
  X,
} from 'lucide-react';
import { calcTransactionResult, calcMultiTaxSummary } from '../utils/taxCalculator';
import { fetchNbpTableARate } from '../utils/fetchNbpTableARate';
import { fetchTickerName } from '../utils/fetchTickerName';
import { BROKER_PARSERS } from '../utils/brokerParsers/index';
import { fmtPLNGrosze } from '../utils/formatting';
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
const COL_COUNT = 9;

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
  if (gain > 0) return { text: `+${fmtPLNGrosze(gain)}`, cls: 'text-green-700 dark:text-green-400' };
  if (gain < 0) return { text: fmtPLNGrosze(gain), cls: 'text-red-600 dark:text-red-400' };
  return { text: fmtPLNGrosze(0), cls: 'text-gray-600 dark:text-gray-300' };
}

/** Returns YYYY-MM-DD of (date − 1 day), or '' if date is empty. */
function subtractOneDay(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

/** Formats YYYY-MM-DD → "19 kwietnia 2026" (Polish locale). */
function fmtDatePL(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Parses DD/MM/RRRR → YYYY-MM-DD, or null if invalid. */
function parsePLDate(value: string): string | null {
  if (!value || value.length < 10) return null;
  const parts = value.split('/');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  if (dd.length !== 2 || mm.length !== 2 || yyyy.length !== 4) return null;
  const day = parseInt(dd, 10);
  const month = parseInt(mm, 10);
  const year = parseInt(yyyy, 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 1900 || year > 2100) return null;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return `${yyyy}-${mm}-${dd}`;
}

/** Converts YYYY-MM-DD → DD/MM/RRRR for display. */
function isoToPLDate(iso: string): string {
  if (!iso || iso.length !== 10) return '';
  const [yyyy, mm, dd] = iso.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

// ─── Polish Date Input ────────────────────────────────────────────────────────

/**
 * Text input that accepts dates in Polish DD/MM/RRRR format.
 * Auto-inserts slashes. Validates on complete entry.
 * Calls onChange(isoDate) when valid, onChange('') when cleared/invalid.
 */
function PolishDateInput({
  id,
  value,
  onChange,
  maxDate,
  maxDateMessage,
  className = '',
}: {
  id?: string;
  value: string;
  onChange: (isoDate: string) => void;
  maxDate?: string;
  maxDateMessage?: string;
  className?: string;
}) {
  const [display, setDisplay] = useState(() => isoToPLDate(value));
  const [error, setError] = useState<string | undefined>();

  // Sync display when the ISO value changes externally (e.g. transaction cleared).
  useEffect(() => {
    const currentISO = parsePLDate(display) ?? '';
    if (currentISO !== value) {
      setDisplay(isoToPLDate(value));
      setError(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = raw.replace(/\D/g, '');

    let formatted: string;
    if (digits.length <= 2) formatted = digits;
    else if (digits.length <= 4) formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    else formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;

    setDisplay(formatted);

    if (!formatted) { setError(undefined); onChange(''); return; }
    if (formatted.length < 10) { setError(undefined); onChange(''); return; }

    const parsed = parsePLDate(formatted);
    if (!parsed) { setError('Nieprawidłowa data — oczekiwany format DD/MM/RRRR'); onChange(''); return; }
    if (maxDate && parsed > maxDate) {
      setError(maxDateMessage ?? `Data nie może być późniejsza niż ${isoToPLDate(maxDate)}`);
      onChange('');
      return;
    }
    setError(undefined);
    onChange(parsed);
  }, [onChange, maxDate, maxDateMessage]);

  const hasError = !!error;
  return (
    <div className="space-y-0.5">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        placeholder="DD/MM/RRRR"
        maxLength={10}
        autoComplete="off"
        spellCheck={false}
        className={`${className} ${hasError ? '!border-red-400 dark:!border-red-500 focus:!ring-red-500' : ''}`}
      />
      {hasError && (
        <p className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1">
          <AlertTriangle size={10} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
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


  const updateTransaction = useCallback((id: string, patch: Partial<TaxTransaction>) => {
    undoInvalidatedRef.current = true;
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

  // Group transactions by sale date for visual grouping in the card list.
  const saleDateGroups = useMemo(() => {
    const groups = new Map<string, { tx: TaxTransaction; globalIndex: number }[]>();
    transactions.forEach((tx, idx) => {
      const key = tx.saleDate || '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({ tx, globalIndex: idx + 1 });
    });
    return [...groups.entries()];
  }, [transactions]);

  // ─── Broker import ────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [showImportDropdown, setShowImportDropdown] = useState(false);
  const [selectedBrokerId, setSelectedBrokerId] = useState(BROKER_PARSERS[0]?.id ?? '');
  const [showBrokerHelp, setShowBrokerHelp] = useState(false);
  /** IDs of the last successfully imported batch — used by "Cofnij import". */
  const [lastImportIds, setLastImportIds] = useState<string[] | null>(null);
  const [lastImportCount, setLastImportCount] = useState(0);
  /** When user edits any imported transaction, undo is no longer meaningful. */
  const undoInvalidatedRef = useRef(false);
  /** Inline confirm state for "Wyczyść wszystkie". */
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const selectedBroker = BROKER_PARSERS.find((b) => b.id === selectedBrokerId) ?? BROKER_PARSERS[0];

  const handleImportFile = useCallback(
    async (file: File) => {
      if (!selectedBroker) return;
      setImportError(null);
      setImportLoading(true);
      setLastImportIds(null);
      undoInvalidatedRef.current = false;
      try {
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(
            `Plik jest za duży (${(file.size / 1024 / 1024).toFixed(1)} MB). ` +
              'Maksymalna dozwolona wielkość to 10 MB.',
          );
        }
        if (!file.name.toLowerCase().endsWith('.xlsx')) {
          throw new Error('Plik nie jest prawidłowym arkuszem Excel (.xlsx).');
        }
        const buffer = await file.arrayBuffer();
        const imported = await selectedBroker.parse(buffer);
        setTransactions((prev) => [...prev, ...imported]);
        setExpandedIds((prev) => new Set([...prev, ...imported.map((t) => t.id)]));
        setLastImportIds(imported.map((t) => t.id));
        setLastImportCount(imported.length);
        setShowImportDropdown(false);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Nieznany błąd podczas importu.');
      } finally {
        setImportLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [selectedBroker],
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleImportFile(file);
    },
    [handleImportFile],
  );

  const handleUndoImport = useCallback(() => {
    if (!lastImportIds) return;
    const ids = new Set(lastImportIds);
    setTransactions((prev) => prev.filter((tx) => !ids.has(tx.id)));
    setExpandedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    setLastImportIds(null);
  }, [lastImportIds]);

  const handleClearAll = useCallback(() => {
    setTransactions([]);
    setExpandedIds(new Set());
    setLastImportIds(null);
    setConfirmClearAll(false);
  }, []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <Receipt size={22} className="text-blue-600 dark:text-blue-400 flex-shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              Kalkulator podatku Belki
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Podatek 19% (Belka) od sprzedaży papierów wartościowych · kurs NBP Tabela A
            </p>
          </div>
        </div>

        {/* Privacy badge + Import button */}
        <div className="flex items-center gap-1.5 flex-shrink-0 relative">
          <span
            title="Plik przetwarzany lokalnie — nigdy nie opuszcza urządzenia. Jedyne zapytania sieciowe to publiczne kursy walut z NBP."
            className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-md px-1.5 py-0.5 cursor-default select-none"
            aria-label="Prywatność: plik przetwarzany lokalnie"
          >
            <Shield size={11} aria-hidden="true" />
            <span className="hidden sm:inline">Prywatność</span>
          </span>

          <button
            type="button"
            onClick={() => { setShowImportDropdown((v) => !v); setImportError(null); }}
            disabled={importLoading}
            className="flex items-center gap-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg px-2.5 py-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-expanded={showImportDropdown}
            aria-haspopup="true"
            aria-label="Automatyczny import z brokera"
          >
            {importLoading ? (
              <Loader2 size={13} className="animate-spin" aria-hidden="true" />
            ) : (
              <Upload size={13} aria-hidden="true" />
            )}
            Auto-import
          </button>

          {/* Broker import dropdown */}
          {showImportDropdown && (
            <div className="absolute top-full right-0 mt-1 z-20 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">Importuj historię transakcji</p>
                <button
                  type="button"
                  onClick={() => setShowImportDropdown(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
                  aria-label="Zamknij"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>

              {/* Broker selector — segmented control */}
              <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-xs">
                {BROKER_PARSERS.map((broker, i) => (
                  <button
                    key={broker.id}
                    type="button"
                    onClick={() => { setSelectedBrokerId(broker.id); setShowBrokerHelp(false); }}
                    className={`flex-1 flex flex-col items-center py-2 px-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
                      i > 0 ? 'border-l border-gray-200 dark:border-gray-600' : ''
                    } ${
                      selectedBrokerId === broker.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <span className="font-semibold">{broker.name}</span>
                    <span className={`text-[10px] mt-0.5 ${selectedBrokerId === broker.id ? 'text-blue-100' : 'text-gray-400 dark:text-gray-500'}`}>
                      {broker.fileLabel}
                    </span>
                  </button>
                ))}
              </div>

              {/* Per-broker download help */}
              {selectedBroker && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowBrokerHelp((v) => !v)}
                    className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  >
                    <HelpCircle size={12} aria-hidden="true" />
                    Jak pobrać plik?
                    {showBrokerHelp ? <ChevronUp size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />}
                  </button>
                  {showBrokerHelp && (
                    <div className="mt-1.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2.5 text-[11px] text-gray-600 dark:text-gray-400 space-y-1">
                      <ol className="list-decimal list-inside space-y-0.5">
                        {selectedBroker.downloadInstructions.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                      {selectedBroker.formatNote && (
                        <p className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500">{selectedBroker.formatNote}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Privacy note inside dropdown */}
              <div className="flex items-start gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                <Shield size={11} className="mt-0.5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <span>Plik przetwarzany lokalnie — nigdy nie opuszcza urządzenia. Jedyne zapytania sieciowe to publiczne kursy walut z NBP.</span>
              </div>

              {/* File trigger */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={importLoading || !selectedBroker}
                className="w-full flex items-center justify-center gap-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg px-3 py-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {importLoading ? (
                  <><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Importowanie…</>
                ) : (
                  <><Upload size={13} aria-hidden="true" /> Wybierz plik {selectedBroker?.fileLabel} i importuj</>
                )}
              </button>

              {importError && (
                <div className="flex items-start gap-1.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-[11px] text-red-800 dark:text-red-300">
                  <AlertTriangle size={12} className="mt-0.5 flex-shrink-0 text-red-500" aria-hidden="true" />
                  <span>{importError}</span>
                </div>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={selectedBroker?.fileAccept ?? '.xlsx'}
            onChange={onFileChange}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>
      </div>

      {/* Undo last import banner */}
      {lastImportIds && !undoInvalidatedRef.current && (
        <div className="flex items-center justify-between gap-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={13} className="flex-shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <span>Zaimportowano <strong>{lastImportCount}</strong> {lastImportCount === 1 ? 'transakcję' : lastImportCount < 5 ? 'transakcje' : 'transakcji'} z {selectedBroker?.name ?? 'brokera'}.</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleUndoImport}
              className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:text-red-600 dark:hover:text-red-400 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 rounded"
            >
              <Undo2 size={12} aria-hidden="true" />
              Cofnij import
            </button>
            <button
              type="button"
              onClick={() => setLastImportIds(null)}
              aria-label="Zamknij"
              className="text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 rounded"
            >
              <X size={13} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Transaction table — grouped by sale date */}
      {transactions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-10 text-center text-gray-400 dark:text-gray-500 space-y-2">
          <Receipt size={32} className="mx-auto opacity-30" aria-hidden="true" />
          <p className="text-sm">Nie masz jeszcze żadnych transakcji. Dodaj pierwszą transakcję sprzedaży.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="w-10 px-3 py-2.5 text-center font-medium">#</th>
                <th className="px-3 py-2.5 text-left font-medium">Ticker</th>
                <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">Data sprzedaży</th>
                <th className="px-3 py-2.5 text-right font-medium">Kwota</th>
                <th className="hidden sm:table-cell px-3 py-2.5 text-right font-medium whitespace-nowrap">Przychód PLN</th>
                <th className="hidden sm:table-cell px-3 py-2.5 text-right font-medium whitespace-nowrap">Koszt PLN</th>
                <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap">Zysk/Strata</th>
                <th className="px-3 py-2.5 text-right font-medium">Podatek</th>
                <th className="w-20 px-3 py-2.5"></th>
              </tr>
            </thead>
            {saleDateGroups.map(([dateKey, group]) => {
              const isMulti = group.length > 1 && dateKey !== '';
              return (
                <tbody key={dateKey} className={isMulti ? 'bg-blue-50/20 dark:bg-blue-950/10' : ''}>
                  {isMulti && (
                    <tr>
                      <td colSpan={COL_COUNT} className="px-3 py-2 border-b border-blue-100 dark:border-blue-900/40">
                        <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 dark:bg-blue-500" />
                          Sprzedaż {fmtDatePL(dateKey)} · {group.length} transakcje · 1 kurs NBP
                        </p>
                      </td>
                    </tr>
                  )}
                  {group.map(({ tx, globalIndex }) => (
                    <TransactionTableRow
                      key={tx.id}
                      tx={tx}
                      index={globalIndex}
                      isExpanded={expandedIds.has(tx.id)}
                      onToggle={() => toggleExpanded(tx.id)}
                      onUpdate={(patch) => updateTransaction(tx.id, patch)}
                      onDelete={() => removeTransaction(tx.id)}
                    />
                  ))}
                </tbody>
              );
            })}
          </table>
        </div>
      )}

      {/* Add transaction + Clear all */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={addTransaction}
          className="w-full flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg px-3 py-2 border border-dashed border-blue-300 dark:border-blue-700 hover:border-blue-500 dark:hover:border-blue-500 justify-center transition-colors"
        >
          <Plus size={16} aria-hidden="true" />
          Dodaj transakcję
        </button>

        {transactions.length > 0 && (
          confirmClearAll ? (
            <div className="flex items-center justify-center gap-2 text-xs">
              <span className="text-gray-500 dark:text-gray-400">Na pewno usunąć wszystkie {transactions.length} transakcje?</span>
              <button
                type="button"
                onClick={handleClearAll}
                className="font-semibold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-red-500 rounded transition-colors"
              >
                Tak, usuń
              </button>
              <button
                type="button"
                onClick={() => setConfirmClearAll(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-gray-400 rounded transition-colors"
              >
                Anuluj
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClearAll(true)}
              className="w-full text-center text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-red-400 rounded py-0.5"
            >
              Wyczyść wszystkie transakcje ({transactions.length})
            </button>
          )
        )}
      </div>

      {/* Year summary */}
      {readyCount > 0 && <YearSummary transactions={transactions} />}

      {/* Disclaimer */}
      <p className="text-xs text-gray-400 dark:text-gray-500 text-center pb-1">
        Wyniki na podstawie kursów NBP Tabela A. Ostateczna kwota podatku wynika z pełnej dokumentacji i formularza PIT-38.
      </p>
    </div>
  );
}

// ─── Transaction Table Row ────────────────────────────────────────────────────

interface TransactionTableRowProps {
  tx: TaxTransaction;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<TaxTransaction>) => void;
  onDelete: () => void;
}

function TransactionTableRow({
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
        className={`border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 select-none transition-colors ${isExpanded ? 'bg-gray-50/50 dark:bg-gray-700/30' : ''}`}
        onClick={onToggle}
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onToggle()}
        aria-expanded={isExpanded}
        aria-label={`Transakcja ${index}`}
      >
        <td className="px-3 py-2.5 text-center">
          <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold inline-flex items-center justify-center">
            {index}
          </span>
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            {tx.ticker ? (
              <span className="inline-flex items-center gap-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded font-semibold text-xs tracking-wide">
                <TrendingUp size={10} aria-hidden="true" />
                {tx.ticker}
              </span>
            ) : (
              <span className="text-gray-300 dark:text-gray-600">—</span>
            )}
            {tx.tickerName && (
              <span className="text-gray-400 dark:text-gray-500 text-xs truncate max-w-[120px] hidden lg:inline">
                {tx.tickerName}
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-2.5 text-gray-700 dark:text-gray-200 whitespace-nowrap">
          {tx.saleDate ? fmtDatePL(tx.saleDate) : <span className="text-gray-400 italic text-xs">Brak daty</span>}
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300 whitespace-nowrap">
          {tx.saleGrossAmount > 0
            ? `${tx.saleGrossAmount.toLocaleString('pl-PL', { maximumFractionDigits: 2 })} ${tx.currency}`
            : '—'}
        </td>
        <td className="hidden sm:table-cell px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300 whitespace-nowrap">
          {result ? fmtPLNGrosze(result.revenuePLN) : '—'}
        </td>
        <td className="hidden sm:table-cell px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300 whitespace-nowrap">
          {result ? fmtPLNGrosze(result.costPLN) : '—'}
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
          {gainInfo ? (
            <span className={`font-semibold ${gainInfo.cls}`}>{gainInfo.text}</span>
          ) : '—'}
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
          {result && !result.isLoss ? (
            <span className="text-amber-700 dark:text-amber-400 font-medium">{fmtPLNGrosze(result.taxEstimatePLN)}</span>
          ) : result ? (
            <span className="text-gray-400 dark:text-gray-500">—</span>
          ) : '—'}
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center justify-end gap-1">
            {tx.importSource && (
              <span className="inline-flex items-center bg-gray-100 dark:bg-gray-700/60 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide">
                {tx.importSource}
              </span>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-colors"
              aria-label="Usuń transakcję"
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
            {isExpanded
              ? <ChevronUp size={14} className="text-gray-400" aria-hidden="true" />
              : <ChevronDown size={14} className="text-gray-400" aria-hidden="true" />
            }
          </div>
        </td>
      </tr>

      {/* Expanded edit form */}
      {isExpanded && (
        <tr>
          <td colSpan={COL_COUNT} className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 px-4 py-4">
            <div className="space-y-4">

          {/* Row 0: Ticker (optional) */}
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
                placeholder="np. 19 500.00"
                className={INPUT_CLS}
              />
            </div>

            <div className="space-y-1 col-span-2 sm:col-span-1">
              <label htmlFor={`${tx.id}-currency`} className={LABEL_CLS}>
                Waluta <span className="text-red-500">*</span>
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
                  currency={tx.currency}
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
            <div className="flex flex-wrap items-stretch gap-px bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 mt-1">
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
                  valueClass="text-amber-700 dark:text-amber-400"
                />
              )}
            </div>
          )}

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
          </td>
        </tr>
      )}
    </>
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

function YearSummary({ transactions }: { transactions: TaxTransaction[] }) {
  const byYear = useMemo(() => {
    const groups = new Map<string, TaxTransaction[]>();
    for (const tx of transactions) {
      if (!calcTransactionResult(tx)) continue;
      const year = tx.saleDate.slice(0, 4) || 'Brak roku';
      if (!groups.has(year)) groups.set(year, []);
      groups.get(year)!.push(tx);
    }
    return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [transactions]);

  if (byYear.length === 0) return null;

  return (
    <div className="space-y-4">
      {byYear.map(([year, txsForYear]) => {
        const summary = calcMultiTaxSummary(txsForYear);
        return (
          <YearSummarySection
            key={year}
            year={year}
            transactions={txsForYear}
            allTransactions={transactions}
            summary={summary}
            showYearHeader={byYear.length > 1}
          />
        );
      })}
    </div>
  );
}

function YearSummarySection({
  year,
  transactions,
  allTransactions,
  summary,
  showYearHeader,
}: {
  year: string;
  transactions: TaxTransaction[];
  allTransactions: TaxTransaction[];
  summary: MultiTaxSummary;
  showYearHeader: boolean;
}) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
        <Info size={14} className="text-gray-400" aria-hidden="true" />
        {showYearHeader ? `Rok podatkowy ${year} — PIT-38` : 'Podsumowanie roczne (PIT-38)'}
      </h3>

      {/* Per-transaction rows */}
      <div className="space-y-1.5">
        {transactions.map((tx) => {
          const r = calcTransactionResult(tx);
          if (!r) return null;
          const g = fmtGain(r.gainPLN);
          const globalIdx = allTransactions.indexOf(tx) + 1;
          return (
            <div key={tx.id} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <span className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                {globalIdx}
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
                {tx.saleDate ? fmtDatePL(tx.saleDate) : '—'}
              </span>
              <span className={`ml-auto font-semibold tabular-nums flex-shrink-0 ${g.cls}`}>
                {g.text}
              </span>
              {!r.isLoss && (
                <span className="text-amber-700 dark:text-amber-400 tabular-nums flex-shrink-0 font-medium">
                  {fmtPLNGrosze(r.taxEstimatePLN)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <hr className="border-gray-200 dark:border-gray-600" />

      {/* 4-cell totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCell label="Suma przychodów" value={fmtPLNGrosze(summary.totalRevenuePLN)} />
        <SummaryCell label="Suma kosztów" value={fmtPLNGrosze(summary.totalCostPLN)} />
        <SummaryCell label="Zyski" value={fmtPLNGrosze(summary.totalGainPLN)} cls="text-green-700 dark:text-green-400" />
        <SummaryCell
          label="Straty"
          value={summary.totalLossPLN > 0 ? `−${fmtPLNGrosze(summary.totalLossPLN)}` : fmtPLNGrosze(0)}
          cls={summary.totalLossPLN > 0 ? 'text-red-600 dark:text-red-400' : undefined}
        />
      </div>

      {/* Net income + tax due */}
      <div className="border-t border-gray-200 dark:border-gray-600 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Dochód netto (PIT-38)</p>
          <p className={`text-lg font-bold tabular-nums ${summary.netIncomePLN >= 0 ? 'text-gray-800 dark:text-gray-100' : 'text-red-600 dark:text-red-400'}`}>
            {summary.netIncomePLN >= 0 ? '+' : ''}{fmtPLNGrosze(summary.netIncomePLN)}
          </p>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl px-5 py-3 text-center min-w-[160px]">
          <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-1">Podatek należny</p>
          <p className="text-2xl font-bold text-amber-800 dark:text-amber-300 tabular-nums">
            {fmtPLNGrosze(summary.taxDuePLN)}
          </p>
          <p className="text-[11px] text-amber-600/70 dark:text-amber-500/70 mt-0.5">
            {summary.netIncomePLN > 0 ? `19% od ${fmtPLNGrosze(summary.netIncomePLN)}` : 'brak podatku'}
          </p>
        </div>
      </div>

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
