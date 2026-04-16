import { useState, useMemo } from 'react';
import { Receipt, Info, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import { calcBelkaTax } from '../utils/taxCalculator';
import { fmtPLN, fmtUSD } from '../utils/formatting';
import { Tooltip } from './Tooltip';
import type { CurrencyRates } from '../hooks/useCurrencyRates';

export interface TaxCalculatorPanelProps {
  currencyRates: CurrencyRates;
}

const INPUT_CLS = 'w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400';
const LABEL_CLS = 'text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5';

/** Format a positive number with a sign prefix for display. */
function fmtSigned(v: number): string {
  return v >= 0 ? `+${fmtPLN(v)}` : fmtPLN(v);
}

export function TaxCalculatorPanel({ currencyRates }: TaxCalculatorPanelProps) {
  const [shares, setShares] = useState(0);
  const [sellPriceUSD, setSellPriceUSD] = useState(0);
  const [costBasisUSD, setCostBasisUSD] = useState(0);
  const [isRSU, setIsRSU] = useState(false);
  const [brokerFeeUSD, setBrokerFeeUSD] = useState(0);
  const [nbpRateSell, setNbpRateSell] = useState(0);
  const [nbpRateBuy, setNbpRateBuy] = useState(0);
  const [kantorRate, setKantorRate] = useState(0);

  // Auto-populate FX rates from live data (only if user hasn't typed yet)
  const [nbpSellTouched, setNbpSellTouched] = useState(false);
  const [kantorTouched, setKantorTouched] = useState(false);

  const effectiveNbpSell = nbpSellTouched ? nbpRateSell : (currencyRates.nbp?.mid ? Math.round(currencyRates.nbp.mid * 10000) / 10000 : nbpRateSell);
  const effectiveKantor = kantorTouched ? kantorRate : (currencyRates.alior?.buy ? Math.round(currencyRates.alior.buy * 10000) / 10000 : kantorRate);

  const canCalc = shares > 0 && sellPriceUSD > 0 && effectiveNbpSell > 0 && effectiveKantor > 0;

  const result = useMemo(() => {
    if (!canCalc) return null;
    return calcBelkaTax({
      shares,
      sellPriceUSD,
      costBasisUSD: isRSU ? 0 : costBasisUSD,
      brokerFeeUSD,
      nbpRateSell: effectiveNbpSell,
      nbpRateBuy: nbpRateBuy || effectiveNbpSell,
      kantorRate: effectiveKantor,
    });
  }, [canCalc, shares, sellPriceUSD, costBasisUSD, isRSU, brokerFeeUSD, effectiveNbpSell, nbpRateBuy, effectiveKantor]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <Receipt size={22} className="text-blue-600 dark:text-blue-400" aria-hidden="true" />
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Kalkulator podatku Belki</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Oblicz podatek 19% od zysku ze sprzedaży akcji w USD
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ────── Left: Inputs ────── */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 uppercase tracking-wider">Dane transakcji</h3>

          {/* Shares */}
          <div className="space-y-1">
            <label htmlFor="tax-shares" className={LABEL_CLS}>
              Liczba sprzedanych akcji <span className="text-red-500">*</span>
            </label>
            <input
              id="tax-shares"
              name="tax-shares"
              autoComplete="off"
              type="number"
              min={0}
              step={1}
              value={shares || ''}
              onChange={(e) => setShares(Number(e.target.value))}
              placeholder="np. 100"
              className={INPUT_CLS}
            />
          </div>

          {/* Sell price */}
          <div className="space-y-1">
            <label htmlFor="tax-sell-price" className={LABEL_CLS}>
              Cena sprzedaży za akcję (USD) <span className="text-red-500">*</span>
            </label>
            <input
              id="tax-sell-price"
              name="tax-sell-price"
              autoComplete="off"
              type="number"
              min={0}
              step={0.01}
              value={sellPriceUSD || ''}
              onChange={(e) => setSellPriceUSD(Number(e.target.value))}
              placeholder="np. 195.00"
              className={INPUT_CLS}
            />
          </div>

          {/* Cost basis + RSU toggle */}
          <div className="space-y-1">
            <label htmlFor="tax-cost-basis" className={LABEL_CLS}>
              Cena zakupu za akcję (USD)
              <Tooltip content="Średnia cena zakupu (cost basis). Dla akcji z wynagrodzenia (RSU/grant) zaznacz opcję poniżej." />
            </label>
            <input
              id="tax-cost-basis"
              name="tax-cost-basis"
              autoComplete="off"
              type="number"
              min={0}
              step={0.01}
              value={isRSU ? '' : (costBasisUSD || '')}
              onChange={(e) => setCostBasisUSD(Number(e.target.value))}
              disabled={isRSU}
              placeholder={isRSU ? 'RSU — koszt $0' : 'np. 150.00'}
              className={`${INPUT_CLS} ${isRSU ? 'bg-gray-100 dark:bg-gray-600 opacity-60' : ''}`}
            />
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer mt-1.5">
              <input
                type="checkbox"
                checked={isRSU}
                onChange={(e) => {
                  setIsRSU(e.target.checked);
                  if (e.target.checked) setCostBasisUSD(0);
                }}
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              Akcje z wynagrodzenia (RSU/grant) — koszt uzyskania = $0
            </label>
          </div>

          {/* Broker fee */}
          <div className="space-y-1">
            <label htmlFor="tax-broker-fee" className={LABEL_CLS}>
              Prowizja brokera (USD)
              <Tooltip content="Łączna prowizja za transakcję sprzedaży. Odliczana od dochodu jako koszt uzyskania przychodu." />
            </label>
            <input
              id="tax-broker-fee"
              name="tax-broker-fee"
              autoComplete="off"
              type="number"
              min={0}
              step={0.01}
              value={brokerFeeUSD || ''}
              onChange={(e) => setBrokerFeeUSD(Number(e.target.value))}
              placeholder="np. 4.95 (opcjonalne)"
              className={INPUT_CLS}
            />
          </div>

          <hr className="border-gray-200 dark:border-gray-700" />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 uppercase tracking-wider">Kursy walut</h3>

          {/* NBP sell date rate */}
          <div className="space-y-1">
            <label htmlFor="tax-nbp-sell" className={LABEL_CLS}>
              Kurs NBP średni — data sprzedaży <span className="text-red-500">*</span>
              <Tooltip content="Kurs średni z tabeli A NBP z dnia poprzedzającego dzień sprzedaży. Używany do obliczenia podstawy podatkowej (przychodu)." width="w-72" />
            </label>
            <input
              id="tax-nbp-sell"
              name="tax-nbp-sell"
              autoComplete="off"
              type="number"
              min={0}
              step={0.0001}
              value={nbpSellTouched ? (nbpRateSell || '') : (effectiveNbpSell || '')}
              onChange={(e) => { setNbpSellTouched(true); setNbpRateSell(Number(e.target.value)); }}
              placeholder="np. 3.9785"
              className={INPUT_CLS}
            />
            {!nbpSellTouched && effectiveNbpSell > 0 && (
              <p className="text-[11px] text-green-600 dark:text-green-400">Auto: NBP {effectiveNbpSell.toFixed(4)}</p>
            )}
          </div>

          {/* NBP buy date rate */}
          <div className="space-y-1">
            <label htmlFor="tax-nbp-buy" className={LABEL_CLS}>
              Kurs NBP średni — data zakupu
              <Tooltip content="Kurs średni z tabeli A NBP z dnia poprzedzającego dzień zakupu. Używany do obliczenia kosztu uzyskania przychodu. Jeśli nie podasz, użyty zostanie kurs z daty sprzedaży." width="w-72" />
            </label>
            <input
              id="tax-nbp-buy"
              name="tax-nbp-buy"
              autoComplete="off"
              type="number"
              min={0}
              step={0.0001}
              value={nbpRateBuy || ''}
              onChange={(e) => setNbpRateBuy(Number(e.target.value))}
              placeholder="np. 3.8500 (domyślnie = kurs sprzedaży)"
              className={INPUT_CLS}
            />
          </div>

          {/* Kantor rate */}
          <div className="space-y-1">
            <label htmlFor="tax-kantor" className={LABEL_CLS}>
              Kurs kantor / bank — faktyczna wymiana <span className="text-red-500">*</span>
              <Tooltip content="Kurs po jakim faktycznie wymieniasz USD na PLN (kantor internetowy, bank, broker). Wpływa na realną kwotę wypłaty." width="w-72" />
            </label>
            <input
              id="tax-kantor"
              name="tax-kantor"
              autoComplete="off"
              type="number"
              min={0}
              step={0.0001}
              value={kantorTouched ? (kantorRate || '') : (effectiveKantor || '')}
              onChange={(e) => { setKantorTouched(true); setKantorRate(Number(e.target.value)); }}
              placeholder="np. 3.9543"
              className={INPUT_CLS}
            />
            {!kantorTouched && effectiveKantor > 0 && (
              <p className="text-[11px] text-green-600 dark:text-green-400">Auto: Alior Kantor {effectiveKantor.toFixed(4)}</p>
            )}
          </div>

          {/* Dual-rate explanation */}
          <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-lg px-3 py-2.5 text-[11px] text-gray-600 dark:text-gray-400 space-y-1">
            <div className="font-semibold text-blue-700 dark:text-blue-300 text-xs">Dlaczego dwa kursy?</div>
            <p>
              <strong className="text-gray-700 dark:text-gray-300">Kurs NBP</strong> — wymagany przez prawo podatkowe do obliczenia podstawy opodatkowania (PIT-38).
            </p>
            <p>
              <strong className="text-gray-700 dark:text-gray-300">Kurs kantor</strong> — faktyczny kurs po jakim wymieniasz walutę. Wpływa na realną kwotę, którą otrzymasz.
            </p>
          </div>
        </div>

        {/* ────── Right: Results ────── */}
        <div className="space-y-4">
          {!canCalc ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-10 text-center text-gray-400 dark:text-gray-500 space-y-2">
              <Receipt size={32} className="mx-auto opacity-40" aria-hidden="true" />
              <p className="text-sm">Uzupełnij dane transakcji, aby zobaczyć rozliczenie podatkowe</p>
            </div>
          ) : result ? (
            <>
              {/* RSU banner */}
              {result.isRSU && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-amber-500" aria-hidden="true" />
                  <p>
                    <strong>Akcje z wynagrodzenia (RSU/grant)</strong> — koszt uzyskania przychodu wynosi 0 PLN.
                    Podatek Belki naliczany jest od pełnej kwoty przychodu ze sprzedaży.
                  </p>
                </div>
              )}

              {/* Loss banner */}
              {result.isLoss && !result.isRSU && (
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 text-xs text-green-800 dark:text-green-300 flex items-start gap-2">
                  <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-green-500" aria-hidden="true" />
                  <div>
                    <p><strong>Brak podatku</strong> — transakcja przyniosła stratę ({fmtPLN(result.taxableGainPLN)}).</p>
                    <p className="mt-1 opacity-80">
                      Stratę można odliczyć od zysków kapitałowych w PIT-38 w ciągu kolejnych 5 lat podatkowych
                      (maks. 50% straty rocznie).
                    </p>
                  </div>
                </div>
              )}

              {/* Tax basis card (NBP) */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Podstawa opodatkowania (kurs NBP)</h3>
                </div>

                <div className="space-y-2 text-sm">
                  <Row
                    label="Przychód ze sprzedaży"
                    detail={`${shares} × ${fmtUSD(sellPriceUSD)} × ${effectiveNbpSell.toFixed(4)}`}
                    value={fmtPLN(result.revenueNbpPLN)}
                  />
                  {!result.isRSU && (
                    <Row
                      label="Koszt uzyskania przychodu"
                      detail={`${shares} × ${fmtUSD(isRSU ? 0 : costBasisUSD)} × ${(nbpRateBuy || effectiveNbpSell).toFixed(4)}`}
                      value={`−${fmtPLN(result.costBasisNbpPLN)}`}
                      muted
                    />
                  )}
                  {result.isRSU && (
                    <Row label="Koszt uzyskania przychodu" detail="RSU/grant" value="0 PLN" muted />
                  )}
                  {brokerFeeUSD > 0 && (
                    <Row
                      label="Prowizja brokera"
                      detail={`${fmtUSD(brokerFeeUSD)} × ${effectiveNbpSell.toFixed(4)}`}
                      value={`−${fmtPLN(result.brokerFeeNbpPLN)}`}
                      muted
                    />
                  )}

                  <hr className="border-gray-200 dark:border-gray-700" />

                  <Row
                    label="Dochód do opodatkowania"
                    value={fmtSigned(result.taxableGainPLN)}
                    bold
                    highlight={result.isLoss ? 'loss' : 'gain'}
                  />
                  <Row
                    label="Podatek Belki (19%)"
                    value={fmtPLN(result.belkaTaxPLN)}
                    bold
                    highlight={result.belkaTaxPLN > 0 ? 'tax' : undefined}
                  />
                </div>
              </div>

              {/* Payout card (kantor) */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Faktyczna wypłata (kurs kantor)</h3>
                </div>

                <div className="space-y-2 text-sm">
                  <Row
                    label="Przychód brutto"
                    detail={`${shares} × ${fmtUSD(sellPriceUSD)} × ${effectiveKantor.toFixed(4)}`}
                    value={fmtPLN(result.grossProceedsKantorPLN)}
                  />
                  {brokerFeeUSD > 0 && (
                    <Row
                      label="Prowizja brokera"
                      detail={`${fmtUSD(brokerFeeUSD)} × ${effectiveKantor.toFixed(4)}`}
                      value={`−${fmtPLN(result.brokerFeeKantorPLN)}`}
                      muted
                    />
                  )}
                  <Row
                    label="Podatek Belki"
                    value={`−${fmtPLN(result.belkaTaxPLN)}`}
                    muted
                  />

                  <hr className="border-gray-200 dark:border-gray-700" />

                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg px-4 py-3 flex items-center justify-between">
                    <span className="font-semibold text-gray-800 dark:text-gray-100">Do wypłaty netto</span>
                    <span className="text-lg font-bold text-green-700 dark:text-green-400 tabular-nums">{fmtPLN(result.netProceedsPLN)}</span>
                  </div>
                </div>
              </div>

              {/* Summary card */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
                  <Info size={14} className="text-gray-400" aria-hidden="true" />
                  Podsumowanie
                </h3>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div className="text-gray-500 dark:text-gray-400">Efektywna stawka podatkowa</div>
                  <div className="text-right font-semibold text-gray-800 dark:text-gray-100 tabular-nums">
                    {result.effectiveTaxRate.toFixed(2)}%
                    <span className="text-xs text-gray-400 dark:text-gray-500 font-normal ml-1">od brutto</span>
                  </div>

                  <div className="text-gray-500 dark:text-gray-400">Różnica kursowa (kantor vs NBP)</div>
                  <div className="text-right font-medium tabular-nums text-gray-800 dark:text-gray-100">
                    {fmtPLN(result.grossProceedsKantorPLN - result.revenueNbpPLN)}
                  </div>

                  {!result.isLoss && (
                    <>
                      <div className="text-gray-500 dark:text-gray-400">Zysk netto po podatku</div>
                      <div className="text-right font-semibold text-green-700 dark:text-green-400 tabular-nums">
                        {fmtPLN(result.netProceedsPLN - result.costBasisNbpPLN)}
                      </div>
                    </>
                  )}
                </div>

                {/* Flow visualization */}
                <div className="flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-500 pt-2">
                  <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-medium">
                    {fmtUSD(shares * sellPriceUSD)}
                  </span>
                  <ArrowRight size={12} aria-hidden="true" />
                  <span className="text-gray-500 dark:text-gray-400">−{fmtPLN(result.belkaTaxPLN)} podatek</span>
                  <ArrowRight size={12} aria-hidden="true" />
                  <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded font-medium">
                    {fmtPLN(result.netProceedsPLN)}
                  </span>
                </div>
              </div>

              {/* PIT-38 note */}
              <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/40 rounded-lg px-4 py-3 space-y-1.5 border border-gray-100 dark:border-gray-700">
                <p className="font-semibold text-gray-700 dark:text-gray-300">📋 Rozliczenie PIT-38</p>
                <p>
                  Zyski kapitałowe z akcji zagranicznych rozliczasz w rocznym zeznaniu PIT-38 (termin: 30 kwietnia).
                  Broker zagraniczny (np. E*TRADE, Interactive Brokers) nie odprowadza podatku automatycznie — to Twój obowiązek.
                </p>
                {result.isLoss && (
                  <p>
                    Strata z inwestycji może być odliczona od zysków kapitałowych w PIT-38 w ciągu 5 kolejnych lat
                    (maksymalnie 50% straty w jednym roku).
                  </p>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Reusable row component for the breakdown tables. */
function Row({ label, detail, value, bold, muted, highlight }: {
  label: string;
  detail?: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
  highlight?: 'gain' | 'loss' | 'tax';
}) {
  const valueColor = highlight === 'gain'
    ? 'text-green-700 dark:text-green-400'
    : highlight === 'loss'
      ? 'text-red-600 dark:text-red-400'
      : highlight === 'tax'
        ? 'text-amber-700 dark:text-amber-400'
        : muted
          ? 'text-gray-500 dark:text-gray-400'
          : 'text-gray-800 dark:text-gray-100';

  return (
    <div className="flex items-baseline justify-between gap-2">
      <div className="min-w-0">
        <span className={`${bold ? 'font-semibold text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'}`}>
          {label}
        </span>
        {detail && (
          <span className="block text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">{detail}</span>
        )}
      </div>
      <span className={`whitespace-nowrap tabular-nums font-mono text-sm ${bold ? 'font-bold' : 'font-medium'} ${valueColor}`}>
        {value}
      </span>
    </div>
  );
}
