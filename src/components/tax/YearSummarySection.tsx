import { useMemo } from 'react';
import { AlertTriangle, FileText, Globe, TrendingDown } from 'lucide-react';
import { calcTransactionResult, calcMultiTaxSummary } from '../../utils/taxCalculator';
import { fmtPLNGrosze } from '../../utils/formatting';
import type { TaxTransaction, MultiTaxSummary, PitZgCurrencyEntry } from '../../types/tax';
import { fmtGain, fmtDatePL } from './taxHelpers';

// ─── Currency → country mapping for PIT-ZG ───────────────────────────────────

const CURRENCY_COUNTRY: Record<string, string> = {
  USD: 'Stany Zjednoczone',
  GBP: 'Wielka Brytania',
  CHF: 'Szwajcaria',
  DKK: 'Dania',
  SEK: 'Szwecja',
};
// EUR is intentionally omitted — ambiguous (DE, NL, IE, FR…)

// ─── Small reusable pieces ───────────────────────────────────────────────────

function FormBadge({ label, color }: { label: string; color: 'blue' | 'orange' }) {
  const cls =
    color === 'blue'
      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700'
      : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-700';
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded ${cls}`}>
      <FileText size={10} aria-hidden="true" />
      {label}
    </span>
  );
}

function SummaryRow({
  label,
  value,
  valueClass,
  note,
  bold,
}: {
  label: string;
  value: string;
  valueClass?: string;
  note?: string;
  bold?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-2 py-1.5 ${bold ? 'border-t border-gray-200 dark:border-gray-600 mt-1 pt-2.5' : ''}`}>
      <span className={`text-xs ${bold ? 'font-semibold text-gray-700 dark:text-gray-200' : 'text-gray-500 dark:text-gray-400'}`}>
        {label}
        {note && <span className="ml-1 text-gray-400 dark:text-gray-500 font-normal">{note}</span>}
      </span>
      <span className={`text-sm tabular-nums font-${bold ? 'bold' : 'semibold'} ${valueClass ?? 'text-gray-800 dark:text-gray-100'}`}>
        {value}
      </span>
    </div>
  );
}

// ─── PIT-ZG section ───────────────────────────────────────────────────────────

function PitZgSection({ entries }: { entries: PitZgCurrencyEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="rounded-xl border border-orange-200 dark:border-orange-800 overflow-hidden">
      {/* Header — merged banner + table title */}
      <div className="bg-orange-50 dark:bg-orange-950/30 px-4 py-3 flex items-start gap-2 border-b border-orange-200 dark:border-orange-800">
        <Globe size={15} className="text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="text-xs text-orange-800 dark:text-orange-200 space-y-0.5">
          <p className="font-semibold uppercase tracking-wide">PIT-ZG — Dochody zagraniczne (per kraj)</p>
          <p className="text-orange-700/80 dark:text-orange-300/80 font-normal normal-case tracking-normal">
            Transakcje w walutach obcych to dochody zagraniczne. Do PIT-38 musisz dołączyć załącznik PIT-ZG — jeden na kraj.
          </p>
        </div>
      </div>

      <div className="divide-y divide-orange-100 dark:divide-orange-900/40">
        {/* Column headers */}
        <div className="grid grid-cols-4 gap-2 px-3 py-1.5 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
          <span>Kraj (waluta)</span>
          <span className="text-right">Przychód</span>
          <span className="text-right">Koszty</span>
          <span className="text-right">Dochód / Strata</span>
        </div>

        {entries.map(({ currency, revenuePLN, costPLN, incomePLN }) => {
          const country = CURRENCY_COUNTRY[currency];
          const isEurAmbiguous = currency === 'EUR';
          const g = fmtGain(incomePLN);
          return (
            <div key={currency} className="grid grid-cols-4 gap-2 px-3 py-2.5 text-xs items-center">
              <div className="flex items-center gap-1.5">
                <span className="bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide flex-shrink-0">
                  {currency}
                </span>
                {country ? (
                  <span className="text-gray-600 dark:text-gray-400 truncate">{country}</span>
                ) : isEurAmbiguous ? (
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <AlertTriangle size={11} aria-hidden="true" />
                    <span className="truncate">określ kraj</span>
                  </span>
                ) : (
                  <span className="text-gray-400 dark:text-gray-500 truncate">określ kraj</span>
                )}
              </div>
              <span className="text-right tabular-nums text-gray-700 dark:text-gray-300 font-medium">
                {fmtPLNGrosze(revenuePLN)}
              </span>
              <span className="text-right tabular-nums text-gray-600 dark:text-gray-400">
                {fmtPLNGrosze(costPLN)}
              </span>
              <span className={`text-right tabular-nums font-semibold ${g.cls}`}>
                {g.text}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="bg-orange-50/50 dark:bg-orange-950/20 px-3 py-2 text-[10px] text-orange-700/70 dark:text-orange-400/70 border-t border-orange-100 dark:border-orange-900/40">
        Podatek zapłacony za granicą: <strong>0 zł</strong> — sprzedaż akcji nie podlega podatkowi u źródła w USA ani UE
        (umowa o unikaniu podwójnego opodatkowania). Belka 19% pobierana wyłącznie w Polsce.
      </div>
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
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {showYearHeader ? `Rok podatkowy ${year}` : 'Podsumowanie roczne'}
        </h3>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <FormBadge label="PIT-38" color="blue" />
          {summary.requiresPitZg && <FormBadge label="PIT-ZG" color="orange" />}
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* ── Per-transaction list ── */}
        <div className="space-y-1">
          {transactions.map((tx) => {
            const r = calcTransactionResult(tx);
            if (!r) return null;
            const g = fmtGain(r.gainPLN);
            const globalIdx = allTransactions.indexOf(tx) + 1;
            const isForeign = tx.currency !== 'PLN';
            return (
              <div key={tx.id} className="flex items-center gap-2 text-xs py-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <span className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                  {globalIdx}
                </span>
                {tx.ticker && (
                  <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide flex-shrink-0">
                    {tx.ticker}
                  </span>
                )}
                {isForeign && (
                  <span className="bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0">
                    {tx.currency}
                  </span>
                )}
                {tx.tickerName && (
                  <span className="truncate text-gray-400 dark:text-gray-500 hidden sm:block max-w-[120px]">
                    {tx.tickerName}
                  </span>
                )}
                <span className="text-gray-400 dark:text-gray-500 flex-shrink-0 ml-auto">
                  {tx.saleDate ? fmtDatePL(tx.saleDate) : '—'}
                </span>
                <span className={`font-semibold tabular-nums flex-shrink-0 ${g.cls}`}>
                  {g.text}
                </span>
              </div>
            );
          })}
        </div>

        {/* ── PIT-38 summary table ── */}
        <div className="rounded-xl border border-blue-100 dark:border-blue-900/60 overflow-hidden">
          <div className="bg-blue-50 dark:bg-blue-950/30 px-3 py-2 flex items-center gap-1.5">
            <FileText size={12} className="text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
              PIT-38 — Podsumowanie
            </span>
          </div>
          <div className="px-4 py-3 space-y-0.5">
            <SummaryRow
              label="Przychód"
              value={fmtPLNGrosze(summary.totalRevenuePLN)}
            />
            <SummaryRow
              label="Koszty uzyskania przychodu"
              value={fmtPLNGrosze(summary.totalCostPLN)}
            />
            {summary.totalLossPLN > 0 && (
              <SummaryRow
                label="Zyski brutto"
                value={fmtPLNGrosze(summary.totalGainPLN)}
                valueClass="text-green-700 dark:text-green-400"
              />
            )}
            {summary.totalLossPLN > 0 && (
              <SummaryRow
                label="Straty (odliczane od zysków)"
                value={`−${fmtPLNGrosze(summary.totalLossPLN)}`}
                valueClass="text-red-600 dark:text-red-400"
              />
            )}
            <SummaryRow
              label="Dochód netto"
              note="(po odliczeniu strat)"
              value={`${summary.netIncomePLN >= 0 ? '+' : ''}${fmtPLNGrosze(summary.netIncomePLN)}`}
              valueClass={summary.netIncomePLN >= 0 ? 'text-gray-800 dark:text-gray-100' : 'text-red-600 dark:text-red-400'}
              bold
            />
          </div>
        </div>

        {/* ── PIT-ZG section ── */}
        {summary.requiresPitZg && <PitZgSection entries={summary.pitZgByCurrency} />}

        {/* ── Tax due box ── */}
        <div className={`rounded-xl border px-5 py-4 flex items-center justify-between gap-4 ${
          summary.taxDuePLN > 0
            ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
            : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
        }`}>
          <div>
            <p className={`text-xs font-semibold mb-0.5 ${summary.taxDuePLN > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>
              Podatek należny (PIT-38)
            </p>
            <p className={`text-[11px] ${summary.taxDuePLN > 0 ? 'text-amber-600/70 dark:text-amber-500/70' : 'text-gray-400 dark:text-gray-500'}`}>
              {summary.netIncomePLN > 0
                ? `19% od ${fmtPLNGrosze(summary.netIncomePLN)}`
                : 'brak podatku — dochód ≤ 0'}
            </p>
          </div>
          <p className={`text-2xl font-bold tabular-nums flex-shrink-0 ${
            summary.taxDuePLN > 0 ? 'text-amber-800 dark:text-amber-300' : 'text-gray-400 dark:text-gray-500'
          }`}>
            {fmtPLNGrosze(summary.taxDuePLN)}
          </p>
        </div>

        {/* ── Loss carryforward note ── */}
        {summary.netIncomePLN < 0 && (
          <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-xl px-4 py-3 text-xs text-blue-700 dark:text-blue-300">
            <TrendingDown size={14} className="flex-shrink-0 mt-0.5 text-blue-500 dark:text-blue-400" aria-hidden="true" />
            <span>
              Łączna strata <strong>{fmtPLNGrosze(-summary.netIncomePLN)}</strong> może być odliczona
              od zysków kapitałowych w PIT-38 przez kolejne 5 lat (maks. 50% straty rocznie).
            </span>
          </div>
        )}
      </div>
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

