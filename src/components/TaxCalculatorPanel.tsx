import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Receipt,
  Plus,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Upload,
  Shield,
  HelpCircle,
  Undo2,
  X,
  Trash2,
} from 'lucide-react';
import { calcTransactionResult } from '../utils/taxCalculator';
import { BROKER_PARSERS } from '../utils/brokerParsers/index';
import { TaxTransactionsSchema } from '../utils/schemas';
import type { TaxTransaction } from '../types/tax';
import type { CurrencyRates } from '../hooks/useCurrencyRates';
import { newTransaction, fmtDatePL } from './tax/taxHelpers';
import { TransactionCard } from './tax/TransactionCard';
import { YearSummary } from './tax/YearSummarySection';

export interface TaxCalculatorPanelProps {
  // Kept for backward compatibility with App.tsx — not used in the new multi-transaction UI.
  currencyRates?: CurrencyRates;
}

const STORAGE_KEY = 'njord_tax_transactions';

// ─── Main Component ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function TaxCalculatorPanel(_props: TaxCalculatorPanelProps) {
  const [storageCorrupted] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return false;
      const result = TaxTransactionsSchema.safeParse(JSON.parse(stored));
      return !result.success;
    } catch {
      return false;
    }
  });
  const [transactions, setTransactions] = useState<TaxTransaction[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      const result = TaxTransactionsSchema.safeParse(parsed);
      if (!result.success) {
        console.warn('[TaxCalculatorPanel] localStorage validation failed:', result.error.issues.slice(0, 3));
        // Don't set state here (can't call setState in initializer) — defer to useEffect
      }
      // Return raw data best-effort (transactions may have extra transient fields)
      return Array.isArray(parsed) ? (parsed as TaxTransaction[]) : [];
    } catch {
      return [];
    }
  });

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  /** When user edits any imported transaction, undo is no longer meaningful. */
  const [undoInvalidated, setUndoInvalidated] = useState(false);

  // Persist to localStorage on every change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    } catch { /* ignore quota errors */ }
  }, [transactions]);


  const updateTransaction = useCallback((id: string, patch: Partial<TaxTransaction>) => {
    setUndoInvalidated(true);
    setTransactions((prev) => prev.map((tx) => (tx.id === id ? { ...tx, ...patch } : tx)));
  }, []);

  const addTransaction = useCallback(() => {
    const tx = newTransaction();
    setTransactions((prev) => [...prev, tx]);
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
    // Sort by date key ascending; entries with no date ('') go last.
    return [...groups.entries()].sort(([a], [b]) => {
      if (a === '' && b === '') return 0;
      if (a === '') return 1;
      if (b === '') return -1;
      return a.localeCompare(b);
    });
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
  /** Inline confirm state for "Wyczyść wszystkie". */
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const selectedBroker = BROKER_PARSERS.find((b) => b.id === selectedBrokerId) ?? BROKER_PARSERS[0];

  const handleImportFile = useCallback(
    async (file: File) => {
      if (!selectedBroker) return;
      setImportError(null);
      setImportLoading(true);
      setLastImportIds(null);
      setUndoInvalidated(false);
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
    [selectedBroker, setUndoInvalidated],
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
      {/* Storage corruption warning */}
      {storageCorrupted && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200" role="alert">
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            Dane transakcji w pamięci lokalnej mają nieoczekiwany format. Niektóre pola mogły zostać zresetowane.
            {' '}<button type="button" className="underline" onClick={() => { localStorage.removeItem(STORAGE_KEY); window.location.reload(); }}>Wyczyść i zacznij od nowa</button>.
          </span>
        </div>
      )}
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

          {/* Clear all transactions — icon button with inline confirm */}
          {transactions.length > 0 && (
            <div className="relative">
              {confirmClearAll ? (
                <div className="absolute top-full right-0 mt-1 z-20 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-3 space-y-2">
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    Usunąć wszystkie {transactions.length} {transactions.length === 1 ? 'transakcję' : transactions.length < 5 ? 'transakcje' : 'transakcji'}?
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="flex-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg px-2.5 py-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      Tak, usuń
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearAll(false)}
                      className="flex-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
                    >
                      Anuluj
                    </button>
                  </div>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => { setConfirmClearAll((v) => !v); setShowImportDropdown(false); }}
                className="flex items-center justify-center p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                aria-label={`Usuń wszystkie transakcje (${transactions.length})`}
                title={`Usuń wszystkie transakcje (${transactions.length})`}
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
          )}

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
      {lastImportIds && !undoInvalidated && (
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

      {/* Transaction cards — grouped by sale date */}
      {transactions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-10 text-center text-gray-400 dark:text-gray-500 space-y-2">
          <Receipt size={32} className="mx-auto opacity-30" aria-hidden="true" />
          <p className="text-sm">Nie masz jeszcze żadnych transakcji. Dodaj pierwszą transakcję sprzedaży.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {saleDateGroups.map(([dateKey, group]) => {
            const distinctDates = saleDateGroups.filter(([k]) => k !== '').length;
            const showHeader = dateKey !== '' && distinctDates >= 2;
            return (
              <div key={dateKey} className="space-y-2">
                {showHeader && (
                  <div className="flex items-center gap-2 px-1 pt-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-400 dark:bg-blue-500 flex-shrink-0" />
                      <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                        {fmtDatePL(dateKey)}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {group.length === 1
                        ? '1 transakcja'
                        : `${group.length} ${group.length < 5 ? 'transakcje' : 'transakcji'} · wspólny kurs NBP`}
                    </span>
                    <div className="flex-1 border-t border-blue-200 dark:border-blue-800 ml-2" />
                  </div>
                )}
                {group.map(({ tx, globalIndex }) => (
                  <TransactionCard
                    key={tx.id}
                    tx={tx}
                    index={globalIndex}
                    isExpanded={expandedIds.has(tx.id)}
                    onToggle={() => toggleExpanded(tx.id)}
                    onUpdate={(patch) => updateTransaction(tx.id, patch)}
                    onDelete={() => removeTransaction(tx.id)}
                  />
                ))}
              </div>
            );
          })}
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
