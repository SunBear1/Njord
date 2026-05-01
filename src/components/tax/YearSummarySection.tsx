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
      ? 'bg-accent-primary/10 text-accent-primary border border-accent-primary/30'
      : 'bg-accent-secondary/10 text-accent-secondary border border-accent-secondary/30';
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
    <div className={`flex items-center justify-between gap-2 py-1.5 ${bold ? 'border-t border-border mt-1 pt-2.5' : ''}`}>
      <span className={`text-xs ${bold ? 'font-semibold text-text-secondary' : 'text-text-muted'}`}>
        {label}
        {note && <span className="ml-1 text-text-muted font-normal">{note}</span>}
      </span>
      <span className={`text-sm tabular-nums font-${bold ? 'bold' : 'semibold'} ${valueClass ?? 'text-text-primary'}`}>
        {value}
      </span>
    </div>
  );
}

// ─── PIT-ZG section ───────────────────────────────────────────────────────────

function PitZgSection({ entries }: { entries: PitZgCurrencyEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="rounded-xl border border-danger/30 overflow-hidden">
      {/* Header — merged banner + table title */}
      <div className="bg-danger/5 px-4 py-3 flex items-start gap-2 border-b border-danger/30">
        <Globe size={15} className="text-danger flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="text-xs text-danger space-y-0.5">
          <p className="font-semibold uppercase tracking-wide">PIT/ZG (v8) — Sekcja C.3 — Dochody zagraniczne (per kraj)</p>
          <p className="text-danger/80 font-normal normal-case tracking-normal">
            Transakcje w walutach obcych to dochody zagraniczne. Do PIT-38 musisz dołączyć załącznik PIT/ZG — jeden na kraj.
          </p>
        </div>
      </div>

      <div className="divide-y divide-danger/20">
        {/* Column headers */}
        <div className="grid grid-cols-4 gap-2 px-3 py-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wide">
          <span>Kraj (waluta)</span>
          <span className="text-right">Przychód</span>
          <span className="text-right">Koszty</span>
          <span className="text-right">Dochód (Poz. 29)</span>
        </div>

        {entries.map(({ currency, revenuePLN, costPLN, incomePLN, pitZgFields }) => {
          const country = CURRENCY_COUNTRY[currency];
          const isEurAmbiguous = currency === 'EUR';
          const g = fmtGain(incomePLN);
          return (
            <div key={currency} className="grid grid-cols-4 gap-2 px-3 py-2.5 text-xs items-center">
              <div className="flex items-center gap-1.5">
                <span className="bg-danger/10 text-danger px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide flex-shrink-0">
                  {pitZgFields?.countryCode || currency}
                </span>
                {country ? (
                  <span className="text-text-secondary truncate">{country}</span>
                ) : isEurAmbiguous ? (
                  <span className="flex items-center gap-1 text-danger">
                    <AlertTriangle size={11} aria-hidden="true" />
                    <span className="truncate">określ kraj</span>
                  </span>
                ) : (
                  <span className="text-text-muted truncate">określ kraj</span>
                )}
              </div>
              <span className="text-right tabular-nums text-text-secondary font-medium">
                {fmtPLNGrosze(revenuePLN)}
              </span>
              <span className="text-right tabular-nums text-text-secondary">
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
      <div className="bg-danger/5 px-3 py-2 text-[10px] text-danger/70 border-t border-danger/20">
        Podatek zapłacony za granicą (Poz. 30): <strong>0 zł</strong> — sprzedaż akcji nie podlega podatkowi u źródła w USA ani UE
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
    <div className="bg-bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-bg-card/60 border-b border-border">
        <h3 className="text-sm font-semibold text-text-primary">
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
              <div key={tx.id} className="flex items-center gap-2 text-xs py-1 border-b border-border last:border-0">
                <span className="w-5 h-5 rounded-full bg-bg-hover text-text-muted text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                  {globalIdx}
                </span>
                {tx.ticker && (
                  <span className="bg-accent-primary/10 text-accent-primary px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide flex-shrink-0">
                    {tx.ticker}
                  </span>
                )}
                {isForeign && (
                  <span className="bg-danger/10 text-danger px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0">
                    {tx.currency}
                  </span>
                )}
                {tx.tickerName && (
                  <span className="truncate text-text-muted hidden sm:block max-w-[120px]">
                    {tx.tickerName}
                  </span>
                )}
                <span className="text-text-muted flex-shrink-0 ml-auto">
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
        <div className="rounded-xl border border-accent-primary/30 overflow-hidden">
          <div className="bg-bg-hover/10 px-3 py-2 flex items-center gap-1.5">
          </div>
          <div className="px-4 py-3 space-y-0.5">
            {/* Section C — Domestic / Foreign split */}
            {(summary.domesticRevenuePLN > 0 || summary.foreignRevenuePLN > 0) && (
              <>
                {summary.domesticRevenuePLN > 0 && (
                  <>
                    <SummaryRow
                      label="Przychód (PIT-8C)"
                      note="(Poz. 20)"
                      value={fmtPLNGrosze(summary.pit38Fields.poz20_pit8cRevenue)}
                    />
                    <SummaryRow
                      label="Koszty (PIT-8C)"
                      note="(Poz. 21)"
                      value={fmtPLNGrosze(summary.pit38Fields.poz21_pit8cCosts)}
                    />
                  </>
                )}
                {summary.foreignRevenuePLN > 0 && (
                  <>
                    <SummaryRow
                      label="Inne przychody (zagraniczne)"
                      note="(Poz. 22)"
                      value={fmtPLNGrosze(summary.pit38Fields.poz22_foreignRevenue)}
                    />
                    <SummaryRow
                      label="Koszty (zagraniczne)"
                      note="(Poz. 23)"
                      value={fmtPLNGrosze(summary.pit38Fields.poz23_foreignCosts)}
                    />
                  </>
                )}
              </>
            )}
            {/* Section C — Totals (Row 4: Razem) */}
            <SummaryRow
              label="Razem przychód"
              note="(Poz. 26)"
              value={fmtPLNGrosze(summary.pit38Fields.poz26_totalRevenue)}
            />
            <SummaryRow
              label="Razem koszty uzyskania przychodu"
              note="(Poz. 27)"
              value={fmtPLNGrosze(summary.pit38Fields.poz27_totalCosts)}
            />
            {summary.totalLossPLN > 0 && (
              <SummaryRow
                label="Zyski brutto"
                value={fmtPLNGrosze(summary.totalGainPLN)}
                valueClass="text-success"
              />
            )}
            {summary.totalLossPLN > 0 && (
              <SummaryRow
                label="Straty (odliczane od zysków)"
                value={`−${fmtPLNGrosze(summary.totalLossPLN)}`}
                valueClass="text-danger"
              />
            )}
            <SummaryRow
              label={summary.netIncomePLN >= 0 ? 'Dochód' : 'Strata'}
              note={summary.netIncomePLN >= 0 ? '(Poz. 28)' : '(Poz. 29)'}
              value={`${summary.netIncomePLN >= 0 ? '+' : ''}${fmtPLNGrosze(summary.netIncomePLN)}`}
              valueClass={summary.netIncomePLN >= 0 ? 'text-text-primary' : 'text-danger'}
              bold
            />
          </div>
        </div>

        {/* ── PIT-38 Section D — Tax calculation ── */}
        {summary.netIncomePLN > 0 && (
          <div className="rounded-xl border border-accent-primary/30 overflow-hidden">
          <div className="bg-bg-hover/10 px-3 py-2 flex items-center gap-1.5">
              <FileText size={12} className="text-accent-primary" aria-hidden="true" />
              <span className="text-[11px] font-semibold text-accent-primary/80 uppercase tracking-wide">
                PIT-38 — Część D — Obliczenie podatku
              </span>
            </div>
            <div className="px-4 py-3 space-y-0.5">
              <SummaryRow
                label="Podstawa obliczenia podatku"
                note="(Poz. 31)"
                value={fmtPLNGrosze(summary.pit38Fields.poz31_taxBase)}
              />
              <SummaryRow
                label="Podatek 19%"
                note="(Poz. 33)"
                value={fmtPLNGrosze(summary.pit38Fields.poz33_tax)}
              />
              {summary.pit38Fields.poz34_foreignTaxCredit > 0 && (
                <SummaryRow
                  label="Podatek zapłacony za granicą"
                  note="(Poz. 34)"
                  value={`−${fmtPLNGrosze(summary.pit38Fields.poz34_foreignTaxCredit)}`}
                  valueClass="text-success"
                />
              )}
              <SummaryRow
                label="Podatek należny"
                note="(Poz. 35)"
                value={fmtPLNGrosze(summary.pit38Fields.poz35_taxDue)}
                bold
              />
            </div>
          </div>
        )}

        {/* ── PIT-38 Section G — Dividend tax (when dividends present) ── */}
        {summary.totalDividendGrossPLN > 0 && (
          <div className="rounded-xl border border-accent-primary/30 overflow-hidden">
            <div className="bg-accent-primary/5 px-3 py-2 flex items-center gap-1.5">
              <FileText size={12} className="text-accent-primary" aria-hidden="true" />
              <span className="text-[11px] font-semibold text-accent-primary uppercase tracking-wide">
                PIT-38 — Część G — Dywidendy zagraniczne
              </span>
            </div>
            <div className="px-4 py-3 space-y-0.5">
              <SummaryRow
                label="Podatek zryczałtowany (19%)"
                note="(Poz. 47)"
                value={fmtPLNGrosze(summary.pit38Fields.poz47_dividendTax)}
              />
              <SummaryRow
                label="Podatek zapłacony za granicą"
                note="(Poz. 48)"
                value={`−${fmtPLNGrosze(summary.pit38Fields.poz48_dividendForeignTaxCredit)}`}
                valueClass="text-success"
              />
              <SummaryRow
                label="Podatek od dywidend do zapłaty"
                note="(Poz. 49)"
                value={fmtPLNGrosze(summary.pit38Fields.poz49_dividendTaxDue)}
                bold
              />
            </div>
          </div>
        )}

        {/* ── PIT-ZG section ── */}
        {summary.requiresPitZg && <PitZgSection entries={summary.pitZgByCurrency} />}

        {/* ── Tax due box ── */}
        <div className={`rounded-xl border px-5 py-4 flex items-center justify-between gap-4 ${
          summary.pit38Fields.poz51_totalTaxDue > 0
            ? 'bg-danger/5 border-danger/30'
            : 'bg-bg-card/50 border-border'
        }`}>
          <div>
            <p className={`text-xs font-semibold mb-0.5 ${summary.pit38Fields.poz51_totalTaxDue > 0 ? 'text-danger' : 'text-text-muted'}`}>
              Podatek do zapłaty (Poz. 51)
            </p>
            <p className={`text-[11px] ${summary.pit38Fields.poz51_totalTaxDue > 0 ? 'text-danger/70' : 'text-text-muted'}`}>
              {summary.netIncomePLN > 0 || summary.totalDividendGrossPLN > 0
                ? `Poz. 35 + Poz. 49 = ${fmtPLNGrosze(summary.pit38Fields.poz35_taxDue)} + ${fmtPLNGrosze(summary.pit38Fields.poz49_dividendTaxDue)}`
                : 'brak podatku — dochód ≤ 0'}
            </p>
          </div>
          <p className={`text-2xl font-bold tabular-nums flex-shrink-0 ${
            summary.pit38Fields.poz51_totalTaxDue > 0 ? 'text-danger' : 'text-text-muted'
          }`}>
            {fmtPLNGrosze(summary.pit38Fields.poz51_totalTaxDue)}
          </p>
        </div>

        {/* ── Solidarity levy (danina solidarnościowa) ── */}
        {summary.solidarityLevyPLN > 0 && (
          <div className="rounded-xl border border-danger/30 bg-danger/5 px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold mb-0.5 text-danger ">
                Danina solidarnościowa (DSF-1)
              </p>
              <p className="text-[11px] text-danger/70">
                4% od nadwyżki ponad 1 000 000 zł ({fmtPLNGrosze(summary.netIncomePLN - 1_000_000)})
              </p>
            </div>
            <p className="text-xl font-bold tabular-nums flex-shrink-0 text-danger">
              {fmtPLNGrosze(summary.solidarityLevyPLN)}
            </p>
          </div>
        )}

        {/* ── Loss carryforward note ── */}
        {summary.netIncomePLN < 0 && (
          <div className="flex items-start gap-2 bg-bg-hover/10 border border-accent-primary/40 rounded-xl px-4 py-3 text-xs text-accent-primary/80">
            <TrendingDown size={14} className="flex-shrink-0 mt-0.5 text-accent-primary" aria-hidden="true" />
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

