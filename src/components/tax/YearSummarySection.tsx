import { useMemo } from 'react';
import { Info } from 'lucide-react';
import { calcTransactionResult, calcMultiTaxSummary } from '../../utils/taxCalculator';
import { fmtPLNGrosze } from '../../utils/formatting';
import type { TaxTransaction, MultiTaxSummary } from '../../types/tax';
import { fmtGain, fmtDatePL } from './taxHelpers';

// ─── Summary Cell ─────────────────────────────────────────────────────────────

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

// ─── Year Summary Section ─────────────────────────────────────────────────────

export function YearSummarySection({
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

// ─── Year Summary ─────────────────────────────────────────────────────────────

export function YearSummary({ transactions }: { transactions: TaxTransaction[] }) {
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

